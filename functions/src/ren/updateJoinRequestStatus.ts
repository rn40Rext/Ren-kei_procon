import {HttpsError, onCall} from "firebase-functions/v2/https";
import {FieldValue, Firestore, getFirestore} from "firebase-admin/firestore";
import {requireAuth, requireRenAdmin} from "../lib/guards";
import {ErrorCode, httpsErrorFor} from "../lib/errors";
import {notifyUser} from "../lib/notifications";
import {resolveDisplayName} from "../lib/users";

interface UpdateJoinRequestStatusRequest {
  requestId: string;
  action: "approve" | "reject";
}

/**
 * リクエストの形式を検証する。
 * @param {unknown} data Callable Functionsに渡された生のリクエストデータ。
 */
function assertValidRequest(
  data: unknown
): asserts data is UpdateJoinRequestStatusRequest {
  const d = data as Partial<UpdateJoinRequestStatusRequest> | null;
  const requestIdOk =
    d && typeof d.requestId === "string" && d.requestId.length > 0;
  if (!requestIdOk) {
    throw new HttpsError("invalid-argument", "requestId is required");
  }
  if (d.action !== "approve" && d.action !== "reject") {
    throw new HttpsError(
      "invalid-argument",
      "action must be 'approve' or 'reject'"
    );
  }
}

/**
 * 連管理者が参加申請(joinRequests)を承認・却下する(#32)。
 * 申請者が自分でapprovedにできないよう、firestore.rulesは
 * joinRequests.updateをpending→cancelled(申請者本人)のみに限定して
 * おり、approve/rejectは本関数(Admin SDK)経由に一本化している。
 * status更新・members作成・notification作成が部分的にしか成功しない
 * 状態を避けるため、1つのトランザクションで行う。
 */
const NOTIFICATION_BATCH_SIZE = 500;

export const updateJoinRequestStatus = onCall(async (request) => {
  const uid = requireAuth(request);
  assertValidRequest(request.data);
  const {requestId, action} = request.data;

  const db = getFirestore();
  const requestRef = db.collection("joinRequests").doc(requestId);

  let approvedRenId: string | null = null;
  let approvedApplicantId: string | null = null;

  await db.runTransaction(async (tx) => {
    const requestSnap = await tx.get(requestRef);
    if (!requestSnap.exists) {
      throw new HttpsError("not-found", "join request not found");
    }
    const requestData = requestSnap.data();
    const renId = requestData?.renId as string;
    const applicantId = requestData?.userId as string;

    await requireRenAdmin(uid, renId);

    if (requestData?.status !== "pending") {
      throw httpsErrorFor(ErrorCode.INVALID_STATUS_TRANSITION);
    }

    const renSnap = await tx.get(db.doc(`ren/${renId}`));
    const renName = (renSnap.data()?.name as string) ?? "連";

    const newStatus = action === "approve" ? "approved" : "rejected";
    tx.update(requestRef, {
      status: newStatus,
      handledBy: uid,
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (action === "approve") {
      tx.set(db.doc(`ren/${renId}/members/${applicantId}`), {
        userId: applicantId,
        role: "member",
        status: "active",
        joinedAt: FieldValue.serverTimestamp(),
      });
      approvedRenId = renId;
      approvedApplicantId = applicantId;
    }

    await notifyUser(
      db,
      {
        uid: applicantId,
        type: "join_result",
        referenceId: requestId,
        title: action === "approve" ? "参加リクエストが承認されました" : "参加リクエストが却下されました",
        body: action === "approve" ?
          `「${renName}」への参加が承認されました。` :
          `「${renName}」への参加リクエストは却下されました。`,
      },
      {tx}
    );
  });

  if (approvedRenId && approvedApplicantId) {
    await notifyExistingMembersOfNewJoiner(
      db,
      approvedRenId,
      approvedApplicantId,
      uid
    );
  }

  return {status: action === "approve" ? "approved" : "rejected"};
});

/**
 * 新メンバーが加入したことを、その連の既存メンバー全員(新メンバー本人と、
 * 今回承認した管理者自身を除く)へ通知する。
 * @param {Firestore} db Admin SDKのFirestoreインスタンス。
 * @param {string} renId 加入先の連ID。
 * @param {string} newMemberUid 新しく加入したメンバーのuid。
 * @param {string} approvedByUid 今回承認した管理者のuid(通知対象から除く)。
 * @return {Promise<void>} 通知の書き込み完了。
 */
async function notifyExistingMembersOfNewJoiner(
  db: Firestore,
  renId: string,
  newMemberUid: string,
  approvedByUid: string
): Promise<void> {
  const [renSnap, membersSnap, newMemberName] = await Promise.all([
    db.doc(`ren/${renId}`).get(),
    db
      .collection(`ren/${renId}/members`)
      .where("status", "==", "active")
      .get(),
    resolveDisplayName(db, newMemberUid),
  ]);
  const renName = (renSnap.data()?.name as string) ?? "連";

  const recipientUids = membersSnap.docs
    .map((memberDoc) => memberDoc.id)
    .filter(
      (memberUid) => memberUid !== newMemberUid && memberUid !== approvedByUid
    );

  for (let i = 0; i < recipientUids.length; i += NOTIFICATION_BATCH_SIZE) {
    const chunk = recipientUids.slice(i, i + NOTIFICATION_BATCH_SIZE);
    await Promise.all(
      chunk.map((memberUid) =>
        notifyUser(db, {
          uid: memberUid,
          type: "member_joined",
          referenceId: renId,
          title: "新しいメンバーが参加しました",
          body: `「${renName}」に${newMemberName}さんが参加しました。`,
        })
      )
    );
  }
}

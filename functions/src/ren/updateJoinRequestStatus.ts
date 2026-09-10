import {HttpsError, onCall} from "firebase-functions/v2/https";
import {FieldValue, getFirestore} from "firebase-admin/firestore";
import {requireAuth, requireRenAdmin} from "../lib/guards";
import {ErrorCode, httpsErrorFor} from "../lib/errors";

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
export const updateJoinRequestStatus = onCall(async (request) => {
  const uid = requireAuth(request);
  assertValidRequest(request.data);
  const {requestId, action} = request.data;

  const db = getFirestore();
  const requestRef = db.collection("joinRequests").doc(requestId);

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
    }

    const notificationRef = db
      .collection("users")
      .doc(applicantId)
      .collection("notifications")
      .doc();
    tx.set(notificationRef, {
      userId: applicantId,
      type: "join_result",
      referenceId: requestId,
      title: action === "approve" ? "参加リクエストが承認されました" : "参加リクエストが却下されました",
      body: action === "approve" ?
        `「${renName}」への参加が承認されました。` :
        `「${renName}」への参加リクエストは却下されました。`,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  return {status: action === "approve" ? "approved" : "rejected"};
});

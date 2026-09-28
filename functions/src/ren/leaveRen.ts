import {HttpsError, onCall} from "firebase-functions/v2/https";
import {getFirestore} from "firebase-admin/firestore";
import {requireAuth} from "../lib/guards";
import {ErrorCode, httpsErrorFor} from "../lib/errors";

interface LeaveRenRequest {
  renId: string;
}

/**
 * リクエストの形式を検証する。
 * @param {unknown} data Callable Functionsに渡された生のリクエストデータ。
 */
function assertValidRequest(
  data: unknown
): asserts data is LeaveRenRequest {
  const d = data as Partial<LeaveRenRequest> | null;
  const renIdOk = d && typeof d.renId === "string" && d.renId.length > 0;
  if (!renIdOk) {
    throw new HttpsError("invalid-argument", "renId is required");
  }
}

/**
 * 本人が連から脱退する。firestore.rulesは以前 members.delete を本人自身に
 * 限り直接許可していたが、脱退者が連唯一の管理者だった場合に連が
 * 管理者不在になってしまう(「最後の管理者を降格・削除できない」という
 * updateMemberRole/removeMemberと同じ不変条件)。この検証はRules単体
 * (get()のみ、残り管理者数を数える集計クエリ不可)では表現できないため、
 * updateMemberRole/removeMemberと同じくCloud Functionsに一本化した。
 */
export const leaveRen = onCall(async (request) => {
  const uid = requireAuth(request);
  assertValidRequest(request.data);
  const {renId} = request.data;

  const db = getFirestore();
  const memberRef = db.doc(`ren/${renId}/members/${uid}`);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(memberRef);
    if (!snap.exists) {
      throw new HttpsError("not-found", "member not found");
    }

    if (snap.data()?.role === "admin") {
      const adminsSnap = await db
        .collection(`ren/${renId}/members`)
        .where("role", "==", "admin")
        .where("status", "==", "active")
        .get();
      const remainingAdmins = adminsSnap.docs.filter((d) => d.id !== uid);
      if (remainingAdmins.length === 0) {
        throw httpsErrorFor(ErrorCode.INVALID_STATUS_TRANSITION);
      }
    }

    tx.delete(memberRef);
  });

  return {left: true};
});

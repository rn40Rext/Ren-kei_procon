import {HttpsError, onCall} from "firebase-functions/v2/https";
import {getFirestore} from "firebase-admin/firestore";
import {requireAuth, requireRenAdmin} from "../lib/guards";
import {ErrorCode, httpsErrorFor} from "../lib/errors";

interface RemoveMemberRequest {
  renId: string;
  uid: string;
}

/**
 * リクエストの形式を検証する。
 * @param {unknown} data Callable Functionsに渡された生のリクエストデータ。
 */
function assertValidRequest(
  data: unknown
): asserts data is RemoveMemberRequest {
  const d = data as Partial<RemoveMemberRequest> | null;
  const renIdOk = d && typeof d.renId === "string" && d.renId.length > 0;
  const uidOk = d && typeof d.uid === "string" && d.uid.length > 0;
  if (!renIdOk || !uidOk) {
    throw new HttpsError("invalid-argument", "renId and uid are required");
  }
}

/**
 * 連管理者がメンバーを除名する(#33)。本人による脱退は
 * firestore.rulesのdelete: isSelf(uid)で直接許可しているため対象外
 * (本関数を経由しなくても脱退できる)。管理者による他メンバーの除名は
 * 「最後の管理者を削除できない」という不変条件をFirestore Rules単体
 * では検証できないため、本関数に一本化する。
 */
export const removeMember = onCall(async (request) => {
  const callerUid = requireAuth(request);
  assertValidRequest(request.data);
  const {renId, uid} = request.data;

  await requireRenAdmin(callerUid, renId);

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

  return {removed: true};
});

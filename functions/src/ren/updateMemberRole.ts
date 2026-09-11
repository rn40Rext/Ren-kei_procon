import {HttpsError, onCall} from "firebase-functions/v2/https";
import {getFirestore} from "firebase-admin/firestore";
import {requireAuth, requireRenAdmin} from "../lib/guards";
import {ErrorCode, httpsErrorFor} from "../lib/errors";

interface UpdateMemberRoleRequest {
  renId: string;
  uid: string;
  role: "admin" | "member";
}

/**
 * リクエストの形式を検証する。
 * @param {unknown} data Callable Functionsに渡された生のリクエストデータ。
 */
function assertValidRequest(
  data: unknown
): asserts data is UpdateMemberRoleRequest {
  const d = data as Partial<UpdateMemberRoleRequest> | null;
  const renIdOk = d && typeof d.renId === "string" && d.renId.length > 0;
  const uidOk = d && typeof d.uid === "string" && d.uid.length > 0;
  if (!renIdOk || !uidOk) {
    throw new HttpsError("invalid-argument", "renId and uid are required");
  }
  if (d.role !== "admin" && d.role !== "member") {
    throw new HttpsError(
      "invalid-argument",
      "role must be 'admin' or 'member'"
    );
  }
}

/**
 * 連管理者がメンバーの役割(member⇄admin)を変更する(#33)。
 * 「最後の管理者を降格できない」というren単位の不変条件はRulesの
 * get()単体では表現できない(残りadmin人数を数える必要がある)ため、
 * firestore.rulesはmembers.updateを常に拒否し、本関数に一本化する。
 * 仕様書13章にこの制約専用のエラーコードは無いため、
 * INVALID_STATUS_TRANSITIONを流用する(docs/design/security-rules.md参照)。
 */
export const updateMemberRole = onCall(async (request) => {
  const callerUid = requireAuth(request);
  assertValidRequest(request.data);
  const {renId, uid, role} = request.data;

  await requireRenAdmin(callerUid, renId);

  const db = getFirestore();
  const memberRef = db.doc(`ren/${renId}/members/${uid}`);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(memberRef);
    if (!snap.exists) {
      throw new HttpsError("not-found", "member not found");
    }

    if (snap.data()?.role === "admin" && role === "member") {
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

    tx.update(memberRef, {role});
  });

  return {role};
});

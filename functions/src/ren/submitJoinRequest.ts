import {HttpsError, onCall} from "firebase-functions/v2/https";
import {FieldValue, getFirestore} from "firebase-admin/firestore";
import {requireAuth} from "../lib/guards";
import {ErrorCode, httpsErrorFor} from "../lib/errors";

interface SubmitJoinRequestRequest {
  renId: string;
  message?: string;
}

/**
 * リクエストの形式を検証する。
 * @param {unknown} data Callable Functionsに渡された生のリクエストデータ。
 */
function assertValidRequest(
  data: unknown
): asserts data is SubmitJoinRequestRequest {
  const d = data as Partial<SubmitJoinRequestRequest> | null;
  const renIdOk = d && typeof d.renId === "string" && d.renId.length > 0;

  if (!renIdOk) {
    throw new HttpsError("invalid-argument", "renId is required");
  }
  if (
    d.message !== undefined &&
    (typeof d.message !== "string" || d.message.length > 500)
  ) {
    throw new HttpsError(
      "invalid-argument",
      "message must be at most 500 characters"
    );
  }
}

/**
 * 連への参加申請(joinRequests)を作成する。重複申請と既存メンバーの
 * 再申請は、複数ドキュメントにまたがる検証のためFirestore Rulesでは
 * 表現できず、ここ(Cloud Functions)でチェックする。そのため
 * firestore.rulesはjoinRequests.createを常に拒否し、本関数経由に
 * 一本化している。
 */
export const submitJoinRequest = onCall(async (request) => {
  const uid = requireAuth(request);
  assertValidRequest(request.data);
  const {renId, message} = request.data;

  const db = getFirestore();

  const memberSnap = await db.doc(`ren/${renId}/members/${uid}`).get();
  if (memberSnap.exists && memberSnap.data()?.status === "active") {
    // 仕様書13章に専用のエラーコードは定義されていないため、
    // failed-preconditionを直接使う。
    throw new HttpsError("failed-precondition", "ALREADY_MEMBER");
  }

  const pendingSnap = await db
    .collection("joinRequests")
    .where("userId", "==", uid)
    .where("renId", "==", renId)
    .where("status", "==", "pending")
    .limit(1)
    .get();
  if (!pendingSnap.empty) {
    throw httpsErrorFor(ErrorCode.JOIN_REQUEST_ALREADY_PENDING);
  }

  const requestRef = db.collection("joinRequests").doc();
  await requestRef.set({
    userId: uid,
    renId,
    message: message ?? "",
    status: "pending",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {requestId: requestRef.id};
});

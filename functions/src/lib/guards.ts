import {CallableRequest} from "firebase-functions/v2/https";
import {getFirestore} from "firebase-admin/firestore";
import {ErrorCode, httpsErrorFor} from "./errors";

/**
 * 認証済みユーザーのuidを返す。未認証ならUNAUTHORIZEDを投げる。
 * @param {CallableRequest} request Callable Functionsのリクエスト。
 * @return {string} 認証済みユーザーのuid。
 */
export function requireAuth(request: CallableRequest): string {
  if (!request.auth?.uid) {
    throw httpsErrorFor(ErrorCode.UNAUTHORIZED);
  }
  return request.auth.uid;
}

/**
 * 対象連の管理者であることを検証する。users.roleではなく
 * ren/{renId}/members/{uid}.roleで判定する(仕様書10.3・6章)。
 * これを省くと連Aの管理者が連Bを編集できる権限昇格になるため、
 * 連管理者向けの全Functionsで必須(#29)。
 * @param {string} uid 検証対象ユーザーのuid。
 * @param {string} renId 検証対象の連ID。
 * @return {Promise<void>} 管理者でなければFORBIDDENを投げる。
 */
export async function requireRenAdmin(
  uid: string,
  renId: string
): Promise<void> {
  const db = getFirestore();
  const snap = await db.doc(`ren/${renId}/members/${uid}`).get();
  if (!snap.exists || snap.data()?.role !== "admin") {
    throw httpsErrorFor(ErrorCode.FORBIDDEN);
  }
}

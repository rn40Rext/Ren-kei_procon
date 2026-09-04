import {CallableRequest, HttpsError} from "firebase-functions/v2/https";
import {db} from "./firebase";
import {ErrorCode} from "./errors";

/**
 * 認証済みであることを検証し uid を返す。
 * @param {CallableRequest} req Callable リクエスト
 * @return {string} 呼び出し元の uid
 */
export function requireAuth(req: CallableRequest): string {
  const uid = req.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", ErrorCode.UNAUTHORIZED);
  }
  return uid;
}

/**
 * 対象連の管理者であることを検証する。
 *
 * users.role だけでは判定しない（連 A の管理者が連 B を操作できてしまう）。
 * 唯一の根拠は ren/{renId}/members/{uid}.role == "admin"。
 * @param {string} uid 呼び出し元 uid
 * @param {string} renId 対象の連 ID
 * @return {Promise<void>}
 */
export async function requireRenAdmin(
  uid: string,
  renId: string,
): Promise<void> {
  const snap = await db.doc(`ren/${renId}/members/${uid}`).get();
  if (!snap.exists || snap.data()?.role !== "admin") {
    throw new HttpsError("permission-denied", ErrorCode.FORBIDDEN);
  }
}

/**
 * 必須の文字列引数を取り出す。
 * @param {unknown} value 検証対象
 * @param {string} name 引数名（ログ用）
 * @return {string} 検証済みの文字列
 */
export function requireString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpsError(
      "invalid-argument",
      `${ErrorCode.INVALID_ARGUMENT}:${name}`,
    );
  }
  return value;
}

import {Firestore} from "firebase-admin/firestore";

/**
 * 通知の本文などに載せる表示名を解決する(users/{uid}のnicknameを優先、
 * 無ければname、どちらも無ければ既定値)。
 * クライアント側の repositories/users.ts の myDisplayName と揃える。
 * @param {Firestore} db Admin SDKのFirestoreインスタンス。
 * @param {string} uid 表示名を解決する対象ユーザーのuid。
 * @return {Promise<string>} 表示名(nickname優先、無ければ既定値「踊り子」)。
 */
export async function resolveDisplayName(
  db: Firestore,
  uid: string
): Promise<string> {
  const snap = await db.doc(`users/${uid}`).get();
  const d = snap.data();
  const nickname = d?.nickname && String(d.nickname).trim();
  const name = d?.name && String(d.name).trim();
  return nickname || name || "踊り子";
}

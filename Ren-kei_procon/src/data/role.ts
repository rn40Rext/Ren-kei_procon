/**
 * ログイン中ユーザーの役割（users/{uid}.role）。
 * 連長クラス（連の世話役・運営）向けの機能をどこで出し分けるか判定するために使う。
 */
import { useEffect, useState } from 'react';
import { auth, db } from '../config/firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';

export type Role = 'user' | 'ren_admin' | 'service_admin';

export const ROLE_LABEL: Record<Role, string> = {
  user: '踊り手',
  ren_admin: '連の世話役',
  service_admin: '運営',
};

/** 「連長クラス」＝踊り手より上の役割かどうか。連への勧誘など管理寄りの操作を出し分けるのに使う。 */
export function isRenLeaderClass(role: Role): boolean {
  return role !== 'user';
}

/** users/{uid}.role をリアルタイムに購読する。ログイン前・取得前は 'user' を返す。 */
export function useMyRole(): Role {
  const [role, setRole] = useState<Role>('user');

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const unsub = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        const r = snap.data()?.role;
        setRole(r === 'ren_admin' || r === 'service_admin' ? r : 'user');
      },
      () => setRole('user'),
    );
    return unsub;
  }, []);

  return role;
}

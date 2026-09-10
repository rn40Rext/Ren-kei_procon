import { useEffect, useState } from 'react';
import { collectionGroup, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../config/firebaseConfig';

export interface AdminRen {
  renId: string;
  name: string;
}

/**
 * 自分がrole:'admin'として所属する連の一覧を返す(#29)。
 * users.roleではなくren/{renId}/members/{uid}.roleを正とする
 * (仕様書10.3・6章)。複数連の管理者になり得るため配列を返す。
 */
export function useAdminRens() {
  const [adminRens, setAdminRens] = useState<AdminRen[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setLoading(false);
      return;
    }

    // members はcollectionGroupクエリ(要: 複合インデックス)。
    const q = query(
      collectionGroup(db, 'members'),
      where('userId', '==', currentUser.uid),
      where('role', '==', 'admin'),
      where('status', '==', 'active')
    );

    return onSnapshot(
      q,
      async (snap) => {
        const results = await Promise.all(
          snap.docs.map(async (memberDoc) => {
            const renId = memberDoc.ref.parent.parent?.id ?? '';
            const renSnap = await getDoc(doc(db, 'ren', renId));
            const name = renSnap.exists() ? (renSnap.data().name as string) : renId;
            return { renId, name };
          })
        );
        setAdminRens(results);
        setLoading(false);
      },
      (error) => {
        console.error('管理者権限の取得に失敗しました', error);
        setLoading(false);
      }
    );
  }, []);

  return { adminRens, loading };
}

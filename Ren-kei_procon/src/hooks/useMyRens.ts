import { useEffect, useState } from 'react';
import { collectionGroup, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../config/firebaseConfig';

// docs/design/data-model.md 3.8章
export interface MyRen {
  renId: string;
  name: string;
  description: string;
  location: string;
  iconUrl: string;
  memberCount: number;
  role: 'member' | 'admin';
}

/**
 * 自分がstatus:'active'として所属する連の一覧を返す(#28)。
 * role(member/admin)を問わない点がuseAdminRens(#29)との違い。
 * 1ユーザーが複数連に所属し得るため配列を返す(仕様書どおり)。
 */
export function useMyRens() {
  const [myRens, setMyRens] = useState<MyRen[]>([]);
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
      where('status', '==', 'active')
    );

    return onSnapshot(
      q,
      async (snap) => {
        const results = await Promise.all(
          snap.docs.map(async (memberDoc) => {
            const renId = memberDoc.ref.parent.parent?.id ?? '';
            const renSnap = await getDoc(doc(db, 'ren', renId));
            const renData = renSnap.exists() ? renSnap.data() : null;
            return {
              renId,
              name: renData?.name ?? renId,
              description: renData?.description ?? '',
              location: renData?.location ?? '',
              iconUrl: renData?.iconUrl ?? '',
              memberCount: renData?.memberCount ?? 0,
              role: memberDoc.data().role,
            } as MyRen;
          })
        );
        setMyRens(results);
        setLoading(false);
      },
      (error) => {
        console.error('所属している連の取得に失敗しました', error);
        setLoading(false);
      }
    );
  }, []);

  return { myRens, loading };
}

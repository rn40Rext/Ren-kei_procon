import { useEffect, useState } from 'react';
import { auth } from '../config/firebaseConfig';
import { subscribeMyMemberships } from '../repositories/ren';
import { RenMemberRole } from '../types/firestore';

// docs/design/data-model.md 3.8章
export interface MyRen {
  renId: string;
  name: string;
  description: string;
  location: string;
  iconUrl: string;
  memberCount: number;
  role: RenMemberRole;
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

    return subscribeMyMemberships(
      currentUser.uid,
      (memberships) => {
        setMyRens(
          memberships.map(({ renId, role, ren }) => ({
            renId,
            name: ren?.name ?? renId,
            description: ren?.description ?? '',
            location: ren?.location ?? '',
            iconUrl: ren?.iconUrl ?? '',
            memberCount: ren?.memberCount ?? 0,
            role,
          }))
        );
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

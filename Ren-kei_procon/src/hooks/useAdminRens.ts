import { useEffect, useState } from 'react';
import { auth } from '../config/firebaseConfig';
import { subscribeAdminMemberships } from '../repositories/ren';

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

    return subscribeAdminMemberships(
      currentUser.uid,
      (memberships) => {
        setAdminRens(memberships.map(({ renId, ren }) => ({ renId, name: ren?.name ?? renId })));
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

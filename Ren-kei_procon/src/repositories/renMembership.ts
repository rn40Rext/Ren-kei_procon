import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
  FirestoreError,
  Unsubscribe,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebaseConfig';
import { Ren, RenMember, RenMemberRole } from '../types/firestore';

/** メンバー(ren/{renId}/members/{uid})へのアクセスを集約する(docs/design/data-model.md 3.9章)。 */

export function subscribeActiveMembers(
  renId: string,
  onData: (members: RenMember[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(collection(db, 'ren', renId, 'members'), where('status', '==', 'active'));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as RenMember))),
    onError
  );
}

export async function fetchRenMember(renId: string, uid: string): Promise<RenMember | null> {
  const snap = await getDoc(doc(db, 'ren', renId, 'members', uid));
  return snap.exists() ? ({ uid: snap.id, ...snap.data() } as RenMember) : null;
}

/** FN(updateMemberRole)。最後の管理者を降格できない制約はRulesで表現できないため関数側で検証する(#33)。 */
export async function updateMemberRole(renId: string, uid: string, role: RenMemberRole): Promise<void> {
  const callable = httpsCallable(functions, 'updateMemberRole');
  await callable({ renId, uid, role });
}

/** FN(removeMember)。同上の理由でクライアントからの直接deleteはRulesで禁止している(#33)。 */
export async function removeMember(renId: string, uid: string): Promise<void> {
  const callable = httpsCallable(functions, 'removeMember');
  await callable({ renId, uid });
}

/**
 * 自分が所属する連(status:'active')を購読する。
 * membersはcollectionGroupクエリのため複合インデックスが必要。
 * 連名などの表示項目はren本体にしか無いので、ヒットしたメンバーごとに引き直す。
 */
export interface MemberOfRen {
  renId: string;
  role: RenMemberRole;
  ren: Ren | null;
}

function subscribeMembershipsOf(
  uid: string,
  extraConditions: ReturnType<typeof where>[],
  onData: (memberships: MemberOfRen[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(
    collectionGroup(db, 'members'),
    where('userId', '==', uid),
    ...extraConditions
  );
  return onSnapshot(
    q,
    async (snap) => {
      // onSnapshotはコールバックの返り値をawaitしないため、ここでrejectすると
      // onDataもonErrorも呼ばれないまま画面が読み込み中で止まる(#94)。
      // ren本体のgetDocが失敗した場合は自分でonErrorへ流す。
      try {
        const results = await Promise.all(
          snap.docs.map(async (memberDoc) => {
            const renId = memberDoc.ref.parent.parent?.id ?? '';
            const renSnap = await getDoc(doc(db, 'ren', renId));
            return {
              renId,
              role: memberDoc.data().role as RenMemberRole,
              ren: renSnap.exists() ? ({ id: renSnap.id, ...renSnap.data() } as Ren) : null,
            };
          })
        );
        onData(results);
      } catch (error) {
        // getDocの失敗はFirestoreError。onSnapshot自体の購読エラーと同じ経路に載せる
        onError(error as FirestoreError);
      }
    },
    onError
  );
}

/** 自分がactiveなメンバーとして所属する連(role不問。#28)。 */
export function subscribeMyMemberships(
  uid: string,
  onData: (memberships: MemberOfRen[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  return subscribeMembershipsOf(uid, [where('status', '==', 'active')], onData, onError);
}

/** 自分がrole:'admin'として所属する連(#29)。users.roleでは判定しない(仕様書10.3)。 */
export function subscribeAdminMemberships(
  uid: string,
  onData: (memberships: MemberOfRen[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  return subscribeMembershipsOf(
    uid,
    [where('role', '==', 'admin'), where('status', '==', 'active')],
    onData,
    onError
  );
}

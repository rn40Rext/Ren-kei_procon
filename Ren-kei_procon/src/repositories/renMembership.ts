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
 *
 * ren本体(名前・紹介・活動地域など)は連の管理者が随時更新するため、一度
 * getDocで引くだけでなく連ごとにonSnapshotで購読し続ける。そうしないと
 * membersの購読はmembersドキュメント自身の変化(参加・脱退・役割変更)にしか
 * 反応せず、ren本体だけを更新した場合に画面へ反映されない(連を作成後に
 * 基本情報を編集しても「マイ連」に反映されない不具合の原因だった)。
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

  let memberships: { renId: string; role: RenMemberRole }[] = [];
  const renUnsubs = new Map<string, Unsubscribe>();
  const renData = new Map<string, Ren | null>();

  const emit = () => {
    onData(
      memberships.map(({ renId, role }) => ({
        renId,
        role,
        ren: renData.get(renId) ?? null,
      }))
    );
  };

  const unsubMembers = onSnapshot(
    q,
    (snap) => {
      memberships = snap.docs.map((memberDoc) => ({
        renId: memberDoc.ref.parent.parent?.id ?? '',
        role: memberDoc.data().role as RenMemberRole,
      }));
      const renIds = new Set(memberships.map((m) => m.renId));

      // 所属しなくなった連の購読は解除する
      for (const [renId, unsub] of renUnsubs) {
        if (!renIds.has(renId)) {
          unsub();
          renUnsubs.delete(renId);
          renData.delete(renId);
        }
      }
      // 新たに所属した連だけ購読を追加する(既存の購読はそのまま維持)
      for (const renId of renIds) {
        if (renUnsubs.has(renId)) continue;
        renUnsubs.set(
          renId,
          onSnapshot(
            doc(db, 'ren', renId),
            (renSnap) => {
              renData.set(renId, renSnap.exists() ? ({ id: renSnap.id, ...renSnap.data() } as Ren) : null);
              emit();
            },
            (error) => onError(error as FirestoreError)
          )
        );
      }
      // 新規の連はonSnapshotが非同期にしか発火しないため、ここでemit()すると
      // ren本体データが未取得のまま(renId・0人など)で一瞬表示されてしまう。
      // 全ての連について既にデータを持っている(役割変更など、ren本体は
      // 変わっていないメンバー一覧の更新)場合のみ、ここでemit()する。
      if ([...renIds].every((renId) => renData.has(renId))) {
        emit();
      }
    },
    onError
  );

  return () => {
    unsubMembers();
    for (const unsub of renUnsubs.values()) unsub();
  };
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

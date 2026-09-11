import {
  collection,
  collectionGroup,
  doc,
  addDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  serverTimestamp,
  FirestoreError,
  Unsubscribe,
} from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, storage, functions } from '../config/firebaseConfig';
import {
  Announcement,
  Ren,
  RenActivity,
  RenMember,
  RenMemberRole,
} from '../types/firestore';

/** ren / members / activities / announcements へのアクセスを集約する(docs/design/data-model.md 3.8〜3.11章)。 */

// ---------- 連本体 ----------

export function subscribeRens(
  onData: (rens: Ren[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(collection(db, 'ren'), orderBy('name'));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Ren))),
    onError
  );
}

export function subscribeRen(
  renId: string,
  onData: (ren: Ren | null) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'ren', renId),
    (snap) => onData(snap.exists() ? ({ id: snap.id, ...snap.data() } as Ren) : null),
    onError
  );
}

export interface CreateRenInput {
  name: string;
  description: string;
  location: string;
  beginnerFriendly: boolean;
}

/**
 * FN(createRen)。連本体と作成者のmembers(role:'admin')を1トランザクションで
 * 作るため、クライアントからの直接createはRulesで禁止している(#26)。
 */
export async function createRen(input: CreateRenInput): Promise<string> {
  const callable = httpsCallable(functions, 'createRen');
  const result = await callable(input);
  return (result.data as { renId: string }).renId;
}

export interface RenInfoInput {
  name: string;
  description: string;
  location: string;
  beginnerFriendly: boolean;
  iconUrl: string;
}

/** 連の基本情報を更新する(Rulesで対象連の管理者のみ許可)。 */
export async function updateRenInfo(renId: string, input: RenInfoInput): Promise<void> {
  await updateDoc(doc(db, 'ren', renId), {
    ...input,
    updatedAt: serverTimestamp(),
  });
}

/**
 * 連アイコンを差し替え、確定後のURLを返す(#34)。
 * 本人のみ書き込める一時領域へ上げてからupdateRenIcon(Admin SDK)で本配置する。
 * Storage RulesのCross-Service Rulesが本番で不安定だったための構成。
 */
export async function updateRenIcon(renId: string, uid: string, blob: Blob): Promise<string> {
  const tempPath = `users/${uid}/renIconUploads/${renId}/${Date.now()}.jpg`;
  await uploadBytes(ref(storage, tempPath), blob);
  const callable = httpsCallable(functions, 'updateRenIcon');
  const result = await callable({ renId, tempPath });
  return (result.data as { iconUrl: string }).iconUrl;
}

// ---------- メンバー ----------

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

// ---------- 活動情報(R-08) ----------

export function subscribeRenActivities(
  renId: string,
  onData: (activities: RenActivity[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(collection(db, 'ren', renId, 'activities'), orderBy('startAt', 'asc'));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as RenActivity))),
    onError
  );
}

export interface RenActivityInput {
  title: string;
  description: string;
  startAt: Date;
  endAt: Date | null;
  location: string;
}

export async function createRenActivity(renId: string, input: RenActivityInput): Promise<void> {
  await addDoc(collection(db, 'ren', renId, 'activities'), input);
}

export async function updateRenActivity(
  renId: string,
  activityId: string,
  input: RenActivityInput
): Promise<void> {
  await updateDoc(doc(db, 'ren', renId, 'activities', activityId), { ...input });
}

export async function deleteRenActivity(renId: string, activityId: string): Promise<void> {
  await deleteDoc(doc(db, 'ren', renId, 'activities', activityId));
}

// ---------- お知らせ(R-07) ----------

export function subscribeAnnouncements(
  renId: string,
  onData: (announcements: Announcement[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(collection(db, 'ren', renId, 'announcements'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Announcement))),
    onError
  );
}

/** FN-06 createAnnouncement。通知生成(#43)を同時に行うためFunctions経由に一本化している。 */
export async function createAnnouncement(
  renId: string,
  input: { title: string; content: string }
): Promise<void> {
  const callable = httpsCallable(functions, 'createAnnouncement');
  await callable({ renId, ...input });
}

/**
 * 連へのお誘い（リクエスト機能）の実データ層。
 *
 * バックエンドに「連（ren）」自体がまだ無いため（docs/design/data-model.md 参照）、
 * 「連長クラスが未所属の踊り手を見つけて声を掛ける」流れを、ユーザー間の
 * お誘い（invitations）として実装する。承諾・辞退までを含めて実際に機能する。
 *
 * - 気になる踊り手：users コレクションを購読し、自分以外を表示する。
 * - お誘いの送信：invitations に作成（作成者本人のみ・status は 'pending' 固定）。
 * - 届いたお誘い：宛先本人のみ status を更新できる（承諾／辞退）。
 */
import { auth, db } from '../config/firebaseConfig';
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { myDisplayName } from '../repositories/users';

export type InvitationStatus = 'pending' | 'accepted' | 'declined';
export type DanceStyle = 'male' | 'female' | null;

export interface OtherDancer {
  id: string;
  name: string;
  icon: string;
  profile: string;
  danceStyle: DanceStyle;
}

export interface InvitationDoc {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  message: string;
  status: InvitationStatus;
  createdAtMs: number | null;
}

function toMs(v: any): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  return null;
}

function sortNewest<T extends { createdAtMs: number | null }>(list: T[]): T[] {
  return [...list].sort(
    (a, b) => (b.createdAtMs ?? Number.MAX_SAFE_INTEGER) - (a.createdAtMs ?? Number.MAX_SAFE_INTEGER),
  );
}

function mapDancer(id: string, d: any): OtherDancer {
  return {
    id,
    name: (d.nickname && String(d.nickname).trim()) || (d.name && String(d.name).trim()) || '踊り子',
    icon: d.icon || '',
    profile: d.profile || '',
    danceStyle: d.danceStyle === 'male' || d.danceStyle === 'female' ? d.danceStyle : null,
  };
}

function mapInvitation(id: string, d: any): InvitationDoc {
  return {
    id,
    fromUserId: d.fromUserId ?? '',
    fromUserName: d.fromUserName ?? '踊り子',
    toUserId: d.toUserId ?? '',
    toUserName: d.toUserName ?? '踊り子',
    message: d.message ?? '',
    status: d.status === 'accepted' || d.status === 'declined' ? d.status : 'pending',
    createdAtMs: toMs(d.createdAt),
  };
}

/** 自分以外の登録ユーザー（＝声を掛けられる相手）を購読する。 */
export function subscribeOtherDancers(
  cb: (list: OtherDancer[]) => void,
  onError?: (e: unknown) => void,
) {
  return onSnapshot(
    collection(db, 'users'),
    (s) => {
      const uid = auth.currentUser?.uid;
      cb(s.docs.filter((d) => d.id !== uid).map((d) => mapDancer(d.id, d.data())));
    },
    (e) => onError?.(e),
  );
}

/** お誘いを送る。 */
export async function sendInvitation(params: {
  toUserId: string;
  toUserName: string;
  message: string;
}): Promise<{ id: string }> {
  const user = auth.currentUser;
  if (!user) throw new Error('ログインが必要です');
  if (params.toUserId === user.uid) throw new Error('自分自身にはお誘いを送れません');

  const fromUserName = await myDisplayName();
  const ref = await addDoc(collection(db, 'invitations'), {
    fromUserId: user.uid,
    fromUserName,
    toUserId: params.toUserId,
    toUserName: params.toUserName,
    message: params.message.trim(),
    status: 'pending',
    createdAt: serverTimestamp(),
  });
  return { id: ref.id };
}

/** 自分が送ったお誘いを購読する。 */
export function subscribeSentInvitations(
  cb: (list: InvitationDoc[]) => void,
  onError?: (e: unknown) => void,
) {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    cb([]);
    return () => {};
  }
  const q = query(collection(db, 'invitations'), where('fromUserId', '==', uid));
  return onSnapshot(
    q,
    (s) => cb(sortNewest(s.docs.map((d) => mapInvitation(d.id, d.data())))),
    (e) => onError?.(e),
  );
}

/** 自分宛に届いたお誘いを購読する。 */
export function subscribeReceivedInvitations(
  cb: (list: InvitationDoc[]) => void,
  onError?: (e: unknown) => void,
) {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    cb([]);
    return () => {};
  }
  const q = query(collection(db, 'invitations'), where('toUserId', '==', uid));
  return onSnapshot(
    q,
    (s) => cb(sortNewest(s.docs.map((d) => mapInvitation(d.id, d.data())))),
    (e) => onError?.(e),
  );
}

/** 届いたお誘いに応答する（宛先本人のみ）。 */
export async function respondToInvitation(id: string, status: 'accepted' | 'declined') {
  const user = auth.currentUser;
  if (!user) throw new Error('ログインが必要です');
  await updateDoc(doc(db, 'invitations', id), { status, updatedAt: serverTimestamp() });
}

/** 送ったお誘い（返答待ちのみ）を取り消す。送信者本人のみ。 */
export async function cancelInvitation(id: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('ログインが必要です');
  await deleteDoc(doc(db, 'invitations', id));
}

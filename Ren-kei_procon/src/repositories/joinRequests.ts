import {
  collection,
  doc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  FirestoreError,
  Unsubscribe,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebaseConfig';
import { JoinRequest, JoinRequestStatus } from '../types/firestore';

/** joinRequests へのアクセスを集約する(docs/design/data-model.md 3.10章)。 */

/**
 * 自分の申請履歴(複合インデックス userId + createdAt)。
 * 特定の連への重複pending申請の有無は、この一覧をクライアント側で
 * フィルタして判定する(申請ごとにクエリを増やさない)。
 */
export function subscribeMyJoinRequests(
  uid: string,
  onData: (requests: JoinRequest[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(
    collection(db, 'joinRequests'),
    where('userId', '==', uid),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as JoinRequest))),
    onError
  );
}

/** 連宛ての申請をステータス別に購読する(複合インデックス renId + status + createdAt)。 */
export function subscribeRenJoinRequests(
  renId: string,
  status: JoinRequestStatus,
  onData: (requests: JoinRequest[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(
    collection(db, 'joinRequests'),
    where('renId', '==', renId),
    where('status', '==', status),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as JoinRequest))),
    onError
  );
}

/** R-01 管理ホームの未対応件数。件数しか使わないためドキュメントは展開しない。 */
export function subscribePendingJoinRequestCount(
  renId: string,
  onData: (count: number) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(
    collection(db, 'joinRequests'),
    where('renId', '==', renId),
    where('status', '==', 'pending')
  );
  return onSnapshot(q, (snap) => onData(snap.size), onError);
}

/**
 * FN-04 submitJoinRequest。重複pending申請と既存メンバーの再申請の検証は
 * 複数ドキュメントにまたがりRulesで表現できないため関数側で行う(#27)。
 */
export async function submitJoinRequest(renId: string, message: string): Promise<void> {
  const callable = httpsCallable(functions, 'submitJoinRequest');
  await callable({ renId, message });
}

/** 申請者本人による取り消し。pending→cancelledのみRulesで許可している。 */
export async function cancelJoinRequest(requestId: string): Promise<void> {
  await updateDoc(doc(db, 'joinRequests', requestId), { status: 'cancelled' });
}

/**
 * FN-05 updateJoinRequestStatus。承認時のmembers作成・通知作成と同一
 * トランザクションで行う必要があるため、Rulesでは直接updateを禁止している(#32)。
 */
export async function updateJoinRequestStatus(
  requestId: string,
  action: 'approve' | 'reject'
): Promise<void> {
  const callable = httpsCallable(functions, 'updateJoinRequestStatus');
  await callable({ requestId, action });
}

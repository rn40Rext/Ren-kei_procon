import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
  limit,
  FirestoreError,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { AppNotification } from '../types/firestore';

/**
 * users/{uid}/notifications へのアクセスを集約する(docs/design/data-model.md 3.13章)。
 * 通知の作成はサーバ側(Cloud Functions)のみ(#43)。ここではread/updateのみ扱う。
 */

const MAX_NOTIFICATIONS = 100;
const BATCH_WRITE_LIMIT = 500;

export function subscribeNotifications(
  uid: string,
  onData: (notifications: AppNotification[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(
    collection(db, 'users', uid, 'notifications'),
    orderBy('createdAt', 'desc'),
    limit(MAX_NOTIFICATIONS)
  );
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppNotification))),
    onError
  );
}

/** ホーム/BottomNavのバッジ用の未読件数。件数しか使わないためドキュメントは展開しない。 */
export function subscribeUnreadNotificationCount(
  uid: string,
  onData: (count: number) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(collection(db, 'users', uid, 'notifications'), where('read', '==', false));
  return onSnapshot(q, (snap) => onData(snap.size), onError);
}

/** 1件を既読にする。firestore.rulesはreadフィールドのみの更新を許可している。 */
export async function markNotificationRead(uid: string, notificationId: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid, 'notifications', notificationId), { read: true });
}

/**
 * 未読を一括既読にする。Firestoreのバッチ書き込み上限(500件)を超える場合に
 * 備えて分割する(functions/src/ren/createAnnouncement.tsと同じ方針)。
 */
export async function markAllNotificationsRead(uid: string, unreadIds: string[]): Promise<void> {
  for (let i = 0; i < unreadIds.length; i += BATCH_WRITE_LIMIT) {
    const chunk = unreadIds.slice(i, i + BATCH_WRITE_LIMIT);
    const batch = writeBatch(db);
    for (const id of chunk) {
      batch.update(doc(db, 'users', uid, 'notifications', id), { read: true });
    }
    await batch.commit();
  }
}

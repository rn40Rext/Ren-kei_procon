import {
  collection,
  onSnapshot,
  query,
  orderBy,
  FirestoreError,
  Unsubscribe,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebaseConfig';
import { Announcement } from '../types/firestore';

/** お知らせ(ren/{renId}/announcements、R-07)へのアクセスを集約する(docs/design/data-model.md 3.15章)。 */

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

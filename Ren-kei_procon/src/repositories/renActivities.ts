import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  FirestoreError,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { RenActivity } from '../types/firestore';

/** 活動情報(ren/{renId}/activities、R-08)へのアクセスを集約する(docs/design/data-model.md 3.15章)。 */

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

import {
  collection,
  doc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  FirestoreError,
  Unsubscribe,
} from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, storage, functions } from '../config/firebaseConfig';
import { Ren } from '../types/firestore';

/** 連本体(ren/{renId})へのアクセスを集約する(docs/design/data-model.md 3.8章)。 */

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

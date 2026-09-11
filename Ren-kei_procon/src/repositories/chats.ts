import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  FirestoreError,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { ChatMessage } from '../types/firestore';

/**
 * chats/{chatId}/messages へのアクセスを集約する。
 * 1対1チャットは仕様書に無いプロトタイプ限定機能(docs/status/gap-analysis.md 7章 N-1)。
 */

export function subscribeChatMessages(
  chatId: string,
  onData: (messages: ChatMessage[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChatMessage))),
    onError
  );
}

export async function sendChatMessage(chatId: string, senderId: string, text: string): Promise<void> {
  await addDoc(collection(db, 'chats', chatId, 'messages'), {
    text,
    senderId,
    createdAt: serverTimestamp(),
  });
}

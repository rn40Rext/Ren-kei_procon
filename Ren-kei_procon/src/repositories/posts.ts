import {
  collection,
  doc,
  addDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  where,
  limit,
  runTransaction,
  serverTimestamp,
  FirestoreError,
  Unsubscribe,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, storage, functions } from '../config/firebaseConfig';
import { CommentType, Post, PostComment } from '../types/firestore';

/** 交流広場(posts / comments / likes)へのアクセスを集約する(docs/design/data-model.md 3.3〜3.5章)。 */

export function subscribePosts(
  onData: (posts: Post[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post))),
    onError
  );
}

/** 特定ユーザーの投稿を新しい順に取得する(参加リクエストの申請者確認で使う。複合インデックス userId + createdAt)。 */
export async function fetchPostsByUser(userId: string, max: number): Promise<Post[]> {
  const snap = await getDocs(
    query(collection(db, 'posts'), where('userId', '==', userId), orderBy('createdAt', 'desc'), limit(max))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post));
}

/** 投稿に指導者コメント(type: 'instructor')が1件でも付いているか(R-02の「未アドバイス優先」並び替えで使う)。 */
export async function hasInstructorAdvice(postId: string): Promise<boolean> {
  const snap = await getDocs(
    query(collection(db, 'posts', postId, 'comments'), where('type', '==', 'instructor'), limit(1))
  );
  return !snap.empty;
}

export function subscribePostComments(
  postId: string,
  onData: (comments: PostComment[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(collection(db, 'posts', postId, 'comments'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PostComment))),
    onError
  );
}

/**
 * コメント(師匠の教え/応援)を投稿する。
 * commentCountはCloud Functionsトリガ(onCommentWrite)がcount()集計で更新するため触らない。
 */
export async function addPostComment(
  postId: string,
  input: { userId: string; userName: string; text: string; type: CommentType }
): Promise<void> {
  await addDoc(collection(db, 'posts', postId, 'comments'), {
    userId: input.userId,
    userName: input.userName,
    text: input.text,
    type: input.type,
    createdAt: serverTimestamp(),
  });
}

/**
 * 投稿に拍手する。
 * likesのドキュメントIDをuidにして1人1回を保証する(increment()は使わない。docs/rules/coding.md 4章)。
 * likeCountはトリガ(onLikeWrite)がcount()集計で更新する。
 */
export async function likePost(postId: string, uid: string): Promise<void> {
  const likeRef = doc(db, 'posts', postId, 'likes', uid);
  await runTransaction(db, async (transaction) => {
    const likeSnap = await transaction.get(likeRef);
    if (likeSnap.exists()) return; // 二重いいねを防ぐ
    transaction.set(likeRef, { userId: uid, createdAt: serverTimestamp() });
  });
}

/** 投稿動画をStorageへアップロードし、表示用URLを返す。 */
export async function uploadPostVideo(blob: Blob): Promise<string> {
  // TODO(#41): users/{uid}/videos/{videoId} へ移行する。現状は所有者情報を
  // パスに含まないため、Rulesで所有者を判定できない。
  const storageRef = ref(storage, `videos/${Date.now()}.mp4`);
  await uploadBytes(storageRef, blob);
  return getDownloadURL(storageRef);
}

export interface PublishPostInput {
  title: string;
  authorName: string;
  videoUrl: string;
  tags: string[];
}

/**
 * FN-03 publishPost。スコアとカウンタの初期化はクライアントで改ざんできないよう
 * Cloud Functions側で行う(#47。現状は縮小版で、videos.visibilityの更新は未実装)。
 */
export async function publishPost(input: PublishPostInput): Promise<void> {
  const callable = httpsCallable(functions, 'publishPost');
  await callable(input);
}

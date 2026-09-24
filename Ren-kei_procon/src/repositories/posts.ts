import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDoc,
  getDocs,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  limit,
  serverTimestamp,
  FirestoreError,
  Unsubscribe,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { auth, db, storage, functions } from '../config/firebaseConfig';
import { myDisplayName } from './users';
import { CommentType, Post, PostComment } from '../types/firestore';

/** 交流広場(posts / comments / likes)へのアクセスを集約する(docs/design/data-model.md 3.3〜3.5章)。 */

const POSTS_CACHE_KEY = 'renkei.posts.v1';
const COMMENTS_CACHE_KEY = (postId: string) => `renkei.comments.${postId}.v1`;

export const POST_TAG_OPTIONS = [
  '#男踊り',
  '#女踊り',
  '#初心者歓迎',
  '#足の運び',
  '#鳥追い笠',
  '#腰落とし',
  '#2拍子',
  '#ちびっこ踊り',
] as const;

function sortNewest<T extends { createdAt?: { toMillis?: () => number } | null }>(list: T[]): T[] {
  const ms = (v: T) => v.createdAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
  return [...list].sort((a, b) => ms(b) - ms(a));
}

/** 端末に保存済みの投稿一覧(前回セッションのぶん)。Firestore応答前の即時表示・オフライン用。 */
export async function loadCachedPosts(): Promise<Post[]> {
  try {
    const raw = await AsyncStorage.getItem(POSTS_CACHE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/**
 * orderByをクエリに付けると、createdAtがまだ確定していない投稿(直後の書き込みで
 * serverTimestamp()がサーバ確定前)が一覧から丸ごと落ちるため、取得はコレクション
 * そのまま・並べ替えはクライアント側で行う(新着順、未確定は先頭に置く)。
 */
export function subscribePosts(
  onData: (posts: Post[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'posts'),
    (snap) => {
      const list = sortNewest(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post)));
      onData(list);
      AsyncStorage.setItem(POSTS_CACHE_KEY, JSON.stringify(list.slice(0, 30))).catch(() => {});
    },
    onError
  );
}

/** 通知(type:'comment')タップ時、投稿詳細へ直接遷移するために1件だけ取得する。 */
export async function fetchPost(postId: string): Promise<Post | null> {
  const snap = await getDoc(doc(db, 'posts', postId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Post) : null;
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

/** 端末に保存済みのコメント(前回セッション分)。Firestore応答前の即時表示・オフライン用。 */
export async function loadCachedComments(postId: string): Promise<PostComment[]> {
  try {
    const raw = await AsyncStorage.getItem(COMMENTS_CACHE_KEY(postId));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function subscribeComments(
  postId: string,
  onData: (comments: PostComment[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'posts', postId, 'comments'),
    (snap) => {
      const list = sortNewest(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PostComment)));
      onData(list);
      AsyncStorage.setItem(COMMENTS_CACHE_KEY(postId), JSON.stringify(list.slice(0, 50))).catch(() => {});
    },
    onError
  );
}

/**
 * コメント(師匠の教え/応援)を投稿する。userId/userNameはログイン中ユーザーから解決する。
 * type:'instructor'の場合はrenIdが必須(「どの連の管理者としての発言か」の記録。
 * firestore.rulesがrenIdに対するisRenAdmin()を検証するため、管理者でなければ拒否される。#31)。
 * commentCountはCloud Functionsトリガ(onCommentWrite)がcount()集計で更新するため触らない。
 */
export async function addComment(
  postId: string,
  input: { text: string; type: CommentType; renId?: string }
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('ログインが必要です');
  const userName = await myDisplayName();

  await addDoc(collection(db, 'posts', postId, 'comments'), {
    userId: user.uid,
    userName,
    text: input.text.trim(),
    type: input.type,
    ...(input.renId ? { renId: input.renId } : {}),
    createdAt: serverTimestamp(),
  });
}

/** 自分がこの投稿にいいね済みか。 */
export async function isLiked(postId: string): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;
  const snap = await getDoc(doc(db, 'posts', postId, 'likes', user.uid));
  return snap.exists();
}

/**
 * いいねを切り替える(いいね⇔取り消し)。
 * likesのドキュメントIDをuidにして1人1回を保証する(increment()は使わない。docs/rules/coding.md 4章)。
 * likeCountはトリガ(onLikeWrite)がcount()集計で更新するため、ここではlikesドキュメントの作成/削除のみ行う。
 */
export async function toggleLike(postId: string, currentlyLiked: boolean): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) throw new Error('ログインが必要です');
  const likeRef = doc(db, 'posts', postId, 'likes', user.uid);

  if (currentlyLiked) {
    await deleteDoc(likeRef);
    return false;
  }
  await setDoc(likeRef, { userId: user.uid, createdAt: serverTimestamp() });
  return true;
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
  description?: string;
  tags: string[];
  /** 練習動画(videos)から投稿するとき。サーバがAI採点の結果を投稿に載せる */
  videoId?: string;
}

/**
 * FN-03 publishPost。スコアとカウンタの初期化はクライアントで改ざんできないよう
 * Cloud Functions側で行う(#47。現状は縮小版で、videos.visibilityの更新は未実装)。
 */
export async function publishPost(input: PublishPostInput): Promise<{ postId: string }> {
  const callable = httpsCallable<PublishPostInput, { postId: string }>(functions, 'publishPost');
  const result = await callable(input);
  return result.data;
}

/**
 * 端末上の動画ファイルをアップロードしてそのまま投稿する(録画直後の投稿フォーム用)。
 * authorNameはログイン中ユーザーから解決する。
 */
export async function uploadVideoAndPublish(params: {
  uri: string;
  title: string;
  description?: string;
  tags?: string[];
  videoId?: string;
}): Promise<{ postId: string }> {
  const user = auth.currentUser;
  if (!user) throw new Error('ログインが必要です');

  const res = await fetch(params.uri);
  const blob = await res.blob();
  const videoUrl = await uploadPostVideo(blob);

  const authorName = await myDisplayName();
  return publishPost({
    title: params.title.trim(),
    description: params.description?.trim() || undefined,
    tags: params.tags ?? [],
    videoUrl,
    authorName,
    videoId: params.videoId,
  });
}

/**
 * すでにStorageにある動画(自主稽古で撮った動画・練習動画など)を再アップロードせず
 * そのまま投稿する(解析結果画面の「投稿する」用)。
 */
export async function publishExistingVideo(params: {
  videoUrl: string;
  title: string;
  description?: string;
  tags?: string[];
  videoId?: string;
}): Promise<{ postId: string }> {
  const user = auth.currentUser;
  if (!user) throw new Error('ログインが必要です');

  const authorName = await myDisplayName();
  return publishPost({
    title: params.title.trim(),
    description: params.description?.trim() || undefined,
    tags: params.tags ?? [],
    videoUrl: params.videoUrl,
    authorName,
    videoId: params.videoId,
  });
}

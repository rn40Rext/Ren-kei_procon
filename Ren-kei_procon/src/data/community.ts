/**
 * 交流広場（posts）の実データ層。GitHub 最新のバックエンドに合わせる。
 *
 * - 投稿の作成は Cloud Function `publishPost` 経由のみ（posts への直接 create は
 *   firestore.rules で禁止）。クライアントは動画を Storage に上げて videoUrl を渡す。
 * - コメントは posts/{postId}/comments に直接 create（userId==自分・type 制限あり）。
 * - いいねは posts/{postId}/likes/{uid} をドキュメント ID = uid で作成し二重防止。
 *   likeCount / commentCount は当面クライアントが increment で更新する
 *   （rules が hasOnly(['likeCount','commentCount']) を許可。将来は Functions で同期）。
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db, storage, functions } from '../config/firebaseConfig';
import {
  collection,
  addDoc,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';

const POSTS_CACHE_KEY = 'renkei.posts.v1';
const COMMENTS_CACHE_KEY = (postId: string) => `renkei.comments.${postId}.v1`;

/** publishPost（functions/src/community/publishPost.ts）の許可タグと一致させる */
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

/** Firestore Timestamp / 数値 / null をミリ秒に正規化（キャッシュを JSON 化できるように） */
function toMs(v: any): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  return null;
}

export interface PostDoc {
  id: string;
  userId: string;
  authorName: string;
  title: string;
  description: string;
  tags: string[];
  videoUrl: string;
  score: number;
  likeCount: number;
  commentCount: number;
  createdAtMs: number | null;
}

export type CommentType = 'normal' | 'instructor';

export interface CommentDoc {
  id: string;
  userId: string;
  userName: string;
  type: CommentType;
  text: string;
  createdAtMs: number | null;
}

function mapPost(id: string, d: any): PostDoc {
  return {
    id,
    userId: d.userId ?? '',
    authorName: d.authorName ?? '踊り子',
    title: d.title ?? '',
    description: d.description ?? '',
    tags: Array.isArray(d.tags) ? d.tags : [],
    videoUrl: d.videoUrl ?? '',
    score: typeof d.score === 'number' ? d.score : typeof d.totalScore === 'number' ? d.totalScore : 0,
    likeCount: d.likeCount ?? 0,
    commentCount: d.commentCount ?? 0,
    createdAtMs: toMs(d.createdAt),
  };
}

/** ログイン中ユーザーの表示名（users/{uid} を優先、無ければメール先頭） */
export async function myDisplayName(): Promise<string> {
  const user = auth.currentUser;
  if (!user) return '踊り子';
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (snap.exists()) {
      const u = snap.data();
      return (u.nickname && String(u.nickname).trim()) || (u.name && String(u.name).trim()) || user.email?.split('@')[0] || '踊り子';
    }
  } catch {
    /* ignore */
  }
  return user.email?.split('@')[0] || '踊り子';
}

/* ------------------------------------------------------------------ */
/* フィード（一覧）                                                     */
/* ------------------------------------------------------------------ */
function sortNewest<T extends { createdAtMs: number | null }>(list: T[]): T[] {
  // createdAt 未確定（サーバー確定待ち）の投稿は先頭に置く
  return [...list].sort(
    (a, b) => (b.createdAtMs ?? Number.MAX_SAFE_INTEGER) - (a.createdAtMs ?? Number.MAX_SAFE_INTEGER),
  );
}

/** 端末に保存済みの投稿一覧（前回セッションのぶん）。Firestore 応答前の即時表示・オフライン用。 */
export async function loadCachedPosts(): Promise<PostDoc[]> {
  try {
    const raw = await AsyncStorage.getItem(POSTS_CACHE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? sortNewest(arr as PostDoc[]) : [];
  } catch {
    return [];
  }
}

export function subscribePosts(
  cb: (posts: PostDoc[]) => void,
  onError?: (e: unknown) => void,
) {
  // orderBy を付けると createdAt を持たない投稿が一覧から丸ごと落ちるため、
  // 取得はコレクションそのまま・並べ替えはクライアント側で行う（新着順）。
  return onSnapshot(
    collection(db, 'posts'),
    (s) => {
      const list = sortNewest(s.docs.map((docu) => mapPost(docu.id, docu.data())));
      cb(list);
      // 次回起動時にすぐ出せるよう端末へ保存（先頭30件）
      AsyncStorage.setItem(POSTS_CACHE_KEY, JSON.stringify(list.slice(0, 30))).catch(() => {});
    },
    (e) => onError?.(e),
  );
}

/* ------------------------------------------------------------------ */
/* 投稿（動画アップロード → publishPost）                                */
/* ------------------------------------------------------------------ */
export async function uploadVideoAndPublish(params: {
  uri: string;
  title: string;
  description?: string;
  tags?: string[];
}): Promise<{ postId: string }> {
  const user = auth.currentUser;
  if (!user) throw new Error('ログインが必要です');

  // 1. 動画を Storage へ
  const res = await fetch(params.uri);
  const blob = await res.blob();
  const path = `videos/${user.uid}/${Date.now()}.mp4`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob);
  const videoUrl = await getDownloadURL(storageRef);

  // 2. publishPost（posts への create は Function 経由のみ）
  const authorName = await myDisplayName();
  const call = httpsCallable<
    { title: string; description?: string; tags?: string[]; videoUrl: string; authorName: string },
    { postId: string }
  >(functions, 'publishPost');

  const out = await call({
    title: params.title.trim(),
    description: params.description?.trim() || undefined,
    tags: params.tags && params.tags.length ? params.tags : undefined,
    videoUrl,
    authorName,
  });
  return { postId: out.data.postId };
}

/**
 * すでに Storage にある動画（自主稽古で撮った videos ドキュメントなど）を
 * 再アップロードせずそのまま交流広場へ投稿する（解析結果画面の「投稿する」用）。
 */
export async function publishExistingVideo(params: {
  videoUrl: string;
  title: string;
  description?: string;
  tags?: string[];
}): Promise<{ postId: string }> {
  const user = auth.currentUser;
  if (!user) throw new Error('ログインが必要です');

  const authorName = await myDisplayName();
  const call = httpsCallable<
    { title: string; description?: string; tags?: string[]; videoUrl: string; authorName: string },
    { postId: string }
  >(functions, 'publishPost');

  const out = await call({
    title: params.title.trim(),
    description: params.description?.trim() || undefined,
    tags: params.tags && params.tags.length ? params.tags : undefined,
    videoUrl: params.videoUrl,
    authorName,
  });
  return { postId: out.data.postId };
}

/* ------------------------------------------------------------------ */
/* 1 件取得 / コメント                                                  */
/* ------------------------------------------------------------------ */
export async function fetchPost(postId: string): Promise<PostDoc | null> {
  const snap = await getDoc(doc(db, 'posts', postId));
  return snap.exists() ? mapPost(snap.id, snap.data()) : null;
}

function mapComment(id: string, d: any): CommentDoc {
  // 旧実装の 'advice'/'comment' も読み替える
  const rawType = d.type;
  const type: CommentType = rawType === 'instructor' || rawType === 'advice' ? 'instructor' : 'normal';
  return {
    id,
    userId: d.userId ?? '',
    userName: d.userName ?? d.authorName ?? '匿名',
    type,
    text: d.text ?? '',
    createdAtMs: toMs(d.createdAt),
  };
}

/** 端末に保存済みのコメント（前回セッション分）。Firestore 応答前の即時表示・オフライン用。 */
export async function loadCachedComments(postId: string): Promise<CommentDoc[]> {
  try {
    const raw = await AsyncStorage.getItem(COMMENTS_CACHE_KEY(postId));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? (arr as CommentDoc[]) : [];
  } catch {
    return [];
  }
}

export function subscribeComments(postId: string, cb: (c: CommentDoc[]) => void) {
  // orderBy を外し、並べ替えはクライアント側（新着順）。createdAt 未確定の投稿直後も落とさない。
  return onSnapshot(collection(db, 'posts', postId, 'comments'), (s) => {
    const list = s.docs.map((docu) => mapComment(docu.id, docu.data()));
    list.sort((a, b) => (b.createdAtMs ?? Number.MAX_SAFE_INTEGER) - (a.createdAtMs ?? Number.MAX_SAFE_INTEGER));
    cb(list);
    AsyncStorage.setItem(COMMENTS_CACHE_KEY(postId), JSON.stringify(list.slice(0, 50))).catch(() => {});
  });
}

export async function addComment(
  postId: string,
  input: { text: string; type: CommentType },
) {
  const user = auth.currentUser;
  if (!user) throw new Error('ログインが必要です');
  const userName = await myDisplayName();

  await addDoc(collection(db, 'posts', postId, 'comments'), {
    userId: user.uid,
    userName,
    type: input.type,
    text: input.text.trim(),
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'posts', postId), { commentCount: increment(1) });
}

/* ------------------------------------------------------------------ */
/* いいね（likes/{uid}）                                                */
/* ------------------------------------------------------------------ */
export async function isLiked(postId: string): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;
  const snap = await getDoc(doc(db, 'posts', postId, 'likes', user.uid));
  return snap.exists();
}

export async function toggleLike(postId: string, currentlyLiked: boolean): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) throw new Error('ログインが必要です');
  const likeRef = doc(db, 'posts', postId, 'likes', user.uid);

  if (currentlyLiked) {
    await deleteDoc(likeRef);
    await updateDoc(doc(db, 'posts', postId), { likeCount: increment(-1) });
    return false;
  }
  await setDoc(likeRef, { userId: user.uid, createdAt: serverTimestamp() });
  await updateDoc(doc(db, 'posts', postId), { likeCount: increment(1) });
  return true;
}

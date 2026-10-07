import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  FirestoreError,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Unsubscribe,
  where,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, db, storage } from '../config/firebaseConfig';
import { myDisplayName } from './users';
import {
  ChallengeAdviceItem,
  ChallengeCategory,
  ChallengeDifficulty,
  ChallengeDoc,
} from '../types/firestore';

/**
 * 師匠からのチャレンジ(challenges/{challengeId})へのアクセスを集約する
 * (docs/design/challenges.md)。作成・削除は連の管理者のみ(firestore.rulesで保護)。
 */

/** 踊りの種類の表示名(保存値は英小文字。firestore.rulesの許可値と合わせる) */
export const CHALLENGE_CATEGORY_LABEL: Record<ChallengeCategory, '男踊り' | '女踊り' | '鳴り物'> = {
  male: '男踊り',
  female: '女踊り',
  narimono: '鳴り物',
};

/** 難易度の表示名 */
export const CHALLENGE_DIFFICULTY_LABEL: Record<ChallengeDifficulty, '初級' | '中級' | '上級'> = {
  beginner: '初級',
  intermediate: '中級',
  advanced: '上級',
};

/** コツの最大件数(firestore.rulesの上限と合わせる) */
export const CHALLENGE_ADVICE_MAX = 5;

/** ホームに並べる件数の上限 */
const HOME_LIMIT = 30;

/** createdAtの新しい順に並べる。未確定(サーバ確定前)のものは先頭に置く */
function sortNewest(list: ChallengeDoc[]): ChallengeDoc[] {
  const ms = (c: ChallengeDoc) => c.createdAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
  return [...list].sort((a, b) => ms(b) - ms(a));
}

/** 全連のチャレンジを新しい順にリアルタイム購読する(ホーム画面用) */
export function subscribeChallenges(
  onData: (challenges: ChallengeDoc[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(collection(db, 'challenges'), orderBy('createdAt', 'desc'), limit(HOME_LIMIT));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChallengeDoc))),
    onError
  );
}

/**
 * 1つの連が出したチャレンジを新しい順にリアルタイム購読する(管理画面用)。
 * renId + createdAt の複合インデックスを増やさないよう、並べ替えは手元で行う。
 */
export function subscribeRenChallenges(
  renId: string,
  onData: (challenges: ChallengeDoc[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(collection(db, 'challenges'), where('renId', '==', renId));
  return onSnapshot(
    q,
    (snap) => onData(sortNewest(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChallengeDoc)))),
    onError
  );
}

/** チャレンジ1件をリアルタイム購読する(詳細画面用)。見つからなければnull */
export function subscribeChallenge(
  challengeId: string,
  onData: (challenge: ChallengeDoc | null) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'challenges', challengeId),
    (snap) => onData(snap.exists() ? ({ id: snap.id, ...snap.data() } as ChallengeDoc) : null),
    onError
  );
}

/** 出題フォームで入力する項目 */
export interface ChallengeInput {
  renId: string;
  renName: string;
  posterRole: string;
  title: string;
  move: string;
  category: ChallengeCategory;
  difficulty: ChallengeDifficulty;
  focus: string;
  advice: ChallengeAdviceItem[];
  /** 端末上のお手本動画(必須)。Storageへ上げてから作成する */
  videoUri: string;
}

/** お手本動画をStorageへアップロードし、表示用URLと保存場所を返す(storage.rulesで本人のみ書き込み可) */
async function uploadChallengeVideo(uid: string, uri: string): Promise<{ videoUrl: string; videoPath: string }> {
  const res = await fetch(uri);
  const blob = await res.blob();
  const ext = blob.type.includes('webm') ? 'webm' : blob.type.includes('quicktime') ? 'mov' : 'mp4';
  const videoPath = `users/${uid}/challengeVideos/${Date.now()}.${ext}`;
  const videoRef = ref(storage, videoPath);
  await uploadBytes(videoRef, blob, blob.type ? { contentType: blob.type } : undefined);
  return { videoUrl: await getDownloadURL(videoRef), videoPath };
}

/** チャレンジを出題する。お手本動画(必須)を先にアップロードする */
export async function createChallenge(input: ChallengeInput): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('ログインが必要です');

  if (!input.videoUri) throw new Error('お手本動画を選んでください');
  const video = await uploadChallengeVideo(user.uid, input.videoUri);
  const posterName = await myDisplayName();
  const created = await addDoc(collection(db, 'challenges'), {
    renId: input.renId,
    renName: input.renName,
    createdBy: user.uid,
    posterName,
    posterRole: input.posterRole.trim(),
    title: input.title.trim(),
    move: input.move.trim(),
    category: input.category,
    difficulty: input.difficulty,
    focus: input.focus.trim(),
    advice: input.advice.map((a) => ({ point: a.point.trim(), detail: a.detail.trim() })),
    ...video,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return created.id;
}

/**
 * チャレンジを削除する。お手本動画はアップロードした本人しか消せないため、
 * 別の管理者が削除した場合や失敗した場合は動画を残す(表示されなくなるだけ)。
 */
export async function deleteChallenge(challenge: ChallengeDoc): Promise<void> {
  await deleteDoc(doc(db, 'challenges', challenge.id));
  if (challenge.videoPath && challenge.createdBy === auth.currentUser?.uid) {
    await deleteObject(ref(storage, challenge.videoPath)).catch((e) =>
      console.warn('お手本動画の削除に失敗しました', e)
    );
  }
}

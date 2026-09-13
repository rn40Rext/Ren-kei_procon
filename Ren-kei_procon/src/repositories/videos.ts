/**
 * 練習動画(videos)と Storage へのアクセスを集約する(docs/design/data-model.md 3.2 / 5章)。
 *
 * パスは所有者判定ができる users/{uid}/videos/{videoId}(#41)。
 * 動画本体(.webm / .mp4)と姿勢系列(.pose.json)を同じ場所に置く。
 */
import { addDoc, collection, doc, getDoc, onSnapshot, serverTimestamp, updateDoc, Unsubscribe } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes, uploadString } from 'firebase/storage';
import { db, storage } from '../config/firebaseConfig';
import { PoseSeries } from '../features/pose/types';
import { DanceType } from '../features/rules/types';
import { ScorePart } from '../features/rules/session';

export type AnalysisStatus = 'uploaded' | 'analyzing' | 'completed' | 'failed';

export interface PracticeVideo {
  id: string;
  userId: string;
  visibility: 'private' | 'public';
  analysisStatus: AnalysisStatus;
  latestAnalysisId?: string;
  storagePath?: string;
  poseSeriesPath?: string;
  durationMs?: number;
  danceType?: DanceType;
  scorePart?: ScorePart;
}

/**
 * 練習セッション用の videos ドキュメントを作る。
 * Rules の制約で visibility='private' / analysisStatus='uploaded' 固定。
 */
export async function createPracticeVideo(input: {
  uid: string;
  danceType: DanceType;
  scorePart: ScorePart;
}): Promise<string> {
  const refDoc = await addDoc(collection(db, 'videos'), {
    userId: input.uid,
    visibility: 'private',
    analysisStatus: 'uploaded',
    danceType: input.danceType,
    scorePart: input.scorePart,
    createdAt: serverTimestamp(),
  });
  return refDoc.id;
}

/** 動画本体を Storage へ上げ、videos.storagePath を更新する。 */
export async function uploadPracticeVideo(uid: string, videoId: string, blob: Blob, contentType: string): Promise<string> {
  const ext = contentType.includes('mp4') ? 'mp4' : 'webm';
  const path = `users/${uid}/videos/${videoId}.${ext}`;
  await uploadBytes(ref(storage, path), blob, { contentType });
  await updateDoc(doc(db, 'videos', videoId), { storagePath: path });
  return path;
}

/**
 * 姿勢系列 JSON を Storage へ上げ、videos.poseSeriesPath を更新する。
 * AI②(FN-02)がこのパスから Embedding を作る。
 */
export async function uploadPoseSeries(uid: string, videoId: string, series: PoseSeries, durationMs: number): Promise<string> {
  const path = `users/${uid}/videos/${videoId}.pose.json`;
  await uploadString(ref(storage, path), JSON.stringify(series), 'raw', { contentType: 'application/json' });
  await updateDoc(doc(db, 'videos', videoId), { poseSeriesPath: path, durationMs });
  return path;
}

export async function fetchVideo(videoId: string): Promise<PracticeVideo | null> {
  const snap = await getDoc(doc(db, 'videos', videoId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as PracticeVideo) : null;
}

export function subscribeVideo(
  videoId: string,
  onData: (video: PracticeVideo | null) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'videos', videoId),
    (snap) => onData(snap.exists() ? ({ id: snap.id, ...snap.data() } as PracticeVideo) : null),
    (e) => onError?.(e)
  );
}

/** 表示用の URL を取る(投稿時などに使う)。 */
export async function videoDownloadUrl(storagePath: string): Promise<string> {
  return getDownloadURL(ref(storage, storagePath));
}

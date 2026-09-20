/**
 * 自主稽古の動画（videos コレクション）の実データ層。
 * GitHub 最新バックエンド（PR #74: videos.visibility / analysisStatus）に合わせる。
 *
 * - 練習動画は既定で非公開（visibility='private'）。所有者のみ読み書き可能。
 * - 作成時は firestore.rules により visibility='private' / analysisStatus='uploaded' 固定。
 * - AI 解析（採点）そのものはバックエンド未実装。ここでは「解析待ち」の箱として
 *   動画を安全に保存するところまでを担う。解析結果 analysisResults は未対応。
 */
import { auth, db, storage } from '../config/firebaseConfig';
import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export type DanceType = 'male' | 'female';
export type ScorePart = 'feet' | 'hands' | 'whole';
export type AnalysisStatus = 'uploaded' | 'analyzing' | 'completed' | 'failed';

export const ANALYSIS_STATUS_LABEL: Record<AnalysisStatus, string> = {
  uploaded: '解析待ち',
  analyzing: '解析中',
  completed: '解析済み',
  failed: '解析に失敗',
};

export const DANCE_TYPE_LABEL: Record<DanceType, string> = {
  male: '男踊り',
  female: '女踊り',
};

export const SCORE_PART_LABEL: Record<ScorePart, string> = {
  feet: '足捌き',
  hands: '手・団扇',
  whole: '全体の調和',
};

export interface VideoDoc {
  id: string;
  userId: string;
  storagePath: string;
  downloadUrl: string;
  durationMs: number | null;
  danceType: DanceType | null;
  scorePart: ScorePart | null;
  visibility: 'private' | 'public';
  analysisStatus: AnalysisStatus;
  latestAnalysisId: string | null;
  createdAt: Timestamp | null;
}

function mapVideo(id: string, d: any): VideoDoc {
  return {
    id,
    userId: d.userId ?? '',
    storagePath: d.storagePath ?? '',
    downloadUrl: d.downloadUrl ?? '',
    durationMs: typeof d.durationMs === 'number' ? d.durationMs : null,
    danceType: d.danceType ?? null,
    scorePart: d.scorePart ?? null,
    visibility: d.visibility === 'public' ? 'public' : 'private',
    analysisStatus: (['uploaded', 'analyzing', 'completed', 'failed'] as const).includes(d.analysisStatus)
      ? d.analysisStatus
      : 'uploaded',
    latestAnalysisId: d.latestAnalysisId ?? null,
    createdAt: d.createdAt ?? null,
  };
}

/**
 * 撮影した演舞を Storage へアップロードし、videos ドキュメントを作成する。
 * 保存先は data-model.md の規約どおり users/{uid}/videos/{videoId}.mp4。
 */
export async function uploadPracticeVideo(params: {
  uri: string;
  danceType?: DanceType | null;
  scorePart?: ScorePart | null;
  durationMs?: number | null;
}): Promise<{ videoId: string }> {
  const user = auth.currentUser;
  if (!user) throw new Error('ログインが必要です');

  // 先に ID を採番して Storage パスと突き合わせる
  const videoRef = doc(collection(db, 'videos'));
  const videoId = videoRef.id;
  const storagePath = `users/${user.uid}/videos/${videoId}.mp4`;

  const res = await fetch(params.uri);
  const blob = await res.blob();
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, blob);
  const downloadUrl = await getDownloadURL(storageRef);

  await setDoc(videoRef, {
    userId: user.uid,
    storagePath,
    downloadUrl,
    durationMs: params.durationMs ?? null,
    danceType: params.danceType ?? null,
    scorePart: params.scorePart ?? null,
    // rules で create 時は下記 2 つが固定値であることを要求される
    visibility: 'private',
    analysisStatus: 'uploaded',
    createdAt: serverTimestamp(),
  });

  return { videoId };
}

/** ログイン中ユーザーの練習動画を新しい順で購読（複合インデックス不要のためクライアント側で整列） */
export function subscribeMyVideos(
  cb: (videos: VideoDoc[]) => void,
  onError?: (e: unknown) => void,
) {
  const user = auth.currentUser;
  if (!user) {
    cb([]);
    return () => {};
  }
  const q = query(collection(db, 'videos'), where('userId', '==', user.uid));
  return onSnapshot(
    q,
    (s) => {
      const list = s.docs.map((docu) => mapVideo(docu.id, docu.data()));
      list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
      cb(list);
    },
    (e) => onError?.(e),
  );
}

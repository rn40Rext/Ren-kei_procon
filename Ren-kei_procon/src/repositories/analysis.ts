/**
 * 基本動作の解析結果(FN-01 finalizeBasicAnalysis / analysisResults)へのアクセス。
 *
 * スコアの確定はサーバで行う(仕様書 10.3 / 3.2)。クライアントは集計値を送り、
 * 返ってきた totalScore / 項目別スコア / feedback を表示するだけ。
 * docs/design/api-functions.md FN-01。
 */
import { doc, getDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebaseConfig';
import { FinalizeRequest } from '../features/rules/session';
import { FirestoreDate } from '../types/firestore';

export type FeedbackItem = { type: 'good' | 'improve'; ruleId: string; message: string };

export type ItemScores = {
  handHeightScore?: number;
  hipHeightScore?: number;
  stopScore?: number;
  rhythmScore?: number;
  handPositionScore?: number;
  basePostureScore?: number;
};

export type FinalizeResponse = {
  analysisId: string;
  totalScore: number;
  scores: ItemScores;
  feedback: FeedbackItem[];
  analysisVersion: string;
};

/** analysisResults/{analysisId}(docs/design/data-model.md 3.6章) */
export interface AnalysisResult extends ItemScores {
  id: string;
  videoId: string;
  userId: string;
  totalScore: number;
  gameScore: number;
  greatCount: number;
  goodCount: number;
  missCount: number;
  maxCombo?: number;
  feedback: FeedbackItem[];
  analysisVersion: string;
  rawMetrics?: Record<string, unknown>;
  createdAt?: FirestoreDate;
}

/** FN-01 を呼んでスコアを確定する。 */
export async function finalizeBasicAnalysis(request: FinalizeRequest): Promise<FinalizeResponse> {
  const callable = httpsCallable<FinalizeRequest, FinalizeResponse>(functions, 'finalizeBasicAnalysis');
  const res = await callable(request);
  return res.data;
}

export async function fetchAnalysisResult(analysisId: string): Promise<AnalysisResult | null> {
  const snap = await getDoc(doc(db, 'analysisResults', analysisId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as AnalysisResult) : null;
}

export function subscribeAnalysisResult(
  analysisId: string,
  onData: (result: AnalysisResult | null) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'analysisResults', analysisId),
    (snap) => onData(snap.exists() ? ({ id: snap.id, ...snap.data() } as AnalysisResult) : null),
    (e) => onError?.(e)
  );
}

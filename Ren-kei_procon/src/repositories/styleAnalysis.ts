/**
 * スタイル診断（FN-02）へのアクセスを集約する。
 *
 * 画面から firebase/firestore を直接呼ばない（docs/rules/coding.md）。
 */
import {
  doc,
  onSnapshot,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import app, { db } from "../config/firebaseConfig";
import type {
  AnalyzeStyleResponse,
  StyleAnalysisResult,
  StyleAnalysisStatus,
  StyleSimilarityItem,
} from "../types/style";

const COLLECTION = "styleAnalysisResults";

/** Firestore のドキュメントをアプリ側の型へ変換する */
function toResult(id: string, data: Record<string, unknown>): StyleAnalysisResult {
  const rawResults = Array.isArray(data.results) ? data.results : [];
  const results: StyleSimilarityItem[] = rawResults.map((r) => {
    const item = r as Record<string, unknown>;
    return {
      renId: String(item.renId ?? ""),
      renName: String(item.renName ?? ""),
      similarity: Number(item.similarity ?? 0),
      sampleCount: Number(item.sampleCount ?? 0),
    };
  });
  return {
    styleAnalysisId: id,
    userId: String(data.userId ?? ""),
    videoId: String(data.videoId ?? ""),
    modelVersion: String(data.modelVersion ?? ""),
    status: (data.status as StyleAnalysisStatus) ?? "processing",
    results,
    errorCode: data.errorCode == null ? null : String(data.errorCode),
  };
}

/**
 * FN-02 analyzeStyle を呼ぶ。
 *
 * 推論が重い場合はサーバ側が非同期で処理するため、呼び出し側は
 * 戻り値だけに頼らず subscribeStyleAnalysisResult で完了を待つ。
 */
export async function requestStyleAnalysis(
  videoId: string,
  topN = 3,
): Promise<AnalyzeStyleResponse> {
  const callable = httpsCallable<
    { videoId: string; topN: number },
    AnalyzeStyleResponse
  >(getFunctions(app), "analyzeStyle");
  const response = await callable({ videoId, topN });
  return response.data;
}

/** 診断結果ドキュメントを購読する（非同期完了の検知に使う） */
export function subscribeStyleAnalysisResult(
  styleAnalysisId: string,
  onChange: (result: StyleAnalysisResult) => void,
  onError?: (error: Error) => void,
): () => void {
  return onSnapshot(
    doc(db, COLLECTION, styleAnalysisId),
    (snapshot) => {
      const data = snapshot.data();
      if (!data) return;
      onChange(toResult(snapshot.id, data));
    },
    (error) => onError?.(error),
  );
}

/** その動画の最新の診断結果を 1 件取得する */
export async function fetchLatestStyleAnalysis(
  uid: string,
  videoId: string,
): Promise<StyleAnalysisResult | null> {
  const q = query(
    collection(db, COLLECTION),
    where("userId", "==", uid),
    where("videoId", "==", videoId),
    orderBy("createdAt", "desc"),
    limit(1),
  );
  const snapshot = await getDocs(q);
  const first = snapshot.docs[0];
  return first ? toResult(first.id, first.data()) : null;
}

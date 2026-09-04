/**
 * 連スタイル類似度（AI機能②）の型。
 *
 * Firestore のフィールド定義は docs/design/data-model.md 3.11 /
 * 仕様書 9.3、サーバ側の型は functions/src/lib/types.ts と対応する。
 */

export type StyleSimilarityItem = {
  renId: string;
  renName: string;
  /** コサイン類似度（-1〜1）。確率ではない（仕様書 8.5） */
  similarity: number;
  /** 代表 Embedding のサンプル数。少ない連には注記を出す */
  sampleCount: number;
};

export type StyleAnalysisStatus = "processing" | "completed" | "failed";

export type StyleAnalysisResult = {
  styleAnalysisId: string;
  userId: string;
  videoId: string;
  modelVersion: string;
  status: StyleAnalysisStatus;
  results: StyleSimilarityItem[];
  /** status === "failed" のときのエラーコード（仕様書 13章） */
  errorCode: string | null;
};

export type AnalyzeStyleResponse = {
  status: "completed";
  styleAnalysisId: string;
  modelVersion: string;
  results: StyleSimilarityItem[];
};

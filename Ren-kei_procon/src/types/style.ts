/**
 * 連スタイル類似度（AI機能②）の型。
 *
 * Firestore のフィールド定義は docs/design/data-model.md 3.11 /
 * 仕様書 9.3、サーバ側の型は functions/src/lib/types.ts と対応する。
 */

/** 連1つ分の類似度の結果 */
export type StyleSimilarityItem = {
  renId: string;
  renName: string;
  /** コサイン類似度（-1〜1）。確率ではない（仕様書 8.5） */
  similarity: number;
  /** 代表 Embedding のサンプル数。少ない連には注記を出す */
  sampleCount: number;
};

/** スタイル診断の進み具合(処理中/完了/失敗) */
export type StyleAnalysisStatus = "processing" | "completed" | "failed";

/** スタイル診断の結果1件分(styleAnalysisResults のドキュメント) */
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

/** スタイル診断を呼び出したときにサーバから返る値 */
export type AnalyzeStyleResponse = {
  status: "completed";
  styleAnalysisId: string;
  modelVersion: string;
  results: StyleSimilarityItem[];
};

/**
 * Firestore エンティティの共通型（連スタイル類似度で使う範囲）。
 *
 * パスとフィールドの根拠は docs/design/data-model.md 2章・3.11、
 * 仕様書 9.3 を参照。
 */
import {Timestamp} from "firebase-admin/firestore";

/**
 * Embedding の保存先。
 *
 * 現行のベースラインは 32 次元なので Firestore へ直接置く（TBD-09）。
 * 次元が大きくなったら kind: "storage" を追加して切り替える。
 */
export type EmbeddingRef = {
  kind: "inline";
  vector: number[];
};

/** 参照動画の提供者から得た同意（仕様書 14.3） */
export type StyleReferenceConsent = {
  /** 同意を得ているか。false の参照は代表計算に使わない */
  obtained: boolean;
  /** 利用範囲の記述（例: "連スタイル類似度の代表データとして利用"） */
  scope: string;
  obtainedAt: Timestamp;
};

/** renStyleReferences/{referenceId} */
export type RenStyleReference = {
  renId: string;
  /** 熟練者本人の uid（任意） */
  userId: string | null;
  videoId: string;
  /** 姿勢系列 JSON の Storage パス */
  poseSeriesPath: string;
  embeddingVersion: string;
  embeddingRef: EmbeddingRef;
  /** 代表 Embedding の計算に採用してよいか */
  approved: boolean;
  consent: StyleReferenceConsent;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

/** renStyleProfiles/{renId} */
export type RenStyleProfile = {
  renId: string;
  embeddingVersion: string;
  embeddingRef: EmbeddingRef;
  /** 代表 Embedding の計算に使ったサンプル数。UI の注記に使う */
  sampleCount: number;
  updatedAt: Timestamp;
};

/** styleAnalysisResults/{styleAnalysisId} の 1 件分 */
export type StyleSimilarityItem = {
  renId: string;
  renName: string;
  /** コサイン類似度（-1〜1）。表示値への変換は行わない */
  similarity: number;
  /** その連の代表 Embedding のサンプル数 */
  sampleCount: number;
};

/** styleAnalysisResults/{styleAnalysisId} */
export type StyleAnalysisResult = {
  userId: string;
  videoId: string;
  modelVersion: string;
  status: "processing" | "completed" | "failed";
  results: StyleSimilarityItem[];
  /** status === "failed" のときのエラーコード（仕様書 13章） */
  errorCode: string | null;
  createdAt: Timestamp;
  completedAt: Timestamp | null;
};

export const COLLECTIONS = {
  videos: "videos",
  ren: "ren",
  renStyleReferences: "renStyleReferences",
  renStyleProfiles: "renStyleProfiles",
  styleAnalysisResults: "styleAnalysisResults",
} as const;

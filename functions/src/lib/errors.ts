/**
 * エラーコード定義。
 *
 * 仕様書 13章のコードを HttpsError の message に載せる。
 * 表示文言はクライアント側の辞書で解決する（サーバ再デプロイなしで
 * 文言を変えられるようにするため）。
 */
export const ErrorCode = {
  // --- 仕様書 13章 ---
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  ANALYSIS_FAILED: "ANALYSIS_FAILED",
  STYLE_MODEL_UNAVAILABLE: "STYLE_MODEL_UNAVAILABLE",

  // --- 仕様書 13章にない拡張 ---
  // 追加理由は docs/design/api-functions.md 2章に記載する。
  /** 動画に対応する姿勢系列が Storage に無い */
  POSE_SERIES_NOT_FOUND: "POSE_SERIES_NOT_FOUND",
  /** 承認済みの参照 Embedding が 0 件（代表 Embedding を作れない） */
  STYLE_REFERENCE_NOT_FOUND: "STYLE_REFERENCE_NOT_FOUND",
  /** 比較できる連の代表 Embedding が 1 件も無い */
  STYLE_PROFILE_NOT_READY: "STYLE_PROFILE_NOT_READY",
  /** 引数が不正 */
  INVALID_ARGUMENT: "INVALID_ARGUMENT",
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

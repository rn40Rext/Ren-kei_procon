import {FunctionsErrorCode, HttpsError} from "firebase-functions/v2/https";

/**
 * 仕様書13章のエラーコード。HttpsErrorのmessageに載せて返し、
 * クライアント側は表示文言をこのコードで解決する
 * (多言語化・文言変更をサーバデプロイなしで行うため)。
 */
export const ErrorCode = {
  // --- 仕様書13章 ---
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  VIDEO_UPLOAD_FAILED: "VIDEO_UPLOAD_FAILED",
  ANALYSIS_FAILED: "ANALYSIS_FAILED",
  STYLE_MODEL_UNAVAILABLE: "STYLE_MODEL_UNAVAILABLE",
  JOIN_REQUEST_ALREADY_PENDING: "JOIN_REQUEST_ALREADY_PENDING",
  INVALID_STATUS_TRANSITION: "INVALID_STATUS_TRANSITION",
  POST_VIDEO_NOT_PUBLICABLE: "POST_VIDEO_NOT_PUBLICABLE",

  // --- 仕様書13章にない拡張(追加理由はdocs/design/api-functions.md 2章) ---
  /** 動画に対応する姿勢系列がStorageに無い */
  POSE_SERIES_NOT_FOUND: "POSE_SERIES_NOT_FOUND",
  /** 承認済みの参照Embeddingが0件(代表Embeddingを作れない) */
  STYLE_REFERENCE_NOT_FOUND: "STYLE_REFERENCE_NOT_FOUND",
  /** 比較できる連の代表Embeddingが1件も無い */
  STYLE_PROFILE_NOT_READY: "STYLE_PROFILE_NOT_READY",
  /** 引数が不正。どの引数かを「:引数名」で後ろに付ける */
  INVALID_ARGUMENT: "INVALID_ARGUMENT",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

const HTTPS_ERROR_CODE: Record<ErrorCode, FunctionsErrorCode> = {
  UNAUTHORIZED: "unauthenticated",
  FORBIDDEN: "permission-denied",
  VIDEO_UPLOAD_FAILED: "internal",
  ANALYSIS_FAILED: "internal",
  STYLE_MODEL_UNAVAILABLE: "unavailable",
  JOIN_REQUEST_ALREADY_PENDING: "already-exists",
  INVALID_STATUS_TRANSITION: "failed-precondition",
  POST_VIDEO_NOT_PUBLICABLE: "failed-precondition",
  POSE_SERIES_NOT_FOUND: "failed-precondition",
  STYLE_REFERENCE_NOT_FOUND: "failed-precondition",
  STYLE_PROFILE_NOT_READY: "failed-precondition",
  INVALID_ARGUMENT: "invalid-argument",
};

/**
 * 仕様書13章のエラーコードからHttpsErrorを組み立てる。
 * @param {ErrorCode} code 仕様書13章のエラーコード。
 * @return {HttpsError} 対応するHttpsErrorCodeを持つHttpsError。
 */
export function httpsErrorFor(code: ErrorCode): HttpsError {
  return new HttpsError(HTTPS_ERROR_CODE[code], code);
}

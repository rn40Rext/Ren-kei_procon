import {FunctionsErrorCode, HttpsError} from "firebase-functions/v2/https";

/**
 * 仕様書13章のエラーコード。HttpsErrorのmessageに載せて返し、
 * クライアント側は表示文言をこのコードで解決する
 * (多言語化・文言変更をサーバデプロイなしで行うため)。
 */
export const ErrorCode = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  VIDEO_UPLOAD_FAILED: "VIDEO_UPLOAD_FAILED",
  ANALYSIS_FAILED: "ANALYSIS_FAILED",
  STYLE_MODEL_UNAVAILABLE: "STYLE_MODEL_UNAVAILABLE",
  JOIN_REQUEST_ALREADY_PENDING: "JOIN_REQUEST_ALREADY_PENDING",
  INVALID_STATUS_TRANSITION: "INVALID_STATUS_TRANSITION",
  POST_VIDEO_NOT_PUBLICABLE: "POST_VIDEO_NOT_PUBLICABLE",
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
};

/**
 * 仕様書13章のエラーコードからHttpsErrorを組み立てる。
 * @param {ErrorCode} code 仕様書13章のエラーコード。
 * @return {HttpsError} 対応するHttpsErrorCodeを持つHttpsError。
 */
export function httpsErrorFor(code: ErrorCode): HttpsError {
  return new HttpsError(HTTPS_ERROR_CODE[code], code);
}

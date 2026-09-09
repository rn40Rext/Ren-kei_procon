import {CallableRequest} from "firebase-functions/v2/https";
import {ErrorCode, httpsErrorFor} from "./errors";

/**
 * 認証済みユーザーのuidを返す。未認証ならUNAUTHORIZEDを投げる。
 * @param {CallableRequest} request Callable Functionsのリクエスト。
 * @return {string} 認証済みユーザーのuid。
 */
export function requireAuth(request: CallableRequest): string {
  if (!request.auth?.uid) {
    throw httpsErrorFor(ErrorCode.UNAUTHORIZED);
  }
  return request.auth.uid;
}

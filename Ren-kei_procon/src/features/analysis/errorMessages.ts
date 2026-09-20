/**
 * 解析まわりの失敗をユーザー向け文言に変換する(仕様書 13章)。
 *
 * 表示文言はクライアント側の辞書で解決する方針なので、サーバのエラーコードと
 * ネットワーク障害をここで一括して日本語にする。
 */

/** 仕様書 13章のコード → 表示文言 */
const CODE_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: "ログインの有効期限が切れています。ログインし直してください。",
  FORBIDDEN: "この動画を採点する権限がありません。",
  ANALYSIS_FAILED: "採点に失敗しました。時間をおいて再試行してください。",
  VIDEO_UPLOAD_FAILED: "動画のアップロードに失敗しました。通信環境を確認してください。",
};

/** Cloud Functions に届かなかったとき(未デプロイ・オフライン・CORS) */
export const FUNCTIONS_UNREACHABLE =
  "採点サーバに接続できませんでした。判定の記録は端末に残っています。" +
  "通信環境を確認して再試行してください。";

/**
 * Functions へ到達できなかった種類の失敗か。
 *
 * 関数が未デプロイだとプリフライトに CORS ヘッダが付かず、ブラウザからは
 * 「CORS policy にブロックされた」という、原因が分かりにくい形で見える。
 * オフラインや DNS 失敗も同じ経路になるのでまとめて扱う。
 */
export function isFunctionsUnreachable(error: unknown): boolean {
  const message = errorTextOf(error).toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("network request failed") ||
    message.includes("cors") ||
    message.includes("err_failed") ||
    message.includes("internal") // Functions SDK が到達不能を internal に丸めることがある
  );
}

/** エラーから文字列を取り出す(FirebaseError は message にコードが入る)。 */
export function errorTextOf(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const e = error as { message?: unknown; code?: unknown };
    if (typeof e.message === "string") return e.message;
    if (typeof e.code === "string") return e.code;
  }
  return String(error);
}

/** FN-01 の失敗をユーザー向け文言にする。 */
export function finalizeErrorMessage(error: unknown): string {
  const text = errorTextOf(error);
  for (const [code, message] of Object.entries(CODE_MESSAGES)) {
    if (text.includes(code)) return message;
  }
  if (text.startsWith("INVALID_ARGUMENT")) {
    return "送信した判定データが不正です。撮り直してください。";
  }
  if (isFunctionsUnreachable(error)) return FUNCTIONS_UNREACHABLE;
  return `採点に失敗しました（${text}）`;
}

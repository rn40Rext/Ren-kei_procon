/**
 * エラーコード → 表示文言の辞書。
 *
 * 文言をサーバに持たせるとデプロイなしで変えられないため、
 * クライアント側で解決する（docs/design/api-functions.md 2章）。
 */
export const STYLE_ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: "ログインが必要です。",
  FORBIDDEN: "この動画を解析する権限がありません。",
  ANALYSIS_FAILED:
    "解析に失敗しました。時間をおいて再試行してください。",
  STYLE_MODEL_UNAVAILABLE:
    "スタイル診断が一時的に利用できません。基本動作の結果は保存されています。",
  POSE_SERIES_NOT_FOUND:
    "この動画には姿勢データがありません。撮り直して解析してください。",
  STYLE_PROFILE_NOT_READY:
    "比較できる連のデータがまだありません。",
  STYLE_REFERENCE_NOT_FOUND: "承認済みの参照データがありません。",
};

/** コードから文言を引く。未知のコードは汎用文言にする */
export function styleErrorMessage(code: string | null | undefined): string {
  if (!code) return "エラーが発生しました。";
  const key = code.split(":")[0];
  return STYLE_ERROR_MESSAGES[key] ?? "エラーが発生しました。";
}

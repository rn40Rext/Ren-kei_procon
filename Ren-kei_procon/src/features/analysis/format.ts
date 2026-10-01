/** スコア表示の共通フォーマット。モック値を実物のように見せない(#58)。 */

/**
 * 極め度(analysisResults.totalScore・0〜100点)の表示。未採点の投稿は数字を出さない。
 * 総合点の呼び方は画面全体で「極め度 〇点」に統一する。
 */
export function formatAiScore(score: number | null | undefined): string {
  if (typeof score !== "number" || !Number.isFinite(score)) return "未採点";
  return `極め度 ${Math.round(score)}点`;
}

/**
 * 短い形式(「92点」)。「極め度」の見出しが隣にある所(MetricRowのラベル等)や、
 * 幅の狭いバッジで使う。
 */
export function formatAiScoreShort(score: number | null | undefined): string {
  if (typeof score !== "number" || !Number.isFinite(score)) return "未採点";
  return `${Math.round(score)}点`;
}

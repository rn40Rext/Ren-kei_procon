/** スコア表示の共通フォーマット。モック値を実物のように見せない(#58)。 */

/** posts.score の表示。未採点の投稿は数字を出さない。 */
export function formatAiScore(score: number | null | undefined): string {
  if (typeof score !== "number" || !Number.isFinite(score)) return "未採点";
  return `AI採点 ${Math.round(score)}点`;
}

export function formatAiScoreShort(score: number | null | undefined): string {
  if (typeof score !== "number" || !Number.isFinite(score)) return "未採点";
  return `AI ${Math.round(score)}点`;
}

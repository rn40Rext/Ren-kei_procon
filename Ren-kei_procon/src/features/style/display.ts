/**
 * 類似度の表示ルール（仕様書 8.5 / docs/design/ai-style-similarity.md 5章）。
 *
 * 守ること:
 *  - 確率表現をしない（「87% の確率で○○連」は禁止）
 *  - 参加可否を示唆しない（「向いていません」は禁止）
 *  - 順位の断定を避ける（1 位との差が小さいときは併記する）
 */
import type { StyleSimilarityItem } from "../../types/style";

/**
 * 表示値へのスケーリング（TBD-10）。
 *
 * 実データの分布が無いため暫定の線形変換を置いている。
 * cos がこの範囲に収まる前提で 0〜100 へ写像する。
 * 検証データが集まったら分布から min / max を再推定する。
 */
export const DISPLAY_CALIBRATION = { min: 0.5, max: 1.0 } as const;

/** 1 位との差がこれ以下なら順位を断定しない */
export const CLOSE_MATCH_THRESHOLD = 0.02;

/** これ未満のサンプル数の連には「参考値」の注記を出す */
export const SMALL_SAMPLE_THRESHOLD = 3;

/** コサイン類似度を表示値（0〜100 の整数）へ変換する */
export function toDisplayScore(similarity: number): number {
  const { min, max } = DISPLAY_CALIBRATION;
  const ratio = (similarity - min) / (max - min);
  return Math.round(Math.min(1, Math.max(0, ratio)) * 100);
}

/** 上位が僅差か。僅差なら順位を断定しない文言に切り替える */
export function isCloseMatch(items: StyleSimilarityItem[]): boolean {
  if (items.length < 2) return false;
  return items[0].similarity - items[1].similarity <= CLOSE_MATCH_THRESHOLD;
}

/** サンプル数が少ない連か */
export function hasFewSamples(item: StyleSimilarityItem): boolean {
  return item.sampleCount < SMALL_SAMPLE_THRESHOLD;
}

/** 見出しの文言。確率表現も適性判断も含めない */
export function headlineFor(items: StyleSimilarityItem[]): string {
  if (items.length === 0) return "近い連が見つかりませんでした";
  if (isCloseMatch(items)) return "複数の連に近い傾向です";
  return `あなたは ${items[0].renName} タイプ`;
}

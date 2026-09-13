/**
 * Game Score(仕様書 7.6 / docs/design/ai-basic-motion.md 7章)。
 *
 * リアルタイムの LIVE SCORE。UX 調整用の値であり阿波踊り能力の絶対評価ではない。
 * 履歴に残す Analysis Score(0〜100)とは別物(D-04)。
 * 点数は暫定(TBD-06)。
 */
import { Grade } from "./types";

export const GAME_POINTS: Record<Grade, number> = {
  GREAT: 100,
  GOOD: 60,
  MISS: 0,
};

export type GameScoreState = {
  score: number;
  combo: number;
  maxCombo: number;
  counts: Record<Grade, number>;
};

export function initialGameScore(): GameScoreState {
  return { score: 0, combo: 0, maxCombo: 0, counts: { GREAT: 0, GOOD: 0, MISS: 0 } };
}

/**
 * 判定 1 件を加算した新しい状態を返す(元は変更しない)。
 * COMBO: 連続成功 5 回ごとに +1 倍のボーナス(floor(combo / 5) 倍)。
 */
export function applyGrade(state: GameScoreState, grade: Grade): GameScoreState {
  const counts = { ...state.counts, [grade]: state.counts[grade] + 1 };
  if (grade === "MISS") {
    return { ...state, combo: 0, counts };
  }
  const combo = state.combo + 1;
  const bonusMultiplier = 1 + Math.floor(combo / 5);
  return {
    score: state.score + GAME_POINTS[grade] * bonusMultiplier,
    combo,
    maxCombo: Math.max(state.maxCombo, combo),
    counts,
  };
}

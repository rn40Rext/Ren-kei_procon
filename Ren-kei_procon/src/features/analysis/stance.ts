/**
 * リアルタイム解析の「構えを取ったら採点を始める」判定。
 *
 * 判定開始ボタンを押した瞬間から採点すると、カメラの前に移動する時間まで
 * 採点されてしまう。そこで踊りの構えを STANCE_HOLD_MS 続けたら採点を始める。
 * 構えの条件は採点する部位で変える(「手だけ」なら脚は見ない)。
 */
import { MetricValues, ScorePart } from "../rules/types";

/** 構えをこの時間続けたら採点を始める[ms] */
export const STANCE_HOLD_MS = 3000;
/** 検出のゆらぎで一瞬条件を外れても、この時間以内ならリセットしない[ms] */
export const STANCE_GRACE_MS = 300;
/** 選べる採点時間[秒] */
export const SCORING_DURATIONS_SEC = [10, 20] as const;
export type ScoringDurationSec = (typeof SCORING_DURATIONS_SEC)[number];

/** 構えで手をどこまで上げるか。0 = 頭(鼻)と同じ高さ */
const STANCE_HAND_MIN_HEIGHT = 0;

function handsUp(values: MetricValues): boolean {
  const l = values["normalizedHandHeight:left"];
  const r = values["normalizedHandHeight:right"];
  return l !== null && l !== undefined && r !== null && r !== undefined && l >= STANCE_HAND_MIN_HEIGHT && r >= STANCE_HAND_MIN_HEIGHT;
}

function hipsDown(values: MetricValues): boolean {
  const m = values.basePostureMargin;
  return m !== null && m !== undefined && m >= 0;
}

/**
 * 1 フレームが構えになっているか。
 * 手: 両手を頭より上に上げる / 足: 腰を落として膝を曲げる(RULE-06 基本姿勢) / 全体: 両方。
 */
export function isStance(values: MetricValues, scorePart: ScorePart): boolean {
  if (scorePart === "hands") return handsUp(values);
  if (scorePart === "feet") return hipsDown(values);
  return handsUp(values) && hipsDown(values);
}

/** 構え待ちの間に出す案内 */
export function stanceGuide(scorePart: ScorePart): string {
  if (scorePart === "hands") return "両手を頭の上に上げて構えてください";
  if (scorePart === "feet") return "腰を落とし、膝を曲げて構えてください";
  return "腰を落とし、両手を頭の上に上げて構えてください";
}

/** 構えの継続時間を数える。 */
export class StanceGate {
  private since: number | null = null;
  private lastOkMs = -Infinity;

  reset(): void {
    this.since = null;
    this.lastOkMs = -Infinity;
  }

  /** 1 フレーム分進め、構えの進み具合(0〜1)を返す。1 になったら採点開始。 */
  update(ok: boolean, nowMs: number): number {
    if (ok) {
      if (this.since === null) this.since = nowMs;
      this.lastOkMs = nowMs;
    } else if (nowMs - this.lastOkMs > STANCE_GRACE_MS) {
      this.since = null;
    }
    if (this.since === null) return 0;
    return Math.min(1, (nowMs - this.since) / STANCE_HOLD_MS);
  }
}

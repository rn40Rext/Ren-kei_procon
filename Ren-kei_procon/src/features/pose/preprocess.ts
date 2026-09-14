/**
 * 前処理(仕様書 7.2 / docs/design/ai-basic-motion.md 2章の [2])。
 *
 *  1. 低信頼度点の除外 … visibility が閾値未満の点は座標を前回値で埋め、
 *     visibility はそのまま残す(後段の正規化関数が null 判定に使う)。
 *  2. 時間方向の平滑化 … 指数移動平均(EMA)。フレーム間隔に応じて係数を
 *     変え、fps が揺れても同じ時定数になるようにする。
 *
 * 状態を持つのでクラスにしている。セッション開始時に作り直す。
 */
import { Landmark, NUM_LANDMARKS, PoseFrame } from "./types";
import { MIN_VISIBILITY } from "./normalize";

export type SmoothingOptions = {
  /** 平滑化の時定数[ms]。大きいほど滑らか(遅れも増える)。既定 80ms */
  timeConstantMs?: number;
  /** 低信頼度点を前回値で埋めるときの visibility 閾値 */
  minVisibility?: number;
};

export class PoseSmoother {
  private prev: Landmark[] | null = null;
  private prevTs = 0;
  private readonly tau: number;
  private readonly minVis: number;

  constructor(options: SmoothingOptions = {}) {
    this.tau = options.timeConstantMs ?? 80;
    this.minVis = options.minVisibility ?? MIN_VISIBILITY;
  }

  reset(): void {
    this.prev = null;
    this.prevTs = 0;
  }

  /** 1 フレームを平滑化して返す。入力は変更しない。 */
  apply(frame: PoseFrame): PoseFrame {
    const n = Math.min(frame.landmarks.length, NUM_LANDMARKS);
    if (this.prev === null || frame.timestampMs <= this.prevTs) {
      this.prev = frame.landmarks.slice(0, n).map((p) => ({ ...p }));
      this.prevTs = frame.timestampMs;
      return { timestampMs: frame.timestampMs, landmarks: this.prev.map((p) => ({ ...p })) };
    }

    const dt = frame.timestampMs - this.prevTs;
    // EMA 係数。dt が時定数に比べて長いほど新しい値を強く採る
    const alpha = 1 - Math.exp(-dt / this.tau);
    const out: Landmark[] = new Array(n);
    for (let i = 0; i < n; i++) {
      const cur = frame.landmarks[i];
      const last = this.prev[i] ?? cur;
      if (cur.visibility < this.minVis) {
        // 見えていない点は位置を動かさない(暴れた座標で判定を汚さない)
        out[i] = { ...last, visibility: cur.visibility };
        continue;
      }
      out[i] = {
        x: last.x + (cur.x - last.x) * alpha,
        y: last.y + (cur.y - last.y) * alpha,
        z: cur.z !== undefined && last.z !== undefined ? last.z + (cur.z - last.z) * alpha : cur.z,
        visibility: cur.visibility,
      };
    }
    this.prev = out.map((p) => ({ ...p }));
    this.prevTs = frame.timestampMs;
    return { timestampMs: frame.timestampMs, landmarks: out };
  }
}

/** 主要 landmark の平均 visibility。人物検出の信頼度表示に使う。 */
export function meanVisibility(frame: PoseFrame, indices: readonly number[]): number {
  let sum = 0;
  let count = 0;
  for (const i of indices) {
    const p = frame.landmarks[i];
    if (p) {
      sum += p.visibility;
      count++;
    }
  }
  return count === 0 ? 0 : sum / count;
}

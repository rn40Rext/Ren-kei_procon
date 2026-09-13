/**
 * 1 フレームの姿勢から Rule Engine が使う指標をまとめて計算する。
 * 座標 → 意味のある量への変換だけを担当し、閾値判定は ruleEngine.ts に置く。
 */
import { LM, PoseFrame } from "../pose/types";
import {
  bodyScale,
  kneeAngleDeg,
  normalizedHandHeight,
  normalizedHandHorizontalOffset,
  normalizedHipHeight,
  normalizedVelocity,
  torsoTiltDeg,
} from "../pose/normalize";
import { MetricValues } from "./types";

/** RULE-06 基本姿勢の構成条件(暫定。TBD-02) */
export const BASE_POSTURE = {
  /** 腰の高さ上限(RULE-03 の GOOD ラインと同じ) */
  hipMax: 0.55,
  /** 膝角度上限[度] */
  kneeMaxDeg: 160,
  /** 上体の傾き上限[度]。前かがみ・のけぞりを弾く */
  torsoTiltMaxDeg: 25,
} as const;

/**
 * 基本姿勢の余裕。全条件を満たすと 0 以上、どれかが外れると負になる。
 * 複数条件を 1 つの連続量にまとめることで、単一ルールと同じ状態機械で扱える(#18)。
 */
export function basePostureMargin(
  hip: number | null,
  knee: number | null,
  tilt: number | null
): number | null {
  if (hip === null || knee === null || tilt === null) return null;
  return Math.min(
    BASE_POSTURE.hipMax - hip,
    (BASE_POSTURE.kneeMaxDeg - knee) / 100,
    (BASE_POSTURE.torsoTiltMaxDeg - tilt) / 50
  );
}

function meanOf(a: number | null, b: number | null): number | null {
  if (a !== null && b !== null) return (a + b) / 2;
  return a ?? b;
}

/**
 * 指標を計算する。全身が映っていない(bodyScale が取れない)ときは
 * すべて null になり、各ルールは NOT_READY になる。
 */
export function computeMetrics(frame: PoseFrame, prev: PoseFrame | null): MetricValues {
  const scale = bodyScale(frame);
  const out: MetricValues = {
    bodyScale: scale,
    "normalizedHandHeight:left": null,
    "normalizedHandHeight:right": null,
    "normalizedHandVelocity:left": null,
    "normalizedHandVelocity:right": null,
    "normalizedHandHorizontalOffset:left": null,
    "normalizedHandHorizontalOffset:right": null,
    normalizedHipHeight: null,
    kneeAngleDeg: null,
    torsoTiltDeg: null,
    basePostureMargin: null,
  };
  if (scale === null) return out;

  out["normalizedHandHeight:left"] = normalizedHandHeight(frame, "left", scale);
  out["normalizedHandHeight:right"] = normalizedHandHeight(frame, "right", scale);
  out["normalizedHandHorizontalOffset:left"] = normalizedHandHorizontalOffset(frame, "left", scale);
  out["normalizedHandHorizontalOffset:right"] = normalizedHandHorizontalOffset(frame, "right", scale);
  if (prev) {
    out["normalizedHandVelocity:left"] = normalizedVelocity(prev, frame, LM.L_WRIST, scale);
    out["normalizedHandVelocity:right"] = normalizedVelocity(prev, frame, LM.R_WRIST, scale);
  }
  const hip = normalizedHipHeight(frame, scale);
  const knee = meanOf(kneeAngleDeg(frame, "left"), kneeAngleDeg(frame, "right"));
  const tilt = torsoTiltDeg(frame);
  out.normalizedHipHeight = hip;
  out.kneeAngleDeg = knee;
  out.torsoTiltDeg = tilt;
  out.basePostureMargin = basePostureMargin(hip, knee, tilt);
  return out;
}

/** 手を出す動きがこれ以上あったら「動作した」とみなす正規化速度 */
export const HAND_MOTION_THRESHOLD = 0.8;
/** 動作からこの時間以内の静止だけを RULE-04 の対象にする */
export const HAND_STOP_WINDOW_MS = 700;

/**
 * 状態を持つ指標計算。前フレームの保持と RULE-04 の「動作後」判定を担当する。
 *
 * RULE-04「手を止める」は位置だけで判定しない(仕様書 7.4)。手を出す動作の
 * 直後(HAND_STOP_WINDOW_MS 以内)でなければ速度指標を null にし、
 * 棒立ちの静止を「止めた」と誤判定しないようにする。
 */
export class MetricsTracker {
  private prev: PoseFrame | null = null;
  private lastMotionMs: Record<"left" | "right", number> = { left: -Infinity, right: -Infinity };

  reset(): void {
    this.prev = null;
    this.lastMotionMs = { left: -Infinity, right: -Infinity };
  }

  update(frame: PoseFrame): MetricValues {
    const values = computeMetrics(frame, this.prev);
    for (const side of ["left", "right"] as const) {
      const key = `normalizedHandVelocity:${side}`;
      const v = values[key];
      if (v !== null && v !== undefined && v >= HAND_MOTION_THRESHOLD) {
        this.lastMotionMs[side] = frame.timestampMs;
      }
      if (frame.timestampMs - this.lastMotionMs[side] > HAND_STOP_WINDOW_MS) {
        // 直前に動作が無い静止は判定対象外(NOT_READY)
        values[key] = null;
      }
    }
    this.prev = frame;
    return values;
  }
}

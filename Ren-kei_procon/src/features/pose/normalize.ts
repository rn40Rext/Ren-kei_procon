/**
 * 座標正規化ユーティリティ(仕様書 7.3 / docs/design/ai-basic-motion.md 4章)。
 *
 * ピクセル距離を直接使わず、bodyScale(肩中心〜足首中心の距離 = 身長相当)で
 * 割ることで体格差・撮影距離の影響を除く。画像座標は y が下向き正。
 * すべて純関数。フィクスチャ JSON を入力してユニットテストできる(#14)。
 */
import { LM, Landmark, PoseFrame } from "./types";

/** これ未満の visibility の点は「見えていない」として扱う。 */
export const MIN_VISIBILITY = 0.5;

export type Side = "left" | "right";

/** 2 点の中点。visibility は小さいほう(安全側)を採る。 */
export function center(a: Landmark, b: Landmark): Landmark {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    visibility: Math.min(a.visibility, b.visibility),
  };
}

function lm(f: PoseFrame, idx: number): Landmark | null {
  const p = f.landmarks[idx];
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
  return p;
}

function visible(...points: (Landmark | null)[]): boolean {
  return points.every((p) => p !== null && p.visibility >= MIN_VISIBILITY);
}

/**
 * 身長相当のスケール。全身が映っていなければ null(→ NOT_READY)。
 * 肩中心と足首中心の距離。
 */
export function bodyScale(f: PoseFrame): number | null {
  const ls = lm(f, LM.L_SHOULDER);
  const rs = lm(f, LM.R_SHOULDER);
  const la = lm(f, LM.L_ANKLE);
  const ra = lm(f, LM.R_ANKLE);
  if (!ls || !rs || !la || !ra) return null;
  const shoulder = center(ls, rs);
  const ankle = center(la, ra);
  if (!visible(shoulder, ankle)) return null;
  const scale = Math.hypot(shoulder.x - ankle.x, shoulder.y - ankle.y);
  return scale > 1e-6 ? scale : null;
}

/**
 * 手の高さ。頭(鼻)より上にあるほど正の大きな値。
 * 手首か鼻が見えていなければ null(誤加点を防ぐ。#15 の受け入れ条件)。
 */
export function normalizedHandHeight(f: PoseFrame, side: Side, scale: number): number | null {
  const wrist = lm(f, side === "left" ? LM.L_WRIST : LM.R_WRIST);
  const head = lm(f, LM.NOSE);
  if (!wrist || !head || !visible(wrist, head)) return null;
  return (head.y - wrist.y) / scale;
}

/**
 * 腰の低さ。腰中心と足首中心の縦距離 / bodyScale。腰が落ちているほど小さい。
 */
export function normalizedHipHeight(f: PoseFrame, scale: number): number | null {
  const lh = lm(f, LM.L_HIP);
  const rh = lm(f, LM.R_HIP);
  const la = lm(f, LM.L_ANKLE);
  const ra = lm(f, LM.R_ANKLE);
  if (!lh || !rh || !la || !ra) return null;
  const hip = center(lh, rh);
  const ankle = center(la, ra);
  if (!visible(hip, ankle)) return null;
  return (ankle.y - hip.y) / scale;
}

/**
 * 正規化速度。連続する 2 フレームの同一 landmark の移動距離 / bodyScale / Δt[s]。
 * 「出して止める」(RULE-04)の停止判定に使う。
 */
export function normalizedVelocity(
  prev: PoseFrame,
  cur: PoseFrame,
  idx: number,
  scale: number
): number | null {
  const dt = (cur.timestampMs - prev.timestampMs) / 1000;
  if (dt <= 0) return null;
  const a = lm(prev, idx);
  const b = lm(cur, idx);
  if (!a || !b || !visible(a, b)) return null;
  return Math.hypot(b.x - a.x, b.y - a.y) / scale / dt;
}

/** 3 点 a-b-c の b を頂点とする角度[度]。 */
export function angleDeg(a: Landmark, b: Landmark, c: Landmark): number {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const n1 = Math.hypot(v1x, v1y);
  const n2 = Math.hypot(v2x, v2y);
  if (n1 < 1e-9 || n2 < 1e-9) return 180;
  const cos = (v1x * v2x + v1y * v2y) / (n1 * n2);
  return (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI;
}

/**
 * 膝の屈曲角[度](腰-膝-足首)。180 に近いほど直立、小さいほど深く曲げている。
 * RULE-03 で正規化腰位置と組み合わせて使う。
 */
export function kneeAngleDeg(f: PoseFrame, side: Side): number | null {
  const hip = lm(f, side === "left" ? LM.L_HIP : LM.R_HIP);
  const knee = lm(f, side === "left" ? LM.L_KNEE : LM.R_KNEE);
  const ankle = lm(f, side === "left" ? LM.L_ANKLE : LM.R_ANKLE);
  if (!hip || !knee || !ankle || !visible(hip, knee, ankle)) return null;
  return angleDeg(hip, knee, ankle);
}

/**
 * 手首の、頭(鼻)からの水平距離 / bodyScale(RULE-05 手の位置)。
 * 頭上の許容領域に収まっているかを見る。
 */
export function normalizedHandHorizontalOffset(
  f: PoseFrame,
  side: Side,
  scale: number
): number | null {
  const wrist = lm(f, side === "left" ? LM.L_WRIST : LM.R_WRIST);
  const head = lm(f, LM.NOSE);
  if (!wrist || !head || !visible(wrist, head)) return null;
  return Math.abs(wrist.x - head.x) / scale;
}

/**
 * 上体の傾き[度]。肩中心-腰中心の線が鉛直からどれだけ傾いているか。
 * 0 が直立。RULE-06 基本姿勢維持で使う。
 */
export function torsoTiltDeg(f: PoseFrame): number | null {
  const ls = lm(f, LM.L_SHOULDER);
  const rs = lm(f, LM.R_SHOULDER);
  const lh = lm(f, LM.L_HIP);
  const rh = lm(f, LM.R_HIP);
  if (!ls || !rs || !lh || !rh) return null;
  const shoulder = center(ls, rs);
  const hip = center(lh, rh);
  if (!visible(shoulder, hip)) return null;
  const dx = shoulder.x - hip.x;
  const dy = hip.y - shoulder.y; // 上向きを正にする
  if (Math.abs(dy) < 1e-9) return 90;
  return Math.abs((Math.atan2(dx, dy) * 180) / Math.PI);
}

/** 腰中心の画像 y(0〜1)。リズム判定(RULE-07)の上下動信号に使う。 */
export function hipCenterY(f: PoseFrame): number | null {
  const lh = lm(f, LM.L_HIP);
  const rh = lm(f, LM.R_HIP);
  if (!lh || !rh || !visible(lh, rh)) return null;
  return (lh.y + rh.y) / 2;
}

import assert from "node:assert/strict";
import { test } from "node:test";
import { BASIC_FORM, STANDING, synthesize } from "../rules/__fixtures__/synth";
import { LM } from "./types";
import {
  bodyScale,
  kneeAngleDeg,
  normalizedHandHeight,
  normalizedHandHorizontalOffset,
  normalizedHipHeight,
  normalizedVelocity,
  torsoTiltDeg,
} from "./normalize";

const near = (a: number | null, b: number, tol: number, msg?: string) => {
  assert.ok(a !== null, `${msg ?? ""} value is null`);
  assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} expected ${b}±${tol}, got ${a}`);
};

test("bodyScale は肩中心〜足首中心の距離。撮影距離を変えると比例して変わる", () => {
  const near1 = synthesize(BASIC_FORM, { frames: 1 })[0];
  const far = synthesize(BASIC_FORM, { frames: 1, scale: 0.5 })[0];
  const s1 = bodyScale(near1);
  const s2 = bodyScale(far);
  near(s1, 0.5, 0.01);
  near(s2, 0.25, 0.01);
});

test("足首が見えていないと bodyScale は null(NOT_READY)", () => {
  const f = synthesize(BASIC_FORM, { frames: 1, hidden: [LM.L_ANKLE, LM.R_ANKLE] })[0];
  assert.equal(bodyScale(f), null);
});

test("正規化した手の高さ・腰の高さは撮影距離に依存しない", () => {
  for (const scale of [1, 0.6]) {
    const f = synthesize(BASIC_FORM, { frames: 1, scale })[0];
    const s = bodyScale(f)!;
    near(normalizedHandHeight(f, "left", s), 0.15, 0.02, `hand scale=${scale}`);
    near(normalizedHipHeight(f, s), 0.46, 0.02, `hip scale=${scale}`);
    near(normalizedHandHorizontalOffset(f, "left", s), 0.1, 0.03, `offset scale=${scale}`);
  }
});

test("膝角度: 直立で約 180 度、曲げると指定角度に近い", () => {
  const straight = synthesize(STANDING, { frames: 1 })[0];
  const bent = synthesize(BASIC_FORM, { frames: 1 })[0];
  near(kneeAngleDeg(straight, "left"), 178, 2);
  near(kneeAngleDeg(bent, "right"), 140, 3);
});

test("上体の傾き: 直立で 0、傾けると指定角度", () => {
  const upright = synthesize({ ...BASIC_FORM, torsoTilt: 0 }, { frames: 1 })[0];
  const leaning = synthesize({ ...BASIC_FORM, torsoTilt: 20 }, { frames: 1 })[0];
  near(torsoTiltDeg(upright), 0, 1);
  near(torsoTiltDeg(leaning), 20, 2);
});

test("手首が見えていないと手の高さは null(誤加点しない)", () => {
  const f = synthesize(BASIC_FORM, { frames: 1, hidden: [LM.L_WRIST] })[0];
  const s = bodyScale(f)!;
  assert.equal(normalizedHandHeight(f, "left", s), null);
  assert.ok(normalizedHandHeight(f, "right", s) !== null);
});

test("正規化速度: 手を振ると正、静止で 0", () => {
  const moving = synthesize(BASIC_FORM, { frames: 2, handSwing: { amplitude: 0.2, bpm: 120 } });
  const still = synthesize(BASIC_FORM, { frames: 2 });
  const s = bodyScale(still[0])!;
  const v = normalizedVelocity(moving[0], moving[1], LM.L_WRIST, s);
  assert.ok(v !== null && v > 0.5, `moving velocity ${v}`);
  near(normalizedVelocity(still[0], still[1], LM.L_WRIST, s), 0, 1e-9);
});

test("鏡像でも左右を入れ替えれば同じ値になる", () => {
  const f = synthesize({ ...BASIC_FORM, handHeight: { left: 0.2, right: 0.0 } }, { frames: 1 })[0];
  const m = synthesize({ ...BASIC_FORM, handHeight: { left: 0.2, right: 0.0 } }, { frames: 1, mirror: true })[0];
  const s = bodyScale(f)!;
  const sm = bodyScale(m)!;
  near(sm, s, 1e-9);
  // 映像を左右反転すると MediaPipe は見かけで左右を付けるので、左右のラベルが入れ替わる。
  // 入れ替えた先で値が一致していれば、左右のどちらで撮っても判定は一貫する
  near(normalizedHandHeight(m, "right", sm), normalizedHandHeight(f, "left", s)!, 1e-6);
  near(normalizedHandHeight(m, "left", sm), normalizedHandHeight(f, "right", s)!, 1e-6);
  near(normalizedHipHeight(m, sm), normalizedHipHeight(f, s)!, 1e-6);
});

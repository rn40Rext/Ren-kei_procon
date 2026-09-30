import assert from "node:assert/strict";
import { test } from "node:test";
import { STANCE_GRACE_MS, STANCE_HOLD_MS, StanceGate, isStance } from "./stance";
import { MetricValues } from "../rules/types";

const HANDS_UP: MetricValues = { "normalizedHandHeight:left": 0.2, "normalizedHandHeight:right": 0.15 };
const HIPS_DOWN: MetricValues = { basePostureMargin: 0.05 };

test("手だけ: 両手が頭より上なら構え。片手だけ・見えない手は構えではない", () => {
  assert.equal(isStance(HANDS_UP, "hands"), true);
  assert.equal(isStance({ ...HANDS_UP, "normalizedHandHeight:right": -0.1 }, "hands"), false);
  assert.equal(isStance({ ...HANDS_UP, "normalizedHandHeight:left": null }, "hands"), false);
});

test("足だけ: 基本姿勢を満たせば構え。手は見ない", () => {
  assert.equal(isStance(HIPS_DOWN, "feet"), true);
  assert.equal(isStance({ basePostureMargin: -0.01 }, "feet"), false);
  assert.equal(isStance({ basePostureMargin: null }, "feet"), false);
});

test("全体: 手と腰の両方が必要", () => {
  assert.equal(isStance({ ...HANDS_UP, ...HIPS_DOWN }, "whole"), true);
  assert.equal(isStance(HANDS_UP, "whole"), false);
  assert.equal(isStance(HIPS_DOWN, "whole"), false);
});

test("構えを STANCE_HOLD_MS 続けると 1 になる", () => {
  const g = new StanceGate();
  assert.equal(g.update(true, 1000), 0);
  assert.equal(g.update(true, 1000 + STANCE_HOLD_MS / 2), 0.5);
  assert.equal(g.update(true, 1000 + STANCE_HOLD_MS), 1);
});

test("短いゆらぎではリセットせず、構えを解くとやり直し", () => {
  const g = new StanceGate();
  g.update(true, 0);
  g.update(true, 1000);
  g.update(false, 1000 + STANCE_GRACE_MS / 2);
  assert.ok(g.update(true, 1000 + STANCE_GRACE_MS) > 0.3, "ゆらぎでリセットされた");
  assert.equal(g.update(false, 2000 + STANCE_GRACE_MS + 1), 0);
  assert.equal(g.update(true, 5000), 0);
});

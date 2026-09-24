/**
 * FN-01 のmetrics/events整合性検証(#102、functions/src/analysis/finalizeBasicAnalysis.ts)のテスト。
 * クライアント申告のmetricsだけを信用しない、という改ざん対策の中核部分。
 */
import * as assert from "node:assert/strict";
import {test} from "node:test";
import {
  assertPlausibleEventTimestamps,
  deriveGradeCounts,
  reconcileMetricsWithEvents,
} from "../analysis/finalizeBasicAnalysis";

test("deriveGradeCounts: ルールごとにGREAT/GOOD/MISSを数える", () => {
  const counts = deriveGradeCounts([
    {ruleId: "HAND_ABOVE_HEAD", grade: "GREAT", timestampMs: 100, value: 1},
    {ruleId: "HAND_ABOVE_HEAD", grade: "GOOD", timestampMs: 200, value: 1},
    {ruleId: "HAND_ABOVE_HEAD", grade: "MISS", timestampMs: 300, value: 0},
    {ruleId: "HIP_LOW", grade: "GREAT", timestampMs: 150, value: 1},
  ]);
  assert.deepEqual(counts.HAND_ABOVE_HEAD, {
    greatCount: 1,
    goodCount: 1,
    missCount: 1,
  });
  assert.deepEqual(counts.HIP_LOW, {greatCount: 1, goodCount: 0, missCount: 0});
});

test("reconcileMetricsWithEvents: 申告のgreat/good/missはeventsの実数に置き換わる", () => {
  // クライアントが「attempts:1, greatCount:1」を申告しても、eventsが空なら0に矯正される
  const result = reconcileMetricsWithEvents(
    {
      HAND_ABOVE_HEAD: {attempts: 1, greatCount: 1, goodCount: 0, missCount: 0},
    },
    [], // 対応するeventsが無い(#102が塞ぐ典型的な偽装パターン)
  );
  assert.equal(result.HAND_ABOVE_HEAD.greatCount, 0);
  assert.equal(result.HAND_ABOVE_HEAD.goodCount, 0);
  assert.equal(result.HAND_ABOVE_HEAD.missCount, 0);
});

test("reconcileMetricsWithEvents: attemptsはeventsの合計を下回らない", () => {
  const result = reconcileMetricsWithEvents(
    {HAND_STOP: {attempts: 1, greatCount: 0, goodCount: 0, missCount: 0}},
    [
      {ruleId: "HAND_STOP", grade: "GREAT", timestampMs: 100, value: 1},
      {ruleId: "HAND_STOP", grade: "MISS", timestampMs: 200, value: 0},
      {ruleId: "HAND_STOP", grade: "MISS", timestampMs: 300, value: 0},
    ],
  );
  // 申告attemptsは1だが、eventsは3件あるので3に矯正される
  assert.equal(result.HAND_STOP.attempts, 3);
  assert.equal(result.HAND_STOP.greatCount, 1);
  assert.equal(result.HAND_STOP.missCount, 2);
});

test("reconcileMetricsWithEvents: attemptsが実数より大きい申告はそのまま維持する", () => {
  const result = reconcileMetricsWithEvents(
    {HAND_STOP: {attempts: 10, greatCount: 0, goodCount: 0, missCount: 0}},
    [{ruleId: "HAND_STOP", grade: "GREAT", timestampMs: 100, value: 1}],
  );
  assert.equal(result.HAND_STOP.attempts, 10);
  assert.equal(result.HAND_STOP.greatCount, 1);
});

test("reconcileMetricsWithEvents: holdRatio/meanValueなど他フィールドは維持する", () => {
  const result = reconcileMetricsWithEvents(
    {
      HIP_LOW: {
        attempts: 1,
        greatCount: 1,
        goodCount: 0,
        missCount: 0,
        holdRatio: 0.9,
        meanValue: 0.5,
      },
    },
    [],
  );
  // holdRatio/meanValueはeventsから再現できないため対象外(既知の制約)
  assert.equal(result.HIP_LOW.holdRatio, 0.9);
  assert.equal(result.HIP_LOW.meanValue, 0.5);
  // greatCountはeventsに無いので0に矯正される
  assert.equal(result.HIP_LOW.greatCount, 0);
});

test("assertPlausibleEventTimestamps: durationMs+猶予内なら通す", () => {
  assert.doesNotThrow(() =>
    assertPlausibleEventTimestamps(
      [{ruleId: "HAND_STOP", grade: "GREAT", timestampMs: 9000, value: 1}],
      10000,
    ),
  );
});

test("assertPlausibleEventTimestamps: 負のtimestampMsは拒否する", () => {
  assert.throws(() =>
    assertPlausibleEventTimestamps(
      [{ruleId: "HAND_STOP", grade: "GREAT", timestampMs: -1, value: 1}],
      10000,
    ),
  );
});

test("assertPlausibleEventTimestamps: durationMsを猶予を超えて上回るtimestampMsは拒否する", () => {
  assert.throws(() =>
    assertPlausibleEventTimestamps(
      [{ruleId: "HAND_STOP", grade: "GREAT", timestampMs: 20000, value: 1}],
      10000, // 猶予3000msを超えて大きく超過
    ),
  );
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { RuleEvaluator, createEvaluators, metricKey } from "./ruleEngine";
import { MetricValues, RuleDefinition, RuleEvent } from "./types";

const HAND_RULE: RuleDefinition = {
  ruleId: "HAND_ABOVE_HEAD",
  name: "手の高さ",
  metric: "normalizedHandHeight",
  minValue: 0.05,
  idealMinValue: 0.12,
  holdDurationMs: 200,
  cooldownMs: 1000,
  missAfterMs: 3000,
  improveMessage: "手を上げよう",
  enabled: true,
  version: "v1",
};

/** 一定値を dt 間隔で n フレーム流し、発火イベントを集める */
function feed(ev: RuleEvaluator, values: (number | null)[], dtMs = 33, key = "normalizedHandHeight"): RuleEvent[] {
  const events: RuleEvent[] = [];
  values.forEach((v, i) => {
    const e = ev.evaluate({ [key]: v } as MetricValues, i * dtMs);
    if (e) events.push(e);
  });
  return events;
}

test("閾値を超えた値が hold 時間続くと GOOD を 1 回発火する", () => {
  const ev = new RuleEvaluator(HAND_RULE);
  const events = feed(ev, new Array(20).fill(0.08)); // 0〜627ms
  assert.equal(events.length, 1);
  assert.equal(events[0].grade, "GOOD");
  assert.equal(events[0].ruleId, "HAND_ABOVE_HEAD");
});

test("理想範囲なら GREAT、最低基準なら GOOD を区別する", () => {
  const great = feed(new RuleEvaluator(HAND_RULE), new Array(20).fill(0.15));
  const good = feed(new RuleEvaluator(HAND_RULE), new Array(20).fill(0.08));
  assert.equal(great[0]?.grade, "GREAT");
  assert.equal(good[0]?.grade, "GOOD");
});

test("境界値: 閾値の直下では発火せず、直上では発火する", () => {
  assert.equal(feed(new RuleEvaluator(HAND_RULE), new Array(30).fill(0.049)).filter((e) => e.grade !== "MISS").length, 0);
  assert.equal(feed(new RuleEvaluator(HAND_RULE), new Array(30).fill(0.051)).length, 1);
});

test("境界値: hold の直前では発火せず、hold 到達で発火する", () => {
  const ev = new RuleEvaluator(HAND_RULE);
  assert.equal(ev.evaluate({ normalizedHandHeight: 0.1 }, 0), null); // HOLDING 開始
  assert.equal(ev.evaluate({ normalizedHandHeight: 0.1 }, 199), null);
  assert.equal(ev.progress(199) < 1, true);
  const fired = ev.evaluate({ normalizedHandHeight: 0.1 }, 200);
  assert.ok(fired && fired.grade === "GOOD");
});

test("progress は HOLDING 中に 0→1 へ進む", () => {
  const ev = new RuleEvaluator(HAND_RULE);
  ev.evaluate({ normalizedHandHeight: 0.1 }, 0);
  assert.ok(Math.abs(ev.progress(100) - 0.5) < 1e-9);
  assert.equal(ev.progress(-1), 0);
});

test("指標が null(全身が映っていない)なら NOT_READY で誤加点しない", () => {
  const ev = new RuleEvaluator(HAND_RULE);
  const events = feed(ev, new Array(60).fill(null));
  assert.equal(events.length, 0);
  assert.equal(ev.currentState, "NOT_READY");
});

test("ノイズで閾値をまたいでもヒステリシスでチャタリングしない", () => {
  // 0.05 の直上 0.055 を中心に ±0.004 で振れる → 解除ライン 0.045 は割らない
  const ev = new RuleEvaluator(HAND_RULE);
  const values = Array.from({ length: 90 }, (_, i) => 0.055 + 0.004 * Math.sin(i * 1.7));
  const events = feed(ev, values); // 約 3 秒
  const successes = events.filter((e) => e.grade !== "MISS");
  // cooldown 1000ms なので 3 秒で最大 3 回。反転が起きていれば 0 回になる
  assert.ok(successes.length >= 2 && successes.length <= 3, `fired ${successes.length}`);
  assert.equal(events.filter((e) => e.grade === "MISS").length, 0);
});

test("条件を大きく外れれば HOLDING は解除される", () => {
  const ev = new RuleEvaluator(HAND_RULE);
  ev.evaluate({ normalizedHandHeight: 0.1 }, 0);
  assert.equal(ev.currentState, "HOLDING");
  ev.evaluate({ normalizedHandHeight: 0.0 }, 33);
  assert.equal(ev.currentState, "READY");
});

test("条件未成立が missAfterMs 続くと MISS と改善メッセージを返す", () => {
  const ev = new RuleEvaluator(HAND_RULE);
  const events = feed(ev, new Array(120).fill(-0.2), 33); // 約 4 秒
  const misses = events.filter((e) => e.grade === "MISS");
  assert.equal(misses.length, 1);
  assert.equal(misses[0].message, "手を上げよう");
});

test("発火後は cooldown の間、再発火しない", () => {
  const ev = new RuleEvaluator(HAND_RULE);
  const events = feed(ev, new Array(60).fill(0.1), 33); // 約 2 秒
  const successes = events.filter((e) => e.grade !== "MISS");
  // 200ms で 1 回目、cooldown 1000ms 後に HOLDING 再開 → 約 1400ms で 2 回目
  assert.equal(successes.length, 2);
});

test("複合条件(RULE-03): 腰と膝の両方が成立しないと発火しない", () => {
  const hip: RuleDefinition = {
    ruleId: "HIP_LOW",
    name: "腰",
    metric: "normalizedHipHeight",
    maxValue: 0.55,
    idealMaxValue: 0.48,
    conditions: [{ metric: "kneeAngleDeg", maxValue: 160, idealMaxValue: 145 }],
    holdDurationMs: 500,
    missAfterMs: 0,
    enabled: true,
    version: "v1",
  };
  const run = (hipV: number, knee: number) => {
    const ev = new RuleEvaluator(hip);
    const out: RuleEvent[] = [];
    for (let i = 0; i < 30; i++) {
      const e = ev.evaluate({ normalizedHipHeight: hipV, kneeAngleDeg: knee }, i * 33);
      if (e) out.push(e);
    }
    return out;
  };
  assert.equal(run(0.5, 170).length, 0, "膝が伸びていれば不成立");
  assert.equal(run(0.6, 150).length, 0, "腰が高ければ不成立");
  assert.equal(run(0.5, 150)[0]?.grade, "GOOD");
  assert.equal(run(0.45, 140)[0]?.grade, "GREAT");
});

test("createEvaluators: side='both' は左右 2 つに展開し、無効・別の踊り種別は除く", () => {
  const defs: RuleDefinition[] = [
    { ...HAND_RULE, side: "both" },
    { ...HAND_RULE, ruleId: "DISABLED", enabled: false },
    { ...HAND_RULE, ruleId: "FEMALE_ONLY", danceType: "female" },
    { ...HAND_RULE, ruleId: "ALL", danceType: "all" },
  ];
  const evs = createEvaluators(defs, "male");
  assert.deepEqual(
    evs.map((e) => `${e.ruleId}:${e.side ?? "-"}`),
    ["HAND_ABOVE_HEAD:left", "HAND_ABOVE_HEAD:right", "ALL:-"]
  );
});

test("左右別の評価器は自分の側の指標だけを見る", () => {
  const left = new RuleEvaluator({ ...HAND_RULE, side: "both" }, "left");
  const right = new RuleEvaluator({ ...HAND_RULE, side: "both" }, "right");
  const values: MetricValues = { "normalizedHandHeight:left": 0.2, "normalizedHandHeight:right": -0.3 };
  let l: RuleEvent | null = null;
  let r: RuleEvent | null = null;
  for (let i = 0; i < 20; i++) {
    l = left.evaluate(values, i * 33) ?? l;
    r = right.evaluate(values, i * 33) ?? r;
  }
  assert.equal(l?.grade, "GREAT");
  assert.equal(l?.side, "left");
  assert.equal(r, null);
  assert.equal(metricKey("normalizedHandHeight", "right"), "normalizedHandHeight:right");
  assert.equal(metricKey("normalizedHipHeight", "right"), "normalizedHipHeight");
});

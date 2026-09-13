/**
 * フィクスチャ JSON を Rule Engine 全体に流す統合テスト(仕様書 15.1)。
 * 姿勢系列 → 前処理 → 指標 → 状態機械 → イベント、の縦の導線を実機なしで確認する。
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { PoseSmoother } from "../pose/preprocess";
import { DEFAULT_RULE_SET, frameRules } from "./definitions";
import { MetricsTracker } from "./metrics";
import { createEvaluators } from "./ruleEngine";
import { SessionAggregator } from "./session";
import { applyGrade, initialGameScore } from "./gameScore";
import { RuleEvent } from "./types";
import { loadFixture } from "./__fixtures__/load";
import { PoseFrame } from "../pose/types";

function run(frames: PoseFrame[]) {
  const smoother = new PoseSmoother();
  const evaluators = createEvaluators(frameRules(DEFAULT_RULE_SET), "male");
  const session = new SessionAggregator(DEFAULT_RULE_SET.version);
  let game = initialGameScore();
  const events: RuleEvent[] = [];
  const tracker = new MetricsTracker();
  for (const raw of frames) {
    const f = smoother.apply(raw);
    const values = tracker.update(f);
    for (const ev of evaluators) {
      const e = ev.evaluate(values, f.timestampMs);
      if (e) {
        events.push(e);
        session.addEvent(e);
        game = applyGrade(game, e.grade);
      }
    }
    const hip = SessionAggregator.hipLowInRange(values);
    session.trackHold("HIP_LOW", hip.value, hip.inRange, f.timestampMs);
    session.endFrame(f.timestampMs);
  }
  return { events, session, game };
}

const byRule = (events: RuleEvent[], ruleId: string) => events.filter((e) => e.ruleId === ruleId);

test("基本の構え: 手・腰・姿勢のルールが成功し、MISS は出ない", () => {
  const { events, game } = run(loadFixture("basic_form"));
  for (const id of ["HAND_ABOVE_HEAD", "HAND_KEEP", "HIP_LOW", "HAND_POSITION", "BASE_POSTURE"]) {
    const ok = byRule(events, id).filter((e) => e.grade !== "MISS");
    assert.ok(ok.length > 0, `${id} が成功していない`);
  }
  assert.equal(events.filter((e) => e.grade === "MISS").length, 0);
  assert.ok(game.score > 0);
  // 手の高さ 0.15 は理想範囲(0.12)なので GREAT
  assert.equal(byRule(events, "HAND_ABOVE_HEAD")[0].grade, "GREAT");
});

test("棒立ち・手下げ: 成功は出ず(静止を「手を止めた」と誤判定しない)、時間経過で MISS と改善メッセージが出る", () => {
  const { events } = run(loadFixture("standing")); // 5 秒
  assert.equal(events.filter((e) => e.grade !== "MISS").length, 0, JSON.stringify(events.filter((e) => e.grade !== "MISS").map((e) => e.ruleId)));
  const misses = events.filter((e) => e.grade === "MISS");
  assert.ok(misses.some((e) => e.ruleId === "HAND_ABOVE_HEAD" && e.message === "手を上げよう。頭の上まで"));
  assert.ok(misses.some((e) => e.ruleId === "HIP_LOW"));
});

test("手だけ上げている: 手のルールは成功、腰のルールは成功しない", () => {
  const { events, session } = run(loadFixture("hands_up_only"));
  assert.ok(byRule(events, "HAND_ABOVE_HEAD").some((e) => e.grade !== "MISS"));
  assert.equal(byRule(events, "HIP_LOW").filter((e) => e.grade !== "MISS").length, 0);
  const payload = session.build({ videoId: "v", clientRequestId: "c", danceType: "male", scorePart: "whole", game: initialGameScore() });
  assert.ok((payload.metrics.HIP_LOW?.holdRatio ?? 1) < 0.01, "腰の保持率はほぼ 0");
});

test("鏡像でも同じルールが同じ回数成功する(左右一貫性)", () => {
  const a = run(loadFixture("basic_form")).events.filter((e) => e.grade !== "MISS");
  const b = run(loadFixture("basic_form_mirror")).events.filter((e) => e.grade !== "MISS");
  const count = (evs: RuleEvent[]) => {
    const m = new Map<string, number>();
    for (const e of evs) m.set(e.ruleId, (m.get(e.ruleId) ?? 0) + 1);
    return [...m.entries()].sort();
  };
  assert.deepEqual(count(a), count(b));
});

test("足首が見えていないと全ルールが NOT_READY で何も発火しない", () => {
  const { events } = run(loadFixture("ankles_hidden"));
  assert.equal(events.length, 0);
});

test("閾値付近で揺れる手でも GOOD/MISS が連続反転しない", () => {
  const { events } = run(loadFixture("hand_chatter"));
  const hand = byRule(events, "HAND_ABOVE_HEAD");
  // 5 秒間・cooldown 1.5 秒・左右 2 評価器 → 成功は最大 8 回。反転していれば激減するか MISS が混ざる
  const successes = hand.filter((e) => e.grade !== "MISS").length;
  assert.ok(successes >= 4 && successes <= 8, `successes=${successes}`);
  assert.equal(hand.filter((e) => e.grade === "MISS").length, 0);
});

test("セッション集計: ルール別の回数・保持率・durationMs が payload に入る", () => {
  const { session, game } = run(loadFixture("basic_form"));
  const payload = session.build({ videoId: "vid", clientRequestId: "req-1", danceType: "male", scorePart: "whole", game });
  assert.equal(payload.analysisVersion, DEFAULT_RULE_SET.version);
  assert.ok(payload.metrics.HAND_ABOVE_HEAD.greatCount + payload.metrics.HAND_ABOVE_HEAD.goodCount > 0);
  assert.ok(payload.metrics.HIP_LOW.holdRatio! > 0.9, `holdRatio ${payload.metrics.HIP_LOW.holdRatio}`);
  assert.ok(payload.durationMs >= 2900 && payload.durationMs <= 3000, `duration ${payload.durationMs}`);
  assert.equal(payload.gameScore, game.score);
  assert.ok(!("totalScore" in payload), "クライアントは totalScore を送らない");
});

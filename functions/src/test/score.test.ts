/** FN-01 のスコア算出(functions/src/analysis/score.ts)のテスト */
import * as assert from "node:assert/strict";
import {test} from "node:test";
import {
  computeAnalysisScore,
  holdScore,
  rhythmScore,
  successScore,
} from "../analysis/score";

test("成功率型: GREAT は 1.0、GOOD は 0.7 の重みで attempts で割る", () => {
  assert.equal(
    successScore({attempts: 10, greatCount: 5, goodCount: 5, missCount: 0}),
    85,
  );
  assert.equal(
    successScore({attempts: 4, greatCount: 0, goodCount: 0, missCount: 4}),
    0,
  );
  assert.equal(
    successScore({attempts: 0, greatCount: 0, goodCount: 0, missCount: 0}),
    undefined,
  );
  assert.equal(successScore(undefined), undefined);
});

test("維持率型: holdRatio があればそれを、無ければ成功率へ落とす", () => {
  assert.equal(
    holdScore({
      attempts: 0,
      greatCount: 0,
      goodCount: 0,
      missCount: 0,
      holdRatio: 0.8,
    }),
    80,
  );
  assert.equal(
    holdScore({attempts: 2, greatCount: 2, goodCount: 0, missCount: 0}),
    100,
  );
});

test("リズム: 誤差 0 で 100、許容 15% で 0、その間は線形", () => {
  assert.equal(rhythmScore({userBpm: 112, baseBpm: 112}), 100);
  assert.ok(Math.abs(rhythmScore({userBpm: 112 * 1.15, baseBpm: 112})!) < 1e-6);
  const half = rhythmScore({userBpm: 112 * 1.075, baseBpm: 112})!;
  assert.ok(Math.abs(half - 50) < 1e-6, `${half}`);
  assert.equal(rhythmScore(undefined), undefined);
  assert.equal(rhythmScore({userBpm: 100, baseBpm: 0}), undefined);
});

test("総合は 4 項目(手・腰・停止・リズム)のうち存在する項目の単純平均", () => {
  const r = computeAnalysisScore(
    {
      HAND_ABOVE_HEAD: {
        attempts: 10,
        greatCount: 10,
        goodCount: 0,
        missCount: 0,
      }, // 100
      HIP_LOW: {
        attempts: 0,
        greatCount: 0,
        goodCount: 0,
        missCount: 0,
        holdRatio: 0.5,
      }, // 50
    },
    undefined, // リズム無し → 項目から除外
  );
  assert.equal(r.scores.handHeightScore, 100);
  assert.equal(r.scores.hipHeightScore, 50);
  assert.equal(r.scores.stopScore, undefined);
  assert.equal(r.totalScore, 75);
});

test("手の高さは RULE-01 と RULE-02 を合算して評価する", () => {
  const r = computeAnalysisScore({
    HAND_ABOVE_HEAD: {attempts: 2, greatCount: 2, goodCount: 0, missCount: 0},
    HAND_KEEP: {attempts: 2, greatCount: 0, goodCount: 0, missCount: 2},
  });
  assert.equal(r.scores.handHeightScore, 50);
});

test("フィードバックは 70 点未満を improve、以上を good にし、improve を先に並べる", () => {
  const r = computeAnalysisScore(
    {
      HAND_ABOVE_HEAD: {
        attempts: 10,
        greatCount: 10,
        goodCount: 0,
        missCount: 0,
      },
      HIP_LOW: {
        attempts: 0,
        greatCount: 0,
        goodCount: 0,
        missCount: 0,
        holdRatio: 0.3,
      },
    },
    {userBpm: 112, baseBpm: 112},
  );
  assert.equal(r.feedback[0].type, "improve");
  assert.equal(r.feedback[0].ruleId, "HIP_LOW");
  assert.ok(
    r.feedback.some((f) => f.type === "good" && f.ruleId === "HAND_ABOVE_HEAD"),
  );
  assert.ok(r.feedback.some((f) => f.type === "good" && f.ruleId === "RHYTHM"));
});

test("項目が 1 つも無ければ総合 0 でフィードバックも空", () => {
  const r = computeAnalysisScore({});
  assert.equal(r.totalScore, 0);
  assert.deepEqual(r.feedback, []);
});

test("スコアは 0〜100 に収まる", () => {
  const r = computeAnalysisScore({
    HIP_LOW: {
      attempts: 0,
      greatCount: 0,
      goodCount: 0,
      missCount: 0,
      holdRatio: 1.7,
    },
  });
  assert.equal(r.scores.hipHeightScore, 100);
});

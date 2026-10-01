import assert from "node:assert/strict";
import { test } from "node:test";
import { computePracticeStreak } from "./streak";

const NOW = new Date(2026, 8, 30, 12, 0, 0); // 2026-09-30 正午
function daysAgo(n: number): Date {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n);
  d.setHours(9, 0, 0, 0);
  return d;
}

test("稽古記録が無ければ0", () => {
  assert.equal(computePracticeStreak([], NOW), 0);
  assert.equal(computePracticeStreak([null, undefined], NOW), 0);
});

test("今日だけ稽古していれば1", () => {
  assert.equal(computePracticeStreak([daysAgo(0)], NOW), 1);
});

test("今日・昨日・一昨日と連続していれば3", () => {
  assert.equal(computePracticeStreak([daysAgo(0), daysAgo(1), daysAgo(2)], NOW), 3);
});

test("同じ日に複数回稽古しても1日分として数える", () => {
  const today1 = daysAgo(0);
  const today2 = new Date(today1.getTime() + 60 * 60 * 1000);
  assert.equal(computePracticeStreak([today1, today2, daysAgo(1)], NOW), 2);
});

test("今日はまだ稽古していないが昨日までは連続していれば、今日時点でもその日数を保つ", () => {
  assert.equal(computePracticeStreak([daysAgo(1), daysAgo(2)], NOW), 2);
});

test("直近の稽古が2日以上前なら記録は途切れている(0)", () => {
  assert.equal(computePracticeStreak([daysAgo(2), daysAgo(3)], NOW), 0);
});

test("途中で歯抜けになっている日より前は数えない", () => {
  // 今日・昨日は連続だが、3日前は歯抜け(一昨日が無い)なので2で止まる
  assert.equal(computePracticeStreak([daysAgo(0), daysAgo(1), daysAgo(3)], NOW), 2);
});

test("順序が不規則でも結果は変わらない", () => {
  assert.equal(computePracticeStreak([daysAgo(2), daysAgo(0), daysAgo(1)], NOW), 3);
});

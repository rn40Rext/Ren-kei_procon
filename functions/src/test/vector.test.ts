/** Embedding のベクトル演算のテスト */
import * as assert from "node:assert/strict";
import {test} from "node:test";
import {cosineSimilarity, l2Normalize, meanEmbedding} from "../style/vector";

const norm = (v: number[]) => Math.sqrt(v.reduce((a, b) => a + b * b, 0));

test("l2Normalize はノルム 1 にする", () => {
  assert.ok(Math.abs(norm(l2Normalize([3, 4])) - 1) < 1e-12);
});

test("l2Normalize はゼロベクトルで壊れない", () => {
  assert.deepEqual(l2Normalize([0, 0]), [0, 0]);
});

test("cosineSimilarity は同一方向で 1、逆向きで -1", () => {
  assert.ok(Math.abs(cosineSimilarity([1, 2], [2, 4]) - 1) < 1e-12);
  assert.ok(Math.abs(cosineSimilarity([1, 0], [-1, 0]) + 1) < 1e-12);
});

test("cosineSimilarity は次元不一致を検出する", () => {
  assert.throws(() => cosineSimilarity([1, 2], [1, 2, 3]), /dimension/);
});

test("meanEmbedding は L2 正規化された代表を返す", () => {
  const r = meanEmbedding([[1, 0], [0, 1]]);
  assert.ok(Math.abs(norm(r) - 1) < 1e-12);
});

test("meanEmbedding はノルムの大きいサンプルに支配されない", () => {
  // 正規化しないで平均すると [100, 0] 側へ寄ってしまう
  const r = meanEmbedding([[100, 0], [0, 1]]);
  assert.ok(Math.abs(r[0] - r[1]) < 1e-9, JSON.stringify(r));
});

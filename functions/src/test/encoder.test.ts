/**
 * ベースライン Embedding の不変性テスト（仕様書 8.6 の 2・3・4）。
 *
 * 合成データでの確認であり、実撮影データによる検証（項目 1・5・6・7）
 * の代わりにはならない。
 */
import * as assert from "node:assert/strict";
import {test} from "node:test";
import {
  STYLE_EMBEDDING_DIM,
  encodeStyleEmbedding,
} from "../style/encoder";
import {cosineSimilarity} from "../style/vector";
import {STYLE_A, STYLE_B, makeSeries} from "./fixtures";

const encode = (series: ReturnType<typeof makeSeries>) =>
  encodeStyleEmbedding(series).vector;

test("Embedding は 32 次元で L2 正規化されている", () => {
  const v = encode(makeSeries(STYLE_A));
  assert.equal(v.length, STYLE_EMBEDDING_DIM);
  const norm = Math.sqrt(v.reduce((a, b) => a + b * b, 0));
  assert.ok(Math.abs(norm - 1) < 1e-9, `norm=${norm}`);
});

test("同じ入力からは常に同じ Embedding が出る", () => {
  const series = makeSeries(STYLE_A, {seed: 7, noise: 0.01});
  assert.deepEqual(encode(series), encode(series));
});

test("検証2: 撮影距離が変わっても類似度がほぼ 1", () => {
  const near = encode(makeSeries(STYLE_A, {scale: 1.0}));
  const far = encode(makeSeries(STYLE_A, {scale: 0.55, offsetY: 0.3}));
  const sim = cosineSimilarity(near, far);
  assert.ok(sim > 0.999, `similarity=${sim}`);
});

test("検証3: 左右反転で類似度差が 0.05 以内", () => {
  const normal = encode(makeSeries(STYLE_A));
  const mirrored = encode(makeSeries(STYLE_A, {mirror: true}));
  const sim = cosineSimilarity(normal, mirrored);
  assert.ok(1 - sim <= 0.05, `similarity=${sim}`);
});

test("検証4: 再生速度 ±20% で類似度がほぼ変わらない", () => {
  const base = encode(makeSeries(STYLE_A));
  const fast = encode(makeSeries(STYLE_A, {speed: 1.2}));
  const slow = encode(makeSeries(STYLE_A, {speed: 0.8}));
  const simFast = cosineSimilarity(base, fast);
  const simSlow = cosineSimilarity(base, slow);
  assert.ok(1 - simFast <= 0.05, `fast=${simFast}`);
  assert.ok(1 - simSlow <= 0.05, `slow=${simSlow}`);
});

test("検証5(合成): 同一スタイルの別テイク > 別スタイル", () => {
  const a1 = encode(makeSeries(STYLE_A, {seed: 1, noise: 0.02}));
  const a2 = encode(
    makeSeries(STYLE_A, {seed: 2, noise: 0.02, phase: 1.1, scale: 0.9}),
  );
  const b1 = encode(makeSeries(STYLE_B, {seed: 3, noise: 0.02}));
  const withinStyle = cosineSimilarity(a1, a2);
  const betweenStyle = cosineSimilarity(a1, b1);
  assert.ok(
    withinStyle > betweenStyle,
    `within=${withinStyle} between=${betweenStyle}`,
  );
});

test("検証4+2の複合: 撮影条件が違っても順位が入れ替わらない", () => {
  const profileA = encode(makeSeries(STYLE_A, {seed: 11, noise: 0.015}));
  const profileB = encode(makeSeries(STYLE_B, {seed: 12, noise: 0.015}));
  const user = encode(
    makeSeries(STYLE_B, {
      seed: 13,
      noise: 0.02,
      scale: 0.7,
      speed: 1.15,
      mirror: true,
      phase: 0.6,
    }),
  );
  const simA = cosineSimilarity(user, profileA);
  const simB = cosineSimilarity(user, profileB);
  assert.ok(simB > simA, `simA=${simA} simB=${simB}`);
});

test("有効フレームが少なすぎるときは例外", () => {
  const short = makeSeries(STYLE_A, {frames: 10});
  assert.throws(() => encodeStyleEmbedding(short), /usable frames/);
});

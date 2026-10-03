import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_RULE_SET } from "./definitions";
import { MIN_RHYTHM_STRENGTH, RhythmAnalyzer, Sample, analyzeRhythm, estimateFrequency, pickBpmCandidate, rhythmScore } from "./rhythm";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hipCenterY } from "../pose/normalize";
import { loadFixture } from "./__fixtures__/load";

const cfg = DEFAULT_RULE_SET.rhythm;

function bobSamples(bpm: number, seconds: number, fps = 30, noise = 0): Sample[] {
  const out: Sample[] = [];
  for (let i = 0; i < seconds * fps; i++) {
    const t = (i * 1000) / fps;
    const y = 0.5 + 0.03 * Math.sin(2 * Math.PI * (bpm / 60) * (t / 1000)) + (noise ? noise * Math.sin(i * 12.9898) : 0);
    out.push({ t, y });
  }
  return out;
}

test("一定 BPM で腰を上下させた合成データから BPM を推定できる(±3 BPM)", () => {
  for (const bpm of [90, 112, 130]) {
    const est = analyzeRhythm(bobSamples(bpm, 8), { ...cfg, baseBpm: bpm });
    assert.ok(est.userBpm !== null, `bpm=${bpm} not estimated`);
    assert.ok(Math.abs(est.userBpm! - bpm) <= 3, `bpm=${bpm} got ${est.userBpm}`);
    assert.ok(est.score! >= 90, `score ${est.score}`);
    assert.equal(est.grade, "GREAT");
  }
});

test("基準とずれたテンポは誤差に応じて減点され、許容を超えると 0 点", () => {
  assert.ok(Math.abs(rhythmScore(112, 112, 0.15) - 100) < 1e-9);
  assert.ok(Math.abs(rhythmScore(120.4, 112, 0.15) - 50) < 1);
  assert.equal(rhythmScore(140, 112, 0.15), 0);
});

test("1/2 倍・2 倍の周波数を候補にして基準に近いものを採る(2 拍子対応)", () => {
  assert.equal(pickBpmCandidate(56, 112), 112);
  assert.equal(pickBpmCandidate(224, 112), 112);
  assert.equal(pickBpmCandidate(100, 112), 100);
  // 腰が 2 拍に 1 回しか沈まない踊り方(56 BPM の上下動)でも 112 として評価される
  const est = analyzeRhythm(bobSamples(56, 8), cfg);
  assert.ok(est.userBpm !== null && Math.abs(est.userBpm - 112) <= 3, `got ${est.userBpm}`);
});

test("ウィンドウが短すぎる・上下動が無いときは推定しない", () => {
  assert.equal(analyzeRhythm(bobSamples(112, 2), cfg).userBpm, null);
  const flat = bobSamples(112, 8).map((s) => ({ t: s.t, y: 0.5 }));
  assert.equal(analyzeRhythm(flat, cfg).userBpm, null);
});

test("RhythmAnalyzer: フィクスチャ(112 BPM の上下動)を流すと基準どおりに推定する", () => {
  const frames = loadFixture("rhythm_112bpm");
  const analyzer = new RhythmAnalyzer(cfg, 1000);
  let last = null;
  for (const f of frames) {
    analyzer.push(f.timestampMs, hipCenterY(f));
    const est = analyzer.tick(f.timestampMs);
    if (est && est.userBpm !== null) last = est;
  }
  assert.ok(last !== null, "no estimate");
  assert.ok(Math.abs(last!.userBpm! - 112) <= 3, `got ${last!.userBpm}`);
  assert.equal(last!.grade, "GREAT");
});

// ---- 回帰テスト: 「BPM が常に 129 に固定される」「静止していても採点される」 ----

/** 再現性のある乱数(線形合同法)。 */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** 静止中の検出ジッタ相当: 白色ノイズを PoseSmoother と同じ時定数(80ms)の EMA で平滑した腰 y。 */
function stillJitter(seed: number, amp = 0.004, fps = 22, seconds = 8): Sample[] {
  const rnd = lcg(seed);
  const alpha = 1 - Math.exp(-1000 / fps / 80);
  let y = 0.69;
  const out: Sample[] = [];
  for (let i = 0; i < seconds * fps; i++) {
    y += (0.69 + (rnd() - 0.5) * 2 * amp - y) * alpha;
    out.push({ t: (i * 1000) / fps, y });
  }
  return out;
}

test("探索範囲の端(最小ラグ)は周期のピークとして採用しない: 単調に減衰する自己相関では推定しない", () => {
  const n = 240;
  const step = 1000 / 30;
  const ramp = Array.from({ length: n }, (_, i) => 0.5 + 0.0002 * i); // 一方向にドリフト
  const expo = Array.from({ length: n }, (_, i) => 0.5 + 0.05 * Math.exp(-i / 60));
  for (const values of [ramp, expo]) {
    const { frequencyHz } = estimateFrequency(values, step, 0.5, 4);
    assert.equal(frequencyHz, null);
  }
});

test("ドリフト・ランダムウォークでは BPM を出さない(以前は常に約 129 になっていた)", () => {
  const drift: Sample[] = Array.from({ length: 22 * 8 }, (_, i) => ({ t: (i * 1000) / 22, y: 0.68 + 0.00003 * i }));
  assert.equal(analyzeRhythm(drift, cfg).userBpm, null);
  for (let seed = 1; seed <= 10; seed++) {
    const rnd = lcg(seed);
    let y = 0.69;
    const walk: Sample[] = Array.from({ length: 22 * 8 }, (_, i) => ({ t: (i * 1000) / 22, y: (y += (rnd() - 0.5) * 0.002) }));
    assert.equal(analyzeRhythm(walk, cfg).userBpm, null, `random walk seed=${seed}`);
  }
});

test("静止中のジッタでは採点しない(周期性が弱いので userBpm=null、GREAT/GOOD も付かない)", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const est = analyzeRhythm(stillJitter(seed), cfg);
    assert.equal(est.userBpm, null, `seed=${seed} strength=${est.strength.toFixed(2)}`);
    assert.equal(est.grade, null);
  }
});

test("実機で完全に静止して撮った腰 y(固定フィクスチャ)では採点しない", () => {
  const raw = JSON.parse(readFileSync(join(__dirname, "__fixtures__", "standing_real_hipy.json"), "utf-8")) as {
    samples: [number, number][];
  };
  const samples: Sample[] = raw.samples.map(([t, y]) => ({ t, y }));
  const est = analyzeRhythm(samples, cfg);
  assert.equal(est.userBpm, null);
  assert.equal(est.grade, null);
});

test("本物の周期的な上下動は、強さのゲートを十分に超えて推定される", () => {
  for (const bpm of [90, 112, 130]) {
    const est = analyzeRhythm(bobSamples(bpm, 8, 22, 0.002), { ...cfg, baseBpm: bpm });
    assert.ok(est.userBpm !== null, `bpm=${bpm}`);
    assert.ok(est.strength > MIN_RHYTHM_STRENGTH + 0.2, `strength ${est.strength}`);
  }
});

test("cfg.minStrength でゲートを上書きできる(1 にすると周期的な入力でも推定しない)", () => {
  assert.equal(analyzeRhythm(bobSamples(112, 8), { ...cfg, minStrength: 1.01 }).userBpm, null);
  assert.ok(analyzeRhythm(bobSamples(112, 8), { ...cfg, minStrength: 0.1 }).userBpm !== null);
});

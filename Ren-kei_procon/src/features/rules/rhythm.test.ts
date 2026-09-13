import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_RULE_SET } from "./definitions";
import { RhythmAnalyzer, Sample, analyzeRhythm, pickBpmCandidate, rhythmScore } from "./rhythm";
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

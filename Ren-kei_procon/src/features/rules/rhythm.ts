/**
 * RULE-07 リズム判定(仕様書 7.8 / docs/design/ai-basic-motion.md 8章 / #19)。
 *
 * 腰中心 y の時系列を移動平均で平滑化し、直近ウィンドウの自己相関から
 * 主周期を求めて BPM に変換する。FFT ではなく自己相関を使うのは、
 * 短いウィンドウ(4〜8 秒)でも周期を細かく分解できるため
 * (FFT の分解能 Δf = 1/T は 8 秒で 7.5 BPM 刻みにしかならない)。
 *
 * 阿波踊りは 2 拍子で、腰の上下動は 1 拍ごと・2 拍ごとのどちらにも現れる。
 * 主周期の 1/2・2 倍も候補にして、基準 BPM との誤差が最小のものを採る。
 *
 * TBD-04(基準 BPM の決め方)の暫定決定: ユーザーが基準 BPM を選ぶ(案 B)。
 * 既定値はさゝゆり連の熟練者映像の実測 112 BPM。音源再生(案 A)は
 * 権利処理が要るため MVP では行わない。
 */
import { RhythmConfig } from "./definitions";
import { Grade } from "./types";

export type RhythmEstimate = {
  /** 推定 BPM。推定できなければ null */
  userBpm: number | null;
  baseBpm: number;
  /** |user - base| / base。null は推定不能 */
  errorRatio: number | null;
  /** 0〜100 */
  score: number | null;
  /** 周期性の強さ 0〜1(自己相関ピークの高さ) */
  strength: number;
  /** 解析に使ったウィンドウ長[ms] */
  windowMs: number;
  grade: Grade | null;
};

export type Sample = { t: number; y: number };

/** 移動平均(奇数窓)。両端は取れる範囲で平均する。 */
export function movingAverage(values: number[], window: number): number[] {
  const half = Math.floor(window / 2);
  const out = new Array<number>(values.length);
  for (let i = 0; i < values.length; i++) {
    let sum = 0;
    let n = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(values.length - 1, i + half); j++) {
      sum += values[j];
      n++;
    }
    out[i] = sum / n;
  }
  return out;
}

/** 不等間隔サンプルを等間隔に線形補間する。 */
export function resample(samples: Sample[], stepMs: number): number[] {
  if (samples.length < 2) return samples.map((s) => s.y);
  const t0 = samples[0].t;
  const t1 = samples[samples.length - 1].t;
  const out: number[] = [];
  let j = 0;
  for (let t = t0; t <= t1; t += stepMs) {
    while (j < samples.length - 2 && samples[j + 1].t < t) j++;
    const a = samples[j];
    const b = samples[j + 1];
    const span = b.t - a.t;
    const r = span <= 0 ? 0 : Math.min(1, Math.max(0, (t - a.t) / span));
    out.push(a.y + (b.y - a.y) * r);
  }
  return out;
}

/**
 * 自己相関で主周波数を推定する。
 * @returns frequencyHz(推定不能なら null)と strength(0〜1)
 */
export function estimateFrequency(
  values: number[],
  stepMs: number,
  minHz: number,
  maxHz: number
): { frequencyHz: number | null; strength: number } {
  const n = values.length;
  if (n < 8 || stepMs <= 0) return { frequencyHz: null, strength: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const centered = values.map((v) => v - mean);
  let energy = 0;
  for (const v of centered) energy += v * v;
  // 上下動が実質ゼロならノイズから偽の周期を拾わない
  if (energy / n < 1e-8) return { frequencyHz: null, strength: 0 };

  const minLag = Math.max(2, Math.floor(1000 / (maxHz * stepMs)));
  const maxLag = Math.min(n - 2, Math.ceil(1000 / (minHz * stepMs)));
  if (maxLag <= minLag) return { frequencyHz: null, strength: 0 };

  const scores = new Array<number>(maxLag + 1).fill(-Infinity);
  let globalBest = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let acc = 0;
    for (let i = 0; i + lag < n; i++) acc += centered[i] * centered[i + lag];
    // ラグが大きいほど重なる区間が短くなるので正規化する
    scores[lag] = acc / energy / ((n - lag) / n);
    if (scores[lag] > globalBest) globalBest = scores[lag];
  }
  if (globalBest <= 0.1) return { frequencyHz: null, strength: Math.max(0, globalBest) };
  // 周期の整数倍のラグにも同じ高さのピークが出る。基本周期(最小のラグ)を採るため、
  // 最大値の 85% 以上の高さを持つ最初の局所最大を選ぶ
  let bestLag = -1;
  for (let lag = minLag; lag <= maxLag; lag++) {
    const s = scores[lag];
    const left = lag > minLag ? scores[lag - 1] : -Infinity;
    const right = lag < maxLag ? scores[lag + 1] : -Infinity;
    if (s >= 0.85 * globalBest && s >= left && s >= right) {
      bestLag = lag;
      break;
    }
  }
  if (bestLag < 0) return { frequencyHz: null, strength: Math.max(0, globalBest) };
  const best = scores[bestLag];
  // ピーク近傍を放物線補間してラグの分解能を上げる
  let lag = bestLag;
  if (bestLag > minLag && bestLag < maxLag) {
    const at = (l: number) => {
      let acc = 0;
      for (let i = 0; i + l < n; i++) acc += centered[i] * centered[i + l];
      return acc / energy / ((n - l) / n);
    };
    const y0 = at(bestLag - 1);
    const y1 = best;
    const y2 = at(bestLag + 1);
    const denom = y0 - 2 * y1 + y2;
    if (Math.abs(denom) > 1e-12) lag = bestLag + (0.5 * (y0 - y2)) / denom;
  }
  return { frequencyHz: 1000 / (lag * stepMs), strength: Math.min(1, best) };
}

/** 1/2 倍・2 倍も候補にして、基準に最も近い BPM を選ぶ(2 拍子対応)。 */
export function pickBpmCandidate(rawBpm: number, baseBpm: number): number {
  const candidates = [rawBpm, rawBpm / 2, rawBpm * 2];
  let best = rawBpm;
  let bestErr = Infinity;
  for (const c of candidates) {
    const err = Math.abs(c - baseBpm);
    if (err < bestErr) {
      bestErr = err;
      best = c;
    }
  }
  return best;
}

/** rhythmScore = clamp(100 * (1 - |user - base| / base / TOLERANCE), 0, 100) */
export function rhythmScore(userBpm: number, baseBpm: number, toleranceRatio: number): number {
  const err = Math.abs(userBpm - baseBpm) / baseBpm;
  return Math.max(0, Math.min(100, 100 * (1 - err / toleranceRatio)));
}

export function rhythmGrade(errorRatio: number, goodMax = 0.15, greatMax = 0.07): Grade {
  if (errorRatio <= greatMax) return "GREAT";
  if (errorRatio <= goodMax) return "GOOD";
  return "MISS";
}

/** 等間隔サンプル列から一括で推定する(テスト・オフライン用)。 */
export function analyzeRhythm(
  samples: Sample[],
  cfg: RhythmConfig,
  stepMs = 1000 / 30
): RhythmEstimate {
  const windowMs = samples.length >= 2 ? samples[samples.length - 1].t - samples[0].t : 0;
  const empty: RhythmEstimate = {
    userBpm: null,
    baseBpm: cfg.baseBpm,
    errorRatio: null,
    score: null,
    strength: 0,
    windowMs,
    grade: null,
  };
  if (windowMs < cfg.minWindowMs) return empty;
  const uniform = movingAverage(resample(samples, stepMs), 5);
  // 2 拍に 1 回しか腰が沈まない踊り方(基準の 1/2 のテンポ)も拾えるよう、
  // 探索下限は bpmMin の半分まで下げる。倍・半分の補正は pickBpmCandidate が行う
  const { frequencyHz, strength } = estimateFrequency(uniform, stepMs, cfg.bpmMin / 60 / 2, cfg.bpmMax / 60);
  if (frequencyHz === null) return { ...empty, strength };
  const userBpm = pickBpmCandidate(frequencyHz * 60, cfg.baseBpm);
  const errorRatio = Math.abs(userBpm - cfg.baseBpm) / cfg.baseBpm;
  return {
    userBpm,
    baseBpm: cfg.baseBpm,
    errorRatio,
    score: rhythmScore(userBpm, cfg.baseBpm, cfg.toleranceRatio),
    strength,
    windowMs,
    grade: rhythmGrade(errorRatio, cfg.toleranceRatio, cfg.toleranceRatio / 2),
  };
}

/**
 * 実時間用。腰 y を毎フレーム push し、一定間隔で estimate() を呼ぶ。
 */
export class RhythmAnalyzer {
  private samples: Sample[] = [];
  private lastEstimateAt = -Infinity;
  private last: RhythmEstimate | null = null;

  constructor(private cfg: RhythmConfig, private readonly estimateIntervalMs = 1000) {}

  setConfig(cfg: RhythmConfig): void {
    this.cfg = cfg;
  }

  reset(): void {
    this.samples = [];
    this.lastEstimateAt = -Infinity;
    this.last = null;
  }

  push(timestampMs: number, hipY: number | null): void {
    if (hipY === null || !Number.isFinite(hipY)) return;
    this.samples.push({ t: timestampMs, y: hipY });
    const cutoff = timestampMs - this.cfg.windowMs;
    while (this.samples.length && this.samples[0].t < cutoff) this.samples.shift();
  }

  /** 推定間隔が来ていれば新しい推定を返す。それ以外は null。 */
  tick(timestampMs: number): RhythmEstimate | null {
    if (timestampMs - this.lastEstimateAt < this.estimateIntervalMs) return null;
    this.lastEstimateAt = timestampMs;
    this.last = analyzeRhythm(this.samples, this.cfg);
    return this.last;
  }

  get latest(): RhythmEstimate | null {
    return this.last;
  }
}

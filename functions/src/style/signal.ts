/**
 * 1 次元信号の統計。ベースライン特徴量エンコーダが使う。
 */

/**
 * 平均。
 * @param {number[]} xs 入力
 * @return {number} 平均値
 */
export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/**
 * 標準偏差（母集団版）。
 * @param {number[]} xs 入力
 * @return {number} 標準偏差
 */
export function std(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = xs.reduce((a, b) => a + (b - m) * (b - m), 0) / xs.length;
  return Math.sqrt(v);
}

/**
 * 最小値。空配列は 0。
 * @param {number[]} xs 入力
 * @return {number} 最小値
 */
export function min(xs: number[]): number {
  return xs.length === 0 ? 0 : Math.min(...xs);
}

/**
 * 最大値。空配列は 0。
 * @param {number[]} xs 入力
 * @return {number} 最大値
 */
export function max(xs: number[]): number {
  return xs.length === 0 ? 0 : Math.max(...xs);
}

/**
 * パーセンタイル（線形補間なしの単純版）。
 * @param {number[]} xs 入力
 * @param {number} p 0〜1
 * @return {number} パーセンタイル値
 */
export function percentile(xs: number[], p: number): number {
  if (xs.length === 0) return 0;
  const sorted = xs.slice().sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.round(p * (sorted.length - 1))),
  );
  return sorted[idx];
}

/**
 * ピアソン相関係数。分散が 0 のときは 0 を返す。
 * @param {number[]} xs 系列 X
 * @param {number[]} ys 系列 Y
 * @return {number} -1〜1
 */
export function correlation(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  const mx = mean(xs.slice(0, n));
  const my = mean(ys.slice(0, n));
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const denom = Math.sqrt(dx) * Math.sqrt(dy);
  return denom < 1e-12 ? 0 : num / denom;
}

/**
 * 不等間隔の時系列を等間隔へ線形補間する。
 * @param {number[]} timesMs 時刻（昇順）
 * @param {number[]} values 値
 * @param {number} stepMs 出力の刻み
 * @return {number[]} 等間隔にリサンプルした値
 */
export function resampleUniform(
  timesMs: number[],
  values: number[],
  stepMs: number,
): number[] {
  const n = Math.min(timesMs.length, values.length);
  if (n < 2 || stepMs <= 0) return values.slice(0, n);
  const t0 = timesMs[0];
  const t1 = timesMs[n - 1];
  const out: number[] = [];
  let j = 0;
  for (let t = t0; t <= t1; t += stepMs) {
    while (j < n - 2 && timesMs[j + 1] < t) j++;
    const span = timesMs[j + 1] - timesMs[j];
    const ratio = span <= 0 ? 0 : (t - timesMs[j]) / span;
    const clamped = Math.min(1, Math.max(0, ratio));
    out.push(values[j] + (values[j + 1] - values[j]) * clamped);
  }
  return out;
}

export type Periodicity = {
  /** 推定した基本周波数（Hz）。推定できなければ null */
  frequencyHz: number | null;
  /** 周期性の強さ 0〜1（自己相関ピークの高さ） */
  strength: number;
};

/**
 * 自己相関から周期性を推定する。
 *
 * 再生速度が変わると周波数も同じ比率で変わるため、速度不変にしたい
 * 特徴は「周波数そのもの」ではなく「周波数で割った量」を使う。
 * @param {number[]} values 等間隔の信号
 * @param {number} stepMs 刻み幅（ミリ秒）
 * @param {number} minHz 探索する下限周波数
 * @param {number} maxHz 探索する上限周波数
 * @return {Periodicity} 推定結果
 */
export function estimatePeriodicity(
  values: number[],
  stepMs: number,
  minHz = 0.4,
  maxHz = 4.0,
): Periodicity {
  const n = values.length;
  if (n < 8 || stepMs <= 0) return {frequencyHz: null, strength: 0};
  const m = mean(values);
  const centered = values.map((v) => v - m);
  let energy = 0;
  for (const v of centered) energy += v * v;
  if (energy < 1e-12) return {frequencyHz: null, strength: 0};

  const minLag = Math.max(2, Math.floor(1000 / (maxHz * stepMs)));
  const maxLag = Math.min(
    n - 2,
    Math.ceil(1000 / (minHz * stepMs)),
  );
  if (maxLag <= minLag) return {frequencyHz: null, strength: 0};

  let bestLag = -1;
  let bestScore = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let acc = 0;
    for (let i = 0; i + lag < n; i++) acc += centered[i] * centered[i + lag];
    const score = acc / energy;
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }
  if (bestLag < 0 || bestScore <= 0) {
    return {frequencyHz: null, strength: 0};
  }
  return {
    frequencyHz: 1000 / (bestLag * stepMs),
    strength: Math.min(1, bestScore),
  };
}

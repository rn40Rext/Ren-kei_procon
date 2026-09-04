/**
 * Motion Encoder（ベースライン）。
 *
 * 決定事項は docs/design/ai-style-similarity.md 3章を参照。
 * 正規化 landmark の統計特徴 32 次元で Embedding を作る。
 * 大規模モデル（MotionBERT 等）へ移行する場合も、この
 * StyleEncoder インタフェースの実装を差し替えて version を上げる。
 *
 * 設計上の不変性（仕様書 8.6 の検証要件に対応）:
 *  - 撮影距離: すべての量を bodyScale で割る
 *  - 左右反転: 左右を max/min/差分/相関など対称な関数で畳む
 *  - 再生速度: 速度量を推定テンポ（Hz）で割り「1 拍あたり」にする
 */
import {
  FrameFeatures,
  PoseSeries,
  extractFrameFeatures,
} from "./pose";
import {
  correlation,
  estimatePeriodicity,
  max,
  mean,
  min,
  percentile,
  resampleUniform,
  std,
} from "./signal";
import {l2Normalize} from "./vector";

/** 現行の Embedding 版（TBD-08 の決定値） */
export const STYLE_EMBEDDING_VERSION = "style-baseline-v1";

/** Embedding 次元数 */
export const STYLE_EMBEDDING_DIM = 32;

/** リサンプル刻み。撮影 fps に依存させないため固定する */
const RESAMPLE_STEP_MS = 1000 / 30;

/** これ未満しか有効フレームが無ければ解析しない */
const MIN_USABLE_FRAMES = 30;

/** テンポを推定できなかったときの代替値（Hz） */
const FALLBACK_TEMPO_HZ = 1;

/** z 値のクリップ幅。外れ値 1 本で方向が決まるのを防ぐ */
const Z_CLIP = 3;

/** Embedding を計算できなかったときに投げる */
export class StyleEncodeError extends Error {
  /**
   * @param {string} message 失敗の内容
   */
  constructor(message: string) {
    super(message);
    this.name = "StyleEncodeError";
  }
}

/**
 * 各次元の名前と、標準化に使う中心値・スケール。
 *
 * 実データが無いため、値は正規化量の想定レンジから置いた暫定値。
 * 実測データが集まったら平均・標準偏差で再推定する（未決定事項）。
 */
export const FEATURE_SPECS: {
  name: string;
  center: number;
  scale: number;
}[] = [
  {name: "handHigh.mean", center: 0.0, scale: 0.35},
  {name: "handHigh.std", center: 0.15, scale: 0.12},
  {name: "handHigh.max", center: 0.35, scale: 0.25},
  {name: "handHigh.min", center: -0.35, scale: 0.3},
  {name: "handLow.mean", center: -0.25, scale: 0.3},
  {name: "handLow.std", center: 0.15, scale: 0.12},
  {name: "handLow.max", center: 0.0, scale: 0.3},
  {name: "handLow.min", center: -0.6, scale: 0.3},
  {name: "handSpread.mean", center: 0.3, scale: 0.2},
  {name: "handSpread.std", center: 0.15, scale: 0.12},
  {name: "handSpread.p95", center: 0.6, scale: 0.3},
  {name: "hipHeight.mean", center: 0.55, scale: 0.15},
  {name: "hipHeight.std", center: 0.05, scale: 0.04},
  {name: "hipHeight.range", center: 0.15, scale: 0.12},
  {name: "kneeAngle.mean", center: 2.6, scale: 0.4},
  {name: "kneeAngle.std", center: 0.15, scale: 0.12},
  {name: "kneeAngle.min", center: 2.2, scale: 0.5},
  {name: "kneeSpread.mean", center: 0.2, scale: 0.2},
  {name: "kneeSpread.std", center: 0.15, scale: 0.12},
  {name: "wristSpeedPerBeat.mean", center: 1.2, scale: 0.8},
  {name: "wristSpeedPerBeat.std", center: 0.8, scale: 0.6},
  {name: "wristSpeedPerBeat.p95", center: 2.5, scale: 1.5},
  {name: "hipSpeedPerBeat.mean", center: 0.4, scale: 0.3},
  {name: "hipSpeedPerBeat.std", center: 0.3, scale: 0.25},
  {name: "armReach.mean", center: 0.3, scale: 0.2},
  {name: "armReach.max", center: 0.6, scale: 0.3},
  {name: "stanceWidth.mean", center: 0.25, scale: 0.15},
  {name: "stanceWidth.std", center: 0.08, scale: 0.06},
  {name: "handHeightCorrelation", center: 0.0, scale: 0.6},
  {name: "handTravelPerBeat", center: 1.0, scale: 0.8},
  {name: "rhythmicity", center: 0.4, scale: 0.3},
  {name: "upperLowerMotionRatio", center: 3.0, scale: 2.0},
];

export type StyleEncodeResult = {
  version: string;
  vector: number[];
  /** 入力フレーム数 */
  frameCount: number;
  /** 特徴量計算に使えたフレーム数 */
  usableFrameCount: number;
  /** 推定テンポ（Hz）。推定できなければ null */
  tempoHz: number | null;
};

export type StyleEncoder = {
  version: string;
  dim: number;
  encode: (series: PoseSeries) => StyleEncodeResult;
};

/**
 * 等間隔グリッド上の連続点間の速さ。
 * @param {number[]} xs x 座標系列
 * @param {number[]} ys y 座標系列
 * @param {number} stepMs 刻み幅
 * @return {number[]} 速さの系列
 */
function speedSeries(
  xs: number[],
  ys: number[],
  stepMs: number,
): number[] {
  const out: number[] = [];
  const dt = stepMs / 1000;
  for (let i = 1; i < Math.min(xs.length, ys.length); i++) {
    out.push(Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]) / dt);
  }
  return out;
}

/**
 * 隣接差の絶対値の平均。単位時間あたりの移動量。
 * @param {number[]} xs 信号
 * @param {number} stepMs 刻み幅
 * @return {number} 1 秒あたりの移動量
 */
function meanAbsDiffPerSecond(xs: number[], stepMs: number): number {
  if (xs.length < 2) return 0;
  let acc = 0;
  for (let i = 1; i < xs.length; i++) acc += Math.abs(xs[i] - xs[i - 1]);
  return acc / (xs.length - 1) / (stepMs / 1000);
}

/**
 * 特徴の生値を作る。次元順は FEATURE_SPECS と一致させる。
 * @param {FrameFeatures[]} frames 有効フレームの特徴
 * @return {object} values（生値）と tempoHz（推定テンポ）
 */
function rawFeatures(frames: FrameFeatures[]): {
  values: number[];
  tempoHz: number | null;
} {
  const times = frames.map((f) => f.timestampMs);
  const step = RESAMPLE_STEP_MS;
  const rs = (pick: (f: FrameFeatures) => number) =>
    resampleUniform(times, frames.map(pick), step);

  const handHigh = rs((f) => f.handHigh);
  const handLow = rs((f) => f.handLow);
  const handSpread = rs((f) => f.handSpread);
  const hipHeight = rs((f) => f.hipHeight);
  const kneeMean = rs((f) => f.kneeMean);
  const kneeSpread = rs((f) => f.kneeSpread);
  const armReach = rs((f) => f.armReach);
  const stanceWidth = rs((f) => f.stanceWidth);
  const handLeft = rs((f) => f.handLeft);
  const handRight = rs((f) => f.handRight);

  const wristLx = rs((f) => f.wristL[0]);
  const wristLy = rs((f) => f.wristL[1]);
  const wristRx = rs((f) => f.wristR[0]);
  const wristRy = rs((f) => f.wristR[1]);
  const hipX = rs((f) => f.hipCenter[0]);
  const hipY = rs((f) => f.hipCenter[1]);

  // 腰の上下動からテンポを推定する。速度量はこれで割って
  // 「1 拍あたりの移動量」にし、再生速度の違いを吸収する。
  const periodicity = estimatePeriodicity(hipHeight, step);
  const tempoHz = periodicity.frequencyHz;
  const beat = tempoHz ?? FALLBACK_TEMPO_HZ;

  const speedL = speedSeries(wristLx, wristLy, step);
  const speedR = speedSeries(wristRx, wristRy, step);
  // 左右対称に畳む（左右反転しても値が変わらない）
  const wristSpeed = speedL.map((v, i) => (v + (speedR[i] ?? v)) / 2);
  const hipSpeed = speedSeries(hipX, hipY, step);

  const wristPerBeat = wristSpeed.map((v) => v / beat);
  const hipPerBeat = hipSpeed.map((v) => v / beat);

  const wristSpeedMean = mean(wristSpeed);
  const hipSpeedMean = mean(hipSpeed);

  const values = [
    mean(handHigh), std(handHigh), max(handHigh), min(handHigh),
    mean(handLow), std(handLow), max(handLow), min(handLow),
    mean(handSpread), std(handSpread), percentile(handSpread, 0.95),
    mean(hipHeight), std(hipHeight), max(hipHeight) - min(hipHeight),
    mean(kneeMean), std(kneeMean), min(kneeMean),
    mean(kneeSpread), std(kneeSpread),
    mean(wristPerBeat), std(wristPerBeat), percentile(wristPerBeat, 0.95),
    mean(hipPerBeat), std(hipPerBeat),
    mean(armReach), max(armReach),
    mean(stanceWidth), std(stanceWidth),
    correlation(handLeft, handRight),
    meanAbsDiffPerSecond(handHigh, step) / beat,
    periodicity.strength,
    wristSpeedMean / (hipSpeedMean + 1e-6),
  ];
  return {values, tempoHz};
}

/**
 * 姿勢系列から Embedding を作る。
 * @param {PoseSeries} series 姿勢系列
 * @return {StyleEncodeResult} L2 正規化済みの Embedding
 */
export function encodeStyleEmbedding(
  series: PoseSeries,
): StyleEncodeResult {
  const frames: FrameFeatures[] = [];
  for (const f of series.frames) {
    const ff = extractFrameFeatures(f);
    if (ff !== null) frames.push(ff);
  }
  frames.sort((a, b) => a.timestampMs - b.timestampMs);

  if (frames.length < MIN_USABLE_FRAMES) {
    throw new StyleEncodeError(
      `usable frames ${frames.length} < ${MIN_USABLE_FRAMES}`,
    );
  }

  const {values, tempoHz} = rawFeatures(frames);
  if (values.length !== STYLE_EMBEDDING_DIM) {
    throw new StyleEncodeError(
      `feature dim ${values.length} != ${STYLE_EMBEDDING_DIM}`,
    );
  }

  const standardized = values.map((v, i) => {
    const spec = FEATURE_SPECS[i];
    const safe = Number.isFinite(v) ? v : spec.center;
    const z = (safe - spec.center) / spec.scale;
    return Math.min(Z_CLIP, Math.max(-Z_CLIP, z));
  });

  return {
    version: STYLE_EMBEDDING_VERSION,
    vector: l2Normalize(standardized),
    frameCount: series.frames.length,
    usableFrameCount: frames.length,
    tempoHz,
  };
}

const baselineEncoder: StyleEncoder = {
  version: STYLE_EMBEDDING_VERSION,
  dim: STYLE_EMBEDDING_DIM,
  encode: encodeStyleEmbedding,
};

const ENCODERS: Record<string, StyleEncoder> = {
  [STYLE_EMBEDDING_VERSION]: baselineEncoder,
};

/**
 * 指定版のエンコーダを返す。
 *
 * STYLE_ENCODER_DISABLED=true のときは常に null を返す
 * （STYLE_MODEL_UNAVAILABLE の動作確認と緊急停止に使う）。
 * @param {string} version Embedding 版
 * @return {StyleEncoder | null} 利用できなければ null
 */
export function getStyleEncoder(version: string): StyleEncoder | null {
  if (process.env.STYLE_ENCODER_DISABLED === "true") return null;
  return ENCODERS[version] ?? null;
}

/**
 * 現行版のエンコーダを返す。
 * @return {StyleEncoder | null} 利用できなければ null
 */
export function getCurrentStyleEncoder(): StyleEncoder | null {
  return getStyleEncoder(STYLE_EMBEDDING_VERSION);
}

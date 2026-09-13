/**
 * 姿勢推定(MediaPipe Pose Landmarker)の出力を表す型。
 *
 * 座標系は MediaPipe の画像座標(0〜1 正規化、y は下向きが正)。
 * サーバ側(functions/src/style/pose.ts)の PoseSeries と同じ形にして、
 * クライアントで記録した姿勢系列をそのまま Storage へ置けるようにする。
 * 設計: docs/design/ai-basic-motion.md 3〜4章
 */

/** MediaPipe Pose の landmark index(仕様書 7.2 で使う点)。 */
export const LM = {
  NOSE: 0,
  L_EYE: 2,
  R_EYE: 5,
  L_EAR: 7,
  R_EAR: 8,
  L_SHOULDER: 11,
  R_SHOULDER: 12,
  L_ELBOW: 13,
  R_ELBOW: 14,
  L_WRIST: 15,
  R_WRIST: 16,
  L_HIP: 23,
  R_HIP: 24,
  L_KNEE: 25,
  R_KNEE: 26,
  L_ANKLE: 27,
  R_ANKLE: 28,
  L_HEEL: 29,
  R_HEEL: 30,
  L_FOOT_INDEX: 31,
  R_FOOT_INDEX: 32,
} as const;

export const NUM_LANDMARKS = 33;

/** 骨格オーバーレイで結ぶ線(体幹・腕・脚。顔の細かい点は描かない)。 */
export const SKELETON_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [LM.L_SHOULDER, LM.R_SHOULDER],
  [LM.L_SHOULDER, LM.L_ELBOW],
  [LM.L_ELBOW, LM.L_WRIST],
  [LM.R_SHOULDER, LM.R_ELBOW],
  [LM.R_ELBOW, LM.R_WRIST],
  [LM.L_SHOULDER, LM.L_HIP],
  [LM.R_SHOULDER, LM.R_HIP],
  [LM.L_HIP, LM.R_HIP],
  [LM.L_HIP, LM.L_KNEE],
  [LM.L_KNEE, LM.L_ANKLE],
  [LM.R_HIP, LM.R_KNEE],
  [LM.R_KNEE, LM.R_ANKLE],
  [LM.L_ANKLE, LM.L_FOOT_INDEX],
  [LM.R_ANKLE, LM.R_FOOT_INDEX],
];

export type Landmark = {
  x: number;
  y: number;
  z?: number;
  /** 0〜1。低いほど遮蔽・画面外の可能性が高い */
  visibility: number;
};

/** 1 フレーム分の姿勢。landmarks は常に 33 点。 */
export type PoseFrame = {
  /** セッション開始からの経過ミリ秒(単調増加) */
  timestampMs: number;
  landmarks: Landmark[];
};

/** 検出結果。人物が映っていないフレームは landmarks が空になる。 */
export type PoseDetection = {
  timestampMs: number;
  /** 検出した人物ごとの 33 点。0 人なら空配列 */
  poses: Landmark[][];
  /** 推論にかかった時間(ミリ秒)。性能表示・TBD-01 の計測に使う */
  inferenceMs: number;
};

/** Storage に保存する姿勢系列(functions/src/style/pose.ts の PoseSeries と同形)。 */
export type PoseSeries = {
  formatVersion: typeof POSE_SERIES_FORMAT_VERSION;
  frames: PoseFrame[];
};

export const POSE_SERIES_FORMAT_VERSION = "pose-series-v1";

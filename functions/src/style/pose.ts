/**
 * 姿勢系列（PoseSeries）の型と正規化。
 *
 * 座標系は MediaPipe Pose に合わせ、画像座標（y は下方向が正）・
 * 0〜1 正規化済みを前提とする。正規化式は
 * docs/design/ai-basic-motion.md 4章と同じものを使う。
 */

/** MediaPipe Pose の landmark index（仕様書 7.2 で使う点のみ） */
export const LM = {
  NOSE: 0,
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
} as const;

/** 特徴量計算に最低限必要な landmark */
const REQUIRED_LANDMARKS: number[] = [
  LM.NOSE,
  LM.L_SHOULDER, LM.R_SHOULDER,
  LM.L_WRIST, LM.R_WRIST,
  LM.L_HIP, LM.R_HIP,
  LM.L_KNEE, LM.R_KNEE,
  LM.L_ANKLE, LM.R_ANKLE,
];

/** 低信頼度点を捨てる閾値（ai-basic-motion.md 4章と同値） */
export const MIN_VISIBILITY = 0.5;

export type Landmark = {
  x: number;
  y: number;
  z?: number;
  visibility: number;
};

export type PoseFrame = {
  /** 動画先頭からの経過ミリ秒 */
  timestampMs: number;
  /** MediaPipe Pose の 33 点 */
  landmarks: Landmark[];
};

/** Storage へ保存する姿勢系列ファイルの中身 */
export type PoseSeries = {
  /** ファイル形式の版（Embedding の版とは別） */
  formatVersion: string;
  frames: PoseFrame[];
};

export const POSE_SERIES_FORMAT_VERSION = "pose-series-v1";

/**
 * 中点。visibility は小さいほうを採用する（安全側）。
 * @param {Landmark} a 一方の点
 * @param {Landmark} b もう一方の点
 * @return {Landmark} 中点
 */
function center(a: Landmark, b: Landmark): Landmark {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    visibility: Math.min(a.visibility, b.visibility),
  };
}

/**
 * 身長相当のスケール。これで割ることで体格差・撮影距離の影響を除く。
 * @param {PoseFrame} f 対象フレーム
 * @return {number | null} スケール。全身が映っていなければ null
 */
export function bodyScale(f: PoseFrame): number | null {
  const shoulder = center(
    f.landmarks[LM.L_SHOULDER],
    f.landmarks[LM.R_SHOULDER],
  );
  const ankle = center(f.landmarks[LM.L_ANKLE], f.landmarks[LM.R_ANKLE]);
  if (
    shoulder.visibility < MIN_VISIBILITY ||
    ankle.visibility < MIN_VISIBILITY
  ) {
    return null;
  }
  const scale = Math.hypot(shoulder.x - ankle.x, shoulder.y - ankle.y);
  return scale > 1e-6 ? scale : null;
}

/**
 * 特徴量計算に使えるフレームか。
 * @param {PoseFrame} f 対象フレーム
 * @return {boolean} 必要な landmark がすべて信頼できるとき true
 */
export function isUsableFrame(f: PoseFrame): boolean {
  if (!Array.isArray(f.landmarks)) return false;
  for (const idx of REQUIRED_LANDMARKS) {
    const lm = f.landmarks[idx];
    if (!lm || typeof lm.x !== "number" || typeof lm.y !== "number") {
      return false;
    }
    if (lm.visibility < MIN_VISIBILITY) return false;
  }
  return bodyScale(f) !== null;
}

/** 1 フレームから取り出す、スケール正規化済みのスカラー量 */
export type FrameFeatures = {
  timestampMs: number;
  /** 高いほうの手の高さ（頭より上で正） */
  handHigh: number;
  /** 低いほうの手の高さ */
  handLow: number;
  /** 左右の手の高さの差（左右反転で不変） */
  handSpread: number;
  /** 腰の高さ（低いほど小さい） */
  hipHeight: number;
  /** 左右の膝角度の平均（ラジアン） */
  kneeMean: number;
  /** 左右の膝角度の差の絶対値 */
  kneeSpread: number;
  /** 肩中心から手首までの水平距離の大きいほう */
  armReach: number;
  /** 足首同士の水平距離 */
  stanceWidth: number;
  /** 左手の高さ（相関計算用） */
  handLeft: number;
  /** 右手の高さ（相関計算用） */
  handRight: number;
  /** 正規化した左手首座標 */
  wristL: [number, number];
  /** 正規化した右手首座標 */
  wristR: [number, number];
  /** 正規化した腰中心座標 */
  hipCenter: [number, number];
};

/**
 * 3 点 a-b-c のなす角。
 * @param {Landmark} a 始点
 * @param {Landmark} b 頂点
 * @param {Landmark} c 終点
 * @return {number} 角度（ラジアン）
 */
function angleAt(a: Landmark, b: Landmark, c: Landmark): number {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const n1 = Math.hypot(v1x, v1y);
  const n2 = Math.hypot(v2x, v2y);
  if (n1 < 1e-9 || n2 < 1e-9) return Math.PI;
  const cos = (v1x * v2x + v1y * v2y) / (n1 * n2);
  return Math.acos(Math.min(1, Math.max(-1, cos)));
}

/**
 * 1 フレームを正規化済みスカラー量へ変換する。
 * @param {PoseFrame} f 対象フレーム
 * @return {FrameFeatures | null} 使えないフレームなら null
 */
export function extractFrameFeatures(f: PoseFrame): FrameFeatures | null {
  const scale = bodyScale(f);
  if (scale === null || !isUsableFrame(f)) return null;

  const lm = f.landmarks;
  const head = lm[LM.NOSE];
  const shoulderC = center(lm[LM.L_SHOULDER], lm[LM.R_SHOULDER]);
  const hipC = center(lm[LM.L_HIP], lm[LM.R_HIP]);
  const ankleC = center(lm[LM.L_ANKLE], lm[LM.R_ANKLE]);

  // 手の高さ: 頭より上にあるほど正の大きな値
  const hL = (head.y - lm[LM.L_WRIST].y) / scale;
  const hR = (head.y - lm[LM.R_WRIST].y) / scale;

  const kneeL = angleAt(lm[LM.L_HIP], lm[LM.L_KNEE], lm[LM.L_ANKLE]);
  const kneeR = angleAt(lm[LM.R_HIP], lm[LM.R_KNEE], lm[LM.R_ANKLE]);

  const reachL = Math.abs(lm[LM.L_WRIST].x - shoulderC.x) / scale;
  const reachR = Math.abs(lm[LM.R_WRIST].x - shoulderC.x) / scale;

  return {
    timestampMs: f.timestampMs,
    handHigh: Math.max(hL, hR),
    handLow: Math.min(hL, hR),
    handSpread: Math.abs(hL - hR),
    hipHeight: (ankleC.y - hipC.y) / scale,
    kneeMean: (kneeL + kneeR) / 2,
    kneeSpread: Math.abs(kneeL - kneeR),
    armReach: Math.max(reachL, reachR),
    stanceWidth: Math.abs(lm[LM.L_ANKLE].x - lm[LM.R_ANKLE].x) / scale,
    handLeft: hL,
    handRight: hR,
    wristL: [lm[LM.L_WRIST].x / scale, lm[LM.L_WRIST].y / scale],
    wristR: [lm[LM.R_WRIST].x / scale, lm[LM.R_WRIST].y / scale],
    hipCenter: [hipC.x / scale, hipC.y / scale],
  };
}

/**
 * 受け取った JSON が PoseSeries として妥当かを検証する。
 * @param {unknown} raw パース済み JSON
 * @return {PoseSeries} 検証済みの姿勢系列
 */
export function parsePoseSeries(raw: unknown): PoseSeries {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("pose series must be an object");
  }
  const obj = raw as Record<string, unknown>;
  const frames = obj.frames;
  if (!Array.isArray(frames) || frames.length === 0) {
    throw new Error("pose series has no frames");
  }
  const parsed: PoseFrame[] = frames.map((fr, i) => {
    const f = fr as Record<string, unknown>;
    const t = f.timestampMs;
    const landmarks = f.landmarks;
    if (typeof t !== "number" || !Array.isArray(landmarks)) {
      throw new Error(`invalid frame at ${i}`);
    }
    return {
      timestampMs: t,
      landmarks: landmarks.map((l) => {
        const lm = l as Record<string, unknown>;
        return {
          x: Number(lm.x),
          y: Number(lm.y),
          z: typeof lm.z === "number" ? lm.z : undefined,
          visibility:
            typeof lm.visibility === "number" ? lm.visibility : 1,
        };
      }),
    };
  });
  return {
    formatVersion:
      typeof obj.formatVersion === "string" ?
        obj.formatVersion :
        POSE_SERIES_FORMAT_VERSION,
    frames: parsed,
  };
}

/**
 * 検証用の合成姿勢系列。
 *
 * 実撮影データが無いため、仕様書 8.6 の検証項目のうち
 * 「撮影距離」「左右反転」「再生速度」への不変性は合成データで確認する。
 * 実データが必要な項目（同一人物の別テイク一致率など）は
 * docs/design/ai-style-similarity.md 7章に未実施として記録している。
 */
import {Landmark, PoseFrame, PoseSeries, LM} from "../style/pose";

/** 踊り方のスタイルを決めるパラメータ（body 単位。1 = 肩〜足首） */
export type DancerParams = {
  tempoHz: number;
  handHeight: number;
  handAmplitude: number;
  handPhaseDiff: number;
  hipHeight: number;
  hipBob: number;
  armReach: number;
  stanceWidth: number;
  kneeBend: number;
};

export type RenderOptions = {
  frames?: number;
  fps?: number;
  /** 撮影距離の違い。1 より小さいと遠くに写る */
  scale?: number;
  offsetX?: number;
  offsetY?: number;
  /** 左右反転（x 反転 + 左右 landmark の入れ替え） */
  mirror?: boolean;
  /** 再生速度。1.2 なら 20% 速い */
  speed?: number;
  /** 座標に載せるノイズの大きさ（body 単位） */
  noise?: number;
  seed?: number;
  /** 別テイクを模した位相ずれ */
  phase?: number;
};

/**
 * 決定的な擬似乱数。テストを再現可能にするために使う。
 * @param {number} seed 種
 * @return {function} -0.5〜0.5 を返す関数
 */
function makeRandom(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000 - 0.5;
  };
}

/**
 * landmark を作る。
 * @param {number} x x 座標
 * @param {number} y y 座標
 * @return {Landmark} landmark
 */
function lm(x: number, y: number): Landmark {
  return {x, y, visibility: 1};
}

/**
 * 合成した姿勢系列を作る。
 * @param {DancerParams} p 踊り方のパラメータ
 * @param {RenderOptions} o 撮影条件
 * @return {PoseSeries} 姿勢系列
 */
export function makeSeries(
  p: DancerParams,
  o: RenderOptions = {},
): PoseSeries {
  const frameCount = o.frames ?? 180;
  const fps = o.fps ?? 30;
  const scale = 0.5 * (o.scale ?? 1);
  const offsetX = o.offsetX ?? 0.5;
  const offsetY = o.offsetY ?? 0.15;
  const speed = o.speed ?? 1;
  const noise = o.noise ?? 0;
  const phase = o.phase ?? 0;
  const rand = makeRandom(o.seed ?? 12345);

  const frames: PoseFrame[] = [];
  for (let i = 0; i < frameCount; i++) {
    const t = i / fps; // 動きの内容としての時刻
    const w = 2 * Math.PI * p.tempoHz * t + phase;

    const hipH = p.hipHeight + p.hipBob * Math.sin(w);
    const handL = p.handHeight + p.handAmplitude * Math.sin(w);
    const handR =
      p.handHeight + p.handAmplitude * Math.sin(w + p.handPhaseDiff);
    const reachL = p.armReach * (0.7 + 0.3 * Math.cos(w));
    const reachR = p.armReach * (0.7 + 0.3 * Math.cos(w + p.handPhaseDiff));

    // body 単位（y は下方向が正、肩 y=0 / 足首 y=1）
    const noseY = -0.25;
    const hipY = 1 - hipH;
    const half = p.stanceWidth / 2;
    const kneeOut = p.kneeBend * 0.12;

    const body: Record<number, [number, number]> = {
      [LM.NOSE]: [0, noseY],
      [LM.L_SHOULDER]: [-0.18, 0],
      [LM.R_SHOULDER]: [0.18, 0],
      [LM.L_ELBOW]: [-0.18 - reachL / 2, noseY / 2],
      [LM.R_ELBOW]: [0.18 + reachR / 2, noseY / 2],
      [LM.L_WRIST]: [-0.18 - reachL, noseY - handL],
      [LM.R_WRIST]: [0.18 + reachR, noseY - handR],
      [LM.L_HIP]: [-0.12, hipY],
      [LM.R_HIP]: [0.12, hipY],
      [LM.L_KNEE]: [(-0.12 - half) / 2 - kneeOut, (hipY + 1) / 2],
      [LM.R_KNEE]: [(0.12 + half) / 2 + kneeOut, (hipY + 1) / 2],
      [LM.L_ANKLE]: [-half, 1],
      [LM.R_ANKLE]: [half, 1],
    };

    const landmarks: Landmark[] = new Array(33)
      .fill(null)
      .map(() => lm(offsetX, offsetY));
    for (const key of Object.keys(body)) {
      const idx = Number(key);
      const [bx, by] = body[idx];
      const nx = bx + (noise ? rand() * noise : 0);
      const ny = by + (noise ? rand() * noise : 0);
      landmarks[idx] = lm(offsetX + nx * scale, offsetY + ny * scale);
    }

    if (o.mirror) {
      // 映像の左右反転。MediaPipe は解剖学的に左右を付けるため、
      // x を反転したうえで左右の landmark を入れ替える。
      for (const l of landmarks) l.x = 1 - l.x;
      const swap = (a: number, b: number) => {
        const tmp = landmarks[a];
        landmarks[a] = landmarks[b];
        landmarks[b] = tmp;
      };
      swap(LM.L_SHOULDER, LM.R_SHOULDER);
      swap(LM.L_ELBOW, LM.R_ELBOW);
      swap(LM.L_WRIST, LM.R_WRIST);
      swap(LM.L_HIP, LM.R_HIP);
      swap(LM.L_KNEE, LM.R_KNEE);
      swap(LM.L_ANKLE, LM.R_ANKLE);
    }

    frames.push({timestampMs: (t / speed) * 1000, landmarks});
  }

  return {formatVersion: "pose-series-v1", frames};
}

/** 連 A: 手を高く上げ、腰を落とし気味に踊るスタイル */
export const STYLE_A: DancerParams = {
  tempoHz: 1.6,
  handHeight: 0.28,
  handAmplitude: 0.14,
  handPhaseDiff: Math.PI,
  hipHeight: 0.52,
  hipBob: 0.05,
  armReach: 0.3,
  stanceWidth: 0.24,
  kneeBend: 0.5,
};

/** 連 B: 手が低く、腰高で、上下動の小さいスタイル */
export const STYLE_B: DancerParams = {
  tempoHz: 1.6,
  handHeight: -0.05,
  handAmplitude: 0.05,
  handPhaseDiff: Math.PI / 2,
  hipHeight: 0.66,
  hipBob: 0.015,
  armReach: 0.14,
  stanceWidth: 0.34,
  kneeBend: 0.1,
};

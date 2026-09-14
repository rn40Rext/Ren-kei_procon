/**
 * テスト用の合成姿勢系列(仕様書 15.1 / docs/design/ai-basic-motion.md 11章)。
 *
 * 実機なしで Rule Engine を検証するために、正規化量(bodyScale=1 の body 単位)で
 * 姿勢を指定し、画像座標(0〜1、y 下向き正)へ描き下ろす。
 * 決定的な擬似乱数を使い、同じ引数からは常に同じ系列が出る。
 */
import { LM, Landmark, NUM_LANDMARKS, PoseFrame } from "../../pose/types";

export type Pose = {
  /** 手の高さ(頭より上で正)。左右別に指定できる */
  handHeight: number | { left: number; right: number };
  /** 手首の頭からの水平距離(body 単位) */
  handOffset?: number;
  /** 腰の高さ(足首中心〜腰中心。直立で約 0.55〜0.6) */
  hipHeight: number;
  /** 膝の角度[度]。180 で直立 */
  kneeAngle: number;
  /** 上体の傾き[度]。0 で直立 */
  torsoTilt?: number;
};

export type SynthOptions = {
  frames: number;
  fps?: number;
  /** 撮影距離。1 で肩〜足首が画面の半分 */
  scale?: number;
  offsetX?: number;
  offsetY?: number;
  /** 座標に載せる一様ノイズの幅(body 単位) */
  noise?: number;
  seed?: number;
  /** 左右反転(x を反転し、左右 landmark を入れ替える) */
  mirror?: boolean;
  /** 全点の visibility */
  visibility?: number;
  /** 見えないことにする landmark(visibility 0.1) */
  hidden?: number[];
  /** 腰の上下動: 振幅(body 単位)と BPM */
  bob?: { amplitude: number; bpm: number };
  /** 手の上下動: 振幅と BPM(左右は逆位相) */
  handSwing?: { amplitude: number; bpm: number };
};

export const STANDING: Pose = { handHeight: -0.4, hipHeight: 0.6, kneeAngle: 178, torsoTilt: 0 };
export const BASIC_FORM: Pose = { handHeight: 0.15, handOffset: 0.1, hipHeight: 0.46, kneeAngle: 140, torsoTilt: 5 };
export const HANDS_UP_ONLY: Pose = { handHeight: 0.15, handOffset: 0.1, hipHeight: 0.6, kneeAngle: 178, torsoTilt: 0 };

function makeRandom(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000 - 0.5;
  };
}

const LEFT_RIGHT_PAIRS: [number, number][] = [
  [LM.L_EYE, LM.R_EYE],
  [LM.L_EAR, LM.R_EAR],
  [LM.L_SHOULDER, LM.R_SHOULDER],
  [LM.L_ELBOW, LM.R_ELBOW],
  [LM.L_WRIST, LM.R_WRIST],
  [LM.L_HIP, LM.R_HIP],
  [LM.L_KNEE, LM.R_KNEE],
  [LM.L_ANKLE, LM.R_ANKLE],
  [LM.L_HEEL, LM.R_HEEL],
  [LM.L_FOOT_INDEX, LM.R_FOOT_INDEX],
];

/**
 * 姿勢(関数でも可)から PoseFrame[] を作る。
 * pose を関数にすると時刻[s]ごとに違う姿勢を返せる(動作の途中経過のテスト用)。
 */
export function synthesize(pose: Pose | ((tSec: number) => Pose), o: SynthOptions): PoseFrame[] {
  const fps = o.fps ?? 30;
  const scale = 0.5 * (o.scale ?? 1);
  const offsetX = o.offsetX ?? 0.5;
  const offsetY = o.offsetY ?? 0.15;
  const noise = o.noise ?? 0;
  const vis = o.visibility ?? 0.95;
  const rand = makeRandom(o.seed ?? 1);
  const hidden = new Set(o.hidden ?? []);
  const out: PoseFrame[] = [];

  for (let i = 0; i < o.frames; i++) {
    const t = i / fps;
    const p = typeof pose === "function" ? pose(t) : pose;
    const hL = typeof p.handHeight === "number" ? p.handHeight : p.handHeight.left;
    const hR = typeof p.handHeight === "number" ? p.handHeight : p.handHeight.right;
    const swing = o.handSwing ? o.handSwing.amplitude * Math.sin(2 * Math.PI * (o.handSwing.bpm / 60) * t) : 0;
    const bob = o.bob ? o.bob.amplitude * Math.sin(2 * Math.PI * (o.bob.bpm / 60) * t) : 0;
    const handOffset = p.handOffset ?? 0.1;

    // body 単位。肩 y=0、足首 y=1、鼻 y=-0.25
    const noseY = -0.25;
    const hipY = 1 - p.hipHeight + bob;
    const tilt = ((p.torsoTilt ?? 0) * Math.PI) / 180;
    const shoulderX = Math.sin(tilt) * (hipY - 0);
    const legLen = 1 - hipY;
    // 膝: 腰と足首の中点から水平に d だけ張り出す。tan(θ/2) = (legLen/2) / d
    const half = ((p.kneeAngle / 2) * Math.PI) / 180;
    const d = p.kneeAngle >= 179.9 ? 0 : legLen / 2 / Math.tan(half);
    const kneeY = (hipY + 1) / 2;

    const body: Record<number, [number, number]> = {
      [LM.NOSE]: [shoulderX, noseY],
      [LM.L_EYE]: [shoulderX - 0.03, noseY - 0.03],
      [LM.R_EYE]: [shoulderX + 0.03, noseY - 0.03],
      [LM.L_EAR]: [shoulderX - 0.06, noseY],
      [LM.R_EAR]: [shoulderX + 0.06, noseY],
      [LM.L_SHOULDER]: [shoulderX - 0.18, 0],
      [LM.R_SHOULDER]: [shoulderX + 0.18, 0],
      [LM.L_WRIST]: [shoulderX - handOffset, noseY - (hL + swing)],
      [LM.R_WRIST]: [shoulderX + handOffset, noseY - (hR - swing)],
      [LM.L_HIP]: [-0.12, hipY],
      [LM.R_HIP]: [0.12, hipY],
      [LM.L_KNEE]: [-0.12 - d, kneeY],
      [LM.R_KNEE]: [0.12 + d, kneeY],
      [LM.L_ANKLE]: [-0.12, 1],
      [LM.R_ANKLE]: [0.12, 1],
      [LM.L_HEEL]: [-0.12, 1.03],
      [LM.R_HEEL]: [0.12, 1.03],
      [LM.L_FOOT_INDEX]: [-0.12, 1.06],
      [LM.R_FOOT_INDEX]: [0.12, 1.06],
    };
    // 肘は肩と手首の中点を少し外へ
    body[LM.L_ELBOW] = [(body[LM.L_SHOULDER][0] + body[LM.L_WRIST][0]) / 2 - 0.08, (body[LM.L_SHOULDER][1] + body[LM.L_WRIST][1]) / 2];
    body[LM.R_ELBOW] = [(body[LM.R_SHOULDER][0] + body[LM.R_WRIST][0]) / 2 + 0.08, (body[LM.R_SHOULDER][1] + body[LM.R_WRIST][1]) / 2];

    const landmarks: Landmark[] = Array.from({ length: NUM_LANDMARKS }, () => ({ x: offsetX, y: offsetY, visibility: vis }));
    for (const key of Object.keys(body)) {
      const idx = Number(key);
      const [bx, by] = body[idx];
      const nx = bx + (noise ? rand() * noise : 0);
      const ny = by + (noise ? rand() * noise : 0);
      landmarks[idx] = {
        x: offsetX + nx * scale,
        y: offsetY + ny * scale,
        z: 0,
        visibility: hidden.has(idx) ? 0.1 : vis,
      };
    }

    if (o.mirror) {
      // 映像の左右反転。MediaPipe は解剖学的に左右を付けるので、
      // x を反転したうえで左右の landmark を入れ替える
      for (const l of landmarks) l.x = 1 - l.x;
      for (const [a, b] of LEFT_RIGHT_PAIRS) {
        const tmp = landmarks[a];
        landmarks[a] = landmarks[b];
        landmarks[b] = tmp;
      }
    }

    out.push({ timestampMs: Math.round((i * 1000) / fps), landmarks });
  }
  return out;
}

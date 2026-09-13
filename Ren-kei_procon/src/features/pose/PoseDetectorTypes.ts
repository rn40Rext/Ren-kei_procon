/**
 * 姿勢推定器のインタフェース(プラットフォーム共通)。
 *
 * 実装は PoseDetector.ts(ネイティブ: スタブ)と PoseDetector.web.ts(Web: MediaPipe Tasks)。
 * Metro がプラットフォームで差し替えるため、両実装が共有する型は
 * このファイルに置く(実装ファイル同士で import すると Web 側で自己参照になる)。
 */
import { PoseDetection } from "./types";

export type PoseModelVariant = "lite" | "full" | "heavy";

export type PoseDetectorOptions = {
  /** 既定 'full'(TBD-01 の計測で 13ms/frame。lite は検出率が落ちる) */
  model?: PoseModelVariant;
  /** 既定 'GPU' */
  delegate?: "CPU" | "GPU";
  numPoses?: number;
  minPoseDetectionConfidence?: number;
  minTrackingConfidence?: number;
};

/** 推論に渡せる映像ソース。Web では HTMLVideoElement。 */
export type PoseFrameSource = unknown;

export interface PoseDetector {
  /** WASM とモデルの読み込み。数秒かかることがあるので UI は「準備中」を出す */
  load(): Promise<void>;
  /** 1 フレーム推論する。timestampMs は単調増加が必須(MediaPipe VIDEO モードの制約) */
  detect(source: PoseFrameSource, timestampMs: number): PoseDetection;
  close(): void;
  readonly ready: boolean;
}

export class PoseNotSupportedError extends Error {
  readonly code = "POSE_NOT_SUPPORTED";
  constructor() {
    super("このプラットフォームではリアルタイム姿勢推定に未対応です(TBD-01: Web 版で利用してください)");
    this.name = "PoseNotSupportedError";
  }
}

/**
 * 姿勢推定器(既定 = ネイティブ向けスタブ)。
 *
 * TBD-01 の決定(docs/design/ai-basic-motion.md 3章): Prototype 1 は
 * Expo Web + MediaPipe Tasks(WASM/GPU)で実装する。Web 実装は
 * PoseDetector.web.ts にあり、Metro がプラットフォームで自動的に差し替える。
 * iOS / Android のネイティブ実装(方式 A)は未着手で、このスタブが
 * POSE_NOT_SUPPORTED を返す。
 */
import { PoseDetector, PoseDetectorOptions, PoseNotSupportedError } from "./PoseDetectorTypes";

export * from "./PoseDetectorTypes";

/** ネイティブでは未対応(方式 A は未着手)。 */
export function createPoseDetector(_options: PoseDetectorOptions = {}): PoseDetector {
  return {
    ready: false,
    async load() {
      throw new PoseNotSupportedError();
    },
    detect() {
      throw new PoseNotSupportedError();
    },
    close() {
      /* nothing */
    },
  };
}

/** このプラットフォームでリアルタイム姿勢推定が使えるか。 */
export const POSE_SUPPORTED = false;

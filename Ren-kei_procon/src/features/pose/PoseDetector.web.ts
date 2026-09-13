/**
 * Web 向け姿勢推定器: MediaPipe Tasks Vision(WASM / WebGL)の Pose Landmarker。
 *
 * TBD-01 の決定(docs/design/ai-basic-motion.md 3章)に基づく実装。
 * 計測値(2026-09-13、Awa Odori 実写 854x480 動画、アプリ内ブラウザ):
 *   full/GPU 12.9ms/frame(58fps) / lite/GPU 52ms(17.5fps・初回 WASM 起動込み) / lite/CPU 16.7ms
 * WASM と .task モデルは CDN / Google のモデルストレージから取得する
 * (@mediapipe/tasks-vision と同じ版を指定する)。
 */
import type { PoseLandmarker as PoseLandmarkerType } from "@mediapipe/tasks-vision";
import { PoseDetection, Landmark } from "./types";
import { PoseDetector, PoseDetectorOptions, PoseFrameSource, PoseModelVariant } from "./PoseDetectorTypes";

// 共有の型・エラーは PoseDetectorTypes.ts に置く("./PoseDetector" を import すると
// Metro が Web ではこのファイル自身に解決し、自己参照で落ちる)
export * from "./PoseDetectorTypes";

const TASKS_VISION_VERSION = "1.0.1";
const TASKS_VISION_CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}`;
const WASM_BASE = `${TASKS_VISION_CDN}/wasm`;

type TasksVision = typeof import("@mediapipe/tasks-vision");

/**
 * tasks-vision の ESM バンドルを実行時に読み込む。
 *
 * npm の vision_bundle.mjs は内部で `import(url)`(非リテラル)を使っており、
 * Metro がバンドルできない("Invalid call at line 1: import(t.toString())")。
 * バンドラの目に触れない形で動的 import し、CDN の同じ版を使う
 * (WASM・モデルも同じ CDN / モデルストレージから読む。npm パッケージは型定義のためだけに残す)。
 */
let tasksVisionPromise: Promise<TasksVision> | null = null;
function loadTasksVision(): Promise<TasksVision> {
  if (!tasksVisionPromise) {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const dynamicImport = new Function("u", "return import(u)") as (u: string) => Promise<TasksVision>;
    tasksVisionPromise = dynamicImport(`${TASKS_VISION_CDN}/vision_bundle.mjs`);
  }
  return tasksVisionPromise;
}
const MODEL_URLS: Record<PoseModelVariant, string> = {
  lite: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
  full: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
  heavy: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task",
};

class WebPoseDetector implements PoseDetector {
  private landmarker: PoseLandmarkerType | null = null;
  private lastTs = -1;
  ready = false;

  constructor(private readonly options: PoseDetectorOptions) {}

  async load(): Promise<void> {
    // 必要になるまで読み込まない(起動時のバンドルサイズを増やさない)
    const vision = await loadTasksVision();
    const fileset = await vision.FilesetResolver.forVisionTasks(WASM_BASE);
    this.landmarker = await vision.PoseLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: MODEL_URLS[this.options.model ?? "full"],
        delegate: this.options.delegate ?? "GPU",
      },
      runningMode: "VIDEO",
      numPoses: this.options.numPoses ?? 2,
      minPoseDetectionConfidence: this.options.minPoseDetectionConfidence ?? 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: this.options.minTrackingConfidence ?? 0.5,
    });
    this.ready = true;
  }

  detect(source: PoseFrameSource, timestampMs: number): PoseDetection {
    if (!this.landmarker) throw new Error("PoseDetector is not loaded");
    // VIDEO モードはタイムスタンプの単調増加が必須
    const ts = timestampMs <= this.lastTs ? this.lastTs + 1 : timestampMs;
    this.lastTs = ts;
    const started = performance.now();
    const result = this.landmarker.detectForVideo(source as HTMLVideoElement, ts);
    const inferenceMs = performance.now() - started;
    const poses: Landmark[][] = result.landmarks.map((pose) =>
      pose.map((p) => ({ x: p.x, y: p.y, z: p.z, visibility: p.visibility }))
    );
    return { timestampMs, poses, inferenceMs };
  }

  close(): void {
    this.landmarker?.close();
    this.landmarker = null;
    this.ready = false;
  }
}

export function createPoseDetector(options: PoseDetectorOptions = {}): PoseDetector {
  return new WebPoseDetector(options);
}

export const POSE_SUPPORTED = true;

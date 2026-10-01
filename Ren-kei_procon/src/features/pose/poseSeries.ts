/**
 * 姿勢系列の記録(docs/design/ai-style-similarity.md 6章「姿勢系列の保存先」)。
 *
 * セッション中の landmark 時系列を溜め、Storage へ置く JSON
 * (`users/{uid}/videos/{videoId}.pose.json`、形式 pose-series-v1)を作る。
 * AI②(FN-02 analyzeStyle)がこれを読んで Embedding を作る。
 * 30fps で 30 秒あると 33 点 × 900 フレームで数百 KB になるため、
 * 記録レートを間引き、座標は 4 桁に丸める。
 */
import { PoseFrame, PoseSeries, POSE_SERIES_FORMAT_VERSION } from "./types";

/** セッション中の姿勢フレームを間引きながら溜め、保存用JSONへ変換する */
export class PoseSeriesRecorder {
  private frames: PoseFrame[] = [];
  private lastKeptMs = -Infinity;

  /**
   * @param maxFps 記録する最大レート。既定 15fps
   */
  constructor(private readonly maxFps = 15) {}

  /** 記録済みフレームを空にする(セッション開始時に呼ぶ) */
  reset(): void {
    this.frames = [];
    this.lastKeptMs = -Infinity;
  }

  /** 1フレーム追加する。maxFpsより密なフレームは間引いて捨てる */
  push(frame: PoseFrame): void {
    const minInterval = 1000 / this.maxFps;
    if (frame.timestampMs - this.lastKeptMs < minInterval) return;
    this.lastKeptMs = frame.timestampMs;
    this.frames.push({
      timestampMs: Math.round(frame.timestampMs),
      landmarks: frame.landmarks.map((p) => ({
        x: round4(p.x),
        y: round4(p.y),
        ...(p.z !== undefined ? { z: round4(p.z) } : {}),
        visibility: round4(p.visibility),
      })),
    });
  }

  get frameCount(): number {
    return this.frames.length;
  }

  /** 記録済みフレームを保存用の形式(pose-series-v1)に変換する */
  toSeries(): PoseSeries {
    return { formatVersion: POSE_SERIES_FORMAT_VERSION, frames: this.frames };
  }

  toJSON(): string {
    return JSON.stringify(this.toSeries());
  }
}

/** 座標を4桁に丸める(ファイルサイズを抑える) */
function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

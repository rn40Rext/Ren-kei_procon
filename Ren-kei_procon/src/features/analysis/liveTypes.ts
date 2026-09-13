/**
 * リアルタイム解析(U-02)で画面と解析ロジックの間を渡る型。
 * DOM の型を解析ロジックに持ち込まないため、映像ソースは抽象化する。
 */
import { Landmark } from "../pose/types";
import { PoseFrameSource } from "../pose/PoseDetector";
import { GameScoreState } from "../rules/gameScore";
import { RhythmEstimate } from "../rules/rhythm";
import { RuleEvent, RuleSnapshot } from "../rules/types";

export type RecordedMedia = { blob: Blob; contentType: string };

/** カメラ(または動画ファイル)の映像ソース。Web では PoseCameraView が実装する。 */
export interface LiveVideoSource {
  /** 推論に渡す映像要素 */
  frame: PoseFrameSource;
  /** 映像の現在時刻[ms](単調増加) */
  nowMs(): number;
  isPlaying(): boolean;
  /** 骨格オーバーレイの描画 */
  draw?(primary: Landmark[] | null, allPoses: Landmark[][]): void;
  /** 録画(カメラのとき) */
  startRecording?(): void;
  stopRecording?(): Promise<RecordedMedia | null>;
  /** 動画ファイルを再生しているとき、その実体 */
  fileMedia?: RecordedMedia | null;
}

export type LiveStatus =
  | "idle" // 未開始
  | "loading" // モデル読み込み中
  | "ready" // 開始できる
  | "analyzing" // 判定中
  | "finalizing" // 保存・スコア確定中
  | "done"
  | "error";

/** 仕様書 13 章のクライアント側エラー/警告コード */
export type LiveWarning =
  | "PERSON_NOT_DETECTED"
  | "LOW_LANDMARK_CONFIDENCE"
  | "MULTIPLE_PERSONS_DETECTED"
  | "NOT_FULL_BODY";

export const LIVE_WARNING_MESSAGES: Record<LiveWarning, string> = {
  PERSON_NOT_DETECTED: "人が映っていません。カメラの前に立ってください",
  LOW_LANDMARK_CONFIDENCE: "検出が不安定です。明るい場所で全身が入るように",
  MULTIPLE_PERSONS_DETECTED: "複数人が映っています。1 人だけ映してください",
  NOT_FULL_BODY: "全身(頭〜足首)が入るように離れてください",
};

/** UI へ渡すスナップショット。毎フレームではなく約 10Hz で更新する。 */
export type LiveSnapshot = {
  status: LiveStatus;
  warning: LiveWarning | null;
  /** 直近 1 秒の推論レート */
  fps: number;
  inferenceMs: number;
  elapsedMs: number;
  game: GameScoreState;
  /** 直近の判定イベント(表示は数百 ms で消す) */
  lastEvent: (RuleEvent & { shownAtMs: number }) | null;
  /** 改善メッセージ(MISS 時に更新) */
  message: string | null;
  gauges: RuleSnapshot[];
  rhythm: RhythmEstimate | null;
  /** ルールセットの出所(remote / bundled)と版 */
  ruleSource: "remote" | "bundled" | null;
  analysisVersion: string | null;
  errorMessage: string | null;
};

/**
 * 練習セッションの集計(docs/design/ai-basic-motion.md 2章の [7])。
 *
 * クライアントはスコアを確定しない。ルール別の成功回数・保持率・実測値を
 * 集めて FN-01 finalizeBasicAnalysis へ送り、totalScore はサーバが算出する
 * (仕様書 10.3 / 3.2、#20)。ここで作る payload は
 * functions/src/analysis/finalizeBasicAnalysis.ts の Request と同形。
 */
import { RhythmEstimate } from "./rhythm";
import { DanceType, MetricValues, RuleEvent } from "./types";
import { GameScoreState } from "./gameScore";

export type ScorePart = "feet" | "hands" | "whole";

export type RuleMetricSummary = {
  attempts: number;
  greatCount: number;
  goodCount: number;
  missCount: number;
  /** 条件を満たしていた時間の割合(HIP_LOW 等の維持系) */
  holdRatio?: number;
  /** 判定に使った値の平均 */
  meanValue?: number;
};

export type FinalizeRequest = {
  videoId: string;
  clientRequestId: string;
  analysisVersion: string;
  danceType: DanceType;
  scorePart: ScorePart;
  events: { ruleId: string; grade: RuleEvent["grade"]; timestampMs: number; value: number }[];
  metrics: Record<string, RuleMetricSummary>;
  rhythm?: { userBpm: number; baseBpm: number };
  gameScore: number;
  maxCombo?: number;
  durationMs: number;
};

/** FN-01 の events 上限(docs/design/api-functions.md)。超えた分は間引く */
export const MAX_EVENTS = 5000;

type HoldTracker = { inRange: number; total: number; sum: number; n: number };

export class SessionAggregator {
  private events: RuleEvent[] = [];
  private hold = new Map<string, HoldTracker>();
  private startMs: number | null = null;
  private lastMs: number | null = null;
  private lastRhythm: RhythmEstimate | null = null;
  private rhythmSamples: { bpm: number; score: number }[] = [];

  constructor(private readonly analysisVersion: string) {}

  reset(): void {
    this.events = [];
    this.hold.clear();
    this.startMs = null;
    this.lastMs = null;
    this.lastRhythm = null;
    this.rhythmSamples = [];
  }

  addEvent(e: RuleEvent): void {
    this.events.push(e);
  }

  /**
   * 維持系ルールの保持率を積算する。毎フレーム呼ぶ。
   * @param key ルール ID
   * @param value 実測値(null なら対象外)
   * @param inRange 条件を満たしているか
   */
  trackHold(key: string, value: number | null, inRange: boolean, timestampMs: number): void {
    if (this.startMs === null) this.startMs = timestampMs;
    const dt = this.lastMs === null ? 0 : Math.max(0, timestampMs - this.lastMs);
    if (value === null) return;
    const t = this.hold.get(key) ?? { inRange: 0, total: 0, sum: 0, n: 0 };
    t.total += dt;
    if (inRange) t.inRange += dt;
    t.sum += value;
    t.n += 1;
    this.hold.set(key, t);
  }

  /** フレーム時刻の更新。trackHold を呼んだ後に呼ぶ。 */
  endFrame(timestampMs: number): void {
    if (this.startMs === null) this.startMs = timestampMs;
    this.lastMs = timestampMs;
  }

  addRhythm(est: RhythmEstimate): void {
    this.lastRhythm = est;
    if (est.userBpm !== null && est.score !== null) {
      this.rhythmSamples.push({ bpm: est.userBpm, score: est.score });
    }
  }

  /** HIP_LOW の保持率判定に使う: 腰・膝の両条件を満たすか */
  static hipLowInRange(values: MetricValues, hipMax = 0.55, kneeMax = 160): { value: number | null; inRange: boolean } {
    const hip = values.normalizedHipHeight;
    const knee = values.kneeAngleDeg;
    if (hip === null || hip === undefined || knee === null || knee === undefined) {
      return { value: null, inRange: false };
    }
    return { value: hip, inRange: hip <= hipMax && knee <= kneeMax };
  }

  get durationMs(): number {
    if (this.startMs === null || this.lastMs === null) return 0;
    return this.lastMs - this.startMs;
  }

  get eventCount(): number {
    return this.events.length;
  }

  /** FN-01 へ送る payload を組み立てる。 */
  build(input: {
    videoId: string;
    clientRequestId: string;
    danceType: DanceType;
    scorePart: ScorePart;
    game: GameScoreState;
  }): FinalizeRequest {
    const metrics: Record<string, RuleMetricSummary> = {};
    for (const e of this.events) {
      const m = metrics[e.ruleId] ?? { attempts: 0, greatCount: 0, goodCount: 0, missCount: 0 };
      m.attempts += 1;
      if (e.grade === "GREAT") m.greatCount += 1;
      else if (e.grade === "GOOD") m.goodCount += 1;
      else m.missCount += 1;
      metrics[e.ruleId] = m;
    }
    for (const [key, t] of this.hold) {
      const m = metrics[key] ?? { attempts: 0, greatCount: 0, goodCount: 0, missCount: 0 };
      if (t.total > 0) m.holdRatio = t.inRange / t.total;
      if (t.n > 0) m.meanValue = t.sum / t.n;
      metrics[key] = m;
    }

    // 上限を超えたら等間隔に間引く(先頭・末尾は残す)
    let events = this.events;
    if (events.length > MAX_EVENTS) {
      const step = events.length / MAX_EVENTS;
      events = Array.from({ length: MAX_EVENTS }, (_, i) => this.events[Math.min(this.events.length - 1, Math.floor(i * step))]);
    }

    let rhythm: FinalizeRequest["rhythm"];
    if (this.rhythmSamples.length > 0) {
      // 推定 BPM の中央値を採る(1 回の外れ値で結果が動かないように)
      const sorted = this.rhythmSamples.map((s) => s.bpm).sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      rhythm = { userBpm: median, baseBpm: this.lastRhythm?.baseBpm ?? 0 };
    }

    return {
      videoId: input.videoId,
      clientRequestId: input.clientRequestId,
      analysisVersion: this.analysisVersion,
      danceType: input.danceType,
      scorePart: input.scorePart,
      events: events.map((e) => ({
        ruleId: e.ruleId,
        grade: e.grade,
        timestampMs: Math.round(e.timestampMs),
        value: Number.isFinite(e.value) ? Number(e.value.toFixed(4)) : 0,
      })),
      metrics,
      ...(rhythm ? { rhythm } : {}),
      gameScore: input.game.score,
      maxCombo: input.game.maxCombo,
      durationMs: Math.round(this.durationMs),
    };
  }
}

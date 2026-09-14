/**
 * Rule Engine の型(仕様書 7.4〜7.9 / docs/design/ai-basic-motion.md 5〜6章)。
 *
 * RuleDefinition は Firestore の analysisRules/{ruleId} にそのまま置ける形にする
 * (仕様書 7.9 のフィールド + 複合条件・左右・男女差の拡張)。
 */

export type RuleState = "NOT_READY" | "READY" | "HOLDING" | "SUCCESS" | "MISS";
export type Grade = "GREAT" | "GOOD" | "MISS";
export type Side = "left" | "right";
export type DanceType = "male" | "female";
/** 採点する部位(U-02 前段で選ぶ)。どのルールを評価するかを決める */
export type ScorePart = "feet" | "hands" | "whole";

/**
 * 判定に使う指標名。metrics.ts が毎フレーム計算する。
 * 左右がある指標は `${metric}:${side}` のキーで格納される。
 */
export type MetricName =
  | "normalizedHandHeight"
  | "normalizedHandVelocity"
  | "normalizedHandHorizontalOffset"
  | "normalizedHipHeight"
  | "kneeAngleDeg"
  | "torsoTiltDeg"
  | "basePostureMargin";

/** 左右別に値を持つ指標 */
export const SIDED_METRICS: ReadonlySet<string> = new Set<MetricName>([
  "normalizedHandHeight",
  "normalizedHandVelocity",
  "normalizedHandHorizontalOffset",
]);

/** 1 フレーム分の指標値。検出できない指標は null。 */
export type MetricValues = Record<string, number | null>;

/** 1 つの条件。min/max は GOOD ライン、idealMin/idealMax は GREAT ライン。 */
export type RuleCondition = {
  metric: MetricName;
  minValue?: number;
  maxValue?: number;
  idealMinValue?: number;
  idealMaxValue?: number;
};

export type RuleDefinition = RuleCondition & {
  /** 例: 'HAND_ABOVE_HEAD' */
  ruleId: string;
  /** 表示名 */
  name: string;
  /** 複合条件(RULE-03 / RULE-06)。指定時は自身の metric/min/max に加えてすべて成立が必要 */
  conditions?: RuleCondition[];
  /** 連続成立が必要な時間[ms] */
  holdDurationMs?: number;
  /** ヒステリシス。解除はこの比率だけ広い範囲で判定する。既定 0.1 */
  releaseMarginRatio?: number;
  /** 発火後、次の HOLDING に入れるまでの待ち時間[ms]。既定 max(hold, 1000) */
  cooldownMs?: number;
  /** READY(条件未成立)がこの時間続いたら MISS を発火し改善メッセージを出す。既定 4000。0 で無効 */
  missAfterMs?: number;
  /** 左右別に判定する指標か。'both' なら左右 2 つの評価器を作る */
  side?: Side | "both";
  /** 適用する踊りの種類。省略時は共通(TBD-03 の暫定: 案 C) */
  danceType?: DanceType | "all";
  /**
   * 適用する採点部位。省略時は全部位で評価する。
   * 「手だけ」を選んだときに脚のルールまで評価すると、脚が映っていない構図で
   * 一生 NOT_READY になり、何も判定されない。
   */
  scoreParts?: ScorePart[];
  /**
   * このルールの評価に脚(膝・足首)が必要か。
   * false のルールだけなら、上半身だけ映っていれば判定できる。
   */
  needsLowerBody?: boolean;
  /** 改善メッセージ(MISS 時) */
  improveMessage?: string;
  /** 達成時のメッセージ */
  goodMessage?: string;
  enabled: boolean;
  /** ルールセットの版。analysisResults.analysisVersion に記録する */
  version: string;
};

export type RuleEvent = {
  ruleId: string;
  grade: Grade;
  timestampMs: number;
  /** 判定に使った実測値(rawMetrics 用)。MISS で値が無いときは NaN */
  value: number;
  side?: Side;
  message?: string;
};

/** 評価器の外部向けスナップショット(UI のゲージ・状態表示用) */
export type RuleSnapshot = {
  ruleId: string;
  side?: Side;
  state: RuleState;
  /** HOLDING の進捗 0〜1 */
  progress: number;
  /** 条件にどれだけ近いか 0〜1(READY 中のゲージ表示用)。1 で成立 */
  closeness: number;
  /** 最後に使った実測値 */
  value: number | null;
};

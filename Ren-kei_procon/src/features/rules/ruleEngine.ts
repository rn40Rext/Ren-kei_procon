/**
 * Rule Engine(状態機械)。仕様書 7.5 / docs/design/ai-basic-motion.md 5章。
 *
 *   NOT_READY ──指標あり──▶ READY ──条件成立──▶ HOLDING ──hold 経過──▶ SUCCESS(発火) ─▶ READY
 *       ▲                     │  ▲                 │
 *       └── 指標が null ───────┘  └── 条件を外れた ──┘
 *                              └── missAfterMs 経過 ──▶ MISS(発火) ─▶ READY
 *
 * 単一フレームで成功判定しない。座標の揺れで GOOD/MISS が反転しないよう
 *  - 連続成立時間(holdDurationMs)
 *  - ヒステリシス(解除は releaseMarginRatio だけ広い範囲で判定)
 * を持つ。純粋な TypeScript で、フィクスチャ JSON を流してユニットテストできる。
 */
import {
  Grade,
  MetricValues,
  RuleCondition,
  RuleDefinition,
  RuleEvent,
  RuleSnapshot,
  RuleState,
  SIDED_METRICS,
  Side,
} from "./types";

const DEFAULT_RELEASE_MARGIN = 0.1;
const DEFAULT_MISS_AFTER_MS = 4000;

/** 指標値のキー。左右のある指標は側を付ける。 */
export function metricKey(metric: string, side?: Side): string {
  return side && SIDED_METRICS.has(metric) ? `${metric}:${side}` : metric;
}

function allConditions(def: RuleDefinition): RuleCondition[] {
  const own: RuleCondition = {
    metric: def.metric,
    minValue: def.minValue,
    maxValue: def.maxValue,
    idealMinValue: def.idealMinValue,
    idealMaxValue: def.idealMaxValue,
  };
  return [own, ...(def.conditions ?? [])];
}

function inRange(c: RuleCondition, value: number, margin: number): boolean {
  // min 側は margin 分だけ低く、max 側は margin 分だけ高く取って解除を渋らせる
  const min = c.minValue !== undefined ? c.minValue - Math.abs(c.minValue) * margin : -Infinity;
  const max = c.maxValue !== undefined ? c.maxValue + Math.abs(c.maxValue) * margin : Infinity;
  return value >= min && value <= max;
}

function inIdeal(c: RuleCondition, value: number): boolean {
  if (c.idealMinValue === undefined && c.idealMaxValue === undefined) {
    // 理想範囲の指定が無い条件は GREAT 判定に影響させない
    return true;
  }
  return value >= (c.idealMinValue ?? -Infinity) && value <= (c.idealMaxValue ?? Infinity);
}

/** 条件にどれだけ近いか(0〜1)。UI のゲージ用。成立していれば 1。 */
function closenessOf(c: RuleCondition, value: number): number {
  if (c.minValue !== undefined && value < c.minValue) {
    const span = Math.max(Math.abs(c.minValue), 0.1);
    return Math.max(0, 1 - (c.minValue - value) / span);
  }
  if (c.maxValue !== undefined && value > c.maxValue) {
    const span = Math.max(Math.abs(c.maxValue) * 0.3, 0.1);
    return Math.max(0, 1 - (value - c.maxValue) / span);
  }
  return 1;
}

export class RuleEvaluator {
  private state: RuleState = "NOT_READY";
  private holdStartMs: number | null = null;
  private readyStartMs: number | null = null;
  private cooldownUntilMs = -Infinity;
  private lastValue: number | null = null;
  private readonly conditions: RuleCondition[];
  private readonly margin: number;
  private readonly hold: number;
  private readonly cooldown: number;
  private readonly missAfter: number;

  constructor(
    readonly def: RuleDefinition,
    readonly side?: Side
  ) {
    this.conditions = allConditions(def);
    this.margin = def.releaseMarginRatio ?? DEFAULT_RELEASE_MARGIN;
    this.hold = def.holdDurationMs ?? 0;
    this.cooldown = def.cooldownMs ?? Math.max(this.hold, 1000);
    this.missAfter = def.missAfterMs ?? DEFAULT_MISS_AFTER_MS;
  }

  get ruleId(): string {
    return this.def.ruleId;
  }

  get currentState(): RuleState {
    return this.state;
  }

  reset(): void {
    this.state = "NOT_READY";
    this.holdStartMs = null;
    this.readyStartMs = null;
    this.cooldownUntilMs = -Infinity;
    this.lastValue = null;
  }

  /** 条件で使う指標値を取り出す。1 つでも null なら null(検出不能)。 */
  private read(values: MetricValues): number[] | null {
    const out: number[] = [];
    for (const c of this.conditions) {
      const v = values[metricKey(c.metric, this.side)];
      if (v === null || v === undefined || !Number.isFinite(v)) return null;
      out.push(v);
    }
    return out;
  }

  /**
   * 毎フレーム呼ぶ。発火があれば RuleEvent を返す。
   * values は metrics.ts が作った 1 フレーム分の指標。
   */
  evaluate(values: MetricValues, timestampMs: number): RuleEvent | null {
    const vs = this.read(values);
    if (vs === null) {
      // 全身が映っていない等 → NOT_READY。誤加点しない
      this.state = "NOT_READY";
      this.holdStartMs = null;
      this.readyStartMs = null;
      this.lastValue = null;
      return null;
    }
    const primary = vs[0];
    this.lastValue = primary;

    const ok = this.conditions.every((c, i) => inRange(c, vs[i], 0));
    const ideal = ok && this.conditions.every((c, i) => inIdeal(c, vs[i]));

    switch (this.state) {
      case "NOT_READY":
      case "SUCCESS":
      case "MISS":
        this.state = "READY";
        this.readyStartMs = timestampMs;
        this.enterHoldingIfOk(ok, timestampMs);
        return null;

      case "READY": {
        if (this.enterHoldingIfOk(ok, timestampMs)) return null;
        // 条件未成立が続いたら MISS を発火して改善メッセージを出す
        if (this.missAfter > 0 && this.readyStartMs !== null && timestampMs - this.readyStartMs >= this.missAfter) {
          this.readyStartMs = timestampMs;
          this.state = "MISS";
          return {
            ruleId: this.def.ruleId,
            grade: "MISS",
            timestampMs,
            value: primary,
            side: this.side,
            message: this.def.improveMessage,
          };
        }
        return null;
      }

      case "HOLDING": {
        // ヒステリシス: 解除は少し広い範囲で判定し、チャタリングを防ぐ
        const stillOk = this.conditions.every((c, i) => inRange(c, vs[i], this.margin));
        if (!stillOk) {
          this.state = "READY";
          this.holdStartMs = null;
          this.readyStartMs = timestampMs;
          return null;
        }
        const held = timestampMs - (this.holdStartMs ?? timestampMs);
        if (held >= this.hold) {
          this.state = "SUCCESS";
          this.holdStartMs = null;
          this.cooldownUntilMs = timestampMs + this.cooldown;
          const grade: Grade = ideal ? "GREAT" : "GOOD";
          return {
            ruleId: this.def.ruleId,
            grade,
            timestampMs,
            value: primary,
            side: this.side,
            message: this.def.goodMessage,
          };
        }
        return null;
      }
    }
  }

  /** 条件成立かつ cooldown 明けなら HOLDING に入る。入ったら true。 */
  private enterHoldingIfOk(ok: boolean, timestampMs: number): boolean {
    if (ok && timestampMs >= this.cooldownUntilMs) {
      this.state = "HOLDING";
      this.holdStartMs = timestampMs;
      this.readyStartMs = null;
      return true;
    }
    return false;
  }

  /** HOLDING の進捗 0〜1。UI の項目ゲージに使う。 */
  progress(timestampMs: number): number {
    if (this.state !== "HOLDING" || this.holdStartMs === null) return 0;
    const need = Math.max(this.hold, 1);
    return Math.max(0, Math.min(1, (timestampMs - this.holdStartMs) / need));
  }

  snapshot(timestampMs: number): RuleSnapshot {
    let closeness = 0;
    if (this.lastValue !== null) {
      closeness = closenessOf(this.conditions[0], this.lastValue);
    }
    return {
      ruleId: this.def.ruleId,
      side: this.side,
      state: this.state,
      progress: this.progress(timestampMs),
      closeness,
      value: this.lastValue,
    };
  }
}

/**
 * ルール定義の集合から評価器を作る。
 *  - enabled: false は評価しない(#21)
 *  - danceType が指定され、かつ一致しないルールは評価しない(TBD-03)
 *  - side: 'both' のルールは左右 2 つの評価器に展開する(#15)
 */
export function createEvaluators(
  defs: RuleDefinition[],
  danceType?: "male" | "female"
): RuleEvaluator[] {
  const out: RuleEvaluator[] = [];
  for (const def of defs) {
    if (!def.enabled) continue;
    if (def.danceType && def.danceType !== "all" && danceType && def.danceType !== danceType) continue;
    if (def.side === "both") {
      out.push(new RuleEvaluator(def, "left"), new RuleEvaluator(def, "right"));
    } else if (def.side === "left" || def.side === "right") {
      out.push(new RuleEvaluator(def, def.side));
    } else {
      out.push(new RuleEvaluator(def));
    }
  }
  return out;
}

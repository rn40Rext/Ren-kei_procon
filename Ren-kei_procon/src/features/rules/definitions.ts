/**
 * ルール定義の既定値(アプリ内バンドル)。
 *
 * 閾値の正本は Firestore の analysisRules/{ruleId}(仕様書 7.9・#21)。
 * オフライン時・取得失敗時はこの既定値へフォールバックする。
 * 数値はすべて暫定(TBD-02。連の指導者ヒアリング後に確定)。
 * docs/design/ai-basic-motion.md 6章の表と一致させること。
 */
import defaults from "./defaultRules.json";
import { RuleDefinition } from "./types";

export type RhythmConfig = {
  /** 基準テンポ[BPM]。TBD-04 の暫定決定: ユーザーが選ぶ(既定はさゝゆり連の実測 112) */
  baseBpm: number;
  /** 許容誤差(比率)。これを超えると 0 点 */
  toleranceRatio: number;
  /** 解析ウィンドウ長[ms] */
  windowMs: number;
  /** 推定を始める最小ウィンドウ長[ms] */
  minWindowMs: number;
  bpmMin: number;
  bpmMax: number;
};

export type RuleSet = {
  /** ルールセット全体の版(analysisResults.analysisVersion に記録) */
  version: string;
  rules: RuleDefinition[];
  rhythm: RhythmConfig;
};

/** RULE-07 は状態機械ではなく RhythmAnalyzer が扱う(docs/design/ai-basic-motion.md 8章)。 */
export const RHYTHM_RULE_ID = "RHYTHM";

export const DEFAULT_RULE_SET: RuleSet = {
  version: defaults.version,
  rules: defaults.rules as RuleDefinition[],
  rhythm: defaults.rhythm,
};

/** 状態機械で評価するルール(RHYTHM を除く)。 */
export function frameRules(set: RuleSet): RuleDefinition[] {
  return set.rules.filter((r) => r.ruleId !== RHYTHM_RULE_ID);
}

export function findRule(set: RuleSet, ruleId: string): RuleDefinition | undefined {
  return set.rules.find((r) => r.ruleId === ruleId);
}

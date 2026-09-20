/**
 * Analysis Score の算出(仕様書 7.7 / docs/design/ai-basic-motion.md 9章)。
 *
 * クライアントから受け取った集計値だけを入力にする純関数。
 * totalScore はここでしか計算しない(クライアントは送ってこない。仕様書 10.3)。
 * 重み付けは未確定(TBD-05)のため、存在する項目の単純平均で仮実装する。
 */

export type Grade = "GREAT" | "GOOD" | "MISS";

export interface RuleMetricSummary {
  attempts: number;
  greatCount: number;
  goodCount: number;
  missCount: number;
  holdRatio?: number;
  meanValue?: number;
}

export interface RhythmInput {
  userBpm: number;
  baseBpm: number;
}

export interface ItemScores {
  handHeightScore?: number;
  hipHeightScore?: number;
  stopScore?: number;
  rhythmScore?: number;
  handPositionScore?: number;
  basePostureScore?: number;
}

export interface FeedbackItem {
  type: "good" | "improve";
  ruleId: string;
  message: string;
}

export interface ScoreResult {
  totalScore: number;
  scores: ItemScores;
  feedback: FeedbackItem[];
}

/** リズムの許容誤差(比率)。docs/design/ai-basic-motion.md 8章の TOLERANCE */
export const RHYTHM_TOLERANCE = 0.15;

/** ルール別のフィードバック文言。表示文言はクライアント辞書が正だが、履歴保存用にここでも持つ */
const FEEDBACK: Record<string, {good: string; improve: string}> = {
  HAND_ABOVE_HEAD: {
    good: "手の高さは安定していました",
    improve: "手が下がりがちです。頭の上まで上げましょう",
  },
  HAND_KEEP: {
    good: "上げた手をしっかり保てていました",
    improve: "手を上げたまま保つ時間を伸ばしましょう",
  },
  HIP_LOW: {
    good: "腰を低く保てていました",
    improve: "腰の位置がやや高いです。膝をもう少し曲げましょう",
  },
  HAND_STOP: {
    good: "手をピタッと止められていました",
    improve: "出した手を止める意識を持ちましょう",
  },
  HAND_POSITION: {
    good: "手の位置が頭上にまとまっていました",
    improve: "手が横に広がりがちです。頭の上あたりにまとめましょう",
  },
  BASE_POSTURE: {
    good: "基本姿勢を長く保てていました",
    improve: "腰を落として上体を起こした姿勢を保ちましょう",
  },
  RHYTHM: {
    good: "テンポが基準に合っていました",
    improve: "基準のテンポとずれています。お囃子に合わせて上下動を",
  },
};

const clamp100 = (v: number): number => Math.max(0, Math.min(100, v));
const round1 = (v: number): number => Math.round(v * 10) / 10;

/**
 * 成功率型のスコア: 100 * (great * 1.0 + good * 0.7) / attempts。
 * @param {RuleMetricSummary | undefined} m ルール別集計
 * @return {number | undefined} attempts が 0 なら undefined(項目なし)
 */
export function successScore(
  m: RuleMetricSummary | undefined,
): number | undefined {
  if (!m || m.attempts <= 0) return undefined;
  return clamp100(
    (100 * (m.greatCount * 1.0 + m.goodCount * 0.7)) / m.attempts,
  );
}

/**
 * 維持率型のスコア: 100 * holdRatio。holdRatio が無ければ成功率型へ落とす。
 * @param {RuleMetricSummary | undefined} m ルール別集計
 * @return {number | undefined} 項目が無ければ undefined
 */
export function holdScore(
  m: RuleMetricSummary | undefined,
): number | undefined {
  if (!m) return undefined;
  if (typeof m.holdRatio === "number" && Number.isFinite(m.holdRatio)) {
    return clamp100(100 * m.holdRatio);
  }
  return successScore(m);
}

/**
 * rhythmScore = clamp(100 * (1 - |user - base| / base / TOLERANCE), 0, 100)
 * @param {RhythmInput | undefined} r 推定 BPM と基準 BPM
 * @return {number | undefined} 入力が無ければ undefined
 */
export function rhythmScore(r: RhythmInput | undefined): number | undefined {
  if (
    !r ||
    !Number.isFinite(r.userBpm) ||
    !Number.isFinite(r.baseBpm) ||
    r.baseBpm <= 0
  ) {
    return undefined;
  }
  const err = Math.abs(r.userBpm - r.baseBpm) / r.baseBpm;
  return clamp100(100 * (1 - err / RHYTHM_TOLERANCE));
}

/**
 * 集計値から Analysis Score を確定する。
 * @param {Record<string, RuleMetricSummary>} metrics ルール別集計
 * @param {RhythmInput | undefined} rhythm リズム推定
 * @return {ScoreResult} 総合・項目別・フィードバック
 */
export function computeAnalysisScore(
  metrics: Record<string, RuleMetricSummary>,
  rhythm?: RhythmInput,
): ScoreResult {
  // 手の高さは RULE-01 と RULE-02(キープ)を合わせて評価する
  const handAttempts =
    (metrics.HAND_ABOVE_HEAD?.attempts ?? 0) +
    (metrics.HAND_KEEP?.attempts ?? 0);
  const hand =
    handAttempts > 0 ?
      successScore({
        attempts: handAttempts,
        greatCount:
            (metrics.HAND_ABOVE_HEAD?.greatCount ?? 0) +
            (metrics.HAND_KEEP?.greatCount ?? 0),
        goodCount:
            (metrics.HAND_ABOVE_HEAD?.goodCount ?? 0) +
            (metrics.HAND_KEEP?.goodCount ?? 0),
        missCount:
            (metrics.HAND_ABOVE_HEAD?.missCount ?? 0) +
            (metrics.HAND_KEEP?.missCount ?? 0),
      }) :
      undefined;

  const scores: ItemScores = {};
  if (hand !== undefined) scores.handHeightScore = round1(hand);
  const hip = holdScore(metrics.HIP_LOW);
  if (hip !== undefined) scores.hipHeightScore = round1(hip);
  const stop = successScore(metrics.HAND_STOP);
  if (stop !== undefined) scores.stopScore = round1(stop);
  const rhythmS = rhythmScore(rhythm);
  if (rhythmS !== undefined) scores.rhythmScore = round1(rhythmS);
  const pos = successScore(metrics.HAND_POSITION);
  if (pos !== undefined) scores.handPositionScore = round1(pos);
  const posture = holdScore(metrics.BASE_POSTURE);
  if (posture !== undefined) scores.basePostureScore = round1(posture);

  // 総合 = 仕様書 7.7 の 4 項目(手の高さ / 腰 / 停止 / リズム)の単純平均(TBD-05)。
  // 手の位置・基本姿勢は項目別に出すが、重みが決まるまで総合には入れない
  const core = [
    scores.handHeightScore,
    scores.hipHeightScore,
    scores.stopScore,
    scores.rhythmScore,
  ].filter((v): v is number => typeof v === "number");
  const totalScore =
    core.length === 0 ?
      0 :
      round1(core.reduce((a, b) => a + b, 0) / core.length);

  const feedback: FeedbackItem[] = [];
  const push = (ruleId: string, score: number | undefined) => {
    if (score === undefined) return;
    const text = FEEDBACK[ruleId];
    if (!text) return;
    feedback.push(
      score >= 70 ?
        {type: "good", ruleId, message: text.good} :
        {type: "improve", ruleId, message: text.improve},
    );
  };
  push("HAND_ABOVE_HEAD", scores.handHeightScore);
  push("HIP_LOW", scores.hipHeightScore);
  push("HAND_STOP", scores.stopScore);
  push("RHYTHM", scores.rhythmScore);
  push("HAND_POSITION", scores.handPositionScore);
  push("BASE_POSTURE", scores.basePostureScore);
  // 改善点を先に、できている点を後に(何を直せばよいかが先に目に入るように)
  feedback.sort((a, b) =>
    a.type === b.type ? 0 : a.type === "improve" ? -1 : 1,
  );

  return {totalScore, scores, feedback};
}

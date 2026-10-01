/**
 * FN-01 finalizeBasicAnalysis
 *
 * 練習セッション終了時にクライアントから集計値を受け取り、サーバ側で
 * Analysis Score を確定して analysisResults / growthRecords へ保存する
 * (仕様書 7.7 / 10.3 / 12.1、docs/design/api-functions.md FN-01)。
 * クライアントが totalScore を送ってきても無視する。
 */
import {HttpsError, onCall} from "firebase-functions/v2/https";
import {FieldValue, getFirestore} from "firebase-admin/firestore";
import {ErrorCode, httpsErrorFor} from "../lib/errors";
import {requireAuth, requireString} from "../lib/guards";
import {
  Grade,
  RhythmInput,
  RuleMetricSummary,
  computeAnalysisScore,
} from "./score";

/** events の件数上限(docs/design/api-functions.md) */
const MAX_EVENTS = 5000;
const GRADES: ReadonlySet<string> = new Set<Grade>(["GREAT", "GOOD", "MISS"]);
const DANCE_TYPES = new Set(["male", "female"]);
const SCORE_PARTS = new Set(["feet", "hands", "whole"]);
/**
 * events の timestampMs が durationMs を超えてよい猶予(ms)。
 * 最終イベントの到着が非同期でわずかに遅れる分の余白(#102)。
 */
const TIMESTAMP_GRACE_MS = 3000;

export type EventInput = {
  ruleId: string;
  grade: Grade;
  timestampMs: number;
  value: number;
};

interface FinalizeRequest {
  videoId: string;
  clientRequestId: string;
  analysisVersion: string;
  danceType: "male" | "female";
  scorePart: "feet" | "hands" | "whole";
  events: EventInput[];
  metrics: Record<string, RuleMetricSummary>;
  rhythm?: RhythmInput;
  gameScore: number;
  maxCombo?: number;
  durationMs: number;
}

/**
 * 引数名を付けた invalid-argument を作る。
 * @param {string} name 引数名
 * @return {HttpsError} エラー
 */
function invalid(name: string): HttpsError {
  return new HttpsError(
    "invalid-argument",
    `${ErrorCode.INVALID_ARGUMENT}:${name}`,
  );
}

const isFiniteNumber = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

/**
 * events の timestampMs が durationMs と矛盾していないか検証する(#102)。
 * クライアントが送るmetrics自体は改ざんされ得るため、events側の整合性を
 * 軽量にチェックする(完全な改ざん防止ではない。docs/design/api-functions.md参照)。
 * @param {EventInput[]} events セッション中に発火したイベント
 * @param {number} durationMs 申告されたセッション長
 */
export function assertPlausibleEventTimestamps(
  events: EventInput[],
  durationMs: number,
): void {
  const upperBound = durationMs + TIMESTAMP_GRACE_MS;
  for (let i = 0; i < events.length; i++) {
    const t = events[i].timestampMs;
    if (t < 0 || t > upperBound) {
      throw invalid(`events[${i}].timestampMs`);
    }
  }
}

/**
 * events からルールごとのGREAT/GOOD/MISS件数を数え直す。
 * @param {EventInput[]} events セッション中に発火したイベント
 * @return {object} ルールID別の{greatCount, goodCount, missCount}
 */
export function deriveGradeCounts(
  events: EventInput[],
): Record<string, {greatCount: number; goodCount: number; missCount: number}> {
  const result: Record<
    string,
    {greatCount: number; goodCount: number; missCount: number}
  > = {};
  for (const e of events) {
    if (!result[e.ruleId]) {
      result[e.ruleId] = {greatCount: 0, goodCount: 0, missCount: 0};
    }
    if (e.grade === "GREAT") result[e.ruleId].greatCount++;
    else if (e.grade === "GOOD") result[e.ruleId].goodCount++;
    else result[e.ruleId].missCount++;
  }
  return result;
}

/**
 * クライアント申告のmetrics(greatCount/goodCount/missCount/attempts)を、
 * events から数え直した値で上書きする(#102)。events に無いルールのカウントは
 * 0に矯正され、attemptsは数え直した合計を下回れないようにする。これにより
 * 「eventsを伴わずmetricsだけで高スコアを申告する」forgeryを塞ぐ。
 * holdRatio(HIP_LOW/BASE_POSTURE)とrhythm(userBpm)はeventsから再現できないため
 * この関数の対象外(残る既知の制約。docs/design/api-functions.md参照)。
 * @param {Record<string, RuleMetricSummary>} metrics クライアント申告の集計値
 * @param {EventInput[]} events セッション中に発火したイベント
 * @return {Record<string, RuleMetricSummary>} 検証済みの集計値
 */
export function reconcileMetricsWithEvents(
  metrics: Record<string, RuleMetricSummary>,
  events: EventInput[],
): Record<string, RuleMetricSummary> {
  const derived = deriveGradeCounts(events);
  const result: Record<string, RuleMetricSummary> = {};
  for (const [ruleId, m] of Object.entries(metrics)) {
    const counts = derived[ruleId] ?? {
      greatCount: 0,
      goodCount: 0,
      missCount: 0,
    };
    const derivedTotal =
      counts.greatCount + counts.goodCount + counts.missCount;
    result[ruleId] = {
      ...m,
      ...counts,
      attempts: Math.max(m.attempts, derivedTotal),
    };
  }
  return result;
}

/**
 * リクエストを検証して型を確定する。
 * @param {unknown} data Callable の生データ
 * @return {FinalizeRequest} 検証済みリクエスト
 */
function parseRequest(data: unknown): FinalizeRequest {
  const d = (data ?? {}) as Record<string, unknown>;
  const videoId = requireString(d.videoId, "videoId");
  const clientRequestId = requireString(d.clientRequestId, "clientRequestId");
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(clientRequestId)) {
    throw invalid("clientRequestId");
  }
  const analysisVersion = requireString(d.analysisVersion, "analysisVersion");
  if (typeof d.danceType !== "string" || !DANCE_TYPES.has(d.danceType)) {
    throw invalid("danceType");
  }
  if (typeof d.scorePart !== "string" || !SCORE_PARTS.has(d.scorePart)) {
    throw invalid("scorePart");
  }
  if (!Array.isArray(d.events)) throw invalid("events");
  if (d.events.length > MAX_EVENTS) throw invalid("events");
  const events = d.events.map((e, i) => {
    const ev = (e ?? {}) as Record<string, unknown>;
    if (
      typeof ev.ruleId !== "string" ||
      typeof ev.grade !== "string" ||
      !GRADES.has(ev.grade) ||
      !isFiniteNumber(ev.timestampMs)
    ) {
      throw invalid(`events[${i}]`);
    }
    return {
      ruleId: ev.ruleId,
      grade: ev.grade as Grade,
      timestampMs: ev.timestampMs,
      value: isFiniteNumber(ev.value) ? ev.value : 0,
    };
  });
  if (typeof d.metrics !== "object" || d.metrics === null) {
    throw invalid("metrics");
  }
  const metrics: Record<string, RuleMetricSummary> = {};
  for (const [ruleId, raw] of Object.entries(
    d.metrics as Record<string, unknown>,
  )) {
    const m = (raw ?? {}) as Record<string, unknown>;
    const nonNeg = (v: unknown) => (isFiniteNumber(v) && v >= 0 ? v : 0);
    metrics[ruleId] = {
      attempts: nonNeg(m.attempts),
      greatCount: nonNeg(m.greatCount),
      goodCount: nonNeg(m.goodCount),
      missCount: nonNeg(m.missCount),
      ...(isFiniteNumber(m.holdRatio) ?
        {holdRatio: Math.max(0, Math.min(1, m.holdRatio))} :
        {}),
      ...(isFiniteNumber(m.meanValue) ? {meanValue: m.meanValue} : {}),
    };
    // 成功数が試行数を超えるような矛盾は却下する
    if (
      metrics[ruleId].greatCount +
        metrics[ruleId].goodCount +
        metrics[ruleId].missCount >
      metrics[ruleId].attempts
    ) {
      throw invalid(`metrics.${ruleId}`);
    }
  }
  let rhythm: RhythmInput | undefined;
  if (d.rhythm !== undefined && d.rhythm !== null) {
    const r = d.rhythm as Record<string, unknown>;
    if (
      !isFiniteNumber(r.userBpm) ||
      !isFiniteNumber(r.baseBpm) ||
      r.baseBpm <= 0
    ) {
      throw invalid("rhythm");
    }
    rhythm = {userBpm: r.userBpm, baseBpm: r.baseBpm};
  }
  if (!isFiniteNumber(d.gameScore) || d.gameScore < 0) {
    throw invalid("gameScore");
  }
  if (!isFiniteNumber(d.durationMs) || d.durationMs < 0) {
    throw invalid("durationMs");
  }
  return {
    videoId,
    clientRequestId,
    analysisVersion,
    danceType: d.danceType as FinalizeRequest["danceType"],
    scorePart: d.scorePart as FinalizeRequest["scorePart"],
    events,
    metrics,
    rhythm,
    gameScore: d.gameScore,
    maxCombo: isFiniteNumber(d.maxCombo) ? d.maxCombo : undefined,
    durationMs: d.durationMs,
  };
}

export const finalizeBasicAnalysis = onCall(async (request) => {
  const uid = requireAuth(request);
  const req = parseRequest(request.data);
  // events自体の妥当性を検証したうえで、metricsの申告値をeventsで上書きする
  // (#102: クライアント申告のmetricsだけを信用しない)
  assertPlausibleEventTimestamps(req.events, req.durationMs);
  req.metrics = reconcileMetricsWithEvents(req.metrics, req.events);
  const db = getFirestore();

  // 他人の動画に結果を付けられない
  const videoRef = db.collection("videos").doc(req.videoId);
  const videoSnap = await videoRef.get();
  if (!videoSnap.exists) {
    throw new HttpsError("not-found", `${ErrorCode.INVALID_ARGUMENT}:videoId`);
  }
  if (videoSnap.data()?.userId !== uid) {
    throw httpsErrorFor(ErrorCode.FORBIDDEN);
  }

  // 冪等性: 同じ clientRequestId は同じ analysisId に落とす(再試行で重複ドキュメントを作らない)
  const analysisRef = db
    .collection("analysisResults")
    .doc(`${uid}_${req.clientRequestId}`);
  const growthRef = db
    .collection("users")
    .doc(uid)
    .collection("growthRecords")
    .doc(analysisRef.id);

  const counts = req.events.reduce(
    (acc, e) => {
      acc[e.grade] += 1;
      return acc;
    },
    {GREAT: 0, GOOD: 0, MISS: 0} as Record<Grade, number>,
  );
  const {totalScore, scores, feedback} = computeAnalysisScore(
    req.metrics,
    req.rhythm,
  );

  const result = await db.runTransaction(async (tx) => {
    const existing = await tx.get(analysisRef);
    if (existing.exists) {
      const data = existing.data() ?? {};
      return {
        analysisId: analysisRef.id,
        totalScore: data.totalScore as number,
        scores: {
          handHeightScore: data.handHeightScore,
          hipHeightScore: data.hipHeightScore,
          stopScore: data.stopScore,
          rhythmScore: data.rhythmScore,
          handPositionScore: data.handPositionScore,
          basePostureScore: data.basePostureScore,
        },
        feedback: data.feedback ?? [],
        analysisVersion: data.analysisVersion,
        duplicate: true,
      };
    }
    tx.set(analysisRef, {
      videoId: req.videoId,
      userId: uid,
      clientRequestId: req.clientRequestId,
      totalScore,
      gameScore: req.gameScore,
      ...scores,
      greatCount: counts.GREAT,
      goodCount: counts.GOOD,
      missCount: counts.MISS,
      ...(req.maxCombo !== undefined ? {maxCombo: req.maxCombo} : {}),
      // 判定根拠の数値(再検証・閾値チューニング用)。events は件数が多いので集計だけ残す
      rawMetrics: {
        metrics: req.metrics,
        ...(req.rhythm ? {rhythm: req.rhythm} : {}),
        eventCount: req.events.length,
        danceType: req.danceType,
        scorePart: req.scorePart,
        durationMs: req.durationMs,
      },
      feedback,
      analysisVersion: req.analysisVersion,
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.set(growthRef, {
      analysisId: analysisRef.id,
      score: totalScore,
      analysisVersion: req.analysisVersion,
      date: FieldValue.serverTimestamp(),
    });
    tx.update(videoRef, {
      analysisStatus: "completed",
      latestAnalysisId: analysisRef.id,
    });
    return {
      analysisId: analysisRef.id,
      totalScore,
      scores,
      feedback,
      analysisVersion: req.analysisVersion,
      duplicate: false,
    };
  });

  return result;
});

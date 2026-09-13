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

interface FinalizeRequest {
  videoId: string;
  clientRequestId: string;
  analysisVersion: string;
  danceType: "male" | "female";
  scorePart: "feet" | "hands" | "whole";
  events: {ruleId: string; grade: Grade; timestampMs: number; value: number}[];
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

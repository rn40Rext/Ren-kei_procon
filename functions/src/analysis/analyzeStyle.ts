/**
 * FN-02 analyzeStyle
 *
 * ユーザー動画の Embedding と各連の代表 Embedding をコサイン類似度で
 * 比較し、上位 N 件を styleAnalysisResults へ保存する。
 * 仕様書 8.2 / 8.5 / 12.4、docs/design/ai-style-similarity.md 5章。
 *
 * AI①（基本動作）の結果はこの関数では一切触らない。スタイル診断が
 * 失敗しても基本動作の結果は保持され、再試行できる（仕様書 13章）。
 */
import {HttpsError, onCall} from "firebase-functions/v2/https";
import {FieldValue, Timestamp} from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import {db} from "../lib/firebase";
import {ErrorCode} from "../lib/errors";
import {requireAuth, requireString} from "../lib/guards";
import {
  COLLECTIONS,
  EmbeddingRef,
  RenStyleProfile,
  StyleSimilarityItem,
} from "../lib/types";
import {getCurrentStyleEncoder} from "../style/encoder";
import {
  PoseSeriesNotFoundError,
  loadPoseSeries,
} from "../style/poseSeriesStore";
import {rebuildRenStyleProfile} from "../style/profile";
import {cosineSimilarity} from "../style/vector";

const DEFAULT_TOP_N = 3;
const MAX_TOP_N = 10;

/**
 * 版が一致する inline Embedding を取り出す。
 * @param {object} data 代表 Embedding ドキュメント
 * @param {string} version 期待する Embedding 版
 * @param {number} dim 期待する次元数
 * @return {number[] | null} 使えなければ null
 */
function profileVector(
  data: Partial<RenStyleProfile>,
  version: string,
  dim: number,
): number[] | null {
  if (data.embeddingVersion !== version) return null;
  const emb = data.embeddingRef as EmbeddingRef | undefined;
  if (!emb || emb.kind !== "inline" || !Array.isArray(emb.vector)) return null;
  return emb.vector.length === dim ? emb.vector : null;
}

export const analyzeStyle = onCall(async (request) => {
  const uid = requireAuth(request);
  const videoId = requireString(request.data?.videoId, "videoId");
  const rawTopN = Number(request.data?.topN ?? DEFAULT_TOP_N);
  const topN = Math.min(
    MAX_TOP_N,
    Math.max(1, Number.isFinite(rawTopN) ? Math.floor(rawTopN) : DEFAULT_TOP_N),
  );

  // 他人の動画は解析できない
  const videoSnap = await db.collection(COLLECTIONS.videos).doc(videoId).get();
  if (!videoSnap.exists) {
    throw new HttpsError("not-found", `${ErrorCode.INVALID_ARGUMENT}:videoId`);
  }
  const video = videoSnap.data() ?? {};
  if (video.userId !== uid) {
    throw new HttpsError("permission-denied", ErrorCode.FORBIDDEN);
  }

  // モデルが使えないときは結果ドキュメントを作らずに返す
  // （AI① の結果には触れないまま、スタイル診断だけ再試行できる）
  const encoder = getCurrentStyleEncoder();
  if (!encoder) {
    throw new HttpsError("unavailable", ErrorCode.STYLE_MODEL_UNAVAILABLE);
  }

  const resultRef = db.collection(COLLECTIONS.styleAnalysisResults).doc();
  await resultRef.set({
    userId: uid,
    videoId,
    modelVersion: encoder.version,
    status: "processing",
    results: [],
    errorCode: null,
    createdAt: FieldValue.serverTimestamp(),
    completedAt: null,
  });

  // 失敗を結果ドキュメントへ書いてから HttpsError を投げる
  const fail = async (
    code: (typeof ErrorCode)[keyof typeof ErrorCode],
    httpsCode: "internal" | "failed-precondition",
  ): Promise<never> => {
    await resultRef.update({
      status: "failed",
      errorCode: code,
      completedAt: Timestamp.now(),
    });
    throw new HttpsError(httpsCode, code);
  };

  const poseSeriesPath = video.poseSeriesPath;
  if (typeof poseSeriesPath !== "string" || poseSeriesPath === "") {
    return fail(ErrorCode.POSE_SERIES_NOT_FOUND, "failed-precondition");
  }

  let userVector: number[];
  try {
    const series = await loadPoseSeries(poseSeriesPath);
    userVector = encoder.encode(series).vector;
  } catch (e) {
    if (e instanceof PoseSeriesNotFoundError) {
      return fail(ErrorCode.POSE_SERIES_NOT_FOUND, "failed-precondition");
    }
    logger.error("failed to encode user video", {videoId, error: String(e)});
    return fail(ErrorCode.ANALYSIS_FAILED, "internal");
  }

  const profileSnap = await db
    .collection(COLLECTIONS.renStyleProfiles)
    .get();

  const items: StyleSimilarityItem[] = [];
  for (const doc of profileSnap.docs) {
    const data = doc.data() as Partial<RenStyleProfile>;
    let vector = profileVector(data, encoder.version, encoder.dim);

    if (!vector) {
      // 版が違う代表 Embedding は比較してはいけない。
      // 値としては正常に見えてしまうため、必ず再計算してから使う。
      logger.info("rebuilding profile with mismatched version", {
        renId: doc.id,
        stored: data.embeddingVersion ?? null,
        expected: encoder.version,
      });
      try {
        await rebuildRenStyleProfile(doc.id);
        const fresh = await doc.ref.get();
        vector = profileVector(
          (fresh.data() ?? {}) as Partial<RenStyleProfile>,
          encoder.version,
          encoder.dim,
        );
      } catch (e) {
        logger.warn("could not rebuild profile", {
          renId: doc.id,
          error: String(e),
        });
      }
    }
    if (!vector) continue;

    const renSnap = await db.collection(COLLECTIONS.ren).doc(doc.id).get();
    items.push({
      renId: doc.id,
      renName: (renSnap.data()?.name as string | undefined) ?? doc.id,
      similarity: cosineSimilarity(userVector, vector),
      sampleCount: Number(data.sampleCount ?? 0),
    });
  }

  if (items.length === 0) {
    return fail(ErrorCode.STYLE_PROFILE_NOT_READY, "failed-precondition");
  }

  items.sort((a, b) => b.similarity - a.similarity);
  const results = items.slice(0, topN);

  await resultRef.update({
    status: "completed",
    results,
    completedAt: Timestamp.now(),
  });

  return {
    status: "completed" as const,
    styleAnalysisId: resultRef.id,
    modelVersion: encoder.version,
    results,
  };
});

/**
 * FN-08 registerStyleReference
 *
 * 連の参照動画から Embedding を生成し renStyleReferences へ保存する。
 * 呼べるのは対象連の管理者のみ。
 */
import {HttpsError, onCall} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {FieldValue} from "firebase-admin/firestore";
import {db} from "../lib/firebase";
import {ErrorCode} from "../lib/errors";
import {requireAuth, requireRenAdmin, requireString} from "../lib/guards";
import {COLLECTIONS} from "../lib/types";
import {getCurrentStyleEncoder} from "./encoder";
import {PoseSeriesNotFoundError, loadPoseSeries} from "./poseSeriesStore";

/**
 * 参照動画の姿勢系列を置いてよいパスか検証する。
 * 他の連のパスを指定して混入させることを防ぐ。
 * @param {string} path Storage パス
 * @param {string} renId 対象の連
 * @return {void}
 */
function assertReferencePath(path: string, renId: string): void {
  const prefix = `ren/${renId}/styleReferences/`;
  if (!path.startsWith(prefix) || path.includes("..")) {
    throw new HttpsError(
      "invalid-argument",
      `${ErrorCode.INVALID_ARGUMENT}:poseSeriesPath`,
    );
  }
}

export const registerStyleReference = onCall(async (request) => {
  const uid = requireAuth(request);
  const data = request.data ?? {};
  const renId = requireString(data.renId, "renId");
  const videoId = requireString(data.videoId, "videoId");
  const poseSeriesPath = requireString(data.poseSeriesPath, "poseSeriesPath");
  const scope = requireString(data.consentScope, "consentScope");
  const providerUserId =
    typeof data.userId === "string" ? data.userId : null;
  const approved = data.approved === true;

  assertReferencePath(poseSeriesPath, renId);
  await requireRenAdmin(uid, renId);

  // 提供者の同意が無い参照は受け付けない（仕様書 14.3）
  if (data.consentObtained !== true) {
    throw new HttpsError(
      "failed-precondition",
      `${ErrorCode.INVALID_ARGUMENT}:consentObtained`,
    );
  }

  const encoder = getCurrentStyleEncoder();
  if (!encoder) {
    throw new HttpsError("unavailable", ErrorCode.STYLE_MODEL_UNAVAILABLE);
  }

  let vector: number[];
  try {
    const series = await loadPoseSeries(poseSeriesPath);
    vector = encoder.encode(series).vector;
  } catch (e) {
    if (e instanceof PoseSeriesNotFoundError) {
      throw new HttpsError(
        "failed-precondition",
        ErrorCode.POSE_SERIES_NOT_FOUND,
      );
    }
    logger.error("failed to encode style reference", {
      poseSeriesPath,
      error: String(e),
    });
    throw new HttpsError("internal", ErrorCode.ANALYSIS_FAILED);
  }

  const ref = db.collection(COLLECTIONS.renStyleReferences).doc();
  await ref.set({
    renId,
    userId: providerUserId,
    videoId,
    poseSeriesPath,
    embeddingVersion: encoder.version,
    embeddingRef: {kind: "inline", vector},
    approved,
    consent: {
      obtained: true,
      scope,
      obtainedAt: FieldValue.serverTimestamp(),
    },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {
    referenceId: ref.id,
    embeddingVersion: encoder.version,
    dim: vector.length,
    approved,
  };
});

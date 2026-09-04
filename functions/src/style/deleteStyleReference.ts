/**
 * FN-09 deleteStyleReference
 *
 * 参照動画の提供者が利用の撤回を求めた場合に使う（仕様書 14.3）。
 * renStyleReferences の削除と姿勢系列の削除をセットで行い、
 * 代表 Embedding はトリガ（onStyleReferenceWritten）が再計算する。
 */
import {HttpsError, onCall} from "firebase-functions/v2/https";
import {db} from "../lib/firebase";
import {ErrorCode} from "../lib/errors";
import {requireAuth, requireRenAdmin, requireString} from "../lib/guards";
import {COLLECTIONS, RenStyleReference} from "../lib/types";
import {deletePoseSeries} from "./poseSeriesStore";

export const deleteStyleReference = onCall(async (request) => {
  const uid = requireAuth(request);
  const referenceId = requireString(request.data?.referenceId, "referenceId");

  const ref = db.collection(COLLECTIONS.renStyleReferences).doc(referenceId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", ErrorCode.STYLE_REFERENCE_NOT_FOUND);
  }
  const data = snap.data() as Partial<RenStyleReference>;
  if (!data.renId) {
    throw new HttpsError("internal", ErrorCode.ANALYSIS_FAILED);
  }
  await requireRenAdmin(uid, data.renId);

  if (data.poseSeriesPath) {
    await deletePoseSeries(data.poseSeriesPath);
  }
  await ref.delete();

  return {referenceId, renId: data.renId};
});

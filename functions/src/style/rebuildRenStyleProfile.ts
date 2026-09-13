/**
 * FN-07 rebuildRenStyleProfile
 *
 * 承認済み参照から連の代表 Embedding を作り直す。連管理者のみ。
 */
import {HttpsError, onCall} from "firebase-functions/v2/https";
import {ErrorCode} from "../lib/errors";
import {requireAuth, requireRenAdmin, requireString} from "../lib/guards";
import {
  NoApprovedReferenceError,
  StyleModelUnavailableError,
  rebuildRenStyleProfile as rebuild,
} from "./profile";

export const rebuildRenStyleProfile = onCall(async (request) => {
  const uid = requireAuth(request);
  const renId = requireString(request.data?.renId, "renId");
  await requireRenAdmin(uid, renId);

  try {
    const result = await rebuild(renId);
    return result;
  } catch (e) {
    if (e instanceof NoApprovedReferenceError) {
      throw new HttpsError(
        "failed-precondition",
        ErrorCode.STYLE_REFERENCE_NOT_FOUND,
      );
    }
    if (e instanceof StyleModelUnavailableError) {
      throw new HttpsError("unavailable", ErrorCode.STYLE_MODEL_UNAVAILABLE);
    }
    throw new HttpsError("internal", ErrorCode.ANALYSIS_FAILED);
  }
});

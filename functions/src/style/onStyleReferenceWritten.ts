/**
 * renStyleReferences の変更で代表 Embedding を作り直すトリガ。
 *
 * 承認 / 承認取り消し / 削除 / Embedding 更新のいずれでも
 * renStyleProfiles を実データに合わせ直す。
 */
import {onDocumentWritten} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import {RenStyleReference} from "../lib/types";
import {rebuildRenStyleProfile} from "./profile";

/**
 * 代表 Embedding に影響する変更か。
 * @param {object} before 変更前のドキュメント
 * @param {object} after 変更後のドキュメント
 * @return {boolean} 再計算が必要なら true
 */
function affectsProfile(
  before: Partial<RenStyleReference> | undefined,
  after: Partial<RenStyleReference> | undefined,
): boolean {
  if (!before || !after) return true; // 作成・削除
  if (before.approved !== after.approved) return true;
  if (before.embeddingVersion !== after.embeddingVersion) return true;
  if (before.consent?.obtained !== after.consent?.obtained) return true;
  return false;
}

export const onStyleReferenceWritten = onDocumentWritten(
  "renStyleReferences/{referenceId}",
  async (event) => {
    const before = event.data?.before.data() as
      | Partial<RenStyleReference>
      | undefined;
    const after = event.data?.after.data() as
      | Partial<RenStyleReference>
      | undefined;
    if (!affectsProfile(before, after)) return;

    const renIds = new Set<string>();
    if (before?.renId) renIds.add(before.renId);
    if (after?.renId) renIds.add(after.renId);

    for (const renId of renIds) {
      try {
        // 承認済みが 0 件になったら代表 Embedding は消す
        // （古い代表が残り続けるほうが危険）
        await rebuildRenStyleProfile(renId, {deleteWhenEmpty: true});
      } catch (e) {
        logger.error("failed to rebuild style profile", {
          renId,
          error: String(e),
        });
      }
    }
  },
);

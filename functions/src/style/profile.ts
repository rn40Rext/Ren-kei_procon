/**
 * 代表 Embedding（renStyleProfiles）の再構築。
 *
 * 仕様書 8.4 / docs/design/ai-style-similarity.md 4章。
 * approved == true の参照だけを平均し、L2 正規化して保存する。
 */
import {FieldValue, Timestamp} from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import {db} from "../lib/firebase";
import {COLLECTIONS, EmbeddingRef, RenStyleReference} from "../lib/types";
import {getCurrentStyleEncoder} from "./encoder";
import {loadPoseSeries} from "./poseSeriesStore";
import {meanEmbedding} from "./vector";

/** エンコーダが利用できない（STYLE_MODEL_UNAVAILABLE 相当） */
export class StyleModelUnavailableError extends Error {
  /** エンコーダ未配備・停止中 */
  constructor() {
    super("style encoder is not available");
    this.name = "StyleModelUnavailableError";
  }
}

/** 承認済みの参照が 1 件も無い */
export class NoApprovedReferenceError extends Error {
  /**
   * @param {string} renId 対象の連
   */
  constructor(renId: string) {
    super(`no approved style reference for ren ${renId}`);
    this.name = "NoApprovedReferenceError";
  }
}

export type RebuildResult = {
  renId: string;
  embeddingVersion: string;
  sampleCount: number;
};

/**
 * inline Embedding として妥当か。次元と版が現行と一致するかを見る。
 * @param {object} ref 参照ドキュメント
 * @param {string} version 期待する Embedding 版
 * @param {number} dim 期待する次元数
 * @return {number[] | null} 使えなければ null
 */
function usableEmbedding(
  ref: Partial<RenStyleReference>,
  version: string,
  dim: number,
): number[] | null {
  if (ref.embeddingVersion !== version) return null;
  const emb = ref.embeddingRef as EmbeddingRef | undefined;
  if (!emb || emb.kind !== "inline" || !Array.isArray(emb.vector)) return null;
  if (emb.vector.length !== dim) return null;
  if (!emb.vector.every((v) => Number.isFinite(v))) return null;
  return emb.vector;
}

/**
 * 連の代表 Embedding を再計算して保存する。
 *
 * 版が古い参照は姿勢系列から再エンコードし、参照側も更新する
 * （版が違う Embedding を混ぜて平均すると無意味なベクトルになる）。
 * @param {string} renId 対象の連
 * @param {object} options deleteWhenEmpty: 承認済み参照が
 *   0 件のとき例外ではなく代表 Embedding の削除で処理する
 * @return {Promise<RebuildResult | null>} 削除した場合は null
 */
export async function rebuildRenStyleProfile(
  renId: string,
  options: {deleteWhenEmpty?: boolean} = {},
): Promise<RebuildResult | null> {
  const encoder = getCurrentStyleEncoder();
  if (!encoder) throw new StyleModelUnavailableError();

  const snap = await db
    .collection(COLLECTIONS.renStyleReferences)
    .where("renId", "==", renId)
    .where("approved", "==", true)
    .get();

  const vectors: number[][] = [];
  for (const doc of snap.docs) {
    const data = doc.data() as Partial<RenStyleReference>;
    // 同意が撤回された参照は採用しない（仕様書 14.3）
    if (data.consent?.obtained === false) continue;

    const cached = usableEmbedding(data, encoder.version, encoder.dim);
    if (cached) {
      vectors.push(cached);
      continue;
    }
    // 版が古い / 壊れている → 姿勢系列から再エンコードする
    if (!data.poseSeriesPath) {
      logger.warn("style reference has no poseSeriesPath", {id: doc.id});
      continue;
    }
    try {
      const series = await loadPoseSeries(data.poseSeriesPath);
      const encoded = encoder.encode(series);
      await doc.ref.update({
        embeddingVersion: encoded.version,
        embeddingRef: {kind: "inline", vector: encoded.vector},
        updatedAt: FieldValue.serverTimestamp(),
      });
      vectors.push(encoded.vector);
    } catch (e) {
      logger.error("failed to re-encode style reference", {
        id: doc.id,
        error: String(e),
      });
    }
  }

  const profileRef = db.collection(COLLECTIONS.renStyleProfiles).doc(renId);

  if (vectors.length === 0) {
    if (options.deleteWhenEmpty) {
      await profileRef.delete();
      logger.info("deleted style profile (no approved reference)", {renId});
      return null;
    }
    throw new NoApprovedReferenceError(renId);
  }

  const representative = meanEmbedding(vectors);
  await profileRef.set({
    renId,
    embeddingVersion: encoder.version,
    embeddingRef: {kind: "inline", vector: representative},
    sampleCount: vectors.length,
    updatedAt: Timestamp.now(),
  });

  return {
    renId,
    embeddingVersion: encoder.version,
    sampleCount: vectors.length,
  };
}

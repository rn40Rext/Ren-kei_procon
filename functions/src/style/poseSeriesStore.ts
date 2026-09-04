/**
 * 姿勢系列 JSON の読み書き（Cloud Storage）。
 *
 * パス規約（docs/design/data-model.md 5章の拡張）:
 *   ユーザー動画   users/{uid}/videos/{videoId}.pose.json
 *   連の参照動画   ren/{renId}/styleReferences/{referenceId}.pose.json
 */
import {storage} from "../lib/firebase";
import {PoseSeries, parsePoseSeries} from "./pose";

/** 姿勢系列ファイルが Storage に無い */
export class PoseSeriesNotFoundError extends Error {
  /**
   * @param {string} path 見つからなかったパス
   */
  constructor(path: string) {
    super(`pose series not found: ${path}`);
    this.name = "PoseSeriesNotFoundError";
  }
}

/**
 * Storage から姿勢系列を読み込む。
 * @param {string} path Storage 上のパス
 * @return {Promise<PoseSeries>} 検証済みの姿勢系列
 */
export async function loadPoseSeries(path: string): Promise<PoseSeries> {
  const file = storage.bucket().file(path);
  const [exists] = await file.exists();
  if (!exists) throw new PoseSeriesNotFoundError(path);
  const [buf] = await file.download();
  return parsePoseSeries(JSON.parse(buf.toString("utf8")));
}

/**
 * 姿勢系列ファイルを削除する。存在しなくてもエラーにしない。
 * @param {string} path Storage 上のパス
 * @return {Promise<void>}
 */
export async function deletePoseSeries(path: string): Promise<void> {
  await storage.bucket().file(path).delete({ignoreNotFound: true});
}

import {onDocumentDeleted} from "firebase-functions/v2/firestore";
import {getStorage} from "firebase-admin/storage";
import * as logger from "firebase-functions/logger";

/**
 * videosドキュメントが削除されたら、対応するStorage上の動画実体も削除する
 * (仕様書14.3)。冪等性のため、既に実体が存在しない(404)場合はエラーに
 * しない。練習動画(users/{uid}/videos/)と姿勢系列の両方が対象。
 */
export const onVideoDeleted = onDocumentDeleted(
  "videos/{videoId}",
  async (event) => {
    const data = event.data?.data() ?? {};
    // 動画本体と、AI②が読む姿勢系列(.pose.json)の両方を消す
    const paths = [data.storagePath, data.poseSeriesPath]
      .filter((p): p is string => typeof p === "string" && p.length > 0);
    for (const storagePath of paths) {
      try {
        await getStorage().bucket().file(storagePath).delete();
      } catch (error) {
        const code = (error as {code?: number}).code;
        if (code === 404) {
          continue;
        }
        logger.error("failed to delete storage object for deleted video", {
          storagePath,
          error,
        });
        throw error;
      }
    }
  }
);

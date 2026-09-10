import {onDocumentDeleted} from "firebase-functions/v2/firestore";
import {getStorage} from "firebase-admin/storage";
import * as logger from "firebase-functions/logger";

/**
 * videosドキュメントが削除されたら、対応するStorage上の動画実体も削除する
 * (仕様書14.3)。冪等性のため、既に実体が存在しない(404)場合はエラーに
 * しない。動画アップロード機能自体が未実装のため現状は休眠中。
 */
export const onVideoDeleted = onDocumentDeleted(
  "videos/{videoId}",
  async (event) => {
    const storagePath = event.data?.data().storagePath as string | undefined;
    if (!storagePath) {
      return;
    }

    try {
      await getStorage().bucket().file(storagePath).delete();
    } catch (error) {
      const code = (error as {code?: number}).code;
      if (code === 404) {
        return;
      }
      logger.error("failed to delete storage object for deleted video", {
        storagePath,
        error,
      });
      throw error;
    }
  }
);

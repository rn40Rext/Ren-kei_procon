import {randomUUID} from "crypto";
import {HttpsError, onCall} from "firebase-functions/v2/https";
import {FieldValue, getFirestore} from "firebase-admin/firestore";
import {getStorage} from "firebase-admin/storage";
import {requireAuth, requireRenAdmin} from "../lib/guards";

interface UpdateRenIconRequest {
  renId: string;
  tempPath: string;
}

/**
 * リクエストの形式を検証する。
 * @param {unknown} data Callable Functionsに渡された生のリクエストデータ。
 */
function assertValidRequest(
  data: unknown
): asserts data is UpdateRenIconRequest {
  const d = data as Partial<UpdateRenIconRequest> | null;
  const renIdOk = d && typeof d.renId === "string" && d.renId.length > 0;
  const tempPathOk =
    d && typeof d.tempPath === "string" && d.tempPath.length > 0;
  if (!renIdOk || !tempPathOk) {
    throw new HttpsError("invalid-argument", "renId and tempPath are required");
  }
}

/**
 * 連アイコンを更新する(#34)。Storage RulesのCross-Service Rules
 * (firestore.get())で対象連の管理者のみ書き込み可にしようとしたが、
 * 本番環境で権限エラーになる不具合が発生したため断念し、Admin SDK経由
 * (本関数)に切り替えた。クライアントは一旦本人のみ書き込み可能な
 * 一時領域(users/{uid}/renIconUploads/{renId}/{fileName})へ
 * アップロードし、本関数がrequireRenAdmin検証後にren/{renId}/icon/へ
 * move、ダウンロードトークンを発行してren.iconUrlを更新する。
 */
export const updateRenIcon = onCall(async (request) => {
  const uid = requireAuth(request);
  assertValidRequest(request.data);
  const {renId, tempPath} = request.data;

  const expectedPrefix = `users/${uid}/renIconUploads/${renId}/`;
  if (!tempPath.startsWith(expectedPrefix)) {
    throw new HttpsError("invalid-argument", "invalid tempPath");
  }

  await requireRenAdmin(uid, renId);

  const bucket = getStorage().bucket();
  const tempFile = bucket.file(tempPath);
  const [exists] = await tempFile.exists();
  if (!exists) {
    throw new HttpsError("not-found", "uploaded file not found");
  }

  const fileName = tempPath.split("/").pop();
  const destPath = `ren/${renId}/icon/${fileName}`;
  await tempFile.move(destPath);

  const downloadToken = randomUUID();
  const destFile = bucket.file(destPath);
  await destFile.setMetadata({
    metadata: {firebaseStorageDownloadTokens: downloadToken},
  });
  const iconUrl =
    `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/` +
    `${encodeURIComponent(destPath)}?alt=media&token=${downloadToken}`;

  await getFirestore().doc(`ren/${renId}`).update({
    iconUrl,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {iconUrl};
});

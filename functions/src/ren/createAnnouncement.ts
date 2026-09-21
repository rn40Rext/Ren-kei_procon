import {HttpsError, onCall} from "firebase-functions/v2/https";
import {FieldValue, getFirestore} from "firebase-admin/firestore";
import {requireAuth, requireRenAdmin} from "../lib/guards";

interface CreateAnnouncementRequest {
  renId: string;
  title: string;
  content: string;
}

const NOTIFICATION_BATCH_SIZE = 500;

/**
 * リクエストの形式・文字数制限を検証する。
 * @param {unknown} data Callable Functionsに渡された生のリクエストデータ。
 */
function assertValidRequest(
  data: unknown
): asserts data is CreateAnnouncementRequest {
  const d = data as Partial<CreateAnnouncementRequest> | null;
  const renIdOk = d && typeof d.renId === "string" && d.renId.length > 0;
  if (!renIdOk) {
    throw new HttpsError("invalid-argument", "renId is required");
  }
  const titleOk =
    typeof d.title === "string" && d.title.length >= 1 && d.title.length <= 100;
  if (!titleOk) {
    throw new HttpsError(
      "invalid-argument",
      "title must be 1-100 characters"
    );
  }
  const contentOk =
    typeof d.content === "string" &&
    d.content.length >= 1 &&
    d.content.length <= 2000;
  if (!contentOk) {
    throw new HttpsError(
      "invalid-argument",
      "content must be 1-2000 characters"
    );
  }
}

/**
 * 連管理者がお知らせを作成し、連メンバー全員(自分を除く)へ通知する(#34)。
 * notificationsはクライアントから直接createできない(firestore.rules)
 * ため、本関数(Admin SDK)経由に一本化する。メンバー数がFirestoreの
 * バッチ書き込み上限(500件)を超える場合に備え、通知作成はバッチを
 * 分割して行う。
 */
export const createAnnouncement = onCall(async (request) => {
  const uid = requireAuth(request);
  assertValidRequest(request.data);
  const {renId, title, content} = request.data;

  await requireRenAdmin(uid, renId);

  const db = getFirestore();
  const announcementRef = db.collection(`ren/${renId}/announcements`).doc();
  await announcementRef.set({
    title,
    content,
    createdBy: uid,
    createdAt: FieldValue.serverTimestamp(),
  });

  const membersSnap = await db
    .collection(`ren/${renId}/members`)
    .where("status", "==", "active")
    .get();
  const recipientUids = membersSnap.docs
    .map((memberDoc) => memberDoc.id)
    .filter((memberUid) => memberUid !== uid);

  for (let i = 0; i < recipientUids.length; i += NOTIFICATION_BATCH_SIZE) {
    const chunk = recipientUids.slice(i, i + NOTIFICATION_BATCH_SIZE);
    const batch = db.batch();
    for (const memberUid of chunk) {
      const notificationRef = db
        .collection("users")
        .doc(memberUid)
        .collection("notifications")
        .doc();
      batch.set(notificationRef, {
        userId: memberUid,
        type: "announcement",
        referenceId: announcementRef.id,
        title: "新しいお知らせ",
        body: title,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }

  return {announcementId: announcementRef.id};
});

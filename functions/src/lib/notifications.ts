import {FieldValue, Firestore, Transaction} from "firebase-admin/firestore";

/**
 * Ren-kei_procon/src/types/firestore.ts の NotificationType と一致させる。
 * クライアント側は追加のたびに TYPE_ICON（NotificationsScreen.tsx）と
 * onPressNotification の遷移先も更新すること。
 */
export type NotificationType =
  | "comment"
  | "join_result"
  | "announcement"
  | "join_request"
  | "member_removed"
  | "role_changed"
  | "member_joined"
  | "invitation_result"
  | "chat_message";

export interface NotificationInput {
  uid: string;
  type: NotificationType;
  referenceId?: string;
  title: string;
  body: string;
}

/**
 * users/{uid}/notifications へ1件書き込む共通ヘルパー。
 * notificationsはクライアントから直接createできない(firestore.rules)ため、
 * 通知を作るCloud Functions/トリガーは必ずこれを経由する。
 *
 * opts.tx を渡すとトランザクション内の他の書き込みと同時にコミットされる
 * (状態遷移と通知作成の同期が必要な場合。updateJoinRequestStatus等)。
 * opts.docId を指定すると、トリガーのat-least-once配信で複数回実行されても
 * setは冪等になる(onCommentWriteと同じ方針。発生源のIDをそのまま使う)。
 * @param {Firestore} db Admin SDKのFirestoreインスタンス。
 * @param {NotificationInput} input 通知先・種別・本文。
 * @param {object} opts トランザクション(tx)・通知ID(docId)指定(任意)。
 * @return {Promise<void>} 書き込み完了(txを渡した場合はコミット前の登録のみ)。
 */
export async function notifyUser(
  db: Firestore,
  input: NotificationInput,
  opts?: {tx?: Transaction; docId?: string}
): Promise<void> {
  const notifications = db
    .collection("users")
    .doc(input.uid)
    .collection("notifications");
  const ref = opts?.docId ? notifications.doc(opts.docId) : notifications.doc();

  const data = {
    userId: input.uid,
    type: input.type,
    ...(input.referenceId ? {referenceId: input.referenceId} : {}),
    title: input.title,
    body: input.body,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  };

  if (opts?.tx) {
    opts.tx.set(ref, data);
    return;
  }
  await ref.set(data);
}

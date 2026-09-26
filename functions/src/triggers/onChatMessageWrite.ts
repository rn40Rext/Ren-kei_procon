import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {getFirestore} from "firebase-admin/firestore";
import {notifyUser} from "../lib/notifications";
import {resolveDisplayName} from "../lib/users";

/**
 * chats/{chatId}/messages/{messageId} が新規作成されたとき、チャット相手へ
 * 通知する。chatIdは送信者判定にも使うRules(firestore.rules)と同じ規約で
 * "uidA_uidB"(2人のuidをソートして"_"で結合)なので、送信者以外の片方が
 * 宛先になる(専用のparticipantsフィールドは持たない。#108のprototype実装)。
 * メッセージ作成はクライアントが直接行うため、onCommentWriteと同じく
 * Firestoreトリガーで拾う。通知ドキュメントIDはmessageIdをそのまま使い、
 * at-least-once配信での重複作成を避ける。
 */
export const onChatMessageWrite = onDocumentCreated(
  "chats/{chatId}/messages/{messageId}",
  async (event) => {
    const {chatId, messageId} = event.params;
    const message = event.data?.data();
    if (!message) return;

    const senderId = message.senderId as string | undefined;
    const text = (message.text as string) ?? "";
    if (!senderId) return;

    const uids = chatId.split("_");
    if (uids.length !== 2) return;
    const recipientId = uids.find((u: string) => u !== senderId);
    if (!recipientId) return;

    const db = getFirestore();
    const senderName = await resolveDisplayName(db, senderId);
    await notifyUser(
      db,
      {
        uid: recipientId,
        type: "chat_message",
        referenceId: chatId,
        title: `${senderName}さんからメッセージが届きました`,
        body: text,
      },
      {docId: messageId}
    );
  }
);

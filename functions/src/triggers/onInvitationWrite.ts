import {onDocumentWritten} from "firebase-functions/v2/firestore";
import {getFirestore} from "firebase-admin/firestore";
import {NotificationInput, notifyUser} from "../lib/notifications";

/**
 * invitations/{invitationId} の書き込み前後の内容から、作るべき通知を決める。
 * Firestoreに触れない純粋な関数にして、単体テストできるようにしている。
 *  - お誘いが新しく作られた(pending): 宛先(toUserId)へ invitation_received
 *  - status が pending から accepted/declined へ変わった: 送信者(fromUserId)へ
 *    invitation_result
 *  - それ以外(削除・取り消し・その他の更新): 通知しない(null)
 * @param {string} invitationId お誘いのドキュメントID。通知の参照IDになる。
 * @param {Record<string, unknown> | undefined} before 書き込み前の内容。
 * @param {Record<string, unknown> | undefined} after 書き込み後の内容。
 * @return {NotificationInput | null} 作る通知。通知しないときはnull。
 */
export function invitationNotificationFor(
  invitationId: string,
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined
): NotificationInput | null {
  if (!after) return null;

  // お誘いが新しく作られた: 宛先の本人へ届いたことを知らせる
  if (!before) {
    const toUserId = after.toUserId as string | undefined;
    if (after.status !== "pending" || !toUserId) return null;
    const fromUserName = (after.fromUserName as string) ?? "誰か";
    return {
      uid: toUserId,
      type: "invitation_received",
      referenceId: invitationId,
      title: "お誘いが届きました",
      body: `${fromUserName}さんから連へのお誘いが届きました。`,
    };
  }

  // 応答(承諾/辞退)があった: 送信者へ結果を知らせる
  if (before.status !== "pending") return null;
  if (after.status !== "accepted" && after.status !== "declined") return null;
  const fromUserId = after.fromUserId as string | undefined;
  if (!fromUserId) return null;
  const toUserName = (after.toUserName as string) ?? "相手";
  const accepted = after.status === "accepted";
  return {
    uid: fromUserId,
    type: "invitation_result",
    referenceId: invitationId,
    title: accepted ? "お誘いが承諾されました" : "お誘いが辞退されました",
    body: accepted ?
      `${toUserName}さんがお誘いに応じました。` :
      `${toUserName}さんはお誘いを辞退しました。`,
  };
}

/**
 * invitations/{invitationId} に関する通知を作る(中身の判断は
 * invitationNotificationFor)。
 * invitationsの作成・更新はクライアントが直接行う(firestore.rulesが宛先本人
 * によるstatus更新のみ許可)ため、onCommentWriteと同じくFirestoreトリガーで
 * 拾う。通知ドキュメントIDはinvitationIdをそのまま使い、at-least-once配信での
 * 重複作成を避ける(setは冪等)。受信通知は宛先、結果通知は送信者の通知コレク
 * ションに作られるので、同じIDでも衝突しない。
 */
export const onInvitationWrite = onDocumentWritten(
  "invitations/{invitationId}",
  async (event) => {
    const {invitationId} = event.params;
    const notification = invitationNotificationFor(
      invitationId,
      event.data?.before.data(),
      event.data?.after.data()
    );
    if (!notification) return;
    await notifyUser(getFirestore(), notification, {docId: invitationId});
  }
);

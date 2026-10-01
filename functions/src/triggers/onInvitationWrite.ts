import {onDocumentWritten} from "firebase-functions/v2/firestore";
import {getFirestore} from "firebase-admin/firestore";
import {notifyUser} from "../lib/notifications";

/**
 * invitations/{invitationId} の status が pending から accepted/declined へ
 * 変わったとき、送信者(fromUserId)へ応答結果を通知する。
 * invitationsの更新はクライアントが直接行う(respondToInvitation、
 * firestore.rulesが宛先本人によるstatus更新のみ許可)ため、
 * onCommentWriteと同じくFirestoreトリガーで拾う。
 * 通知ドキュメントIDはinvitationIdをそのまま使い、at-least-once配信での
 * 重複作成を避ける(setは冪等)。
 */
export const onInvitationWrite = onDocumentWritten(
  "invitations/{invitationId}",
  async (event) => {
    const {invitationId} = event.params;
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;
    if (before.status !== "pending") return;
    if (after.status !== "accepted" && after.status !== "declined") return;

    const fromUserId = after.fromUserId as string | undefined;
    const toUserName = (after.toUserName as string) ?? "相手";
    if (!fromUserId) return;

    const db = getFirestore();
    const accepted = after.status === "accepted";
    await notifyUser(
      db,
      {
        uid: fromUserId,
        type: "invitation_result",
        referenceId: invitationId,
        title: accepted ? "お誘いが承諾されました" : "お誘いが辞退されました",
        body: accepted ?
          `${toUserName}さんがお誘いに応じました。` :
          `${toUserName}さんはお誘いを辞退しました。`,
      },
      {docId: invitationId}
    );
  }
);

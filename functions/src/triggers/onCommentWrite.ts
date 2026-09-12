import {onDocumentWritten} from "firebase-functions/v2/firestore";
import {FieldValue, getFirestore} from "firebase-admin/firestore";

/**
 * posts/{postId}/comments の増減に応じて posts.commentCount を数え直す。
 * 新規に作成されたtype:'instructor'コメント(師匠の教え)については、
 * 投稿者へ通知(type:'comment'。仕様書9.3のtype例に準拠)も作成する(#31)。
 * 通知の重複作成を避けるため、通知ドキュメントIDはcommentIdをそのまま使う
 * (トリガのat-least-once配信で複数回実行されてもsetは冪等)。
 */
export const onCommentWrite = onDocumentWritten(
  "posts/{postId}/comments/{commentId}",
  async (event) => {
    const {postId, commentId} = event.params;
    const db = getFirestore();
    const snapshot = await db
      .collection(`posts/${postId}/comments`)
      .count()
      .get();
    await db
      .doc(`posts/${postId}`)
      .set({commentCount: snapshot.data().count}, {merge: true});

    const isCreate = !event.data?.before.exists && event.data?.after.exists;
    if (!isCreate) return;

    const comment = event.data?.after.data();
    if (comment?.type !== "instructor") return;

    const postSnap = await db.doc(`posts/${postId}`).get();
    const postAuthorId = postSnap.data()?.userId as string | undefined;
    if (!postAuthorId || postAuthorId === comment.userId) return;

    await db
      .collection("users")
      .doc(postAuthorId)
      .collection("notifications")
      .doc(commentId)
      .set({
        userId: postAuthorId,
        type: "comment",
        referenceId: postId,
        title: "師匠からアドバイスが届きました",
        body: comment.text as string,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
  }
);

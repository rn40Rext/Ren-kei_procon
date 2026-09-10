import {onDocumentWritten} from "firebase-functions/v2/firestore";
import {getFirestore} from "firebase-admin/firestore";

/** posts/{postId}/comments の増減に応じて posts.commentCount を数え直す。 */
export const onCommentWrite = onDocumentWritten(
  "posts/{postId}/comments/{commentId}",
  async (event) => {
    const {postId} = event.params;
    const db = getFirestore();
    const snapshot = await db
      .collection(`posts/${postId}/comments`)
      .count()
      .get();
    await db
      .doc(`posts/${postId}`)
      .set({commentCount: snapshot.data().count}, {merge: true});
  }
);

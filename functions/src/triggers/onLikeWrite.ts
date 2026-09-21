import {onDocumentWritten} from "firebase-functions/v2/firestore";
import {getFirestore} from "firebase-admin/firestore";

/**
 * posts/{postId}/likes の増減に応じて posts.likeCount を数え直す。
 * increment()ではなくcount()集約を使うのは、トリガーのat-least-once
 * 配信で同じイベントが重複実行されてもズレないようにするため。
 */
export const onLikeWrite = onDocumentWritten(
  "posts/{postId}/likes/{uid}",
  async (event) => {
    const {postId} = event.params;
    const db = getFirestore();
    const snapshot = await db
      .collection(`posts/${postId}/likes`)
      .count()
      .get();
    await db
      .doc(`posts/${postId}`)
      .set({likeCount: snapshot.data().count}, {merge: true});
  }
);

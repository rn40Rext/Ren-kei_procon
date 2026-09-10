import {onDocumentWritten} from "firebase-functions/v2/firestore";
import {getFirestore} from "firebase-admin/firestore";

/**
 * ren/{renId}/members の増減に応じて ren.memberCount を数え直す。
 * status=='active'のみを数える(脱退済み'left'は除く)。
 * ren機能自体が未実装のため現状は休眠中。
 */
export const onMemberWrite = onDocumentWritten(
  "ren/{renId}/members/{uid}",
  async (event) => {
    const {renId} = event.params;
    const db = getFirestore();
    const snapshot = await db
      .collection(`ren/${renId}/members`)
      .where("status", "==", "active")
      .count()
      .get();
    await db
      .doc(`ren/${renId}`)
      .set({memberCount: snapshot.data().count}, {merge: true});
  }
);

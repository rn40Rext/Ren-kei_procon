import {HttpsError, onCall} from "firebase-functions/v2/https";
import {FieldValue, getFirestore} from "firebase-admin/firestore";
import {requireAuth} from "../lib/guards";

interface CreateRenRequest {
  name: string;
  description?: string;
  location?: string;
  iconUrl?: string;
  beginnerFriendly?: boolean;
}

/**
 * リクエストの形式・文字数制限を検証する。
 * @param {unknown} data Callable Functionsに渡された生のリクエストデータ。
 */
function assertValidRequest(
  data: unknown
): asserts data is CreateRenRequest {
  const d = data as Partial<CreateRenRequest> | null;
  const nameOk =
    d && typeof d.name === "string" &&
    d.name.length >= 1 && d.name.length <= 100;

  if (!nameOk) {
    throw new HttpsError("invalid-argument", "name must be 1-100 characters");
  }
  if (
    d.description !== undefined &&
    (typeof d.description !== "string" || d.description.length > 1000)
  ) {
    throw new HttpsError(
      "invalid-argument",
      "description must be at most 1000 characters"
    );
  }
  if (
    d.location !== undefined &&
    (typeof d.location !== "string" || d.location.length > 100)
  ) {
    throw new HttpsError(
      "invalid-argument",
      "location must be at most 100 characters"
    );
  }
  if (
    d.beginnerFriendly !== undefined &&
    typeof d.beginnerFriendly !== "boolean"
  ) {
    throw new HttpsError(
      "invalid-argument",
      "beginnerFriendly must be a boolean"
    );
  }
}

/**
 * 連(ren)を作成し、作成者を自動でrole:'admin'のメンバーとして登録する。
 * firestore.rulesはren/{renId}とren/{renId}/members/{uid}のどちらも
 * クライアントからの直接createを禁止している(members側は#40で
 * 元々禁止、ren側は本関数導入にあわせて#26で禁止した)。連作成と
 * 管理者登録の間で失敗し「連はあるが管理者がいない」状態になるのを
 * 避けるため、1つのトランザクションで両方書き込む。
 */
export const createRen = onCall(async (request) => {
  const uid = requireAuth(request);
  assertValidRequest(request.data);
  const {name, description, location, iconUrl, beginnerFriendly} = request.data;

  const db = getFirestore();
  const renRef = db.collection("ren").doc();

  await db.runTransaction(async (tx) => {
    tx.set(renRef, {
      name,
      description: description ?? "",
      location: location ?? "",
      iconUrl: iconUrl ?? "",
      beginnerFriendly: beginnerFriendly ?? false,
      memberCount: 1,
      createdBy: uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.set(renRef.collection("members").doc(uid), {
      userId: uid,
      role: "admin",
      status: "active",
      joinedAt: FieldValue.serverTimestamp(),
    });
  });

  return {renId: renRef.id};
});

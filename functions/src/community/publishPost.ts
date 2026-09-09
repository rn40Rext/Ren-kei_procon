import {HttpsError, onCall} from "firebase-functions/v2/https";
import {FieldValue, getFirestore} from "firebase-admin/firestore";
import {requireAuth} from "../lib/guards";

// CommunityScreen.tsx の TAG_OPTIONS と同じ一覧
const TAG_OPTIONS = [
  "#男踊り", "#女踊り", "#初心者歓迎", "#足の運び",
  "#鳥追い笠", "#腰落とし", "#2拍子", "#ちびっこ踊り",
];

interface PublishPostRequest {
  title: string;
  description?: string;
  tags?: string[];
  videoUrl: string;
  authorName: string;
}

/**
 * リクエストの形式・文字数制限・タグ許可リストを検証する。
 * @param {unknown} data Callable Functionsに渡された生のリクエストデータ。
 */
function assertValidRequest(
  data: unknown
): asserts data is PublishPostRequest {
  const d = data as Partial<PublishPostRequest> | null;
  const titleOk =
    d && typeof d.title === "string" &&
    d.title.length >= 1 && d.title.length <= 100;

  if (!titleOk) {
    throw new HttpsError("invalid-argument", "title must be 1-100 characters");
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
    d.tags !== undefined &&
    (!Array.isArray(d.tags) || d.tags.some((t) => !TAG_OPTIONS.includes(t)))
  ) {
    throw new HttpsError(
      "invalid-argument",
      "tags must be selected from the predefined list"
    );
  }
  if (typeof d.videoUrl !== "string" || d.videoUrl.length === 0) {
    throw new HttpsError("invalid-argument", "videoUrl is required");
  }
  if (typeof d.authorName !== "string" || d.authorName.length === 0) {
    throw new HttpsError("invalid-argument", "authorName is required");
  }
}

/**
 * FN-03 の縮小版。videos コレクションと AI 採点(FN-01)が未実装のため、
 * 設計書(docs/design/api-functions.md)にある videoId / analysisStatus の
 * 検証と videos.visibility の更新は行わない。差分は
 * docs/design/api-functions.md に記録している。
 *
 * クライアントがスコアやカウンタを直接指定できないようにすることが目的。
 */
export const publishPost = onCall(async (request) => {
  const uid = requireAuth(request);
  assertValidRequest(request.data);
  const {title, description, tags, videoUrl, authorName} = request.data;

  const db = getFirestore();
  const postRef = db.collection("posts").doc();

  await postRef.set({
    userId: uid,
    authorName,
    title,
    description: description ?? "",
    tags: tags ?? [],
    videoUrl,
    // 💡 AI採点(FN-01)が未実装のため暫定的にモック値を発行する。
    // FN-01実装後はここをvideos.analysisStatus完了時のスコア参照に置き換える。
    score: Math.floor(Math.random() * 20) + 80,
    likeCount: 0,
    commentCount: 0,
    createdAt: FieldValue.serverTimestamp(),
  });

  return {postId: postRef.id};
});

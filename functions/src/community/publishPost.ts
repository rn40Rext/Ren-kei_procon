import {HttpsError, onCall} from "firebase-functions/v2/https";
import {FieldValue, getFirestore} from "firebase-admin/firestore";
import {ErrorCode, httpsErrorFor} from "../lib/errors";
import {requireAuth} from "../lib/guards";

// CommunityScreen.tsx の TAG_OPTIONS と同じ一覧
const TAG_OPTIONS = [
  "#男踊り",
  "#女踊り",
  "#初心者歓迎",
  "#足の運び",
  "#鳥追い笠",
  "#腰落とし",
  "#2拍子",
  "#ちびっこ踊り",
];

interface PublishPostRequest {
  title: string;
  description?: string;
  tags?: string[];
  videoUrl: string;
  authorName: string;
  /** 練習動画(videos)から投稿する場合。AI採点の結果を投稿に載せる */
  videoId?: string;
}

/**
 * リクエストの形式・文字数制限・タグ許可リストを検証する。
 * @param {unknown} data Callable Functionsに渡された生のリクエストデータ。
 */
function assertValidRequest(data: unknown): asserts data is PublishPostRequest {
  const d = data as Partial<PublishPostRequest> | null;
  const titleOk =
    d &&
    typeof d.title === "string" &&
    d.title.length >= 1 &&
    d.title.length <= 100;

  if (!titleOk) {
    throw new HttpsError("invalid-argument", "title must be 1-100 characters");
  }
  if (
    d.description !== undefined &&
    (typeof d.description !== "string" || d.description.length > 1000)
  ) {
    throw new HttpsError(
      "invalid-argument",
      "description must be at most 1000 characters",
    );
  }
  if (
    d.tags !== undefined &&
    (!Array.isArray(d.tags) || d.tags.some((t) => !TAG_OPTIONS.includes(t)))
  ) {
    throw new HttpsError(
      "invalid-argument",
      "tags must be selected from the predefined list",
    );
  }
  if (typeof d.videoUrl !== "string" || d.videoUrl.length === 0) {
    throw new HttpsError("invalid-argument", "videoUrl is required");
  }
  if (typeof d.authorName !== "string" || d.authorName.length === 0) {
    throw new HttpsError("invalid-argument", "authorName is required");
  }
  if (
    d.videoId !== undefined &&
    (typeof d.videoId !== "string" || d.videoId.length === 0)
  ) {
    throw new HttpsError(
      "invalid-argument",
      "videoId must be a non-empty string",
    );
  }
}

/**
 * FN-03 publishPost(縮小版)。
 *
 * videoId が渡されたときは所有者を検証し、AI採点(FN-01)の結果
 * analysisResults.totalScore を posts.score へ非正規化コピーする。
 * 採点が無い投稿は score を持たない(クライアントは「未採点」と表示する)。
 * **乱数のモック値は発行しない**(#58)。
 * videos.visibility の public 化も videoId があるときだけ行う。
 */
export const publishPost = onCall(async (request) => {
  const uid = requireAuth(request);
  assertValidRequest(request.data);
  const {title, description, tags, videoUrl, authorName, videoId} =
    request.data;

  const db = getFirestore();
  const postRef = db.collection("posts").doc();

  await db.runTransaction(async (tx) => {
    let score: number | undefined;
    let videoRef = null;
    if (videoId) {
      videoRef = db.collection("videos").doc(videoId);
      const videoSnap = await tx.get(videoRef);
      if (!videoSnap.exists) {
        throw new HttpsError(
          "not-found",
          `${ErrorCode.INVALID_ARGUMENT}:videoId`,
        );
      }
      const video = videoSnap.data() ?? {};
      if (video.userId !== uid) {
        throw httpsErrorFor(ErrorCode.FORBIDDEN);
      }
      if (typeof video.latestAnalysisId === "string") {
        const analysis = await tx.get(
          db.collection("analysisResults").doc(video.latestAnalysisId),
        );
        const total = analysis.data()?.totalScore;
        if (typeof total === "number" && Number.isFinite(total)) {
          score = Math.round(total);
        }
      }
    }

    tx.set(postRef, {
      userId: uid,
      authorName,
      title,
      description: description ?? "",
      tags: tags ?? [],
      videoUrl,
      ...(videoId ? {videoId} : {}),
      ...(score !== undefined ? {score} : {}),
      likeCount: 0,
      commentCount: 0,
      createdAt: FieldValue.serverTimestamp(),
    });
    if (videoRef) {
      tx.update(videoRef, {visibility: "public"});
    }
  });

  return {postId: postRef.id};
});

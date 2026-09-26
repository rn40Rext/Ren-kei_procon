/**
 * Emulator 上での動作確認スクリプト。
 *
 *   npm run verify:emulator
 *
 * Firestore / Storage / Functions エミュレータを起動し、
 * FN-02 / FN-07 / FN-08 / FN-09 とトリガの振る舞いを確認する。
 * ネットワークもエミュレータも要らない単体テストは npm test 側にある。
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
// any を使う理由: firebase-functions-test の wrap() は v2 Callable の
// 引数型を公開しておらず、テスト用の最小限の CallableRequest を
// 渡すために型を緩める必要があるため。

const PROJECT_ID = "demo-renkei";
const BUCKET = `${PROJECT_ID}.appspot.com`;

process.env.GCLOUD_PROJECT = PROJECT_ID;
process.env.FIREBASE_CONFIG = JSON.stringify({
  projectId: PROJECT_ID,
  storageBucket: BUCKET,
});
process.env.FIRESTORE_EMULATOR_HOST =
  process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
const storageHost =
  process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? "127.0.0.1:9199";
process.env.FIREBASE_STORAGE_EMULATOR_HOST = storageHost;
process.env.STORAGE_EMULATOR_HOST = `http://${storageHost}`;

let failures = 0;

/**
 * 確認結果を出力する。
 * @param {boolean} condition 期待どおりなら true
 * @param {string} label 確認内容
 * @return {void}
 */
function check(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}`);
  }
}

/**
 * 失敗すると分かっている呼び出しのエラーコードを取り出す。
 * @param {Promise<unknown>} promise 実行中の呼び出し
 * @return {Promise<string>} エラーの message（仕様書 13章のコード）
 */
async function errorCodeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "(no error)";
  } catch (e) {
    return String((e as {message?: string}).message ?? e);
  }
}

// 一定時間待つ
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * エミュレータ上の一連の確認を実行する。
 * @return {Promise<void>}
 */
async function main(): Promise<void> {
  /* eslint-disable @typescript-eslint/no-var-requires */
  // storageBucket を渡さないと firebase-functions-test が
  // FIREBASE_CONFIG を上書きし、既定バケットが解決できなくなる
  const functionsTest = require("firebase-functions-test")({
    projectId: PROJECT_ID,
    storageBucket: BUCKET,
  });
  const {db, storage} = require("../lib/firebase");
  const fixtures = require("./fixtures");
  const {analyzeStyle} = require("../analysis/analyzeStyle");
  const {rebuildRenStyleProfile} = require("../style/rebuildRenStyleProfile");
  const {registerStyleReference} = require("../style/registerStyleReference");
  const {deleteStyleReference} = require("../style/deleteStyleReference");
  const {finalizeBasicAnalysis} = require("../analysis/finalizeBasicAnalysis");
  const {submitJoinRequest} = require("../ren/submitJoinRequest");
  const {
    updateJoinRequestStatus,
  } = require("../ren/updateJoinRequestStatus");
  const {removeMember} = require("../ren/removeMember");
  const {updateMemberRole} = require("../ren/updateMemberRole");
  const {leaveRen} = require("../ren/leaveRen");
  /* eslint-enable @typescript-eslint/no-var-requires */

  const wrap = (fn: any) => functionsTest.wrap(fn);
  const callAs = (fn: any, uid: string | null, data: unknown) =>
    wrap(fn)({
      data,
      auth: uid ? {uid, token: {}} : undefined,
      rawRequest: {},
    } as any);

  const bucket = storage.bucket(BUCKET);

  // 合成した姿勢系列を Storage へ置く
  const putSeries = async (path: string, params: any, opts: any = {}) => {
    const series = fixtures.makeSeries(params, opts);
    await bucket.file(path).save(JSON.stringify(series), {
      contentType: "application/json",
    });
  };

  console.log("--- seed ---");
  await db.doc("ren/renA").set({name: "藍屋連"});
  await db.doc("ren/renA/members/adminA").set({role: "admin"});
  await db.doc("ren/renB").set({name: "朱雀連"});
  await db.doc("ren/renB/members/adminB").set({role: "admin"});
  await db.doc("videos/videoUser1").set({
    userId: "user1",
    poseSeriesPath: "users/user1/videos/videoUser1.pose.json",
  });

  await putSeries(
    "ren/renA/styleReferences/refA1.pose.json",
    fixtures.STYLE_A,
    {seed: 21, noise: 0.015},
  );
  await putSeries(
    "ren/renA/styleReferences/refA2.pose.json",
    fixtures.STYLE_A,
    {seed: 22, noise: 0.015, phase: 0.8},
  );
  await putSeries(
    "ren/renB/styleReferences/refB1.pose.json",
    fixtures.STYLE_B,
    {seed: 23, noise: 0.015},
  );
  // ユーザーは連 B の踊り方に近い動きをしている
  await putSeries("users/user1/videos/videoUser1.pose.json", fixtures.STYLE_B, {
    seed: 24,
    noise: 0.02,
    scale: 0.75,
    speed: 1.1,
    mirror: true,
  });

  console.log("--- FN-01 finalizeBasicAnalysis ---");
  await db.doc("videos/practice1").set({
    userId: "user1",
    visibility: "private",
    analysisStatus: "uploaded",
  });
  const finalizeReq = {
    videoId: "practice1",
    clientRequestId: "req-0001-abcdef",
    analysisVersion: "v1",
    danceType: "male",
    scorePart: "whole",
    events: [
      {ruleId: "HAND_ABOVE_HEAD", grade: "GREAT", timestampMs: 200, value: 0.2},
      {
        ruleId: "HAND_ABOVE_HEAD",
        grade: "GOOD",
        timestampMs: 1900,
        value: 0.08,
      },
      {ruleId: "HAND_STOP", grade: "MISS", timestampMs: 4000, value: 0.9},
    ],
    metrics: {
      HAND_ABOVE_HEAD: {attempts: 2, greatCount: 1, goodCount: 1, missCount: 0},
      HIP_LOW: {
        attempts: 0,
        greatCount: 0,
        goodCount: 0,
        missCount: 0,
        holdRatio: 0.5,
      },
      HAND_STOP: {attempts: 1, greatCount: 0, goodCount: 0, missCount: 1},
    },
    rhythm: {userBpm: 112, baseBpm: 112},
    gameScore: 160,
    maxCombo: 2,
    durationMs: 5000,
    // クライアントが送ってきても無視されること
    totalScore: 100,
  };
  const fin = await callAs(finalizeBasicAnalysis, "user1", finalizeReq);
  // 手 85 / 腰 50 / 停止 0 / リズム 100 → 平均 58.75 → 58.8
  check(
    Math.abs(fin.totalScore - 58.8) < 1e-9,
    `totalScore はサーバが算出する(期待 58.8 / 実際 ${fin.totalScore})`,
  );
  check(fin.scores.hipHeightScore === 50, "項目別スコアが返る");
  check(
    fin.feedback.some(
      (f: any) => f.type === "improve" && f.ruleId === "HAND_STOP",
    ),
    "改善点のフィードバックが付く",
  );
  const savedAnalysis = (
    await db.doc(`analysisResults/${fin.analysisId}`).get()
  ).data();
  check(
    savedAnalysis.totalScore === fin.totalScore &&
      savedAnalysis.gameScore === 160 &&
      savedAnalysis.analysisVersion === "v1",
    "analysisResults に保存される(gameScore は別フィールド)",
  );
  const growth = (
    await db.doc(`users/user1/growthRecords/${fin.analysisId}`).get()
  ).data();
  check(growth && growth.score === fin.totalScore, "growthRecords が作られる");
  const practice = (await db.doc("videos/practice1").get()).data();
  check(
    practice.analysisStatus === "completed" &&
      practice.latestAnalysisId === fin.analysisId,
    "videos.analysisStatus が completed になる",
  );
  const again = await callAs(finalizeBasicAnalysis, "user1", finalizeReq);
  check(
    again.analysisId === fin.analysisId && again.duplicate === true,
    "同じ clientRequestId の再送は同じ結果を返す(冪等)",
  );
  check(
    (await errorCodeOf(callAs(finalizeBasicAnalysis, "user2", finalizeReq))) ===
      "FORBIDDEN",
    "他人の動画には結果を付けられない",
  );
  check(
    (
      await errorCodeOf(
        callAs(finalizeBasicAnalysis, "user1", {
          ...finalizeReq,
          clientRequestId: "req-0002-abcdef",
          metrics: {
            HAND_ABOVE_HEAD: {
              attempts: 1,
              greatCount: 5,
              goodCount: 0,
              missCount: 0,
            },
          },
        }),
      )
    ).startsWith("INVALID_ARGUMENT"),
    "成功数が試行数を超える集計は却下される",
  );

  // #102: eventsを伴わずmetricsだけで高スコアを申告しても、events側の実数で
  // 上書きされ通らないことをエンドツーエンドで確認する
  const forged = await callAs(finalizeBasicAnalysis, "user1", {
    ...finalizeReq,
    clientRequestId: "req-0003-forged",
    events: [], // 対応するeventsを送らない偽装
    metrics: {
      HAND_ABOVE_HEAD: {attempts: 1, greatCount: 1, goodCount: 0, missCount: 0},
      HAND_STOP: {attempts: 1, greatCount: 1, goodCount: 0, missCount: 0},
    },
    rhythm: undefined,
  });
  check(
    forged.totalScore === 0,
    `eventsが無いmetricsの申告は0点になる(#102。実際 ${forged.totalScore})`,
  );
  check(
    (
      await errorCodeOf(
        callAs(finalizeBasicAnalysis, "user1", {
          ...finalizeReq,
          clientRequestId: "req-0004-badts",
          events: [
            {
              ruleId: "HAND_STOP",
              grade: "GREAT",
              timestampMs: 999999,
              value: 1,
            },
          ],
        }),
      )
    ).startsWith("INVALID_ARGUMENT"),
    "durationMsを大きく超えるtimestampMsは拒否される(#102)",
  );

  console.log("--- FN-08 registerStyleReference ---");
  const refA1 = await callAs(registerStyleReference, "adminA", {
    renId: "renA",
    videoId: "videoA1",
    poseSeriesPath: "ren/renA/styleReferences/refA1.pose.json",
    consentObtained: true,
    consentScope: "連スタイル類似度の代表データとして利用",
    approved: true,
  });
  check(
    typeof refA1.referenceId === "string" && refA1.dim === 32,
    "参照 Embedding を生成して保存できる（32 次元）",
  );

  await callAs(registerStyleReference, "adminA", {
    renId: "renA",
    videoId: "videoA2",
    poseSeriesPath: "ren/renA/styleReferences/refA2.pose.json",
    consentObtained: true,
    consentScope: "同上",
    approved: false, // 未承認: 代表計算に入らないこと
  });
  await callAs(registerStyleReference, "adminB", {
    renId: "renB",
    videoId: "videoB1",
    poseSeriesPath: "ren/renB/styleReferences/refB1.pose.json",
    consentObtained: true,
    consentScope: "同上",
    approved: true,
  });

  check(
    (await errorCodeOf(
      callAs(registerStyleReference, "adminB", {
        renId: "renA",
        videoId: "x",
        poseSeriesPath: "ren/renA/styleReferences/refA1.pose.json",
        consentObtained: true,
        consentScope: "s",
      }),
    )) === "FORBIDDEN",
    "連 B の管理者は連 A の参照を登録できない",
  );
  check(
    (
      await errorCodeOf(
        callAs(registerStyleReference, "adminA", {
          renId: "renA",
          videoId: "x",
          poseSeriesPath: "ren/renB/styleReferences/refB1.pose.json",
          consentObtained: true,
          consentScope: "s",
        }),
      )
    ).startsWith("INVALID_ARGUMENT"),
    "他連のパスを指定した参照登録は拒否される",
  );
  check(
    (
      await errorCodeOf(
        callAs(registerStyleReference, "adminA", {
          renId: "renA",
          videoId: "x",
          poseSeriesPath: "ren/renA/styleReferences/refA1.pose.json",
          consentObtained: false,
          consentScope: "s",
        }),
      )
    ).startsWith("INVALID_ARGUMENT"),
    "提供者の同意が無い参照は登録できない",
  );

  console.log("--- FN-07 rebuildRenStyleProfile ---");
  const built = await callAs(rebuildRenStyleProfile, "adminA", {
    renId: "renA",
  });
  check(
    built.sampleCount === 1,
    "approved == true の参照だけが代表計算に使われる",
  );
  await callAs(rebuildRenStyleProfile, "adminB", {renId: "renB"});

  const profileA = (await db.doc("renStyleProfiles/renA").get()).data();
  const vec: number[] = profileA.embeddingRef.vector;
  const norm = Math.sqrt(vec.reduce((a: number, b: number) => a + b * b, 0));
  check(Math.abs(norm - 1) < 1e-9, "代表 Embedding が L2 正規化されている");

  check(
    (await errorCodeOf(
      callAs(rebuildRenStyleProfile, "user1", {renId: "renA"}),
    )) === "FORBIDDEN",
    "連管理者以外は FN-07 を呼べない",
  );
  await db.doc("ren/renC").set({name: "空連"});
  await db.doc("ren/renC/members/adminC").set({role: "admin"});
  check(
    (await errorCodeOf(
      callAs(rebuildRenStyleProfile, "adminC", {renId: "renC"}),
    )) === "STYLE_REFERENCE_NOT_FOUND",
    "承認済み参照が 0 件なら failed-precondition",
  );

  console.log("--- FN-02 analyzeStyle ---");
  const analysis = await callAs(analyzeStyle, "user1", {
    videoId: "videoUser1",
  });
  check(analysis.status === "completed", "解析が完了する");
  check(
    analysis.results[0].renId === "renB",
    `連 B の動きをした人は連 B が 1 位（実際: ${analysis.results
      .map((r: any) => `${r.renId}=${r.similarity.toFixed(3)}`)
      .join(", ")}）`,
  );
  const saved = (
    await db.doc(`styleAnalysisResults/${analysis.styleAnalysisId}`).get()
  ).data();
  check(
    saved.status === "completed" && saved.results.length > 0,
    "styleAnalysisResults へ結果が保存される",
  );

  check(
    (await errorCodeOf(
      callAs(analyzeStyle, "user2", {videoId: "videoUser1"}),
    )) === "FORBIDDEN",
    "他人の動画は解析できない",
  );

  console.log("--- 版の不一致 ---");
  await db.doc("renStyleProfiles/renB").update({
    embeddingVersion: "style-legacy-v0",
    embeddingRef: {kind: "inline", vector: new Array(8).fill(0.1)},
  });
  const afterMismatch = await callAs(analyzeStyle, "user1", {
    videoId: "videoUser1",
  });
  const rebuilt = (await db.doc("renStyleProfiles/renB").get()).data();
  check(
    rebuilt.embeddingVersion === "style-baseline-v1" &&
      rebuilt.embeddingRef.vector.length === 32,
    "版が違う代表 Embedding は再計算される",
  );
  check(
    afterMismatch.results.some((r: any) => r.renId === "renB"),
    "再計算後に比較対象へ戻る",
  );

  console.log("--- モデル利用不可 ---");
  const before = (await db.collection("styleAnalysisResults").get()).size;
  process.env.STYLE_ENCODER_DISABLED = "true";
  const unavailable = await errorCodeOf(
    callAs(analyzeStyle, "user1", {videoId: "videoUser1"}),
  );
  delete process.env.STYLE_ENCODER_DISABLED;
  const after = (await db.collection("styleAnalysisResults").get()).size;
  check(
    unavailable === "STYLE_MODEL_UNAVAILABLE",
    "モデル利用不可なら STYLE_MODEL_UNAVAILABLE",
  );
  check(before === after, "モデル利用不可のとき結果ドキュメントを作らない");

  console.log("--- FN-09 deleteStyleReference とトリガ ---");
  await callAs(deleteStyleReference, "adminB", {
    referenceId: (
      await db
        .collection("renStyleReferences")
        .where("renId", "==", "renB")
        .get()
    ).docs[0].id,
  });
  let profileBExists = true;
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    profileBExists = (await db.doc("renStyleProfiles/renB").get()).exists;
    if (!profileBExists) break;
  }
  check(
    !profileBExists,
    "参照を削除するとトリガが代表 Embedding を作り直す（0 件なら削除）",
  );

  console.log("--- 通知(参加リクエスト・メンバー管理・お誘い・チャット) ---");
  const notificationsOf = async (uid: string) => {
    const snap = await db.collection(`users/${uid}/notifications`).get();
    return snap.docs.map((d: any) => d.data());
  };
  const waitForNotification = async (uid: string, type: string) => {
    for (let i = 0; i < 20; i++) {
      const list = await notificationsOf(uid);
      const found = list.find((n: any) => n.type === type);
      if (found) return found;
      await sleep(500);
    }
    return null;
  };

  await db.doc("ren/renD").set({name: "通知検証連"});
  await db
    .doc("ren/renD/members/adminD")
    .set({userId: "adminD", role: "admin", status: "active"});
  await db
    .doc("ren/renD/members/memberD")
    .set({userId: "memberD", role: "member", status: "active"});
  await db.doc("users/adminD").set({nickname: "管理花子"});
  await db.doc("users/memberD").set({nickname: "既存次郎"});
  await db.doc("users/applicantD").set({nickname: "申請太郎"});

  const joinReq = await callAs(submitJoinRequest, "applicantD", {
    renId: "renD",
    message: "よろしくお願いします",
  });
  const adminNotifs = await notificationsOf("adminD");
  check(
    adminNotifs.some(
      (n: any) =>
        n.type === "join_request" && n.referenceId === joinReq.requestId,
    ),
    "参加リクエスト送信で連の管理者に通知される",
  );
  const memberNotifsAfterRequest = await notificationsOf("memberD");
  check(
    !memberNotifsAfterRequest.some((n: any) => n.type === "join_request"),
    "管理者でない既存メンバーには参加リクエスト通知が来ない",
  );

  await callAs(updateJoinRequestStatus, "adminD", {
    requestId: joinReq.requestId,
    action: "approve",
  });
  const applicantNotifsAfterApprove = await notificationsOf("applicantD");
  check(
    applicantNotifsAfterApprove.some((n: any) => n.type === "join_result"),
    "参加承認で申請者に結果が通知される",
  );
  check(
    (await notificationsOf("memberD")).some(
      (n: any) => n.type === "member_joined" && n.referenceId === "renD",
    ),
    "新メンバー参加で既存メンバーに通知される",
  );
  const adminNotifsAfterApprove = await notificationsOf("adminD");
  check(
    !adminNotifsAfterApprove.some((n: any) => n.type === "member_joined"),
    "承認した管理者自身には新メンバー参加の通知が来ない",
  );
  check(
    !applicantNotifsAfterApprove.some((n: any) => n.type === "member_joined"),
    "新メンバー本人には新メンバー参加の通知が来ない(join_resultのみ)",
  );

  await callAs(updateMemberRole, "adminD", {
    renId: "renD",
    uid: "memberD",
    role: "admin",
  });
  check(
    (await notificationsOf("memberD")).some(
      (n: any) => n.type === "role_changed" && n.referenceId === "renD",
    ),
    "役職変更で本人に通知される",
  );

  await callAs(removeMember, "adminD", {renId: "renD", uid: "applicantD"});
  check(
    (await notificationsOf("applicantD")).some(
      (n: any) => n.type === "member_removed" && n.referenceId === "renD",
    ),
    "除名で本人に通知される",
  );

  await db.doc("invitations/invD").set({
    fromUserId: "adminD",
    fromUserName: "管理花子",
    toUserId: "memberD",
    toUserName: "既存次郎",
    message: "うちの連にどうぞ",
    status: "pending",
    createdAt: new Date(),
  });
  await db.doc("invitations/invD").update({
    status: "accepted",
    updatedAt: new Date(),
  });
  check(
    (await waitForNotification("adminD", "invitation_result")) !== null,
    "お誘いへの応答で送信者に通知される(トリガ)",
  );

  const chatId = ["adminD", "memberD"].sort().join("_");
  await db.collection(`chats/${chatId}/messages`).add({
    text: "稽古の相談です",
    senderId: "adminD",
    createdAt: new Date(),
  });
  check(
    (await waitForNotification("memberD", "chat_message")) !== null,
    "DM送信で相手に通知される(トリガ)",
  );

  console.log("--- leaveRen(本人の脱退) ---");
  await db.doc("ren/renE").set({name: "脱退検証連"});
  await db
    .doc("ren/renE/members/adminE")
    .set({userId: "adminE", role: "admin", status: "active"});
  await db
    .doc("ren/renE/members/memberE")
    .set({userId: "memberE", role: "member", status: "active"});

  await callAs(leaveRen, "memberE", {renId: "renE"});
  const memberEAfter = await db.doc("ren/renE/members/memberE").get();
  check(!memberEAfter.exists, "一般メンバーは自分の意思で連から脱退できる");

  check(
    (await errorCodeOf(callAs(leaveRen, "adminE", {renId: "renE"}))) ===
      "INVALID_STATUS_TRANSITION",
    "連唯一の管理者は脱退できない(最後の管理者不在を防ぐ)",
  );
  const adminEAfter = await db.doc("ren/renE/members/adminE").get();
  check(adminEAfter.exists, "拒否された脱退はドキュメントを削除しない");

  await db
    .doc("ren/renE/members/memberF")
    .set({userId: "memberF", role: "admin", status: "active"});
  await callAs(leaveRen, "adminE", {renId: "renE"});
  const adminEAfter2 = await db.doc("ren/renE/members/adminE").get();
  check(
    !adminEAfter2.exists,
    "他に管理者がいれば管理者本人も脱退できる",
  );

  functionsTest.cleanup();
  console.log(failures === 0 ? "\nALL OK" : `\n${failures} FAILED`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

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
const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

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
  const {
    rebuildRenStyleProfile,
  } = require("../style/rebuildRenStyleProfile");
  const {registerStyleReference} = require("../style/registerStyleReference");
  const {deleteStyleReference} = require("../style/deleteStyleReference");
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
  await putSeries(
    "users/user1/videos/videoUser1.pose.json",
    fixtures.STYLE_B,
    {seed: 24, noise: 0.02, scale: 0.75, speed: 1.1, mirror: true},
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
    (await errorCodeOf(
      callAs(registerStyleReference, "adminA", {
        renId: "renA",
        videoId: "x",
        poseSeriesPath: "ren/renB/styleReferences/refB1.pose.json",
        consentObtained: true,
        consentScope: "s",
      }),
    )).startsWith("INVALID_ARGUMENT"),
    "他連のパスを指定した参照登録は拒否される",
  );
  check(
    (await errorCodeOf(
      callAs(registerStyleReference, "adminA", {
        renId: "renA",
        videoId: "x",
        poseSeriesPath: "ren/renA/styleReferences/refA1.pose.json",
        consentObtained: false,
        consentScope: "s",
      }),
    )).startsWith("INVALID_ARGUMENT"),
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
    `連 B の動きをした人は連 B が 1 位（実際: ${
      analysis.results.map((r: any) => `${r.renId}=${r.similarity.toFixed(3)}`)
        .join(", ")
    }）`,
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
  check(
    before === after,
    "モデル利用不可のとき結果ドキュメントを作らない",
  );

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

  functionsTest.cleanup();
  console.log(failures === 0 ? "\nALL OK" : `\n${failures} FAILED`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

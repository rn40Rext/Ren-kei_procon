import { test, before, after } from "node:test";
import { assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { setupTestEnv } from "./setup.mjs";

let testEnv;
before(async () => {
  testEnv = await setupTestEnv("rules-test-scores");

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc("analysisResults/a1").set({ userId: "alice", totalScore: 80 });
    await ctx.firestore().doc("users/alice/growthRecords/g1").set({ userId: "alice", score: 80, date: new Date() });
  });
});
after(async () => {
  await testEnv.cleanup();
});

test("[本設計の追加分] クライアントからanalysisResultsへwriteできない", async () => {
  const alice = testEnv.authenticatedContext("alice").firestore();
  await assertFails(alice.doc("analysisResults/a1").set({ totalScore: 100 }, { merge: true }));
});

test("本人はanalysisResultsをreadできる", async () => {
  const alice = testEnv.authenticatedContext("alice").firestore();
  await assertSucceeds(alice.doc("analysisResults/a1").get());
});

test("[仕様書15.2] 自分のgrowthRecords.scoreを書き換えられない", async () => {
  const alice = testEnv.authenticatedContext("alice").firestore();
  await assertFails(
    alice.doc("users/alice/growthRecords/g1").set({ score: 100 }, { merge: true })
  );
});

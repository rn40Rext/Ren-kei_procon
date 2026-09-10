import { test, before, after } from "node:test";
import { assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { setupTestEnv } from "./setup.mjs";

let testEnv;
before(async () => {
  testEnv = await setupTestEnv("rules-test-videos");

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc("videos/alice-private").set({
      userId: "alice", visibility: "private", analysisStatus: "uploaded", createdAt: new Date(),
    });
    await ctx.firestore().doc("videos/alice-public").set({
      userId: "alice", visibility: "public", analysisStatus: "completed", createdAt: new Date(),
    });
  });
});
after(async () => {
  await testEnv.cleanup();
});

test("[正常系] 所有者は自分のprivate動画をreadできる", async () => {
  const alice = testEnv.authenticatedContext("alice").firestore();
  await assertSucceeds(alice.doc("videos/alice-private").get());
});

test("[仕様書15.2] 他人のprivate動画はreadできない", async () => {
  const bob = testEnv.authenticatedContext("bob").firestore();
  await assertFails(bob.doc("videos/alice-private").get());
});

test("public動画は他人でもreadできる", async () => {
  const bob = testEnv.authenticatedContext("bob").firestore();
  await assertSucceeds(bob.doc("videos/alice-public").get());
});

test("未認証ではvideosをreadできない", async () => {
  const anon = testEnv.unauthenticatedContext().firestore();
  await assertFails(anon.doc("videos/alice-private").get());
});

test("作成時はvisibility=private・analysisStatus=uploaded以外拒否される", async () => {
  const alice = testEnv.authenticatedContext("alice").firestore();
  await assertFails(
    alice.doc("videos/alice-new").set({
      userId: "alice", visibility: "public", analysisStatus: "uploaded", createdAt: new Date(),
    })
  );
});

test("visibility/analysisStatusはクライアントから更新できない", async () => {
  const alice = testEnv.authenticatedContext("alice").firestore();
  await assertFails(
    alice.doc("videos/alice-private").set({ visibility: "public" }, { merge: true })
  );
});

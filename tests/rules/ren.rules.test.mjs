import { test, before, beforeEach, after } from "node:test";
import { assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { setupTestEnv } from "./setup.mjs";

let testEnv;
before(async () => {
  testEnv = await setupTestEnv("rules-test-ren");
});
after(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc("ren/r1").set({
      name: "連1", createdBy: "alice", memberCount: 1, createdAt: new Date(), updatedAt: new Date(),
    });
    await ctx.firestore().doc("ren/r1/members/alice").set({
      userId: "alice", role: "admin", status: "active", joinedAt: new Date(),
    });
    await ctx.firestore().doc("ren/r2").set({
      name: "連2", createdBy: "bob", memberCount: 1, createdAt: new Date(), updatedAt: new Date(),
    });
    await ctx.firestore().doc("ren/r2/members/bob").set({
      userId: "bob", role: "admin", status: "active", joinedAt: new Date(),
    });
  });
});

test("連の管理者は自連を更新できる", async () => {
  const alice = testEnv.authenticatedContext("alice").firestore();
  await assertSucceeds(alice.doc("ren/r1").set({ name: "連1改" }, { merge: true }));
});

test("[仕様書15.2] ren_adminは別の連のデータを更新できない", async () => {
  const alice = testEnv.authenticatedContext("alice").firestore();
  await assertFails(alice.doc("ren/r2").set({ name: "乗っ取り" }, { merge: true }));
});

test("membersはクライアントから直接createできない(FN-05/system経由)", async () => {
  const carol = testEnv.authenticatedContext("carol").firestore();
  await assertFails(
    carol.doc("ren/r1/members/carol").set({ userId: "carol", role: "member", status: "active", joinedAt: new Date() })
  );
});

test("本人は自分のmembersドキュメントを削除できる(脱退)", async () => {
  const alice = testEnv.authenticatedContext("alice").firestore();
  await assertSucceeds(alice.doc("ren/r1/members/alice").delete());
});

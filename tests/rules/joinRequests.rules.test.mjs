import { test, before, beforeEach, after } from "node:test";
import { assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { setupTestEnv } from "./setup.mjs";

let testEnv;
before(async () => {
  testEnv = await setupTestEnv("rules-test-joinrequests");
});
after(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc("ren/r1/members/alice").set({
      userId: "alice", role: "admin", status: "active", joinedAt: new Date(),
    });
    await ctx.firestore().doc("joinRequests/jr1").set({
      userId: "bob", renId: "r1", status: "pending", createdAt: new Date(), updatedAt: new Date(),
    });
  });
});

test("[#27] joinRequestsはクライアントから直接createできない(submitJoinRequest経由のみ)", async () => {
  const carol = testEnv.authenticatedContext("carol").firestore();
  await assertFails(
    carol.doc("joinRequests/jr2").set({
      userId: "carol", renId: "r1", status: "pending", createdAt: new Date(), updatedAt: new Date(),
    })
  );
});

test("[仕様書15.2] 申請者は自分の申請をapprovedへ変更できない(自己承認の防止)", async () => {
  const bob = testEnv.authenticatedContext("bob").firestore();
  await assertFails(
    bob.doc("joinRequests/jr1").set({ status: "approved" }, { merge: true })
  );
});

test("申請者はpending→cancelledにはできる", async () => {
  const bob = testEnv.authenticatedContext("bob").firestore();
  await assertSucceeds(
    bob.doc("joinRequests/jr1").set({ status: "cancelled" }, { merge: true })
  );
});

test("[#32] 連管理者でもjoinRequestsをクライアントから直接approvedにはできない(updateJoinRequestStatus経由のみ)", async () => {
  const alice = testEnv.authenticatedContext("alice").firestore();
  await assertFails(
    alice.doc("joinRequests/jr1").set({ status: "approved" }, { merge: true })
  );
});

test("[#32] 連管理者でもjoinRequestsをクライアントから直接rejectedにはできない(updateJoinRequestStatus経由のみ)", async () => {
  const alice = testEnv.authenticatedContext("alice").firestore();
  await assertFails(
    alice.doc("joinRequests/jr1").set({ status: "rejected" }, { merge: true })
  );
});

test("[#32] 他人はjoinRequestsをpending→cancelledにできない", async () => {
  const carol = testEnv.authenticatedContext("carol").firestore();
  await assertFails(
    carol.doc("joinRequests/jr1").set({ status: "cancelled" }, { merge: true })
  );
});

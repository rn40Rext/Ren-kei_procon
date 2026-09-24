import { test, before, beforeEach, after } from "node:test";
import { assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { setupTestEnv } from "./setup.mjs";

let testEnv;
before(async () => {
  testEnv = await setupTestEnv("rules-test-invitations");
});
after(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc("invitations/inv1").set({
      fromUserId: "alice",
      fromUserName: "Alice",
      toUserId: "bob",
      toUserName: "Bob",
      message: "うちの連に来ませんか",
      status: "pending",
      createdAt: new Date(),
    });
  });
});

test("送信者本人はinvitationsを読める", async () => {
  const alice = testEnv.authenticatedContext("alice").firestore();
  await assertSucceeds(alice.doc("invitations/inv1").get());
});

test("宛先本人はinvitationsを読める", async () => {
  const bob = testEnv.authenticatedContext("bob").firestore();
  await assertSucceeds(bob.doc("invitations/inv1").get());
});

test("当事者以外はinvitationsを読めない", async () => {
  const carol = testEnv.authenticatedContext("carol").firestore();
  await assertFails(carol.doc("invitations/inv1").get());
});

test("fromUserIdが自分自身なら作成できる", async () => {
  const carol = testEnv.authenticatedContext("carol").firestore();
  await assertSucceeds(
    carol.doc("invitations/inv2").set({
      fromUserId: "carol",
      fromUserName: "Carol",
      toUserId: "bob",
      toUserName: "Bob",
      message: "",
      status: "pending",
      createdAt: new Date(),
    })
  );
});

test("他人のfromUserIdを騙って作成できない", async () => {
  const carol = testEnv.authenticatedContext("carol").firestore();
  await assertFails(
    carol.doc("invitations/inv2").set({
      fromUserId: "alice",
      fromUserName: "Alice",
      toUserId: "bob",
      toUserName: "Bob",
      message: "",
      status: "pending",
      createdAt: new Date(),
    })
  );
});

test("status:'pending'以外では作成できない", async () => {
  const carol = testEnv.authenticatedContext("carol").firestore();
  await assertFails(
    carol.doc("invitations/inv2").set({
      fromUserId: "carol",
      fromUserName: "Carol",
      toUserId: "bob",
      toUserName: "Bob",
      message: "",
      status: "accepted",
      createdAt: new Date(),
    })
  );
});

test("宛先本人はacceptedへ応答できる", async () => {
  const bob = testEnv.authenticatedContext("bob").firestore();
  await assertSucceeds(
    bob.doc("invitations/inv1").set({ status: "accepted", updatedAt: new Date() }, { merge: true })
  );
});

test("宛先本人はdeclinedへ応答できる", async () => {
  const bob = testEnv.authenticatedContext("bob").firestore();
  await assertSucceeds(
    bob.doc("invitations/inv1").set({ status: "declined", updatedAt: new Date() }, { merge: true })
  );
});

test("送信者本人は応答(status変更)できない", async () => {
  const alice = testEnv.authenticatedContext("alice").firestore();
  await assertFails(
    alice.doc("invitations/inv1").set({ status: "accepted", updatedAt: new Date() }, { merge: true })
  );
});

test("宛先本人でもmessageなど応答以外のフィールドは変更できない", async () => {
  const bob = testEnv.authenticatedContext("bob").firestore();
  await assertFails(
    bob.doc("invitations/inv1").set({ status: "accepted", message: "書き換え" }, { merge: true })
  );
});

test("送信者本人は取り消し(delete)できる", async () => {
  const alice = testEnv.authenticatedContext("alice").firestore();
  await assertSucceeds(alice.doc("invitations/inv1").delete());
});

test("宛先本人は取り消し(delete)できない", async () => {
  const bob = testEnv.authenticatedContext("bob").firestore();
  await assertFails(bob.doc("invitations/inv1").delete());
});

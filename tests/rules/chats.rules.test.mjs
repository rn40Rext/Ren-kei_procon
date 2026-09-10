import { test, before, after } from "node:test";
import { assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { setupTestEnv } from "./setup.mjs";

let testEnv;
before(async () => {
  testEnv = await setupTestEnv("rules-test-chats");

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    // chatIdは "小さいUID_大きいUID" 形式([alice, bob].sort().join('_'))
    await ctx.firestore().doc("chats/alice_bob/messages/m1").set({
      text: "hi", senderId: "alice", createdAt: new Date(),
    });
  });
});
after(async () => {
  await testEnv.cleanup();
});

test("チャット参加者は互いのメッセージをreadできる", async () => {
  const bob = testEnv.authenticatedContext("bob").firestore();
  await assertSucceeds(bob.doc("chats/alice_bob/messages/m1").get());
});

test("[本設計の追加分] チャット参加者以外はmessagesをreadできない", async () => {
  const carol = testEnv.authenticatedContext("carol").firestore();
  await assertFails(carol.doc("chats/alice_bob/messages/m1").get());
});

test("参加者は自分をsenderIdとしてメッセージをcreateできる", async () => {
  const alice = testEnv.authenticatedContext("alice").firestore();
  await assertSucceeds(
    alice.doc("chats/alice_bob/messages/m2").set({ text: "hello", senderId: "alice", createdAt: new Date() })
  );
});

test("参加者以外はメッセージをcreateできない", async () => {
  const carol = testEnv.authenticatedContext("carol").firestore();
  await assertFails(
    carol.doc("chats/alice_bob/messages/m3").set({ text: "hi", senderId: "carol", createdAt: new Date() })
  );
});

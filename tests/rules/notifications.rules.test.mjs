import { test, before, after } from "node:test";
import { assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { setupTestEnv } from "./setup.mjs";

let testEnv;
before(async () => {
  testEnv = await setupTestEnv("rules-test-notifications");

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    // 通知はCloud Functions(Admin SDK)だけが作る。テストではRulesを外して用意する。
    await ctx.firestore().doc("users/alice/notifications/n1").set({
      userId: "alice",
      type: "comment",
      referenceId: "p1",
      title: "師匠からアドバイスが届きました",
      body: "腰をもう少し落としましょう",
      read: false,
      createdAt: new Date(),
    });
  });
});
after(async () => {
  await testEnv.cleanup();
});

test("[#43] 本人は自分の通知をreadできる", async () => {
  const alice = testEnv.authenticatedContext("alice").firestore();
  await assertSucceeds(alice.doc("users/alice/notifications/n1").get());
});

test("[#43] 他人の通知はreadできない", async () => {
  const bob = testEnv.authenticatedContext("bob").firestore();
  await assertFails(bob.doc("users/alice/notifications/n1").get());
});

test("[#43] 未サインインでは通知をreadできない", async () => {
  const anon = testEnv.unauthenticatedContext().firestore();
  await assertFails(anon.doc("users/alice/notifications/n1").get());
});

test("[#43] クライアントは自分宛ての通知も作成できない(Functions経由のみ)", async () => {
  const alice = testEnv.authenticatedContext("alice").firestore();
  await assertFails(
    alice.doc("users/alice/notifications/n2").set({
      userId: "alice",
      type: "announcement",
      referenceId: "a1",
      title: "偽のお知らせ",
      body: "本文",
      read: false,
      createdAt: new Date(),
    })
  );
});

test("[#43] クライアントは他人へ通知を作成できない", async () => {
  const bob = testEnv.authenticatedContext("bob").firestore();
  await assertFails(
    bob.doc("users/alice/notifications/n3").set({
      userId: "alice",
      type: "comment",
      referenceId: "p1",
      title: "なりすまし",
      body: "本文",
      read: false,
      createdAt: new Date(),
    })
  );
});

test("[#43] 本人はreadフィールドのみ更新できる", async () => {
  const alice = testEnv.authenticatedContext("alice").firestore();
  await assertSucceeds(
    alice.doc("users/alice/notifications/n1").update({ read: true })
  );
});

test("[#43] read以外のフィールドは更新できない(本文の改変を防ぐ)", async () => {
  const alice = testEnv.authenticatedContext("alice").firestore();
  await assertFails(
    alice.doc("users/alice/notifications/n1").update({ body: "書き換え" })
  );
  await assertFails(
    alice.doc("users/alice/notifications/n1").update({ read: true, title: "書き換え" })
  );
});

test("[#43] 他人の通知を既読にできない", async () => {
  const bob = testEnv.authenticatedContext("bob").firestore();
  await assertFails(
    bob.doc("users/alice/notifications/n1").update({ read: true })
  );
});

test("[#43] 本人は自分の通知を削除できる", async () => {
  const alice = testEnv.authenticatedContext("alice").firestore();
  await assertSucceeds(alice.doc("users/alice/notifications/n1").delete());
});

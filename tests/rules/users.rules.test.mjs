import { test, before, after } from "node:test";
import { assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { setupTestEnv } from "./setup.mjs";

let testEnv;
before(async () => {
  testEnv = await setupTestEnv("rules-test-users");
});
after(async () => {
  await testEnv.cleanup();
});

test("本人はrole:'user'で自分のusersドキュメントを作成できる", async () => {
  const alice = testEnv.authenticatedContext("alice").firestore();
  await assertSucceeds(
    alice.doc("users/alice").set({
      uid: "alice", role: "user", createdAt: new Date(), updatedAt: new Date(),
    })
  );
});

test("[仕様書15.2] 一般ユーザーは自分のroleをren_adminへ変更できない", async () => {
  const alice = testEnv.authenticatedContext("alice").firestore();
  await assertFails(
    alice.doc("users/alice").set({ role: "ren_admin" }, { merge: true })
  );
});

test("本人はnicknameなど非保護フィールドを更新できる", async () => {
  const alice = testEnv.authenticatedContext("alice").firestore();
  await assertSucceeds(
    alice.doc("users/alice").set({ nickname: "アリス" }, { merge: true })
  );
});

test("他人のusersドキュメントを作成できない", async () => {
  const bob = testEnv.authenticatedContext("bob").firestore();
  await assertFails(
    bob.doc("users/alice").set({
      uid: "alice", role: "user", createdAt: new Date(), updatedAt: new Date(),
    })
  );
});

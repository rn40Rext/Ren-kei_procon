import { test, before, beforeEach, after } from "node:test";
import { assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { setupTestEnv } from "./setup.mjs";

// challenges(先輩からのチャレンジ)のRules。docs/design/challenges.md
let testEnv;
before(async () => {
  testEnv = await setupTestEnv("rules-test-challenges");
});
after(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc("ren/r1/members/alice").set({ userId: "alice", role: "admin", status: "active" });
    await ctx.firestore().doc("ren/r1/members/dave").set({ userId: "dave", role: "member", status: "active" });
    await ctx.firestore().doc("ren/r2/members/bob").set({ userId: "bob", role: "admin", status: "active" });
    await ctx.firestore().doc("challenges/c1").set(challenge("r1", "alice"));
  });
});

/** 正しい形のチャレンジ1件 */
function challenge(renId, createdBy, overrides = {}) {
  return {
    renId,
    renName: "連1",
    createdBy,
    posterName: "アリス",
    posterRole: "指導方",
    title: "網打ちの構えから踏み込んでみよう",
    move: "男踊り・網打ち",
    category: "male",
    difficulty: "advanced",
    focus: "膝が固まっていないか",
    advice: [{ point: "骨盤を真下へ預ける", detail: "" }],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

test("ログインユーザーはチャレンジを読める", async () => {
  const carol = testEnv.authenticatedContext("carol").firestore();
  await assertSucceeds(carol.doc("challenges/c1").get());
});

test("未ログインではチャレンジを読めない", async () => {
  const anon = testEnv.unauthenticatedContext().firestore();
  await assertFails(anon.doc("challenges/c1").get());
});

test("連の管理者は自連の名義で出題できる", async () => {
  const alice = testEnv.authenticatedContext("alice").firestore();
  await assertSucceeds(alice.doc("challenges/c2").set(challenge("r1", "alice")));
});

test("一般メンバーは出題できない", async () => {
  const dave = testEnv.authenticatedContext("dave").firestore();
  await assertFails(dave.doc("challenges/c2").set(challenge("r1", "dave")));
});

test("別の連の管理者は他連の名義で出題できない", async () => {
  const bob = testEnv.authenticatedContext("bob").firestore();
  await assertFails(bob.doc("challenges/c2").set(challenge("r1", "bob")));
});

test("createdByを他人にして出題できない", async () => {
  const alice = testEnv.authenticatedContext("alice").firestore();
  await assertFails(alice.doc("challenges/c2").set(challenge("r1", "dave")));
});

test("許可されていない難易度・コツ0件・6件以上は拒否される", async () => {
  const alice = testEnv.authenticatedContext("alice").firestore();
  await assertFails(alice.doc("challenges/c2").set(challenge("r1", "alice", { difficulty: "上級" })));
  await assertFails(alice.doc("challenges/c3").set(challenge("r1", "alice", { advice: [] })));
  const six = Array.from({ length: 6 }, () => ({ point: "p", detail: "" }));
  await assertFails(alice.doc("challenges/c4").set(challenge("r1", "alice", { advice: six })));
});

test("出題した連の管理者は削除できる", async () => {
  const alice = testEnv.authenticatedContext("alice").firestore();
  await assertSucceeds(alice.doc("challenges/c1").delete());
});

test("一般メンバー・他連の管理者は削除できない", async () => {
  const dave = testEnv.authenticatedContext("dave").firestore();
  const bob = testEnv.authenticatedContext("bob").firestore();
  await assertFails(dave.doc("challenges/c1").delete());
  await assertFails(bob.doc("challenges/c1").delete());
});

test("更新でrenIdを別の連に付け替えられない", async () => {
  const alice = testEnv.authenticatedContext("alice").firestore();
  await assertFails(alice.doc("challenges/c1").update({ renId: "r2" }));
  await assertSucceeds(alice.doc("challenges/c1").update({ title: "題名を直しました" }));
});

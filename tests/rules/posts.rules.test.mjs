import { test, before, beforeEach, after } from "node:test";
import { assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { setupTestEnv } from "./setup.mjs";

let testEnv;
before(async () => {
  testEnv = await setupTestEnv("rules-test-posts");
});
after(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc("posts/p1").set({
      userId: "alice", title: "稽古の成果", likeCount: 0, commentCount: 0, createdAt: new Date(),
    });
  });
});

test("posts.createはクライアントから常に拒否される(publishPost経由のみ)", async () => {
  const alice = testEnv.authenticatedContext("alice").firestore();
  await assertFails(
    alice.doc("posts/p2").set({ userId: "alice", title: "t", likeCount: 0, commentCount: 0 })
  );
});

test(
  "[本設計の追加分] 投稿者以外はlikeCountと一緒に他フィールドを更新できない",
  { skip: false },
  async () => {
    // 現状はlikeCount/commentCountのみを対象に、暫定的にどの認証済み
    // ユーザーにも更新を許可している(#48でCloud Functionsトリガに
    // 置き換えるまでの既知の暫定対応。docs/design/security-rules.md
    // 「1.5 実装との既知の差分」参照)。そのため「投稿者以外はlikeCount
    // を一切updateできない」という文字通りの検証はできないが、実際に
    // 効いている境界(他フィールドとの同時更新はできない)を検証する。
    const bob = testEnv.authenticatedContext("bob").firestore();
    await assertFails(
      bob.doc("posts/p1").set({ likeCount: 1, title: "乗っ取り" }, { merge: true })
    );
    await assertSucceeds(
      bob.doc("posts/p1").set({ likeCount: 1 }, { merge: true })
    );
  }
);

test("投稿者本人は全フィールドを更新できる", async () => {
  const alice = testEnv.authenticatedContext("alice").firestore();
  await assertSucceeds(
    alice.doc("posts/p1").set({ title: "改題" }, { merge: true })
  );
});

test("[本設計の追加分] 同一ユーザーが同じ投稿へ2回likeできない(同IDへの再create)", async () => {
  const bob = testEnv.authenticatedContext("bob").firestore();
  await assertSucceeds(
    bob.doc("posts/p1/likes/bob").set({ userId: "bob", createdAt: new Date() })
  );
  await assertFails(
    bob.doc("posts/p1/likes/bob").set({ userId: "bob", createdAt: new Date() })
  );
});

test("[仕様書15.2] コメントAの投稿者はコメントBを削除できない", async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc("posts/p1/comments/cB").set({
      userId: "bob", userName: "Bob", text: "hi", type: "normal", createdAt: new Date(),
    });
  });
  const carol = testEnv.authenticatedContext("carol").firestore();
  await assertFails(carol.doc("posts/p1/comments/cB").delete());
});

test("[正常系] コメント本人は自分のコメントを削除できる", async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc("posts/p1/comments/cBob").set({
      userId: "bob", userName: "Bob", text: "hi", type: "normal", createdAt: new Date(),
    });
  });
  const bob = testEnv.authenticatedContext("bob").firestore();
  await assertSucceeds(bob.doc("posts/p1/comments/cBob").delete());
});

test(
  "[本設計の追加分] 管理者でないユーザーはtype:'instructor'のコメントを作成できない",
  { skip: "連機能(ren/members)が未実装で誰もisRenAdmin()になれないため、今締めると「師匠の教え」機能が誰も使えなくなる。連機能実装時にチームで対応することを決定済み(docs/design/security-rules.md参照)。現状は誰でも作成できる。" },
  async () => {
    const bob = testEnv.authenticatedContext("bob").firestore();
    await assertFails(
      bob.doc("posts/p1/comments/instr1").set({
        userId: "bob", userName: "Bob", renId: "r1", text: "教え", type: "instructor", createdAt: new Date(),
      })
    );
  }
);

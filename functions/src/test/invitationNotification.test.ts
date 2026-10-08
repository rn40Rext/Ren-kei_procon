import assert from "node:assert/strict";
import {test} from "node:test";
import {invitationNotificationFor} from "../triggers/onInvitationWrite";

const pending = {
  fromUserId: "alice",
  fromUserName: "管理花子",
  toUserId: "bob",
  toUserName: "既存次郎",
  status: "pending",
};

test("お誘いが作られたら、宛先に invitation_received を作る", () => {
  const n = invitationNotificationFor("inv1", undefined, pending);
  assert.ok(n);
  assert.equal(n.uid, "bob");
  assert.equal(n.type, "invitation_received");
  assert.equal(n.referenceId, "inv1");
  assert.match(n.body, /管理花子さん/);
});

test("pending でない状態で作られたお誘いは通知しない", () => {
  const n = invitationNotificationFor("inv1", undefined, {
    ...pending,
    status: "accepted",
  });
  assert.equal(n, null);
});

test("宛先(toUserId)が無いお誘いは通知しない", () => {
  const n = invitationNotificationFor("inv1", undefined, {
    ...pending,
    toUserId: undefined,
  });
  assert.equal(n, null);
});

test("送信者名が無くても、宛先への通知は作る", () => {
  const n = invitationNotificationFor("inv1", undefined, {
    ...pending,
    fromUserName: undefined,
  });
  assert.ok(n);
  assert.match(n.body, /誰かさん/);
});

test("承諾されたら、送信者に invitation_result(承諾)を作る", () => {
  const n = invitationNotificationFor("inv1", pending, {
    ...pending,
    status: "accepted",
  });
  assert.ok(n);
  assert.equal(n.uid, "alice");
  assert.equal(n.type, "invitation_result");
  assert.equal(n.title, "お誘いが承諾されました");
});

test("辞退されたら、送信者に invitation_result(辞退)を作る", () => {
  const n = invitationNotificationFor("inv1", pending, {
    ...pending,
    status: "declined",
  });
  assert.ok(n);
  assert.equal(n.uid, "alice");
  assert.equal(n.title, "お誘いが辞退されました");
});

test("応答済みのお誘いの再更新や、削除では通知しない", () => {
  const accepted = {...pending, status: "accepted"};
  assert.equal(invitationNotificationFor("inv1", accepted, accepted), null);
  assert.equal(invitationNotificationFor("inv1", pending, undefined), null);
});

test("pending のままの更新(メッセージ変更など)では通知しない", () => {
  const n = invitationNotificationFor("inv1", pending, {
    ...pending,
    message: "書き換え",
  });
  assert.equal(n, null);
});

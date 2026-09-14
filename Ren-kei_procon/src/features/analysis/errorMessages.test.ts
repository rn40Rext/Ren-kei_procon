import assert from "node:assert/strict";
import { test } from "node:test";
import { FUNCTIONS_UNREACHABLE, finalizeErrorMessage, isFunctionsUnreachable } from "./errorMessages";

test("Functions に届かない失敗を到達不能と判定する", () => {
  // ブラウザは「関数が無い」を CORS エラーとして見せるので、文言で拾う
  for (const message of [
    "Access to fetch at 'https://asia-northeast1-ren-kei.cloudfunctions.net/finalizeBasicAnalysis' from origin 'http://localhost:8081' has been blocked by CORS policy",
    "TypeError: Failed to fetch",
    "Network request failed",
    "net::ERR_FAILED",
  ]) {
    assert.ok(isFunctionsUnreachable(new Error(message)), message);
    assert.equal(finalizeErrorMessage(new Error(message)), FUNCTIONS_UNREACHABLE);
  }
});

test("仕様書 13章のコードは日本語の文言になる", () => {
  assert.match(finalizeErrorMessage({ message: "FORBIDDEN" }), /権限がありません/);
  assert.match(finalizeErrorMessage({ message: "UNAUTHORIZED" }), /ログイン/);
  assert.match(finalizeErrorMessage({ message: "INVALID_ARGUMENT:videoId" }), /判定データが不正/);
});

test("分類できない失敗は原文を添えて返す(原因を追えるように)", () => {
  const msg = finalizeErrorMessage(new Error("something else"));
  assert.match(msg, /採点に失敗しました/);
  assert.match(msg, /something else/);
});

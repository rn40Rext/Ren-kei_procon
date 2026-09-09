import assert from "node:assert/strict";
import {test} from "node:test";
import {HttpsError} from "firebase-functions/v2/https";
import {requireAuth} from "../lib/guards";

test("requireAuth returns the uid when authenticated", () => {
  const uid = requireAuth({auth: {uid: "abc123"}} as never);
  assert.equal(uid, "abc123");
});

test("requireAuth throws UNAUTHORIZED when auth is missing", () => {
  assert.throws(
    () => requireAuth({auth: undefined} as never),
    (err: unknown) =>
      err instanceof HttpsError && err.code === "unauthenticated"
  );
});

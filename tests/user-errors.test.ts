import assert from "node:assert/strict";
import test from "node:test";
import { describeUserError, errorCatalog, userFacingError } from "../lib/user-errors.ts";

test("user error catalog keeps diagnostic codes but returns actionable Chinese copy", () => {
  const conflict = describeUserError({ code: "revision_conflict" });
  assert.equal(conflict.code, "revision_conflict");
  assert.equal(conflict.message.includes("revision_conflict"), false);
  assert.match(conflict.nextStep, /最新|重新提交/);
  assert.equal(userFacingError({ code: "revision_conflict" }).includes("revision_conflict"), false);
  assert.ok(errorCatalog().some((item) => item.code === "provider_error"));
});

test("unknown errors do not leak raw stack or provider text", () => {
  const message = userFacingError({ code: "unknown_internal_9188", message: "Error: /private/token=secret" });
  assert.equal(message.includes("/private/token"), false);
  assert.equal(message.includes("secret"), false);
});

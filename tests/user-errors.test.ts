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

test("known diagnostic codes override raw provider details", () => {
  const message = userFacingError({ code: "invalid_output", message: "模型输出未通过 Schema：operations: Too big" });
  assert.equal(message.includes("Too big"), false);
  assert.equal(message.includes("未经校验"), true);
});

// T-061: an answer cut off at the model's token budget says so, instead of "服务暂时不可用".
test("a cut-off model answer is described as truncated, with the draft unchanged", () => {
  const truncated = describeUserError({ code: "truncated" });
  assert.equal(truncated.code, "truncated");
  assert.equal(truncated.message, "这次生成被截断，没有改动草稿。");
  assert.match(truncated.nextStep, /重试/);
  assert.equal(userFacingError({ code: "truncated", message: "DeepSeek 输出达到 token 上限" }).includes("token"), false);
  assert.ok(errorCatalog().some((item) => item.code === "truncated"));
});

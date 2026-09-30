import assert from "node:assert/strict";
import test from "node:test";
import { schemaIssueFields } from "../lib/schema-issue-fields.ts";

// T-058: the server log names where a model answer failed its schema (keys, indices and zod's issue
// code), never what the answer said. A key the model made up, or an unexpected code, is masked.
test("schema issues become path:code, with made-up keys and odd codes masked", () => {
  assert.deepEqual(schemaIssueFields([
    { path: ["operations", 15, "value", "items", 0, "body"], code: "invalid_type" },
    { path: [], code: "too_big" },
    { path: ["blockVariants", "发到 catalog@p3e-sim.test"], code: "invalid_value" },
    { path: ["summary"], code: "Too Big: 发到" },
    { path: [Symbol("x"), "value"], code: "custom" },
  ]), [
    "operations.15.value.items.0.body:invalid_type",
    "root:too_big",
    "blockVariants.?:invalid_value",
    "summary:other",
    "?.value:custom",
  ]);
  const many = Array.from({ length: 9 }, (_, index) => ({ path: ["operations", index], code: "invalid_union" }));
  assert.equal(schemaIssueFields(many).length, 6, "at most six");
});

import assert from "node:assert/strict";
import test from "node:test";
import { defaultDraft } from "../lib/site-document.ts";
import { aiIntentResponseSchema, validateAIOperations } from "../lib/site-operations.ts";

// T-118 source contract. These literal expectations come from the supplied
// molding facts, not from parser output. The old sorted number/unit bags lose
// ownership; equivalent spaces and cycle words must not change the verdict.
const materials = "产能：模具年产约 180 套；注塑机 42 台（90–800 t），月注塑能力约 600 万件。";
const chinese = "模具年产约 180 套；月注塑能力约 600 万件";
const cases = [
  { name: "annual/monthly", zh: chinese, en: "Annual mold output about 180 molds; monthly injection capacity about 6 million pieces", accept: true },
  { name: "Chinese spacing", zh: "模具年产约180套；月注塑能力约600万件", en: "About 180 molds per year; about 6 million pieces per month", accept: true },
  { name: "hyphenated output", zh: chinese, en: "Approximately 180 mold sets per year; approximately 6 million injection-molded pieces per month", accept: true },
  { name: "periods swapped", zh: chinese, en: "About 180 molds per month; about 6 million pieces per year", accept: false },
  { name: "units swapped", zh: chinese, en: "About 180 pieces per year; about 6 million molds per month", accept: false },
  { name: "wrong number", zh: chinese, en: "About 181 molds per year; about 6 million pieces per month", accept: false },
  { name: "approximation dropped", zh: chinese, en: "180 molds per year; about 6 million pieces per month", accept: false },
  { name: "cycle conversion", zh: chinese, en: "About 15 molds per month; about 6 million pieces per month", accept: false },
  { name: "equipment promoted to output", zh: "注塑机 42 台（90–800 t）", en: "42 machines per month (90–800 t)", accept: false },
];

for (const input of cases) {
  for (const mode of ["replace", "update"] as const) {
    test(`T118 capacity contract ${input.name} ${mode}`, () => {
      const value = { zh: input.zh, en: input.en };
      const draft = structuredClone(defaultDraft);
      draft.content.commercialTerms = [{ id: "capacity", kind: "capacity", value: { zh: chinese, en: "About 180 molds per year; about 6 million pieces per month" } }];
      const parsed = aiIntentResponseSchema.parse({ type: "edit", summary: "核对资料产能", operations: [mode === "replace"
        ? { op: "replace_commercial_terms", terms: [{ id: "capacity", kind: "capacity", value }] }
        : { op: "update_commercial_term", termId: "capacity", kind: "capacity", value }] });
      assert.equal(parsed.type, "edit");
      if (parsed.type !== "edit") throw new Error("Expected edit");
      const result = validateAIOperations(materials, parsed.operations, new Set(["screwfast"]), draft);
      assert.deepEqual(result.operations, input.accept ? parsed.operations : [], `${input.name}: preserve quantity, unit, period and approximation together`);
      assert.equal(result.rejected.length === 0, input.accept);
    });
  }
}

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import path from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { defaultDraft, type CommercialTerm } from "../lib/site-document.ts";
import { aiIntentResponseSchema, validateAIOperations } from "../lib/site-operations.ts";
import { simulatedPacks, wrapCompanyMaterials } from "../lib/simulated-packs.ts";

// Independent synthetic controls from T118, NOT the unknown first T110 model value.
// Failure modes: equivalent spacing/cycle words rejected; numbers, units, cycles or
// numerical qualifiers detached/swapped; equipment promoted to output; converted
// cycles; Chinese fragments/subjects invented; refusal values lost or trusted.
// Contract: T-078 Resolution / spec commercial-term facts accept source facts;
// they do not require a quantity, unit or cycle. Truth does not prove completeness.
const repoRoot = process.cwd();
const evidenceRoot = process.env.T118_EVIDENCE_DIR;
const isolatedRoot = await mkdtemp(path.join(evidenceRoot ?? tmpdir(), "t118-store-"));
const envKeys = ["SITE_STORE", "NODE_ENV", "DEEPSEEK_API_KEY", "DEEPSEEK_BASE_URL", "DEEPSEEK_MODEL", "AI_API_KEY", "AI_BASE_URL", "AI_MODEL"];
const previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
process.env.SITE_STORE = "fs";
(process.env as Record<string, string | undefined>).NODE_ENV = "test";
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const base = path.join(repoRoot, specifier.slice(2));
    return nextResolve(pathToFileURL(existsSync(`${base}.ts`) ? `${base}.ts` : base).href, context);
  },
});
// Load the existing layout scanner from the repository before isolating store cwd.
await import("../lib/site-style-check.ts");
process.chdir(isolatedRoot);
const { createSite, commitOperations, getExistingSite, moveHistory } = await import("../lib/site-store.ts");
const { requestStructuredOperations } = await import("../lib/ai-provider.ts");
test.after(() => {
  process.chdir(repoRoot);
  for (const key of envKeys) {
    if (previousEnv[key] === undefined) delete process.env[key];
    else process.env[key] = previousEnv[key];
  }
});

const SOURCE = "产能：模具年产约 180 套；注塑机 42 台（90–800 t），月注塑能力约 600 万件。";
const ZH = "模具年产约 180 套；月注塑能力约 600 万件";
const WITH_EQUIPMENT = "模具年产约 180 套；注塑机 42 台（90–800 t），月注塑能力约 600 万件";
const EN = "About 180 molds per year; injection capacity about 6 million pieces per month";
const term = (zh: string, en: string): CommercialTerm => ({ id: "capacity", kind: "capacity", value: { zh, en } });
const templates = new Set(["forge", "screwfast", "landwind", "tailwind-landing"]);

// Independent contract inputs: 17 is unchanged while an explicitly supplied
// unit is kept, dropped, invented or changed. Field language cannot hide it.
const quantifiedUnitCases = [
  ...(["commercial", "spec", "body", "event"] as const).flatMap((field) => {
    const texts = {
      commercial: ["17 days", "17", "17 天", "17 周"],
      spec: ["17 days", "17", "17 天", "17 周"],
      body: ["每 17 hours 抽检", "抽检 17", "抽检 17 小时", "抽检 17 天"],
      event: ["新增 17 machines", "新增 17", "新增 17 台", "新增 17 吨"],
    }[field];
    const translations = { commercial: "17 days", spec: "17 days", body: "Inspect every 17 hours", event: "Added 17 machines" }[field];
    const dropped = { commercial: "17", spec: "17", body: "Inspect every 17", event: "Added 17" }[field];
    return [
      { id: `${field}-latin-keep`, field, zh: texts[0], en: translations, accept: true },
      { id: `${field}-latin-drop`, field, zh: texts[0], en: dropped, accept: false },
      { id: `${field}-han-add`, field, zh: texts[1], en: texts[2], accept: false },
      { id: `${field}-han-swap`, field, zh: texts[2], en: texts[3], accept: false },
    ];
  }),
  { id: "name-latin-keep", field: "name", zh: "17 t 注塑机", en: "17 t injection machine", accept: true },
  { id: "name-latin-drop", field: "name", zh: "17 t 注塑机", en: "17 injection machine", accept: false },
  { id: "name-latin-add", field: "name", zh: "17 注塑机", en: "17 t injection machine", accept: false },
  { id: "name-latin-swap", field: "name", zh: "17 t 注塑机", en: "17 kg injection machine", accept: false },
  { id: "name-han-keep", field: "name", zh: "17 吨 注塑机", en: "17 吨 injection machine", accept: true },
  { id: "name-han-drop", field: "name", zh: "17 吨 注塑机", en: "17 injection machine", accept: false },
  { id: "name-han-swap", field: "name", zh: "17 吨 注塑机", en: "17 千克 injection machine", accept: false },
  { id: "spec-han-kg-keep", field: "spec", zh: "17 千克", en: "17 kg", accept: true },
  { id: "spec-han-kg-drop", field: "spec", zh: "17 千克", en: "17", accept: false },
  { id: "name-spec-cannot-mask", field: "name", zh: "17 t 注塑机", en: "17 kg injection machine", spec: { zh: "29 t；31 kg", en: "29 t; 31 kg" }, accept: false },
] as const;

function quantifiedUnitInput(field: string, zh: string, en: string, spec?: { zh: string; en: string }) {
  const value = { zh, en };
  if (field === "commercial") return { source: `交期：${zh}。`, replace: { op: "replace_commercial_terms", terms: [{ id: "quant-unit", kind: "lead_time", value }] }, update: { op: "update_commercial_term", termId: "quant-unit", kind: "lead_time", value } };
  if (field === "name" || field === "spec") {
    const item = { id: "quant-unit", name: field === "name" ? value : { zh: "恒温试验机", en: "Temperature test machine" }, quantity: null, spec: field === "spec" ? value : spec ?? null };
    return { source: `设备：${item.name.zh}；${item.spec?.zh ?? ""}。`, replace: { op: "replace_equipment", equipment: [item] }, update: { op: "update_equipment", equipmentId: item.id, name: item.name, quantity: null, spec: item.spec } };
  }
  if (field === "body") {
    const item = { id: "quant-unit", title: { zh: "过程巡检", en: "Process inspection" }, body: value };
    return { source: `质检流程：过程巡检，${zh}。`, replace: { op: "replace_quality_process", steps: [item] }, update: { op: "update_quality_process", stepId: item.id, title: item.title, body: value } };
  }
  const item = { id: "quant-unit", year: 2023, event: value };
  return { source: `沿革：2023 年 ${zh}。`, replace: { op: "replace_history", history: [item] }, update: { op: "update_history", itemId: item.id, year: item.year, event: value } };
}

for (const [index, input] of quantifiedUnitCases.entries()) {
  for (const mode of ["replace", "update"] as const) {
    test(`T118 quantified field unit ${input.id} ${mode}`, async () => {
      const seedText = { commercial: ["11 天", "11 days"], name: ["11 t 注塑机", "11 t injection machine"], spec: ["11 kg", "11 kg"], body: ["每 11 小时抽检", "Inspect every 11 hours"], event: ["新增 11 台", "Added 11 machines"] }[input.field]!;
      const seed = quantifiedUnitInput(input.field, seedText[0], seedText[1]);
      const candidate = quantifiedUnitInput(input.field, input.zh, input.en, "spec" in input ? input.spec : undefined);
      const siteId = `quant-unit-${index}-${mode}`;
      const initial = await createSite(siteId);
      const seedParsed = aiIntentResponseSchema.parse({ type: "edit", summary: "Source seed", operations: [seed.replace] });
      if (seedParsed.type !== "edit") throw new Error("Expected edit seed");
      const seedChecked = validateAIOperations(seed.source, seedParsed.operations, templates, initial.draft);
      assert.deepEqual(seedChecked.operations, seedParsed.operations, "public native-unit seed must be accepted");
      const seeded = await commitOperations({ siteId, baseRevision: initial.draft.revision, operations: seedChecked.operations, summary: "Source seed", source: "ai" });
      assert.equal(seeded.status, "applied");
      const before = (await getExistingSite(siteId))!;
      const parsed = aiIntentResponseSchema.parse({ type: "edit", summary: "Numeric unit contract", operations: [candidate[mode]] });
      if (parsed.type !== "edit") throw new Error("Expected edit candidate");
      const checked = validateAIOperations(candidate.source, parsed.operations, templates, before.draft);
      const file = path.join(isolatedRoot, ".sitecraft-data", "sites", `${siteId}.json`);
      const beforeBytes = await readFile(file, "utf8");
      const committed = await commitOperations({ siteId, baseRevision: before.draft.revision, operations: checked.operations, summary: "Numeric unit contract", source: "ai" });
      const after = (await getExistingSite(siteId))!;
      const afterBytes = await readFile(file, "utf8");
      const undo = committed.status === "applied" ? await moveHistory(siteId, "undo") : null;
      const undone = await getExistingSite(siteId);
      if (evidenceRoot) await writeFile(path.join(evidenceRoot, `quantified-unit-${input.id}-${mode}.json`), JSON.stringify({ input, mode, seed, candidate, parsed, checked, before, committed, after, beforeBytes, afterBytes, undo, undone }, null, 2), { encoding: "utf8", flag: "wx" });
      assert.deepEqual(checked.operations, input.accept ? parsed.operations : [], "unit correspondence is independent of field language and digits");
      assert.equal(committed.status, input.accept ? "applied" : "no_change");
      if (input.accept) {
        const expected = aiIntentResponseSchema.parse({ type: "edit", summary: "Literal expected content", operations: [candidate.replace] });
        if (expected.type !== "edit") throw new Error("Expected replace form");
        const op = expected.operations[0];
        if (op.op === "replace_commercial_terms") assert.deepEqual(after.draft.content.commercialTerms, op.terms);
        if (op.op === "replace_equipment") assert.deepEqual(after.draft.content.equipment, op.equipment);
        if (op.op === "replace_quality_process") assert.deepEqual(after.draft.content.qualityProcess, op.steps);
        if (op.op === "replace_history") assert.deepEqual(after.draft.content.history, op.history);
        assert.ok(committed.status === "applied" && committed.changeSet.appliedTargets.length);
        assert.equal(undo?.status, "applied");
        assert.deepEqual(undone?.draft.content, before.draft.content);
        assert.equal(undone?.draft.englishReady, before.draft.englishReady);
      } else {
        assert.ok(checked.rejected.length);
        assert.equal(afterBytes, beforeBytes);
        assert.deepEqual(after.draft, before.draft);
      }
    });
  }
}

// Complete number-unit pairs, including multiplicity, come from these literal
// source facts. Equal independently sorted bags are not a relation oracle.
const numberUnitRelationCases = [
  { id: "lead-swap", field: "commercial", zh: "模具 25 天；注塑件 3 周", en: "Molds 25 weeks; injection parts 3 days", accept: false },
  { id: "lead-keep", field: "commercial", zh: "模具 25 天；注塑件 3 周", en: "Molds 25 days; injection parts 3 weeks", accept: true },
  { id: "moq-swap", field: "commercial", kind: "moq", zh: "模具 7 套；注塑件 91 件", en: "Molds 7 pieces; injection parts 91 sets", accept: false },
  { id: "moq-keep", field: "commercial", kind: "moq", zh: "模具 7 套；注塑件 91 件", en: "Molds 7 sets; injection parts 91 pieces", accept: true },
  { id: "spec-swap", field: "spec", zh: "载荷 37 kg，保压 9 小时", en: "Load 37 hours, dwell 9 kg", accept: false },
  { id: "spec-keep", field: "spec", zh: "载荷 37 kg，保压 9 小时", en: "Load 37 kg, dwell 9 hours", accept: true },
  { id: "body-swap", field: "body", zh: "每 3 小时抽检 7 件", en: "Every 3 pieces inspect 7 hours", accept: false },
  { id: "body-keep", field: "body", zh: "每 3 小时抽检 7 件", en: "Every 3 hours inspect 7 pieces", accept: true },
  { id: "event-swap", field: "event", zh: "新增 7 台设备，月产 91 件", en: "Added 7 pieces, monthly output 91 machines", accept: false },
  { id: "event-keep", field: "event", zh: "新增 7 台设备，月产 91 件", en: "Added 7 machines, monthly output 91 pieces", accept: true },
  { id: "repeat-count-swap", field: "commercial", zh: "5 天；5 天；5 周", en: "5 days; 5 weeks; 5 weeks", accept: false },
  { id: "repeat-count-keep", field: "commercial", zh: "5 天；5 天；5 周", en: "5 weeks; 5 days; 5 days", accept: true },
  { id: "same-unit-reorder", field: "spec", zh: "载荷 7 kg；载荷 91 kg", en: "Load 91 kg; load 7 kg", accept: true },
  { id: "legal-reorder", field: "commercial", zh: "模具 25 天；注塑件 3 周", en: "Injection parts 3 weeks; molds 25 days", accept: true },
  { id: "directional-alias", field: "commercial", kind: "moq", zh: "7 台；91 件", en: "7 sets; 91 parts", accept: true },
  { id: "reverse-alias", field: "commercial", kind: "moq", zh: "7 套；91 件", en: "7 machines; 91 parts", accept: false },
  { id: "range-swap", field: "commercial", zh: "25–55 天；3–5 周", en: "25–55 weeks; 3–5 days", accept: false },
  { id: "range-keep", field: "commercial", zh: "25–55 天；3–5 周", en: "3-5 weeks; 25-55 days", accept: true },
  { id: "mixed-keep", field: "commercial", zh: "25 days；3 周", en: "25 days; 3 weeks", accept: true },
  { id: "precision-swap", field: "spec", zh: "载荷 9007199254740997 kg；保压 0.125 小时", en: "Load 9007199254740997 hours; dwell 0.125 kg", accept: false },
  { id: "precision-keep", field: "spec", zh: "载荷 9007199254740997 kg；保压 0.125 小时", en: "Load 9,007,199,254,740,997 kg; dwell 0.125 hours", accept: true },
  { id: "bare-number-transfer", field: "commercial", kind: "moq", zh: "7 套；91", en: "7; 91 sets", accept: false },
  { id: "implicit-word-invent", field: "commercial", zh: "data sets 按订单安排", en: "One set arranged to order", accept: false },
  { id: "implicit-word-keep", field: "commercial", zh: "data sets 按订单安排", en: "Sets arranged to order", accept: true },
] as const;

for (const [index, input] of numberUnitRelationCases.entries()) {
  for (const mode of ["replace", "update"] as const) {
    test(`T118 number unit relation ${input.id} ${mode}`, async () => {
      const base = quantifiedUnitInput(input.field, input.zh, input.en);
      const candidate = "kind" in input ? { ...base, source: base.source.replace(/^交期：/, "MOQ："), replace: { op: "replace_commercial_terms", terms: [{ id: "quant-unit", kind: input.kind, value: { zh: input.zh, en: input.en } }] }, update: { op: "update_commercial_term", termId: "quant-unit", kind: input.kind, value: { zh: input.zh, en: input.en } } } : base;
      const seedText = { commercial: ["11 天", "11 days"], spec: ["11 kg", "11 kg"], body: ["每 11 小时抽检", "Inspect every 11 hours"], event: ["新增 11 台", "Added 11 machines"] }[input.field];
      const seedBase = quantifiedUnitInput(input.field, seedText[0], seedText[1]);
      const seed = "kind" in input ? { ...seedBase, source: "MOQ：11 件。", replace: { op: "replace_commercial_terms", terms: [{ id: "quant-unit", kind: input.kind, value: { zh: "11 件", en: "11 pieces" } }] } } : seedBase;
      const siteId = `number-unit-relation-${index}-${mode}`;
      const initial = await createSite(siteId);
      const seedParsed = aiIntentResponseSchema.parse({ type: "edit", summary: "Source seed", operations: [seed.replace] });
      if (seedParsed.type !== "edit") throw new Error("Expected seed");
      const seedChecked = validateAIOperations(seed.source, seedParsed.operations, templates, initial.draft);
      assert.deepEqual(seedChecked.operations, seedParsed.operations);
      const seeded = await commitOperations({ siteId, baseRevision: initial.draft.revision, operations: seedChecked.operations, summary: "Source seed", source: "ai" });
      assert.equal(seeded.status, "applied");
      const before = (await getExistingSite(siteId))!;
      const parsed = aiIntentResponseSchema.parse({ type: "edit", summary: "Number unit relation", operations: [candidate[mode]] });
      if (parsed.type !== "edit") throw new Error("Expected candidate");
      const checked = validateAIOperations(candidate.source, parsed.operations, templates, before.draft);
      const file = path.join(isolatedRoot, ".sitecraft-data", "sites", `${siteId}.json`);
      const beforeBytes = await readFile(file, "utf8");
      const committed = await commitOperations({ siteId, baseRevision: before.draft.revision, operations: checked.operations, summary: "Number unit relation", source: "ai" });
      const after = (await getExistingSite(siteId))!;
      const afterBytes = await readFile(file, "utf8");
      const undo = committed.status === "applied" ? await moveHistory(siteId, "undo") : null;
      const undone = await getExistingSite(siteId);
      if (evidenceRoot) await writeFile(path.join(evidenceRoot, `number-unit-relation-${input.id}-${mode}.json`), JSON.stringify({ input, mode, seed, candidate, parsed, checked, before, committed, after, beforeBytes, afterBytes, undo, undone }, null, 2), { encoding: "utf8", flag: "wx" });
      assert.deepEqual(checked.operations, input.accept ? parsed.operations : [], "every quantity must retain its own unit and occurrence");
      assert.equal(committed.status, input.accept ? "applied" : "no_change");
      if (input.accept) {
        const expected = aiIntentResponseSchema.parse({ type: "edit", summary: "Literal expected content", operations: [candidate.replace] });
        if (expected.type !== "edit") throw new Error("Expected literal replacement");
        const op = expected.operations[0];
        if (op.op === "replace_commercial_terms") assert.deepEqual(after.draft.content.commercialTerms, op.terms);
        if (op.op === "replace_equipment") assert.deepEqual(after.draft.content.equipment, op.equipment);
        if (op.op === "replace_quality_process") assert.deepEqual(after.draft.content.qualityProcess, op.steps);
        if (op.op === "replace_history") assert.deepEqual(after.draft.content.history, op.history);
        assert.equal(undo?.status, "applied");
        assert.deepEqual(undone?.draft.content, before.draft.content);
        assert.deepEqual(undone?.history, before.history);
      } else {
        assert.ok(checked.rejected.length);
        assert.equal(afterBytes, beforeBytes);
        assert.deepEqual(after.history, before.history);
      }
    });
  }
}

// Unsupported complete numeric notation must not become a list of scalars.
// A standalone ratio uses the same known atoms and ordered relation as a
// declaration. Expected facts are literal public-contract controls.
const completeNotationCases = [
  { id: "exponent-source", zh: "1e3 kg", en: "1; 3 kg", accept: false },
  { id: "fraction-source", zh: "1/2 kg", en: "1; 2 kg", accept: false },
  { id: "exponent-candidate", zh: "1; 3 kg", en: "1e3 kg", accept: false },
  { id: "fraction-candidate", zh: "1; 2 kg", en: "1/2 kg", accept: false },
  { id: "fraction-spaced", zh: "1 / 2 kg", en: "1; 2 kg", accept: false },
  { id: "exponent-upper", zh: "1E3 kg", en: "1; 3 kg", accept: false },
  { id: "neutral-separated", zh: "1; 3 kg", en: "1; 3 kg", accept: true },
  { id: "neutral-word-slash", zh: "1 kg / 2 t", en: "1 kg / 2 tons", accept: true },
  { id: "complete-code", zh: "采用R-17", en: "Use R-17", accept: true },
  { id: "code-slash-digits", zh: "采用R17/3", en: "Use R17/3", accept: true },
  { id: "trade-code", zh: "采用T/T", en: "Use T/T", accept: true },
  { id: "range-precision", zh: "17.25–31.75 kg", en: "17.25-31.75 kg", accept: true },
  { id: "bare-ratio-keep", zh: "kg/t", en: "kg/t", accept: true },
  { id: "bare-ratio-alias", zh: "kg/t", en: "kg per ton", accept: true },
  { id: "bare-ratio-reverse", zh: "kg/t", en: "t/kg", accept: false },
  { id: "bare-ratio-drop", zh: "kg/t", en: "Weight", accept: false },
  { id: "bare-ratio-part-drop", zh: "kg/t", en: "Weight in kg", accept: false },
  { id: "bare-ratio-bag", zh: "kg/t", en: "kg; tons", accept: false },
  { id: "bare-ratio-with-number", zh: "kg/t；批号17", en: "Weight; batch 17", accept: false },
  { id: "declared-ratio-keep", zh: "单位为kg/t", en: "Measurement unit: kg per ton", accept: true },
] as const;

for (const [index, input] of completeNotationCases.entries()) {
  test(`T118 complete notation ${input.id}`, async () => {
    const candidate = { id: "notation", kind: "packaging" as const, value: { zh: input.zh, en: input.en } };
    const source = `包装：${input.zh}。`;
    const siteId = `complete-notation-${index}`;
    const initial = await createSite(siteId);
    const seed = { id: "notation", kind: "packaging" as const, value: { zh: "17 kg", en: "17 kg" } };
    const seedPayload = { op: "replace_commercial_terms" as const, terms: [seed] };
    const seedChecked = validateAIOperations("包装：17 kg。", [seedPayload], templates, initial.draft);
    assert.deepEqual(seedChecked.operations, [seedPayload]);
    const seeded = await commitOperations({ siteId, baseRevision: initial.draft.revision, operations: seedChecked.operations, summary: "Source seed", source: "ai" });
    assert.equal(seeded.status, "applied");
    const before = (await getExistingSite(siteId))!;
    const replace = { op: "replace_commercial_terms" as const, terms: [candidate] };
    const parsed = aiIntentResponseSchema.parse({ type: "edit", summary: "Complete notation", operations: [replace] });
    if (parsed.type !== "edit") throw new Error("Expected edit");
    const checked = validateAIOperations(source, parsed.operations, templates, before.draft);
    const file = path.join(isolatedRoot, ".sitecraft-data", "sites", `${siteId}.json`);
    const beforeBytes = await readFile(file, "utf8");
    const committed = await commitOperations({ siteId, baseRevision: before.draft.revision, operations: checked.operations, summary: "Complete notation", source: "ai" });
    const after = (await getExistingSite(siteId))!;
    const afterBytes = await readFile(file, "utf8");
    const undo = committed.status === "applied" ? await moveHistory(siteId, "undo") : null;
    const undone = await getExistingSite(siteId);
    if (evidenceRoot) await writeFile(path.join(evidenceRoot, `complete-notation-${input.id}.json`), JSON.stringify({ input, source, seed: { source: "包装：17 kg。", replace: seedPayload }, candidate: { source, replace }, field: "commercial", parsed, checked, before, committed, after, beforeBytes, afterBytes, undo, undone }, null, 2), { encoding: "utf8", flag: "wx" });
    assert.deepEqual(checked.operations, input.accept ? parsed.operations : [], "a full numeral/ratio cannot be proven by separately scanned remnants");
    assert.equal(committed.status, input.accept ? "applied" : "no_change");
    if (input.accept) {
      assert.deepEqual(after.draft.content.commercialTerms, [candidate]);
      assert.equal(undo?.status, "applied");
      assert.deepEqual(undone?.draft.content, before.draft.content);
      assert.equal(undone?.draft.englishReady, before.draft.englishReady);
    } else {
      assert.ok(checked.rejected.length);
      assert.equal(afterBytes, beforeBytes);
      assert.deepEqual(after.history, before.history);
      assert.deepEqual(after.draft, before.draft);
    }
  });
}

// Field ownership and complete-code boundaries are independent literal facts.
// A code cannot donate its digits to a classifier or eat a later quantity.
const codeFieldBoundaryCases = [
  { id: "code-fields-swap", field: "name", zh: "AX73 测量机", en: "Measuring machine BX19", spec: { zh: "BX19", en: "AX73" }, accept: false },
  { id: "code-fields-keep", field: "name", zh: "AX73 测量机", en: "Measuring machine AX73", spec: { zh: "BX19", en: "BX19" }, accept: true },
  { id: "scalar-fields-swap", field: "name", zh: "73 测量机", en: "Measuring machine 19", spec: { zh: "精度 19", en: "Precision 73" }, accept: false },
  { id: "scalar-fields-keep", field: "name", zh: "73 测量机", en: "Measuring machine 73", spec: { zh: "精度 19", en: "Precision 19" }, accept: true },
  { id: "code-before-classifier", field: "name", zh: "AX73B19 测量机", en: "AX73B19 measuring machine", accept: true },
  { id: "code-before-short-classifier", field: "name", zh: "AX73B19 测量机", en: "AX73B19 machine", accept: true },
  { id: "code-after-classifier", field: "name", zh: "AX73B19 测量机", en: "Measuring machine AX73B19", accept: true },
  { id: "code-digits-borrowed", field: "name", zh: "AX73B19 测量机", en: "AX73B19 19 machines", accept: false },
  { id: "code-real-measurement-kept", field: "name", zh: "AX73B19 19 kg 测量机", en: "AX73B19 19 kg measuring machine", accept: true },
  { id: "code-real-measurement-lost", field: "name", zh: "AX73B19 19 kg 测量机", en: "AX73B19 measuring machine", accept: false },
  { id: "code-comma-quantity-kept", field: "commercial", zh: "批号 AX73-B19，73 件", en: "Batch ax73-b19, 73 pieces", accept: true },
  { id: "code-comma-quantity-changed", field: "commercial", zh: "批号 AX73-B19，73 件", en: "Batch ax73-b19, 19 pieces", accept: false },
  { id: "code-comma-quantity-lost", field: "commercial", zh: "批号 AX73-B19，73 件", en: "Batch ax73-b19", accept: false },
] as const;

for (const [index, input] of codeFieldBoundaryCases.entries()) {
  for (const mode of ["replace", "update"] as const) {
    test(`T118 code field boundary ${input.id} ${mode}`, async () => {
      const base = quantifiedUnitInput(input.field, input.zh, input.en, "spec" in input ? input.spec : undefined);
      // Packaging is the public source field for batch identifiers, not lead time.
      const candidate = input.field === "commercial" ? { ...base, source: `包装：${input.zh}。`, replace: { op: "replace_commercial_terms", terms: [{ id: "quant-unit", kind: "packaging", value: { zh: input.zh, en: input.en } }] }, update: { op: "update_commercial_term", termId: "quant-unit", kind: "packaging", value: { zh: input.zh, en: input.en } } } : base;
      const seed = input.field === "commercial" ? { source: "包装：11 件。", replace: { op: "replace_commercial_terms", terms: [{ id: "quant-unit", kind: "packaging", value: { zh: "11 件", en: "11 pieces" } }] } } : quantifiedUnitInput("name", "恒温试验机", "Temperature test machine");
      const siteId = `code-field-boundary-${index}-${mode}`;
      const initial = await createSite(siteId);
      const seedParsed = aiIntentResponseSchema.parse({ type: "edit", summary: "Source seed", operations: [seed.replace] });
      if (seedParsed.type !== "edit") throw new Error("Expected seed");
      const seedChecked = validateAIOperations(seed.source, seedParsed.operations, templates, initial.draft);
      assert.deepEqual(seedChecked.operations, seedParsed.operations);
      assert.equal((await commitOperations({ siteId, baseRevision: initial.draft.revision, operations: seedChecked.operations, summary: "Source seed", source: "ai" })).status, "applied");
      const before = (await getExistingSite(siteId))!;
      const parsed = aiIntentResponseSchema.parse({ type: "edit", summary: "Code field boundary", operations: [candidate[mode]] });
      if (parsed.type !== "edit") throw new Error("Expected candidate");
      const checked = validateAIOperations(candidate.source, parsed.operations, templates, before.draft);
      const file = path.join(isolatedRoot, ".sitecraft-data", "sites", `${siteId}.json`);
      const beforeBytes = await readFile(file, "utf8");
      const committed = await commitOperations({ siteId, baseRevision: before.draft.revision, operations: checked.operations, summary: "Code field boundary", source: "ai" });
      const after = (await getExistingSite(siteId))!;
      const afterBytes = await readFile(file, "utf8");
      const undo = committed.status === "applied" ? await moveHistory(siteId, "undo") : null;
      const undone = await getExistingSite(siteId);
      if (evidenceRoot) await writeFile(path.join(evidenceRoot, `code-field-boundary-${input.id}-${mode}.json`), JSON.stringify({ input, mode, seed, candidate, parsed, checked, before, committed, after, beforeBytes, afterBytes, undo, undone }, null, 2), { encoding: "utf8", flag: "wx" });
      assert.deepEqual(checked.operations, input.accept ? parsed.operations : [], "each field owns its complete number/code; later independent quantities survive");
      assert.equal(committed.status, input.accept ? "applied" : "no_change");
      if (input.accept) {
        const expected = aiIntentResponseSchema.parse({ type: "edit", summary: "Literal expected content", operations: [candidate.replace] });
        if (expected.type !== "edit") throw new Error("Expected replacement");
        const op = expected.operations[0];
        if (op.op === "replace_equipment") assert.deepEqual(after.draft.content.equipment, op.equipment);
        if (op.op === "replace_commercial_terms") assert.deepEqual(after.draft.content.commercialTerms, op.terms);
        assert.equal(after.draft.revision, before.draft.revision + 1);
        assert.equal(after.history.length, before.history.length + 1);
        assert.equal(undo?.status, "applied");
        assert.deepEqual(undone?.draft.content, before.draft.content);
        assert.equal(undone?.draft.englishReady, before.draft.englishReady);
        assert.deepEqual(undone?.history, before.history);
      } else {
        assert.ok(checked.rejected.length);
        assert.equal(afterBytes, beforeBytes);
        assert.deepEqual(after.draft, before.draft);
        assert.deepEqual(after.history, before.history);
      }
    });
  }
}

// Source extraction may select prose, but it must not cut a mechanical token.
// These literal source/field pairs are independent of production token outputs.
const sourceBoundaryCases = [
  { id: "spec-number-cut", field: "spec", source: "检测设备：测量机（117 kg）。", zh: "17 kg", en: "17 kg", accept: false },
  { id: "spec-number-full", field: "spec", source: "检测设备：测量机（117 kg）。", zh: "117 kg", en: "117 kg", accept: true },
  { id: "spec-code-cut", field: "spec", source: "检测设备：测量机（AX-731B）。", zh: "AX-731", en: "AX-731", accept: false },
  { id: "spec-code-full", field: "spec", source: "检测设备：测量机（AX-731B）。", zh: "AX-731B", en: "AX-731B", accept: true },
  { id: "name-code-cut", field: "name", source: "检测设备：AX-731B 检测机。", zh: "AX-731", en: "AX-731", accept: false },
  { id: "name-code-full", field: "name", source: "检测设备：AX-731B 检测机。", zh: "AX-731B", en: "AX-731B", accept: true },
  { id: "body-number-cut", field: "body", source: "质检流程：抽检 117 kg。", zh: "17 kg", en: "17 kg", accept: false },
  { id: "body-number-full", field: "body", source: "质检流程：抽检 117 kg。", zh: "117 kg", en: "117 kg", accept: true },
  { id: "title-code-cut", field: "title", source: "质检流程：检查 AX-731B。", zh: "检查 AX-731", en: "Inspect AX-731", accept: false },
  { id: "title-code-full", field: "title", source: "质检流程：检查 AX-731B。", zh: "检查 AX-731B", en: "Inspect AX-731B", accept: true },
  { id: "event-code-cut", field: "event", source: "沿革：2023 年 安装 AX-731B。", zh: "安装 AX-731", en: "Installed AX-731", accept: false },
  { id: "event-code-full", field: "event", source: "沿革：2023 年 安装 AX-731B。", zh: "安装 AX-731B", en: "Installed AX-731B", accept: true },
  { id: "name-prose-substring", field: "name", source: "检测设备：高速三坐标测量机。", zh: "三坐标测量机", en: "Coordinate measuring machine", accept: true },
  { id: "body-prose-substring", field: "body", source: "质检流程：抽检并记录结果。", zh: "记录结果", en: "Record results", accept: true },
  { id: "event-prose-substring", field: "event", source: "沿革：2023 年 建成精密测量室并投入使用。", zh: "建成精密测量室", en: "Completed precision metrology room", accept: true },
  { id: "later-number-match", field: "spec", source: "检测设备：测量机（117 kg，17 kg）。", zh: "17 kg", en: "17 kg", accept: true },
  { id: "later-code-match", field: "name", source: "检测设备：AX-731B 与 AX-731 检测机。", zh: "AX-731", en: "AX-731", accept: true },
  { id: "range-end-cut", field: "spec", source: "检测设备：测量机（117–219 kg）。", zh: "219 kg", en: "219 kg", accept: false },
  { id: "range-full", field: "spec", source: "检测设备：测量机（117–219 kg）。", zh: "117–219 kg", en: "117-219 kg", accept: true },
  { id: "decimal-tail-cut", field: "spec", source: "检测设备：测量机（1.17 kg）。", zh: "17 kg", en: "17 kg", accept: false },
  { id: "slash-code-cut", field: "spec", source: "检测设备：测量机（AX-731/B19）。", zh: "AX-731", en: "AX-731", accept: false },
  { id: "name-quantity-from-cut-hit", field: "name", source: "检测设备：117 kg 测量机 7 台，17 kg 测量机。", zh: "17 kg 测量机", en: "17 kg measuring machine", quantity: 7, accept: false },
  { id: "name-quantity-from-whole-hit", field: "name", source: "检测设备：117 kg 测量机 7 台，17 kg 测量机 7 台。", zh: "17 kg 测量机", en: "17 kg measuring machine", quantity: 7, accept: true },
] as const;

function sourceBoundaryInput(field: string, zh: string, en: string, quantity: number | null = null) {
  const value = { zh, en };
  if (field === "name" || field === "spec") {
    const item = { id: "source-boundary", name: field === "name" ? value : { zh: "测量机", en: "Measuring machine" }, quantity, spec: field === "spec" ? value : null };
    return { source: `检测设备：${item.name.zh}${quantity === null ? "" : ` ${quantity} 台`}${item.spec ? `（${item.spec.zh}）` : ""}。`, replace: { op: "replace_equipment", equipment: [item] }, update: { op: "update_equipment", equipmentId: item.id, name: item.name, quantity, spec: item.spec } };
  }
  if (field === "title" || field === "body") {
    const item = { id: "source-boundary", title: field === "title" ? value : { zh: "抽检", en: "Inspection" }, body: field === "body" ? value : null };
    return { source: `质检流程：${item.title.zh}${item.body ? `（${item.body.zh}）` : ""}。`, replace: { op: "replace_quality_process", steps: [item] }, update: { op: "update_quality_process", stepId: item.id, title: item.title, body: item.body } };
  }
  const item = { id: "source-boundary", year: 2023, event: value };
  return { source: `沿革：2023 年 ${zh}。`, replace: { op: "replace_history", history: [item] }, update: { op: "update_history", itemId: item.id, year: item.year, event: value } };
}

for (const [index, input] of sourceBoundaryCases.entries()) {
  for (const mode of ["replace", "update"] as const) {
    test(`T118 source token boundary ${input.id} ${mode}`, async () => {
      const seedText = { name: ["原测量机", "Original measuring machine"], spec: ["11 kg", "11 kg"], title: ["来料检查", "Incoming inspection"], body: ["11 kg", "11 kg"], event: ["新增 11 台", "Added 11 machines"] }[input.field];
      const seed = sourceBoundaryInput(input.field, seedText[0], seedText[1]);
      const candidate = { ...sourceBoundaryInput(input.field, input.zh, input.en, "quantity" in input ? input.quantity : null), source: input.source };
      const siteId = `source-token-boundary-${index}-${mode}`;
      const initial = await createSite(siteId);
      const seedParsed = aiIntentResponseSchema.parse({ type: "edit", summary: "Source seed", operations: [seed.replace] });
      if (seedParsed.type !== "edit") throw new Error("Expected seed");
      const seedChecked = validateAIOperations(seed.source, seedParsed.operations, templates, initial.draft);
      assert.deepEqual(seedChecked.operations, seedParsed.operations);
      assert.equal((await commitOperations({ siteId, baseRevision: initial.draft.revision, operations: seedChecked.operations, summary: "Source seed", source: "ai" })).status, "applied");
      const before = (await getExistingSite(siteId))!;
      const parsed = aiIntentResponseSchema.parse({ type: "edit", summary: "Source token boundary", operations: [candidate[mode]] });
      if (parsed.type !== "edit") throw new Error("Expected candidate");
      const checked = validateAIOperations(candidate.source, parsed.operations, templates, before.draft);
      const file = path.join(isolatedRoot, ".sitecraft-data", "sites", `${siteId}.json`);
      const beforeBytes = await readFile(file, "utf8");
      const committed = await commitOperations({ siteId, baseRevision: before.draft.revision, operations: checked.operations, summary: "Source token boundary", source: "ai" });
      const after = (await getExistingSite(siteId))!;
      const afterBytes = await readFile(file, "utf8");
      const undo = committed.status === "applied" ? await moveHistory(siteId, "undo") : null;
      const undone = await getExistingSite(siteId);
      if (evidenceRoot) await writeFile(path.join(evidenceRoot, `source-token-boundary-${input.id}-${mode}.json`), JSON.stringify({ input, mode, seed, candidate, parsed, checked, before, committed, after, beforeBytes, afterBytes, undo, undone }, null, 2), { encoding: "utf8", flag: "wx" });
      assert.deepEqual(checked.operations, input.accept ? parsed.operations : [], "source spans must retain whole mechanical tokens while allowing prose extraction");
      assert.equal(committed.status, input.accept ? "applied" : "no_change");
      if (input.accept) {
        const expected = aiIntentResponseSchema.parse({ type: "edit", summary: "Literal expected content", operations: [candidate.replace] });
        if (expected.type !== "edit") throw new Error("Expected replacement");
        const op = expected.operations[0];
        if (op.op === "replace_equipment") assert.deepEqual(after.draft.content.equipment, op.equipment);
        if (op.op === "replace_quality_process") assert.deepEqual(after.draft.content.qualityProcess, op.steps);
        if (op.op === "replace_history") assert.deepEqual(after.draft.content.history, op.history);
        assert.equal(after.draft.revision, before.draft.revision + 1);
        assert.equal(after.history.length, before.history.length + 1);
        assert.equal(undo?.status, "applied");
        assert.deepEqual(undone?.draft.content, before.draft.content);
        assert.equal(undone?.draft.englishReady, before.draft.englishReady);
        assert.deepEqual(undone?.history, before.history);
      } else {
        assert.ok(checked.rejected.length);
        assert.equal(afterBytes, beforeBytes);
        assert.deepEqual(after.draft, before.draft);
        assert.deepEqual(after.history, before.history);
      }
    });
  }
}

// Oracle: current user contract and spec 128–129, not a unit extractor's output.
// Failure modes: unquantified units lost/added/swapped; code-internal hyphens
// mistaken for signs; incomplete code identity accepted; signed/marked quantities
// truncated; rejected values persisted; accepted source facts not undoable.
const retentionCases = [
  { id: "drop-kg", kind: "capacity", zh: "计量单位为kg，按需安排", en: "Output scheduled to order", accept: false },
  { id: "add-kg", kind: "capacity", zh: "按需安排", en: "Flexible kg output", accept: false },
  { id: "swap-kg-ton", kind: "capacity", zh: "计量单位为kg，按需安排", en: "Flexible ton output", accept: false },
  { id: "keep-kg", kind: "capacity", zh: "计量单位为kg，按需安排", en: "Flexible kg output", accept: true },
  { id: "keep-absent", kind: "capacity", zh: "按需安排", en: "Output scheduled to order", accept: true },
  { id: "R-17", kind: "packaging", zh: "采用R-17", en: "Use R-17", accept: true },
  { id: "ISO-9001", kind: "packaging", zh: "采用ISO-9001", en: "Use ISO-9001", accept: true },
  { id: "case-code", kind: "packaging", zh: "采用ISO-9001", en: "Use iso-9001", accept: true },
  { id: "changed-code", kind: "packaging", zh: "采用R-17", en: "Use S-17", accept: false },
  { id: "dropped-code-prefix", kind: "packaging", zh: "采用R-17", en: "Use 17", accept: false },
  { id: "changed-code-hyphen", kind: "packaging", zh: "采用R-17", en: "Use R17", accept: false },
  { id: "unsigned", kind: "moq", zh: "731件", en: "731 pieces", accept: true },
  { id: "range", kind: "moq", zh: "731–900件", en: "731-900 pieces", accept: true },
  { id: "exact-large", kind: "moq", zh: "9007199254740993件", en: "9,007,199,254,740,993 pieces", accept: true },
  { id: "percent", kind: "payment", zh: "30%订金，70%尾款", en: "30% deposit; 70% balance", accept: true },
  { id: "suffix-code", kind: "packaging", zh: "采用17-A", en: "Use 17-A", accept: true },
  { id: "payment-code", kind: "payment", zh: "采用T/T", en: "Use T/T", accept: true },
] as const;
const retentionLabels = { capacity: "产能", packaging: "包装", moq: "MOQ", payment: "付款" };

// Current contract: a clear unit declaration is not an absence of units. These
// literal identities and outcomes come from the source facts, not helper output.
// Unknown declarations must fail even alongside another correctly mapped unit.
const declaredUnitPairs = [
  ["万件", "ten thousand pieces"], ["件", "pieces"], ["天", "days"],
  ["小时", "hours"], ["周", "weeks"], ["月", "months"], ["年", "years"],
  ["台", "machines"], ["套", "sets"], ["吨", "tons"], ["千克", "kg"],
] as const;
const declarationRetentionCases = [
  ...declaredUnitPairs.flatMap(([unit, english]) =>
    [`单位为${unit}`, `以${unit}为单位`].flatMap((zh, form) => [
      { id: `declaration-${unit}-${form}-keep`, source: `产能：${zh}。`, zh, en: `Capacity in ${english}`, accept: true },
      { id: `declaration-${unit}-${form}-drop`, source: `产能：${zh}。`, zh, en: "Capacity arranged to order", accept: false },
    ])),
  ...(["件", "套", "台"] as const).map((unit) => ({ id: `declaration-${unit}-replace`, source: `产能：以${unit}为单位。`, zh: `以${unit}为单位`, en: "Capacity in kg", accept: false })),
  { id: "declaration-add", source: "产能：按需安排。", zh: "按需安排", en: "Measurement unit: pieces", accept: false },
  { id: "declaration-en-keep", source: "产能：单位为台。", zh: "单位为台", en: "Measurement unit: machines", accept: true },
  { id: "declaration-unknown-prefix", source: "产能：单位为箱。", zh: "单位为箱", en: "Capacity arranged to order", accept: false },
  { id: "declaration-unknown-suffix", source: "产能：以箱为单位。", zh: "以箱为单位", en: "Capacity arranged to order", accept: false },
  { id: "declaration-unresolved", source: "产能：计量单位另议。", zh: "计量单位另议", en: "Capacity arranged to order", accept: false },
  { id: "declaration-unknown-with-known", source: "产能：单位为箱，按件安排。", zh: "单位为箱，按件安排", en: "Capacity per piece", accept: false },
  { id: "declaration-unknown-en", source: "产能：单位为台。", zh: "单位为台", en: "Measurement unit: crate", accept: false },
  { id: "declaration-unknown-en-with-known", source: "产能：单位为台。", zh: "单位为台", en: "Measurement unit: crate; Available machines", accept: false },
  { id: "declaration-source-only", source: "产能：单位为箱。", zh: "单 位为箱", en: "Capacity arranged to order", accept: false },
  { id: "declaration-candidate-only", source: "产能：单 位为箱。", zh: "单位为箱", en: "Capacity arranged to order", accept: false },
  { id: "declaration-nonunit-file", source: "产能：文件检查。", zh: "文件检查", en: "File inspection", accept: true },
  { id: "declaration-nonunit-ledger", source: "产能：台账检查。", zh: "台账检查", en: "Ledger inspection", accept: true },
  { id: "declaration-nonunit-tube", source: "产能：套管检查。", zh: "套管检查", en: "Tube inspection", accept: true },
];

// Independent oracle: the explicit statement declares kg per piece, not an
// unordered bag of kg and pieces. Unknown statement tails cannot be discarded.
const completeDeclarationCases = [
  { id: "statement-plain", source: "产能：计量单位为kg。", zh: "计量单位为kg", en: "Output in kg", accept: true },
  { id: "statement-ratio", source: "产能：计量单位为kg/件。", zh: "计量单位为kg/件", en: "Output in kg per piece", accept: true },
  { id: "statement-ratio-explicit", source: "产能：以kg/件为单位。", zh: "以kg/件为单位", en: "Measurement unit: kg per piece", accept: true },
  { id: "statement-ratio-suffix", source: "产能：以kg/件为单位。", zh: "以kg/件为单位", en: "kg per piece as units", accept: true },
  { id: "statement-ratio-drop", source: "产能：计量单位为kg/件。", zh: "计量单位为kg/件", en: "Output in kg", accept: false },
  { id: "statement-ratio-reverse", source: "产能：计量单位为kg/件。", zh: "计量单位为kg/件", en: "Measurement unit: pieces per kg", accept: false },
  { id: "statement-ratio-bag", source: "产能：计量单位为kg/件。", zh: "计量单位为kg/件", en: "Output in kg; pieces", accept: false },
  { id: "statement-ratio-flat", source: "产能：计量单位为kg/件。", zh: "计量单位为kg/件", en: "Measurement unit: kg and pieces", accept: false },
  { id: "statement-in-prefix-unit-add", source: "产能：计量单位为kg。", zh: "计量单位为kg", en: "Pieces output in kg", accept: false },
  { id: "statement-in-prefix-unit-keep", source: "产能：计量单位为kg；按件安排。", zh: "计量单位为kg；按件安排", en: "Pieces output in kg", accept: true },
  ...["kg/箱", "箱/kg", "kg/箱/件", "kg 箱", "kg/件 箱", "kg/件/件", "kg+件"].map((expression, i) => ({
    id: `statement-unknown-zh-${i}`, source: `产能：计量单位为${expression}。`, zh: `计量单位为${expression}`, en: "Output in kg", accept: false,
  })),
  ...["kg/crate", "crate/kg", "kg/crate/piece", "kg crate", "kg per piece crate", "kg/piece/piece", "kg+piece"].map((expression, i) => ({
    id: `statement-unknown-en-${i}`, source: "产能：计量单位为kg。", zh: "计量单位为kg", en: `Measurement unit: ${expression}`, accept: false,
  })),
  { id: "statement-unknown-zh-suffix", source: "产能：以箱/kg为单位。", zh: "以箱/kg为单位", en: "Output in kg", accept: false },
  { id: "statement-unknown-en-suffix", source: "产能：以kg为单位。", zh: "以kg为单位", en: "crate/kg as units", accept: false },
  { id: "statement-source-boundary", source: "产能：计量单位为kg/箱。", zh: "计量单 位为kg/箱", en: "Output in kg", accept: false },
  { id: "statement-candidate-boundary", source: "产能：计量单 位为kg/箱。", zh: "计量单位为kg/箱", en: "Output in kg", accept: false },
  { id: "statement-known-neighbor", source: "产能：计量单位为kg/箱；按件安排。", zh: "计量单位为kg/箱；按件安排", en: "Output in kg; per piece", accept: false },
  { id: "statement-en-known-neighbor", source: "产能：计量单位为kg/件。", zh: "计量单位为kg/件", en: "Measurement unit: kg/crate; per piece", accept: false },
];

// Public unit identities do not disappear when a Latin token is in value.zh.
// These literal aliases and expected outcomes are independent of the helper.
const fieldUnitCases = [
  ...([ ["annual", "year"], ["annually", "year"], ["yearly", "year"], ["monthly", "month"],
    ["weekly", "week"], ["daily", "day"], ["hourly", "hour"] ] as const).flatMap(([word, period]) => [
    { id: `field-unit-cycle-${word}-keep`, source: `产能：${word} 按订单安排`, zh: `${word} 按订单安排`, en: `Scheduled to order per ${period}`, accept: true },
    { id: `field-unit-cycle-${word}-drop`, source: `产能：${word} 按订单安排`, zh: `${word} 按订单安排`, en: "Scheduled to order", accept: false },
  ]),
  ...([ ["pc", "Pieces"], ["pcs", "Pieces"], ["parts", "Parts"], ["days", "Days"],
    ["hours", "Hours"], ["hr", "Hours"], ["h", "Hours"], ["weeks", "Weeks"],
    ["months", "Months"], ["years", "Years"], ["units", "Machines"], ["machines", "Machines"],
    ["sets", "Sets"], ["tons", "Tons"], ["t", "Tons"], ["kg", "kg"] ] as const).flatMap(([unit, english]) => [
    { id: `field-unit-${unit}-keep`, source: `产能：${unit} 按订单安排`, zh: `${unit} 按订单安排`, en: `${english} scheduled to order`, accept: true },
    { id: `field-unit-${unit}-drop`, source: `产能：${unit} 按订单安排`, zh: `${unit} 按订单安排`, en: "Scheduled to order", accept: false },
    { id: `field-unit-${unit}-replace`, source: `产能：${unit} 按订单安排`, zh: `${unit} 按订单安排`, en: `${english === "Weeks" ? "Pieces" : "Weeks"} scheduled to order`, accept: false },
    { id: `field-unit-${unit}-source-boundary`, source: `产能：${unit} 按订单安排`, zh: `${unit}按订单安排`, en: "Scheduled to order", accept: false },
    { id: `field-unit-${unit}-candidate-boundary`, source: `产能：${unit}按订单安排`, zh: `${unit} 按订单安排`, en: "Scheduled to order", accept: false },
  ]),
  { id: "field-unit-pcs-tight-keep", source: "产能：pcs按订单安排", zh: "pcs按订单安排", en: "Pieces scheduled to order", accept: true },
  { id: "field-unit-declared-keep", source: "产能：单位为pcs", zh: "单位为pcs", en: "Measurement unit: pieces", accept: true },
  { id: "field-unit-declared-drop", source: "产能：单位为pcs", zh: "单位为pcs", en: "Scheduled to order", accept: false },
  { id: "field-unit-ratio-keep", source: "产能：单位为kg/pcs", zh: "单位为kg/pcs", en: "Measurement unit: kg per piece", accept: true },
  { id: "field-unit-ratio-drop", source: "产能：单位为kg/pcs", zh: "单位为kg/pcs", en: "Output in kg", accept: false },
  { id: "field-unit-ratio-reverse", source: "产能：单位为kg/pcs", zh: "单位为kg/pcs", en: "Measurement unit: pieces per kg", accept: false },
  { id: "field-unit-english-declared-keep", source: "产能：Measurement unit: pcs", zh: "Measurement unit: pcs", en: "Measurement unit: pieces", accept: true },
  { id: "field-unit-english-declared-drop", source: "产能：Measurement unit: pcs", zh: "Measurement unit: pcs", en: "Scheduled to order", accept: false },
  { id: "field-unit-english-unknown-declaration", source: "产能：Measurement unit: kg/crate", zh: "Measurement unit: kg/crate", en: "Scheduled to order", accept: false },
  { id: "field-unit-nonunit-parts", source: "产能：partslist 按订单安排", zh: "partslist 按订单安排", en: "Scheduled to order", accept: true },
  { id: "field-unit-nonunit-day", source: "产能：daylight 按订单安排", zh: "daylight 按订单安排", en: "Scheduled to order", accept: true },
];

// Current source facts independently require pcs/day and pcs per day to carry
// the same identities. The already supported time aliases are not new units.
const rawIdentityCases = [
  ...([ ["pcs", "件"], ["sets", "套"], ["kg", "kg"], ["tons", "吨"], ["machines", "台"] ] as const).flatMap(([english, unit]) =>
    (["slash", "spaced"] as const).flatMap((spelling) => {
      const en = spelling === "slash" ? `Output ${english}/day` : `Output ${english} per day`;
      return [
        { id: `identity-${english}-${spelling}-added`, source: "产能：按天排产", zh: "按天排产", en, accept: false },
        { id: `identity-${english}-${spelling}-kept`, source: `产能：按${unit}每天排产`, zh: `按${unit}每天排产`, en, accept: true },
      ];
    })),
  ...([ ["周", "weeks"], ["星期", "weeks"], ["小时", "hours"], ["时", "hours"] ] as const).flatMap(([unit, english]) => [
    { id: `identity-${unit}-kept`, source: `产能：${unit} 按订单安排`, zh: `${unit} 按订单安排`, en: `${english} scheduled according to orders`, accept: true },
    { id: `identity-${unit}-dropped`, source: `产能：${unit} 按订单安排`, zh: `${unit} 按订单安排`, en: "Scheduled according to orders", accept: false },
    { id: `identity-${unit}-added`, source: "产能：按订单安排", zh: "按订单安排", en: `${english} scheduled according to orders`, accept: false },
    { id: `identity-${unit}-replaced`, source: `产能：${unit} 按订单安排`, zh: `${unit} 按订单安排`, en: "Pieces scheduled according to orders", accept: false },
    { id: `identity-${unit}-prefix-kept`, source: `产能：单位为${unit}`, zh: `单位为${unit}`, en: `Capacity in ${english}`, accept: true },
    { id: `identity-${unit}-suffix-kept`, source: `产能：以${unit}为单位`, zh: `以${unit}为单位`, en: `${english} as units`, accept: true },
    { id: `identity-${unit}-declaration-drop`, source: `产能：以${unit}为单位`, zh: `以${unit}为单位`, en: "Scheduled according to orders", accept: false },
    { id: `identity-${unit}-quantified`, source: `产能：731${unit}`, zh: `731${unit}`, en: `731 ${english}`, accept: true },
  ]),
  ...(["时", "星期"] as const).flatMap((unit) => [
    { id: `identity-${unit}-source-only`, source: `产能：${unit} 按订单安排`, zh: `${unit}按订单安排`, en: "Scheduled according to orders", accept: false },
    { id: `identity-${unit}-candidate-only`, source: `产能：${unit}按订单安排`, zh: `${unit} 按订单安排`, en: "Scheduled according to orders", accept: false },
  ]),
];

// Oracle: raw source unit boundaries and the current contract, before the fix.
// Whitespace that exposes a unit cannot disappear during source/candidate
// comparison. Only selected complete source clauses provide the unit facts.
const boundaryRetentionCases = [
  ...fieldUnitCases,
  ...completeDeclarationCases,
  ...rawIdentityCases,
  ...declarationRetentionCases,
  { id: "keep", source: "产能：可交付 台", zh: "可交付 台", en: "Available machines", accept: true },
  { id: "drop", source: "产能：可交付 台", zh: "可交付 台", en: "Available", accept: false },
  { id: "replace", source: "产能：可交付 台", zh: "可交付 台", en: "Available pieces", accept: false },
  { id: "absent", source: "产能：可交付", zh: "可交付", en: "Available", accept: true },
  { id: "add", source: "产能：可交付", zh: "可交付", en: "Available machines", accept: false },
  { id: "source-boundary-drop", source: "产能：可交付 台", zh: "可交付台", en: "Available", accept: false },
  { id: "source-boundary-keep", source: "产能：可交付 台", zh: "可交付台", en: "Available machines", accept: false },
  { id: "candidate-boundary-drop", source: "产能：可交付台", zh: "可交付 台", en: "Available", accept: false },
  { id: "candidate-boundary-add", source: "产能：可交付台", zh: "可交付 台", en: "Available machines", accept: false },
  { id: "equivalent-spacing", source: "产能：可交付 台", zh: "可交付\t台", en: "Available machines", accept: true },
  { id: "selected-source-clause", source: "产能：可交付 台，可交付 kg", zh: "可交付 台", en: "Available machines", accept: true },
] as const;

for (const [boundaryIndex, input] of boundaryRetentionCases.entries()) {
  test(`T118 raw unit boundary schema ${input.id}`, async () => {
    const operations = [{ op: "replace_commercial_terms" as const, terms: [term(input.zh, input.en)] }];
    const parsed = aiIntentResponseSchema.parse({ type: "edit", summary: "Raw unit boundary control", operations });
    if (parsed.type !== "edit") throw new Error("Expected edit");
    const checked = validateAIOperations(input.source, parsed.operations, templates);
    if (evidenceRoot) await writeFile(path.join(evidenceRoot, `raw-boundary-schema-${input.id}.json`), JSON.stringify({ input, parsed, checked }, null, 2), { encoding: "utf8", flag: "wx" });
    assert.deepEqual(checked.operations, input.accept ? operations : [], "raw source and candidate must preserve the same unit identity");
    if (!input.accept) {
      assert.ok(checked.rejected.length);
      assert.ok(checked.commercialTermRejections?.[0].failedChecks.includes("capacity_units"));
    }
  });

  test(`T118 raw unit boundary provider update readback undo ${input.id}`, async () => {
    process.env.DEEPSEEK_API_KEY = "sk-boundary-synthetic";
    process.env.DEEPSEEK_BASE_URL = "https://boundary.test.invalid";
    process.env.DEEPSEEK_MODEL = "boundary-synthetic";
    for (const key of ["AI_API_KEY", "AI_BASE_URL", "AI_MODEL"]) delete process.env[key];
    const siteId = `boundary-${boundaryIndex}`;
    const initial = await createSite(siteId);
    const seed = term("年产275台", "275 machines per year");
    const seedParsed = aiIntentResponseSchema.parse({ type: "edit", summary: "Source seed", operations: [{ op: "replace_commercial_terms", terms: [seed] }] });
    if (seedParsed.type !== "edit") throw new Error("Expected seed edit");
    const seedChecked = validateAIOperations("产能：年产275台", seedParsed.operations, templates, initial.draft);
    const seedCommit = await commitOperations({ siteId, baseRevision: initial.draft.revision, operations: seedChecked.operations, summary: "Source seed", source: "ai" });
    assert.equal(seedCommit.status, "applied");
    const before = (await getExistingSite(siteId))!;
    const recordFile = path.join(isolatedRoot, ".sitecraft-data", "sites", `${siteId}.json`);
    const beforeBytes = await readFile(recordFile, "utf8");
    const candidate = term(input.zh, input.en);
    const payload = { type: "edit", summary: "Raw unit boundary control", operations: [{ op: "update_commercial_term", termId: "capacity", value: candidate.value }] };
    const oldFetch = globalThis.fetch;
    const oldWarn = console.warn;
    const logs: string[] = [];
    let calls = 0;
    globalThis.fetch = async (url) => {
      assert.equal(String(url), "https://boundary.test.invalid/chat/completions");
      calls += 1;
      return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(payload) } }] }));
    };
    console.warn = (...values: unknown[]) => { logs.push(values.map(String).join(" ")); };
    let result;
    try { result = await requestStructuredOperations({ message: input.source, draft: before.draft, templateId: "screwfast" }); }
    finally { globalThis.fetch = oldFetch; console.warn = oldWarn; }
    assert.ok(result.ok && result.type === "edit");
    const committed = await commitOperations({ siteId, baseRevision: before.draft.revision, operations: result.operations, summary: "Raw unit boundary control", source: "ai" });
    const saved = (await getExistingSite(siteId))!;
    const afterBytes = await readFile(recordFile, "utf8");
    const undo = committed.status === "applied" ? await moveHistory(siteId, "undo") : null;
    const afterUndo = await getExistingSite(siteId);
    if (evidenceRoot) await writeFile(path.join(evidenceRoot, `raw-boundary-provider-${input.id}.json`), JSON.stringify({ input, payload, seedParsed, seedChecked, seedCommit, before, beforeBytes, calls, logs, result, committed, saved, afterBytes, undo, afterUndo }, null, 2), { encoding: "utf8", flag: "wx" });
    assert.equal(calls, 1);
    assert.equal(committed.status, input.accept ? "applied" : "no_change");
    assert.deepEqual(saved.draft.content.commercialTerms, [input.accept ? candidate : seed]);
    if (input.accept) {
      assert.ok(committed.status === "applied" && committed.changeSet.appliedTargets.includes("commercialTerms.items.capacity.value.en"));
      assert.equal(undo?.status, "applied");
      assert.deepEqual(afterUndo?.draft.content.commercialTerms, [seed]);
    } else {
      assert.equal(afterBytes, beforeBytes);
      assert.deepEqual(saved.draft, before.draft);
      assert.deepEqual(result.operations, []);
      assert.ok(result.rejected.length);
      const audit = JSON.parse(logs[0].slice(logs[0].indexOf("{")));
      assert.deepEqual(audit.rejections[0].term, candidate);
      assert.ok(audit.rejections[0].failedChecks.includes("capacity_units"));
    }
  });
}

for (const input of retentionCases) {
  test(`T118 retention schema ${input.id}`, async () => {
    const source = `${retentionLabels[input.kind]}：${input.zh}`;
    const operations = [{ op: "replace_commercial_terms" as const, terms: [{ id: "retention", kind: input.kind, value: { zh: input.zh, en: input.en } }] }];
    const parsed = aiIntentResponseSchema.parse({ type: "edit", summary: "Source identity control", operations });
    assert.equal(parsed.type, "edit");
    if (parsed.type !== "edit") throw new Error("Expected edit");
    const checked = validateAIOperations(source, parsed.operations, templates);
    if (evidenceRoot) await writeFile(path.join(evidenceRoot, `retention-schema-${input.id}.json`), JSON.stringify({ input, source, parsed, checked }, null, 2), { encoding: "utf8", flag: "wx" });
    assert.deepEqual(checked.operations, input.accept ? operations : [], "retain only source-backed unit/code identities");
    if (!input.accept) assert.ok(checked.rejected.length, "refusal needs an explicit reason");
  });
}

// All finite aliases are literal contract inputs, independent of production maps.
const retentionUnits = [
  ["件", ["pc", "pcs", "piece", "pieces", "part", "parts"]],
  ["天", ["day", "days"]], ["小时", ["hour", "hours", "hr", "hrs", "h"]],
  ["周", ["week", "weeks"]], ["月", ["month", "months"]], ["年", ["year", "years"]],
  ["台", ["unit", "units", "machine", "machines", "set", "sets"]],
  ["套", ["set", "sets"]], ["t", ["t", "ton", "tons"]], ["kg", ["kg"]],
] as const;
for (const [unit, aliases] of retentionUnits) {
  for (const alias of aliases) {
    for (const direction of ["keep", "drop", "add"] as const) {
      test(`T118 retention unquantified ${unit} ${alias} ${direction}`, async () => {
        const zh = direction === "add" ? "按需安排" : `计量单位为${unit}，按需安排`;
        const en = direction === "drop" ? "Output scheduled to order" : `Flexible ${alias} output`;
        const source = `产能：${zh}`;
        const operations = [{ op: "replace_commercial_terms" as const, terms: [term(zh, en)] }];
        const parsed = aiIntentResponseSchema.parse({ type: "edit", summary: "Finite unquantified unit identity", operations });
        if (parsed.type !== "edit") throw new Error("Expected edit");
        const checked = validateAIOperations(source, parsed.operations, templates);
        if (evidenceRoot) await writeFile(path.join(evidenceRoot, `retention-unit-${unit}-${alias}-${direction}.json`), JSON.stringify({ source, operations, expectedAccept: direction === "keep", checked }, null, 2), { encoding: "utf8", flag: "wx" });
        assert.deepEqual(checked.operations, direction === "keep" ? operations : []);
        if (direction !== "keep") assert.ok(checked.rejected.length);
      });
    }
  }
}

for (const [symbolId, symbol] of [["minus", "-"], ["plus", "+"], ["unicode-minus", "−"], ["dash", "—"], ["unknown", "@"], ["mark", "\u0338"], ["mark-after-sign", "+ \u034f "]] as const) {
  for (const direction of ["source", "candidate"] as const) {
    test(`T118 retention unsigned numeric ${symbolId} ${direction}`, async () => {
      const zh = direction === "source" ? `${symbol}731件` : "731件";
      const en = direction === "candidate" ? `${symbol}731 pieces` : "731 pieces";
      const source = `MOQ：${zh}`;
      const parsed = aiIntentResponseSchema.parse({ type: "edit", summary: "Unsigned complete quantity", operations: [{ op: "replace_commercial_terms", terms: [{ id: "unsigned", kind: "moq", value: { zh, en } }] }] });
      if (parsed.type !== "edit") throw new Error("Expected edit");
      const checked = validateAIOperations(source, parsed.operations, templates);
      if (evidenceRoot) await writeFile(path.join(evidenceRoot, `retention-unsigned-${symbolId}-${direction}.json`), JSON.stringify({ source, parsed, checked, expectedAccept: false }, null, 2), { encoding: "utf8", flag: "wx" });
      assert.deepEqual(checked.operations, []);
      assert.ok(checked.rejected.length);
    });
  }
}

for (const input of retentionCases.slice(0, 8)) {
  test(`T118 retention provider commit readback undo ${input.id}`, async () => {
    process.env.DEEPSEEK_API_KEY = "sk-retention-synthetic";
    process.env.DEEPSEEK_BASE_URL = "https://retention.test.invalid";
    process.env.DEEPSEEK_MODEL = "retention-synthetic";
    for (const key of ["AI_API_KEY", "AI_BASE_URL", "AI_MODEL"]) delete process.env[key];
    const siteId = `retention-${input.id}`;
    const before = await createSite(siteId);
    const recordFile = path.join(isolatedRoot, ".sitecraft-data", "sites", `${siteId}.json`);
    const beforeBytes = await readFile(recordFile, "utf8");
    const candidate = { id: "retention", kind: input.kind, value: { zh: input.zh, en: input.en } };
    const source = `${retentionLabels[input.kind]}：${input.zh}`;
    const payload = { type: "edit", summary: "Source identity control", operations: [{ op: "replace_commercial_terms", terms: [candidate] }] };
    const oldFetch = globalThis.fetch;
    const oldWarn = console.warn;
    const logs: string[] = [];
    let calls = 0;
    globalThis.fetch = async (url) => {
      assert.equal(String(url), "https://retention.test.invalid/chat/completions");
      calls += 1;
      return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(payload) } }] }));
    };
    console.warn = (...values: unknown[]) => { logs.push(values.map(String).join(" ")); };
    let result;
    try { result = await requestStructuredOperations({ message: source, draft: before.draft, templateId: "screwfast" }); }
    finally { globalThis.fetch = oldFetch; console.warn = oldWarn; }
    assert.ok(result.ok && result.type === "edit");
    const committed = await commitOperations({ siteId, baseRevision: before.draft.revision, operations: result.operations, summary: "Source identity control", source: "ai" });
    const saved = (await getExistingSite(siteId))!;
    const afterBytes = await readFile(recordFile, "utf8");
    const undo = committed.status === "applied" ? await moveHistory(siteId, "undo") : null;
    const afterUndo = await getExistingSite(siteId);
    if (evidenceRoot) await writeFile(path.join(evidenceRoot, `retention-provider-${input.id}.json`), JSON.stringify({ input, source, payload, calls, logs, before, result, committed, saved, beforeBytes, afterBytes, undo, afterUndo }, null, 2), { encoding: "utf8", flag: "wx" });
    assert.equal(calls, 1);
    assert.equal(committed.status, input.accept ? "applied" : "no_change");
    assert.deepEqual(saved.draft.content.commercialTerms, input.accept ? [candidate] : []);
    if (input.accept) {
      assert.ok(committed.status === "applied" && committed.changeSet.appliedTargets.includes("commercialTerms.items.retention.value.en"));
      assert.equal(undo?.status, "applied");
      assert.deepEqual(afterUndo?.draft.content.commercialTerms, []);
    } else {
      assert.equal(afterBytes, beforeBytes, "rejection must preserve exact record bytes");
      assert.deepEqual(saved.draft, before.draft);
      assert.deepEqual(result.operations, []);
      assert.ok(result.rejected.length);
      if (input.kind === "capacity") {
        const audit = JSON.parse(logs[0].slice(logs[0].indexOf("{")));
        assert.deepEqual(audit.rejections[0].term, candidate);
        assert.ok(audit.rejections[0].failedChecks.includes("capacity_units"));
      }
    }
  });
}

// Fixed before changing 3a4af2a. The source is the oracle, including equality,
// missing dimensions and inventory. Unknown quantified syntax must be refused,
// even if its words also occur in the source (the approved finite-grammar scope).
const completeSpanCases = [
  { id: "full-real-molding", source: simulatedPacks.molding.body, zh: WITH_EQUIPMENT, en: "Annual mold capacity approximately 180 sets; 42 injection molding machines (90–800 t); monthly injection capacity approximately 6 million pieces", accept: true },
  { id: "approx-link-kept", zh: "年产约为349套", en: "Approximately 349 sets per year", accept: true },
  { id: "approx-link-lost", zh: "年产约为349套", en: "349 sets per year", accept: false },
  { id: "excluding-equality", zh: "年产至少349套", en: "At least349 sets per year (excluding equality)", accept: false },
  { id: "equality-excluded", zh: "年产至少349套", en: "At least 349 sets per year (with equality excluded)", accept: false },
  { id: "approximation-noun", zh: "年产349套", en: "An approximation of 349 sets per year", accept: false },
  { id: "circa", zh: "年产349套", en: "Circa 349 sets per year", accept: false },
  { id: "give-or-take", zh: "年产349套", en: "349 sets per year (give or take)", accept: false },
  { id: "hidden-before", zh: "年产349套", en: "Annual output (approximately) 349 sets", accept: false },
  { id: "hidden-between", zh: "年产349套", en: "349 (approximately) sets per year", accept: false },
  { id: "hidden-after", zh: "年产349套", en: "349 sets per year (approximately)", accept: false },
  { id: "hidden-clause", zh: "年产349套", en: "349 sets per year; an approximation", accept: false },
  { id: "unknown-prefix", zh: "年产349套", en: "Forecast output 349 sets per year", accept: false },
  { id: "unknown-unit-description", zh: "年产349套", en: "349 forecast sets per year", accept: false },
  { id: "unknown-tail", zh: "年产349套", en: "349 sets per year forecast", accept: false },
  { id: "unknown-subject", zh: "维洛里安工装年产349套", en: "Annual output of velorian tooling: 349 sets", accept: false },
  { id: "source-word-is-not-neutral", source: "产能：年产349套（forecast）。", zh: "年产349套（forecast）", en: "349 forecast sets per year", accept: false },
  { id: "unknown-zh-qualifier", zh: "年产参考349套", en: "349 sets per year", accept: false },
  { id: "unknown-nested-parenthesis", zh: "年产349套", en: "349 sets per year ((forecast))", accept: false },
  { id: "unclosed-parenthesis", zh: "年产349套", en: "349 sets per year (", accept: false },
  { id: "spec-does-not-borrow-cycle", zh: "注塑机42台（90–800t）", en: "42 injection machines (90–800 t per month)", accept: false },
  { id: "spec-is-independent", zh: "注塑机42台（90–800t）", en: "42 injection machines (90–800 t)", accept: true },
  { id: "spec-unknown-residual", zh: "注塑机42台（90–800t）", en: "42 injection machines (90–800 estimated t)", accept: false },
  { id: "spec-comma-hidden-qualifier", zh: "注塑机42台（90–800t）", en: "42 injection machines (90–800 t, approximately)", accept: false },
  { id: "spec-attachment-kept", zh: "注塑机42台（90–800t）；注塑机7台（120–650t）", en: "42 injection machines (90–800 t); 7 injection machines (120–650 t)", accept: true },
  { id: "spec-attachment-swapped", zh: "注塑机42台（90–800t）；注塑机7台（120–650t）", en: "42 injection machines (120–650 t); 7 injection machines (90–800 t)", accept: false },
  // Source parent relations are the oracle. Equal numerical values do not make
  // parents with different cycles, units or numerical qualifiers interchangeable.
  { id: "parent-cycle-kept", zh: "年产42台注塑机（90–800t）；月产42台注塑机（120–650t）", en: "42 injection machines per year (90–800 t); 42 injection machines per month (120–650 t)", accept: true },
  { id: "parent-cycle-swapped", zh: "年产42台注塑机（90–800t）；月产42台注塑机（120–650t）", en: "42 injection machines per year (120–650 t); 42 injection machines per month (90–800 t)", accept: false },
  { id: "parent-cycle-set-alias-kept", zh: "年产42台注塑机（90–800t）；月产42台注塑机（120–650t）", en: "42 sets per year (90–800 t); 42 sets per month (120–650 t)", accept: true },
  { id: "parent-cycle-set-alias-swapped", zh: "年产42台注塑机（90–800t）；月产42台注塑机（120–650t）", en: "42 sets per year (120–650 t); 42 sets per month (90–800 t)", accept: false },
  { id: "parent-null-cycle-kept", zh: "年产42台注塑机（90–800t）；注塑机42台（120–650t）", en: "42 injection machines per year (90–800 t); 42 injection machines (120–650 t)", accept: true },
  { id: "parent-null-cycle-swapped", zh: "年产42台注塑机（90–800t）；注塑机42台（120–650t）", en: "42 injection machines per year (120–650 t); 42 injection machines (90–800 t)", accept: false },
  { id: "parent-unit-kept", zh: "年产42台注塑机（90–800t）；年产42套模具（120–650t）", en: "42 injection machines per year (90–800 t); 42 sets per year (120–650 t)", accept: true },
  { id: "parent-unit-swapped", zh: "年产42台注塑机（90–800t）；年产42套模具（120–650t）", en: "42 injection machines per year (120–650 t); 42 sets per year (90–800 t)", accept: false },
  { id: "parent-unit-alias-reservation", zh: "年产42台注塑机（90–800t）；年产42套模具（90–800t）", en: "42 sets per year (90–800 t); 42 injection machines per year (90–800 t)", accept: true },
  { id: "parent-set-reverse-alias", zh: "年产42套模具（90–800t）", en: "42 injection machines per year (90–800 t)", accept: false },
  { id: "parent-approx-kept", zh: "年产约42台注塑机（90–800t）；年产42台注塑机（120–650t）", en: "About 42 injection machines per year (90–800 t); 42 injection machines per year (120–650 t)", accept: true },
  { id: "parent-approx-swapped", zh: "年产约42台注塑机（90–800t）；年产42台注塑机（120–650t）", en: "About 42 injection machines per year (120–650 t); 42 injection machines per year (90–800 t)", accept: false },
  { id: "parent-bound-kept", zh: "年产至少42台注塑机（90–800t）；年产不超过42台注塑机（120–650t）", en: "At least 42 injection machines per year (90–800 t); at most 42 injection machines per year (120–650 t)", accept: true },
  { id: "parent-bound-swapped", zh: "年产至少42台注塑机（90–800t）；年产不超过42台注塑机（120–650t）", en: "At least 42 injection machines per year (120–650 t); at most 42 injection machines per year (90–800 t)", accept: false },
  { id: "cross-amount-period", zh: "年产349套；月产521件", en: "Monthly output 349 sets; annual output 521 pieces", accept: false },
  { id: "cross-amount-bound", zh: "年产至少349套；月产不超过521件", en: "At most 349 sets per year; at least 521 pieces per month", accept: false },
  { id: "ambiguous-multi-amount", zh: "年产349套和521件", en: "349 sets and 521 pieces per year", accept: false },
  { id: "missing-unit", zh: "年产约349", en: "About 349 per year", accept: true },
  { id: "missing-cycle", zh: "约349套", en: "About 349 sets", accept: true },
  { id: "missing-both", zh: "约349", en: "About 349", accept: true },
  { id: "unquantified", zh: "按图纸安排生产", en: "Production scheduled according to drawings", accept: true },
  { id: "semantic-space", zh: "年 产 约 为 349 套", en: "About 349 sets per year", accept: true },
  { id: "complete-clauses-newline", source: "产能：年产349套；月产521件。", zh: "年产349套\n月产521件", en: "349 sets per year; 521 pieces monthly", accept: true },
  { id: "ascii-number-separator", source: "产能：年产34 9套。", zh: "年产349套", en: "349 sets per year", accept: false },
  { id: "ascii-code-separator", source: "产能：AB 349套。", zh: "AB349套", en: "349 sets", accept: false },
  { id: "range", zh: "年产349–521套", en: "349-521 sets per year", accept: true },
  { id: "decimal-and-thousands", zh: "月产约1.5万件", en: "About 15,000 pieces monthly", accept: true },
  { id: "strict-lower", zh: "月产349件以上（不含）", en: "More than 349 pieces monthly", accept: true },
  { id: "inclusive-lower", zh: "月产349件以上", en: "At least 349 pieces monthly", accept: true },
  // Independent bfe review inputs and exact decimal identities. A source prefix
  // is not a field label merely because it ends with a colon.
  { id: "upstream-source-control", source: "产能：模具年产237套。", zh: "模具年产237套", en: "Annual mold output 237 sets", accept: true },
  { id: "upstream-source-known-labels", source: "公司资料：资料：产能:模具年产237套。", zh: "模具年产237套", en: "Annual mold output 237 sets", accept: true },
  { id: "upstream-source-negation", source: "产能：未达到：模具年产237套。", zh: "模具年产237套", en: "Annual mold output 237 sets", accept: false },
  { id: "upstream-source-estimate", source: "产能：试产估计：模具年产237套。", zh: "模具年产237套", en: "Annual mold output 237 sets", accept: false },
  { id: "upstream-source-upper", source: "产能：上限：模具年产237套。", zh: "模具年产237套", en: "Annual mold output 237 sets", accept: false },
  { id: "upstream-source-subject", source: "产能：限试验用翼形支架：年产237套。", zh: "年产237套", en: "Annual output 237 sets", accept: false },
  { id: "upstream-source-interior-label", source: "产能：未达到：产能：模具年产237套。", zh: "模具年产237套", en: "Annual mold output 237 sets", accept: false },
  { id: "upstream-source-cycle-label", source: "产能：年产：237套。", zh: "237套", en: "237 sets", accept: false },
  { id: "upstream-source-boundary-year-direct", source: "年产：237套。", zh: "237套", en: "237 sets", accept: false },
  { id: "upstream-source-boundary-month-direct", source: "月产：237件。", zh: "237件", en: "237 pieces", accept: false },
  { id: "upstream-source-boundary-month-tagged", source: "产能：月产：237件。", zh: "237件", en: "237 pieces", accept: false },
  { id: "upstream-source-boundary-upper-label", source: "产能上限：年产237套。", zh: "年产237套", en: "237 sets per year", accept: false },
  { id: "upstream-source-boundary-estimate-label", source: "预计产能：年产237套。", zh: "年产237套", en: "237 sets per year", accept: false },
  { id: "upstream-source-boundary-year-kept", source: "产能：年产237套。", zh: "年产237套", en: "237 sets per year", accept: true },
  { id: "upstream-source-boundary-month-kept", source: "产能：月产237件。", zh: "月产237件", en: "237 pieces per month", accept: true },
  { id: "upstream-source-boundary-other-kind", source: "产能：MOQ：模具年产237套。", zh: "模具年产237套", en: "Annual mold output 237 sets", accept: false },
  { id: "upstream-source-boundary-answer-qualified", source: "产能：答：未达到：模具年产237套。", zh: "模具年产237套", en: "Annual mold output 237 sets", accept: false },
  { id: "upstream-source-whole-unknown", source: "产能：试产估计：模具年产237套。", zh: "试产估计：模具年产237套", en: "Annual mold output 237 sets", accept: false },
  { id: "upstream-decimal-expanded", zh: "月注塑能力约419万件", en: "Monthly injection capacity approximately 4,190,000 pieces", accept: true },
  { id: "upstream-decimal-million", zh: "月注塑能力约419万件", en: "Monthly injection capacity approximately 4.19 million pieces", accept: true },
  { id: "upstream-decimal-wrong", zh: "月注塑能力约419万件", en: "Monthly injection capacity approximately 4.18 million pieces", accept: false },
  { id: "upstream-decimal-trailing-zeros", zh: "月注塑能力约419.000万件", en: "Monthly injection capacity approximately 4.190000 million pieces", accept: true },
  { id: "upstream-decimal-range", zh: "月产约419–521万件", en: "About 4.19–5.21 million pieces monthly", accept: true },
  { id: "upstream-decimal-ascii-range", zh: "月产约419-521万件", en: "About 4.19-5.21 million pieces monthly", accept: true },
  { id: "upstream-decimal-range-wrong", zh: "月产约419–521万件", en: "About 4.19–5.22 million pieces monthly", accept: false },
  { id: "upstream-billion-equivalent", zh: "年产419亿", en: "41.9 billion per year", accept: true },
  { id: "upstream-billion-wrong", zh: "年产419亿", en: "41.900000000000000001 billion per year", accept: false },
  { id: "upstream-large-integer-kept", zh: "年产9007199254740993件", en: "9007199254740993 pieces per year", accept: true },
  { id: "upstream-large-integer-wrong", zh: "年产9007199254740993件", en: "9007199254740992 pieces per year", accept: false },
  { id: "upstream-small-decimal-kept", zh: "年产0.123456789012345678901件", en: "0.123456789012345678901 pieces per year", accept: true },
  { id: "upstream-small-decimal-wrong", zh: "年产0.123456789012345678901件", en: "0.123456789012345678902 pieces per year", accept: false },
  { id: "upstream-invalid-decimal", zh: "年产1.2.3件", en: "1.2.3 pieces per year", accept: false },
  // e106 independent source mutations: the candidate stays valid, while its
  // omitted source context changes. Unknown source context is not independent.
  { id: "e106-source-postcondition", source: "产能：月产725万件，仅限旺季。", zh: "月产725万件", en: "7.25 million pieces per month", accept: false },
  { id: "e106-source-precondition", source: "产能：仅在旺季，月产725万件。", zh: "月产725万件", en: "7.25 million pieces per month", accept: false },
  { id: "e106-source-negation", source: "产能：未达到，月产725万件。", zh: "月产725万件", en: "7.25 million pieces per month", accept: false },
  { id: "e106-source-unknown-prefix", source: "产能：旺季月产725万件。", zh: "月产725万件", en: "7.25 million pieces per month", accept: false },
  { id: "e106-source-unknown-tail", source: "产能：月产725万件，按校准条件确认。", zh: "月产725万件", en: "7.25 million pieces per month", accept: false },
  { id: "e106-source-semicolon-tail", source: "产能：月产725万件；限指定窗口。", zh: "月产725万件", en: "7.25 million pieces per month", accept: false },
  { id: "e106-source-modifier-only-tail", source: "产能：月产725万件，左右。", zh: "月产725万件", en: "7.25 million pieces per month", accept: false },
  { id: "e106-source-unknown-whole", source: "产能：月产725万件，仅限旺季。", zh: "月产725万件，仅限旺季", en: "7.25 million pieces per month", accept: false },
  { id: "e106-source-independent-subset", source: "产能：模具年产约180套；月产约725万件。", zh: "月产约725万件", en: "About 7.25 million pieces per month", accept: true },
  { id: "e106-source-independent-combination", source: "产能：年产275套,月产725件；注塑机8台（90–800t）。", zh: "年产275套；注塑机8台（90–800t）", en: "275 sets per year; 8 machines (90–800 t)", accept: true },
  { id: "e106-source-missing-dimension-subset", source: "产能：年产275；约725套。", zh: "年产275", en: "275 per year", accept: true },
  { id: "e106-month-no-label", source: "月产725万件。", zh: "月产725万件", en: "7.25 million pieces per month", accept: true },
  { id: "e106-month-answer", source: "问：产能是多少？答：月产725万件。", zh: "月产725万件", en: "7.25 million pieces per month", accept: true },
  { id: "e106-month-wrapper", source: "资料：产能：月产725万件。", zh: "月产725万件", en: "7.25 million pieces per month", accept: true },
  { id: "e106-year-no-label", source: "年产725套。", zh: "年产725套", en: "725 sets per year", accept: true },
  { id: "e106-month-period-lost", source: "月产725万件。", zh: "月产725万件", en: "7.25 million pieces", accept: false },
  { id: "e106-month-colon-period-lost", source: "月产：725万件。", zh: "725万件", en: "7.25 million pieces", accept: false },
  { id: "e106-source-invalid-token-subset", source: "产能：月产1,,728件。", zh: "728件", en: "728 pieces", accept: false },
] as const;

for (const example of completeSpanCases) {
  test(`T118 complete-span schema ${example.id}: ${example.accept ? "accept" : "refuse"}`, async () => {
    const source = "source" in example ? example.source : `产能：${example.zh}。`;
    const candidate = term(example.zh, example.en);
    const parsed = aiIntentResponseSchema.parse({ type: "edit", summary: "Independent complete-span control", operations: [{ op: "replace_commercial_terms", terms: [candidate] }] });
    assert.equal(parsed.type, "edit");
    if (parsed.type !== "edit") throw new Error("Expected an edit response");
    const checked = validateAIOperations(source, parsed.operations, templates);
    if (evidenceRoot) await writeFile(path.join(evidenceRoot, `complete-span-${example.id}.json`), JSON.stringify({ source, input: example, checked }, null, 2), "utf8");
    assert.deepEqual(checked.operations, example.accept ? [{ op: "replace_commercial_terms", terms: [candidate] }] : [], `${example.id}: ${checked.rejected.join("; ")}`);
    if (!example.accept) assert.ok(checked.rejected.length > 0);
  });
}

test("T118 complete-span diagnostic preserves raw offsets, depth and bounded residuals", async () => {
  const raw = term(" 年产349套 ", " 349 sets per year (forecast) ");
  const checked = validateAIOperations("产能：年产349套。", [{ op: "replace_commercial_terms", terms: [raw] }], templates);
  assert.deepEqual(checked.operations, []);
  const rejection = checked.commercialTermRejections?.[0];
  assert.deepEqual(rejection?.term, raw);
  type ParseEvidence = { status: string; spans: Array<{ start: number; end: number; depth: number; kind: string }>; residuals: Array<{ start: number; end: number; depth: number; text: string; reason: string }>; truncated: boolean };
  const diagnostic = rejection as typeof rejection & { parseEvidence: { zh: ParseEvidence; en: ParseEvidence } };
  assert.equal(diagnostic.parseEvidence.zh.status, "complete");
  assert.equal(diagnostic.parseEvidence.en.status, "unsupported");
  const residual = diagnostic.parseEvidence.en.residuals[0];
  assert.equal(residual.start, raw.value.en.indexOf("forecast"));
  assert.equal(residual.depth, 1);
  assert.equal(residual.text, raw.value.en.slice(residual.start, residual.end));
  assert.ok(residual.reason.length > 0);
  assert.ok(diagnostic.parseEvidence.en.spans.some((span) => span.kind === "quantity" && raw.value.en.slice(span.start, span.end) === "349"));
  assert.ok(checked.rejected.includes("英文产能中有暂不支持的表达，未写入"), "unsupported expressions must be clearly refused");

  const long = term("年产349套", `349 sets per year ${"forecast ".repeat(180)}`);
  const bounded = validateAIOperations("产能：年产349套。", [{ op: "replace_commercial_terms", terms: [long] }], templates);
  const longDiagnostic = bounded.commercialTermRejections![0] as unknown as { termTruncated: boolean; parseEvidence: { en: ParseEvidence } };
  assert.equal(longDiagnostic.termTruncated, true);
  assert.equal(longDiagnostic.parseEvidence.en.truncated, true);
  assert.ok(longDiagnostic.parseEvidence.en.spans.length <= 48);
  assert.ok(longDiagnostic.parseEvidence.en.residuals.length <= 4);
  assert.ok(longDiagnostic.parseEvidence.en.residuals.every((part) => part.text.length <= 160));
  if (evidenceRoot) await writeFile(path.join(evidenceRoot, "complete-span-diagnostic.json"), JSON.stringify({ raw, checked, bounded }, null, 2), "utf8");
});

test("T118 complete-span synthetic provider → isolated commit/readback/undo", async () => {
  process.env.DEEPSEEK_API_KEY = "sk-t118-complete-span-not-real";
  process.env.DEEPSEEK_BASE_URL = "https://t118-stub.test.invalid";
  process.env.DEEPSEEK_MODEL = "t118-stub";
  for (const key of ["AI_API_KEY", "AI_BASE_URL", "AI_MODEL"]) delete process.env[key];
  const controls = ["excluding-equality", "full-real-molding", "approx-link-lost", "approx-link-kept", "unknown-unit-description", "cross-amount-period", "missing-both", "upstream-source-control", "upstream-source-negation", "upstream-decimal-million", "upstream-large-integer-kept", "upstream-large-integer-wrong", "e106-source-postcondition", "e106-month-no-label", "e106-source-independent-subset"].map((id) => completeSpanCases.find((row) => row.id === id)!);
  const results = [];
  for (const [index, example] of controls.entries()) {
    const candidate = term(example.zh, example.en);
    const siteId = `t118-complete-provider-${index}`;
    const before = await createSite(siteId);
    const oldFetch = globalThis.fetch;
    const oldWarn = console.warn;
    const lines: string[] = [];
    let calls = 0;
    globalThis.fetch = async (input) => {
      assert.equal(String(input), "https://t118-stub.test.invalid/chat/completions");
      calls += 1;
      return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ type: "edit", summary: "private synthetic summary", operations: [{ op: "replace_commercial_terms", terms: [candidate] }] }), reasoning_content: "private synthetic reasoning" } }] }), { headers: { "x-private-test": "private header" } });
    };
    console.warn = (...args: unknown[]) => { lines.push(args.map(String).join(" ")); };
    let result;
    try {
      result = await requestStructuredOperations({ message: "source" in example ? example.source : `产能：${example.zh}。`, draft: before.draft, templateId: "screwfast" });
    } finally {
      globalThis.fetch = oldFetch;
      console.warn = oldWarn;
    }
    assert.equal(calls, 1, "no retries or real provider requests");
    assert.ok(result.ok && result.type === "edit");
    const committed = await commitOperations({ siteId, baseRevision: before.draft.revision, operations: result.operations, summary: "Complete-span synthetic control", source: "ai" });
    const saved = await getExistingSite(siteId);
    results.push({ input: example, result, lines, committed, saved });
    // Save each result before asserting, including a known-bad baseline outcome.
    if (evidenceRoot) await writeFile(path.join(evidenceRoot, `complete-provider-${example.id}.json`), JSON.stringify(results.at(-1), null, 2), "utf8");
    assert.equal(committed.status, example.accept ? "applied" : "no_change", example.id);
    assert.deepEqual(saved?.draft.content.commercialTerms, example.accept ? [candidate] : [], example.id);
    if (example.accept) {
      assert.equal(lines.length, 0);
      assert.equal((await moveHistory(siteId, "undo")).status, "applied");
      assert.deepEqual((await getExistingSite(siteId))?.draft.content.commercialTerms, []);
    } else {
      assert.equal(lines.length, 1);
      const audit = JSON.parse(lines[0].slice(lines[0].indexOf("{")));
      assert.deepEqual(audit.rejections[0].term, candidate);
      assert.ok(audit.rejections[0].parseEvidence);
      for (const secret of [process.env.DEEPSEEK_API_KEY!, "private synthetic summary", "private synthetic reasoning", "private header", "Authorization", "Bearer"]) assert.ok(!lines[0].includes(secret));
      assert.ok(lines[0].length < 16000);
      assert.ok(!JSON.stringify(result).includes(candidate.value.en));
      assert.ok(!(await readFile(path.join(isolatedRoot, ".sitecraft-data", "sites", `${siteId}.json`), "utf8")).includes(candidate.value.en));
    }
  }
});

test("T118 complete-span preserves the three materials and other five term kinds", () => {
  const controls: Array<{ source: string; terms: CommercialTerm[] }> = [
    { source: simulatedPacks.industrial.body, terms: [{ id: "industrial-moq", kind: "moq", value: { zh: "20台", en: "20 units" } }] },
    { source: simulatedPacks.export.body, terms: [{ id: "export-lead", kind: "lead_time", value: { zh: "批量询盘后确认，资料未给具体天数", en: "Confirmed after batch inquiry; no fixed number of days" } }] },
    { source: simulatedPacks.molding.body, terms: [
      term(WITH_EQUIPMENT, "About 180 molds per year; 42 injection machines (90–800 t), about 6 million parts per month"),
      { id: "molding-moq", kind: "moq", value: { zh: "注塑件 5000 件起；模具单套起接", en: "Molded parts from 5,000 pcs; molds from one set" } },
      { id: "molding-lead", kind: "lead_time", value: { zh: "模具 25–55 天；批量注塑件在模具确认后 15–20 天", en: "Molds 25–55 days; volume molded parts 15–20 days after mold approval" } },
      { id: "molding-trade", kind: "trade_terms", value: { zh: "常用 FOB 宁波和 EXW，也可按订单约定 CIF", en: "FOB Ningbo and EXW are common; CIF by agreement" } },
    ] },
    { source: "付款方式：30% T/T，70% T/T。包装：每件单独包装。", terms: [
      { id: "payment", kind: "payment", value: { zh: "30% T/T，70% T/T", en: "30% T/T, 70% T/T" } },
      { id: "packaging", kind: "packaging", value: { zh: "每件单独包装", en: "Packed separately per piece" } },
    ] },
  ];
  for (const { source, terms } of controls) {
    const operations = [{ op: "replace_commercial_terms" as const, terms }];
    assert.deepEqual(validateAIOperations(wrapCompanyMaterials(source), operations, templates).operations, operations);
  }
});

// The shared number helper's callers must preserve exact identities and refuse
// malformed decimals, including when both languages contain the same bad token.
// The expected quantity comes from the source string, without a numeric coercion.
for (const caller of ["moq", "equipment", "quality", "history"] as const) {
  for (const example of [
    { id: "large-kept", zh: "9007199254740993", en: "9007199254740993", accept: true },
    { id: "large-wrong", zh: "9007199254740993", en: "9007199254740992", accept: false },
    { id: "malformed-decimal", zh: "1.2.3", en: "1.2.3", accept: false },
  ]) {
    test(`T118 upstream shared caller ${caller} ${example.id}: ${example.accept ? "accept" : "refuse"}`, async () => {
      const { zh, en } = example;
      const inputs = {
        moq: { source: `公司资料：MOQ：${zh}件。`, operation: { op: "replace_commercial_terms", terms: [{ id: "exact-moq", kind: "moq", value: { zh: `${zh}件`, en: `${en} pieces` } }] } },
        equipment: { source: `设备：注塑机（${zh}kg）。`, operation: { op: "replace_equipment", equipment: [{ id: "exact-equipment", name: { zh: "注塑机", en: "Injection machine" }, quantity: null, spec: { zh: `${zh}kg`, en: `${en} kg` } }] } },
        quality: { source: `质检流程：抽检，检验${zh}件。`, operation: { op: "replace_quality_process", steps: [{ id: "exact-quality", title: { zh: "抽检", en: "Sampling inspection" }, body: { zh: `检验${zh}件`, en: `Inspect ${en} pieces` } }] } },
        history: { source: `沿革：2024年新增${zh}台设备。`, operation: { op: "replace_history", history: [{ id: "exact-history", year: 2024, event: { zh: `新增${zh}台设备`, en: `Added ${en} units` } }] } },
      };
      const input = inputs[caller];
      const parsed = aiIntentResponseSchema.parse({ type: "edit", summary: "Source decimal identity control", operations: [input.operation] });
      assert.equal(parsed.type, "edit");
      if (parsed.type !== "edit") throw new Error("Expected an edit response");
      const checked = validateAIOperations(input.source, parsed.operations, templates);
      if (evidenceRoot) await writeFile(path.join(evidenceRoot, `upstream-caller-${caller}-${example.id}.json`), JSON.stringify({ input, expectedAcceptance: example.accept, checked }, null, 2), "utf8");
      assert.deepEqual(checked.operations, example.accept ? [input.operation] : [], `${caller} ${example.id}: ${checked.rejected.join("; ")}`);
      if (!example.accept) assert.ok(checked.rejected.length > 0);
    });
  }
}
// Source-defined comma boundaries: a thousands separator is inside one numeric
// fact, whereas punctuation between complete business clauses may divide them.
const numericCommaSourceCases = [
  { id: "moq-full", kind: "moq", source: "MOQ：419,000台。", zh: "419,000台", en: "419000 units", accept: true },
  { id: "moq-suffix", kind: "moq", source: "MOQ：419,000台。", zh: "000台", en: "0 units", accept: false },
  { id: "moq-prefix", kind: "moq", source: "MOQ：419,000台。", zh: "419", en: "419", accept: false },
  { id: "lead-full", kind: "lead_time", source: "交期：1,000天。", zh: "1,000天", en: "1000 days", accept: true },
  { id: "lead-suffix", kind: "lead_time", source: "交期：1,000天。", zh: "000天", en: "0 days", accept: false },
  { id: "lead-prefix", kind: "lead_time", source: "交期：1,000天。", zh: "1", en: "1", accept: false },
  { id: "range-full", kind: "moq", source: "MOQ：419,000–521,000台。", zh: "419,000–521,000台", en: "419000–521000 units", accept: true },
  { id: "range-internal", kind: "moq", source: "MOQ：419,000–521,000台。", zh: "000–521,000台", en: "0–521000 units", accept: false },
  { id: "ascii-clause-comma", kind: "moq", source: "MOQ：20台,30台。", zh: "20台；30台", en: "20 units; 30 units", accept: true },
  { id: "chinese-clause-comma", kind: "moq", source: "MOQ：20台，30台。", zh: "20台；30台", en: "20 units; 30 units", accept: true },
  { id: "mixed-numeric-clause-comma", kind: "moq", source: "MOQ：419,000台,20台。", zh: "419,000台；20台", en: "419000 units; 20 units", accept: true },
  { id: "lead-business-comma", kind: "lead_time", source: "交期：模具25天,注塑件15天。", zh: "模具25天；注塑件15天", en: "Molds 25 days; molded parts 15 days", accept: true },
] as const;
for (const example of numericCommaSourceCases) {
  test(`T118 numeric comma source ${example.id}: ${example.accept ? "accept" : "refuse"}`, async () => {
    const candidate = { id: "comma-source", kind: example.kind, value: { zh: example.zh, en: example.en } };
    const parsed = aiIntentResponseSchema.parse({ type: "edit", summary: "Complete numeric source-clause control", operations: [{ op: "replace_commercial_terms", terms: [candidate] }] });
    assert.equal(parsed.type, "edit");
    if (parsed.type !== "edit") throw new Error("Expected an edit response");
    const checked = validateAIOperations(example.source, parsed.operations, templates);
    if (evidenceRoot) await writeFile(path.join(evidenceRoot, `numeric-comma-${example.id}.json`), JSON.stringify({ input: example, checked }, null, 2), "utf8");
    assert.deepEqual(checked.operations, example.accept ? [{ op: "replace_commercial_terms", terms: [candidate] }] : [], `${example.id}: ${checked.rejected.join("; ")}`);
    if (!example.accept) assert.ok(checked.rejected.length > 0);
  });
}
// The oracle validates a whole numeric spelling, not its individually valid
// substrings. The same lexical rule applies at every shared-number caller.
for (const caller of ["moq", "lead_time", "payment", "packaging", "equipment", "quality", "history", "capacity"] as const) {
  for (const example of [
    { id: "grouped", token: "1,728", accept: true },
    { id: "double-comma", token: "1,,728", accept: false },
    { id: "mixed-separator", token: "1,.728", accept: false },
    { id: "double-dot", token: "1..728", accept: false },
    { id: "broken-spaced-separator", token: "1, ,728", accept: false },
    { id: "repeated-range", token: "1--728", accept: false },
    { id: "chained-range", token: "1–728–900", accept: false },
    { id: "grouped-range", token: "1,728–2,000", accept: true },
    { id: "source-invalid-subset", token: "1,,728", accept: false },
  ]) {
    test(`T118 e106 numeric lexeme ${caller} ${example.id}: ${example.accept ? "accept" : "refuse"}`, async () => {
      const n = example.token;
      const selected = example.id === "source-invalid-subset" ? "728" : n;
      const historyZh = example.id === "source-invalid-subset" ? "新增1" : `新增${n}台设备`;
      const historyEn = example.id === "source-invalid-subset" ? "Added 1" : `Added ${n} machines`;
      const inputs = {
        moq: { source: `MOQ：${n}件。`, operation: { op: "replace_commercial_terms", terms: [{ id: "lexeme", kind: "moq", value: { zh: `${selected}件`, en: `${selected} pieces` } }] } },
        lead_time: { source: `交期：${n}天。`, operation: { op: "replace_commercial_terms", terms: [{ id: "lexeme", kind: "lead_time", value: { zh: `${selected}天`, en: `${selected} days` } }] } },
        payment: { source: `付款方式：${n}%预付。`, operation: { op: "replace_commercial_terms", terms: [{ id: "lexeme", kind: "payment", value: { zh: `${selected}%预付`, en: `${selected}% prepaid` } }] } },
        packaging: { source: `包装：每箱${n}件。`, operation: { op: "replace_commercial_terms", terms: [{ id: "lexeme", kind: "packaging", value: { zh: example.id === "source-invalid-subset" ? `${selected}件` : `每箱${selected}件`, en: `${selected} pieces per box` } }] } },
        equipment: { source: `设备：注塑机8台（${n}t）。`, operation: { op: "replace_equipment", equipment: [{ id: "lexeme", name: { zh: "注塑机", en: "Injection machine" }, quantity: 8, spec: { zh: `${selected}t`, en: `${selected} t` } }] } },
        quality: { source: `质检流程：抽检${n}件。`, operation: { op: "replace_quality_process", steps: [{ id: "lexeme", title: { zh: "抽检", en: "Sampling" }, body: { zh: `${selected}件`, en: `${selected} pieces` } }] } },
        history: { source: `沿革：2019年新增${n}台设备。`, operation: { op: "replace_history", history: [{ id: "lexeme", year: 2019, event: { zh: historyZh, en: historyEn } }] } },
        capacity: { source: `产能：月产${n}件。`, operation: { op: "replace_commercial_terms", terms: [{ id: "lexeme", kind: "capacity", value: { zh: example.id === "source-invalid-subset" ? `${selected}件` : `月产${selected}件`, en: example.id === "source-invalid-subset" ? `${selected} pieces` : `${selected} pieces per month` } }] } },
      };
      const input = inputs[caller];
      const parsed = aiIntentResponseSchema.parse({ type: "edit", summary: "Whole numeric lexeme control", operations: [input.operation] });
      assert.equal(parsed.type, "edit");
      if (parsed.type !== "edit") throw new Error("Expected an edit response");
      const checked = validateAIOperations(input.source, parsed.operations, templates);
      if (evidenceRoot) await writeFile(path.join(evidenceRoot, `e106-lexeme-${caller}-${example.id}.json`), JSON.stringify({ input, expectedAcceptance: example.accept, checked }, null, 2), "utf8");
      assert.deepEqual(checked.operations, example.accept ? [input.operation] : [], `${caller} ${example.id}: ${checked.rejected.join("; ")}`);
      if (!example.accept) assert.ok(checked.rejected.length > 0);
    });
  }
}

test("T118 e106 numeric code and terminal prose punctuation retain the existing contract", () => {
  for (const spec of ["BT40", "S136/H13"]) {
    const operations = [{ op: "replace_equipment" as const, equipment: [{ id: "code-boundary", name: { zh: "注塑机", en: "Injection machine" }, quantity: 8, spec: { zh: spec, en: `${spec}.` } }] }];
    const parsed = aiIntentResponseSchema.parse({ type: "edit", summary: "Source code boundary", operations });
    if (parsed.type !== "edit") throw new Error("Expected an edit response");
    assert.deepEqual(validateAIOperations(`设备：注塑机8台（${spec}）。`, parsed.operations, templates).operations, operations);
  }
});

test("T118 e106 source-only refusal preserves candidate and full source basis", async () => {
  const source = "产能：月产725万件，仅限旺季。";
  const candidate = term("月产725万件", "7.25 million pieces per month");
  const checked = validateAIOperations(source, [{ op: "replace_commercial_terms", terms: [candidate] }], templates);
  if (evidenceRoot) await writeFile(path.join(evidenceRoot, "e106-source-diagnostic.json"), JSON.stringify({ source, candidate, checked }, null, 2), "utf8");
  assert.deepEqual(checked.operations, []);
  const refusal = checked.commercialTermRejections![0];
  assert.deepEqual(refusal.term, candidate);
  assert.ok(refusal.failedChecks.includes("source_capacity_parse"));
  assert.equal(refusal.sourceMatches, false);
  assert.equal(refusal.parseEvidence.zh.status, "complete");
  assert.equal(refusal.parseEvidence.en.status, "complete");
  assert.equal(refusal.sourceFragments[0].source, source.slice(0, -1));
  assert.ok(checked.rejected.includes("资料里的产能中有暂不支持的表达，未写入"));
});
// 7a2 independent mutations keep the source/Chinese quantity fixed and change
// only the English numeric lexeme. Leading-dot notation is not promised.
const leadingPointCases = [
  { id: "integer", zh: "237", en: "237", accept: true },
  { id: "decimal", zh: "0.237", en: "0.237", accept: true },
  { id: "dot", zh: "237", en: ".237", accept: false },
  { id: "double-dot", zh: "237", en: "..237", accept: false },
  { id: "source-dot", zh: ".237", en: "237", accept: false },
  { id: "source-double-dot", zh: "..237", en: "237", accept: false },
] as const;
for (const caller of ["moq", "equipment", "quality", "history"] as const) {
  for (const example of leadingPointCases) {
    test(`T118 7a2 leading point ${caller} ${example.id}: ${example.accept ? "accept" : "refuse"}`, async () => {
      const { zh, en } = example;
      const inputs = {
        moq: { source: `MOQ：${zh}件。`, operation: { op: "replace_commercial_terms", terms: [{ id: "boundary", kind: "moq", value: { zh: `${zh}件`, en: `${en} pieces` } }] } },
        equipment: { source: `设备：注塑机47台（${zh}t）。`, operation: { op: "replace_equipment", equipment: [{ id: "boundary", name: { zh: "注塑机", en: "Injection molding machines" }, quantity: 47, spec: { zh: `${zh}t`, en: `${en} t` } }] } },
        quality: { source: `质检流程：抽检${zh}件。`, operation: { op: "replace_quality_process", steps: [{ id: "boundary", title: { zh: "抽检", en: "Sampling" }, body: { zh: `${zh}件`, en: `${en} pieces` } }] } },
        history: { source: `沿革：2024年新增${zh}台设备。`, operation: { op: "replace_history", history: [{ id: "boundary", year: 2024, event: { zh: `新增${zh}台设备`, en: `Added ${en} machines` } }] } },
      };
      const input = inputs[caller];
      const parsed = aiIntentResponseSchema.parse({ type: "edit", summary: "Whole leading numeric boundary", operations: [input.operation] });
      if (parsed.type !== "edit") throw new Error("Expected an edit response");
      const checked = validateAIOperations(input.source, parsed.operations, templates);
      if (evidenceRoot) await writeFile(path.join(evidenceRoot, `7a2-leading-${caller}-${example.id}.json`), JSON.stringify({ input, expectedAcceptance: example.accept, checked }, null, 2), "utf8");
      assert.deepEqual(checked.operations, example.accept ? [input.operation] : [], `${caller} ${example.id}: ${checked.rejected.join("; ")}`);
      if (!example.accept) assert.ok(checked.rejected.length > 0);
    });
  }
}

test("T118 7a2 normal period before a separated number preserves prose punctuation", () => {
  const operations = [{ op: "replace_history" as const, history: [{ id: "prose-period", year: 2024, event: { zh: "新增237台设备", en: "Expansion confirmed. 237 machines added." } }] }];
  assert.deepEqual(validateAIOperations("沿革：2024年新增237台设备。", operations, templates).operations, operations);
});

test("T118 7a2 leading point is rejected before history prose cleanup", async () => {
  const operations = [{ op: "replace_history" as const, history: [{ id: "cleaning-boundary", year: 2024, event: { zh: "新增237台设备", en: ".237 machines added" } }] }];
  const parsed = aiIntentResponseSchema.parse({ type: "edit", summary: "Raw numeric boundary before prose cleanup", operations });
  if (parsed.type !== "edit") throw new Error("Expected an edit response");
  const checked = validateAIOperations("沿革：2024年新增237台设备。", parsed.operations, templates);
  if (evidenceRoot) await writeFile(path.join(evidenceRoot, "7a2-history-raw-cleaning.json"), JSON.stringify({ operations, checked }, null, 2), "utf8");
  assert.deepEqual(checked.operations, []);
  assert.ok(checked.rejected.length > 0);
});

type SourceParseEvidence = {
  coordinateSpace: "source"; offsetUnit: "utf16"; sourceLength: number;
  status: string; truncated: boolean;
  spans: Array<{ start: number; end: number; depth: number; kind: string }>;
  residuals: Array<{ start: number; end: number; depth: number; text: string; reason: string }>;
};
const sourceEvidenceCases = [
  { id: "tail", source: "产能：月产735万件，仅限夜班。", depth: 0, clipped: false },
  { id: "wrappers", source: "资料：产能：月产735万件，仅限夜班。", depth: 0, clipped: false },
  { id: "parenthesis", source: "产能：月产735万件，注塑机47台（仅限夜班）。", depth: 1, clipped: false },
  { id: "long-residual", source: `产能：月产735万件，${"仅限夜班".repeat(250)}。`, depth: 0, clipped: true },
  { id: "many-spans", source: `产能：${Array.from({ length: 60 }, (_, i) => `月产${735 + i}万件`).join("；")}；仅限夜班。`, depth: 0, clipped: true },
] as const;
for (const example of sourceEvidenceCases) {
  test(`T118 7a2 source parsing evidence ${example.id}: actual located residual and declared limits`, async () => {
    const checked = validateAIOperations(example.source, [{ op: "replace_commercial_terms", terms: [term("月产735万件", "7.35 million pieces per month")] }], templates);
    if (evidenceRoot) await writeFile(path.join(evidenceRoot, `7a2-source-evidence-${example.id}.json`), JSON.stringify({ input: example, checked }, null, 2), "utf8");
    assert.deepEqual(checked.operations, []);
    const refusal = checked.commercialTermRejections![0];
    assert.ok(refusal.failedChecks.includes("source_capacity_parse"));
    assert.equal(refusal.parseEvidence.zh.status, "complete");
    assert.equal(refusal.parseEvidence.en.status, "complete");
    const fragment = refusal.sourceFragments[0] as typeof refusal.sourceFragments[number] & { parseEvidence: SourceParseEvidence };
    const evidence = fragment.parseEvidence;
    assert.equal(evidence.status, "unsupported");
    assert.equal(evidence.coordinateSpace, "source");
    assert.equal(evidence.offsetUnit, "utf16");
    assert.equal(evidence.sourceLength, example.source.length - 1);
    assert.equal(evidence.truncated, example.clipped);
    assert.ok(evidence.spans.length > 0 && evidence.spans.length <= 48);
    assert.ok(evidence.residuals.length > 0 && evidence.residuals.length <= 4);
    const residual = evidence.residuals[0];
    assert.equal(residual.start, example.source.indexOf("仅限夜班"));
    assert.equal(residual.depth, example.depth);
    assert.equal(residual.text, example.source.slice(residual.start, residual.end).slice(0, 160));
    assert.ok(residual.reason.length > 0);
    assert.ok(evidence.residuals.every((part) => part.text.length <= 160));
    assert.equal(fragment.truncated, example.source.length - 1 > 1000);
  });
}

test("T118 7a2 synthetic provider refuses leading point and retains source diagnostics only in server audit", async () => {
  process.env.DEEPSEEK_API_KEY = "sk-t118-7a2-not-real";
  process.env.DEEPSEEK_BASE_URL = "https://t118-stub.test.invalid";
  process.env.DEEPSEEK_MODEL = "t118-stub";
  for (const key of ["AI_API_KEY", "AI_BASE_URL", "AI_MODEL"]) delete process.env[key];
  const controls: Array<{ source: string; candidate: CommercialTerm; accepted: boolean }> = [
    { source: "MOQ：237件。", candidate: { id: "leading-boundary", kind: "moq", value: { zh: "237件", en: ".237 pieces" } }, accepted: false },
    { source: "MOQ：237件。", candidate: { id: "leading-boundary", kind: "moq", value: { zh: "237件", en: "237 pieces" } }, accepted: true },
    { source: "产能：月产735万件，仅限夜班。", candidate: term("月产735万件", "7.35 million pieces per month"), accepted: false },
  ];
  for (const [index, input] of controls.entries()) {
    const oldFetch = globalThis.fetch;
    const oldWarn = console.warn;
    const lines: string[] = [];
    let calls = 0;
    globalThis.fetch = async (url) => {
      assert.equal(String(url), "https://t118-stub.test.invalid/chat/completions");
      calls += 1;
      return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ type: "edit", summary: "private 7a2 summary", operations: [{ op: "replace_commercial_terms", terms: [input.candidate] }] }), reasoning_content: "private 7a2 reasoning" } }] }));
    };
    console.warn = (...values: unknown[]) => { lines.push(values.map(String).join(" ")); };
    let result;
    try {
      result = await requestStructuredOperations({ message: input.source, draft: structuredClone(defaultDraft), templateId: "screwfast" });
    } finally {
      globalThis.fetch = oldFetch;
      console.warn = oldWarn;
    }
    if (evidenceRoot) await writeFile(path.join(evidenceRoot, `7a2-provider-${index}.json`), JSON.stringify({ input, result, lines, calls }, null, 2), "utf8");
    assert.equal(calls, 1);
    assert.ok(result.ok && result.type === "edit");
    assert.equal(result.operations.length > 0, input.accepted);
    if (index === 2) {
      assert.equal(lines.length, 1);
      const audit = JSON.parse(lines[0].slice(lines[0].indexOf("{")));
      assert.equal(audit.rejections[0].sourceFragments[0].parseEvidence.residuals[0].text, "仅限夜班");
      assert.equal(audit.rejections[0].sourceFragments[0].parseEvidence.residuals[0].start, input.source.indexOf("仅限夜班"));
      assert.ok(!JSON.stringify(result).includes("仅限夜班"));
      for (const secret of [process.env.DEEPSEEK_API_KEY!, "private 7a2 summary", "private 7a2 reasoning"]) assert.ok(!lines[0].includes(secret));
      assert.ok(lines[0].length < 16000);
    }
  }
});
const boundary087Cases = [
  { id: "unicode-changed", source: "产能：年产７３套。", zh: "年产７３套", en: "７４ sets per year", accept: false },
  { id: "unicode-same-unsupported", source: "产能：年产７３套。", zh: "年产７３套", en: "７３ sets per year", accept: false },
  { id: "unicode-roman", source: "产能：年产Ⅶ套。", zh: "年产Ⅶ套", en: "Ⅷ sets per year", accept: false },
  { id: "ascii-control", source: "产能：年产73套。", zh: "年产73套", en: "73 sets per year", accept: true },
  { id: "yi-piece", source: "产能：年产1.234亿件。", zh: "年产1.234亿件", en: "123400000 pieces per year", accept: true },
  { id: "yi-set", source: "产能：年产1.234亿套。", zh: "年产1.234亿套", en: "123400000 sets per year", accept: true },
  { id: "wan-set", source: "产能：年产1.234万套。", zh: "年产1.234万套", en: "12340 sets per year", accept: true },
  { id: "yi-no-unit", source: "产能：年产1.234亿。", zh: "年产1.234亿", en: "123400000 per year", accept: true },
  { id: "scale-wrong-number", source: "产能：年产1.234亿件。", zh: "年产1.234亿件", en: "123400001 pieces per year", accept: false },
  { id: "scale-wrong-unit", source: "产能：年产1.234亿件。", zh: "年产1.234亿件", en: "123400000 sets per year", accept: false },
  { id: "scale-wrong-period", source: "产能：年产1.234万套。", zh: "年产1.234万套", en: "12340 sets per month", accept: false },
  { id: "unquantified-control", source: "产能：按订单排产。", zh: "按订单排产", en: "Scheduled by order", accept: true },
  { id: "unquantified-period-control", source: "产能：每月按订单确认。", zh: "每月按订单确认", en: "Monthly capacity is confirmed per order", accept: true },
  { id: "unquantified-period-lost", source: "产能：每月按订单确认。", zh: "每月按订单确认", en: "Capacity is confirmed per order", accept: false },
  { id: "unquantified-unit-added", source: "产能：按订单排产。", zh: "按订单排产", en: "Scheduled per piece", accept: false },
] as const;
for (const example of boundary087Cases) {
  test(`T118 087 quantitative admission ${example.id}: ${example.accept ? "accept" : "refuse"}`, async () => {
    const operations = [{ op: "replace_commercial_terms" as const, terms: [term(example.zh, example.en)] }];
    const parsed = aiIntentResponseSchema.parse({ type: "edit", summary: "Independent numeric admission control", operations });
    if (parsed.type !== "edit") throw new Error("Expected an edit response");
    const checked = validateAIOperations(example.source, parsed.operations, templates);
    if (evidenceRoot) await writeFile(path.join(evidenceRoot, `087-quant-${example.id}.json`), JSON.stringify({ input: example, checked }, null, 2), "utf8");
    assert.deepEqual(checked.operations, example.accept ? operations : [], `${example.id}: ${checked.rejected.join("; ")}`);
    if (!example.accept) assert.ok(checked.rejected.length > 0);
  });
}

// Signed notation is not in the declared decimal/range grammar. A source sign
// cannot be dropped by substring selection, and a candidate sign cannot be
// discarded by numeric extraction or prose cleanup.
for (const sign of ["", "-", "+", "−"] as const) {
  for (const caller of ["moq", "equipment-source", "quality-source", "quality-candidate", "history"] as const) {
    test(`T118 087 signed boundary ${caller} ${sign || "plain"}: ${sign ? "refuse" : "accept"}`, async () => {
      const inputs = {
        moq: { source: "MOQ：73件。", operation: { op: "replace_commercial_terms", terms: [{ id: "sign", kind: "moq", value: { zh: "73件", en: `${sign}73 pieces` } }] } },
        "equipment-source": { source: `设备：注塑机37台（${sign}73t）。`, operation: { op: "replace_equipment", equipment: [{ id: "sign", name: { zh: "注塑机", en: "Injection machine" }, quantity: 37, spec: { zh: "73t", en: "73 tons" } }] } },
        "quality-source": { source: `质检流程：检查（${sign}73小时）。`, operation: { op: "replace_quality_process", steps: [{ id: "sign", title: { zh: "检查", en: "Inspection" }, body: { zh: "73小时", en: "73 hours" } }] } },
        "quality-candidate": { source: "质检流程：检查（73小时）。", operation: { op: "replace_quality_process", steps: [{ id: "sign", title: { zh: "检查", en: "Inspection" }, body: { zh: "73小时", en: `${sign}73 hours` } }] } },
        history: { source: "沿革：2019年新增73台注塑机。", operation: { op: "replace_history", history: [{ id: "sign", year: 2019, event: { zh: "新增73台注塑机", en: `Added ${sign}73 injection machines` } }] } },
      };
      const input = inputs[caller];
      const parsed = aiIntentResponseSchema.parse({ type: "edit", summary: "Independent signed numeric boundary", operations: [input.operation] });
      if (parsed.type !== "edit") throw new Error("Expected an edit response");
      const checked = validateAIOperations(input.source, parsed.operations, templates);
      if (evidenceRoot) await writeFile(path.join(evidenceRoot, `087-sign-${caller}-${sign ? sign.codePointAt(0) : "plain"}.json`), JSON.stringify({ input, expectedAcceptance: !sign, checked }, null, 2), "utf8");
      assert.deepEqual(checked.operations, sign ? [] : [input.operation], `${caller} ${sign}: ${checked.rejected.join("; ")}`);
      if (sign) assert.ok(checked.rejected.length > 0);
    });
  }
}

test("T118 087 synthetic provider refuses Unicode and signed values and accepts parsed scaled units", async () => {
  process.env.DEEPSEEK_API_KEY = "sk-t118-087-not-real";
  process.env.DEEPSEEK_BASE_URL = "https://t118-stub.test.invalid";
  process.env.DEEPSEEK_MODEL = "t118-stub";
  for (const key of ["AI_API_KEY", "AI_BASE_URL", "AI_MODEL"]) delete process.env[key];
  const inputs: Array<{ source: string; candidate: CommercialTerm; accepted: boolean }> = [
    { source: "产能：年产７３套。", candidate: term("年产７３套", "７４ sets per year"), accepted: false },
    { source: "MOQ：73件。", candidate: { id: "signed", kind: "moq", value: { zh: "73件", en: "-73 pieces" } }, accepted: false },
    { source: "产能：年产1.234亿件。", candidate: term("年产1.234亿件", "123400000 pieces per year"), accepted: true },
  ];
  for (const [index, input] of inputs.entries()) {
    const oldFetch = globalThis.fetch;
    const oldWarn = console.warn;
    const logs: string[] = [];
    let calls = 0;
    globalThis.fetch = async (url) => {
      assert.equal(String(url), "https://t118-stub.test.invalid/chat/completions");
      calls += 1;
      return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ type: "edit", summary: "Independent admission response", operations: [{ op: "replace_commercial_terms", terms: [input.candidate] }] }) } }] }));
    };
    console.warn = (...values: unknown[]) => { logs.push(values.map(String).join(" ")); };
    let result;
    try {
      result = await requestStructuredOperations({ message: input.source, draft: structuredClone(defaultDraft), templateId: "screwfast" });
    } finally {
      globalThis.fetch = oldFetch;
      console.warn = oldWarn;
    }
    if (evidenceRoot) await writeFile(path.join(evidenceRoot, `087-provider-${index}.json`), JSON.stringify({ input, result, logs, calls }, null, 2), "utf8");
    assert.equal(calls, 1);
    assert.ok(result.ok && result.type === "edit");
    assert.equal(result.operations.length > 0, input.accepted);
    if (!input.accepted) assert.ok(result.rejected.length > 0);
  }
});
const contract649Cases = [
  { id: "lead-plain", kind: "lead_time", source: "交期：23天。", zh: "23天", en: "23 days", accept: true },
  { id: "lead-positive-space", kind: "lead_time", source: "交期：+ 23天。", zh: "+ 23天", en: "23 days", accept: false },
  { id: "lead-negative-space", kind: "lead_time", source: "交期：− 23天。", zh: "− 23天", en: "23 days", accept: false },
  { id: "lead-range", kind: "lead_time", source: "交期：23–31天。", zh: "23–31天", en: "23–31 days", accept: true },
  { id: "moq-same-sentence", kind: "moq", source: "起订量：731件；947套。", zh: "731件；947套", en: "731 pieces; 947 sets", accept: true },
  { id: "moq-cross-sentence", kind: "moq", source: "起订量：731件。起订量：947套。", zh: "731件；947套", en: "731 pieces; 947 sets", accept: false },
  { id: "unquantified-original", kind: "capacity", source: "产能：按订单安排。", zh: "按订单安排", en: "output according to order schedule", accept: true },
  { id: "unquantified-each-added", kind: "capacity", source: "产能：按订单安排。", zh: "按订单安排", en: "output according to order schedule each year", accept: false },
  { id: "unquantified-slash-added", kind: "capacity", source: "产能：按订单安排。", zh: "按订单安排", en: "output according to order schedule / year", accept: false },
  { id: "unquantified-each-kept", kind: "capacity", source: "产能：每年按订单安排。", zh: "每年按订单安排", en: "output according to order schedule each year", accept: true },
  { id: "unquantified-slash-kept", kind: "capacity", source: "产能：每年按订单安排。", zh: "每年按订单安排", en: "output according to order schedule /year", accept: true },
  { id: "unquantified-period-lost", kind: "capacity", source: "产能：每年按订单安排。", zh: "每年按订单安排", en: "output according to order schedule", accept: false },
  { id: "wrapped-no-marker-body", kind: "capacity", source: wrapCompanyMaterials("产能：按订单安排。"), zh: "按订单安排", en: "Scheduled by order", accept: true },
  { id: "wrapped-no-marker-instruction", kind: "capacity", source: wrapCompanyMaterials("产能：按订单安排。"), zh: "资料没有的条目不要补齐", en: "Do not fill unspecified entries", accept: false },
  { id: "wrapped-marker-body", kind: "capacity", source: wrapCompanyMaterials("资料性质：模拟。\n产能：按订单安排。"), zh: "按订单安排", en: "Scheduled by order", accept: true },
] as const;
for (const example of contract649Cases) {
  test(`T118 649 contract ${example.id}: ${example.accept ? "accept" : "refuse"}`, async () => {
    const operations = [{ op: "replace_commercial_terms" as const, terms: [{ id: "contract-649", kind: example.kind, value: { zh: example.zh, en: example.en } }] }];
    const parsed = aiIntentResponseSchema.parse({ type: "edit", summary: "Independent four-contract control", operations });
    if (parsed.type !== "edit") throw new Error("Expected an edit response");
    const checked = validateAIOperations(example.source, parsed.operations, templates);
    if (evidenceRoot) await writeFile(path.join(evidenceRoot, `649-contract-${example.id}.json`), JSON.stringify({ input: example, checked }, null, 2), "utf8");
    assert.deepEqual(checked.operations, example.accept ? operations : [], `${example.id}: ${checked.rejected.join("; ")}`);
    if (!example.accept) assert.ok(checked.rejected.length > 0);
  });
}

for (const caller of ["quality", "history"] as const) {
  test(`T118 649 spaced sign raw ${caller} refuses before prose cleanup`, async () => {
    const inputs = {
      quality: { source: "质检流程：抽检，− 23件", operation: { op: "replace_quality_process", steps: [{ id: "sampling", title: { zh: "抽检", en: "Sampling" }, body: { zh: "− 23件", en: "23 pieces" } }] } },
      history: { source: "沿革：2017年新增− 23套", operation: { op: "replace_history", history: [{ id: "line", year: 2017, event: { zh: "新增− 23套", en: "Added 23 sets" } }] } },
    };
    const input = inputs[caller];
    const parsed = aiIntentResponseSchema.parse({ type: "edit", summary: "Raw spaced-sign control", operations: [input.operation] });
    if (parsed.type !== "edit") throw new Error("Expected an edit response");
    const checked = validateAIOperations(input.source, parsed.operations, templates);
    if (evidenceRoot) await writeFile(path.join(evidenceRoot, `649-spaced-${caller}.json`), JSON.stringify({ input, checked }, null, 2), "utf8");
    assert.deepEqual(checked.operations, []);
    assert.ok(checked.rejected.length > 0);
  });
}

test("T118 649 synthetic provider observes the four contract refusals", async () => {
  process.env.DEEPSEEK_API_KEY = "sk-t118-649-not-real";
  process.env.DEEPSEEK_BASE_URL = "https://t118-stub.test.invalid";
  process.env.DEEPSEEK_MODEL = "t118-stub";
  for (const key of ["AI_API_KEY", "AI_BASE_URL", "AI_MODEL"]) delete process.env[key];
  const controls = ["lead-negative-space", "moq-cross-sentence", "unquantified-each-added", "wrapped-no-marker-instruction", "wrapped-no-marker-body"].map((id) => contract649Cases.find((row) => row.id === id)!);
  for (const [index, input] of controls.entries()) {
    const oldFetch = globalThis.fetch;
    const oldWarn = console.warn;
    const logs: string[] = [];
    let calls = 0;
    const candidate = { id: "contract-649", kind: input.kind, value: { zh: input.zh, en: input.en } };
    globalThis.fetch = async (url) => {
      assert.equal(String(url), "https://t118-stub.test.invalid/chat/completions");
      calls += 1;
      return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ type: "edit", summary: "Synthetic four-contract response", operations: [{ op: "replace_commercial_terms", terms: [candidate] }] }) } }] }));
    };
    console.warn = (...values: unknown[]) => { logs.push(values.map(String).join(" ")); };
    let result;
    try {
      result = await requestStructuredOperations({ message: input.source, draft: structuredClone(defaultDraft), templateId: "screwfast" });
    } finally {
      globalThis.fetch = oldFetch;
      console.warn = oldWarn;
    }
    if (evidenceRoot) await writeFile(path.join(evidenceRoot, `649-provider-${index}.json`), JSON.stringify({ input, result, calls, logs }, null, 2), "utf8");
    assert.equal(calls, 1);
    assert.ok(result.ok && result.type === "edit");
    assert.equal(result.operations.length > 0, input.accept);
    if (!input.accept) assert.ok(result.rejected.length > 0);
  }
});
// c984: prove shared admission through non-capacity callers. Unicode signs are
// unsupported spellings, including when separated from digits by whitespace.
const c984Signs = ["", "＋", "﹢", "﹣", "－"] as const;
for (const caller of ["moq", "quality", "history", "equipment"] as const) {
  for (const sign of c984Signs) {
    for (const space of sign ? ["", " "] : [""]) {
      test(`T118 c984 shared Unicode sign ${caller} ${sign || "plain"}${space ? "-space" : ""}: ${sign ? "refuse" : "accept"}`, async () => {
        const marked = `${sign}${space}`;
        const inputs = {
          moq: { source: `起订量：${marked}37件。`, operation: { op: "replace_commercial_terms", terms: [{ id: "shared-sign", kind: "moq", value: { zh: `${marked}37件`, en: "37 pieces" } }] } },
          quality: { source: `质检流程：抽检，抽查${marked}37件。`, operation: { op: "replace_quality_process", steps: [{ id: "shared-sign", title: { zh: "抽检", en: "Sampling" }, body: { zh: `抽查${marked}37件`, en: "Inspect 37 pieces" } }] } },
          history: { source: `沿革：2019年新增${marked}37台注塑机。`, operation: { op: "replace_history", history: [{ id: "shared-sign", year: 2019, event: { zh: `新增${marked}37台注塑机`, en: "Added 37 injection machines" } }] } },
          equipment: { source: `设备：注塑机37台（${marked}260t）。`, operation: { op: "replace_equipment", equipment: [{ id: "shared-sign", name: { zh: "注塑机", en: "Injection machine" }, quantity: 37, spec: { zh: `${marked}260t`, en: "260 tons" } }] } },
        };
        const input = inputs[caller];
        const parsed = aiIntentResponseSchema.parse({ type: "edit", summary: "Shared Unicode sign admission", operations: [input.operation] });
        if (parsed.type !== "edit") throw new Error("Expected an edit response");
        const checked = validateAIOperations(input.source, parsed.operations, templates);
        if (evidenceRoot) await writeFile(path.join(evidenceRoot, `c984-shared-${caller}-${sign ? sign.codePointAt(0) : "plain"}-${space ? "space" : "tight"}.json`), JSON.stringify({ input, expectedAcceptance: !sign, checked }, null, 2), "utf8");
        assert.deepEqual(checked.operations, sign ? [] : [input.operation], `${caller}: ${checked.rejected.join("; ")}`);
        if (sign) assert.ok(checked.rejected.length > 0);
      });
    }
  }
}

for (const example of [
  { id: "qiding", source: "起订：37件。", accept: true },
  { id: "qijie", source: "起接：37件。", accept: true },
  { id: "qidingliang", source: "起订量：37件。", accept: true },
  { id: "unknown-limit", source: "起订上限：37件。", accept: false },
  { id: "unknown-estimate", source: "预计起接：37件。", accept: false },
] as const) {
  test(`T118 c984 declared MOQ label ${example.id}: ${example.accept ? "accept" : "refuse"}`, async () => {
    const operations = [{ op: "replace_commercial_terms" as const, terms: [{ id: "label", kind: "moq" as const, value: { zh: "37件", en: "37 pieces" } }] }];
    const parsed = aiIntentResponseSchema.parse({ type: "edit", summary: "Declared MOQ label control", operations });
    if (parsed.type !== "edit") throw new Error("Expected an edit response");
    const checked = validateAIOperations(example.source, parsed.operations, templates);
    if (evidenceRoot) await writeFile(path.join(evidenceRoot, `c984-label-${example.id}.json`), JSON.stringify({ input: example, checked }, null, 2), "utf8");
    assert.deepEqual(checked.operations, example.accept ? operations : []);
    if (!example.accept) assert.ok(checked.rejected.length > 0);
  });
}

test("T118 c984 isolated provider/commit/readback observes shared rejection and declared label acceptance", async () => {
  process.env.DEEPSEEK_API_KEY = "sk-t118-c984-not-real";
  process.env.DEEPSEEK_BASE_URL = "https://t118-stub.test.invalid";
  process.env.DEEPSEEK_MODEL = "t118-stub";
  for (const key of ["AI_API_KEY", "AI_BASE_URL", "AI_MODEL"]) delete process.env[key];
  const inputs = [
    { source: "起订量：－37件。", accepted: false, operation: { op: "replace_commercial_terms", terms: [{ id: "pipeline", kind: "moq", value: { zh: "－37件", en: "37 pieces" } }] } },
    { source: "质检流程：抽检，抽查﹣37件。", accepted: false, operation: { op: "replace_quality_process", steps: [{ id: "pipeline", title: { zh: "抽检", en: "Sampling" }, body: { zh: "抽查﹣37件", en: "Inspect 37 pieces" } }] } },
    { source: "沿革：2019年新增＋37台注塑机。", accepted: false, operation: { op: "replace_history", history: [{ id: "pipeline", year: 2019, event: { zh: "新增＋37台注塑机", en: "Added 37 injection machines" } }] } },
    { source: "起接：37件。", accepted: true, operation: { op: "replace_commercial_terms", terms: [{ id: "pipeline", kind: "moq", value: { zh: "37件", en: "37 pieces" } }] } },
  ];
  for (const [index, input] of inputs.entries()) {
    const siteId = `t118-c984-pipeline-${index}`;
    const before = await createSite(siteId);
    const oldFetch = globalThis.fetch;
    const oldWarn = console.warn;
    const logs: string[] = [];
    let calls = 0;
    globalThis.fetch = async (url) => {
      assert.equal(String(url), "https://t118-stub.test.invalid/chat/completions");
      calls += 1;
      return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ type: "edit", summary: "Shared admission pipeline control", operations: [input.operation] }) } }] }));
    };
    console.warn = (...values: unknown[]) => { logs.push(values.map(String).join(" ")); };
    let result;
    try {
      result = await requestStructuredOperations({ message: input.source, draft: before.draft, templateId: "screwfast" });
    } finally {
      globalThis.fetch = oldFetch;
      console.warn = oldWarn;
    }
    assert.ok(result.ok && result.type === "edit");
    const committed = await commitOperations({ siteId, baseRevision: before.draft.revision, operations: result.operations, summary: "Shared admission pipeline control", source: "ai" });
    const saved = (await getExistingSite(siteId))!;
    if (evidenceRoot) await writeFile(path.join(evidenceRoot, `c984-pipeline-${index}.json`), JSON.stringify({ input, result, calls, logs, committed, saved }, null, 2), "utf8");
    assert.equal(calls, 1);
    assert.equal(committed.status, input.accepted ? "applied" : "no_change");
    if (!input.accepted) {
      assert.deepEqual(saved.draft, before.draft);
      assert.deepEqual(saved.history, before.history);
    } else {
      assert.deepEqual(saved.draft.content.commercialTerms, input.operation.terms);
      assert.equal((await moveHistory(siteId, "undo")).status, "applied");
      assert.deepEqual((await getExistingSite(siteId))?.draft.content.commercialTerms, []);
    }
  }
});
// The independent contract rejects unsupported symbol context, rather than a
// growing list of sign characters. All proofs here use shared non-capacity callers.
for (const caller of ["moq", "equipment", "quality", "history"] as const) {
  for (const symbol of ["⁻", "±", "∓"] as const) {
    for (const direction of ["source", "candidate"] as const) {
      test(`T118 9d45 full numeric context ${caller} ${symbol} ${direction}: refuse`, async () => {
        const zh = direction === "source" ? `${symbol} 731` : "731";
        const en = direction === "candidate" ? `${symbol} 731` : "731";
        const inputs = {
          moq: { source: `MOQ：${zh}件。`, operation: { op: "replace_commercial_terms", terms: [{ id: "context", kind: "moq", value: { zh: `${zh}件`, en: `${en} pieces` } }] } },
          equipment: { source: `设备：注塑机37台（${zh}t）。`, operation: { op: "replace_equipment", equipment: [{ id: "context", name: { zh: "注塑机", en: "Injection machine" }, quantity: 37, spec: { zh: `${zh}t`, en: `${en} tons` } }] } },
          quality: { source: `质检流程：抽检，抽查${zh}件。`, operation: { op: "replace_quality_process", steps: [{ id: "context", title: { zh: "抽检", en: "Sampling" }, body: { zh: `抽查${zh}件`, en: `Inspect ${en} pieces` } }] } },
          history: { source: `沿革：2019年新增${zh}台注塑机。`, operation: { op: "replace_history", history: [{ id: "context", year: 2019, event: { zh: `新增${zh}台注塑机`, en: `Added ${en} injection machines` } }] } },
        };
        const input = inputs[caller];
        const parsed = aiIntentResponseSchema.parse({ type: "edit", summary: "Complete numeric context control", operations: [input.operation] });
        if (parsed.type !== "edit") throw new Error("Expected an edit response");
        const checked = validateAIOperations(input.source, parsed.operations, templates);
        if (evidenceRoot) await writeFile(path.join(evidenceRoot, `9d45-context-${caller}-${symbol.codePointAt(0)}-${direction}.json`), JSON.stringify({ input, checked }, null, 2), "utf8");
        assert.deepEqual(checked.operations, []);
        assert.ok(checked.rejected.length > 0);
      });
    }
  }
}

const context9d45Controls = [
  { id: "unsigned", source: "MOQ：731件。", kind: "moq", zh: "731件", en: "731 pieces", accept: true },
  { id: "range", source: "MOQ：731–947件。", kind: "moq", zh: "731–947件", en: "731-947 pieces", accept: true },
  { id: "grouped", source: "MOQ：7,310件。", kind: "moq", zh: "7,310件", en: "7310 pieces", accept: true },
  { id: "kg-original", source: "产能：按月供货。", kind: "capacity", zh: "按月供货", en: "Output per month", accept: true },
  { id: "kg-added", source: "产能：按月供货。", kind: "capacity", zh: "按月供货", en: "Output in kg per month", accept: false },
  { id: "kg-kept", source: "产能：按kg每月供货。", kind: "capacity", zh: "按kg每月供货", en: "Output in kg per month", accept: true },
  { id: "kg-per-kept", source: "产能：按kg供货。", kind: "capacity", zh: "按kg供货", en: "Supply per kg", accept: true },
  { id: "kg-lost", source: "产能：按kg每月供货。", kind: "capacity", zh: "按kg每月供货", en: "Output per month", accept: false },
  { id: "kg-wrong-unit", source: "产能：按kg每月供货。", kind: "capacity", zh: "按kg每月供货", en: "Output in tons per month", accept: false },
] as const;
for (const example of context9d45Controls) {
  test(`T118 9d45 numeric/unit control ${example.id}: ${example.accept ? "accept" : "refuse"}`, async () => {
    const operations = [{ op: "replace_commercial_terms" as const, terms: [{ id: "context-control", kind: example.kind, value: { zh: example.zh, en: example.en } }] }];
    const parsed = aiIntentResponseSchema.parse({ type: "edit", summary: "Numeric/unit source control", operations });
    if (parsed.type !== "edit") throw new Error("Expected an edit response");
    const checked = validateAIOperations(example.source, parsed.operations, templates);
    if (evidenceRoot) await writeFile(path.join(evidenceRoot, `9d45-control-${example.id}.json`), JSON.stringify({ input: example, checked }, null, 2), "utf8");
    assert.deepEqual(checked.operations, example.accept ? operations : [], `${example.id}: ${checked.rejected.join("; ")}`);
    if (!example.accept) assert.ok(checked.rejected.length > 0);
  });
}

test("T118 9d45 known code/range/prose boundaries retain numeric identity", () => {
  for (const spec of ["BT40", "S136/H13", "i=25–100"]) {
    const operations = [{ op: "replace_equipment" as const, equipment: [{ id: "code-context", name: { zh: "注塑机", en: "Injection machine" }, quantity: 37, spec: { zh: spec, en: `${spec}.` } }] }];
    const parsed = aiIntentResponseSchema.parse({ type: "edit", summary: "Known code numeric boundary", operations });
    if (parsed.type !== "edit") throw new Error("Expected an edit response");
    assert.deepEqual(validateAIOperations(`设备：注塑机37台（${spec}）。`, parsed.operations, templates).operations, operations);
  }
});

test("T118 9d45 isolated provider/commit refuses unit invention and unsupported numeric context", async () => {
  process.env.DEEPSEEK_API_KEY = "sk-t118-9d45-not-real";
  process.env.DEEPSEEK_BASE_URL = "https://t118-stub.test.invalid";
  process.env.DEEPSEEK_MODEL = "t118-stub";
  for (const key of ["AI_API_KEY", "AI_BASE_URL", "AI_MODEL"]) delete process.env[key];
  const inputs = [
    { source: "产能：按月供货。", candidate: term("按月供货", "Output in kg per month"), accepted: false },
    { source: "MOQ：⁻ 731件。", candidate: { id: "context", kind: "moq" as const, value: { zh: "⁻ 731件", en: "731 pieces" } }, accepted: false },
    { source: "产能：按kg每月供货。", candidate: term("按kg每月供货", "Output in kg per month"), accepted: true },
  ];
  for (const [index, input] of inputs.entries()) {
    const siteId = `t118-9d45-context-${index}`;
    const before = await createSite(siteId);
    const oldFetch = globalThis.fetch;
    const oldWarn = console.warn;
    const logs: string[] = [];
    let calls = 0;
    globalThis.fetch = async (url) => {
      assert.equal(String(url), "https://t118-stub.test.invalid/chat/completions");
      calls += 1;
      return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ type: "edit", summary: "Complete admission response", operations: [{ op: "replace_commercial_terms", terms: [input.candidate] }] }) } }] }));
    };
    console.warn = (...values: unknown[]) => { logs.push(values.map(String).join(" ")); };
    let result;
    try {
      result = await requestStructuredOperations({ message: input.source, draft: before.draft, templateId: "screwfast" });
    } finally {
      globalThis.fetch = oldFetch;
      console.warn = oldWarn;
    }
    assert.ok(result.ok && result.type === "edit");
    const committed = await commitOperations({ siteId, baseRevision: before.draft.revision, operations: result.operations, summary: "Complete admission response", source: "ai" });
    const saved = (await getExistingSite(siteId))!;
    if (evidenceRoot) await writeFile(path.join(evidenceRoot, `9d45-pipeline-${index}.json`), JSON.stringify({ input, result, committed, saved, calls, logs }, null, 2), "utf8");
    assert.equal(calls, 1);
    assert.equal(committed.status, input.accepted ? "applied" : "no_change");
    if (!input.accepted) {
      assert.deepEqual(saved.draft, before.draft);
      assert.deepEqual(saved.history, before.history);
    } else {
      assert.deepEqual(saved.draft.content.commercialTerms, [input.candidate]);
      assert.equal((await moveHistory(siteId, "undo")).status, "applied");
      assert.deepEqual((await getExistingSite(siteId))?.draft.content.commercialTerms, []);
    }
  }
});
// Fixed from the unsigned-number and finite-unit contracts before changing
// ebf176d. Marks do not prove a text/code boundary, even after another symbol.
for (const caller of ["moq", "equipment", "quality", "history"] as const) {
  for (const [form, prefix] of [["overlay", "\u0338 "], ["circle", "\u20DD "], ["joiner", "\u034F "], ["sign-joiner", "+ \u034F "]] as const) {
    for (const direction of ["source", "candidate"] as const) {
      test(`T118 ebf complete leading context ${caller} ${form} ${direction}: refuse`, async () => {
        const zh = direction === "source" ? `${prefix}731` : "731";
        const en = direction === "candidate" ? `${prefix}731` : "731";
        const inputs = {
          moq: { source: `MOQ：${zh}件。`, operation: { op: "replace_commercial_terms", terms: [{ id: "leading", kind: "moq", value: { zh: `${zh}件`, en: `${en} pieces` } }] } },
          equipment: { source: `设备：注塑机37台（${zh}t）。`, operation: { op: "replace_equipment", equipment: [{ id: "leading", name: { zh: "注塑机", en: "Injection machine" }, quantity: 37, spec: { zh: `${zh}t`, en: `${en} tons` } }] } },
          quality: { source: `质检流程：抽检，抽查${zh}件。`, operation: { op: "replace_quality_process", steps: [{ id: "leading", title: { zh: "抽检", en: "Sampling" }, body: { zh: `抽查${zh}件`, en: `Inspect ${en} pieces` } }] } },
          history: { source: `沿革：2019年新增${zh}台注塑机。`, operation: { op: "replace_history", history: [{ id: "leading", year: 2019, event: { zh: `新增${zh}台注塑机`, en: `Added ${en} injection machines` } }] } },
        };
        const input = inputs[caller];
        const parsed = aiIntentResponseSchema.parse({ type: "edit", summary: "Complete leading context", operations: [input.operation] });
        if (parsed.type !== "edit") throw new Error("Expected an edit response");
        const checked = validateAIOperations(input.source, parsed.operations, templates);
        if (evidenceRoot) await writeFile(path.join(evidenceRoot, `ebf-leading-${caller}-${form}-${direction}.json`), JSON.stringify({ input, checked }, null, 2), "utf8");
        assert.deepEqual(checked.operations, []);
        assert.ok(checked.rejected.length > 0);
      });
    }
  }
}

// Independent explicit aliases from the existing unit contract. Use MOQ so the
// shared unit gate, rather than quantified capacity grammar, proves this matrix.
const ebfUnitAliases = [
  ["件", ["pc", "pcs", "piece", "pieces", "part", "parts"]],
  ["天", ["day", "days"]],
  ["小时", ["hour", "hours", "hr", "hrs", "h"]],
  ["周", ["week", "weeks"]],
  ["月", ["month", "months"]],
  ["年", ["year", "years"]],
  ["台", ["unit", "units", "machine", "machines"]],
  ["套", ["set", "sets"]],
  ["t", ["t", "ton", "tons"]],
  ["kg", ["kg"]],
] as const;
for (const [unit, aliases] of ebfUnitAliases) {
  for (const alias of aliases) {
    for (const preposition of ["in", "per"] as const) {
      for (const direction of ["faithful", "added", "lost"] as const) {
        test(`T118 ebf unit identity ${unit} ${preposition} ${alias} ${direction}`, async () => {
          const zh = direction === "added" ? "按订单核算" : `按${unit}核算`;
          const en = direction === "lost" ? "Calculated by order" : `Calculated ${preposition} ${alias}`;
          const source = `MOQ：${zh}。`;
          const operations = [{ op: "replace_commercial_terms" as const, terms: [{ id: "alias", kind: "moq" as const, value: { zh, en } }] }];
          const parsed = aiIntentResponseSchema.parse({ type: "edit", summary: "Finite unit identity", operations });
          if (parsed.type !== "edit") throw new Error("Expected an edit response");
          const checked = validateAIOperations(source, parsed.operations, templates);
          if (evidenceRoot) await writeFile(path.join(evidenceRoot, `ebf-unit-${alias}-${preposition}-${direction}.json`), JSON.stringify({ source, operations, checked }, null, 2), "utf8");
          assert.deepEqual(checked.operations, direction === "faithful" ? operations : []);
          if (direction !== "faithful") assert.ok(checked.rejected.length > 0);
        });
      }
    }
  }
}

test("T118 ebf existing code/range/punctuation and lexical unit controls", () => {
  for (const spec of ["BT40", "S136/H13", "i=25–100", "7.31t"]) {
    const operations = [{ op: "replace_equipment" as const, equipment: [{ id: "boundary", name: { zh: "注塑机", en: "Injection machine" }, quantity: 37, spec: { zh: spec, en: `${spec}.` } }] }];
    const parsed = aiIntentResponseSchema.parse({ type: "edit", summary: "Known numeric boundary", operations });
    if (parsed.type !== "edit") throw new Error("Expected an edit response");
    assert.deepEqual(validateAIOperations(`设备：注塑机37台（${spec}）。`, parsed.operations, templates).operations, operations);
  }
  for (const [kind, zh, en] of [["payment", "30%订金，70%尾款", "30% deposit; 70% balance"], ["moq", "KG编号", "KG code"], ["moq", "T型检查", "T-shaped inspection"]] as const) {
    const source = `${kind === "payment" ? "付款方式" : "MOQ"}：${zh}。`;
    const operations = [{ op: "replace_commercial_terms" as const, terms: [{ id: "boundary", kind, value: { zh, en } }] }];
    const parsed = aiIntentResponseSchema.parse({ type: "edit", summary: "Known prose boundary", operations });
    if (parsed.type !== "edit") throw new Error("Expected an edit response");
    assert.deepEqual(validateAIOperations(source, parsed.operations, templates).operations, operations);
  }
});

test("T118 ebf isolated provider/commit preserves complete context and unit identities", async () => {
  process.env.DEEPSEEK_API_KEY = "sk-t118-ebf-not-real";
  process.env.DEEPSEEK_BASE_URL = "https://t118-stub.test.invalid";
  process.env.DEEPSEEK_MODEL = "t118-stub";
  for (const key of ["AI_API_KEY", "AI_BASE_URL", "AI_MODEL"]) delete process.env[key];
  const inputs = [
    { source: "MOQ：731件。", accepted: false, operation: { op: "replace_commercial_terms", terms: [{ id: "pipeline", kind: "moq", value: { zh: "731件", en: "+ \u034F 731 pieces" } }] } },
    { source: "质检流程：抽检，抽查\u0338 731件。", accepted: false, operation: { op: "replace_quality_process", steps: [{ id: "pipeline", title: { zh: "抽检", en: "Sampling" }, body: { zh: "抽查\u0338 731件", en: "Inspect 731 pieces" } }] } },
    { source: "产能：按订单排产。", accepted: false, operation: { op: "replace_commercial_terms", terms: [term("按订单排产", "Capacity is planned in pcs")] } },
    { source: "产能：按t核算。", accepted: false, operation: { op: "replace_commercial_terms", terms: [term("按t核算", "Capacity follows orders")] } },
    { source: "产能：按t核算。", accepted: true, operation: { op: "replace_commercial_terms", terms: [term("按t核算", "Capacity is calculated in t")] } },
  ];
  for (const [index, input] of inputs.entries()) {
    const siteId = `t118-ebf-pipeline-${index}`;
    const before = await createSite(siteId);
    const oldFetch = globalThis.fetch;
    const oldWarn = console.warn;
    const logs: string[] = [];
    let calls = 0;
    globalThis.fetch = async (url) => {
      assert.equal(String(url), "https://t118-stub.test.invalid/chat/completions");
      calls += 1;
      return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ type: "edit", summary: "Finite context and unit control", operations: [input.operation] }) } }] }));
    };
    console.warn = (...values: unknown[]) => { logs.push(values.map(String).join(" ")); };
    let result;
    try {
      result = await requestStructuredOperations({ message: input.source, draft: before.draft, templateId: "screwfast" });
    } finally {
      globalThis.fetch = oldFetch;
      console.warn = oldWarn;
    }
    assert.ok(result.ok && result.type === "edit");
    const committed = await commitOperations({ siteId, baseRevision: before.draft.revision, operations: result.operations, summary: "Finite context and unit control", source: "ai" });
    const saved = (await getExistingSite(siteId))!;
    if (evidenceRoot) await writeFile(path.join(evidenceRoot, `ebf-pipeline-${index}.json`), JSON.stringify({ input, result, calls, logs, committed, saved }, null, 2), "utf8");
    assert.equal(calls, 1);
    assert.equal(committed.status, input.accepted ? "applied" : "no_change");
    if (!input.accepted) {
      assert.deepEqual(saved.draft, before.draft);
      assert.deepEqual(saved.history, before.history);
    } else {
      assert.deepEqual(saved.draft.content.commercialTerms, input.operation.terms);
      assert.equal((await moveHistory(siteId, "undo")).status, "applied");
      assert.deepEqual((await getExistingSite(siteId))?.draft.content.commercialTerms, []);
    }
  }
});

const cases = [
  { id: "annual-monthly", zh: ZH, en: "Annual mold output about 180 molds; monthly injection capacity about 6 million pieces", accept: true },
  { id: "compact-chinese", zh: "模具年产约180套；月注塑能力约600万件", en: EN, accept: true },
  { id: "equipment-in-same-sentence", zh: WITH_EQUIPMENT, en: "About 180 molds per year; 42 injection machines (90–800 t), about 6 million parts per month", accept: true },
  { id: "equipment-set-alias", zh: WITH_EQUIPMENT, en: "About 180 molds per year; 42 sets (90–800 t), about 6 million parts per month", accept: true },
  { id: "thousand-separators", zh: ZH, en: "About 180 molds per year; about 6,000,000 pieces per month", accept: true },
  { id: "yearly-monthly", zh: ZH, en: "Yearly output about 180 moulds; monthly capacity approximately 6 million pcs", accept: true },
  { id: "swapped-cycles", zh: ZH, en: "About 180 molds per month; about 6 million pieces per year", accept: false },
  { id: "swapped-output-units", zh: ZH, en: "About 180 pieces per year; about 6,000,000 molds per month", accept: false },
  { id: "swapped-quantities", zh: ZH, en: "About 6 million molds per year; about 180 pieces per month", accept: false },
  { id: "wrong-181", zh: ZH, en: "About 181 molds per year; about 6 million pieces per month", accept: false },
  { id: "wrong-day", zh: ZH, en: "About 180 molds per day; about 6 million pieces per month", accept: false },
  { id: "approximation-lost", zh: ZH, en: "180 molds per year; 6 million pieces per month", accept: false },
  { id: "one-approximation-lost", zh: ZH, en: "About 180 molds per year; 6 million pieces per month", accept: false },
  { id: "added-maximum", zh: ZH, en: "Up to about 180 molds per year; about 6 million pieces per month", accept: false },
  { id: "missing-cycle", zh: ZH, en: "About 180 molds; about 6 million pieces per month", accept: false },
  { id: "extra-cycle", zh: ZH, en: "About 180 molds per year per month; about 6 million pieces per month", accept: false },
  { id: "unattached-prefix-cycle", zh: ZH, en: "Per month about 180 molds per year; about 6 million pieces per month", accept: false },
  { id: "negative-approximation", zh: ZH, en: "Not about 180 molds per year; about 6 million pieces per month", accept: false },
  { id: "converted-annual", zh: ZH, en: "About 15 molds per month; about 72 million pieces per year", accept: false },
  { id: "equipment-source-inventory-only", zh: "注塑机 42 台（90–800 t）", en: "42 injection machines (90–800 t)", accept: true },
  { id: "inventory-borrows-month", zh: "注塑机 42 台（90–800 t）", en: "42 injection machines per month (90–800 t)", accept: false },
  { id: "inventory-borrows-output-unit", zh: "注塑机 42 台（90–800 t）", en: "42 injection pieces (90–800 t)", accept: false },
  { id: "equipment-borrows-cycle", zh: WITH_EQUIPMENT, en: "About 180 molds; 42 injection machines per year (90–800 t), about 6 million parts per month", accept: false },
  { id: "chinese-subject-swap", zh: "注塑件年产约 180 套；月模具能力约 600 万件", en: EN, accept: false },
  { id: "chinese-truncated-qualifier", zh: "模具年产180套；月注塑能力约600万件", en: "180 molds per year; about 6 million pieces per month", accept: false },
  { id: "extra-code", zh: ZH, en: `${EN}; DAP`, accept: false },
  { id: "unquantified-capacity", source: "产能：按订单确认。", zh: "按订单确认", en: "Capacity is confirmed per order", accept: true },
  { id: "quantity-without-cycle", source: "产能：约 275 套。", zh: "约 275 套", en: "About 275 sets", accept: true },
  { id: "quantity-without-unit-or-cycle", source: "产能：约 275。", zh: "约 275", en: "About 275", accept: true },
  { id: "unquantified-monthly", source: "产能：每月按订单确认。", zh: "每月按订单确认", en: "Monthly capacity is confirmed per order", accept: true },
  { id: "unquantified-annual", source: "产能：年产能按订单确认。", zh: "年产能按订单确认", en: "Annual capacity is confirmed per order", accept: true },
  { id: "invented-cycle-for-quantity", source: "产能：约 275 套。", zh: "约 275 套", en: "About 275 sets per year", accept: false },
  { id: "invented-quantity", source: "产能：按订单确认。", zh: "按订单确认", en: "Capacity is confirmed per order, about 275 sets", accept: false },
  { id: "invented-unit", source: "产能：约 275。", zh: "约 275", en: "About 275 pieces", accept: false },
  { id: "invented-cycle-unquantified", source: "产能：按订单确认。", zh: "按订单确认", en: "Monthly capacity is confirmed per order", accept: false },
  { id: "lost-cycle-unquantified", source: "产能：每月按订单确认。", zh: "每月按订单确认", en: "Capacity is confirmed per order", accept: false },
] as const;

if (evidenceRoot) {
  await mkdir(evidenceRoot, { recursive: true });
  await writeFile(path.join(evidenceRoot, "independent-inputs.json"), JSON.stringify({ origin: "synthetic controls, not recovered model output", source: SOURCE, cases }, null, 2), "utf8");
}

for (const example of cases) {
  test(`T118 ${example.id}: source-derived ${example.accept ? "accept" : "refuse"} through isolated commit`, async () => {
    const siteId = `t118-${example.id}`;
    const before = await createSite(siteId);
    const source = "source" in example ? example.source : SOURCE;
    const checked = validateAIOperations(wrapCompanyMaterials(`资料性质：模拟。\n${source}`), [{ op: "replace_commercial_terms", terms: [term(example.zh, example.en)] }], templates, before.draft);
    const committed = await commitOperations({ siteId, baseRevision: before.draft.revision, operations: checked.operations, summary: "T118 isolated synthetic control", source: "ai" });
    const reread = await getExistingSite(siteId);
    if (evidenceRoot) await writeFile(path.join(evidenceRoot, `${example.id}.json`), JSON.stringify({ source, input: example, checked, committedStatus: committed.status, reread }, null, 2), "utf8");
    assert.equal(committed.status, example.accept ? "applied" : "no_change", `${example.id}: ${checked.rejected.join("; ")}`);
    assert.deepEqual(reread?.draft.content.commercialTerms, example.accept ? [term(example.zh, example.en)] : []);
    if (example.id === "equipment-source-inventory-only") {
      // This truthful subset is accepted without claiming that either rate was
      // covered. T110 reconciles source completeness separately across the draft.
      const retained = reread!.draft.content.commercialTerms[0].value;
      assert.ok(!retained.zh.includes("180") && !retained.zh.includes("600"));
      assert.ok(!retained.en.includes("180") && !retained.en.includes("6 million"));
    }
    if (!example.accept) assert.ok(checked.rejected.length > 0, "a refusal must have a reason");
    if (example.accept) {
      const undone = await moveHistory(siteId, "undo");
      assert.equal(undone.status, "applied");
      assert.deepEqual((await getExistingSite(siteId))?.draft.content.commercialTerms, []);
    }
  });
}

// Independent Astra inputs from artifacts/t118/astra-5f7570c, copied before
// repairing 5f7570c. Expected acceptance comes from source facts, not this parser.
const astraPositionCases = [
  {"id":"unit-missing","kind":"capacity","source":"产能：年产约 217。","zh":"年产约 217","en":"About 217 per year","expectedAccept":true},
  {"id":"unit-invented","kind":"capacity","source":"产能：年产约 217。","zh":"年产约 217","en":"About 217 sets per year","expectedAccept":false},
  {"id":"comparison-between-quantity-unit","kind":"capacity","source":"产能：年产 217 套。","zh":"年产 217 套","en":"217 fewer sets per year","expectedAccept":false},
  {"id":"negation-between-quantity-unit","kind":"capacity","source":"产能：年产 217 套。","zh":"年产 217 套","en":"217 or fewer sets per year","expectedAccept":false},
  {"id":"bound-suffix-lost","kind":"capacity","source":"产能：年产 217 套以上。","zh":"年产 217 套以上","en":"217 sets per year","expectedAccept":false},
  {"id":"bound-suffix-equivalent","kind":"capacity","source":"产能：年产 217 套以上。","zh":"年产 217 套以上","en":"At least 217 sets per year","expectedAccept":true},
  {"id":"chinese-negative-lost","kind":"capacity","source":"产能：年产不足 217 套。","zh":"年产不足 217 套","en":"217 sets per year","expectedAccept":false},
  {"id":"chinese-negative-equivalent","kind":"capacity","source":"产能：年产不足 217 套。","zh":"年产不足 217 套","en":"Less than 217 sets per year","expectedAccept":true},
  {"id":"whitespace-token","kind":"capacity","source":"产能：年产约 217 套。","zh":"年 产 约 217 套","en":"About 217 sets per year","expectedAccept":true},
  {"id":"english-unit-control","kind":"capacity","source":"产能：年产 217 台。","zh":"年产 217 台","en":"217 units per year","expectedAccept":true},
  {"id":"english-suffix-bound-added","kind":"capacity","source":"产能：年产 217 台。","zh":"年产 217 台","en":"217 or fewer units per year","expectedAccept":false},
  {"id":"english-suffix-comparison-added","kind":"capacity","source":"产能：年产 217 台。","zh":"年产 217 台","en":"217 fewer units per year","expectedAccept":false},
  {"id":"english-suffix-bound-faithful","kind":"capacity","source":"产能：年产不超过 217 台。","zh":"年产不超过 217 台","en":"217 or fewer units per year","expectedAccept":true},
  {"id":"whitespace-token-wrong-number","kind":"capacity","source":"产能：年产约 217 套。","zh":"年 产 约 217 套","en":"About 218 sets per year","expectedAccept":false},
] as const;
for (const example of astraPositionCases) {
  test(`T118 Astra position ${example.id}: source-derived ${example.expectedAccept ? "accept" : "refuse"}`, async () => {
    const candidate = { id: example.id, kind: example.kind, value: { zh: example.zh, en: example.en } };
    const operations = [{ op: "replace_commercial_terms" as const, terms: [candidate] }];
    const checked = validateAIOperations(example.source, operations, templates);
    const siteId = `t118-astra-${example.id}`;
    const before = await createSite(siteId);
    const committed = await commitOperations({ siteId, baseRevision: before.draft.revision, operations: checked.operations, summary: "Independent Astra positional control", source: "ai" });
    const reread = await getExistingSite(siteId);
    if (evidenceRoot) await writeFile(path.join(evidenceRoot, `astra-position-${example.id}.json`), JSON.stringify({ input: example, checked, committedStatus: committed.status, reread }, null, 2), "utf8");
    assert.equal(committed.status, example.expectedAccept ? "applied" : "no_change");
    assert.deepEqual(reread?.draft.content.commercialTerms, example.expectedAccept ? [candidate] : []);
    if (!example.expectedAccept) {
      assert.ok(checked.rejected.length > 0);
      assert.deepEqual(checked.commercialTermRejections?.[0].term, candidate, "audit retains the original structured value, including internal whitespace");
    }
  });
}

// New independent Astra 050 inputs: preserve the source bound across positions.
const astra050Cases = [
  {"id":"suffix-upper","source":"产能：年产235套以内。","zh":"年产235套以内","en":"At most 235 sets per year","accept":true,"why":"后置上界","kind":"capacity"},
  {"id":"suffix-upper-drop","source":"产能：年产235套以内。","zh":"年产235套以内","en":"235 sets per year","accept":false,"why":"不能吞掉单位后的上界","kind":"capacity"},
  {"id":"english-post-upper","source":"产能：年产不超过235套。","zh":"年产不超过235套","en":"235 sets per year at most","accept":true,"why":"英文后置上界","kind":"capacity"},
];
for (const example of astra050Cases) {
  test(`T118 Astra 050 ${example.id}: source-derived ${example.accept ? "accept" : "refuse"}`, async () => {
    const candidate = term(example.zh, example.en);
    const before = await createSite(`t118-astra050-${example.id}`);
    const checked = validateAIOperations(example.source, [{ op: "replace_commercial_terms", terms: [candidate] }], templates, before.draft);
    const committed = await commitOperations({ siteId: `t118-astra050-${example.id}`, baseRevision: before.draft.revision, operations: checked.operations, summary: "Independent Astra 050 positional control", source: "ai" });
    if (evidenceRoot) await writeFile(path.join(evidenceRoot, `astra050-${example.id}.json`), JSON.stringify({ input: example, checked, committedStatus: committed.status }, null, 2), "utf8");
    assert.equal(committed.status, example.accept ? "applied" : "no_change");
    assert.deepEqual((await getExistingSite(`t118-astra050-${example.id}`))?.draft.content.commercialTerms, example.accept ? [candidate] : []);
    if (!example.accept) assert.ok(checked.rejected.length > 0);
  });
}

for (const count of [12, 13]) {
  test(`T118 matched clause diagnostic boundary ${count}: exact count and truncation`, async () => {
    const clauses = Array.from({ length: count }, (_, i) => `年产约${251 + i}套`);
    const zh = clauses.join("；");
    const candidate = term(zh, "1 set per year");
    const checked = validateAIOperations(`产能：${zh}。`, [{ op: "replace_commercial_terms", terms: [candidate] }], templates);
    if (evidenceRoot) await writeFile(path.join(evidenceRoot, `matched-clause-boundary-${count}.json`), JSON.stringify({ clauses, expectedCount: count, expectedTruncated: count === 13, checked }, null, 2), "utf8");
    assert.deepEqual(checked.operations, []);
    assert.ok(checked.rejected.length > 0);
    const fragment = checked.commercialTermRejections![0].sourceFragments[0];
    assert.equal(fragment.matchedClauses.length, 12);
    assert.equal(fragment.matchedClauseCount, count);
    assert.equal(fragment.matchedClausesTruncated, count === 13);
    assert.deepEqual(fragment.matchedClauses, clauses.slice(0, 12));
    assert.equal(fragment.truncated, false, "the short source text itself was not truncated");
  });
}

// Independent f8 Astra failures plus source-derived strict/inclusive controls.
// The excluding parenthesis is part of the numerical bound, not ordinary prose.
const exclusiveBoundaryCases = [
  {"id":"lower-strict-suffix-bad","source":"产能：月产 730 件以上（不含）。","zh":"月产 730 件以上（不含）","en":"At least 730 pieces monthly","accept":false},
  {"id":"lower-strict-suffix-good","source":"产能：月产 730 件以上（不含）。","zh":"月产 730 件以上（不含）","en":"More than 730 pieces monthly","accept":true},
  {"id":"upper-strict-suffix-bad","source":"产能：月产 730 件以下（不含）。","zh":"月产 730 件以下（不含）","en":"At most 730 pieces monthly","accept":false},
  {"id":"upper-strict-suffix-good","source":"产能：月产 730 件以下（不含）。","zh":"月产 730 件以下（不含）","en":"Less than 730 pieces monthly","accept":true},
  {"id":"ascii-exclusive-lower","source":"产能：月产730件以上(不含)。","zh":"月产730件以上(不含)","en":"More than 730 pieces monthly","accept":true},
  {"id":"ascii-exclusive-upper","source":"产能：月产730件以下(不含)。","zh":"月产730件以下(不含)","en":"Less than 730 pieces monthly","accept":true},
  {"id":"unresolved-exclusion","source":"产能：月产730件以上（不含本数）。","zh":"月产730件以上（不含本数）","en":"At least 730 pieces monthly","accept":false},
  {"id":"unbound-exclusion","source":"产能：月产730件（不含）。","zh":"月产730件（不含）","en":"730 pieces monthly","accept":false},
] as const;
for (const example of exclusiveBoundaryCases) {
  test(`T118 complete exclusive boundary ${example.id}: ${example.accept ? "accept" : "refuse"}`, async () => {
    const candidate = term(example.zh, example.en);
    const siteId = `t118-exclusion-${example.id}`;
    const before = await createSite(siteId);
    const checked = validateAIOperations(example.source, [{ op: "replace_commercial_terms", terms: [candidate] }], templates, before.draft);
    const committed = await commitOperations({ siteId, baseRevision: before.draft.revision, operations: checked.operations, summary: "Independent complete-boundary input", source: "ai" });
    const saved = await getExistingSite(siteId);
    if (evidenceRoot) await writeFile(path.join(evidenceRoot, `exclusion-${example.id}.json`), JSON.stringify({ input: example, checked, status: committed.status, saved }, null, 2), "utf8");
    assert.equal(committed.status, example.accept ? "applied" : "no_change");
    assert.deepEqual(saved?.draft.content.commercialTerms, example.accept ? [candidate] : []);
    if (!example.accept) assert.ok(checked.rejected.length > 0);
    if (example.id === "unresolved-exclusion" || example.id === "unbound-exclusion") assert.match(checked.rejected.join(" "), /否定|限定/);
  });
}

test("T118 rates and numerical bounds are generic, with qualifiers attached to each amount", () => {
  const source = "产能：每年不少于 275 套；每月最多 320 万件。";
  const zh = "每年不少于 275 套；每月最多 320 万件";
  const check = (en: string) => validateAIOperations(source, [{ op: "replace_commercial_terms", terms: [term(zh, en)] }], templates, structuredClone(defaultDraft));
  assert.equal(check("At least 275 sets per year; up to 3.2 million pieces per month").operations.length, 1);
  assert.equal(check("Not less than 275 sets per year; not more than 3.2 million pieces per month").operations.length, 1);
  assert.equal(check("Up to 275 sets per year; at least 3.2 million pieces per month").operations.length, 0);
  assert.equal(check("275 sets per year; 3.2 million pieces per month").operations.length, 0);
});

// The source operator is the independent oracle: >, <=, >= and < are distinct.
// Negation applies to the whole numeric comparison, not an interior word.
const negatedBoundCases = [
  { id: "greater-vs-no-more", zh: "每年生产超过 200 套模具", en: "No more than 200 molds per year", accept: false },
  { id: "greater-faithful", zh: "每年生产超过 200 套模具", en: "More than 200 molds per year", accept: true },
  { id: "greater-vs-no-less", zh: "每年生产超过 200 套模具", en: "No less than 200 molds per year", accept: false },
  { id: "maximum-no-more", zh: "每年生产不超过 200 套模具", en: "No more than 200 molds per year", accept: true },
  { id: "maximum-not-more", zh: "每年生产不超过 200 套模具", en: "Not more than 200 molds per year", accept: true },
  { id: "maximum-vs-more", zh: "每年生产不超过 200 套模具", en: "More than 200 molds per year", accept: false },
  { id: "minimum-no-less", zh: "每年生产不少于 200 套模具", en: "No less than 200 molds per year", accept: true },
  { id: "minimum-not-less", zh: "每年生产不少于 200 套模具", en: "Not less than 200 molds per year", accept: true },
  { id: "minimum-vs-less", zh: "每年生产不少于 200 套模具", en: "Less than 200 molds per year", accept: false },
  { id: "less-vs-no-less", zh: "每年生产少于 200 套模具", en: "No less than 200 molds per year", accept: false },
  { id: "less-faithful", zh: "每年生产少于 200 套模具", en: "Less than 200 molds per year", accept: true },
  { id: "less-vs-not-less", zh: "每年生产少于 200 套模具", en: "Not less than 200 molds per year", accept: false },
  { id: "controller-less-vs-not-under", zh: "每年生产少于 200 套模具", en: "Not under 200 molds per year", accept: false },
  { id: "controller-exact-vs-no-greater", zh: "每年生产 200 套模具", en: "No greater than 200 molds per year", accept: false },
  { id: "minimum-not-under", zh: "每年生产不少于 200 套模具", en: "Not under 200 molds per year", accept: true },
  { id: "maximum-no-greater", zh: "每年生产不超过 200 套模具", en: "No greater than 200 molds per year", accept: true },
] as const;
for (const example of negatedBoundCases) {
  test(`T118 negated bound ${example.id}: source-derived ${example.accept ? "accept" : "refuse"}`, async () => {
    const message = `【公司资料】\n产能：${example.zh}。`;
    const candidate = { ...term(example.zh, example.en), id: "capacity-negation-probe" };
    const operations = [{ op: "replace_commercial_terms" as const, terms: [candidate] }];
    // Match the controller's pure call, including its lack of a draft argument.
    const checked = validateAIOperations(message, operations, new Set(["screwfast"]));
    if (evidenceRoot) await writeFile(path.join(evidenceRoot, `negated-bound-${example.id}.json`), JSON.stringify({ message, operations, expectedAcceptance: example.accept, checked }, null, 2), "utf8");
    assert.deepEqual(checked.operations, example.accept ? operations : [], `${example.id}: ${checked.rejected.join("; ")}`);
    if (!example.accept) assert.ok(checked.rejected.length > 0, "a wrong bound must be explicitly refused");
  });
}

// Independent mathematical families: negating > gives <=; negating < gives >=.
// Vary only the comparison phrase; amount, output unit and cycle remain fixed.
const comparisonFamilies = [
  { words: ["more than", "greater than", "over", "above"], positive: "每年生产超过 275 套模具", negated: "每年生产不超过 275 套模具" },
  { words: ["less than", "fewer than", "under", "below"], positive: "每年生产少于 275 套模具", negated: "每年生产不少于 275 套模具" },
] as const;
for (const family of comparisonFamilies) {
  for (const word of family.words) {
    for (const negator of ["", "no ", "not "]) {
      const phrase = `${negator}${word}`;
      test(`T118 comparison family ${phrase}: source bound and its opposite`, async () => {
        const correctZh = negator ? family.negated : family.positive;
        const wrongZh = negator ? family.positive : family.negated;
        const en = `${phrase} 275 molds per year`;
        const check = (zh: string) => validateAIOperations(`产能：${zh}。`, [{ op: "replace_commercial_terms", terms: [term(zh, en)] }], templates);
        const correct = check(correctZh);
        const wrong = check(wrongZh);
        if (evidenceRoot) await writeFile(path.join(evidenceRoot, `scope-${phrase.replaceAll(" ", "-")}.json`), JSON.stringify({ correctSource: correctZh, wrongSource: wrongZh, en, expectedCorrectAcceptance: true, expectedWrongAcceptance: false, correct, wrong }, null, 2), "utf8");
        assert.deepEqual(correct.operations, [{ op: "replace_commercial_terms", terms: [term(correctZh, en)] }]);
        assert.deepEqual(wrong.operations, []);
        assert.ok(wrong.rejected.length > 0);
      });
    }
  }
}

const inclusiveScopeCases = [
  { zh: "每年生产不少于 275 套模具", en: "Greater than or equal to 275 molds per year" },
  { zh: "每年生产不超过 275 套模具", en: "Fewer than or equal to 275 molds per year" },
  { zh: "每年生产少于 275 套模具", en: "Not greater than or equal to 275 molds per year" },
  { zh: "每年生产超过 275 套模具", en: "Not fewer than or equal to 275 molds per year" },
  { zh: "每年生产少于 275 套模具", en: "Not at least 275 molds per year" },
  { zh: "每年生产超过 275 套模具", en: "Not at most 275 molds per year" },
] as const;
for (const example of inclusiveScopeCases) {
  test(`T118 whole inclusive comparison scope: ${example.en}`, () => {
    const checked = validateAIOperations(`产能：${example.zh}。`, [{ op: "replace_commercial_terms", terms: [term(example.zh, example.en)] }], templates);
    assert.deepEqual(checked.operations, [{ op: "replace_commercial_terms", terms: [term(example.zh, example.en)] }]);
  });
}

const unresolvedNegations = [
  { zh: "每年生产 200 套模具", en: "Not necessarily under 200 molds per year" },
  { zh: "每年生产 200 套模具", en: "Never above 200 molds per year" },
  { zh: "每年生产 200 套模具", en: "Without a maximum of 200 molds per year" },
  { zh: "每年生产 200 套模具", en: "Not not under 200 molds per year" },
  { zh: "每年生产 200 套模具", en: "200 molds per year; not under" },
  { zh: "每年生产超过 200 套模具", en: "Not up to 200 molds per year" },
  { zh: "每年生产少于 200 套模具", en: "No minimum of 200 molds per year" },
  { zh: "每年生产超过 200 套模具", en: "No maximum of 200 molds per year" },
] as const;
for (const { zh, en } of unresolvedNegations) {
  test(`T118 unresolved negation refuses with a reason: ${en}`, async () => {
    const checked = validateAIOperations(`产能：${zh}。`, [{ op: "replace_commercial_terms", terms: [term(zh, en)] }], templates);
    if (evidenceRoot) await writeFile(path.join(evidenceRoot, `unresolved-${en.replaceAll(" ", "-").replaceAll(";", "")}.json`), JSON.stringify({ source: zh, en, expectedAcceptance: false, expectedReason: "unresolved negation scope", checked }, null, 2), "utf8");
    assert.deepEqual(checked.operations, []);
    assert.match(checked.rejected.join(" "), /否定/, "an unsupported negation needs its own refusal reason");
  });
}

test("T118 update_commercial_term preserves refusal and the previous committed capacity", async () => {
  const siteId = "t118-update";
  const before = await createSite(siteId);
  const seed = validateAIOperations(SOURCE, [{ op: "replace_commercial_terms", terms: [term(ZH, EN)] }], templates, before.draft);
  const first = await commitOperations({ siteId, baseRevision: before.draft.revision, operations: seed.operations, summary: "source capacity", source: "ai" });
  assert.equal(first.status, "applied");
  const saved = (await getExistingSite(siteId))!;
  const badValue = { zh: ZH, en: "About 180 pieces per year; about 6,000,000 molds per month" };
  const checked = validateAIOperations(SOURCE, [{ op: "update_commercial_term", termId: "capacity", value: badValue }], templates, saved.draft);
  const second = await commitOperations({ siteId, baseRevision: saved.draft.revision, operations: checked.operations, summary: "bad capacity", source: "ai" });
  assert.equal(second.status, "no_change");
  assert.deepEqual((await getExistingSite(siteId))?.draft.content.commercialTerms, [term(ZH, EN)]);
});

test("T118 provider refusal audit retains the raw structured value, failure and source basis only", async () => {
  // No network/model requests: every fetch is intercepted and unexpected URLs throw.
  process.env.DEEPSEEK_API_KEY = "sk-t118-not-real-secret";
  process.env.DEEPSEEK_BASE_URL = "https://t118-stub.test.invalid";
  process.env.DEEPSEEK_MODEL = "t118-stub";
  for (const key of ["AI_API_KEY", "AI_BASE_URL", "AI_MODEL"]) delete process.env[key];
  const raw = term(` ${ZH} `, " About 180 pieces per year; about 6 million molds per month ");
  const reasoning = "T118-private-reasoning-not-to-record";
  const summary = "T118-untrusted-summary-not-to-record";
  const unrelated = "T118-unrelated-company-material-not-to-record";
  const oldFetch = globalThis.fetch;
  const oldWarn = console.warn;
  const lines: string[] = [];
  globalThis.fetch = async (input) => {
    assert.equal(String(input), "https://t118-stub.test.invalid/chat/completions");
    return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ type: "edit", summary, operations: [{ op: "replace_commercial_terms", terms: [raw] }] }), reasoning_content: reasoning } }] }), { headers: { "x-ds-trace-id": "t118-synthetic-trace", "x-test-private-header": "T118-private-header-not-to-record" } });
  };
  console.warn = (...args: unknown[]) => { lines.push(args.map(String).join(" ")); };
  let result;
  try {
    result = await requestStructuredOperations({ message: `${SOURCE}\n${unrelated}`, draft: structuredClone(defaultDraft), templateId: "screwfast" });
  } finally {
    globalThis.fetch = oldFetch;
    console.warn = oldWarn;
  }
  if (evidenceRoot) await writeFile(path.join(evidenceRoot, "provider-audit.json"), JSON.stringify({ origin: "intercepted synthetic response", lines, result }, null, 2), "utf8");
  assert.equal(result.ok, true);
  assert.ok(result.ok && result.type === "edit" && result.operations.length === 0);
  assert.equal(lines.length, 1, "one bounded provider validation record");
  const audit = JSON.parse(lines[0].slice(lines[0].indexOf("{")));
  assert.deepEqual(audit.rejections[0].term, raw, "preserve raw spaces too");
  assert.ok(audit.rejections[0].failedChecks.includes("capacity_relation"));
  assert.equal(audit.rejections[0].operationIndex, 0);
  assert.equal(audit.rejections[0].sourceFragments[0].source, SOURCE.slice(0, -1));
  for (const excluded of [process.env.DEEPSEEK_API_KEY!, reasoning, summary, unrelated, "T118-private-header-not-to-record", "Authorization", "Bearer"]) assert.ok(!lines[0].includes(excluded), `unexpected audit content: ${excluded}`);
  assert.ok(lines[0].length < 12000, "bounded single-entry record");
  assert.ok(!JSON.stringify(result).includes(raw.value.en), "raw refusal is not product output");
  assert.ok(result.ok && result.type === "edit");
  const before = await createSite("t118-provider-audit");
  const committed = await commitOperations({ siteId: "t118-provider-audit", baseRevision: before.draft.revision, operations: result.operations, summary: "refused synthetic capacity", source: "ai" });
  assert.equal(committed.status, "no_change");
  assert.deepEqual((await getExistingSite("t118-provider-audit"))?.draft.content.commercialTerms, []);
  assert.ok(!(await readFile(path.join(isolatedRoot, ".sitecraft-data", "sites", "t118-provider-audit.json"), "utf8")).includes(raw.value.en), "refusal is not a trusted draft fact");
});


// 44053fd live refusal regression: literals from the saved original materials,
// capacity-only diagnostic and before record. Not the unknown first T110 value.
// Failure modes: equivalent spelling refused; year/month ownership swapped;
// approximation dropped; unknown modifier/tail consumed. The source facts and
// finite grammar contract supply the expected verdicts, not parser output.
const liveHyphenMaterials = "资料性质：模拟。不可当作真实企业。核验记号：P3T-JD5K。\n公司名：宁海精密注塑模具P3T\n行业：注塑模具与精密注塑件 / 内销与外贸\n目标：获取模具开发与批量注塑询盘，内销与出口并行\n首屏可用事实：精密注塑模具与注塑件 P3T-JD5K。\n首屏说明：模具设计、试模到批量注塑在同一厂区完成，内销与出口订单并行。\n主按钮：提交图纸获取报价\n公司简介：宁海精密注塑模具P3T 从事塑料注塑模具设计制造与精密注塑件生产。工厂有模具车间和注塑车间，按图纸或样品开模，并承接批量注塑。内销与出口订单并行，出口以欧洲和东南亚为主。\n沿革：2008 年 建厂，从模具维修和小型模具起步；2013 年 注塑车间投产；2017 年 开始承接出口订单；2021 年 新增恒温精密模具车间；2024 年 建成三坐标与影像测量室。\n产品：多腔热流道模具；双色注塑模具；精密结构注塑件；透明光学注塑件；金属嵌件注塑件。\n多腔热流道模具规格参数：型腔数 1–32 腔；模具尺寸 最大 900×1200 mm；模具钢材 S136/H13/NAK80；热流道 开放式/针阀式；成型周期 12–40 s；模具寿命 50–100 万模次；型腔公差 ±0.01 mm。\n双色注塑模具规格参数：成型方式 旋转式/机械手转移；适配机型 双色注塑机 120–650 t；材料组合 PC+TPU/PP+TPE/ABS+PC；包胶厚度 ≥0.8 mm；配合公差 ±0.02 mm；模具寿命 30–50 万模次。\n精密结构注塑件规格参数：适用材料 PA66+GF/POM/PBT/PC；单件重量 0.5–350 g；尺寸公差 ±0.02 mm；平面度 ≤0.05 mm；表面处理 咬花/喷砂/高光；成型机台 90–800 t。\n透明光学注塑件规格参数：适用材料 PMMA/PC/COC；透光率 ≥90%（PMMA 2 mm 厚）；壁厚 0.8–6 mm；表面粗糙度 Ra ≤0.02 μm；成型环境 十万级洁净车间；尺寸公差 ±0.03 mm。\n金属嵌件注塑件规格参数：嵌件类型 铜螺母/冲压端子/不锈钢轴；嵌件放置 机械手/人工；适用材料 PBT+GF/PA6/LCP；定位精度 ±0.05 mm；尺寸公差 ±0.03 mm；成型机台 立式 55–250 t。\n产能：模具年产约 180 套；注塑机 42 台（90–800 t），月注塑能力约 600 万件。\n加工能力/主设备：高速 CNC 加工中心 12 台；精密慢走丝线切割 6 台；镜面电火花 8 台；精密平面磨床 4 台；注塑机 42 台（90–800 t）；双色注塑机 3 台。\n检测设备：三坐标测量机；二次元影像测量仪；色差仪；拉力试验机；恒温恒湿箱。\n质检流程：来料检验（树脂批次与嵌件尺寸）；试模后首件全尺寸检测；过程巡检每 2 小时抽检；外观与功能全检；出货抽检并附检测报告。\n应用行业：家电外壳与结构件；汽车内饰件与连接器；医疗器械耗材外壳；照明透镜与灯罩；电动工具壳体。\n认证状态：ISO 9001 已有；ISO 14001 已有；IATF 16949 认证中。\n问：没有图纸只有样品能开模吗？答：可以，先做 3D 扫描和逆向建模，图纸确认后再开模。\n问：开模周期多久？答：单腔模具约 25–35 天，多腔热流道和双色模具约 40–55 天，从图纸确认开始计。\n问：试模样品怎么提供？答：T1 试模后 3 天内寄出样品和全尺寸检测报告，每套模具含 3 次试模。\n问：模具归谁所有？答：模具费付清后模具归买方所有，可存放在本厂用于批量生产。\n问：出口订单用什么贸易条款？答：常用 FOB 宁波和 EXW，也可按订单约定 CIF。\nMOQ：注塑件 5000 件起；模具单套起接。\n交期：模具 25–55 天；批量注塑件在模具确认后 15–20 天。\n邮箱：rfq@p3t-sim.test\n客户名单、评价：资料未提供。\n页面：首页、产品、生产与质检、常见问题、联系；当前模板不支持的独立页面须说明，不得假装已经开通。";
const liveHyphenMessage = "只恢复当前原站缺失的两条产能事实，并同时写入准确的中英文：模具年产约 180 套（approximately 180 mold sets per year）；月注塑能力约 600 万件（approximately 6 million injection-molded pieces per month）。保留约数含义、原有精度、单位和年/月周期，不补其他事实。只在商业条款末尾新增产能条款承载这两条事实，不把注塑机数量或规格再写成产能。保留全部原条款的 IDs、kind、顺序和所有已有中英文值，逐字不改；保留其余全部资料、产品、设备、质检、沿革、联系方式、页面、样子、配色、布局、样式及六张已有照片与引用，不重生成、不换站、不换样子、不改写其他文案。下方是未经改写的完整原公司资料，本轮也作为原条款的事实来源；资料中的其他事实仅供核验，不重复更新已保留的字段。资料性质和核验记号不新增到页面。\n\n【完整原资料】\n资料性质：模拟。不可当作真实企业。核验记号：P3T-JD5K。\n公司名：宁海精密注塑模具P3T\n行业：注塑模具与精密注塑件 / 内销与外贸\n目标：获取模具开发与批量注塑询盘，内销与出口并行\n首屏可用事实：精密注塑模具与注塑件 P3T-JD5K。\n首屏说明：模具设计、试模到批量注塑在同一厂区完成，内销与出口订单并行。\n主按钮：提交图纸获取报价\n公司简介：宁海精密注塑模具P3T 从事塑料注塑模具设计制造与精密注塑件生产。工厂有模具车间和注塑车间，按图纸或样品开模，并承接批量注塑。内销与出口订单并行，出口以欧洲和东南亚为主。\n沿革：2008 年 建厂，从模具维修和小型模具起步；2013 年 注塑车间投产；2017 年 开始承接出口订单；2021 年 新增恒温精密模具车间；2024 年 建成三坐标与影像测量室。\n产品：多腔热流道模具；双色注塑模具；精密结构注塑件；透明光学注塑件；金属嵌件注塑件。\n多腔热流道模具规格参数：型腔数 1–32 腔；模具尺寸 最大 900×1200 mm；模具钢材 S136/H13/NAK80；热流道 开放式/针阀式；成型周期 12–40 s；模具寿命 50–100 万模次；型腔公差 ±0.01 mm。\n双色注塑模具规格参数：成型方式 旋转式/机械手转移；适配机型 双色注塑机 120–650 t；材料组合 PC+TPU/PP+TPE/ABS+PC；包胶厚度 ≥0.8 mm；配合公差 ±0.02 mm；模具寿命 30–50 万模次。\n精密结构注塑件规格参数：适用材料 PA66+GF/POM/PBT/PC；单件重量 0.5–350 g；尺寸公差 ±0.02 mm；平面度 ≤0.05 mm；表面处理 咬花/喷砂/高光；成型机台 90–800 t。\n透明光学注塑件规格参数：适用材料 PMMA/PC/COC；透光率 ≥90%（PMMA 2 mm 厚）；壁厚 0.8–6 mm；表面粗糙度 Ra ≤0.02 μm；成型环境 十万级洁净车间；尺寸公差 ±0.03 mm。\n金属嵌件注塑件规格参数：嵌件类型 铜螺母/冲压端子/不锈钢轴；嵌件放置 机械手/人工；适用材料 PBT+GF/PA6/LCP；定位精度 ±0.05 mm；尺寸公差 ±0.03 mm；成型机台 立式 55–250 t。\n产能：模具年产约 180 套；注塑机 42 台（90–800 t），月注塑能力约 600 万件。\n加工能力/主设备：高速 CNC 加工中心 12 台；精密慢走丝线切割 6 台；镜面电火花 8 台；精密平面磨床 4 台；注塑机 42 台（90–800 t）；双色注塑机 3 台。\n检测设备：三坐标测量机；二次元影像测量仪；色差仪；拉力试验机；恒温恒湿箱。\n质检流程：来料检验（树脂批次与嵌件尺寸）；试模后首件全尺寸检测；过程巡检每 2 小时抽检；外观与功能全检；出货抽检并附检测报告。\n应用行业：家电外壳与结构件；汽车内饰件与连接器；医疗器械耗材外壳；照明透镜与灯罩；电动工具壳体。\n认证状态：ISO 9001 已有；ISO 14001 已有；IATF 16949 认证中。\n问：没有图纸只有样品能开模吗？答：可以，先做 3D 扫描和逆向建模，图纸确认后再开模。\n问：开模周期多久？答：单腔模具约 25–35 天，多腔热流道和双色模具约 40–55 天，从图纸确认开始计。\n问：试模样品怎么提供？答：T1 试模后 3 天内寄出样品和全尺寸检测报告，每套模具含 3 次试模。\n问：模具归谁所有？答：模具费付清后模具归买方所有，可存放在本厂用于批量生产。\n问：出口订单用什么贸易条款？答：常用 FOB 宁波和 EXW，也可按订单约定 CIF。\nMOQ：注塑件 5000 件起；模具单套起接。\n交期：模具 25–55 天；批量注塑件在模具确认后 15–20 天。\n邮箱：rfq@p3t-sim.test\n客户名单、评价：资料未提供。\n页面：首页、产品、生产与质检、常见问题、联系；当前模板不支持的独立页面须说明，不得假装已经开通。";
const liveHyphenCandidate: CommercialTerm = {
  "id": "capacity",
  "kind": "capacity",
  "value": {
    "zh": "模具年产约 180 套；月注塑能力约 600 万件",
    "en": "Approximately 180 mold sets per year; approximately 6 million injection-molded pieces per month"
  }
};
// The diagnostic saved only capacity. These three terms are from the before
// record; the assembled synthetic payload is NOT the complete model response.
const liveHyphenOldTerms: CommercialTerm[] = [
  {
    "id": "moq",
    "kind": "moq",
    "value": {
      "zh": "注塑件 5000 件起；模具单套起接",
      "en": "Molded parts from 5,000 pcs; molds from one set"
    }
  },
  {
    "id": "lead-time",
    "kind": "lead_time",
    "value": {
      "zh": "模具 25–55 天；批量注塑件在模具确认后 15–20 天",
      "en": "Molds 25–55 days; volume molded parts 15–20 days after mold approval"
    }
  },
  {
    "id": "trade-terms",
    "kind": "trade_terms",
    "value": {
      "zh": "常用 FOB 宁波和 EXW，也可按订单约定 CIF",
      "en": "Usually FOB Ningbo and EXW, CIF by order agreement"
    }
  }
];
const liveHyphenCases = [
  { id: "space", en: "Approximately 180 mold sets per year; approximately 6 million injection molded pieces per month", accept: true },
  { id: "saved-hyphen", en: liveHyphenCandidate.value.en, accept: true },
  { id: "cycles-swapped", en: "Approximately 180 mold sets per month; approximately 6 million injection-molded pieces per year", accept: false },
  { id: "approximation-dropped", en: "Approximately 180 mold sets per year; 6 million injection-molded pieces per month", accept: false },
  { id: "unknown-modifier", en: "Approximately 180 mold sets per year; approximately 6 million precision injection-molded pieces per month", accept: false },
  { id: "unknown-tail", en: "Approximately 180 mold sets per year; approximately 6 million injection-molded pieces per month guaranteed", accept: false },
] as const;

for (const input of liveHyphenCases) {
  test(`T118 live hyphen ${input.id}: source-derived ${input.accept ? "accept" : "refuse"}`, async () => {
    const candidate = { ...liveHyphenCandidate, value: { zh: liveHyphenCandidate.value.zh, en: input.en } };
    const operations = [{ op: "replace_commercial_terms" as const, terms: [candidate] }];
    const checked = validateAIOperations(liveHyphenMaterials, operations, templates, structuredClone(defaultDraft));
    if (evidenceRoot) await writeFile(path.join(evidenceRoot, `live-hyphen-${input.id}.json`), JSON.stringify({ input, materials: liveHyphenMaterials, operations, checked }, null, 2), { encoding: "utf8", flag: "wx" });
    assert.deepEqual(checked.operations, input.accept ? operations : [], `${input.id}: ${checked.rejected.join("; ")}`);
    if (!input.accept) {
      assert.ok(checked.rejected.length);
      const diagnostic = checked.commercialTermRejections![0];
      assert.deepEqual(diagnostic.term, candidate);
      assert.equal(diagnostic.sourceMatches, true);
      assert.ok(diagnostic.failedChecks.length, "explicit failure conditions accompany every refusal");
      if (input.id.startsWith("unknown-")) assert.ok(diagnostic.failedChecks.includes("english_capacity_parse"));
      if (input.id.startsWith("unknown-")) assert.ok(diagnostic.parseEvidence.en.residuals.length, "unknown words remain unconsumed");
    }
  });
}

test("T118 live hyphen synthetic loopback provider → real chat export → nonempty FS and undo", async (t) => {
  const { createServer } = await import("node:http");
  const { POST } = await import("../app/api/sites/[siteId]/chat/route.ts");
  let payload: unknown;
  let calls = 0;
  const server = createServer(async (request, response) => {
    for await (const _chunk of request) { /* drain the local provider request */ }
    assert.equal(request.url, "/chat/completions");
    assert.equal(request.method, "POST");
    calls += 1;
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(payload) } }] }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  process.env.DEEPSEEK_API_KEY = "t118-loopback-only-synthetic";
  process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${address.port}`;
  process.env.DEEPSEEK_MODEL = "t118-synthetic";
  for (const key of ["AI_API_KEY", "AI_BASE_URL", "AI_MODEL"]) delete process.env[key];
  const realFetch = globalThis.fetch;
  // Refuse any outbound URL before network I/O. No original-site API is used.
  globalThis.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    assert.equal(url, `${process.env.DEEPSEEK_BASE_URL}/chat/completions`);
    return realFetch(input, init);
  };
  const previousWarn = console.warn;
  const audits: string[] = [];
  console.warn = (...args: unknown[]) => { audits.push(args.map(String).join(" ")); };
  try {
    for (const input of liveHyphenCases) await t.test(input.id, async () => {
      const siteId = `t118-live-hyphen-${input.id}`;
      const initial = await createSite(siteId);
      const seed = validateAIOperations(liveHyphenMaterials, [{ op: "replace_commercial_terms", terms: liveHyphenOldTerms }], templates, initial.draft);
      assert.deepEqual(seed.operations, [{ op: "replace_commercial_terms", terms: liveHyphenOldTerms }], "original before terms must validate without modifying source");
      const seeded = await commitOperations({ siteId, baseRevision: initial.draft.revision, operations: seed.operations, summary: "Isolated original-term seed", source: "ai" });
      assert.equal(seeded.status, "applied");
      const before = (await getExistingSite(siteId))!;
      const file = path.join(isolatedRoot, ".sitecraft-data", "sites", `${siteId}.json`);
      const beforeBytes = await readFile(file, "utf8");
      const candidate = { ...liveHyphenCandidate, value: { zh: liveHyphenCandidate.value.zh, en: input.en } };
      payload = { type: "edit", summary: "Synthetic capacity-only recovery", operations: [{ op: "replace_commercial_terms", terms: [...liveHyphenOldTerms, candidate] }] };
      const callsBefore = calls;
      const auditsBefore = audits.length;
      const response = await POST(new Request(`http://127.0.0.1/isolated/${siteId}/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ baseRevision: before.draft.revision, message: liveHyphenMessage }) }), { params: Promise.resolve({ siteId }) });
      const raw = await response.text();
      const events = raw.split("\n\n").filter((line) => line.startsWith("data: ")).map((line) => JSON.parse(line.slice(6)));
      const done = events.at(-1);
      const after = (await getExistingSite(siteId))!;
      const afterBytes = await readFile(file, "utf8");
      const undo = done?.status === "applied" ? await moveHistory(siteId, "undo") : null;
      const undone = await getExistingSite(siteId);
      const undoBytes = await readFile(file, "utf8");
      if (evidenceRoot) {
        await writeFile(path.join(evidenceRoot, `live-hyphen-chat-${input.id}.response.raw`), raw, { encoding: "utf8", flag: "wx" });
        await writeFile(path.join(evidenceRoot, `live-hyphen-chat-${input.id}.json`), JSON.stringify({ scope: "Synthetic loopback provider and direct real POST export, not Next HTTP hosting or external model", input, payload, message: liveHyphenMessage, httpStatus: response.status, contentType: response.headers.get("content-type"), events, before, beforeBytes, after, afterBytes, undo, undone, undoBytes, providerCalls: calls - callsBefore, audits: audits.slice(auditsBefore) }, null, 2), { encoding: "utf8", flag: "wx" });
      }
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type")!, /^text\/event-stream/);
      assert.equal(calls - callsBefore, 1, "one synthetic provider call, no retries");
      assert.equal(events[0].type, "status");
      assert.equal(events.filter((event) => event.type === "done").length, 1);
      assert.equal(done.status, input.accept ? "applied" : "no_change");
      assert.deepEqual(JSON.parse(afterBytes).draft, after.draft);
      assert.deepEqual(after.draft.content.commercialTerms, input.accept ? [...liveHyphenOldTerms, candidate] : liveHyphenOldTerms);
      assert.deepEqual({ ...after.draft.content, commercialTerms: liveHyphenOldTerms }, before.draft.content, "other content stays unchanged");
      if (input.accept) {
        assert.equal(after.draft.revision, before.draft.revision + 1);
        assert.equal(after.history.length, before.history.length + 1);
        assert.ok(done.changeSet.appliedTargets.length);
        assert.equal(undo?.status, "applied");
        assert.deepEqual(undone?.draft.content, before.draft.content);
        assert.equal(undone?.draft.englishReady, before.draft.englishReady);
        assert.deepEqual(undone?.history, before.history);
        assert.deepEqual(JSON.parse(undoBytes).draft, undone?.draft);
        assert.deepEqual(audits.slice(auditsBefore), []);
      } else {
        assert.ok(done.rejected.length);
        assert.equal(afterBytes, beforeBytes, "refusal preserves nonempty FS record byte for byte");
        assert.deepEqual(after, before);
        assert.equal(audits.length - auditsBefore, 1);
        const audit = JSON.parse(audits.at(-1)!.slice(audits.at(-1)!.indexOf("{")));
        assert.deepEqual(audit.rejections[0].term, candidate);
        assert.equal(audit.rejections[0].sourceMatches, true);
      }
    });
  } finally {
    globalThis.fetch = realFetch;
    console.warn = previousWarn;
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

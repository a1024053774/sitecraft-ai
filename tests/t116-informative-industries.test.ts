import assert from "node:assert/strict";
import test from "node:test";
import { defaultDraft, normalizeDraft, visualBriefCatalog, type SiteDraft } from "../lib/site-document.ts";
import { applySiteOperations, validateAIOperations, siteOperationSchema, type SiteOperation } from "../lib/site-operations.ts";
import { composedPageForTemplate } from "../lib/blocks/compose.ts";
import { getTemplateAdapter } from "../lib/template-adapters/registry.ts";
import { installPreviewBridge } from "../lib/template-adapters/preview-bridge.ts";
import { expectedFacts, missingFacts } from "../scripts/published-facts.mjs";
import { parseHtmlDocument } from "./fixtures/html-dom.ts";
import { packDraft } from "./fixtures/pack-drafts.ts";

// Contract oracle: T-115's seven approved descriptions have no additional facts. Pharma is
// explicitly excluded. Failure cases: fixture filler, omitted copy becoming a required gap,
// invented applied slots, loss of an extra fact, locale coupling, and deletion outside industries.
const text = (zh: string, en: string) => ({ zh, en });
const empty = text("", "");
const gap = text("待补充", "To be provided");
const templateIds = new Set(["screwfast", "forge", "landwind", "tailwind-landing"]);
const entries = [
  { id: "name-only", title: text("矿山输送", "Mining conveyors"), body: empty },
  { id: "conditions", title: text("矿山输送", "Mining conveyors"), body: text("矿山输送：频繁重载启停，环境温度 −20–45 ℃，防护等级 IP65。", "Mining conveyors: frequent heavy-load starts and stops, ambient temperature −20–45 ℃, protection class IP65.") },
  { id: "material", title: text("化工取样", "Chemical sampling"), body: text("化工取样使用 316L 主体和 FKM 密封，额定压力 2.5 MPa。", "Chemical sampling uses a 316L body and FKM seals, rated pressure 2.5 MPa.") },
  { id: "uncertain", title: text("制药洁净流体", "Pharmaceutical clean fluids"), body: text("洁净流体接头用于制药回路。", "Fluid fittings for pharmaceutical circuits.") },
  { id: "one-locale", title: text("港口起重", "Port cranes"), body: text("", "Port cranes use IP65 housings.") },
  { id: "whitespace", title: text("食品饮料灌装", "Food and beverage filling"), body: text(" \t\n", " \n") },
  { id: "unknown", title: text("水泥窑传动", "Cement kiln drives"), body: gap },
];

function render(draft: SiteDraft, template: string, locale: "zh" | "en", variant: "workspace" | "published", targets: string[] = []) {
  const html = composedPageForTemplate(template);
  const adapter = getTemplateAdapter(template);
  assert.ok(html && adapter);
  const document = parseHtmlDocument(html);
  const globalObject: Record<string, unknown> = { document, parent: { postMessage() {} }, addEventListener() {} };
  globalObject.window = globalObject;
  const report = installPreviewBridge(globalObject, template, adapter).applyDeclaredContent(draft, locale, targets, variant, undefined, true);
  return { document, report };
}

test("T116 fixture assembly omits only the seven approved industry explanations", () => {
  const approved = {
    industrial: [["mining", "矿山输送", "Mining conveyors"], ["metallurgy", "冶金辊道", "Metallurgy rollers"], ["port", "港口起重", "Port cranes"], ["cement", "水泥窑传动", "Cement kiln drives"]],
    export: [["food", "食品饮料灌装", "Food and beverage filling"], ["chemical", "化工取样", "Chemical sampling"], ["semiconductor", "半导体超纯水辅助回路", "Semiconductor ultrapure water"]],
  };
  for (const pack of ["industrial", "export"] as const) {
    const industries = packDraft(pack).content.industries!;
    for (const [id, zh, en] of approved[pack]) {
      const item = industries.items.find(item => item.id === id);
      assert.ok(item);
      assert.deepEqual(item.title, text(zh, en));
      assert.deepEqual(item.body, empty, `${pack}/${id} is optional copy, not a missing fact`);
    }
  }
  const pharma = packDraft("export").content.industries!.items.find(item => item.id === "pharma");
  assert.deepEqual(pharma?.body, text("洁净流体接头用于制药回路。", "Fluid fittings for pharmaceutical circuits."));
});

test("T116 explicit empty industry copy has no paragraph or claimed body landing in either view", () => {
  for (const template of templateIds) for (const blockVariant of ["list", "cards"]) {
    const draft = { ...structuredClone(defaultDraft), templateId: template, visualBrief: structuredClone(visualBriefCatalog.find(brief => brief.templateId === template)!), blockVariants: { industries: blockVariant }, content: { ...structuredClone(defaultDraft.content), industries: { title: text("应用行业", "Industries"), intro: gap, items: entries } } } as SiteDraft;
    for (const locale of ["zh", "en"] as const) for (const variant of ["workspace", "published"] as const) {
      const { document, report } = render(draft, template, locale, variant);
      for (const item of entries) {
        const titleTarget = `industries.items.${item.id}.title.${locale}`;
        const bodyTarget = `industries.items.${item.id}.body.${locale}`;
        const heading = document.querySelector(`[data-sitecraft-slot="${titleTarget}"]`);
        const body = document.querySelector(`[data-sitecraft-slot="${bodyTarget}"]`);
        assert.ok(heading, `${template}/${blockVariant}/${variant}/${locale}/${item.id} retains its industry title`);
        if (item.body[locale].trim() === "") {
          assert.equal(body !== null, false, `${variant} must not turn intentional omission into a gap`);
          assert.equal(heading.closest("article")?.querySelectorAll("p").length, 0);
          assert.equal(report.appliedSlots.includes(bodyTarget), false, "an absent body has no actual DOM landing");
        } else if (item.id !== "unknown" || variant === "workspace") {
          assert.equal(body?.textContent, item.body[locale], "extra facts, uncertain copy, and actual gaps retain their existing semantics");
          assert.ok(report.appliedSlots.includes(bodyTarget));
        }
      }
      assert.deepEqual(report.missingSlots, []);
      const absent = `industries.items.name-only.body.${locale}`;
      const requested = render(draft, template, locale, variant, [absent]);
      assert.deepEqual(requested.report.missingSlots, [absent], "explicitly requesting a nonexistent body never produces fake coverage");
    }
  }
});

test("T116 existing operation and normalization preserve optional copy and undo both languages", () => {
  const original = packDraft("industrial");
  const section = { title: text("应用行业", "Industries"), intro: gap, items: entries };
  const operation: SiteOperation = { op: "set_catalog_section", section: "industries", value: section };
  const applied = applySiteOperations(original, [operation], { templateIds, lastChange: "T116 contract" });
  assert.deepEqual(normalizeDraft(applied.draft).content.industries, section);
  assert.deepEqual(applied.appliedTargets, ["content.industries"]);
  const undone = applySiteOperations(applied.draft, applied.inverseOperations, { templateIds, lastChange: "T116 undo" });
  assert.deepEqual(undone.draft.content.industries, original.content.industries);
  const redone = applySiteOperations(undone.draft, [operation], { templateIds, lastChange: "T116 redo" });
  assert.deepEqual(redone.draft.content.industries, section);
});

test("T116 facts remain required when descriptions contain titles, materials, numbers or codes", () => {
  const draft = { ...structuredClone(defaultDraft), content: { ...structuredClone(defaultDraft.content), industries: { title: text("应用行业", "Industries"), intro: gap, items: entries } } } as SiteDraft;
  for (const locale of ["zh", "en"] as const) {
    const facts = expectedFacts(draft, locale).filter((fact: { kind: string }) => fact.kind.startsWith("industries"));
    const readable = entries.map(item => `${item.title[locale]} ${item.id === "unknown" ? "" : item.body[locale]}`).join("\n");
    assert.deepEqual(missingFacts(facts, readable), []);
    for (const item of entries.filter(item => ["conditions", "material", "uncertain"].includes(item.id))) {
      assert.equal(missingFacts(facts, readable.replace(item.body[locale], "")).length, 1, `${item.id}: extra/uncertain copy is still a source obligation`);
    }
  }
});

test("T116 optional industry descriptions do not weaken the existing model fact gate", () => {
  const materials = "【公司资料】应用行业：矿山输送；化工取样使用 316L 主体和 FKM 密封，额定压力 2.5 MPa。\nChemical sampling uses a 316L body and FKM seals, rated pressure 2.5 MPa.";
  const validated = validateAIOperations(materials, [{ op: "set_catalog_section", section: "industries", value: { title: text("应用行业", "Industries"), intro: gap, items: [entries[0], entries[2], { id: "invented", title: text("矿山输送", "Mining conveyors"), body: text("矿山输送年产 9999 台。", "Mining conveyors: 9999 units per year.") }] } }], templateIds);
  const op = validated.operations[0];
  assert.ok(op?.op === "set_catalog_section" && op.value);
  assert.deepEqual(op.value.items[0].body, empty);
  assert.deepEqual(op.value.items[1].body, entries[2].body);
  assert.deepEqual(op.value.items[2].body, text("待补充", "待补充"));
  assert.ok(validated.rejected.length > 0);
});

test("T116 explicit blanks in other catalog sections keep their prior workspace gap behavior", () => {
  const draft = { ...structuredClone(defaultDraft), content: { ...structuredClone(defaultDraft.content), capabilities: { title: text("加工能力", "Capabilities"), intro: gap, items: [{ id: "cap", title: text("磨齿", "Grinding"), body: empty }] } } } as SiteDraft;
  const { document } = render(draft, "screwfast", "zh", "workspace");
  assert.equal(document.querySelector('[data-sitecraft-slot="capabilities.items.cap.body.zh"]')?.textContent, "待补充");
});

test("T116 model cleaning distinguishes explicit blanks, missing properties, and nonempty gap copy", () => {
  for (const section of ["industries", "capabilities", "certifications"] as const) {
    const items = [
      { id: "blank", title: text("矿山输送", "Mining conveyors"), body: text(" \t", "") },
      { id: "partial", title: text("矿山输送", "Mining conveyors"), body: text("", "For IP65 housings.") },
      { id: "gap", title: text("矿山输送", "Mining conveyors"), body: gap },
    ];
    const operation = { op: "set_catalog_section" as const, section, value: { title: text("区块", "Section"), intro: gap, items } };
    const validated = validateAIOperations("【公司资料】矿山输送。For IP65 housings.", [operation], templateIds);
    const op = validated.operations[0];
    assert.ok(op?.op === "set_catalog_section" && op.value);
    assert.deepEqual(op.value.items[0].body, section === "industries" ? empty : gap);
    assert.deepEqual(op.value.items[1].body, text(section === "industries" ? "" : "待补充", "For IP65 housings."));
    assert.deepEqual(op.value.items[2].body, gap, "nonempty gap markers do not become optional copy");
    for (const body of [undefined, null, { zh: "" }, { en: "" }]) {
      const malformed = { ...operation, value: { ...operation.value, items: [{ ...items[0], body }] } };
      assert.equal(siteOperationSchema.safeParse(malformed).success, false, "missing or invalid attributes remain schema failures");
    }
  }
});

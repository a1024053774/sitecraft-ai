import assert from "node:assert/strict";
import test from "node:test";
import type { SiteDraft } from "../lib/site-document.ts";
import { installPreviewBridge } from "../lib/template-adapters/preview-bridge.ts";
import { getTemplateAdapter } from "../lib/template-adapters/registry.ts";
import { parseHtmlDocument } from "./fixtures/html-dom.ts";
import { packDraft } from "./fixtures/pack-drafts.ts";

// T-095 (Astra r2): a block is rendered into only when its section node, its block entity and its grid
// each exist exactly once and the entity names a variant the block declares. A stray grid marker is
// not a block: nothing is written into it and no target is reported as applied. No variant is guessed
// (rows is never assumed for an entity that has no data-sc-variant). Same rule for 商业条款 and 设备.

const text = (zh: string, en: string) => ({ zh, en });
function draft(): SiteDraft {
  const base = packDraft("molding");
  base.content.equipment = [
    { id: "cnc", name: text("高速 CNC 加工中心", "CNC"), quantity: 12, spec: null },
    { id: "cmm", name: text("三坐标测量机", "CMM"), quantity: null, spec: null },
  ] as typeof base.content.equipment;
  base.content.commercialTerms = [{ id: "moq", kind: "moq", value: text("5000 件起", "From 5,000 pcs") }] as typeof base.content.commercialTerms;
  return base;
}

const BLOCKS = [
  { block: "equipment", section: "equipment", grid: "data-sitecraft-equipment-grid", variant: "rows", applied: /^equipment/ },
  { block: "commercialTerms", section: "commercialTerms", grid: "data-sitecraft-commercial-terms-grid", variant: "rows", applied: /^commercialTerms/ },
] as const;

function run(html: string) {
  const adapter = getTemplateAdapter("screwfast");
  assert.ok(adapter?.blocks);
  const document = parseHtmlDocument(`<!doctype html><html><body>${html}</body></html>`);
  const globalObject: Record<string, unknown> = { document, parent: { postMessage() {} }, addEventListener() {} };
  globalObject.window = globalObject;
  const report = installPreviewBridge(globalObject, "screwfast", adapter).applyDeclaredContent(draft(), "zh", [], "published");
  return { document, report };
}

for (const spec of BLOCKS) {
  const grid = `<div ${spec.grid}></div>`;
  const cases: Array<[string, string]> = [
    ["a grid marker alone", grid],
    ["a section node and a grid, no block entity", `<section data-sitecraft-section="${spec.section}">${grid}</section>`],
    ["a block entity without data-sc-variant", `<section data-sitecraft-section="${spec.section}" data-sc-block="${spec.block}">${grid}</section>`],
    ["a block entity with an undeclared variant", `<section data-sitecraft-section="${spec.section}" data-sc-block="${spec.block}" data-sc-variant="poster">${grid}</section>`],
    ["a duplicated grid", `<section data-sitecraft-section="${spec.section}" data-sc-block="${spec.block}" data-sc-variant="${spec.variant}">${grid}${grid}</section>`],
    ["a duplicated block entity", `<section data-sitecraft-section="${spec.section}" data-sc-block="${spec.block}" data-sc-variant="${spec.variant}">${grid}</section><div data-sc-block="${spec.block}" data-sc-variant="${spec.variant}"></div>`],
  ];
  for (const [label, html] of cases) {
    test(`${spec.block}: ${label} is never filled and reports no applied target`, () => {
      const { document, report } = run(html);
      for (const node of document.querySelectorAll(`[${spec.grid}]`)) assert.equal(node.children.length, 0, "the stray grid stays empty");
      // "<block>.visibility" is the separate, declared section-visibility mechanism (adapter.sections), not the block render.
      assert.deepEqual(report.appliedSlots.filter((slot: string) => spec.applied.test(slot) && !slot.endsWith(".visibility")), [], "no target of the block is reported as applied");
      assert.equal(document.querySelectorAll(".sitecraft-equipment-item, .sitecraft-commercial-term").length, 0, "no item was written anywhere");
    });
  }
  test(`${spec.block}: a complete declared entity is still filled`, () => {
    const { document, report } = run(`<section data-sitecraft-section="${spec.section}" data-sc-block="${spec.block}" data-sc-variant="${spec.variant}">${grid}</section>`);
    assert.ok(document.querySelectorAll(`[${spec.grid}] > *`).length > 0, "items were written");
    assert.ok(report.appliedSlots.some((slot: string) => spec.applied.test(slot)), "targets are reported as applied");
  });
}

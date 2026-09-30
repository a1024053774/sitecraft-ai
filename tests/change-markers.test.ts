import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { applySiteOperations } from "../lib/site-operations.ts";
import { installPreviewBridge } from "../lib/template-adapters/preview-bridge.ts";
import { getTemplateAdapter } from "../lib/template-adapters/registry.ts";
import { changeTargetLabels } from "../lib/workspace-copy.ts";
import { parseHtmlDocument } from "./fixtures/html-dom.ts";
import { servedHomeHtml } from "./fixtures/look-pages.ts";
import { packDraft, withLayouts } from "./fixtures/pack-drafts.ts";

// T-053 (Astra, review of 1c9d606): the preview bridge reports blockVariants.<block> as applied for
// every block it mounted, the look's defaults included. That report means "on the page now" and only
// confirms that a change's targets landed. The workspace's change markers (本次修改：…) name what the
// change wrote: the change set's appliedTargets from the server, never the bridge's report. So a
// change to the hero title on a page with a comparison table is not described as a layout change.

const templateIds = new Set(["forge", "screwfast", "landwind", "tailwind-landing"]);

test("a change that only edits the hero title writes no layout, so its markers name no layout", () => {
  const draft = withLayouts(packDraft("industrial"), { products: "compare" });
  const result = applySiteOperations(draft, [{ op: "set_text", target: "hero.title", value: { zh: "重载减速机，按图加工", en: "Heavy-duty gearboxes, built to drawing" } }], { templateIds, lastChange: "test" });
  assert.deepEqual(result.appliedTargets, ["hero.title.zh", "hero.title.en"]);
  assert.deepEqual(changeTargetLabels(result.appliedTargets).filter((label) => label.includes("布局")), []);
  assert.deepEqual(result.draft.blockVariants, { products: "compare" });
});

test("a layout change names only the block it changed", () => {
  const result = applySiteOperations(packDraft("industrial"), [{ op: "set_block_variant", block: "products", variant: "compare" }], { templateIds, lastChange: "test" });
  assert.deepEqual(result.appliedTargets, ["blockVariants.products"]);
  assert.deepEqual(changeTargetLabels(result.appliedTargets), ["产品布局"]);
});

test("the bridge reports every mounted block, and that confirms a change without naming it", () => {
  const adapter = getTemplateAdapter("screwfast");
  assert.ok(adapter);
  const document = parseHtmlDocument(servedHomeHtml("screwfast"));
  const globalObject: Record<string, unknown> = { document, parent: { postMessage() {} }, addEventListener() {} };
  globalObject.window = globalObject;
  const draft = withLayouts(packDraft("industrial"), { products: "compare" });
  const report = installPreviewBridge(globalObject, "screwfast", adapter).applyDeclaredContent(draft, "zh", ["hero.title.zh"], "workspace");
  for (const block of ["hero", "products", "contact"]) assert.ok(report.appliedSlots.includes(`blockVariants.${block}`), `${block} is on the page`);
  assert.deepEqual(report.missingSlots, [], "the hero title change is confirmed");
});

test("the workspace builds its change markers from the change set, not from the preview report", () => {
  const source = readFileSync(new URL("../app/workspace/page.tsx", import.meta.url), "utf8");
  const calls = [...source.matchAll(/setLastChangedTargets\(([^;]*)\);/g)].map((match) => match[1]);
  assert.ok(calls.length >= 2);
  for (const call of calls) assert.match(call, /history\?\.\[0\]\?\.appliedTargets|appliedTargets\)$/, call);
  const start = source.indexOf("const handlePreviewReport");
  const end = source.indexOf("\n  };\n", start);
  const handler = source.slice(start, end);
  assert.ok(start > 0 && end > start);
  assert.doesNotMatch(handler, /setLastChangedTargets|changeTargetLabels/, "the preview report only confirms, it does not name the change");
});

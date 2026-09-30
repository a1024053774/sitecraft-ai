import assert from "node:assert/strict";
import test from "node:test";
import { heroFragment } from "../lib/blocks/fragments/hero.ts";
import { engineeringLook } from "../lib/blocks/looks/engineering.ts";
import { installPreviewBridge } from "../lib/template-adapters/preview-bridge.ts";
import { getTemplateAdapter } from "../lib/template-adapters/registry.ts";
import { cssRules, type CssRule } from "./fixtures/css-rules.ts";
import { parseHtmlDocument, parseHtmlFragment, visibleText } from "./fixtures/html-dom.ts";
import { servedHomeHtml } from "./fixtures/look-pages.ts";
import { packDraft, withLayouts } from "./fixtures/pack-drafts.ts";

// T-053 final blind review: in 大标题加参数条 the full-width black spec band read as a separate
// decorative band, cut off from the products (P3E judged slightly worse than the old page). The owner's
// design: the specs sit inside the content container, left-aligned with the title, as a light panel
// (surface colour, 1px border, a 2px accent line on top) with small muted labels and bold values;
// the title is one step smaller; title, buttons and specs are one group, the panel about 32px under
// the button row; two columns by two rows at 768 and two columns at 375; long values wrap by the
// existing break rules.

const rules = { wide: cssRules(heroFragment.css), narrow: cssRules(heroFragment.narrow ?? ""), phone: cssRules(heroFragment.phone ?? "") };
const rule = (list: CssRule[], selector: string) => list.find((item) => item.selector === selector);
const has = (list: CssRule[], selector: string, declaration: string) => {
  const found = rule(list, selector);
  assert.ok(found, `a rule for ${selector}`);
  assert.ok(found.declarations.includes(declaration), `${selector}: ${found.declarations.join("; ")} (wanted ${declaration})`);
};

test("the spec panel sits in the title's container, after the button row, not in a band of its own", () => {
  const fragment = parseHtmlFragment(heroFragment.variants.statement);
  const title = fragment.querySelector("h1");
  const panel = fragment.querySelector("[data-sitecraft-hero-specs]");
  assert.ok(title && panel);
  const container = title.closest(".sitecraft-container");
  assert.ok(container, "the title is in the content container");
  assert.equal(panel.closest(".sitecraft-container"), container, "the specs are in the same container as the title");
  assert.equal(panel.parentElement, container);
  const children = container.children;
  assert.ok(children.indexOf(panel) > children.findIndex((child) => child.getAttribute("class") === "sitecraft-statement-foot"), "after the button row");
  assert.equal(panel.getAttribute("class"), "sitecraft-statement-specs", "not the dark full-width band");
  assert.equal(panel.querySelector("dl")?.getAttribute("class") ?? null, null, "the list is not a second container");
});

test("a light panel: surface colour, 1px border, 2px accent line on top, about 32px under the buttons", () => {
  has(rules.wide, ".sitecraft-statement-specs", "margin-top: 32px");
  has(rules.wide, ".sitecraft-statement-specs", "background: var(--site-surface)");
  has(rules.wide, ".sitecraft-statement-specs", "border: var(--site-rule)");
  has(rules.wide, ".sitecraft-statement-specs", "border-top: 2px solid var(--site-accent)");
  const statement = [...rules.wide, ...rules.narrow, ...rules.phone].filter((item) => item.selector.includes("sitecraft-statement"));
  for (const item of statement) {
    assert.ok(!item.declarations.some((declaration) => /^background(-color)?:.*var\(--site-ink\)/.test(declaration)), `${item.selector} has no dark background`);
    assert.ok(!item.declarations.some((declaration) => /^color: #fff/.test(declaration)), `${item.selector} has no white text`);
  }
});

test("small muted labels, bold values that wrap by the break rules", () => {
  has(rules.wide, ".sitecraft-statement-specs .sitecraft-hero-spec dt", "font-size: 12px");
  has(rules.wide, ".sitecraft-statement-specs .sitecraft-hero-spec dt", "color: var(--site-muted)");
  // A long label (直角减速机 · 额定输出扭矩) breaks at its spaces, not one character from the end.
  has(rules.wide, ".sitecraft-statement-specs .sitecraft-hero-spec dt", "word-break: keep-all");
  has(rules.wide, ".sitecraft-statement-specs .sitecraft-hero-spec dt", "overflow-wrap: anywhere");
  has(rules.wide, ".sitecraft-statement-specs .sitecraft-hero-spec dd", "font-weight: 700");
  has(rules.wide, ".sitecraft-statement-specs .sitecraft-hero-spec dd", "color: var(--site-ink)");
  has(rules.wide, ".sitecraft-statement-specs .sitecraft-hero-spec dd", "overflow-wrap: anywhere");
});

test("the title is one step smaller than the 76px it had", () => {
  has(rules.wide, ".sitecraft-statement h1", "font-size: var(--site-h1-display)");
  const size = /^clamp\((\d+)px, ([\d.]+)vw, (\d+)px\)$/.exec(engineeringLook.tokens["--site-h1-display"] ?? "");
  assert.ok(size, engineeringLook.tokens["--site-h1-display"]);
  const [, min, fluid, max] = size.map(Number);
  assert.ok(max >= 60 && max <= 68, `largest size ${max}px`);
  assert.ok(fluid < 5.6 && min < 34, `fluid ${fluid}vw, smallest ${min}px`);
  const h1 = /^clamp\((\d+)px, ([\d.]+)vw, (\d+)px\)$/.exec(engineeringLook.tokens["--site-h1"] ?? "");
  assert.ok(h1 && max > Number(h1[3]), "still larger than the split layout's title");
});

test("four specs in a row, two columns by two rows at 768, two columns at 375", () => {
  has(rules.wide, ".sitecraft-statement-specs dl", "grid-auto-flow: column");
  has(rules.narrow, ".sitecraft-statement-specs dl", "grid-template-columns: repeat(2, minmax(0, 1fr))");
  has(rules.narrow, ".sitecraft-statement-specs dl", "grid-auto-flow: row");
  const phoneList = rule(rules.phone, ".sitecraft-statement-specs dl");
  assert.ok(!phoneList || !phoneList.declarations.some((declaration) => /grid-template-columns: 1fr$/.test(declaration)), "phones keep the two columns");
});

test("the bridge fills the panel in place: four specs, label and value, inside the title's container", () => {
  const adapter = getTemplateAdapter("screwfast");
  assert.ok(adapter);
  const document = parseHtmlDocument(servedHomeHtml("screwfast"));
  const globalObject: Record<string, unknown> = { document, parent: { postMessage() {} }, addEventListener() {} };
  globalObject.window = globalObject;
  installPreviewBridge(globalObject, "screwfast", adapter).applyDeclaredContent(withLayouts(packDraft("export"), { hero: "statement" }), "zh", [], "published");
  const panel = document.querySelector("[data-sitecraft-hero-specs]");
  assert.ok(panel && !panel.hidden);
  assert.ok(panel.closest(".sitecraft-statement"), "inside the statement container");
  const cells = panel.querySelectorAll(".sitecraft-hero-spec");
  assert.equal(cells.length, 4);
  assert.deepEqual(cells.map((cell) => [visibleText(cell.querySelector("dt")!).trim(), visibleText(cell.querySelector("dd")!).trim()])[0], ["快换接头 · 通径", "DN8–DN25"]);
});

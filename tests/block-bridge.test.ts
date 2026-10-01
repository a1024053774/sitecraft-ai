import assert from "node:assert/strict";
import test from "node:test";
import { blockCatalog, layoutBlocks } from "../lib/blocks/catalog.ts";
import { composedPageForTemplate } from "../lib/blocks/compose.ts";
import { brightLook, engineeringLook } from "../lib/blocks/looks/index.ts";
import { visualBriefCatalog, type SiteDraft } from "../lib/site-document.ts";
import { applySiteOperations } from "../lib/site-operations.ts";
import { simulatedPacks } from "../lib/simulated-packs.ts";
import { installPreviewBridge } from "../lib/template-adapters/preview-bridge.ts";
import { getTemplateAdapter } from "../lib/template-adapters/registry.ts";
import type { TemplateAdapter } from "../lib/template-adapters/types.ts";
import { draftWithFixtureProducts } from "./fixtures/draft-with-products.ts";
import { HtmlDocument, parseHtmlDocument, visibleText } from "./fixtures/html-dom.ts";

// T-053: the real preview bridge on the real composed page. The bridge mounts one variant per
// block from its <template> before it writes slots, so every declared selector hits one node.

function install(document: HtmlDocument, adapter: TemplateAdapter) {
  const globalObject: Record<string, unknown> = { document, parent: { postMessage() {} }, addEventListener() {} };
  globalObject.window = globalObject;
  return installPreviewBridge(globalObject, adapter.templateId, adapter);
}

function engineeringPage() {
  const html = composedPageForTemplate("screwfast");
  assert.ok(html, "screwfast must be composed from the block library");
  const adapter = getTemplateAdapter("screwfast");
  assert.ok(adapter?.blocks);
  const document = parseHtmlDocument(html);
  return { document, adapter, api: install(document, adapter) };
}

const gap = { zh: "待补充", en: "To be provided" };

function packDraft(): SiteDraft {
  const pack = simulatedPacks.industrial;
  return applySiteOperations(structuredClone(draftWithFixtureProducts), [
    { op: "set_visual_brief", briefId: "engineering-industrial" },
    { op: "set_text", target: "companyName", value: pack.companyName },
    { op: "set_text", target: "hero.title", value: { zh: pack.heroTitle, en: "Heavy-duty gearboxes machined to drawing" } },
    { op: "set_text", target: "hero.subtitle", value: { zh: pack.heroSubtitle, en: "Bulk specification inquiries only." } },
    { op: "set_text", target: "contact.email", value: pack.email },
    {
      op: "replace_products",
      products: [
        {
          sku: "RA", name: { zh: "直角减速机", en: "Right-angle gearbox" }, summary: { zh: "按图加工的直角减速机。", en: "Right-angle gearbox to drawing." },
          category: { zh: "直角减速机", en: "Right-angle" }, status: "published", imageColor: "#d7e7d1",
          specs: [
            { name: { zh: "速比范围", en: "Ratio range" }, value: "i=25–100" },
            { name: { zh: "额定输出扭矩", en: "Rated output torque" }, value: "8500 N·m" },
            { name: { zh: "输入转速", en: "Input speed" }, value: "≤1500 r/min" },
          ],
        },
        {
          sku: "PL", name: { zh: "行星减速机", en: "Planetary gearbox" }, summary: { zh: "法兰安装的行星减速机。", en: "Flange-mounted planetary gearbox." },
          category: { zh: "行星减速机", en: "Planetary" }, status: "published", imageColor: "#e6e1cf",
          specs: [
            { name: { zh: "速比范围", en: "Ratio range" }, value: "i=4–100" },
            { name: { zh: "防护等级", en: "Protection" }, value: "IP65" },
          ],
        },
      ],
    },
    {
      op: "set_catalog_section",
      section: "industries",
      value: { title: { zh: "应用行业", en: "Industries" }, intro: gap, items: [
        { id: "mining", title: { zh: "矿山输送", en: "Mining conveyors" }, body: gap },
        { id: "port", title: { zh: "港口起重", en: "Port cranes" }, body: gap },
      ] },
    },
  ], { templateIds: new Set(visualBriefCatalog.map((item) => item.templateId)), lastChange: "block-bridge" }).draft;
}

test("the engineering page renders a pack draft with one entity per block and every slot on one node", () => {
  const { document, adapter, api } = engineeringPage();
  const draft = packDraft();
  const report = api.applyDeclaredContent(draft, "zh", ["companyName.zh", "hero.title.zh", "products"], "published");
  for (const block of layoutBlocks(engineeringLook)) {
    const entities = document.querySelectorAll(`[data-sc-block="${block}"]`);
    assert.equal(entities.length, 1, `${block} entity`);
    assert.equal(entities[0].getAttribute("data-sc-variant"), engineeringLook.defaults[block]);
    assert.ok(report.appliedSlots.includes(`blockVariants.${block}`), `${block} mount is reported`);
  }
  const mounted = new Set(layoutBlocks(engineeringLook).flatMap((block) => blockCatalog[block].variants[engineeringLook.defaults[block]].slots.map((slot) => slot.selector)));
  for (const slot of adapter.slots) {
    assert.equal(document.querySelectorAll(slot.selector).length, mounted.has(slot.selector) ? 1 : 0, `${slot.target} ${slot.selector}`);
  }
  assert.equal(document.querySelector('[data-sitecraft-brand="nav"]')?.textContent, simulatedPacks.industrial.companyName);
  assert.equal(document.querySelector('[data-sitecraft-brand="footer"]')?.textContent, simulatedPacks.industrial.companyName);
  assert.equal(document.querySelector('[data-sitecraft-benchmark="hero-title"]')?.textContent, simulatedPacks.industrial.heroTitle);
  assert.equal(document.querySelectorAll("[data-sitecraft-product]").length, 2);
  assert.equal(document.querySelectorAll('[data-sitecraft-catalog-grid="industries"] .sitecraft-catalog-card').length, 2);
  assert.equal(document.querySelector("[data-sitecraft-hero-nameplate]")?.hidden, false, "no photo: the key specs show as a nameplate");
  assert.deepEqual(report.missingSlots, []);
  const page = visibleText(document.body);
  assert.ok(page.includes("直角减速机"));
  assert.equal(page.includes("企业名称"), false, "placeholder brand must be replaced");
});

test("the bright product bridge mounts variants and reports section visibility back to navigation", () => {
  const html = composedPageForTemplate("forge");
  assert.ok(html, "forge must be composed from the block library");
  const adapter = getTemplateAdapter("forge");
  assert.ok(adapter?.blocks);
  const document = parseHtmlDocument(html);
  const api = install(document, adapter);
  const bright = applySiteOperations(packDraft(), [
    { op: "set_visual_brief", briefId: "industrial" },
    { op: "set_section_visibility", section: "industries", visible: false },
    { op: "set_section_visibility", section: "services", visible: false },
  ], { templateIds: new Set(visualBriefCatalog.map((item) => item.templateId)), lastChange: "bright-visibility" }).draft as SiteDraft & { blockVariants: Record<string, string> };
  bright.blockVariants = { products: "grouped", industries: "cards", capabilities: "cards", services: "cards", faq: "open", contact: "panel" };
  const report = api.applyDeclaredContent(bright, "zh", [], "published");
  assert.equal(document.querySelector('[data-sc-block="products"]')?.getAttribute("data-sc-variant"), "grouped");
  assert.equal(document.querySelector('[data-sitecraft-section="industries"]')?.getAttribute("data-sitecraft-section-hidden"), "true");
  assert.equal(document.querySelector('[data-sitecraft-nav="services"]')?.getAttribute("data-sitecraft-nav-hidden"), "true");
  assert.ok(report.appliedSlots.includes("industries.visibility"));
  assert.ok(report.appliedSlots.includes("blockVariants.products"));
});

test("every declared variant has unique live slots on both block-library looks", () => {
  for (const [templateId, look] of [["screwfast", engineeringLook], ["forge", brightLook]] as const) {
    const adapter = getTemplateAdapter(templateId);
    assert.ok(adapter?.blocks);
    for (const block of layoutBlocks(look)) {
      for (const variant of adapter.blocks.variants[block] ?? []) {
        const html = composedPageForTemplate(templateId);
        assert.ok(html);
        const document = parseHtmlDocument(html);
        const api = install(document, adapter);
        const raw = packDraft();
        const selected = templateId === "forge"
          ? applySiteOperations(raw, [{ op: "set_visual_brief", briefId: "industrial" }], { templateIds: new Set(["forge", "screwfast", "landwind", "tailwind-landing"]), lastChange: "bright-variant-slots" }).draft
          : raw;
        (selected as SiteDraft & { blockVariants: Record<string, string> }).blockVariants = { [block]: variant };
        api.applyDeclaredContent(selected, "zh", [], "published");
        for (const slot of blockCatalog[block].variants[variant].slots) assert.equal(document.querySelectorAll(slot.selector).length, 1, `${templateId} ${block}:${variant} ${slot.selector}`);
      }
    }
  }
});

test("without a block choice, and on thumbnails without a draft, the default entities stay in place", () => {
  const { document, api } = engineeringPage();
  const entities = () => layoutBlocks(engineeringLook).map((block) => document.querySelector(`[data-sc-block="${block}"]`));
  const before = entities();
  api.applyDeclaredContent(undefined, "zh", [], "thumbnail");
  assert.deepEqual(entities(), before, "a thumbnail must not rebuild the page");
  const draft = packDraft();
  api.applyDeclaredContent(draft, "zh", [], "workspace");
  api.applyDeclaredContent(draft, "zh", [], "workspace");
  assert.deepEqual(entities(), before, "re-sent content must not rebuild the page");
});

test("a block whose entity is gone is mounted again from its template and filled", () => {
  const { document, api } = engineeringPage();
  document.querySelector('[data-sc-block="hero"]')?.remove();
  assert.equal(document.querySelectorAll('[data-sc-block="hero"]').length, 0);
  const report = api.applyDeclaredContent(packDraft(), "zh", ["hero.title.zh"], "published");
  const hero = document.querySelectorAll('[data-sc-block="hero"]');
  assert.equal(hero.length, 1);
  assert.equal(hero[0].getAttribute("data-sc-variant"), "split");
  const main = document.querySelector("main");
  assert.equal(main?.children[0], hero[0], "the remounted hero keeps its place at the top of main");
  assert.equal(document.querySelector('[data-sitecraft-benchmark="hero-title"]')?.textContent, simulatedPacks.industrial.heroTitle);
  assert.ok(report.appliedSlots.includes("hero.title.zh"));
});

test("templates keep their placeholders: slot writes never reach a variant that is not mounted", () => {
  const { document, api } = engineeringPage();
  api.applyDeclaredContent(packDraft(), "zh", [], "published");
  const navTemplate = document.querySelector('template[data-sc-template="nav:bar"]');
  assert.ok(navTemplate?.content);
  assert.equal(navTemplate.content.querySelector('[data-sitecraft-brand="nav"]')?.textContent, "企业名称");
  const heroTemplate = document.querySelector('template[data-sc-template="hero:split"]');
  assert.equal(heroTemplate?.content?.querySelector('[data-sitecraft-benchmark="hero-title"]')?.textContent, "");
});

// Two variants of one block, the smallest page that shows switching.
const SWITCH_PAGE = `<!doctype html><html><head><title>t</title></head><body><main>
<section data-sc-block="demo" data-sc-variant="a"><h2 data-demo="a-title">A 占位</h2></section>
<template data-sc-template="demo:a"><section data-sc-block="demo" data-sc-variant="a"><h2 data-demo="a-title">A 占位</h2></section></template>
<template data-sc-template="demo:b"><section data-sc-block="demo" data-sc-variant="b"><h3 data-demo="b-title">B 占位</h3></section></template>
<footer data-demo="after">after</footer>
</main></body></html>`;

const SWITCH_ADAPTER: TemplateAdapter = {
  templateId: "sentinel-blocks",
  runtime: "static-html",
  slots: [
    { target: "hero.title", selector: '[data-demo="a-title"]', attr: "text" },
    { target: "hero.title", selector: '[data-demo="b-title"]', attr: "text" },
  ],
  blocks: { order: ["demo"], defaults: { demo: "a" }, variants: { demo: ["a", "b"] } },
};

function switchDraft(variant?: string) {
  return {
    revision: 3,
    companyName: "Sentinel",
    content: { hero: { title: { zh: "新标题", en: "New title" } } },
    ...(variant ? { blockVariants: { demo: variant } } : {}),
  };
}

test("mounting swaps a block's variant in place, starts from a clean copy and reports unknown choices", () => {
  const document = parseHtmlDocument(SWITCH_PAGE);
  const api = install(document, SWITCH_ADAPTER);
  const live = () => document.querySelectorAll('[data-sc-block="demo"]');
  const original = live()[0];

  api.applyDeclaredContent(switchDraft(), "zh", [], "workspace");
  assert.equal(live()[0], original, "no choice: the default entity stays");
  assert.equal(document.querySelector('[data-demo="a-title"]')?.textContent, "新标题");

  const toB = api.applyDeclaredContent(switchDraft("b"), "zh", ["blockVariants.demo", "hero.title.zh"], "workspace");
  assert.equal(live().length, 1);
  assert.equal(live()[0].getAttribute("data-sc-variant"), "b");
  assert.equal(document.querySelectorAll('[data-demo="a-title"]').length, 0, "the unselected variant leaves the page");
  assert.equal(document.querySelector('[data-demo="b-title"]')?.textContent, "新标题");
  assert.deepEqual(toB.missingSlots, []);
  assert.equal(document.querySelector("main")?.children[0], live()[0], "the new variant takes the old one's place");

  const mountedB = live()[0];
  mountedB.setAttribute("data-stale", "true");
  api.applyDeclaredContent(switchDraft("b"), "zh", [], "workspace");
  assert.equal(live()[0], mountedB, "the same choice re-sent does not rebuild the block");

  api.applyDeclaredContent(switchDraft("a"), "zh", [], "workspace");
  assert.notEqual(live()[0], original, "switching back mounts a fresh copy");
  assert.equal(document.querySelector('[data-demo="a-title"]')?.textContent, "新标题");
  api.applyDeclaredContent(switchDraft("b"), "zh", [], "workspace");
  assert.equal(live()[0].hasAttribute("data-stale"), false, "state from an earlier mount does not come back");
  assert.equal(document.querySelector('template[data-sc-template="demo:b"]')?.content?.querySelector('[data-demo="b-title"]')?.textContent, "B 占位");

  const unknown = api.applyDeclaredContent(switchDraft("zzz"), "zh", [], "workspace");
  assert.equal(live()[0].getAttribute("data-sc-variant"), "a", "an unknown choice falls back to the default");
  assert.ok(unknown.missingSlots.includes("blockVariants.demo"));
  assert.equal(unknown.appliedSlots.includes("blockVariants.demo"), false);
});

test("pages without block markup are left alone and report nothing about blocks", () => {
  const document = parseHtmlDocument('<!doctype html><html><head></head><body><h2 data-demo="a-title">A</h2></body></html>');
  const api = install(document, SWITCH_ADAPTER);
  const report = api.applyDeclaredContent(switchDraft("b"), "zh", [], "workspace");
  assert.equal(document.querySelector('[data-demo="a-title"]')?.textContent, "新标题");
  assert.equal(report.appliedSlots.some((slot) => slot.startsWith("blockVariants.")), false);
  assert.equal(report.missingSlots.some((slot) => slot.startsWith("blockVariants.")), false);
});

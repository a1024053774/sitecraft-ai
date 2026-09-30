import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { blockCatalog, layoutBlocks } from "../lib/blocks/catalog.ts";
import { composedPageForTemplate } from "../lib/blocks/compose.ts";
import { engineeringLook } from "../lib/blocks/looks/index.ts";
import { getTemplateAdapter } from "../lib/template-adapters/registry.ts";
import { cssRules, rootVariables, styleText, type CssRule } from "./fixtures/css-rules.ts";
import { HtmlElement, parseHtmlDocument, serializeNode, type HtmlNode } from "./fixtures/html-dom.ts";

// T-053 step 1: the engineering home page comes from the block library instead of the screwfast
// overlay. With only default variants the page must be the old page: same markup once the block
// markers are taken off, same CSS rules once the look tokens are read back as values.

const REPO_ROOT = process.cwd();
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const abs = path.join(REPO_ROOT, specifier.slice(2));
    let file = abs;
    if (existsSync(`${abs}.ts`)) file = `${abs}.ts`;
    else if (existsSync(path.join(abs, "index.ts"))) file = path.join(abs, "index.ts");
    return nextResolve(pathToFileURL(file).href, context);
  },
});
const { readTemplateStaticFile } = await import("../lib/template-static.ts");

// The overlay the block library replaces; removed together with this comparison once the blind
// review has passed (T-053).
const OLD_OVERLAY = readFileSync(new URL("../lib/template-adapters/overlays/screwfast.index.html", import.meta.url), "utf8");

async function servedEngineeringPage() {
  const served = await readTemplateStaticFile("screwfast", ["index.html"]);
  assert.ok(served, "screwfast root index must be served");
  assert.equal(served.contentType, "text/html; charset=utf-8");
  return served.body.toString("utf8");
}

test("the engineering home page is composed from the block library with one entity per block", async () => {
  const html = await servedEngineeringPage();
  const viaDirectory = await readTemplateStaticFile("screwfast", []);
  assert.equal(viaDirectory?.body.toString("utf8"), html);
  const document = parseHtmlDocument(html);
  for (const block of layoutBlocks(engineeringLook)) {
    const entities = document.querySelectorAll(`[data-sc-block="${block}"]`);
    assert.equal(entities.length, 1, `${block} must have one entity`);
    assert.equal(entities[0].getAttribute("data-sc-variant"), engineeringLook.defaults[block]);
    for (const variant of Object.keys(blockCatalog[block].variants)) {
      assert.equal(document.querySelectorAll(`template[data-sc-template="${block}:${variant}"]`).length, 1, `${block}:${variant} template`);
    }
  }
  assert.equal(document.querySelectorAll("template").length, layoutBlocks(engineeringLook).reduce((sum, block) => sum + Object.keys(blockCatalog[block].variants).length, 0));
});

test("the other looks still serve their own overlay", async () => {
  for (const templateId of ["forge", "landwind", "tailwind-landing"]) {
    const served = await readTemplateStaticFile(templateId, ["index.html"]);
    const overlay = readFileSync(new URL(`../lib/template-adapters/overlays/${templateId}.index.html`, import.meta.url), "utf8");
    assert.ok(served, templateId);
    assert.equal(served.body.toString("utf8").includes("data-sc-block"), false, `${templateId} must not be composed yet`);
    assert.equal(served.body.toString("utf8").replace(/<link crossorigin="anonymous"/g, "<link"), overlay, `${templateId} overlay`);
  }
});

function unwrapBlockMarkers(parent: { childNodes: HtmlNode[] }) {
  for (const child of [...parent.childNodes]) {
    if (!(child instanceof HtmlElement)) continue;
    unwrapBlockMarkers(child);
    if (child.localName === "template" || child.className.includes("sitecraft-benchmark-legacy")) {
      child.remove();
      continue;
    }
    const wrapper = child.hasAttribute("data-sc-block") && child.localName === "div" && !child.className;
    for (const name of [...child.attributes.keys()]) if (name.startsWith("data-sc-")) child.removeAttribute(name);
    if (wrapper && child.parentNode) {
      for (const grandchild of [...child.childNodes]) child.parentNode.insertBefore(grandchild, child);
      child.remove();
    }
  }
}

function comparableMarkup(html: string) {
  const document = parseHtmlDocument(html);
  unwrapBlockMarkers(document);
  return serializeNode(document.documentElement, { skip: (element) => element.localName === "style" });
}

test("with templates and block markers taken off, the default page has the old overlay's markup", async () => {
  assert.equal(comparableMarkup(await servedEngineeringPage()), comparableMarkup(OLD_OVERLAY));
});

function withTokenValues(rule: CssRule, tokens: Readonly<Record<string, string>>): CssRule {
  const read = (value: string) => value.replace(/var\((--site-[a-z0-9-]+)\)/g, (whole, name: string) => tokens[name] ?? whole);
  return { ...rule, declarations: rule.declarations.map(read) };
}

const ruleKey = (rule: CssRule) => `${rule.context} ${rule.selector} { ${rule.declarations.join("; ")} }`;

test("the composed CSS keeps every rule of the old overlay; spacing, headings and dividers read look tokens", async () => {
  const oldRules = cssRules(styleText(OLD_OVERLAY)).filter((rule) => rule.selector !== ":root" && rule.selector !== ".sitecraft-benchmark-legacy");
  const newRules = cssRules(styleText(await servedEngineeringPage()))
    .filter((rule) => rule.selector !== ":root")
    .map((rule) => withTokenValues(rule, engineeringLook.tokens));
  const newKeys = new Set(newRules.map(ruleKey));
  const oldKeys = new Set(oldRules.map(ruleKey));
  assert.deepEqual(oldRules.map(ruleKey).filter((key) => !newKeys.has(key)), [], "every rule of the old page is kept");
  // Rules the old page did not have belong to the layouts it did not have; each selector names a
  // class only those layouts use, so the default layouts render as before.
  const layoutClasses = ["sitecraft-statement", "sitecraft-compare", "sitecraft-product-group", "sitecraft-band"];
  for (const rule of newRules.filter((item) => !oldKeys.has(ruleKey(item)))) {
    for (const part of rule.selector.split(",")) {
      assert.ok(layoutClasses.some((name) => part.includes(`.${name}`)), `${rule.context} ${part.trim()} is new and not scoped to a new layout`);
    }
  }
  const usesTokens = cssRules(styleText(await servedEngineeringPage())).some((rule) => rule.declarations.some((item) => item.includes("var(--site-rule)")));
  assert.ok(usesTokens, "dividers must read the look's rule token");
});

test("the page root carries the default palette the old overlay had, plus the look tokens", async () => {
  const oldRoot = rootVariables(cssRules(styleText(OLD_OVERLAY)));
  const newRoot = rootVariables(cssRules(styleText(await servedEngineeringPage())));
  for (const [name, value] of oldRoot) {
    if (name === "--site-radius") {
      // Unused by the engineering CSS; the palette writes the same 4px as 0.25rem.
      assert.equal(newRoot.get(name), getTemplateAdapter("screwfast")?.kit?.tokens.radius);
      continue;
    }
    assert.equal(newRoot.get(name), value, name);
  }
  for (const [name, value] of Object.entries(engineeringLook.tokens)) assert.equal(newRoot.get(name), value, name);
});

test("the composed page carries no demo chrome from the old ScrewFast host", async () => {
  const html = await servedEngineeringPage();
  for (const leftover of ["data-sitecraft-demo", "sitecraft-benchmark-legacy", "ScrewFast", "12.8k", "Pricing", "$29", "Reviews", "<script", "http:", "https:"]) {
    assert.equal(html.includes(leftover), false, `composed page contains ${leftover}`);
  }
});

test("the screwfast adapter is built from the catalog and declares no demo chrome", async () => {
  const adapter = getTemplateAdapter("screwfast");
  assert.ok(adapter?.blocks, "adapter must describe the blocks the bridge mounts");
  assert.deepEqual(adapter.blocks.order, layoutBlocks(engineeringLook));
  assert.deepEqual(adapter.blocks.defaults, { ...engineeringLook.defaults });
  for (const block of adapter.blocks.order) assert.deepEqual(adapter.blocks.variants[block], Object.keys(blockCatalog[block].variants));
  assert.equal(adapter.demoChrome, undefined);
  assert.equal(adapter.sanitize, undefined);
  assert.equal(adapter.kit?.modules.some((module) => module.kind === "demo"), false);
  const document = parseHtmlDocument(await servedEngineeringPage());
  // Slots of layouts that are not mounted have no node; the mounted defaults' slots hit one each.
  const mounted = new Set(layoutBlocks(engineeringLook).flatMap((block) => blockCatalog[block].variants[engineeringLook.defaults[block]].slots.map((slot) => slot.selector)));
  for (const slot of adapter.slots) {
    assert.equal(document.querySelectorAll(slot.selector).length, mounted.has(slot.selector) ? 1 : 0, `${slot.target} ${slot.selector} on the served page`);
  }
  for (const section of adapter.sections ?? []) {
    assert.equal(document.querySelectorAll(section.selector).length, 1, `section ${section.key}`);
  }
  assert.equal(composedPageForTemplate("forge"), null);
});

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
import { cssRules, rootVariables, styleText } from "./fixtures/css-rules.ts";
import { parseHtmlDocument } from "./fixtures/html-dom.ts";

// T-053: the engineering home page is composed from the block library. Until the blind review had
// passed, this file also compared the default page with the old screwfast overlay (same markup, same
// CSS rules once the look tokens were read back); the overlay is deleted now (step 5), so the checks
// here are about the composed page itself.

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

test("the page root carries the palette and the look tokens; spacing, headings and dividers read them", async () => {
  const page = await servedEngineeringPage();
  const root = rootVariables(cssRules(styleText(page)));
  const palette = getTemplateAdapter("screwfast")?.kit?.tokens;
  assert.ok(palette, "the engineering look has a default palette");
  for (const [name, token] of [["--site-bg", palette.background], ["--site-surface", palette.surface], ["--site-ink", palette.text], ["--site-muted", palette.muted], ["--site-line", palette.border], ["--site-accent", palette.accent]] as const) {
    assert.equal(root.get(name), token, name);
  }
  for (const [name, value] of Object.entries(engineeringLook.tokens)) assert.equal(root.get(name), value, name);
  const rules = cssRules(styleText(page));
  for (const token of ["var(--site-rule)", "var(--site-h1)", "var(--site-section-space)", "var(--site-container)"]) {
    assert.ok(rules.some((rule) => rule.declarations.some((item) => item.includes(token))), `the page CSS reads ${token}`);
  }
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

import assert from "node:assert/strict";
import test from "node:test";
import { defaultDraft, type SiteDraft } from "../lib/site-document.ts";
import { installPreviewBridge } from "../lib/template-adapters/preview-bridge.ts";
import { getTemplateAdapter } from "../lib/template-adapters/registry.ts";
import { type HtmlElement, parseHtmlDocument, visibleText } from "./fixtures/html-dom.ts";
import { servedHomeHtml } from "./fixtures/look-pages.ts";
import { packDraft } from "./fixtures/pack-drafts.ts";

// T-059 (owner, 2026-09-30): the template gallery thumbnail and the template preview page have no
// draft, and the engineering page showed its empty skeleton there: six numbered steps and six FAQ rows
// with nothing in them, headings with nothing under them, contact labels without values. Without a
// draft the page now follows the gap rule: entries and contact lines with nothing to show are left
// out, and a block with nothing to show is hidden together with the links to it. Pages with a draft
// (the workspace preview included) keep the rules they had.

function engineeringPage() {
  const adapter = getTemplateAdapter("screwfast");
  assert.ok(adapter?.blocks, "screwfast is served from the block library");
  const document = parseHtmlDocument(servedHomeHtml("screwfast"));
  const globalObject: Record<string, unknown> = { document, parent: { postMessage() {} }, addEventListener() {} };
  globalObject.window = globalObject;
  return { document, api: installPreviewBridge(globalObject, "screwfast", adapter) };
}

function shown(node: HtmlElement | null) {
  if (!node) return false;
  for (let current: HtmlElement | null = node; current; current = current.parentElement) {
    if (current.hidden || current.styleValues.display === "none") return false;
  }
  return true;
}

const BLOCK_LINKS: Record<string, string> = {
  products: "#products",
  industries: "#industries",
  capabilities: "#capabilities",
  services: "#process",
  certifications: "#certifications",
  faq: "#faq",
};

test("without a draft the engineering page shows no empty entries, contact lines or blocks, and no links to them", () => {
  for (const variant of ["thumbnail", "preview"]) {
    const { document, api } = engineeringPage();
    api.applyDeclaredContent(undefined, "zh", [], variant);

    const steps = document.querySelectorAll(".sitecraft-process-card");
    const questions = document.querySelectorAll(".sitecraft-faq-item");
    assert.equal(steps.length, 6, "the steps block has six entries");
    assert.equal(questions.length, 6, "the FAQ block has six entries");
    assert.deepEqual(steps.filter(shown).length, 0, `${variant}: no empty step is shown`);
    assert.deepEqual(questions.filter(shown).length, 0, `${variant}: no empty question is shown`);

    for (const [block, href] of Object.entries(BLOCK_LINKS)) {
      const section = document.querySelector(`[data-sitecraft-section="${block}"]`);
      assert.ok(section, `${block} block is on the page`);
      assert.equal(shown(section), false, `${variant}: the empty ${block} block is hidden`);
      const links = document.querySelectorAll(`a[href="${href}"]`);
      assert.ok(links.length > 0, `${block} has links`);
      assert.deepEqual(links.filter(shown).map((link) => visibleText(link).trim()), [], `${variant}: links to the hidden ${block} block are hidden`);
    }

    const lines = document.querySelectorAll("[data-sitecraft-line]");
    assert.ok(lines.length >= 4, "contact lines are on the page");
    assert.deepEqual(lines.filter(shown).map((line) => visibleText(line).trim()), [], `${variant}: contact labels without values are left out`);
    const footerProducts = document.querySelector("[data-sitecraft-footer-products]");
    assert.ok(footerProducts?.parentElement, "the footer has a products column");
    assert.equal(shown(footerProducts.parentElement), false, `${variant}: the footer products column without products is left out`);

    assert.equal(shown(document.querySelector('[data-sitecraft-section="contact"]')), true, `${variant}: the inquiry block stays`);
    assert.equal(shown(document.querySelector('[data-sitecraft-inquiry="true"]')), true, `${variant}: the inquiry form stays`);
    assert.ok(document.querySelectorAll('a[href="#inquiry"]').some(shown), `${variant}: links to the inquiry block stay`);
  }
});

test("with a draft the page keeps its rules, and a draft shows again what the page without a draft hid", () => {
  const { document, api } = engineeringPage();
  api.applyDeclaredContent(undefined, "zh", [], "thumbnail");
  api.applyDeclaredContent(packDraft("industrial"), "zh", [], "workspace");
  const block = (key: string) => document.querySelector(`[data-sitecraft-section="${key}"]`);
  assert.equal(shown(block("products")), true, "the draft's products show");
  assert.equal(shown(block("industries")), true, "the draft's industries show");
  assert.ok(document.querySelectorAll('a[href="#products"]').some(shown), "links to the product block show again");
  assert.equal(shown(document.querySelector('[data-sitecraft-contact="email"]')), true, "the draft's email line shows again");
  assert.equal(shown(document.querySelector("[data-sitecraft-footer-products]")?.parentElement ?? null), true, "the footer products column shows again");
  assert.equal(shown(document.querySelector('[data-sitecraft-contact="phone"]')), false, "a phone that is a gap stays out");
  assert.equal(shown(block("faq")), false, "FAQ entries that are all gaps keep the block hidden");
  assert.equal(shown(block("services")), false, "steps that are all gaps keep the block hidden");

  // A new draft: the workspace keeps an empty product block where products will go; visitors do not see it.
  const fresh: SiteDraft = { ...structuredClone(defaultDraft), templateId: "screwfast" };
  const workspace = engineeringPage();
  workspace.api.applyDeclaredContent(fresh, "zh", [], "workspace");
  assert.equal(shown(workspace.document.querySelector('[data-sitecraft-section="products"]')), true, "workspace: empty product block stays");
  const published = engineeringPage();
  published.api.applyDeclaredContent(fresh, "zh", [], "published");
  assert.equal(shown(published.document.querySelector('[data-sitecraft-section="products"]')), false, "published: empty product block is hidden");
});

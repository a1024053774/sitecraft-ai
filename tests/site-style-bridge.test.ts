import assert from "node:assert/strict";
import test from "node:test";
import { composedPageForTemplate } from "../lib/blocks/compose.ts";
import { defaultDraft } from "../lib/site-document.ts";
import { installPreviewBridge } from "../lib/template-adapters/preview-bridge.ts";
import { getTemplateAdapter } from "../lib/template-adapters/registry.ts";
import { siteStyleCss, type SiteStyleRule } from "../lib/blocks/site-style.ts";
import { parseHtmlDocument } from "./fixtures/html-dom.ts";

test("the block-library bridge adds, replaces, and removes one site-style node", () => {
  const html = composedPageForTemplate("screwfast");
  assert.ok(html);
  const adapter = getTemplateAdapter("screwfast");
  assert.ok(adapter);
  const document = parseHtmlDocument(html);
  const globalObject: Record<string, unknown> = { document, parent: { postMessage() {} }, addEventListener() {} };
  globalObject.window = globalObject;
  const bridge = installPreviewBridge(globalObject, "screwfast", adapter);
  const draft = { ...structuredClone(defaultDraft), templateId: "screwfast", siteStyle: { direction: null, rules: [{ block: "hero", part: "title", declarations: { "font-size": "64px" } }] } };
  bridge.applyDeclaredContent(draft, "zh", [], "published");
  const style = document.querySelector("style[data-sc-site-style]");
  assert.ok(style);
  assert.equal(style.textContent, siteStyleCss(draft.siteStyle.rules as SiteStyleRule[]));
  bridge.applyDeclaredContent({ ...draft, siteStyle: { direction: null, rules: [{ block: "products", part: "grid", declarations: { gap: "32px" } }] } }, "zh", [], "published");
  assert.equal(document.querySelectorAll("style[data-sc-site-style]").length, 1);
  assert.match(document.querySelector("style[data-sc-site-style]")?.textContent ?? "", /data-sc-block="products"/);
  bridge.applyDeclaredContent({ ...draft, siteStyle: { direction: null, rules: [] } }, "zh", [], "published");
  assert.equal(document.querySelector("style[data-sc-site-style]"), null);
});

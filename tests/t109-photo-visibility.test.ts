import assert from "node:assert/strict";
import test from "node:test";
import { defaultDraft } from "../lib/site-document.ts";
import { installPreviewBridge } from "../lib/template-adapters/preview-bridge.ts";
import { getTemplateAdapter } from "../lib/template-adapters/registry.ts";
import { parseHtmlDocument } from "./fixtures/html-dom.ts";
import { servedHomeHtml } from "./fixtures/look-pages.ts";

// Failure cases: images under empty text sections; user-hidden sections reopened; stale text
// surviving a text→photo-only transition; empty media leaving a visible section shell.
for (const look of ["screwfast", "forge", "landwind", "tailwind-landing"]) {
  for (const locale of ["zh", "en"] as const) {
    test(`T-109 ${look} ${locale}: photo-only sections share the content visibility decision`, () => {
      const document = parseHtmlDocument(servedHomeHtml(look));
      const globalObject: Record<string, unknown> = { document, parent: { postMessage() {} }, addEventListener() {} };
      globalObject.window = globalObject;
      const api = installPreviewBridge(globalObject, look, getTemplateAdapter(look));
      const draft = structuredClone(defaultDraft);
      draft.templateId = look;
      draft.content.equipment = [];
      draft.content.capabilities = { title: { zh: "加工能力", en: "Capabilities" }, intro: { zh: "待补充", en: "To be provided" }, items: [] };
      const images = ["product", "equipment", "inspection"].map(category => ({
        imageId: `img_t109_${category}`, url: `/api/sites/site/images/img_t109_${category}`,
        usageCategory: category, license: "CC0",
      }));
      const apply = () => api.applyDeclaredContent(draft, locale, [], "published", undefined, false, images);
      apply();
      for (const section of ["products", "equipment", "capabilities"]) {
        assert.equal(document.querySelector(`[data-sitecraft-section="${section}"]`)?.hidden, false, `${section} photo-only section is visible`);
      }
      assert.equal(document.querySelector('[data-sitecraft-benchmark="capabilities-title"]')?.textContent, locale === "zh" ? "检测" : "Inspection");
      assert.equal(document.querySelector('[data-sitecraft-catalog-grid="capabilities"]')?.querySelectorAll("article").length, 0);
      draft.hiddenSections = ["products", "equipment", "capabilities"];
      apply();
      for (const section of draft.hiddenSections) {
        assert.equal(document.querySelector(`[data-sitecraft-section="${section}"]`)?.hidden, true, `explicit ${section} hide is respected`);
      }
      draft.hiddenSections = [];
      draft.content.capabilities.items = [{ id: "turning", title: { zh: "数控车削", en: "CNC turning" }, body: { zh: "数控车削", en: "CNC turning" } }];
      apply();
      assert.equal(document.querySelector('[data-sitecraft-benchmark="capabilities-title"]')?.textContent, locale === "zh" ? "加工能力" : "Capabilities", "supplied title returns when text returns");
      draft.content.capabilities.items = [];
      apply();
      assert.equal(document.querySelector('[data-sitecraft-catalog-grid="capabilities"]')?.querySelectorAll("article").length, 0, "previous text rows are removed");
      api.applyDeclaredContent(draft, locale, [], "published", undefined, false, []);
      for (const section of ["products", "equipment", "capabilities"]) {
        assert.equal(document.querySelector(`[data-sitecraft-section="${section}"]`)?.hidden, true, `${section} with no text or images is hidden`);
      }
    });
  }
}

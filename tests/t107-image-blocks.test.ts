import assert from "node:assert/strict";
import test from "node:test";
import { installPreviewBridge } from "../lib/template-adapters/preview-bridge.ts";
import { getTemplateAdapter } from "../lib/template-adapters/registry.ts";
import { parseHtmlDocument, visibleText } from "./fixtures/html-dom.ts";
import { servedHomeHtml } from "./fixtures/look-pages.ts";
import { packDraft } from "./fixtures/pack-drafts.ts";

type ImageView = {
  imageId: string;
  url: string;
  usageCategory: "product" | "equipment" | "facility" | "inspection";
  license: string;
  credit?: { zh: string; en: string };
};

function render(images: ImageView[]) {
  const adapter = getTemplateAdapter("screwfast");
  assert.ok(adapter);
  const document = parseHtmlDocument(servedHomeHtml("screwfast"));
  const globalObject: Record<string, unknown> = { document, parent: { postMessage() {} }, addEventListener() {} };
  globalObject.window = globalObject;
  const api = installPreviewBridge(globalObject, "screwfast", adapter);
  api.applyDeclaredContent(packDraft("industrial"), "zh", [], "published", undefined, false, images);
  return document;
}

test("usage categories route uploaded images to declared section galleries and show required credit", () => {
  const document = render([
    { imageId: "img_product_107", url: "/api/sites/site/images/img_product_107", usageCategory: "product", license: "CC0" },
    { imageId: "img_equipment_107", url: "/api/sites/site/images/img_equipment_107", usageCategory: "equipment", license: "CC BY", credit: { zh: "作者甲 / CC BY", en: "Author A / CC BY" } },
    { imageId: "img_facility_107", url: "/api/sites/site/images/img_facility_107", usageCategory: "facility", license: "CC BY-SA", credit: { zh: "作者乙 / CC BY-SA", en: "Author B / CC BY-SA" } },
    { imageId: "img_inspection_107", url: "/api/sites/site/images/img_inspection_107", usageCategory: "inspection", license: "Public Domain" },
  ]);
  for (const category of ["product", "equipment", "facility", "inspection"]) {
    const gallery = document.querySelector(`[data-sitecraft-image-gallery="${category}"]`);
    assert.ok(gallery, `${category} gallery is declared`);
    assert.equal(gallery?.querySelectorAll("img").length, 1, `${category} image is mounted by category`);
  }
  assert.match(visibleText(document.documentElement), /作者乙 \/ CC BY-SA/);
});

test("without uploaded images, image galleries stay hidden and do not leave empty frames", () => {
  const document = render([]);
  for (const category of ["product", "equipment", "facility", "inspection"]) {
    const gallery = document.querySelector(`[data-sitecraft-image-gallery="${category}"]`);
    assert.ok(gallery, `${category} gallery is declared`);
    assert.equal(gallery?.hidden, true, `${category} gallery is hidden without images`);
    assert.equal(gallery?.querySelectorAll("img").length, 0);
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import { defaultDraft } from "../lib/site-document.ts";
import { materialFeaturesFromDraft, recommendLookFromDraft } from "../lib/alignment-recommendation.ts";
import { packDraft } from "./fixtures/pack-drafts.ts";

test("structured draft features count products, categories, parameters and catalog sections", () => {
  const industrial = materialFeaturesFromDraft(packDraft("industrial"));
  assert.deepEqual({
    productCount: industrial.productCount,
    categoryCount: industrial.categoryCount,
    parameterizedProducts: industrial.parameterizedProducts,
    industryCount: industrial.industryCount,
    capabilityCount: industrial.capabilityCount,
    certificationCount: industrial.certificationCount,
  }, {
    productCount: 2,
    categoryCount: 1,
    parameterizedProducts: 2,
    industryCount: 2,
    capabilityCount: 0,
    certificationCount: 0,
  });
});

test("catalog feature counts ignore gaps and include capabilities and certifications", () => {
  const draft = packDraft("industrial");
  draft.content.capabilities = {
    title: { zh: "加工能力", en: "Capabilities" },
    intro: { zh: "", en: "" },
    items: [
      { id: "gear", title: { zh: "滚齿", en: "Hobbing" }, body: { zh: "", en: "" } },
      { id: "test", title: { zh: "跑合试验", en: "Run-in testing" }, body: { zh: "", en: "" } },
      { id: "gap", title: { zh: "待补充", en: "To be provided" }, body: { zh: "", en: "" } },
    ],
  };
  draft.content.certifications = {
    title: { zh: "认证", en: "Certifications" },
    intro: { zh: "", en: "" },
    items: [{ id: "iso", title: { zh: "ISO 9001", en: "ISO 9001" }, body: { zh: "", en: "" }, status: "已有" }],
  };
  const features = materialFeaturesFromDraft(draft);
  assert.equal(features.capabilityCount, 2);
  assert.equal(features.certificationCount, 1);
});

test("look rules use structured shape rather than an industry label", () => {
  const industrial = recommendLookFromDraft(packDraft("industrial"));
  const exportCatalog = recommendLookFromDraft(packDraft("export"));
  const molding = recommendLookFromDraft(packDraft("molding"));
  assert.equal(industrial?.briefId, "engineering-industrial");
  assert.equal(exportCatalog?.briefId, "export-catalog");
  assert.equal(molding?.briefId, "engineering-industrial");
  assert.match(industrial?.reason ?? "", /2 个产品|2 项参数化产品|2 个应用行业/);
  assert.match(exportCatalog?.reason ?? "", /2 个产品|1 个产品类别|目录/);
  assert.match(molding?.reason ?? "", /5 个产品|参数化产品/);
});

test("a small structured product set gets the short-path look, while a broad light set gets bright product", () => {
  const sparse = structuredClone(defaultDraft);
  sparse.products = [{
    sku: "one",
    name: { zh: "单一产品", en: "Single product" },
    summary: { zh: "用途明确", en: "Clear use" },
    category: "",
    status: "published",
    imageColor: "#e6e1cf",
    specs: [],
  }];
  const broad = structuredClone(defaultDraft);
  broad.products = Array.from({ length: 3 }, (_, index) => ({
    sku: `p-${index}`,
    name: { zh: `产品${index + 1}`, en: `Product ${index + 1}` },
    summary: { zh: "产品说明", en: "Product" },
    category: "",
    status: "published" as const,
    imageColor: "#e6e1cf",
    specs: [{ name: { zh: "材质", en: "Material" }, value: "钢" }],
  }));
  assert.equal(recommendLookFromDraft(sparse)?.briefId, "technical-product");
  assert.equal(recommendLookFromDraft(broad)?.briefId, "industrial");
});

test("an empty new draft leaves the planner recommendation in charge", () => {
  assert.equal(recommendLookFromDraft(defaultDraft), null);
});

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { defaultDraft, normalizeDraft } from "../lib/site-document.ts";
import { aiIntentResponseSchema, applySiteOperations } from "../lib/site-operations.ts";
import {
  defaultPagePlanFor,
  previewPageSegments,
  resolvePagePlan,
  templateExtraRoutes,
} from "../lib/template-pages.ts";

const templateIds = new Set(["forge", "screwfast", "landwind", "tailwind-landing", "fresh"]);
const options = { templateIds, lastChange: "page-plan" };

const FORGE_INDEX = "vendor/open-source-templates/small-bis/dist/index.html";
const FORGE_CONTACT = "vendor/open-source-templates/small-bis/dist/Contact/index.html";
const LANDWIND_INDEX = "lib/template-adapters/overlays/landwind.index.html";

test("default three is home, products and contact and is not a page cap", () => {
  const forge = defaultPagePlanFor("forge");
  assert.equal(forge.source, "default");
  assert.deepEqual(forge.pages.map((page) => page.id), ["home", "products", "contact"]);
  assert.equal(forge.pages[0]?.placement, "route");
  assert.equal(forge.pages[0]?.route, "");
  assert.equal(forge.pages[1]?.placement, "section");
  assert.equal(forge.pages[1]?.section, "services");
  assert.equal(forge.pages[2]?.placement, "route");
  assert.equal(forge.pages[2]?.route, "Contact");
  assert.deepEqual(forge.unsupported, []);
  assert.equal(defaultDraft.pagePlan.pages.length, 3);
});

test("user extra pages keep a different set and explain unsupported urls", () => {
  const plan = resolvePagePlan({
    templateId: "forge",
    source: "user",
    requested: [
      { id: "home", role: "home" },
      { id: "products", role: "products" },
      { id: "contact", role: "contact" },
      { id: "about", role: "about" },
      { id: "certifications", role: "custom", requested: "认证页" },
      { id: "downloads", role: "custom", requested: "资料下载页" },
    ],
  });
  assert.equal(plan.source, "user");
  assert.deepEqual(plan.pages.map((page) => page.id), ["home", "products", "contact", "about"]);
  assert.equal(plan.pages.length > 3, true);
  assert.equal(plan.pages.find((page) => page.id === "about")?.placement, "route");
  assert.equal(plan.pages.find((page) => page.id === "about")?.route, "About");
  assert.equal(plan.unsupported.some((item) => item.requested.includes("认证")), true);
  assert.equal(plan.unsupported.some((item) => item.requested.includes("资料下载")), true);
  assert.equal(plan.pages.some((page) => page.id === "certifications"), false);
});

test("explicit single-page request is not padded back to three", () => {
  const result = applySiteOperations(structuredClone(defaultDraft), [{
    op: "set_page_plan",
    source: "user",
    pages: [{ id: "home", role: "home", label: { zh: "首页", en: "Home" } }],
  }], options);
  assert.equal(result.changed, true);
  assert.equal(result.draft.pagePlan.source, "user");
  assert.deepEqual(result.draft.pagePlan.pages.map((page) => page.id), ["home"]);
  const restored = applySiteOperations(result.draft, result.inverseOperations, options);
  assert.deepEqual(restored.draft.pagePlan.pages.map((page) => page.id), ["home", "products", "contact"]);
  assert.equal(restored.draft.pagePlan.source, "default");
});

test("unspecified source uses default three and model plans can differ", () => {
  const unspecified = applySiteOperations(structuredClone(defaultDraft), [{
    op: "set_page_plan",
    source: "default",
    pages: [],
  }], options);
  assert.equal(unspecified.changed, false);
  assert.deepEqual(unspecified.draft.pagePlan.pages.map((page) => page.id), ["home", "products", "contact"]);

  const modeled = resolvePagePlan({
    templateId: "landwind",
    source: "model",
    requested: [
      { id: "home", role: "home" },
      { id: "products", role: "products" },
      { id: "contact", role: "contact" },
      { id: "about", role: "about" },
      { id: "certifications", role: "custom", requested: "认证页" },
    ],
  });
  assert.equal(modeled.source, "model");
  assert.deepEqual(modeled.pages.map((page) => page.id), ["home", "products", "contact", "about"]);
  assert.equal(modeled.pages.length > 3, true);
  assert.equal(modeled.pages.every((page) => page.placement === "section"), true);
  assert.equal(modeled.unsupported.some((item) => item.requested.includes("认证")), true);
});

test("landwind cannot host extra urls; forge extra html is a different document", () => {
  const landwind = defaultPagePlanFor("landwind");
  assert.equal(landwind.pages.every((page) => page.placement === "section"), true);
  assert.equal(templateExtraRoutes.landwind, undefined);
  assert.equal(previewPageSegments("../etc/passwd"), null);
  assert.deepEqual(previewPageSegments("Contact"), ["Contact"]);

  assert.equal(existsSync(FORGE_INDEX), true);
  assert.equal(existsSync(FORGE_CONTACT), true);
  assert.equal(existsSync(LANDWIND_INDEX), true);
  const forgeIndex = readFileSync(FORGE_INDEX, "utf8");
  const forgeContact = readFileSync(FORGE_CONTACT, "utf8");
  assert.notEqual(forgeIndex, forgeContact);
  assert.equal(forgeContact.includes("Contact") || forgeContact.length > 40, true);
  assert.equal(existsSync("vendor/open-source-templates/landwind/Contact/index.html"), false);
  assert.equal(existsSync("vendor/open-source-templates/landwind/products/index.html"), false);
});

test("v2 drafts missing pagePlan hydrate from the template instead of shrinking to a homepage", () => {
  const { pagePlan: _plan, ...legacy } = structuredClone(defaultDraft);
  legacy.templateId = "landwind";
  legacy.revision = 12;
  const restored = normalizeDraft(legacy);
  assert.equal(restored.pagePlan.source, "default");
  assert.deepEqual(restored.pagePlan.pages.map((page) => page.id), ["home", "products", "contact"]);
  assert.equal(restored.pagePlan.pages.every((page) => page.placement === "section"), true);
  assert.equal(restored.revision, 12);
});

test("ai edit intent accepts set_page_plan and switching looks rehosts placement", () => {
  const parsed = aiIntentResponseSchema.safeParse({
    type: "edit",
    summary: "按用户点名规划页面",
    operations: [{
      op: "set_page_plan",
      source: "user",
      pages: [{ id: "home", role: "home" }],
      unsupported: [{ requested: "认证页", reason: "当前模板没有独立认证 HTML" }],
    }],
  });
  assert.equal(parsed.success, true);

  const swapped = applySiteOperations(structuredClone(defaultDraft), [{
    op: "set_visual_brief",
    briefId: "export-catalog",
  }], { templateIds: new Set(["forge", "landwind"]), lastChange: "look" });
  assert.equal(swapped.draft.templateId, "landwind");
  assert.equal(swapped.draft.pagePlan.pages.every((page) => page.placement === "section"), true);
  const undone = applySiteOperations(swapped.draft, swapped.inverseOperations, {
    templateIds: new Set(["forge", "landwind"]),
    lastChange: "undo",
  });
  assert.equal(undone.draft.templateId, "forge");
  assert.equal(undone.draft.pagePlan.pages.find((page) => page.id === "contact")?.placement, "route");
});

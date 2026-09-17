import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { defaultDraft, visualBriefCatalog } from "../lib/site-document.ts";
import { applySiteOperations } from "../lib/site-operations.ts";
import {
  MATERIALS_CHAT_LIMIT,
  buildMaterialsChatMessage,
  parseWorkspaceSiteId,
  simulatedPackList,
  simulatedPacks,
  wrapCompanyMaterials,
} from "../lib/simulated-packs.ts";

const COLLIDING_TOKENS = [
  "汉川精密阀业A17",
  "北湾流体接头B84",
  "澄海传动件K07",
  "甬江密封件M52",
] as const;

const providerSource = readFileSync(new URL("../lib/ai-provider.ts", import.meta.url), "utf8");
const workspaceSource = readFileSync(new URL("../app/workspace/page.tsx", import.meta.url), "utf8");

test("industrial and export simulated packs are independent, labeled 模拟, and use unique nonces", () => {
  assert.equal(simulatedPackList.length, 2);
  assert.equal(simulatedPacks.industrial.siteId, "p3-industrial");
  assert.equal(simulatedPacks.export.siteId, "p3-export");
  assert.notEqual(simulatedPacks.industrial.siteId, simulatedPacks.export.siteId);
  assert.notEqual(simulatedPacks.industrial.nonce, simulatedPacks.export.nonce);
  assert.notEqual(simulatedPacks.industrial.companyName, simulatedPacks.export.companyName);

  for (const pack of simulatedPackList) {
    assert.match(pack.label, /模拟/);
    assert.match(pack.body, /模拟/);
    assert.equal(pack.body.includes(pack.nonce), true);
    assert.equal(pack.heroTitle.includes(pack.nonce), true);
    assert.equal(pack.companyName.includes(pack.nonce.slice(0, 3)), true);
    assert.ok(pack.missingFacts.includes("认证"));
    assert.ok(pack.email.endsWith("-sim.test"));
    const message = buildMaterialsChatMessage(pack);
    assert.ok(message.length <= MATERIALS_CHAT_LIMIT);
    assert.match(message, /模拟/);
    assert.match(message, /待补充/);
    assert.equal(message.includes(pack.nonce), true);
    for (const token of COLLIDING_TOKENS) {
      assert.equal(pack.body.includes(token), false, `${pack.id} collided with ${token}`);
      assert.equal(message.includes(token), false);
    }
  }

  assert.equal(simulatedPacks.industrial.body.includes(simulatedPacks.export.nonce), false);
  assert.equal(simulatedPacks.export.body.includes(simulatedPacks.industrial.nonce), false);
  assert.match(simulatedPacks.export.extraPagesNote, /独立认证/);
});

test("simulated pack tokens stay out of the production system prompt", () => {
  assert.equal(providerSource.includes("from \"./simulated-packs"), false);
  assert.equal(providerSource.includes("from \"@/lib/simulated-packs"), false);
  for (const pack of simulatedPackList) {
    assert.equal(providerSource.includes(pack.nonce), false, `prompt leaked ${pack.nonce}`);
    assert.equal(providerSource.includes(pack.companyName), false, `prompt leaked ${pack.companyName}`);
    assert.equal(providerSource.includes(pack.email), false);
  }
  for (const token of COLLIDING_TOKENS) {
    assert.equal(providerSource.includes(token), false, `prompt leaked colliding token ${token}`);
  }
  assert.match(providerSource, /set_page_plan/);
  assert.match(providerSource, /默认三项不是上限/);
  assert.match(providerSource, /不能假装开通|不得把整站静默缩成只有首页/);
});

test("workspace materials journey stays on chat/commitOperations and isolates site ids", () => {
  assert.equal(parseWorkspaceSiteId(null), "demo");
  assert.equal(parseWorkspaceSiteId("p3-industrial"), "p3-industrial");
  assert.equal(parseWorkspaceSiteId("../etc/passwd"), "demo");
  assert.match(workspaceSource, /parseWorkspaceSiteId/);
  assert.match(workspaceSource, /提供公司资料/);
  assert.match(workspaceSource, /data-testid="site-page-nav"/);
  assert.match(workspaceSource, /只要首页/);
  assert.match(workspaceSource, /额外页面/);
  assert.match(workspaceSource, /模拟工业包|pack\.label/);
  assert.match(workspaceSource, /buildMaterialsChatMessage|wrapCompanyMaterials/);
  assert.match(workspaceSource, /\/api\/sites\/\$\{siteId\}\/chat/);
  assert.match(workspaceSource, /\/published\/\$\{encodeURIComponent\(siteId\)\}/);
  assert.match(workspaceSource, /\/api\/sites\/\$\{siteId\}\/images/);
  assert.match(workspaceSource, /上传产品图/);
  assert.match(workspaceSource, /data-testid="upload-product-photo"/);
  assert.match(workspaceSource, /set_image_slot/);
  assert.equal(workspaceSource.includes("sitecraft-frontend-less-ai-tone"), false);
  assert.equal(/\bSkill\b/.test(workspaceSource), false);
});

test("commitOperations-compatible ops can write pack facts without guessing undeclared chrome", () => {
  const templateIds = new Set(visualBriefCatalog.map((item) => item.templateId));
  const industrial = applySiteOperations(structuredClone(defaultDraft), [
    { op: "set_visual_brief", briefId: "engineering-industrial" },
    { op: "set_text", target: "companyName", value: simulatedPacks.industrial.companyName },
    { op: "set_text", target: "hero.title", locale: "zh", value: simulatedPacks.industrial.heroTitle },
    { op: "set_text", target: "hero.subtitle", locale: "zh", value: simulatedPacks.industrial.heroSubtitle },
    { op: "set_text", target: "hero.cta", locale: "zh", value: simulatedPacks.industrial.heroCta },
    { op: "set_text", target: "contact.email", value: simulatedPacks.industrial.email },
    { op: "set_text", target: "contact.phone", value: "待补充" },
  ], { templateIds, lastChange: "pack-apply" });
  assert.equal(industrial.changed, true);
  assert.equal(industrial.draft.templateId, "screwfast");
  assert.equal(industrial.draft.visualBrief.label, "工程工业");
  assert.equal(industrial.draft.companyName, simulatedPacks.industrial.companyName);
  assert.equal(industrial.draft.content.hero.title.zh.includes(simulatedPacks.industrial.nonce), true);
  assert.equal(industrial.draft.content.contact.phone, "待补充");
  assert.equal(industrial.draft.content.hero.title.zh.includes(simulatedPacks.export.nonce), false);

  const exported = applySiteOperations(structuredClone(defaultDraft), [
    { op: "set_visual_brief", briefId: "export-catalog" },
    { op: "set_text", target: "companyName", value: simulatedPacks.export.companyName },
    { op: "set_text", target: "hero.title", locale: "zh", value: simulatedPacks.export.heroTitle },
    { op: "set_text", target: "hero.subtitle", locale: "zh", value: simulatedPacks.export.heroSubtitle },
    { op: "set_text", target: "hero.cta", locale: "zh", value: simulatedPacks.export.heroCta },
    { op: "set_text", target: "contact.email", value: simulatedPacks.export.email },
  ], { templateIds, lastChange: "pack-apply" });
  assert.equal(exported.draft.templateId, "landwind");
  assert.equal(exported.draft.visualBrief.label, "蓝白目录");
  assert.equal(exported.draft.content.hero.title.zh.includes(simulatedPacks.export.nonce), true);
  assert.equal(exported.draft.companyName.includes(simulatedPacks.industrial.nonce.slice(0, 3)), false);
});

test("oversized materials stay within the chat character limit", () => {
  const wrapped = wrapCompanyMaterials(`模拟资料\n${"字".repeat(5000)}`);
  assert.ok(wrapped.length <= MATERIALS_CHAT_LIMIT);
  assert.match(wrapped, /模拟/);
  assert.match(wrapped, /待补充/);
});

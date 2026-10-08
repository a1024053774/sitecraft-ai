import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { defaultDraft, visualBriefCatalog } from "../lib/site-document.ts";
import { applySiteOperations } from "../lib/site-operations.ts";
import {
  MATERIALS_CHAT_LIMIT,
  WORKSPACE_SITE_ID_PATTERN,
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
const workspaceSource = readFileSync(new URL("../app/(workspace)/workspace/page.tsx", import.meta.url), "utf8");

test("industrial and export simulated packs are independent, labeled 模拟, and use unique nonces", () => {
  assert.equal(simulatedPackList.length, 4);
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
    assert.ok(pack.missingFacts.length >= 1);
    // The pack declares itself simulated once, up front; fact lines carry no labels the model could copy onto the page.
    assert.match(pack.body.split("\n")[0], /^资料性质：模拟/);
    assert.equal(pack.body.split("\n").slice(1).some((line) => line.includes("模拟")), false);
    assert.match(pack.body, /规格参数|应用行业|加工能力|认证状态/);
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

// The two gap-heavy packs are fixtures for 「待补充」; the thick pack must not change them.
const EXISTING_PACK_SHA256 = {
  industrial: "83cdcab93c8f78c15e87d3ddd70eabdf004a62ec3075e94a7322690e78ff59b9",
  export: "08d87a8364fb27f3bf50f3126dedc89e42efc04f5595d361251433d31780cc38",
} as const;

function bodyLine(body: string, label: string): string {
  const line = body.split("\n").find((item) => item.startsWith(`${label}：`));
  assert.ok(line, `missing line ${label}`);
  return line.slice(label.length + 1);
}

function listItems(value: string): string[] {
  return value.replace(/。$/, "").split("；").map((item) => item.trim()).filter(Boolean);
}

test("thick molding pack is a third workspace pack with full facts and only the declared gaps", () => {
  const pack = simulatedPacks.molding;
  assert.ok(pack, "simulatedPacks.molding is missing");
  assert.equal(simulatedPackList.includes(pack), true, "workspace pack list must offer the thick pack");
  assert.equal(new Set(simulatedPackList.map((item) => item.id)).size, simulatedPackList.length);
  assert.equal(new Set(simulatedPackList.map((item) => item.siteId)).size, simulatedPackList.length);
  assert.equal(new Set(simulatedPackList.map((item) => item.nonce)).size, simulatedPackList.length);
  assert.match(pack.siteId, WORKSPACE_SITE_ID_PATTERN);
  for (const id of ["industrial", "export"] as const) {
    const hash = createHash("sha256").update(JSON.stringify(simulatedPacks[id])).digest("hex");
    assert.equal(hash, EXISTING_PACK_SHA256[id], `${id} pack changed`);
  }

  assert.match(pack.nonce, /^P3T-[A-Z0-9]{4}$/);
  assert.match(pack.companyName, /P3T/);
  assert.match(pack.label, /模拟/);
  assert.match(pack.industry, /注塑/);
  assert.match(pack.email, /^[a-z0-9.-]+@[a-z0-9-]+\.test$/);
  assert.equal(pack.body.includes(pack.email), true);
  assert.equal(pack.body.includes(`核验记号：${pack.nonce}`), true);
  assert.equal(pack.body.includes(simulatedPacks.industrial.nonce), false);
  assert.equal(pack.body.includes(simulatedPacks.export.nonce), false);

  const intro = bodyLine(pack.body, "公司简介");
  const sentences = intro.split("。").filter((item) => item.trim());
  assert.ok(sentences.length >= 2 && sentences.length <= 3, `intro has ${sentences.length} sentences`);
  const milestones = listItems(bodyLine(pack.body, "沿革"));
  assert.ok(milestones.length >= 3 && milestones.length <= 5);
  for (const item of milestones) assert.match(item, /^\d{4} 年/);

  const products = listItems(bodyLine(pack.body, "产品"));
  assert.equal(products.length, 5);
  for (const product of products) {
    const params = listItems(bodyLine(pack.body, `${product}规格参数`));
    assert.ok(params.length >= 5 && params.length <= 8, `${product} has ${params.length} params`);
    for (const param of params) assert.match(param, /^\S+ \S/, `${product} param lacks a value: ${param}`);
  }

  assert.match(bodyLine(pack.body, "产能"), /\d/);
  assert.ok(listItems(bodyLine(pack.body, "加工能力/主设备")).length >= 4);
  assert.ok(listItems(bodyLine(pack.body, "检测设备")).length >= 3);
  const qc = listItems(bodyLine(pack.body, "质检流程"));
  assert.ok(qc.length >= 4 && qc.length <= 6);
  const industries = listItems(bodyLine(pack.body, "应用行业"));
  assert.ok(industries.length >= 4 && industries.length <= 6);
  const certs = bodyLine(pack.body, "认证状态");
  assert.match(certs, /已有/);
  assert.match(certs, /认证中/);
  const faq = pack.body.split("\n").filter((line) => /^问：.+答：/.test(line));
  assert.ok(faq.length >= 4 && faq.length <= 6, `faq has ${faq.length} entries`);
  assert.match(bodyLine(pack.body, "MOQ"), /\d/);
  assert.match(bodyLine(pack.body, "交期"), /\d/);
  assert.equal(pack.body.includes("0000-0000000"), false);
  assert.equal(pack.body.includes("示例省示例市模具园区 0 号"), false);
  assert.equal(pack.body.includes("虚构"), false, "simulation labels must not enter the pack body");

  assert.deepEqual(pack.missingFacts, ["客户名单", "评价", "电话", "地址"]);
  const gapLines = pack.body.split("\n").filter((line) => /客户|评价|电话|地址/.test(line));
  assert.deepEqual(gapLines, ["客户名单、评价：资料未提供。"]);
  for (const word of ["奖", "荣获", "市场份额", "占有率", "好评", "五星", "知名", "500强", "领先", "第一"]) {
    assert.equal(pack.body.includes(word), false, `thick pack must not claim ${word}`);
  }

  const message = buildMaterialsChatMessage(pack);
  assert.ok(message.length <= MATERIALS_CHAT_LIMIT, `message is ${message.length} chars`);
  assert.equal(message.includes("…[truncated]"), false, "thick pack must fit without truncation");
  assert.equal(message.endsWith(pack.body), true);
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
  assert.match(workspaceSource, /data-testid="open-materials"/);
  assert.match(workspaceSource, /data-testid="simulated-pack"/);
  assert.match(workspaceSource, /data-testid="submit-materials"/);
  assert.match(workspaceSource, /data-testid="visual-brief-card"/);
  assert.match(workspaceSource, /data-testid="workspace-draft-revision"/);
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

test("workspace preview and published page read the same committed draft", () => {
  const publishedPage = readFileSync(new URL("../app/published/[siteKey]/page.tsx", import.meta.url), "utf8");
  const publishedClient = readFileSync(new URL("../app/published/[siteKey]/published-client.tsx", import.meta.url), "utf8");
  const chatRoute = readFileSync(new URL("../app/api/sites/[siteId]/chat/route.ts", import.meta.url), "utf8");
  const draftRoute = readFileSync(new URL("../app/api/sites/[siteId]/draft/route.ts", import.meta.url), "utf8");
  assert.match(workspaceSource, /fetch\(`\/api\/sites\/\$\{(?:activeSiteId|siteId)\}\/draft`/);
  assert.match(workspaceSource, /variant="workspace"/);
  assert.match(publishedPage, /getExistingSite\(siteKey\)/);
  assert.match(publishedPage, /initialDraft/);
  assert.match(publishedClient, /variant="published"/);
  assert.match(publishedClient, /OpenSourceTemplateFrame/);
  assert.match(draftRoute, /commitOperations/);
  assert.match(chatRoute, /requestStructuredOperations/);
  assert.match(chatRoute, /commitOperations/);
  const packLoader = workspaceSource.slice(
    workspaceSource.indexOf("const loadSimulatedPack"),
    workspaceSource.indexOf("const submitMaterials"),
  );
  assert.equal(packLoader.includes("set_visual_brief"), false, "pack buttons must not skip look-first");
  assert.equal(packLoader.includes("set_template"), false);
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

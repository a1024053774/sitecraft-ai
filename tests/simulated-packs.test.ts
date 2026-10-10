import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  MATERIALS_CHAT_LIMIT,
  WORKSPACE_SITE_ID_PATTERN,
  buildMaterialsChatMessage,
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
    assert.ok(pack.email.endsWith(".luckye.online"));
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
  assert.match(simulatedPacks.export.extraPagesNote, /认证与材料追溯/);
});

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
  assert.match(pack.nonce, /^P3T-[A-Z0-9]{4}$/);
  assert.match(pack.companyName, /P3T/);
  assert.match(pack.label, /模拟/);
  assert.match(pack.industry, /注塑/);
  assert.match(pack.email, /^[a-z0-9.-]+@[a-z0-9.-]+\.luckye\.online$/);
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

  for (const gap of ["客户名单", "评价", "电话", "地址"]) assert.ok(pack.missingFacts.includes(gap));
  assert.match(pack.body, /电话、地址：待补充/);
  assert.match(pack.body, /客户名单、评价：待补充/);
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
  assert.doesNotMatch(providerSource, /set_page_plan|commitOperations/);
});

test("oversized materials stay within the chat character limit", () => {
  const wrapped = wrapCompanyMaterials(`模拟资料\n${"字".repeat(5000)}`);
  assert.ok(wrapped.length <= MATERIALS_CHAT_LIMIT);
  assert.match(wrapped, /模拟/);
  assert.match(wrapped, /待补充/);
});

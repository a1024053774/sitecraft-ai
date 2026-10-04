import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { expectedFacts, missingFacts } from "../scripts/published-facts.mjs";
import { packDraft, withLayouts } from "./fixtures/pack-drafts.ts";
import { closeBrowser, base, openBrowser } from "./helpers/workspace-browser.ts";

// T-074 (merge check on the molding expert copy, 713b5ee): every material fact a visitor must be
// able to read (scripts/published-facts.mjs, read the way check-published reads the page: folded
// <details> opened) has to be on the page with each block-pool layout mounted. The first version of
// 型号索引表 showed three specs per row and no summary, so 31 of 117 facts were nowhere on the page.

const readable = readFileSync(new URL("../scripts/visitor-readable-text.js", import.meta.url), "utf8");
const text = (zh: string, en: string) => ({ zh, en });

function moldingDraft(blockVariants: Record<string, string>, templateId: string) {
  const draft = withLayouts(packDraft("molding"), blockVariants);
  draft.content.services = {
    ...draft.content.services,
    items: [
      { id: "rfq", title: text("提交图纸或样品", "Send drawings or samples"), body: text("没有图纸可先做 3D 扫描和逆向建模。", "Without drawings we start with 3D scanning.") },
      { id: "mold", title: text("开模制作", "Mold making"), body: text("单腔模具约 25–35 天。", "About 25–35 days for single-cavity molds.") },
      { id: "trial", title: text("试模与样品确认", "Trial and sample approval"), body: text("T1 试模后 3 天内寄出样品。", "Samples ship within 3 days of T1.") },
    ],
  } as typeof draft.content.services;
  draft.content.certifications = {
    title: text("认证", "Certifications"),
    intro: text("待补充", "To be provided"),
    items: [
      { id: "iso9001", title: text("ISO 9001", "ISO 9001"), body: text("质量管理体系", "Quality management system"), status: "已有" },
      { id: "iatf", title: text("IATF 16949", "IATF 16949"), body: text("汽车行业质量管理体系", "Automotive quality management"), status: "认证中" },
    ],
  } as typeof draft.content.certifications;
  draft.content.commercialTerms = [
    { id: "moq", kind: "moq", value: text("注塑件 5000 件起；模具单套起接", "Moulded parts from 5,000 pcs; moulds from one set") },
    { id: "lead-time", kind: "lead_time", value: text("模具 25–55 天；批量注塑件在模具确认后 15–20 天", "Moulds 25–55 days; volume parts 15–20 days after approval") },
    { id: "trade", kind: "trade_terms", value: text("常用 FOB 宁波和 EXW，也可按订单约定 CIF", "FOB Ningbo and EXW; CIF by agreement") },
  ] as typeof draft.content.commercialTerms;
  draft.content.equipment = [
    { id: "cnc", name: text("高速 CNC 加工中心", "High-speed CNC machining center"), quantity: 12, spec: null },
    { id: "injection", name: text("注塑机", "Injection molding machine"), quantity: 42, spec: text("90–800 t", "90–800 t") },
    { id: "cmm", name: text("三坐标测量机", "Coordinate measuring machine"), quantity: null, spec: null },
  ] as typeof draft.content.equipment;
  return { ...draft, templateId };
}

const LAYOUT_SETS: Array<[string, Record<string, string>]> = [
  ["型号索引表", { products: "index" }],
  ["目录封面", { hero: "cover" }],
  ["纵向流程", { services: "vertical" }],
  ["证书状态表", { certifications: "table" }],
  ["左右条款", { commercialTerms: "side" }],
  ["条款带", { commercialTerms: "strip" }],
  ["数量带", { equipment: "band" }],
  ["双栏清单", { equipment: "compact" }],
  ["五个新布局一起", { products: "index", hero: "cover", services: "vertical", certifications: "table", commercialTerms: "side" }],
  ["条款带和其余四个新布局一起", { products: "index", hero: "cover", services: "vertical", certifications: "table", commercialTerms: "strip" }],
];

test("every material fact is on the page with each block-pool layout mounted, in both languages, at three widths", async () => {
  const browser = await openBrowser();
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" }) as { targetId: string };
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
  try {
    await browser.send("Page.enable", {}, sessionId);
    await browser.send("Runtime.enable", {}, sessionId);
    for (const templateId of ["screwfast", "landwind"]) {
      await browser.send("Page.navigate", { url: `${base}/api/templates/${templateId}/preview?published-facts=${Date.now()}` }, sessionId);
      for (let waited = 0; waited < 30000; waited += 100) {
        if (await browser.eval<boolean>("document.readyState === 'complete' && typeof window.__sitecraftApplyDeclared === 'function'", sessionId).catch(() => false)) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      for (const [label, variants] of LAYOUT_SETS) {
        const draft = moldingDraft(variants, templateId);
        for (const locale of ["zh", "en"] as const) {
          const facts = expectedFacts(draft, locale);
          assert.ok(facts.length > 40, `${label}: the draft carries many facts (${facts.length})`);
          for (const width of [1440, 768, 375]) {
            await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);
            await browser.eval(`window.__sitecraftApplyDeclared(${JSON.stringify(draft)}, "${locale}", [], "published", null, ${locale === "en"})`, sessionId);
            const page = await browser.eval<string>(`(${readable})()`, sessionId);
            const missing = missingFacts(facts, page).map((fact: { kind: string; text: string }) => `${fact.kind} "${fact.text.slice(0, 40)}"`);
            assert.deepEqual(missing, [], `${templateId} / ${label} / ${locale} @${width}: facts missing from the page`);
          }
        }
      }
    }
  } finally {
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
    await closeBrowser(browser);
  }
});

test("the visitor facts expect a certificate's description when the status table is mounted", () => {
  const draft = moldingDraft({ certifications: "table" }, "screwfast");
  const facts = expectedFacts(draft, "zh").filter((fact: { kind: string }) => fact.kind === "certifications body").map((fact: { text: string }) => fact.text);
  assert.deepEqual(facts, ["质量管理体系", "汽车行业质量管理体系"]);
  const badges = expectedFacts(moldingDraft({ certifications: "badges" }, "screwfast"), "zh").filter((fact: { kind: string }) => fact.kind === "certifications body");
  assert.deepEqual(badges, [], "badges show name and status only");
});

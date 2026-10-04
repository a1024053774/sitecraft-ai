import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { blockCatalog } from "../lib/blocks/catalog.ts";
import { checkVariantRequirements } from "../lib/blocks/requirements.ts";
import type { SiteDraft } from "../lib/site-document.ts";
import { packDraft, withLayouts } from "./fixtures/pack-drafts.ts";
import { base, openBrowser } from "./helpers/workspace-browser.ts";

// T-101: T-089 made the body line length a hard gate on the published page (about 40 characters of
// Chinese, 75 of English on one rendered line). The product summaries (a run of parameter sentences)
// and the commercial term values had no line-length cap and ran past it on wide screens. This measures
// with the gate's own scan (scripts/visitor-layout-scan.js, not a second counter): every product layout
// and every commercial-terms layout, on two looks, both languages, at three widths.

const scanSource = readFileSync(new URL("../scripts/visitor-layout-scan.js", import.meta.url), "utf8")
  .replace("export function", "function")
  .replace("export default scanVisitorLayout;", "");
const t = (zh: string, en: string) => ({ zh, en });

// Real wording from the 12 published sites that failed the gate (T-101).
const SUMMARIES = [
  t("速比 i=25–100，额定输出扭矩 8500 N·m，中心距 200 mm，输入转速 ≤1500 r/min，底脚或法兰安装，防护等级 IP65。", "Ratio i=25–100, rated output torque 8500 N·m, center distance 200 mm, input speed up to 1500 r/min, foot or flange mounting, protection class IP65."),
  t("适用 PA66+GF、POM、PBT、PC，单件重量 0.5–350 g，尺寸公差 ±0.02 mm，表面处理咬花、喷砂或高光。", "Suitable for PA66+GF, POM, PBT and PC, part weight 0.5–350 g, tolerance ±0.02 mm, textured, blasted or polished surface."),
  t("管外径 6–22 mm，额定压力 16 MPa，主体材质 316，工作温度 −20–180 ℃，卡套硬度 HRC 20–24。", "Tube OD 6–22 mm, rated pressure 16 MPa, body material 316, working temperature −20–180 °C, ferrule hardness HRC 20–24."),
  t("型腔数 1–32 腔，模具尺寸最大 900×1200 mm，热流道可选开放式或针阀式，模具寿命 50–100 万模次。", "1–32 cavities, mold size up to 900×1200 mm, open or valve-gate hot runner, mold life 500,000 to 1,000,000 shots."),
];
const TERMS = [
  { id: "moq", kind: "moq", value: t("注塑件 5000 件起；模具单套起接，样品阶段含 3 次试模与全尺寸检测报告", "Molded parts from 5,000 pcs; molds from one set, the sample stage includes three trials and a full-dimension report") },
  { id: "capacity", kind: "capacity", value: t("模具年产约 180 套；注塑机 42 台（90–800 t），月注塑能力约 600 万件", "About 180 mold sets per year; 42 molding machines (90–800 t), about 6 million molded parts per month") },
  { id: "lead-time", kind: "lead_time", value: t("模具 25–55 天；批量注塑件在模具确认后 15–20 天", "Molds 25–55 days; volume molded parts 15–20 days after mold approval") },
];

function draftFor(block: "products" | "commercialTerms", variant: string, templateId: string): SiteDraft | null {
  for (const pack of ["molding", "industrial"] as const) {
    const draft = withLayouts(packDraft(pack), { [block]: variant });
    draft.products = draft.products.map((product, index) => ({ ...product, summary: SUMMARIES[index % SUMMARIES.length] })) as typeof draft.products;
    draft.content.commercialTerms = TERMS as typeof draft.content.commercialTerms;
    if (checkVariantRequirements(draft, block, variant).ok) return { ...draft, templateId } as SiteDraft;
  }
  return null;
}

test("product summaries and commercial term values stay within the body line length in every layout, language and width", async () => {
  const browser = await openBrowser();
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" }) as { targetId: string };
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
  const tooLong: string[] = [];
  let measured = 0;
  try {
    await browser.send("Page.enable", {}, sessionId);
    await browser.send("Runtime.enable", {}, sessionId);
    for (const templateId of ["screwfast", "landwind"]) {
      await browser.send("Page.navigate", { url: `${base}/api/templates/${templateId}/preview?line-length=${Date.now()}` }, sessionId);
      for (let waited = 0; waited < 30000; waited += 100) {
        if (await browser.eval<boolean>("document.readyState === 'complete' && typeof window.__sitecraftApplyDeclared === 'function'", sessionId).catch(() => false)) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      for (const block of ["products", "commercialTerms"] as const) {
        for (const variant of Object.keys(blockCatalog[block].variants)) {
          const draft = draftFor(block, variant, templateId);
          assert.ok(draft, `${block}:${variant} fits a sample company`);
          for (const locale of ["zh", "en"] as const) {
            for (const width of [1440, 768, 375]) {
              await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);
              await browser.eval(`window.__sitecraftApplyDeclared(${JSON.stringify(draft)}, "${locale}", [], "published", null, ${locale === "en"})`, sessionId);
              const lines = await browser.eval<Array<{ block: string; text: string; count: number; max: number; tooLong: boolean }>>(`(() => { ${scanSource}; return scanVisitorLayout(document).bodyLineLength.filter((line) => line.block === "${block}"); })()`, sessionId);
              measured += lines.length;
              for (const line of lines.filter((item) => item.tooLong)) tooLong.push(`${templateId} ${block}:${variant} ${locale} @${width}: ${line.count}>${line.max} "${line.text.slice(0, 40)}"`);
            }
          }
        }
      }
    }
  } finally {
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
    try { browser.ws.send(JSON.stringify({ id: browser.id++, method: "Browser.close" })); } catch {}
    browser.ws.close();
  }
  assert.ok(measured > 200, `many lines were measured (${measured})`);
  assert.deepEqual(tooLong, [], "lines over the gate");
});

// Review round 1 (T-101): with the cap alone a wide card left the right side empty, and a Chinese word
// could break in the middle ("密封材 / 料 FKM"). A card wide enough pairs its parameters with the summary
// column; the summary breaks only at spaces and punctuation, and a long run still cannot overflow.
const PHRASES = ["密封材料", "十万级洁净车间", "主体材质", "额定输出扭矩"];
const WORD_SUMMARIES = [
  t("通径 DN8–DN25，额定压力 2.5 MPa，主体材质 316L，密封材料 FKM。", "Size DN8–DN25, rated pressure 2.5 MPa, body material 316L, sealing material FKM."),
  t("适用 PMMA、PC、COC，透光率 ≥90%（PMMA 2 mm 厚），在十万级洁净车间成型。", "For PMMA, PC and COC, light transmission ≥90% (PMMA 2 mm thick), molded in a Class 100,000 clean room."),
  t("速比 i=4–100，额定输出扭矩 3200 N·m，机座号 F280，输入转速 ≤3000 r/min，法兰安装，防护等级 IP65。", "Ratio i=4–100, rated output torque 3200 N·m, frame F280, input speed up to 3000 r/min, flange mounting, IP65."),
  t(`${"PA66+GF/POM/PBT/PC/PMMA/COC/LCP/PPS/PEEK/PSU/".repeat(4)}`, "A very long unbroken specification string must wrap instead of running out of its card: " + "PA66+GF/POM/PBT/PC/PMMA/".repeat(6)),
];

test("a wide product card pairs its parameters with the summary; a narrow one stacks; no Chinese word breaks inside a line", async () => {
  const browser = await openBrowser();
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" }) as { targetId: string };
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
  const problems: string[] = [];
  try {
    await browser.send("Page.enable", {}, sessionId);
    await browser.send("Runtime.enable", {}, sessionId);
    for (const templateId of ["screwfast", "landwind"]) {
      await browser.send("Page.navigate", { url: `${base}/api/templates/${templateId}/preview?line-pairing=${Date.now()}` }, sessionId);
      for (let waited = 0; waited < 30000; waited += 100) {
        if (await browser.eval<boolean>("document.readyState === 'complete' && typeof window.__sitecraftApplyDeclared === 'function'", sessionId).catch(() => false)) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      for (const variant of ["cards", "rows"]) {
        const draft = draftFor("products", variant, templateId);
        assert.ok(draft);
        draft.products = draft.products.map((product, index) => ({ ...product, summary: WORD_SUMMARIES[index % WORD_SUMMARIES.length] })) as typeof draft.products;
        for (const locale of ["zh", "en"] as const) {
          for (const width of [1440, 1024, 768, 375]) {
            await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);
            await browser.eval(`window.__sitecraftApplyDeclared(${JSON.stringify(draft)}, "${locale}", [], "published", null, ${locale === "en"})`, sessionId);
            const result = await browser.eval<{ pageWidth: number; viewport: number; cards: Array<{ cardWidth: number; summaryLeft: number; keysRight: number; summaryTop: number; keysBottom: number; summaryRight: number; cardRight: number }>; broken: string[] }>(`(() => {
              const phrases = ${JSON.stringify(PHRASES)};
              const block = document.querySelector('[data-sc-block="products"]');
              const range = document.createRange();
              const broken = [];
              const cards = [...block.querySelectorAll('.sitecraft-product-card')].map((card) => {
                const summary = card.querySelector('.sitecraft-product-summary');
                const keys = card.querySelector('.sitecraft-product-keys');
                if (summary) {
                  const text = summary.textContent;
                  const node = summary.firstChild;
                  for (const phrase of phrases) {
                    const at = text.indexOf(phrase);
                    if (at < 0 || !node) continue;
                    const tops = new Set();
                    for (let i = at; i < at + phrase.length; i++) { range.setStart(node, i); range.setEnd(node, i + 1); tops.add(Math.round(range.getBoundingClientRect().top)); }
                    if (tops.size > 1) broken.push(phrase);
                  }
                }
                const c = card.getBoundingClientRect(), s = summary ? summary.getBoundingClientRect() : { left: 0, top: 0, right: 0 }, k = keys ? keys.getBoundingClientRect() : { right: 0, bottom: 0 };
                return { cardWidth: Math.round(c.width), summaryLeft: Math.round(s.left), keysRight: Math.round(k.right), summaryTop: Math.round(s.top), keysBottom: Math.round(k.bottom), summaryRight: Math.round(s.right), cardRight: Math.round(c.right) };
              });
              return { pageWidth: document.documentElement.scrollWidth, viewport: innerWidth, cards, broken };
            })()`, sessionId);
            const where = `${templateId} products:${variant} ${locale} @${width}`;
            if (result.pageWidth > result.viewport + 1) problems.push(`${where}: page scrolls sideways`);
            if (locale === "zh") for (const phrase of result.broken) problems.push(`${where}: "${phrase}" broken across lines`);
            for (const card of result.cards) {
              if (card.summaryRight > card.cardRight + 1) problems.push(`${where}: a summary runs out of its card`);
              if (card.cardWidth >= 860) {
                if (card.summaryLeft < card.keysRight) problems.push(`${where}: a ${card.cardWidth}px card does not pair the summary beside the parameters`);
              } else if (card.summaryTop < card.keysBottom) problems.push(`${where}: a ${card.cardWidth}px card does not stack the summary under the parameters`);
            }
            if (variant === "rows" && width >= 1024 && !result.cards.some((card) => card.cardWidth >= 860)) problems.push(`${where}: no wide card to check`);
          }
        }
      }
    }
  } finally {
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
    try { browser.ws.send(JSON.stringify({ id: browser.id++, method: "Browser.close" })); } catch {}
    browser.ws.close();
  }
  assert.deepEqual(problems, []);
});

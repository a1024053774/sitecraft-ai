import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { packDraft } from "./fixtures/pack-drafts.ts";
import { openBrowser } from "./helpers/workspace-browser.ts";
import { expectedFacts, missingFacts } from "../scripts/published-facts.mjs";

const closeBrowser = (browser: { ws: WebSocket; id: number }) => {
  browser.ws.close();
};

async function preview(draft: unknown, width = 375) {
  const browser = await openBrowser();
  const { targetId } = await browser.send("Target.createTarget", { url: `http://127.0.0.1:3034/api/templates/tailwind-landing/preview?t057=${Date.now()}` }) as { targetId: string };
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
  await browser.send("Page.enable", {}, sessionId);
  await browser.send("Runtime.enable", {}, sessionId);
  await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);
  for (let waited = 0; waited < 15000; waited += 100) {
    if (await browser.eval<boolean>("document.readyState === 'complete' && typeof window.__sitecraftApplyDeclared === 'function'", sessionId).catch(() => false)) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  await browser.eval(`window.__sitecraftApplyDeclared(${JSON.stringify(draft)}, "zh", [], "published", null, false)`, sessionId);
  return { browser, targetId, sessionId };
}

test("hero titles use Intl.Segmenter words instead of a hard-coded product list", async () => {
  const draft = { ...packDraft("molding"), templateId: "tailwind-landing", content: { ...packDraft("molding").content, hero: { ...packDraft("molding").content.hero, title: { zh: "精密注塑制造装备", en: "Precision molding equipment" } } } };
  const { browser, targetId, sessionId } = await preview(draft, 1440);
  try {
    const result = await browser.eval<{ spans: string[]; text: string }>(`(() => ({
      spans: [...document.querySelectorAll('[data-sc-block="hero"] h1 span')].map((node) => node.textContent),
      text: document.querySelector('[data-sc-block="hero"] h1')?.textContent || "",
    }))()`, sessionId);
    assert.equal(result.text, "精密注塑制造装备");
    assert.deepEqual(result.spans, ["精密", "注塑", "制造", "装备"]);
  } finally {
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
    closeBrowser(browser);
  }
});

test("the title scanner catches a wrapped word inside a span, including a repeated occurrence", async () => {
  const source = readFileSync("scripts/visitor-layout-scan.js", "utf8").replace("export function", "function").replace("export default scanVisitorLayout;", "");
  const browser = await openBrowser();
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" }) as { targetId: string };
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
  try {
    await browser.send("Runtime.enable", {}, sessionId);
    await browser.send("Page.enable", {}, sessionId);
    const frameId = (await browser.send("Page.getFrameTree", {}, sessionId) as { frameTree: { frame: { id: string } } }).frameTree.frame.id;
    await browser.send("Page.setDocumentContent", { frameId, html: `<html><body><section data-sc-block="hero"><h1 style="width:44px;margin:0;font:32px/36px sans-serif;overflow-wrap:anywhere"><span style="white-space:normal">注塑</span>与<span style="white-space:normal">注塑</span></h1></section></body></html>` }, sessionId);
    const result = await browser.eval<{ heroTitleWordBreak: boolean }>(`(() => { ${source}; return scanVisitorLayout(document); })()`, sessionId);
    assert.equal(result.heroTitleWordBreak, true);
  } finally {
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
    closeBrowser(browser);
  }
});

test("a visible unmarked layer covering link text is reported as covered", async () => {
  const source = readFileSync("scripts/visitor-text-fit-scan.js", "utf8").trim();
  const browser = await openBrowser();
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" }) as { targetId: string };
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
  try {
    await browser.send("Runtime.enable", {}, sessionId);
    await browser.send("Page.enable", {}, sessionId);
    const frameId = (await browser.send("Page.getFrameTree", {}, sessionId) as { frameTree: { frame: { id: string } } }).frameTree.frame.id;
    await browser.send("Page.setDocumentContent", { frameId, html: `<html><body style="margin:0"><a id="copy" href="#" style="position:absolute;left:20px;top:20px;width:140px;height:32px;font:20px/32px sans-serif">正文链接</a><div style="position:absolute;z-index:5;left:20px;top:20px;width:140px;height:32px;background:#fff"></div></body></html>` }, sessionId);
    const result = await browser.eval<Array<{ kind: string }>>(`(() => (${source})(document.body))()`, sessionId);
    assert.ok(result.some((item) => item.kind === "covered"), JSON.stringify(result));
  } finally {
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
    closeBrowser(browser);
  }
});

test("closed navigation details are not painted, while visible link text remains covered-checkable", async () => {
  const source = readFileSync("scripts/visitor-text-fit-scan.js", "utf8").trim();
  const browser = await openBrowser();
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" }) as { targetId: string };
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
  try {
    await browser.send("Runtime.enable", {}, sessionId);
    await browser.send("Page.enable", {}, sessionId);
    const frameId = (await browser.send("Page.getFrameTree", {}, sessionId) as { frameTree: { frame: { id: string } } }).frameTree.frame.id;
    await browser.send("Page.setDocumentContent", { frameId, html: `<html><body style="margin:0"><header><details><summary>菜单</summary><a href="#" style="position:absolute;left:20px;top:20px;width:140px;height:32px">隐藏导航</a><div style="position:absolute;z-index:5;left:20px;top:20px;width:140px;height:32px;background:#fff"></div></details></header><a href="#" style="position:absolute;left:20px;top:80px;width:140px;height:32px;font:20px/32px sans-serif">可见链接</a><div style="position:absolute;z-index:5;left:20px;top:80px;width:140px;height:32px;background:#fff"></div></body></html>` }, sessionId);
    const result = await browser.eval<Array<{ kind: string; text: string }>>(`(() => (${source})(document.body))()`, sessionId);
    assert.ok(result.some((item) => item.kind === "covered" && item.text === "可见链接"), JSON.stringify(result));
    assert.ok(!result.some((item) => item.text === "隐藏导航"), JSON.stringify(result));
  } finally {
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
    closeBrowser(browser);
  }
});

test("certification bodies are expected for cards and omitted for badges", () => {
  const cards = { ...packDraft("export"), templateId: "tailwind-landing", blockVariants: { certifications: "cards" }, content: { ...packDraft("export").content, certifications: { title: { zh: "认证", en: "Certifications" }, intro: { zh: "", en: "" }, items: [{ id: "iso", title: { zh: "ISO 9001", en: "ISO 9001" }, body: { zh: "认证中", en: "In progress" }, status: "认证中" }] } } };
  const cardFacts = expectedFacts(cards);
  assert.ok(cardFacts.some((fact) => fact.kind === "certifications body" && fact.text === "认证中"));
  assert.ok(missingFacts(cardFacts, "ISO 9001").some((fact) => fact.kind === "certifications body"));
  const badges = { ...cards, blockVariants: { certifications: "badges" } };
  assert.ok(!expectedFacts(badges).some((fact) => fact.kind === "certifications body"));
});

test("short-path product values stay inside their cards at all published widths", async () => {
  const draft = { ...packDraft("molding"), templateId: "tailwind-landing" };
  for (const width of [1440, 768, 375]) {
    const { browser, targetId, sessionId } = await preview(draft, width);
    try {
      const failures = await browser.eval<Array<{ text: string; right: number; cardRight: number; lineRight: number }>>(`(() => [...document.querySelectorAll('.sitecraft-product-card')].flatMap((card) => {
        const cardRight = card.getBoundingClientRect().right;
        return [...card.querySelectorAll('.sitecraft-product-key dd')].flatMap((value) => {
          const box = value.getBoundingClientRect();
          const range = document.createRange(); range.selectNodeContents(value);
          return [...range.getClientRects()].filter((line) => line.width > .5).map((line) => ({ text: value.textContent || "", right: box.right, cardRight, lineRight: line.right })).filter((line) => line.lineRight > cardRight + 1 || line.right > cardRight + 1);
        });
      }))()`, sessionId);
      assert.deepEqual(failures, [], `${width}: ${JSON.stringify(failures)}`);
    } finally {
      await browser.send("Target.closeTarget", { targetId }).catch(() => {});
      closeBrowser(browser);
    }
  }
});

test("short-path no-draft pages keep only real shell/form copy and sent inquiry stays green", async () => {
  const { browser, targetId, sessionId } = await preview(undefined, 375);
  try {
    const result = await browser.eval<{ text: string; visibleSections: string[]; sentColor: string; errorColor: string }>(`(() => {
      window.__sitecraftApplyDeclared(undefined, "zh", [], "thumbnail", null, false);
      const form = document.querySelector('[data-sitecraft-inquiry="true"]');
      const status = document.createElement('p'); status.className = 'sitecraft-inquiry-status'; status.textContent = '已发送'; form?.appendChild(status); form?.setAttribute('data-sitecraft-inquiry-state', 'sent');
      const sentColor = getComputedStyle(status).color;
      form?.setAttribute('data-sitecraft-inquiry-state', 'error');
      const errorColor = getComputedStyle(status).color;
      return { text: document.body.innerText, visibleSections: [...document.querySelectorAll('[data-sitecraft-section]')].filter((node) => !node.hasAttribute('hidden')).map((node) => node.getAttribute('data-sitecraft-section') || ''), sentColor, errorColor };
    })()`, sessionId);
    assert.doesNotMatch(result.text, /用最短路径|产品要点|只展示|按资料/);
    assert.ok(result.visibleSections.includes("contact"));
    assert.notEqual(result.sentColor, result.errorColor);
  } finally {
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
    closeBrowser(browser);
  }
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { packDraft } from "./fixtures/pack-drafts.ts";
import { closeBrowser, waitForPreviewBridge, base as sitecraftBase, openBrowser } from "./helpers/workspace-browser.ts";
import { engineeringLook } from "../lib/blocks/looks/engineering.ts";

const fitSource = readFileSync("scripts/visitor-text-fit-scan.js", "utf8");

test("T-063 uses declared character CSS sizing without a look-specific selector", () => {
  assert.equal(engineeringLook.fitText, "container");
  const bridge = readFileSync("lib/template-adapters/preview-bridge.ts", "utf8");
  const hero = readFileSync("lib/blocks/fragments/hero.ts", "utf8");
  const nav = readFileSync("lib/blocks/fragments/nav.ts", "utf8");
  assert.match(bridge, /longestRunEm/);
  assert.match(bridge, /--sitecraft-title-run/);
  assert.match(bridge, /--sitecraft-brand-run/);
  assert.match(hero, /container-type:\s*inline-size/);
  assert.match(hero, /100cqw/);
  assert.match(nav, /100cqw/);
  assert.doesNotMatch(nav, /80px/);
  assert.doesNotMatch(hero, /sitecraft-look-engineering/);
  assert.doesNotMatch(nav, /sitecraft-look-engineering/);
});

test("run width sizing does not shrink breakable long sentences or couple brand size to the title", async () => {
  const browser = await openBrowser();
  const { targetId } = await browser.send("Target.createTarget", { url: `${sitecraftBase}/api/templates/screwfast/preview?t063-run=${Date.now()}` }) as { targetId: string };
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
  try {
    await browser.send("Runtime.enable", {}, sessionId);
    await waitForPreviewBridge(browser, sessionId, 15000, 't063-hero-title-fit.test');
    const base = packDraft("molding");
    const breakable = structuredClone(base);
    breakable.companyName = "宁海精密注塑模具P3T";
    breakable.content.hero.title = { zh: "精密注塑模具 可在空白处换行", en: "Molds with a description that wraps at spaces" };
    const compact = structuredClone(breakable);
    compact.content.hero.title = { zh: "精密注塑模具", en: "Precision injection molds" };
    await browser.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
    await browser.eval(`window.__sitecraftApplyDeclared(${JSON.stringify(breakable)}, "zh", [], "published", null, true); document.fonts.ready`, sessionId);
    const longSentence = await browser.eval<{ titleSize: string; brandSize: string; titleRun: string; brandRun: string }>(`(()=>{const h=document.querySelector('.sitecraft-hero h1'),b=document.querySelector('.sitecraft-brand-name');return {titleSize:getComputedStyle(h).fontSize,brandSize:getComputedStyle(b).fontSize,titleRun:h.style.getPropertyValue('--sitecraft-title-run'),brandRun:b.style.getPropertyValue('--sitecraft-brand-run')}})()`, sessionId);
    await browser.eval(`window.__sitecraftApplyDeclared(${JSON.stringify(compact)}, "zh", [], "published", null, true); document.fonts.ready`, sessionId);
    const shortTitle = await browser.eval<{ titleSize: string; brandSize: string }>(`(()=>{const h=document.querySelector('.sitecraft-hero h1'),b=document.querySelector('.sitecraft-brand-name');return {titleSize:getComputedStyle(h).fontSize,brandSize:getComputedStyle(b).fontSize}})()`, sessionId);
    assert.equal(longSentence.titleSize, shortTitle.titleSize, JSON.stringify({ longSentence, shortTitle }));
    assert.equal(longSentence.brandSize, shortTitle.brandSize, JSON.stringify({ longSentence, shortTitle }));
    assert.match(longSentence.titleRun, /\d/);
    assert.match(longSentence.brandRun, /\d/);
  } finally {
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
    await closeBrowser(browser);
  }
});

test("original engineering titles and company name fit in every published viewport", async () => {
  const browser = await openBrowser();
  const { targetId } = await browser.send("Target.createTarget", { url: `${sitecraftBase}/api/templates/screwfast/preview?t063=${Date.now()}` }) as { targetId: string };
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
  try {
    await browser.send("Runtime.enable", {}, sessionId);
    await waitForPreviewBridge(browser, sessionId, 15000, 't063-hero-title-fit.test');
    const draft = packDraft("molding");
    draft.companyName = "宁海精密注塑模具P3T";
    draft.content.hero.title = { zh: "精密注塑模具与注塑件", en: "Precision injection molds and molded parts" };
    for (const width of [375, 768, 1440]) for (const locale of ["zh", "en"]) {
      await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width === 375 }, sessionId);
      await browser.eval(`window.__sitecraftApplyDeclared(${JSON.stringify(draft)}, ${JSON.stringify(locale)}, [], "published", null, true); document.fonts.ready`, sessionId);
      const failures = await browser.eval(`(${fitSource})(document.body).filter((item) => item.kind === "overflow" || item.kind === "clipped" || item.kind === "viewport")`, sessionId);
      assert.deepEqual(failures, [], `${locale} @${width}: ${JSON.stringify(failures)}`);
    }
  } finally {
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
    await closeBrowser(browser);
  }
});

test("long engineering brand keeps the readable floor and wraps instead of clipping at 375px", async () => {
  const browser = await openBrowser();
  const { targetId } = await browser.send("Target.createTarget", { url: `${sitecraftBase}/api/templates/screwfast/preview?t063-brand-floor=${Date.now()}` }) as { targetId: string };
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
  try {
    await browser.send("Runtime.enable", {}, sessionId);
    await waitForPreviewBridge(browser, sessionId, 15000, 't063-hero-title-fit.test');
    const draft = packDraft("molding");
    draft.companyName = "宁海精密注塑模具，海外销售中心，国际订单服务部";
    await browser.send("Emulation.setDeviceMetricsOverride", { width: 375, height: 900, deviceScaleFactor: 1, mobile: true }, sessionId);
    await browser.eval(`window.__sitecraftApplyDeclared(${JSON.stringify(draft)}, "zh", [], "published", null, true); document.fonts.ready`, sessionId);
    const result = await browser.eval<{ fontSize: number; scrollWidth: number; clientWidth: number; lineCount: number; whiteSpace: string; failures: unknown[] }>(`(()=>{const brand=document.querySelector('.sitecraft-brand-name');const range=document.createRange();range.selectNodeContents(brand);const lines=new Set([...range.getClientRects()].map((rect)=>Math.round(rect.top)));const failures=(${fitSource})(document.body).filter((item)=>item.kind==='overflow'||item.kind==='clipped'||item.kind==='viewport');return {fontSize:parseFloat(getComputedStyle(brand).fontSize),scrollWidth:brand.scrollWidth,clientWidth:brand.clientWidth,lineCount:lines.size,whiteSpace:getComputedStyle(brand).whiteSpace,failures}})()`, sessionId);
    assert.ok(result.fontSize >= 11, JSON.stringify(result));
    assert.ok(result.scrollWidth <= result.clientWidth + 1, JSON.stringify(result));
    assert.ok(result.lineCount >= 2, JSON.stringify(result));
    assert.deepEqual(result.failures, [], JSON.stringify(result));
  } finally {
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
    await closeBrowser(browser);
  }
});

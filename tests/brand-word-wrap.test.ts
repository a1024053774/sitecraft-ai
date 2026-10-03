import assert from "node:assert/strict";
import test from "node:test";
import { packDraft } from "./fixtures/pack-drafts.ts";
import { applySiteOperations } from "../lib/site-operations.ts";
import { base as sitecraftBase, openBrowser } from "./helpers/workspace-browser.ts";

test("the catalog look keeps the company name together at phone width", async () => {
  const browser = await openBrowser();
  const draft = applySiteOperations(packDraft("molding"), [{ op: "set_visual_brief", briefId: "export-catalog" }], {
    templateIds: new Set(["forge", "screwfast", "landwind", "tailwind-landing"]), lastChange: "brand-wrap",
  }).draft;
  draft.templateId = "landwind";
  draft.companyName = "宁海精密注塑模具P3T";
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" }) as { targetId: string };
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
  try {
    await browser.send("Page.enable", {}, sessionId);
    await browser.send("Runtime.enable", {}, sessionId);
    await browser.send("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 1, mobile: true }, sessionId);
    await browser.send("Page.navigate", { url: `${sitecraftBase}/api/templates/landwind/preview?brand-wrap=${Date.now()}` }, sessionId);
    for (let waited = 0; waited < 10000; waited += 100) {
      if (await browser.eval<boolean>("document.readyState === 'complete' && typeof window.__sitecraftApplyDeclared === 'function'", sessionId).catch(() => false)) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    await browser.eval(`window.__sitecraftApplyDeclared(${JSON.stringify(draft)}, "zh", [], "published", null, false)`, sessionId);
    const style = await browser.eval<{ split: boolean; wordBreak: string; wrap: string; overflow: boolean }>(`(() => {
      const node = document.querySelector('.sitecraft-brand-name');
      const text = node?.textContent || '';
      const target = '模具'; const at = text.indexOf(target);
      if (!node || at < 0) return { split: false, wordBreak: '', wrap: '', overflow: false };
      const range = document.createRange();
      range.setStart(node.firstChild, at); range.setEnd(node.firstChild, at + 1); const a = range.getBoundingClientRect();
      range.setStart(node.firstChild, at + 1); range.setEnd(node.firstChild, at + 2); const b = range.getBoundingClientRect();
      return { split: Math.abs(a.top - b.top) > 1, wordBreak: getComputedStyle(node).wordBreak, wrap: getComputedStyle(node).textWrap, overflow: node.scrollWidth > node.clientWidth + 1 };
    })()`, sessionId);
    assert.equal(style.split, false, "公司名不能在“模具”中间换行");
    assert.equal(style.overflow, false, "公司名不能溢出顶栏");
    assert.equal(style.wordBreak, "keep-all", "公司名使用整词断行规则");
  } finally {
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
    try { browser.ws.send(JSON.stringify({ id: browser.id++, method: "Browser.close" })); } catch {}
    browser.ws.close();
  }
});

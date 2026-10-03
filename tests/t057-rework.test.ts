import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { packDraft } from "./fixtures/pack-drafts.ts";
import { base as sitecraftBase, openBrowser } from "./helpers/workspace-browser.ts";
import { expectedFacts, missingFacts } from "../scripts/published-facts.mjs";

const closeBrowser = (browser: { ws: WebSocket; id: number }) => {
  browser.ws.close();
};

test("the Segmenter fallback keeps the authored hero title", () => {
  const source = readFileSync("lib/template-adapters/preview-bridge.ts", "utf8");
  assert.match(source, /if \(!segmenter\) \{[\s\S]{0,120}node\.textContent = value/);
});

async function preview(draft: unknown, width = 375) {
  const browser = await openBrowser();
  const { targetId } = await browser.send("Target.createTarget", { url: `${sitecraftBase}/api/templates/tailwind-landing/preview?t057=${Date.now()}` }) as { targetId: string };
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
  const draft = { ...packDraft("molding"), templateId: "tailwind-landing", content: { ...packDraft("molding").content, hero: { ...packDraft("molding").content.hero, title: { zh: "精密注塑模具与注塑件", en: "Precision molding equipment" } } } };
  const { browser, targetId, sessionId } = await preview(draft, 375);
  try {
    const result = await browser.eval<{ spans: string[]; text: string }>(`(() => ({
      spans: [...document.querySelectorAll('[data-sc-block="hero"] h1 span')].map((node) => node.textContent),
      text: document.querySelector('[data-sc-block="hero"] h1')?.textContent || "",
    }))()`, sessionId);
    assert.equal(result.text, "精密注塑模具与注塑件");
    assert.equal(Array.isArray(result.spans), true);
  } finally {
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
    closeBrowser(browser);
  }
});

test("a long short-path hero word stays inside a 375px viewport", async () => {
  const base = packDraft("export");
  const draft = { ...base, templateId: "tailwind-landing", content: { ...base.content, hero: { ...base.content.hero, title: { zh: "ElectromechanicalSuperLongModelNumber", en: "ElectromechanicalSuperLongModelNumber" } } } };
  const { browser, targetId, sessionId } = await preview(draft, 375);
  try {
    const result = await browser.eval<{ scrollWidth: number; innerWidth: number; right: number; wordRight: number }>(`(() => { const h=document.querySelector('[data-sc-block="hero"] h1'); const r=h.getBoundingClientRect(); const word=[...h.querySelectorAll('[data-sitecraft-hero-word]')].reduce((max,n)=>Math.max(max,n.getBoundingClientRect().right),0); return { scrollWidth:document.documentElement.scrollWidth, innerWidth, right:r.right, wordRight:word }; })()`, sessionId);
    assert.ok(result.scrollWidth <= result.innerWidth + 1, JSON.stringify(result));
    assert.ok(result.right <= result.innerWidth + 1, JSON.stringify(result));
    assert.ok(result.wordRight <= result.right + 1, JSON.stringify(result));
  } finally {
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
    closeBrowser(browser);
  }
});

test("an engineering title that is not orphaned keeps its original line grouping", async () => {
  const base = packDraft("industrial");
  const draft = { ...base, templateId: "screwfast", content: { ...base.content, hero: { ...base.content.hero, title: { zh: "按图加工重载减速机 P3I-NX7Q", en: "Heavy-duty gearbox P3I-NX7Q" } } } };
  const browser = await openBrowser();
  const { targetId } = await browser.send("Target.createTarget", { url: `${sitecraftBase}/api/templates/screwfast/preview?t057-title=${Date.now()}` }) as { targetId: string };
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
  try {
    await browser.send("Page.enable", {}, sessionId);
    await browser.send("Runtime.enable", {}, sessionId);
    await browser.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
    for (let waited = 0; waited < 15000; waited += 100) {
      if (await browser.eval<boolean>("document.readyState === 'complete' && typeof window.__sitecraftApplyDeclared === 'function'", sessionId).catch(() => false)) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    await browser.eval(`window.__sitecraftApplyDeclared(${JSON.stringify(draft)}, "zh", [], "published", null, false)`, sessionId);
    const lines = await browser.eval<string[]>(`(() => { const h=document.querySelector('[data-sc-block="hero"] h1'); const r=document.createRange(); const rows=new Map(); const w=document.createTreeWalker(h,NodeFilter.SHOW_TEXT); while(w.nextNode()){const n=w.currentNode; for(let i=0;i<n.textContent.length;i++){r.setStart(n,i);r.setEnd(n,i+1);const q=r.getBoundingClientRect();if(q.width>.5){const k=Math.round(q.top);rows.set(k,(rows.get(k)||"")+n.textContent[i]);}}} return [...rows.entries()].sort((a,b)=>a[0]-b[0]).map(([,text])=>text); })()`, sessionId);
    assert.ok(lines.some((line) => line.includes("重载减速机")), JSON.stringify(lines));
    assert.equal(await browser.eval<number>(`document.querySelectorAll('[data-sitecraft-hero-word]').length`, sessionId), 0);
    assert.equal(await browser.eval<string>(`document.querySelector('[data-sc-block="hero"] h1').style.textWrap`, sessionId), "");
  } finally {
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
    closeBrowser(browser);
  }
});

test("short-path word spans are declared, idempotent, and CSS reflows after a viewport change", async () => {
  const draft = { ...packDraft("molding"), templateId: "tailwind-landing" };
  const { browser, targetId, sessionId } = await preview(draft, 1440);
  try {
    const first = await browser.eval<{ html: string; spans: number }>(`(() => { const h=document.querySelector('[data-sc-block="hero"] h1'); return { html:h.innerHTML, spans:h.querySelectorAll('[data-sitecraft-hero-word]').length }; })()`, sessionId);
    assert.ok(first.spans > 0);
    await browser.eval(`window.__sitecraftApplyDeclared(${JSON.stringify(draft)}, "zh", [], "published", null, false)`, sessionId);
    assert.equal(await browser.eval<string>(`document.querySelector('[data-sc-block="hero"] h1').innerHTML`, sessionId), first.html);
    await browser.send("Emulation.setDeviceMetricsOverride", { width: 375, height: 900, deviceScaleFactor: 1, mobile: true }, sessionId);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const narrow = await browser.eval<{ orphan: boolean; wordBreak: boolean }>(`(() => { ${readFileSync("scripts/visitor-layout-scan.js", "utf8").replace("export function", "function").replace("export default scanVisitorLayout;", "")}; const r=scanVisitorLayout(document); return { orphan:r.heroTitleOrphan, wordBreak:r.heroTitleWordBreak }; })()`, sessionId);
    assert.equal(narrow.orphan, false);
    assert.equal(narrow.wordBreak, false);
  } finally {
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
    closeBrowser(browser);
  }
});

test("short-path hero never leaves the conjunction at the end of a line", async () => {
  const draft = { ...packDraft("molding"), templateId: "tailwind-landing" };
  const layoutSource = readFileSync("scripts/visitor-layout-scan.js", "utf8").replace("export function", "function").replace("export default scanVisitorLayout;", "");
  for (const width of [375, 768, 1440]) {
    const { browser, targetId, sessionId } = await preview(draft, width);
    try {
      const result = await browser.eval<{ lines: string[]; orphan: boolean; wordBreak: boolean }>(`(() => { const h=document.querySelector('[data-sc-block="hero"] h1'); const r=document.createRange(), rows=new Map(), w=document.createTreeWalker(h,NodeFilter.SHOW_TEXT); while(w.nextNode()){const n=w.currentNode; for(let i=0;i<n.textContent.length;i++){r.setStart(n,i);r.setEnd(n,i+1);const q=r.getBoundingClientRect();if(q.width>.5){const k=Math.round(q.top);rows.set(k,(rows.get(k)||"")+n.textContent[i]);}}} ${layoutSource}; const scan=scanVisitorLayout(document); return { lines:[...rows.entries()].sort((a,b)=>a[0]-b[0]).map(([,text])=>text), orphan:scan.heroTitleOrphan, wordBreak:scan.heroTitleWordBreak }; })()`, sessionId);
      assert.ok(result.lines.every((line) => !line.endsWith("与")), `${width}: ${JSON.stringify(result)}`);
      assert.equal(result.orphan, false, `${width}: ${JSON.stringify(result)}`);
      assert.equal(result.wordBreak, false, `${width}: ${JSON.stringify(result)}`);
    } finally {
      await browser.send("Target.closeTarget", { targetId }).catch(() => {});
      closeBrowser(browser);
    }
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
    await browser.send("Page.setDocumentContent", { frameId, html: `<html><body><section data-sc-block="hero"><h1 style="width:200px;margin:0;font:32px/36px sans-serif;overflow-wrap:anywhere"><span>注</span><br><span>塑</span>与<span>注塑</span></h1></section></body></html>` }, sessionId);
    const result = await browser.eval<{ heroTitleWordBreak: boolean }>(`(() => { ${source}; return scanVisitorLayout(document); })()`, sessionId);
    assert.equal(result.heroTitleWordBreak, true);
  } finally {
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
    closeBrowser(browser);
  }
});

test("the shared title scan reports an orphan line and allows an overlong word to break", async () => {
  const source = readFileSync("scripts/hero-word-break-scan.js", "utf8").trim();
  const layoutSource = readFileSync("scripts/visitor-layout-scan.js", "utf8").replace("export function", "function").replace("export default scanVisitorLayout;", "");
  const checkSource = readFileSync("scripts/check-published.mjs", "utf8");
  assert.match(checkSource, /heroOrphan/);
  assert.match(checkSource, /hero-word-break-scan\.js/);
  const browser = await openBrowser();
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" }) as { targetId: string };
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
  try {
    await browser.send("Runtime.enable", {}, sessionId);
    await browser.send("Page.enable", {}, sessionId);
    const frameId = (await browser.send("Page.getFrameTree", {}, sessionId) as { frameTree: { frame: { id: string } } }).frameTree.frame.id;
    await browser.send("Page.setDocumentContent", { frameId, html: `<html><body><section data-sc-block="hero"><h1 style="width:343px;margin:0;font:40px/1 sans-serif;text-wrap:balance"><span>精密</span><span>注塑</span><span>模具</span><span>与</span><span>注塑</span><br><span>件</span></h1></section></body></html>` }, sessionId);
    const orphan = await browser.eval<{ heroTitleOrphan: boolean; heroTitleWordBreak: boolean }>(`(() => { ${layoutSource}; return scanVisitorLayout(document); })()`, sessionId);
    assert.equal(orphan.heroTitleOrphan, true);
    await browser.send("Page.setDocumentContent", { frameId, html: `<html><body><section data-sc-block="hero"><h1 style="width:120px;margin:0;font:32px/36px monospace;overflow-wrap:anywhere"><span style="white-space:normal;word-break:keep-all;overflow-wrap:anywhere">Electromechanical</span></h1></section></body></html>` }, sessionId);
    const overlong = await browser.eval<{ heroTitleWordBreak: boolean; result: { heroTitleWordBreak: boolean } }>(`(() => { const result = (${source})(document.querySelector('h1')); ${layoutSource}; return { heroTitleWordBreak: scanVisitorLayout(document).heroTitleWordBreak, result }; })()`, sessionId);
    assert.equal(overlong.result.heroTitleWordBreak, false);
    assert.equal(overlong.heroTitleWordBreak, false);
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

test("coverage follows the painted stacking order and catches pointer-free covers", async () => {
  const source = readFileSync("scripts/visitor-text-fit-scan.js", "utf8").trim();
  const cases = [
    ["upper", '<p id="copy" style="z-index:1">正文</p><div id="cover" style="z-index:2"></div>', true],
    ["lower", '<p id="copy" style="z-index:2">无遮挡正文</p><div id="cover" style="z-index:1;background:#ddd"></div>', false],
    ["transparent", '<p id="copy" style="z-index:1">无遮挡正文</p><div id="cover" style="z-index:2;opacity:0"></div>', false],
    ["pointer-free", '<p id="copy" style="z-index:1">被遮挡正文</p><div id="cover" style="z-index:2;pointer-events:none"></div>', true],
  ] as const;
  const browser = await openBrowser();
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" }) as { targetId: string };
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
  try {
    await browser.send("Runtime.enable", {}, sessionId);
    await browser.send("Page.enable", {}, sessionId);
    const frameId = (await browser.send("Page.getFrameTree", {}, sessionId) as { frameTree: { frame: { id: string } } }).frameTree.frame.id;
    for (const [, body, expected] of cases) {
      await browser.send("Page.setDocumentContent", { frameId, html: `<html><head><style>body{margin:0}h1,p{margin:0}#copy,#cover{position:absolute;left:20px;top:40px;width:160px;height:32px;font:24px/32px sans-serif;background:#fff}</style></head><body>${body}</body></html>` }, sessionId);
      const result = await browser.eval<Array<{ kind: string }>>(`(() => (${source})(document.body))()`, sessionId);
      assert.equal(result.some((item) => item.kind === "covered"), expected, JSON.stringify(result));
    }
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
      const failures = await browser.eval<{ failures: Array<{ text: string; right: number; cardRight: number; lineRight: number }>; root: string; flex: string }>(`(() => { const root = document.querySelector('.sitecraft-page')?.className || ''; const values = [...document.querySelectorAll('.sitecraft-product-card')]; const flex = getComputedStyle(values[0]?.querySelector('.sitecraft-product-key dd')).flex; const failures = values.flatMap((card) => {
        const cardRight = card.getBoundingClientRect().right;
        return [...card.querySelectorAll('.sitecraft-product-key dd')].flatMap((value) => {
          const box = value.getBoundingClientRect();
          const range = document.createRange(); range.selectNodeContents(value);
          return [...range.getClientRects()].filter((line) => line.width > .5).map((line) => ({ text: value.textContent || "", right: box.right, cardRight, lineRight: line.right })).filter((line) => line.lineRight > cardRight + 1 || line.right > cardRight + 1);
        });
      }); return { failures, root, flex }; })()`, sessionId);
      assert.deepEqual(failures.failures, [], `${width}: ${JSON.stringify(failures.failures)}`);
      if (width === 375) {
        assert.match(failures.root, /sitecraft-look-technical-product/);
        assert.equal(failures.flex, "1 1 auto");
      }
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

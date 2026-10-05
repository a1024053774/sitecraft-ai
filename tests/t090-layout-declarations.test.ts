import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import test from "node:test";
import { closeBrowser, openBrowser } from "./helpers/workspace-browser.ts";
import { packDraft, withLayouts } from "./fixtures/pack-drafts.ts";

const scanSource = readFileSync(process.env.T090_SCAN_SOURCE || new URL("../scripts/visitor-layout-scan.js", import.meta.url), "utf8")
  .replace("export function", "function")
  .replace("export default scanVisitorLayout;", "");

function extractJudge(source: string) {
  const start = source.indexOf("function judge(");
  const end = source.indexOf("\n  return failures;\n}", start) + "\n  return failures;\n}".length;
  if (start < 0 || end < 0) throw new Error("could not extract check-published judge");
  return source.slice(start, end);
}

test("T-090 declared layout rules reject baseline, spacing, duplicate primary, and vague CTA defects", async () => {
  const browser = await openBrowser();
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" }) as { targetId: string };
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
  const declaration = {
    baselineGroups: [
      { id: "headline-meta", selectors: ["#baseline-a", "#baseline-b"] },
      { id: "headline-pass", selectors: ["#baseline-pass-a", "#baseline-pass-b"] },
    ],
    semanticGroups: [
      { id: "first", selectors: ["#first-a", "#first-b"] },
      { id: "second", selectors: ["#second-a", "#second-b"] },
    ],
    buttonRoles: { primary: ["#primary-one", "#primary-two"], secondary: ["#secondary"] },
  };
  const html = `<!doctype html><html><body>
    <style>
      body { margin: 0; font-family: sans-serif; }
      [data-sc-block] { padding: 8px; }
      #baseline { display: flex; align-items: baseline; height: 44px; }
      #baseline-a { font: 16px/20px sans-serif; }
      #baseline-b { font: 32px/40px sans-serif; transform: translateY(4px); }
      #baseline-pass { display: flex; align-items: baseline; height: 44px; }
      #baseline-pass-a { font: 16px/20px sans-serif; }
      #baseline-pass-b { font: 32px/40px sans-serif; }
      #groups { display: flex; flex-direction: column; gap: 12px; }
      .group { display: flex; gap: 24px; }
      .group span { display: inline-block; }
      #primary-one, #primary-two, #secondary { display: inline-block; padding: 4px 8px; }
    </style>
    <section data-sc-block="fixture" data-sc-variant="declared" data-sc-layout-declaration='${JSON.stringify(declaration)}'>
      <div id="baseline"><span id="baseline-a">小字</span><span id="baseline-b">大字</span></div>
      <div id="baseline-pass"><span id="baseline-pass-a">小字</span><span id="baseline-pass-b">大字</span></div>
      <div id="groups">
        <div class="group"><span id="first-a">A</span><span id="first-b">B</span></div>
        <div class="group"><span id="second-a">C</span><span id="second-b">D</span></div>
      </div>
      <a id="primary-one" href="#one">了解更多</a>
      <a id="primary-two" href="#two">Learn More</a>
      <a id="secondary" href="#products">查看产品</a>
    </section>
    <section data-sc-block="undeclared" data-sc-variant="unknown">
      <a class="sitecraft-primary" href="#x">了解更多</a>
    </section>
  </body></html>`;
  try {
    await browser.send("Runtime.enable", {}, sessionId);
    await browser.send("Page.enable", {}, sessionId);
    const frameId = (await browser.send("Page.getFrameTree", {}, sessionId) as { frameTree: { frame: { id: string } } }).frameTree.frame.id;
    await browser.send("Page.setDocumentContent", { frameId, html }, sessionId);
    const scan = await browser.eval<{
      baselineAlignments: Array<{ block: string; variant: string; id: string; delta: number; pass: boolean }>;
      semanticSpacing: Array<{ block: string; variant: string; id: string; within: number; between: number; pass: boolean }>;
      primaryButtons: { visibleCount: number; vague: Array<{ text: string }> };
      undeclaredVariants: Array<{ block: string; variant: string; rules: string[]; message: string }>;
    }>(`(()=>{${scanSource};return scanVisitorLayout(document)})()`, sessionId);
    mkdirSync("artifacts/t090", { recursive: true });
    writeFileSync("artifacts/t090/layout-declaration-fixture.json", JSON.stringify(scan, null, 2));
    const baseline = (scan.baselineAlignments ?? []).find((entry) => entry.id === "headline-meta");
    assert.ok(baseline && !baseline.pass && baseline.delta >= 4, "a 4px baseline error must fail");
    const baselinePass = (scan.baselineAlignments ?? []).find((entry) => entry.id === "headline-pass");
    assert.ok(baselinePass?.pass, "a naturally baseline-aligned group must pass");
    const spacing = (scan.semanticSpacing ?? []).find((entry) => entry.id === "first");
    assert.ok(spacing && !spacing.pass && spacing.within > spacing.between, "within-group spacing larger than between-group spacing must fail");
    assert.equal(scan.primaryButtons?.visibleCount, 2, "two visible declared primary buttons must be counted");
    assert.deepEqual((scan.primaryButtons?.vague ?? []).map((entry) => entry.text).sort(), ["Learn More", "了解更多"].sort(), "generic primary CTA copy must be reported");
    const undeclared = (scan.undeclaredVariants ?? []).find((entry) => entry.block === "undeclared" && entry.variant === "unknown");
    assert.ok(undeclared && undeclared.message.includes("未声明"), "a variant without declarations must be reported as 未声明");
  } finally {
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
    await closeBrowser(browser);
  }
});

test("T-090 check-published judge reports declared failures and leaves undeclared variants informational", () => {
  const source = readFileSync(new URL("../scripts/check-published.mjs", import.meta.url), "utf8");
  const judge = new Function("missingFacts", "TEXT_FIT_FAILURES", "FORBIDDEN_TEXT", `${extractJudge(source)}; return judge;`)(() => [], [], []) as (report: Record<string, unknown>, facts: unknown[]) => string[];
  const failures = judge({
    measurement: { visibleBlocks: [], measuredBlocks: [], textContrastEntries: 1, bodyParagraphs: 1 },
    pageSectionOrder: [], editorCursor: "", editorHoverOutline: false, horizontalScroll: false, cardOverflow: 0, cardOverflowSample: [],
    textFit: [], textContrast: [], bodyLineLength: [], baselineAlignments: [{ block: "fixture", variant: "declared", id: "headline-meta", delta: 4, threshold: 2, pass: false, status: "measured" }],
    semanticSpacing: [{ block: "fixture", variant: "declared", id: "first", within: 24, between: 12, pass: false, status: "measured" }],
    primaryButtons: { visibleCount: 2, max: 1, vague: [{ block: "fixture", variant: "declared", text: "Learn More" }], missing: [] },
    undeclaredVariants: [{ block: "unknown", variant: "future", rules: ["baseline", "spacing", "buttons"], message: "unknown:future 未声明" }],
    heroOrphan: false, heroTitleWordBreak: false, englishSpecValueHan: [], brandClipped: false, headerOverflow: false, headerControlStacked: false,
    heroPhotoCovered: false, numbering: 0, phoneNav: true, contactVisible: true, formVisible: true, ctaTargetVisible: true, ctaLandsOnForm: true,
    broken: [], photoCount: 0, saysSchematicOnly: false, text: "", readable: "",
  }, []);
  assert.ok(failures.some((failure) => failure.includes("基线对齐失败")), failures.join("；"));
  assert.ok(failures.some((failure) => failure.includes("组内间距不小于组间距")), failures.join("；"));
  assert.ok(failures.some((failure) => failure.includes("primary 按钮")), failures.join("；"));
  assert.ok(failures.some((failure) => failure.includes("文案空泛")), failures.join("；"));
  assert.ok(!failures.some((failure) => failure.includes("unknown:future")), failures.join("；"));
});

test("T-090 real production variant reaches the browser layout scanner", async () => {
  const browser = await openBrowser();
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" }) as { targetId: string };
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
  try {
    await browser.send("Runtime.enable", {}, sessionId);
    await browser.send("Page.enable", {}, sessionId);
    await browser.send("Page.navigate", { url: `${process.env.SITECRAFT_BASE || "http://127.0.0.1:3034"}/api/templates/screwfast/preview` }, sessionId);
    for (let attempt = 0; attempt < 150; attempt += 1) {
      const ready = await browser.eval<boolean>("document.readyState === 'complete' && typeof window.__sitecraftApplyDeclared === 'function'", sessionId).catch(() => false);
      if (ready) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const draft = withLayouts(packDraft("industrial"), { hero: "statement", footer: "line" });
    await browser.eval(`window.__sitecraftApplyDeclared(${JSON.stringify(draft)}, "zh", [], "published", null, false)`, sessionId);
    await browser.eval("new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))", sessionId);
    const scan = await browser.eval<{
      baselineAlignments: Array<{ block: string; variant: string; status: string; id: string }>;
      semanticSpacing: Array<{ block: string; variant: string; status: string; id: string }>;
      undeclaredVariants: Array<{ block: string; variant: string }>;
    }>(`(()=>{${scanSource};return scanVisitorLayout(document)})()`, sessionId);
    assert.ok(scan.baselineAlignments.some((entry) => entry.block === "footer" && entry.variant === "line" && entry.status === "measured"), JSON.stringify(scan));
    assert.ok(scan.semanticSpacing.some((entry) => entry.block === "products" && entry.variant === "cards" && entry.status === "measured"), JSON.stringify(scan));
    assert.equal(scan.undeclaredVariants.some((entry) => entry.block === "hero" && entry.variant === "statement"), false, JSON.stringify(scan.undeclaredVariants));
  } finally {
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
    await closeBrowser(browser);
  }
});

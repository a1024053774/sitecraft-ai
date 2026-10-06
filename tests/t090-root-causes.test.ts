import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import test from "node:test";
import { Cdp } from "./helpers/workspace-browser.ts";

const repo = process.cwd();
const out = path.resolve(process.env.T090_FIX_OUT || "artifacts/t090/20261006-fix", `focused-${Date.now()}-${process.pid}`);
mkdirSync(out, { recursive: true });
const scanSource = readFileSync(path.join(repo, "scripts/visitor-layout-scan.js"), "utf8")
  .replace("export function", "function").replace("export default scanVisitorLayout;", "");
const base = process.env.SITECRAFT_BASE || "http://127.0.0.1:3034";

async function run(argv: string[], cwd = repo, env = process.env) {
  const startedAt = new Date().toISOString();
  const child = spawn(process.execPath, argv, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", (data) => { output += data; });
  child.stderr.on("data", (data) => { output += data; });
  const code = await new Promise<number | null>((resolve, reject) => { child.on("error", reject); child.on("close", resolve); });
  return { argv, cwd, startedAt, finishedAt: new Date().toISOString(), chrome: env.CHROME_PATH, base: env.SITECRAFT_BASE, code, output };
}

async function withChrome(task: (browser: Cdp, sessionId: string) => Promise<void>) {
  assert.ok(process.env.CHROME_PATH, "set CHROME_PATH to the approved testing Chrome");
  const profile = mkdtempSync(path.join(out, "chrome-"));
  const chrome = spawn(process.env.CHROME_PATH!, ["--remote-debugging-port=0", `--user-data-dir=${profile}`, "--headless", "--no-first-run", "about:blank"], { stdio: "ignore" });
  let browser: Cdp | undefined;
  try {
    let port = "";
    for (let attempt = 0; attempt < 100 && !port; attempt++) {
      try { port = readFileSync(path.join(profile, "DevToolsActivePort"), "utf8").split("\n")[0]; } catch { /* owned Chrome is starting */ }
      if (!port) await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(port, "owned Chrome must expose its endpoint");
    const version = await fetch(`http://127.0.0.1:${port}/json/version`).then((response) => response.json()) as { webSocketDebuggerUrl: string };
    browser = new Cdp(version.webSocketDebuggerUrl);
    await browser.connect();
    const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" }) as { targetId: string };
    const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
    await browser.send("Page.enable", {}, sessionId);
    await browser.send("Runtime.enable", {}, sessionId);
    await task(browser, sessionId);
  } finally {
    if (browser) { await browser.send("Browser.close").catch(() => {}); browser.ws.close(); }
    chrome.kill();
  }
}

type Layout = {
  baselineAlignments: Array<{ id: string; delta: number | null; threshold: number; pass: boolean | null; status: string; missing?: string[]; reason?: string; applicability?: { minViewportWidth: number; viewportWidth: number } }>;
  semanticSpacing: Array<{ id: string; within: number; between: number; pass: boolean; status: string }>;
  primaryButtons: { visibleCount: number; vague: unknown[]; missing: unknown[] };
  undeclaredVariants: Array<{ message: string }>;
  measurement: { visibleBlocks: string[]; measuredBlocks: string[]; textContrastEntries: number };
};

test("T-090 three semantic groups preserve a zero minimum gap regardless of pair order", async () => {
  await withChrome(async (browser, sessionId) => {
    const rows: Layout[] = [];
    for (const selectors of [["a", "b", "c"], ["c", "a", "b"]]) {
      const declaration = { baselineGroups: [], semanticGroups: selectors.map((id) => ({ id, selectors: [`#${id}`] })), buttonRoles: { primary: [], secondary: [] } };
      const html = `<!doctype html><style>body{margin:0}section{height:220px;position:relative}p{position:absolute;margin:0;width:60px;height:20px;line-height:20px}#a,#b{top:0}#c{top:120px}</style><section data-sc-block="sentinel" data-sc-variant="overlap" data-sc-layout-declaration='${JSON.stringify(declaration)}'><p id="a">Alpha</p><p id="b">Bravo</p><p id="c">Charlie</p></section>`;
      const frameId = (await browser.send("Page.getFrameTree", {}, sessionId) as { frameTree: { frame: { id: string } } }).frameTree.frame.id;
      await browser.send("Page.setDocumentContent", { frameId, html }, sessionId);
      rows.push(await browser.eval<Layout>(`(()=>{${scanSource};return scanVisitorLayout(document)})()`, sessionId));
    }
    writeFileSync(path.join(out, "overlap-sentinel.json"), JSON.stringify(rows, null, 2));
    for (const row of rows) {
      assert.equal(row.semanticSpacing.length, 3);
      for (const group of row.semanticSpacing) {
        assert.equal(group.between, 0, "overlapping A/B must keep the minimum gap at zero");
        assert.equal(group.pass, false, "within=0 is not smaller than between=0");
      }
    }
  });
});

// Seed an isolated file store through the production commit boundary. No real site is edited.
async function fixtureStore() {
  const cwd = mkdtempSync(path.join(out, "store-"));
  symlinkSync(path.join(repo, "lib"), path.join(cwd, "lib"), "dir");
  symlinkSync(path.join(repo, "scripts"), path.join(cwd, "scripts"), "dir");
  const seed = `import { registerHooks } from 'node:module'; import { existsSync } from 'node:fs'; import path from 'node:path'; import { pathToFileURL } from 'node:url';
    registerHooks({resolve(s,c,next){if(!s.startsWith('@/'))return next(s,c);let f=path.join(${JSON.stringify(repo)},s.slice(2));if(existsSync(f+'.ts'))f+='.ts';else if(existsSync(path.join(f,'index.ts')))f=path.join(f,'index.ts');return next(pathToFileURL(f).href,c)}});
    const {createSite,commitOperations}=await import(${JSON.stringify(path.join(repo, "lib/site-store.ts"))});
    const before=await createSite('t090-footer');const result=await commitOperations({siteId:'t090-footer',baseRevision:before.draft.revision,source:'manual',summary:'T090 isolated footer fixture',operations:[
      {op:'set_visual_brief',briefId:'engineering-industrial'},
      {op:'set_text',target:'companyName',value:'宁波精密制造与工业自动化设备零部件有限公司'},
      {op:'set_text',target:'contact.email',value:'international-industrial-parts-and-machinery-inquiries@example.test'},
      {op:'set_text',target:'contact.phone',value:'000-0000-0090'},
      {op:'set_text',target:'hero.cta',value:{zh:'提交图纸获取报价',en:'Send drawings for a quote'}},
      {op:'set_block_variant',block:'footer',variant:'line'}]});if(result.status!=='applied')throw new Error(JSON.stringify(result));`;
  const result = await run(["--experimental-strip-types", "--input-type=module", "--eval", seed], cwd, { ...process.env, SITE_STORE: "fs", NODE_ENV: "test" });
  writeFileSync(path.join(out, "seed.json"), JSON.stringify(result, null, 2));
  assert.equal(result.code, 0, result.output);
  const cases = path.join(cwd, "cases.json");
  writeFileSync(cases, JSON.stringify([{ id: "long-footer", site: "t090-footer", note: "Isolated synthetic long-name/email fixture; seeded via commitOperations." }]));
  return { cwd, cases };
}

test("T-090 real render-block CLI rejects each declared defect independently and reports undeclared rules", async (t) => {
  const { cwd, cases } = await fixtureStore();
  const response = await fetch(`${base}/api/templates/screwfast/preview`);
  assert.equal(response.status, 200);
  const preview = await response.text();
  const empty = { baselineGroups: [], semanticGroups: [], buttonRoles: { primary: [], secondary: [] } };
  const defects = [
    { id: "baseline", declaration: { ...empty, baselineGroups: [{ id: "footer-contact", selectors: ['[data-sc-part="brand"]', '[data-sc-part="contact"]'] }] }, css: '.sitecraft-footer-line [data-sc-part="contact"]{transform:translateY(4px)!important}', check: (layout: Layout) => layout.baselineAlignments.some((entry) => entry.id === "footer-contact" && entry.status === "measured" && entry.delta! > 2 && !entry.pass) },
    { id: "missing-baseline", declaration: { ...empty, baselineGroups: [{ id: "missing-baseline", selectors: ["#absent-baseline", '[data-sc-part="brand"]'] }] }, check: (layout: Layout) => layout.baselineAlignments.some((entry) => entry.status === "missing" && entry.missing?.includes("#absent-baseline")) },
    { id: "spacing", declaration: { ...empty, semanticGroups: [{ id: "whole", selectors: ['[data-sc-part="brand"]', '[data-sc-part="contact"]'] }, { id: "contact", selectors: ['[data-sc-part="contact"]'] }] }, check: (layout: Layout) => layout.semanticSpacing.some((entry) => entry.status === "measured" && entry.between === 0 && !entry.pass) },
    { id: "missing-spacing", declaration: { ...empty, semanticGroups: [{ id: "missing-spacing", selectors: ["#absent-spacing"] }] }, check: (layout: Layout) => layout.semanticSpacing.some((entry) => entry.status === "missing") },
    { id: "duplicate-primary", declaration: { ...empty, buttonRoles: { primary: ['[data-sc-part="brand"]', '[data-sitecraft-contact="footer-email"]'], secondary: [] } }, check: (layout: Layout) => layout.primaryButtons.visibleCount >= 2 },
    { id: "missing-primary", declaration: { ...empty, buttonRoles: { primary: ["#absent-primary"], secondary: [] } }, check: (layout: Layout) => layout.primaryButtons.missing.length > 0 },
    { id: "vague-primary", declaration: empty, css: '[data-sitecraft-benchmark="hero-cta"]{display:none!important}', extra: `<section data-sc-block="t090-vague" data-sc-variant="fixture" data-sc-layout-declaration='${JSON.stringify({ ...empty, buttonRoles: { primary: ["#t090-vague"], secondary: [] } })}'><a id="t090-vague" href="#top">Learn More</a></section>`, check: (layout: Layout) => layout.primaryButtons.visibleCount === 1 && layout.primaryButtons.vague.length === 1 && layout.primaryButtons.missing.length === 0 },
    { id: "undeclared", declaration: {}, check: (layout: Layout) => layout.undeclaredVariants.some((entry) => entry.message.includes("footer:line 未声明")) },
  ];
  let html = "";
  const server = createServer((request, reply) => {
    if (request.url?.includes("/api/templates/")) { reply.setHeader("Content-Type", "text/html"); reply.end(html); }
    else { reply.statusCode = 404; reply.end(); }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as { port: number };
    for (const defect of defects) await t.test(defect.id, async () => {
      // Only the fixture response is mutated. The production bridge still mounts and fills the variant.
      html = preview
        .replaceAll('data-sc-block="footer" data-sc-variant="line"', `data-sc-block="footer" data-sc-variant="line" data-sc-layout-declaration='${JSON.stringify(defect.declaration)}'`)
        .replace("</head>", `<style>${defect.css || ""}</style></head>`)
        .replace("</body>", `${defect.extra || ""}<section data-sc-block="t090-undeclared" data-sc-variant="unknown">Undeclared fixture</section></body>`);
      const reportOut = path.join(out, `cli-${defect.id}`);
      const result = await run([process.env.T090_RENDER_BLOCK || path.join(repo, "scripts/render-block.mjs"), "--block", "footer", "--variant", "line", "--cases", cases, "--out", reportOut], cwd, { ...process.env, SITECRAFT_BASE: `http://127.0.0.1:${address.port}` });
      writeFileSync(path.join(out, `cli-${defect.id}-run.json`), JSON.stringify(result, null, 2));
      const report = JSON.parse(readFileSync(path.join(reportOut, "scan.json"), "utf8")) as { rows: Array<{ candidate: Layout; english: Layout; layoutFailures: { zh: string[]; en: string[] } }> };
      assert.equal(report.rows.length, 3);
      for (const row of report.rows) for (const [locale, layout] of [["zh", row.candidate], ["en", row.english]] as const) {
        for (const field of ["baselineAlignments", "semanticSpacing", "primaryButtons", "undeclaredVariants", "measurement"] as const) assert.ok(layout[field], `real CLI must report ${field}`);
        assert.ok(defect.check(layout), `real CLI must retain the ${defect.id} measurement`);
        assert.equal(row.layoutFailures[locale].length > 0, defect.id !== "undeclared", "only the declared defect may cause failure");
        assert.ok(layout.undeclaredVariants.some((entry) => entry.message.includes("未声明")));
        assert.ok(layout.measurement.textContrastEntries > 0);
      }
      assert.equal(result.code, defect.id === "undeclared" ? 0 : 1, result.output);
      const markdown = readFileSync(path.join(reportOut, "scan.md"), "utf8");
      for (const field of ["baselineAlignments", "semanticSpacing", "primaryButtons", "undeclaredVariants", "measurement", "未声明"]) assert.ok(markdown.includes(field), `scan.md must include ${field}`);
    });
  } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
});

test("T-113 footer line stacks on phones and keeps the real tablet/desktop baseline in both languages", async () => {
  const { cwd, cases } = await fixtureStore();
  const draft = JSON.parse(readFileSync(path.join(cwd, ".sitecraft-data/sites/t090-footer.json"), "utf8")).draft;
  await withChrome(async (browser, sessionId) => {
    await browser.send("Page.navigate", { url: `${base}/api/templates/screwfast/preview` }, sessionId);
    let ready = false;
    for (let attempt = 0; attempt < 200 && !ready; attempt++) {
      ready = await browser.eval<boolean>("document.readyState==='complete' && typeof window.__sitecraftApplyDeclared==='function'", sessionId);
      if (!ready) await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(ready, "production preview must become ready");
    const rows = [];
    for (const width of [1440, 768, 375]) for (const locale of ["zh", "en"]) {
      await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);
      await browser.eval(`window.__sitecraftApplyDeclared(${JSON.stringify(draft)},${JSON.stringify(locale)},[],"published",null,false)`, sessionId);
      await browser.eval("(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))})()", sessionId);
      const scan = await browser.eval<Layout>(`(()=>{${scanSource};return scanVisitorLayout(document)})()`, sessionId);
      const rendered = await browser.eval<{ company: string; email: string; minFont: number; overflow: boolean; gap: number; brandLines: string[]; emailLines: string[]; emailLineWidth: number; emailSegmentWidths: number[]; phoneLines: string[]; box: { x: number; y: number; width: number; height: number } }>(`(()=>{
        const footer=document.querySelector('[data-sc-block="footer"]');const brand=footer.querySelector('[data-sc-part="brand"]');const contact=footer.querySelector('[data-sc-part="contact"]');const r=footer.getBoundingClientRect();
        const lines=node=>{const result=[];const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);let text;while(text=walker.nextNode()){for(let i=0;i<text.textContent.length;i++){const char=text.textContent[i];if(/[\\u200b\\u2060]/.test(char))continue;const range=document.createRange();range.setStart(text,i);range.setEnd(text,i+1);const b=range.getBoundingClientRect();if(!b.width)continue;let line=result.find(l=>Math.abs(l.top-b.top)<1);if(!line){line={top:b.top,text:''};result.push(line)}line.text+=char}}return result.map(l=>l.text)};
        const email=contact.querySelector('[data-sitecraft-contact="footer-email"]');const context=document.createElement('canvas').getContext('2d');context.font=getComputedStyle(email).font;const segments=email.textContent.replace(/[\\u200b\\u2060]/g,'').split('@');
        return {company:brand.innerText,email:contact.innerText,minFont:Math.min(parseFloat(getComputedStyle(brand).fontSize),parseFloat(getComputedStyle(contact).fontSize)),gap:contact.getBoundingClientRect().top-brand.getBoundingClientRect().bottom,brandLines:lines(brand),emailLines:lines(email),emailLineWidth:email.closest('[data-sitecraft-line]').getBoundingClientRect().width,emailSegmentWidths:segments.map(segment=>context.measureText(segment).width),phoneLines:lines(contact.querySelector('[data-sitecraft-contact="footer-phone"]').closest('[data-sitecraft-line]')),overflow:[footer,...footer.querySelectorAll('*')].some(n=>{const r=n.getBoundingClientRect();return r.width>0&&(r.left<0||r.right>innerWidth+1)}),box:{x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height}};
      })()`, sessionId);
      const file = `footer-${width}-${locale}.png`;
      const shot = await browser.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { ...rendered.box, scale: 1 } }, sessionId) as { data: string };
      writeFileSync(path.join(out, file), Buffer.from(shot.data, "base64"));
      rows.push({ width, locale, rendered, baselineAlignments: scan.baselineAlignments.filter((entry) => entry.id === "footer-contact"), file });
    }
    writeFileSync(path.join(out, "footer-responsive.json"), JSON.stringify(rows, null, 2));
    for (const row of rows) {
      assert.equal(row.baselineAlignments.length, 1, "the baseline declaration remains observable at every width");
      const baseline = row.baselineAlignments[0];
      if (row.width === 375) {
        assert.equal(baseline.status, "not-applicable", "phone stacking has no horizontal baseline to measure");
        assert.equal(baseline.delta, null);
        assert.equal(baseline.pass, null, "not applicable must not be called a measured PASS");
        assert.deepEqual(baseline.applicability, { minViewportWidth: 481, viewportWidth: 375 });
        assert.ok(baseline.reason?.includes("481"), "the report must state its breakpoint basis");
        assert.ok(row.rendered.gap >= 16, "company is above contact with the existing 16px group gap");
        assert.ok(row.rendered.brandLines.every(line => line.length > 1 && line.length <= 40), "no one-character company-name orphan or excessive line length");
        for (let i = 1; i < row.rendered.emailLines.length; i++) {
          if (row.rendered.emailLines[i - 1].endsWith("@") || row.rendered.emailLines[i].startsWith("@")) continue;
          const offset = row.rendered.emailLines.slice(0, i).join("").length;
          const segment = offset < draft.content.contact.email.indexOf("@") ? 0 : 1;
          assert.ok(row.rendered.emailSegmentWidths[segment] > row.rendered.emailLineWidth, `a forced break requires that entire segment to exceed the entire line: ${JSON.stringify(row.rendered)}`);
        }
        assert.equal(row.rendered.phoneLines.length, 1, "the phone and its label remain on one line");
      } else {
        assert.equal(baseline.status, "measured");
        assert.equal(baseline.pass, true);
        assert.ok(baseline.delta! <= 2, "tablet and desktop keep the actual <=2px baseline");
      }
      assert.equal(row.rendered.company, draft.companyName);
      assert.ok(row.rendered.email.replace(/[\u200b\u2060]/g, "").includes(draft.content.contact.email));
      assert.ok(row.rendered.minFont >= 14, "footer must not shrink its text to fit");
      assert.equal(row.rendered.overflow, false, JSON.stringify(row));
    }
  });
  const reportOut = path.join(out, "footer-A-cli");
  const result = await run([process.env.T090_RENDER_BLOCK || path.join(repo, "scripts/render-block.mjs"), "--block", "footer", "--variant", "line", "--cases", cases, "--out", reportOut], cwd, { ...process.env, SITECRAFT_BASE: base });
  writeFileSync(path.join(out, "footer-A-cli-run.json"), JSON.stringify(result, null, 2));
  const report = JSON.parse(readFileSync(path.join(reportOut, "scan.json"), "utf8")) as { rows: Array<{ width: number; candidate: Layout; english: Layout; layoutFailures: { zh: string[]; en: string[] } }> };
  assert.equal(report.rows.length, 3);
  for (const row of report.rows) for (const [locale, scan] of [["zh", row.candidate], ["en", row.english]] as const) {
    const group = scan.baselineAlignments.find(entry => entry.id === "footer-contact");
    assert.ok(group, "the real CLI preserves the declaration at every width");
    assert.equal(group.status, row.width === 375 ? "not-applicable" : "measured");
    assert.deepEqual(row.layoutFailures[locale], [], "explicitly inapplicable phone baseline must not become a layout failure");
  }
  assert.equal(result.code, 0, result.output);
});

test("T-113 baseline applicability obeys the 480/481 boundary and rejects a malformed threshold", async () => {
  await withChrome(async (browser, sessionId) => {
    const rows = [];
    for (const width of [480, 481]) for (const minViewportWidth of [481, "481"]) {
      await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
      const declaration = { baselineGroups: [{ id: "boundary", selectors: ["#a", "#b"], minViewportWidth }], semanticGroups: [], buttonRoles: { primary: [], secondary: [] } };
      const html = `<!doctype html><style>body{margin:0}section{display:flex;align-items:baseline}span{font:16px/24px sans-serif}#b{transform:translateY(4px)}</style><section data-sc-block="sentinel" data-sc-variant="boundary" data-sc-layout-declaration='${JSON.stringify(declaration)}'><span id="a">Alpha</span><span id="b">Bravo</span></section>`;
      const frameId = (await browser.send("Page.getFrameTree", {}, sessionId) as { frameTree: { frame: { id: string } } }).frameTree.frame.id;
      await browser.send("Page.setDocumentContent", { frameId, html }, sessionId);
      const scan = await browser.eval<Layout>(`(()=>{${scanSource};return scanVisitorLayout(document)})()`, sessionId);
      rows.push({ width, minViewportWidth, entry: scan.baselineAlignments[0] });
    }
    writeFileSync(path.join(out, "baseline-applicability.json"), JSON.stringify(rows, null, 2));
    for (const row of rows) {
      if (typeof row.minViewportWidth !== "number") {
        assert.equal(row.entry.status, "invalid");
        assert.equal(row.entry.pass, false, "malformed applicability must fail, not skip a rule");
      } else if (row.width === 480) {
        assert.equal(row.entry.status, "not-applicable");
        assert.equal(row.entry.pass, null);
        assert.equal(row.entry.delta, null);
      } else {
        assert.equal(row.entry.status, "measured");
        assert.equal(row.entry.delta, 4);
        assert.equal(row.entry.pass, false, "a 4px error at the first applicable width still fails");
      }
    }
  });
});

test("T-113 phone applicability never exempts missing, invalid or invisible required targets", async () => {
  await withChrome(async (browser, sessionId) => {
    const rows = [];
    for (const width of [375, 480, 481, 768, 1440]) for (const state of ["valid", "missing", "invalid", "hidden"]) {
      await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
      const last = state === "missing" ? "#absent" : state === "invalid" ? "[" : "#c";
      const declaration = { baselineGroups: [{ id: "required", selectors: ["#a", "#b", last], minViewportWidth: 481 }], semanticGroups: [], buttonRoles: { primary: [], secondary: [] } };
      const html = `<!doctype html><style>body{margin:0}section{display:flex;align-items:baseline}span{font:16px/24px sans-serif}#b{transform:translateY(4px)}${state === "hidden" ? "#c{display:none}" : ""}</style><section data-sc-block="sentinel" data-sc-variant="required" data-sc-layout-declaration='${JSON.stringify(declaration)}'><span id="a">Alpha</span><span id="b">Bravo</span><span id="c">Charlie</span></section>`;
      const frameId = (await browser.send("Page.getFrameTree", {}, sessionId) as { frameTree: { frame: { id: string } } }).frameTree.frame.id;
      await browser.send("Page.setDocumentContent", { frameId, html }, sessionId);
      const scan = await browser.eval<Layout>(`(()=>{${scanSource};return scanVisitorLayout(document)})()`, sessionId);
      rows.push({ width, state, entry: scan.baselineAlignments[0] });
    }
    writeFileSync(path.join(out, "required-target-applicability.json"), JSON.stringify(rows, null, 2));
    for (const row of rows) {
      if (row.state !== "valid") {
        assert.equal(row.entry.status, "missing", `${row.width}/${row.state}: validate required targets before N/A`);
        assert.equal(row.entry.pass, false);
        assert.equal(row.entry.delta, null);
      } else if (row.width < 481) {
        assert.equal(row.entry.status, "not-applicable");
        assert.equal(row.entry.pass, null);
      } else {
        assert.equal(row.entry.status, "measured");
        assert.equal(row.entry.delta, 4);
        assert.equal(row.entry.pass, false);
      }
    }
  });
});

test("T-113 real CLI rejects a baseline target removed only on phones", async () => {
  const { cwd, cases } = await fixtureStore();
  const response = await fetch(`${base}/api/templates/screwfast/preview`);
  assert.equal(response.status, 200);
  const declaration = { baselineGroups: [{ id: "phone-target", selectors: ['[data-sc-part="brand"]', '[data-t113-baseline-contact]'], minViewportWidth: 481 }], semanticGroups: [], buttonRoles: { primary: [], secondary: [] } };
  const html = (await response.text())
    .replaceAll('data-sc-block="footer" data-sc-variant="line"', `data-sc-block="footer" data-sc-variant="line" data-sc-layout-declaration='${JSON.stringify(declaration)}'`)
    .replaceAll('data-sc-part="contact"', 'data-sc-part="contact" data-t113-baseline-contact')
    .replace("</body>", `<script>const apply=window.__sitecraftApplyDeclared;window.__sitecraftApplyDeclared=function(...args){const result=apply(...args);if(innerWidth<481)document.querySelector('[data-t113-baseline-contact]')?.removeAttribute('data-t113-baseline-contact');return result}</script></body>`);
  const server = createServer((_request, reply) => { reply.setHeader("Content-Type", "text/html"); reply.end(html); });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as { port: number };
    const reportOut = path.join(out, "cli-phone-target");
    const result = await run([process.env.T090_RENDER_BLOCK || path.join(repo, "scripts/render-block.mjs"), "--block", "footer", "--variant", "line", "--cases", cases, "--out", reportOut], cwd, { ...process.env, SITECRAFT_BASE: `http://127.0.0.1:${address.port}` });
    writeFileSync(path.join(out, "cli-phone-target-run.json"), JSON.stringify(result, null, 2));
    const report = JSON.parse(readFileSync(path.join(reportOut, "scan.json"), "utf8")) as { rows: Array<{ width: number; candidate: Layout; english: Layout; layoutFailures: { zh: string[]; en: string[] } }> };
    assert.equal(result.code, 1, "a missing required phone target must make the real CLI fail");
    for (const row of report.rows) for (const [locale, scan] of [["zh", row.candidate], ["en", row.english]] as const) {
      const entry = scan.baselineAlignments.find(entry => entry.id === "phone-target");
      assert.ok(entry);
      assert.equal(entry.status, row.width === 375 ? "missing" : "measured");
      assert.equal(row.layoutFailures[locale].length > 0, row.width === 375);
    }
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});

test("T-113 real credit collector selects a row by its complete text and exact source/licence pair", async () => {
  const source = readFileSync("scripts/check-published.mjs", "utf8");
  const scans = ["visitor-text-fit-scan.js", "hero-word-break-scan.js", "visitor-layout-scan.js", "visitor-readable-text.js"].map(file => readFileSync(`scripts/${file}`, "utf8").replace(/export default scanVisitorLayout;?/g, "").replace(/export function scanVisitorLayout/g, "function scanVisitorLayout"));
  const inspect = new Function("TEXT_FIT_SCAN", "HERO_WORD_BREAK_SCAN", "VISITOR_LAYOUT_SCAN", "READABLE_TEXT", source.slice(source.indexOf("const INSPECT ="), source.indexOf("\nfunction judge(")) + ";return INSPECT;")(...scans);
  await withChrome(async (browser, sessionId) => {
    const observations = [];
    for (const locale of ["zh", "en"]) for (const kind of ["sources", "licences", "full-credit", "split-links"]) {
      const records = [1, 2].map(index => ({ imageId: `same-attribution-${index}`, credit: kind === "full-credit" ? { zh: "完整署名；JPEG re-encoded/resized", en: "Full credit; JPEG re-encoded/resized" } : undefined, attribution: "用户提供；仅当前站点使用", sourceUrl: `https://materials.example.test/${kind === "licences" ? "same" : index}.jpg`, licenseUrl: kind === "sources" ? null : `https://materials.example.test/licence-${index}` }));
      const rows = records.map((record, index) => `<li>${record.credit ? `<span>${record.credit[locale as "zh" | "en"]}</span>` : ""}<span>${record.attribution}</span>${kind === "split-links" && index === 1 ? "" : `<a href="${record.sourceUrl}">Source</a>`}${kind === "split-links" && index === 0 ? `<a href="${records[1].sourceUrl}">Second source without its licence</a>` : ""}${record.licenseUrl ? `<a href="${record.licenseUrl}">Licence</a>` : ""}</li>`).join("");
      const html = `<!doctype html><html lang="${locale}"><style>body{margin:0}.sitecraft-container{width:100%}</style><body><footer data-sc-block="footer" data-sc-variant="line"><div class="sitecraft-container"><div data-sitecraft-image-credits><ul>${rows}</ul></div></div></footer></body></html>`;
      const frameId = (await browser.send("Page.getFrameTree", {}, sessionId) as { frameTree: { frame: { id: string } } }).frameTree.frame.id;
      await browser.send("Page.setDocumentContent", { frameId, html }, sessionId);
      const report = await browser.eval<{ imageCredits: { missing: string[]; records: Array<{ completeTextVisible: boolean; licenseLinkVisible: boolean; sourceLinkVisible: boolean }> } }>(`${inspect}(${JSON.stringify(records)}, {})`, sessionId);
      observations.push({ locale, kind, input: records, imageCredits: report.imageCredits });
    }
    writeFileSync(path.join(out, "credit-joint-row-match.json"), JSON.stringify(observations, null, 2));
    for (const row of observations) {
      assert.deepEqual(row.imageCredits.missing, row.kind === "split-links" ? ["same-attribution-2"] : [], `${row.locale}/${row.kind}: match all supplied facts in the same row`);
      if (row.kind !== "split-links") assert.ok(row.imageCredits.records.every(record => record.completeTextVisible && record.licenseLinkVisible && record.sourceLinkVisible));
    }
  });
});

test("T-090 real render-block geometry accepts the original clear multiline hero", async () => {
  const cases = path.join(repo, "tests/fixtures/t090-hero-case.json");
  const reportOut = path.join(out, "geometry-real-hero");
  const result = await run([process.env.T090_RENDER_BLOCK || path.join(repo, "scripts/render-block.mjs"), "--block", "hero", "--variant", "split", "--cases", cases, "--out", reportOut]);
  writeFileSync(path.join(out, "geometry-real-hero-run.json"), JSON.stringify(result, null, 2));
  const report = JSON.parse(readFileSync(path.join(reportOut, "scan.json"), "utf8")) as { rows: Array<{ width: number; candidate: { overlaps: unknown[] }; english: { overlaps: unknown[] } }> };
  assert.deepEqual(report.rows.map((row) => row.width), [1440, 768, 375]);
  for (const row of report.rows) {
    assert.deepEqual(row.candidate.overlaps, []);
    assert.deepEqual(row.english.overlaps, [], `${row.width}/en: independent audit screenshots show clear glyphs; overlapping font boxes must not fail`);
  }
  assert.equal(result.code, 0, result.output);
});

test("T-090 real render-block geometry measures glyphs while rejecting compressed lines and overlaid text", async (t) => {
  const { cwd, cases } = await fixtureStore();
  const response = await fetch(`${base}/api/templates/screwfast/preview`);
  assert.equal(response.status, 200);
  const preview = await response.text();
  const scenarios = [
    { id: "compressed-same-node", lineHeight: 14, body: "<p>Agjp Agjp Agjp Agjp Agjp Agjp Agjp Agjp</p>", expectedExit: 1 },
    { id: "overlaid-different-nodes", lineHeight: 33, body: '<div style="position:relative;height:80px"><p style="position:absolute;top:0;left:0">Agjp Agjp</p><p style="position:absolute;top:0;left:0">Tyqg Tyqg</p></div>', expectedExit: 1 },
    { id: "css-uppercase-compressed", lineHeight: 22, body: "<p>xxx xxx xxx xxx</p>", expectedExit: 1, width: 100, font: "400 40px/22px Arial,sans-serif", transform: "uppercase" },
    { id: "literal-uppercase-compressed", lineHeight: 22, body: "<p>XXX XXX XXX XXX</p>", expectedExit: 1, width: 100, font: "400 40px/22px Arial,sans-serif", transform: "none" },
    { id: "css-uppercase-normal", lineHeight: 48, body: "<p>xxx xxx xxx xxx</p>", expectedExit: 0, width: 100, font: "400 40px/48px Arial,sans-serif", transform: "uppercase" },
    { id: "literal-uppercase-normal", lineHeight: 48, body: "<p>XXX XXX XXX XXX</p>", expectedExit: 0, width: 100, font: "400 40px/48px Arial,sans-serif", transform: "none" },
  ];
  type GeometryRow = { width: number; candidate: { file: string; overlaps: Array<{ a: string; b: string; w: number; h: number }> }; english: { overlaps: Array<{ a: string; b: string; w: number; h: number }> }; layoutFailures: { zh: string[]; en: string[] } };
  const rendered = new Map<string, { dir: string; rows: GeometryRow[] }>();
  let html = "";
  const server = createServer((request, reply) => {
    if (request.url?.includes("/api/templates/")) { reply.setHeader("Content-Type", "text/html"); reply.end(html); }
    else { reply.statusCode = 404; reply.end(); }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as { port: number };
    for (const scenario of scenarios) await t.test(scenario.id, async () => {
      // Intentional glyph collisions exercise same-node line compression and different-node
      // overlays independently of the captured real-page positive case.
      const font = scenario.font || `700 30px/${scenario.lineHeight}px Geist,sans-serif`;
      html = preview
        .replace("</head>", `<style>.t090-geometry{width:${scenario.width || 200}px;margin:16px}.t090-geometry p{margin:0;font:${font};text-transform:${scenario.transform || "none"}}</style></head>`)
        .replaceAll("</footer>", `<div class="t090-geometry">${scenario.body}</div></footer>`);
      const reportOut = path.join(out, `geometry-${scenario.id}`);
      const result = await run([process.env.T090_RENDER_BLOCK || path.join(repo, "scripts/render-block.mjs"), "--block", "footer", "--variant", "line", "--cases", cases, "--out", reportOut], cwd, { ...process.env, SITECRAFT_BASE: `http://127.0.0.1:${address.port}` });
      writeFileSync(path.join(out, `geometry-${scenario.id}-run.json`), JSON.stringify(result, null, 2));
      const report = JSON.parse(readFileSync(path.join(reportOut, "scan.json"), "utf8")) as { rows: GeometryRow[] };
      rendered.set(scenario.id, { dir: reportOut, rows: report.rows });
      assert.equal(report.rows.length, 3);
      for (const row of report.rows) for (const [locale, layout] of [["zh", row.candidate], ["en", row.english]] as const) {
        assert.equal(row.layoutFailures[locale].length, 0, "geometry fixture must not fail another declaration gate");
        if (scenario.expectedExit === 0) assert.deepEqual(layout.overlaps, [], `${row.width}/${locale}: normal line spacing must pass`);
        else if (scenario.id.includes("uppercase")) assert.ok(layout.overlaps.length > 0 && layout.overlaps.every((entry) => entry.w > 2 && entry.h > 3), `${row.width}/${locale}: compressed painted capitals must fail`);
        else assert.ok(layout.overlaps.some((entry) => entry.a.includes("Agjp") && (scenario.id === "compressed-same-node" ? entry.b.includes("Agjp") : entry.b.includes("Tyqg")) && entry.w > 2 && entry.h > 3), `${row.width}/${locale}: visible glyph collisions must still fail`);
      }
      assert.equal(result.code, scenario.expectedExit, result.output);
    });
    for (const spacing of ["compressed", "normal"]) await t.test(`uppercase paint equivalence: ${spacing}`, () => {
      const css = rendered.get(`css-uppercase-${spacing}`)!;
      const literal = rendered.get(`literal-uppercase-${spacing}`)!;
      for (let index = 0; index < 3; index++) {
        const a = css.rows[index], b = literal.rows[index];
        assert.equal(a.width, b.width);
        // Browser screenshot pixels establish equivalence independently of the geometry verdict.
        assert.ok(readFileSync(path.join(css.dir, a.candidate.file)).equals(readFileSync(path.join(literal.dir, b.candidate.file))), `${a.width}: CSS uppercase and literal capitals must paint the same picture`);
        assert.deepEqual(a.candidate.overlaps, b.candidate.overlaps, `${a.width}/zh: equivalent paint must produce the same measurement`);
        assert.deepEqual(a.english.overlaps, b.english.overlaps, `${a.width}/en: equivalent paint must produce the same measurement`);
      }
    });
  } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
});

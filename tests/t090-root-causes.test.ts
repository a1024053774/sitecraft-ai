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
  baselineAlignments: Array<{ id: string; delta: number | null; threshold: number; pass: boolean; status: string; missing?: string[] }>;
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

test("T-090 footer line keeps long company name and email readable on one baseline at three widths in both languages", async () => {
  const { cwd } = await fixtureStore();
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
      const rendered = await browser.eval<{ company: string; email: string; minFont: number; overflow: boolean; box: { x: number; y: number; width: number; height: number } }>(`(()=>{const footer=document.querySelector('[data-sc-block="footer"]');const brand=footer.querySelector('[data-sc-part="brand"]');const contact=footer.querySelector('[data-sc-part="contact"]');const r=footer.getBoundingClientRect();return {company:brand.innerText,email:contact.innerText,minFont:Math.min(parseFloat(getComputedStyle(brand).fontSize),parseFloat(getComputedStyle(contact).fontSize)),overflow:[footer,...footer.querySelectorAll('*')].some(n=>{const r=n.getBoundingClientRect();return r.width>0&&(r.left<0||r.right>innerWidth+1)}),box:{x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height}}})()`, sessionId);
      const file = `footer-${width}-${locale}.png`;
      const shot = await browser.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { ...rendered.box, scale: 1 } }, sessionId) as { data: string };
      writeFileSync(path.join(out, file), Buffer.from(shot.data, "base64"));
      rows.push({ width, locale, rendered, baselineAlignments: scan.baselineAlignments.filter((entry) => entry.id === "footer-contact"), file });
    }
    writeFileSync(path.join(out, "footer-responsive.json"), JSON.stringify(rows, null, 2));
    assert.ok(rows.every((row) => row.baselineAlignments.length > 0 && row.baselineAlignments.every((entry) => entry.status === "measured" && entry.pass && entry.delta! <= 2)), JSON.stringify(rows));
    for (const row of rows) {
      assert.equal(row.rendered.company, draft.companyName);
      assert.ok(row.rendered.email.replace(/[\u200b\u2060]/g, "").includes(draft.content.contact.email));
      assert.ok(row.rendered.minFont >= 14, "footer must not shrink its text to fit");
      assert.equal(row.rendered.overflow, false, JSON.stringify(row));
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
  ];
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
      html = preview
        .replace("</head>", `<style>.t090-geometry{width:200px;margin:16px}.t090-geometry p{margin:0;font:700 30px/${scenario.lineHeight}px Geist,sans-serif}</style></head>`)
        .replaceAll("</footer>", `<div class="t090-geometry">${scenario.body}</div></footer>`);
      const reportOut = path.join(out, `geometry-${scenario.id}`);
      const result = await run([process.env.T090_RENDER_BLOCK || path.join(repo, "scripts/render-block.mjs"), "--block", "footer", "--variant", "line", "--cases", cases, "--out", reportOut], cwd, { ...process.env, SITECRAFT_BASE: `http://127.0.0.1:${address.port}` });
      writeFileSync(path.join(out, `geometry-${scenario.id}-run.json`), JSON.stringify(result, null, 2));
      const report = JSON.parse(readFileSync(path.join(reportOut, "scan.json"), "utf8")) as { rows: Array<{ width: number; candidate: { overlaps: Array<{ a: string; b: string; w: number; h: number }> }; english: { overlaps: Array<{ a: string; b: string; w: number; h: number }> }; layoutFailures: { zh: string[]; en: string[] } }> };
      assert.equal(report.rows.length, 3);
      for (const row of report.rows) for (const [locale, layout] of [["zh", row.candidate], ["en", row.english]] as const) {
        assert.equal(row.layoutFailures[locale].length, 0, "geometry fixture must not fail another declaration gate");
        assert.ok(layout.overlaps.some((entry) => entry.a.includes("Agjp") && (scenario.id === "compressed-same-node" ? entry.b.includes("Agjp") : entry.b.includes("Tyqg")) && entry.w > 2 && entry.h > 3), `${row.width}/${locale}: visible glyph collisions must still fail`);
      }
      assert.equal(result.code, scenario.expectedExit, result.output);
    });
  } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
});

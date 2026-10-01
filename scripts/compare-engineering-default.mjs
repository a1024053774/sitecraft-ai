// Reusable engineering-industrial comparison: render the same drafts with the composed page from an old
// commit (default 472a304) and with the current block-library page, in one Chrome, at 1440 / 768 / 375.
// Both sides load their compose, bridge, and adapter code from the respective commit/current tree.
//
//   CHROME_PATH=… node --experimental-strip-types scripts/compare-engineering-default.mjs [--old 472a304] [--out dir]
//
// Needs the dev server on SITECRAFT_BASE (default http://127.0.0.1:3034). Draft ids are read from
// that server (GET /api/sites/<id>/draft), so the pages get the same normalized draft the site gets.
import { execFileSync, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.SITECRAFT_BASE || "http://127.0.0.1:3034";
const CHROME = process.env.CHROME_PATH;
if (!CHROME) throw new Error("set CHROME_PATH");
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const OLD_COMMIT = option("--old", "472a304");
const OUT = option("--out", path.join("artifacts", "t055", "default-compare-current"));
const WIDTHS = [1440, 768, 375];
const CASES = [
  { site: "3bda89e0-1307-40ee-8293-0d170f184955", note: "P3I 厚资料（最近一次生成）", locale: "zh", variant: "published" },
  { site: "3bda89e0-1307-40ee-8293-0d170f184955", note: "P3I 英文页", locale: "en", variant: "published" },
  { site: "6618ea07-6878-463d-bb0c-b2a223270929", note: "P3E 厚资料（最近一次生成）", locale: "zh", variant: "published" },
  { site: "palette-sample-engineering-warm-orange", note: "P3I 带两张产品照片（首屏照片模式）", locale: "zh", variant: "published" },
  { site: "palette-sample-engineering-patina", note: "P3I 带照片，铜锈色板", locale: "zh", variant: "published" },
  { site: "overlay-sparse-20260924", note: "资料少的小工厂", locale: "zh", variant: "published" },
  { site: "d6212e39-4f09-4c22-88ef-08c2b2cafa13", note: "单产品、石墨色板、隐藏合作方式", locale: "zh", variant: "published" },
  { site: "p4m-d", note: "隐藏常见问题", locale: "zh", variant: "published" },
  { site: "dae11b6f-eda4-41fe-8535-dca1af1bbf82", note: "新建站点空草稿（访客页）", locale: "zh", variant: "published" },
  { site: "dae11b6f-eda4-41fe-8535-dca1af1bbf82", note: "新建站点空草稿（工作台预览）", locale: "zh", variant: "workspace" },
  { site: "3bda89e0-1307-40ee-8293-0d170f184955", note: "P3I（工作台预览）", locale: "zh", variant: "workspace" },
  { site: "3bda89e0-1307-40ee-8293-0d170f184955", note: "P3I 产品页（同页分区，其他分区隐藏）", locale: "zh", variant: "published", page: "products" },
  { site: null, note: "模板页缩略图（没有草稿）", locale: "zh", variant: "thumbnail" },
  { site: "3bda89e0-1307-40ee-8293-0d170f184955", note: "P3I 菜单展开", locale: "zh", variant: "published", state: "menu",
    prepare: `document.querySelector("details.sitecraft-menu").open = true;` },
  { site: "3bda89e0-1307-40ee-8293-0d170f184955", note: "P3I 询盘提交失败提示", locale: "zh", variant: "published", state: "inquiry-error",
    prepare: `window.postMessage({ type: "sitecraft:inquiry-result", templateId: "screwfast", ok: false, message: "询盘未保存：请稍后再试。" }, "*"); await new Promise((done) => setTimeout(done, 200));` },
  { site: "3bda89e0-1307-40ee-8293-0d170f184955", note: "P3I 询盘已发送提示", locale: "zh", variant: "published", state: "inquiry-sent",
    prepare: `window.postMessage({ type: "sitecraft:inquiry-result", templateId: "screwfast", ok: true, message: "询盘已发送。" }, "*"); await new Promise((done) => setTimeout(done, 200));` },
  { site: "94af896b-7ffb-4dc1-ac61-3e72f85b5279", note: "P3I 2026-09-29 23:0x 新生成", locale: "zh", variant: "published" },
  { site: "94af896b-7ffb-4dc1-ac61-3e72f85b5279", note: "P3I 新生成，英文页", locale: "en", variant: "published" },
  { site: "a71de8f9-d03e-405a-8286-8d436e8b6a54", note: "P3E 2026-09-29 23:0x 新生成", locale: "zh", variant: "published" },
  { site: "a71de8f9-d03e-405a-8286-8d436e8b6a54", note: "P3E 新生成，英文页", locale: "en", variant: "published" },
  // Molding values are long: the old cards keep them on one line and they run out of their cells,
  // the new ones wrap after / + – 、 and at spaces. Expected to differ only from the top of the hero
  // (its spec nameplate) to the bottom of the product section; the rest of the page must match.
  { site: "c86f619b-e258-41ac-885c-2b905a5bb91c", note: "注塑（参数值换行，预期只有首屏到产品区不同）", locale: "zh", variant: "published", expectDiff: "hero+products" },
  { site: "c86f619b-e258-41ac-885c-2b905a5bb91c", note: "注塑英文页（预期只有首屏到产品区不同）", locale: "en", variant: "published", expectDiff: "hero+products" },
];

fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- old code, taken from git into a temp dir -----------------------------------------------
// The old side is a full checkout so compose, fragments, bridge, and adapter all come from the
// requested commit. The directory is generated under artifacts/ and removed in the finalizer.
const oldRoot = fs.mkdtempSync(path.join("artifacts", "engineering-default-old-"));
const archive = execFileSync("git", ["archive", OLD_COMMIT], { maxBuffer: 64 * 1024 * 1024 });
const unpack = spawnSync("tar", ["-x", "-f", "-"], { cwd: oldRoot, input: archive });
if (unpack.status !== 0) throw new Error(String(unpack.stderr || "failed to unpack old commit"));
const oldCompose = await import(path.resolve(oldRoot, "lib/blocks/compose.ts"));
const oldBridge = await import(path.resolve(oldRoot, "lib/template-adapters/preview-bridge.ts"));
const oldRegistry = await import(path.resolve(oldRoot, "lib/template-adapters/registry.ts"));
const newBridge = await import(path.resolve("lib/template-adapters/preview-bridge.ts"));
const newRegistry = await import(path.resolve("lib/template-adapters/registry.ts"));
const newCompose = await import(path.resolve("lib/blocks/compose.ts"));
const oldComposed = oldCompose.composedPageForTemplate("screwfast");
if (!oldComposed) throw new Error(`old commit ${OLD_COMMIT} does not compose screwfast`);
// Same steps as prepareHtml in app/api/templates/[templateId]/preview/route.ts (unchanged by T-053);
// checked below against what the dev server actually serves.
function escapeAttribute(value) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}
function rewriteSrcsetValue(value, assetBase) {
  return value.replace(/(^|[\s,])(\/(?!\/|api\/templates\/)[^\s,]+)/g, (_match, lead, url) => `${lead}${assetBase}${url.slice(1)}`);
}
function rewriteLocalSnapshotHtml(html, assetBase) {
  return html
    .replace(/(\b(?:src|href|poster)=["'])\/(?!\/|api\/templates\/)/gi, `$1${assetBase}`)
    .replace(/\bsrcset=(["'])([^"']*)\1/gi, (_full, quote, value) => `srcset=${quote}${rewriteSrcsetValue(value, assetBase)}${quote}`)
    .replace(/url\(\s*(['"]?)\/(?!\/|api\/templates\/)/gi, `url($1${assetBase}`);
}
function prepareHtml(html, bridge, adapter, editor) {
  const templateId = "screwfast";
  const assetBase = `/api/templates/${encodeURIComponent(templateId)}/assets/`;
  const sourceHtml = bridge.stripHtmlScripts(rewriteLocalSnapshotHtml(html, assetBase));
  const base = `<base href="${escapeAttribute(assetBase)}">`;
  const normalized = sourceHtml
    .replace(/<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi, "")
    .replace(/<base\b[^>]*>/gi, "");
  const injection = `${base}<meta name="sitecraft-template" content="${escapeAttribute(templateId)}"><style>html{scroll-behavior:smooth}body{min-height:100vh}[class*="scroll-fade"],[class*="fade-up"],[class*="reveal"],[data-aos]{opacity:1!important;visibility:visible!important;transform:none!important}</style>`;
  const finalStateStyle = `<style>html body [class*="scroll-fade"],html body [class*="fade-up"],html body [class*="reveal"],html body [data-aos]{opacity:1!important;visibility:visible!important;transform:none!important}</style>`;
  const editorChrome = editor ? `<style>[data-sitecraft-slot]{cursor:pointer}[data-sitecraft-slot]:hover{outline:2px solid rgba(46,107,79,.45);outline-offset:3px}</style>` : "";
  const script = bridge.buildPreviewBridgeScript(templateId, adapter);
  return normalized
    .replace(/<head\b([^>]*)>/i, `<head$1>${injection}${editorChrome}`)
    .replace(/<\/body\s*>/i, `${finalStateStyle}${script}</body>`);
}

const pages = {};
for (const editor of [false, true]) {
  const query = editor ? "?editor=1" : "";
  const served = await fetch(`${BASE}/api/templates/screwfast/preview${query}`).then((response) => response.text());
  const replicated = prepareHtml(newCompose.composedPageForTemplate("screwfast"), newBridge, newRegistry.getTemplateAdapter("screwfast"), editor);
  if (served !== replicated) {
    fs.writeFileSync(path.join(OUT, `served-${editor ? "editor" : "visitor"}.html`), served);
    fs.writeFileSync(path.join(OUT, `replicated-${editor ? "editor" : "visitor"}.html`), replicated);
    console.warn(`replicated page differs from the served page (editor=${editor}); both written to ${OUT}`);
  }
  pages[editor ? "workspace" : "published"] = {
    new: served,
    old: prepareHtml(oldComposed, oldBridge, oldRegistry.getTemplateAdapter("screwfast"), editor),
  };
}
fs.writeFileSync(path.join(OUT, "old-visitor.html"), pages.published.old);
fs.writeFileSync(path.join(OUT, "new-visitor.html"), pages.published.new);

// --- Chrome over CDP -----------------------------------------------------------------------------
class Cdp {
  constructor(url) { this.url = url; this.nextId = 1; this.pending = new Map(); this.listeners = []; }
  async connect() {
    this.ws = new WebSocket(this.url);
    await new Promise((resolve, reject) => { this.ws.addEventListener("open", resolve, { once: true }); this.ws.addEventListener("error", reject, { once: true }); });
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.method) for (const listener of this.listeners) listener(message);
      const waiter = message.id && this.pending.get(message.id);
      if (!waiter) return;
      this.pending.delete(message.id);
      if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
      else waiter.resolve(message.result);
    });
  }
  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`${method} timed out`)); }, 60000);
      this.pending.set(id, { resolve: (value) => { clearTimeout(timer); resolve(value); }, reject: (error) => { clearTimeout(timer); reject(error); } });
    });
  }
  async evaluate(expression, sessionId) {
    const { result, exceptionDetails } = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId);
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
    return result.value;
  }
}

const port = 9800 + (process.pid % 150);
const profile = path.resolve(fs.mkdtempSync(path.join("artifacts", "t053", "chrome-profile-")));
const chrome = spawn(CHROME, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--headless", "--no-first-run", "--hide-scrollbars", "--font-render-hinting=none", "about:blank"], { stdio: "ignore" });
let version = null;
for (let attempt = 0; attempt < 80 && !version; attempt += 1) {
  await sleep(250);
  version = await fetch(`http://127.0.0.1:${port}/json/version`).then((response) => response.json()).catch(() => null);
}
if (!version?.webSocketDebuggerUrl) throw new Error("Chrome DevTools endpoint unavailable");
const browser = new Cdp(version.webSocketDebuggerUrl);
await browser.connect();

async function render({ html, draft, locale, variant, activePage, prepare, width, file }) {
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true });
  const onPaused = (message) => {
    if (message.method !== "Fetch.requestPaused" || message.sessionId !== sessionId) return;
    browser.send("Fetch.fulfillRequest", {
      requestId: message.params.requestId,
      responseCode: 200,
      responseHeaders: [{ name: "Content-Type", value: "text/html; charset=utf-8" }, { name: "Cache-Control", value: "no-store" }],
      body: Buffer.from(html).toString("base64"),
    }, sessionId).catch(() => {});
  };
  browser.listeners.push(onPaused);
  try {
    await browser.send("Page.enable", {}, sessionId);
    await browser.send("Runtime.enable", {}, sessionId);
    await browser.send("Fetch.enable", { patterns: [{ urlPattern: "*t053page=*", requestStage: "Request" }] }, sessionId);
    const mobile = width < 500;
    await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile }, sessionId);
    await browser.send("Page.navigate", { url: `${BASE}/api/templates/screwfast/preview?t053page=${Date.now()}-${Math.random()}` }, sessionId);
    for (let waited = 0; waited < 30000; waited += 100) {
      const ready = await browser.evaluate(`document.readyState === "complete" && typeof window.__sitecraftApplyDeclared === "function"`, sessionId).catch(() => false);
      if (ready) break;
      await sleep(100);
    }
    const report = await browser.evaluate(`(() => {
      const draft = ${JSON.stringify(draft ?? null)};
      return window.__sitecraftApplyDeclared(draft, ${JSON.stringify(locale)}, [], ${JSON.stringify(variant)}, ${JSON.stringify(activePage ?? null)}, Boolean(draft && draft.englishReady === true));
    })()`, sessionId);
    if (prepare) await browser.evaluate(`(async () => { ${prepare} })()`, sessionId);
    const settle = `(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].filter((img) => !img.complete).map((img) => new Promise((done) => { img.addEventListener("load", done, { once: true }); img.addEventListener("error", done, { once: true }); setTimeout(done, 8000); })));
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
      return Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    })()`;
    let height = await browser.evaluate(settle, sessionId);
    for (let round = 0; round < 3; round += 1) {
      await browser.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile }, sessionId);
      await sleep(250);
      const next = await browser.evaluate(settle, sessionId);
      if (next === height) break;
      height = next;
    }
    const shot = await browser.send("Page.captureScreenshot", { format: "png" }, sessionId);
    fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
    const blocks = await browser.evaluate(`[...document.querySelectorAll("[data-sc-block]")].map((node) => node.getAttribute("data-sc-block") + ":" + node.getAttribute("data-sc-variant"))`, sessionId);
    const products = await browser.evaluate(`(() => { const hero = document.querySelector('[data-sitecraft-section="hero"]'); const node = document.querySelector('[data-sitecraft-section="products"]'); if (!node || !hero) return null; return { top: Math.floor(hero.getBoundingClientRect().top + scrollY), bottom: Math.ceil(node.getBoundingClientRect().bottom + scrollY) }; })()`, sessionId);
    // The line box of each visible element with an email in its own text (T-053 step 4: emails now wrap only at the @).
    const emailBoxes = await browser.evaluate(`[...document.body.querySelectorAll("*")].filter((node) => !node.closest("script, style, template") && node.getClientRects().length && [...node.childNodes].some((child) => child.nodeType === 3 && /@[A-Za-z0-9\\-\\u200b\\u2060]+\\./.test(child.textContent))).map((node) => { const line = node.closest("[data-sitecraft-line]") || node; const r = line.getBoundingClientRect(); return [Math.floor(r.left) - 1, Math.floor(r.top + scrollY) - 1, Math.ceil(r.right) + 1, Math.ceil(r.bottom + scrollY) + 1]; })`, sessionId);
    return { height, missing: report.missingSlots, blocks, products, emailBoxes };
  } finally {
    browser.listeners.splice(browser.listeners.indexOf(onPaused), 1);
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
  }
}

// Outside a region: the page above it must match, and the page below it must match once aligned
// on the region's bottom edge (the region may change height).
function outsideDiff(oldFile, newFile, oldRegion, newRegion) {
  const script = `
import sys, json
from PIL import Image, ImageChops
a = Image.open(sys.argv[1]).convert("RGB"); b = Image.open(sys.argv[2]).convert("RGB")
ot, ob, nt, nb = map(int, sys.argv[3:7])
def count(x, y):
    if x.size != y.size: return {"sizes": [list(x.size), list(y.size)]}
    h = ImageChops.difference(x, y).convert("L").histogram(); return x.size[0] * x.size[1] - h[0]
above = count(a.crop((0, 0, a.width, ot)), b.crop((0, 0, b.width, nt)))
below = count(a.crop((0, ob, a.width, a.height)), b.crop((0, nb, b.width, b.height)))
print(json.dumps({"above": above, "below": below, "regionHeight": [ob - ot, nb - nt]}))
`;
  const result = spawnSync("python3", ["-c", script, oldFile, newFile, oldRegion.top, oldRegion.bottom, newRegion.top, newRegion.bottom].map(String), { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr);
  return JSON.parse(result.stdout);
}

// The same comparison with each page's email lines painted over: what differs apart from where an
// email wraps. With regions (the molding cases), above/below the hero..products region as outsideDiff.
function maskedDiff(oldFile, newFile, oldBoxes, newBoxes, oldRegion, newRegion) {
  const script = `
import sys, json
from PIL import Image, ImageChops, ImageDraw
a = Image.open(sys.argv[1]).convert("RGB"); b = Image.open(sys.argv[2]).convert("RGB")
for image, boxes in ((a, json.loads(sys.argv[3])), (b, json.loads(sys.argv[4]))):
    draw = ImageDraw.Draw(image)
    for box in boxes: draw.rectangle(box, fill=(255, 0, 255))
def count(x, y):
    if x.size != y.size: return {"sizes": [list(x.size), list(y.size)]}
    h = ImageChops.difference(x, y).convert("L").histogram(); return x.size[0] * x.size[1] - h[0]
region = json.loads(sys.argv[5])
if region:
    ot, ob, nt, nb = region
    print(json.dumps({"above": count(a.crop((0, 0, a.width, ot)), b.crop((0, 0, b.width, nt))), "below": count(a.crop((0, ob, a.width, a.height)), b.crop((0, nb, b.width, b.height)))}))
else:
    print(json.dumps({"different": count(a, b)}))
`;
  const region = oldRegion && newRegion ? [oldRegion.top, oldRegion.bottom, newRegion.top, newRegion.bottom] : null;
  const result = spawnSync("python3", ["-c", script, oldFile, newFile, JSON.stringify(oldBoxes ?? []), JSON.stringify(newBoxes ?? []), JSON.stringify(region)], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr);
  return JSON.parse(result.stdout);
}

function pixelDiff(oldFile, newFile, diffFile) {
  const script = `
import sys, json
from PIL import Image, ImageChops
a = Image.open(sys.argv[1]).convert("RGB"); b = Image.open(sys.argv[2]).convert("RGB")
out = {"old": list(a.size), "new": list(b.size)}
if a.size != b.size:
    out["sameSize"] = False
    w, h = min(a.size[0], b.size[0]), min(a.size[1], b.size[1])
    a, b = a.crop((0, 0, w, h)), b.crop((0, 0, w, h))
else:
    out["sameSize"] = True
diff = ImageChops.difference(a, b)
hist = diff.convert("L").histogram()
out["pixels"] = a.size[0] * a.size[1]
out["different"] = out["pixels"] - hist[0]
out["bbox"] = diff.getbbox()
out["maxChannel"] = max(max(band) for band in [diff.getextrema()[i] for i in range(3)])
if out["different"]:
    mask = diff.convert("L").point(lambda v: 255 if v else 0)
    marked = b.copy(); red = Image.new("RGB", b.size, (255, 0, 0)); marked.paste(red, mask=mask); marked.save(sys.argv[3])
print(json.dumps(out))
`;
  const result = spawnSync("python3", ["-c", script, oldFile, newFile, diffFile], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr);
  return JSON.parse(result.stdout);
}

const results = [];
try {
  for (const [caseIndex, item] of CASES.entries()) {
    const draft = item.site ? (await fetch(`${BASE}/api/sites/${encodeURIComponent(item.site)}/draft`).then((response) => response.json())).draft : null;
    if (draft && draft.templateId !== "screwfast") throw new Error(`${item.site} is not an engineering draft (${draft.templateId})`);
    const pagesInPlan = draft?.pagePlan?.pages ?? [];
    const activePage = draft ? (item.page ? pagesInPlan.find((entry) => entry.id === item.page) : pagesInPlan[0]) ?? null : null;
    if (item.page && !activePage) throw new Error(`${item.site} has no page ${item.page}`);
    for (const width of WIDTHS) {
      const label = `${String(caseIndex + 1).padStart(2, "0")}-${(item.site ?? "no-draft").slice(0, 24)}-${item.locale}-${item.variant}${item.page ? `-${item.page}` : ""}${item.state ? `-${item.state}` : ""}-${width}`;
      const oldFile = path.join(OUT, `${label}-old.png`);
      const newFile = path.join(OUT, `${label}-new.png`);
      const page = pages[item.variant === "workspace" ? "workspace" : "published"];
      const oldRender = await render({ html: page.old, draft, locale: item.locale, variant: item.variant, activePage, prepare: item.prepare, width, file: oldFile });
      const newRender = await render({ html: page.new, draft, locale: item.locale, variant: item.variant, activePage, prepare: item.prepare, width, file: newFile });
      const diff = pixelDiff(oldFile, newFile, path.join(OUT, `${label}-diff.png`));
      const same = diff.different === 0 && diff.sameSize;
      const outside = item.expectDiff && oldRender.products && newRender.products ? outsideDiff(oldFile, newFile, oldRender.products, newRender.products) : null;
      const masked = same ? null : maskedDiff(oldFile, newFile, oldRender.emailBoxes, newRender.emailBoxes, item.expectDiff ? oldRender.products : null, item.expectDiff ? newRender.products : null);
      const emailOnly = !same && !item.expectDiff && masked.different === 0;
      const expected = item.expectDiff ? Boolean(outside && ((outside.above === 0 && outside.below === 0) || (masked && masked.above === 0 && masked.below === 0))) : same || emailOnly;
      const row = { label, note: item.note, width, expectDiff: item.expectDiff ?? null, expected, oldHeight: oldRender.height, newHeight: newRender.height, oldMissing: oldRender.missing, newMissing: newRender.missing, newBlocks: newRender.blocks, outside, ...diff };
      results.push(row);
      const emailToo = Boolean(item.expectDiff && outside && !(outside.above === 0 && outside.below === 0) && expected);
      row.masked = masked; row.emailOnly = emailOnly; row.emailToo = emailToo;
      const status = item.expectDiff ? (expected ? (same ? "same" : emailToo ? "only-hero+products+email" : "only-hero+products") : "DIFF-OUTSIDE") : (same ? "same" : emailOnly ? "only-email" : "DIFF");
      console.log(`${status} ${label} ${diff.old.join("x")} -> ${diff.new.join("x")} different=${diff.different}${diff.bbox ? ` bbox=${diff.bbox}` : ""}${outside ? ` outside-hero..products above=${JSON.stringify(outside.above)} below=${JSON.stringify(outside.below)} region=${outside.regionHeight.join("->")}` : ""}`);
    }
  }
} finally {
  await browser.send("Browser.close").catch(() => {});
  const exited = new Promise((done) => chrome.once("exit", done));
  chrome.kill();
  await Promise.race([exited, sleep(5000)]);
  fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  fs.rmSync(oldRoot, { recursive: true, force: true });
}
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ oldCommit: OLD_COMMIT, base: BASE, at: new Date().toISOString(), results }, null, 2));
const failures = results.filter((row) => !row.expected);
const productOnly = results.filter((row) => row.expectDiff && row.expected && (row.different !== 0 || !row.sameSize));
const emailOnlyRows = results.filter((row) => row.emailOnly);
const sameRows = results.filter((row) => row.different === 0 && row.sameSize);
console.log(`\n${sameRows.length} identical, ${emailOnlyRows.length} differ only in the email lines, ${productOnly.filter((row) => row.emailToo).length} of the hero..products ones also in the email lines`);
console.log(`\n${results.length} renders compared: ${failures.length} unexpected, ${productOnly.length} differ only between the hero and the end of the product section, as expected`);
process.exitCode = failures.length ? 1 : 0;

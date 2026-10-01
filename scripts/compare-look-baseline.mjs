// Compare one block-library look against a frozen commit with the same drafts and Chrome.
//
//   CHROME_PATH=… node scripts/compare-look-baseline.mjs --template forge --old 7d09e6e --out dir
//
// The old side imports compose, bridge and adapter code from the requested commit; both sides
// render through the current dev server with Fetch interception, so the network and viewport are
// identical. Exit 1 when any pixel differs.
import { execFileSync, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.SITECRAFT_BASE || "http://127.0.0.1:3034";
const CHROME = process.env.CHROME_PATH;
if (!CHROME) throw new Error("set CHROME_PATH");
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const TEMPLATE = option("--template", "forge");
const OLD_COMMIT = option("--old", "7d09e6e");
const OUT = option("--out", path.join("artifacts", "t057", `${TEMPLATE}-pixel-compare`));
const CASES = TEMPLATE === "forge"
  ? [
    { site: "b5cd5a88-0681-41eb-82af-844e895a7b9a", note: "工业真实草稿" },
    { site: "e2b46734-979d-451c-a799-7a21309c0128", note: "外贸真实草稿" },
    { site: "29bdfa92-4d0c-4ef1-8fd8-54bb6e92e53f", note: "注塑真实草稿" },
  ]
  : [
    { site: "4345e6dc-8756-4170-ab7f-68576d601892", note: "工程工业真实草稿" },
    { site: "bc386e3d-0d4a-427f-ab22-a309b823ffdf", note: "外贸真实草稿" },
    { site: "3f729be4-8a22-4127-91b8-9c658178d405", note: "注塑真实草稿" },
  ];
if (!new Set(["forge", "landwind"]).has(TEMPLATE)) throw new Error(`unsupported template ${TEMPLATE}`);
const WIDTHS = [1440, 768, 375];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
fs.mkdirSync(OUT, { recursive: true });

const oldRoot = fs.mkdtempSync(path.join(OUT, "old-code-"));
const archive = execFileSync("git", ["archive", OLD_COMMIT], { maxBuffer: 128 * 1024 * 1024 });
const unpack = spawnSync("tar", ["-x", "-f", "-"], { cwd: oldRoot, input: archive });
if (unpack.status !== 0) throw new Error("could not unpack old commit");
const oldCompose = await import(path.resolve(oldRoot, "lib/blocks/compose.ts"));
const oldBridge = await import(path.resolve(oldRoot, "lib/template-adapters/preview-bridge.ts"));
const oldRegistry = await import(path.resolve(oldRoot, "lib/template-adapters/registry.ts"));
const newCompose = await import(path.resolve("lib/blocks/compose.ts"));
const newBridge = await import(path.resolve("lib/template-adapters/preview-bridge.ts"));
const newRegistry = await import(path.resolve("lib/template-adapters/registry.ts"));

function prepareHtml(html, bridge, adapter) {
  const assetBase = `/api/templates/${TEMPLATE}/assets/`;
  const normalized = bridge.stripHtmlScripts(html).replace(/<base\b[^>]*>/gi, "");
  const injection = `<base href="${assetBase}"><meta name="sitecraft-template" content="${TEMPLATE}"><style>html{scroll-behavior:smooth}body{min-height:100vh}[class*="scroll-fade"],[class*="fade-up"],[class*="reveal"],[data-aos]{opacity:1!important;visibility:visible!important;transform:none!important}</style>`;
  const finalState = `<style>html body [class*="scroll-fade"],html body [class*="fade-up"],html body [class*="reveal"],html body [data-aos]{opacity:1!important;visibility:visible!important;transform:none!important}</style>`;
  const script = bridge.buildPreviewBridgeScript(TEMPLATE, adapter);
  return normalized.replace(/<head\b([^>]*)>/i, `<head$1>${injection}`).replace(/<\/body\s*>/i, `${finalState}${script}</body>`);
}
const oldHtml = prepareHtml(oldCompose.composedPageForTemplate(TEMPLATE), oldBridge, oldRegistry.getTemplateAdapter(TEMPLATE));
const newHtml = prepareHtml(newCompose.composedPageForTemplate(TEMPLATE), newBridge, newRegistry.getTemplateAdapter(TEMPLATE));

class Cdp {
  constructor(url) { this.url = url; this.id = 1; this.pending = new Map(); this.listeners = []; }
  async connect() { this.ws = new WebSocket(this.url); await new Promise((resolve, reject) => { this.ws.addEventListener("open", resolve, { once: true }); this.ws.addEventListener("error", reject, { once: true }); }); this.ws.addEventListener("message", (event) => { const message = JSON.parse(event.data); if (message.method) for (const listener of this.listeners) listener(message); const waiter = message.id && this.pending.get(message.id); if (!waiter) return; this.pending.delete(message.id); message.error ? waiter.reject(new Error(JSON.stringify(message.error))) : waiter.resolve(message.result); }); }
  send(method, params = {}, sessionId) { const id = this.id++; this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); return new Promise((resolve, reject) => { const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`${method} timeout`)); }, 60000); this.pending.set(id, { resolve: (value) => { clearTimeout(timer); resolve(value); }, reject: (error) => { clearTimeout(timer); reject(error); } }); }); }
  async eval(expression, sessionId) { const { result, exceptionDetails } = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId); if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text); return result.value; }
}
async function connectChrome() { const port = 9980 + (process.pid % 15); const profile = path.resolve(`${OUT}-chrome-profile`); const chrome = spawn(CHROME, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--headless", "--no-first-run", "--hide-scrollbars", "about:blank"], { stdio: "ignore" }); let version = null; for (let i = 0; i < 80 && !version; i++) { await sleep(250); version = await fetch(`http://127.0.0.1:${port}/json/version`).then((r) => r.json()).catch(() => null); } if (!version?.webSocketDebuggerUrl) throw new Error("Chrome endpoint unavailable"); const browser = new Cdp(version.webSocketDebuggerUrl); await browser.connect(); return { browser, chrome, profile }; }

async function render(browser, html, draft, width, file) {
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" }); const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true });
  const marker = `t057pixel=${Date.now()}-${Math.random()}`;
  const pause = (message) => { if (message.method !== "Fetch.requestPaused" || message.sessionId !== sessionId) return; browser.send("Fetch.fulfillRequest", { requestId: message.params.requestId, responseCode: 200, responseHeaders: [{ name: "Content-Type", value: "text/html; charset=utf-8" }], body: Buffer.from(html).toString("base64") }, sessionId).catch(() => {}); };
  browser.listeners.push(pause);
  try {
    await browser.send("Page.enable", {}, sessionId); await browser.send("Runtime.enable", {}, sessionId); await browser.send("Fetch.enable", { patterns: [{ urlPattern: `*${marker}*`, requestStage: "Request" }] }, sessionId);
    await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);
    await browser.send("Page.navigate", { url: `${BASE}/api/templates/${TEMPLATE}/preview?${marker}` }, sessionId);
    for (let i = 0; i < 300; i++) { if (await browser.eval("document.readyState === 'complete' && typeof window.__sitecraftApplyDeclared === 'function'", sessionId).catch(() => false)) break; await sleep(100); }
    await browser.eval(`window.__sitecraftApplyDeclared(${JSON.stringify(draft)}, "zh", [], "published", null, false)`, sessionId);
    await browser.eval("new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))", sessionId);
    const shot = await browser.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }, sessionId); fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
    const info = await browser.eval(`(()=>{const sections=[...document.querySelectorAll('[data-sitecraft-section]')].map(n=>n.getAttribute('data-sitecraft-section')).filter((x,i,a)=>x&&a.indexOf(x)===i);return {text:(document.body?.innerText||'').slice(0,400),sections}})()`, sessionId);
    return info;
  } finally { browser.listeners.splice(browser.listeners.indexOf(pause), 1); await browser.send("Target.closeTarget", { targetId }).catch(() => {}); }
}
function pixelDiff(oldFile, newFile, diffFile) { const code = `import sys,json\nfrom PIL import Image,ImageChops\na=Image.open(sys.argv[1]).convert('RGB');b=Image.open(sys.argv[2]).convert('RGB');d=ImageChops.difference(a,b);h=d.convert('L').histogram();o={'old':list(a.size),'new':list(b.size),'pixels':a.width*a.height,'different':a.width*a.height-h[0],'bbox':d.getbbox()};\nif o['different']: d.save(sys.argv[3])\nprint(json.dumps(o))`; const result = spawnSync("python3", ["-c", code, oldFile, newFile, diffFile], { encoding: "utf8" }); if (result.status) throw new Error(result.stderr); return JSON.parse(result.stdout); }

const { browser, chrome, profile } = await connectChrome(); const results = [];
try {
  for (const [index, item] of CASES.entries()) {
    const draft = (await (await fetch(`${BASE}/api/sites/${item.site}/draft`)).json()).draft;
    const normalized = { ...draft, templateId: TEMPLATE, visualBrief: { ...draft.visualBrief, templateId: TEMPLATE, id: TEMPLATE === "forge" ? "industrial" : "export-catalog" } };
    for (const width of WIDTHS) {
      const label = `${String(index + 1).padStart(2, "0")}-${item.site.slice(0, 24)}-${width}`; const oldFile = path.join(OUT, `${label}-old.png`); const newFile = path.join(OUT, `${label}-new.png`); const diffFile = path.join(OUT, `${label}-diff.png`);
      const oldInfo = await render(browser, oldHtml, normalized, width, oldFile); const newInfo = await render(browser, newHtml, normalized, width, newFile); const diff = pixelDiff(oldFile, newFile, diffFile);
      results.push({ label, note: item.note, width, old: oldFile, new: newFile, diff, oldOrder: oldInfo.sections, newOrder: newInfo.sections }); console.log(`${label} different=${diff.different} bbox=${diff.bbox || "none"}`);
    }
  }
} finally { browser.send("Browser.close").catch(() => {}); chrome.kill(); fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); }
const failures = results.filter((row) => row.diff.different || row.oldOrder.join(">") !== row.newOrder.join(">")); fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ template: TEMPLATE, oldCommit: OLD_COMMIT, cases: CASES.length, compared: results.length, failures, results }, null, 2)); console.log(`\n${results.length} renders compared; ${failures.length} differences`); process.exitCode = failures.length ? 1 : 0;

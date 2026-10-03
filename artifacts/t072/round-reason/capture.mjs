// Capture the T-072 recommendation card in the real workspace at the three required widths.
// The persisted card is a deterministic fixture; no model call or company material is recorded.
import fs from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const BASE = "http://127.0.0.1:3036";
const OUT = path.join(ROOT, "artifacts", "t072", "round-reason");
const PORT = String(9800 + (process.pid % 100));
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PROFILE = `/tmp/sitecraft-t072-card-${process.pid}`;
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const originalCwd = process.cwd();
const registerHooks = (await import("node:module")).registerHooks;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const abs = path.join(originalCwd, specifier.slice(2));
    const file = fs.existsSync(`${abs}.ts`) ? `${abs}.ts` : abs;
    return nextResolve(pathToFileURL(file).href, context);
  },
});
const { createConversation, updateConversationAlignment } = await import(pathToFileURL(path.join(ROOT, "lib/conversation-store.ts")).href);
const { applyAlignmentAction, disabledAlignment, styleQuestion } = await import(pathToFileURL(path.join(ROOT, "lib/alignment.ts")).href);
const { getSite } = await import(pathToFileURL(path.join(ROOT, "lib/site-store.ts")).href);

const created = await fetch(`${BASE}/api/sites`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "T-072 卡片证据", templateId: "screwfast", locales: ["zh", "en"] }),
}).then((response) => response.json());
const siteId = created.id;
const conversation = await createConversation(siteId);
const catalogCard = styleQuestion(1, {
  briefId: "export-catalog",
  reason: "资料中有 2 个产品，每个都有 5 项完整参数，适合用蓝白目录按系列浏览并发起询盘。",
  colorSetId: "colorSet:turquoise",
  colorReason: "资料中的洁净流体应用和不锈钢接头适合松石强调。",
});
const start = applyAlignmentAction(disabledAlignment(), {
  action: "start",
  pendingRequest: { message: "T-072 UI fixture", baseRevision: (await getSite(siteId)).draft.revision, selectedTarget: null },
  startQuestion: { ...catalogCard, kind: "clarify", questionId: "t072-card", questionRevision: 1 },
});
if (!start.ok) throw new Error("could not build card fixture");
await updateConversationAlignment(siteId, conversation.conversationId, (record) => ({ ...record, alignment: start.snapshot }));

class Cdp {
  constructor(url) { this.url = url; this.nextId = 1; this.pending = new Map(); }
  async connect() {
    this.ws = new WebSocket(this.url);
    await new Promise((resolve, reject) => { this.ws.addEventListener("open", resolve, { once: true }); this.ws.addEventListener("error", reject, { once: true }); });
    this.ws.addEventListener("message", (event) => { const message = JSON.parse(event.data); const waiter = this.pending.get(message.id); if (!waiter) return; this.pending.delete(message.id); message.error ? waiter.reject(new Error(JSON.stringify(message.error))) : waiter.resolve(message.result); });
  }
  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  async evaluate(expression, sessionId) {
    const result = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "browser evaluate failed");
    return result.result?.value;
  }
}

const chrome = spawn(CHROME, [`--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, "--headless=new", "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore", detached: true });
let version = null;
for (let i = 0; i < 80 && !version; i += 1) { await sleep(250); version = await fetch(`http://127.0.0.1:${PORT}/json/version`).then((response) => response.json()).catch(() => null); }
if (!version?.webSocketDebuggerUrl) throw new Error("Chrome DevTools endpoint unavailable");
const browser = new Cdp(version.webSocketDebuggerUrl);
await browser.connect();
const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true });
await browser.send("Page.enable", {}, sessionId);
await browser.send("Runtime.enable", {}, sessionId);
await browser.send("Page.navigate", { url: `${BASE}/` }, sessionId);
await sleep(1000);
await browser.evaluate(`localStorage.setItem(${JSON.stringify(`sitecraft-conversation:${siteId}`)}, ${JSON.stringify(conversation.conversationId)})`, sessionId);
await browser.send("Page.navigate", { url: `${BASE}/workspace?site=${siteId}` }, sessionId);
for (let i = 0; i < 120; i += 1) {
  if (await browser.evaluate(`Boolean(document.querySelector('[data-testid="alignment-card-question"]'))`, sessionId).catch(() => false)) break;
  await sleep(250);
}
const report = { siteId, conversationId: conversation.conversationId, widths: [] };
for (const width of [1440, 768, 375]) {
  await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: width === 375 }, sessionId);
  if (width === 375) await browser.evaluate(`[...document.querySelectorAll('.builder-mobile-tabs button')].find((button) => button.textContent?.includes('对话'))?.click()`, sessionId);
  await sleep(700);
  const file = path.join(OUT, `reason-card-${width}.png`);
  const screenshot = await browser.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }, sessionId);
  fs.writeFileSync(file, Buffer.from(screenshot.data, "base64"));
  const visible = await browser.evaluate(`({hasCard:Boolean(document.querySelector('[data-testid="alignment-card-question"]')), text:document.querySelector('.alignment-panel')?.innerText?.slice(0, 500) || ''})`, sessionId);
  report.widths.push({ width, screenshot: `artifacts/t072/reason-card-${width}.png`, visible });
}
fs.writeFileSync(path.join(OUT, "workspace-screenshots.json"), JSON.stringify(report, null, 2));
await browser.send("Target.closeTarget", { targetId }).catch(() => {});
browser.ws.close();
chrome.kill();
console.log(JSON.stringify(report));

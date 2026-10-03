// T-072 real-flow UI evidence: seed one simulated export draft with commitOperations,
// run the real alignment start once, then capture the workspace card and preview at 3 widths.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { spawn } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const BASE = "http://127.0.0.1:3036";
const OUT = path.join(ROOT, "artifacts", "t072", "round-reason-real");
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PROFILE = `/tmp/sitecraft-t072-real-reason-${process.pid}`;
mkdirSync(OUT, { recursive: true });

const envFile = process.env.SITECRAFT_ENV_FILE;
if (!envFile) throw new Error("SITECRAFT_ENV_FILE is required");
for (const line of readFileSync(envFile, "utf8").split("\n")) {
  const match = /^\s*(DEEPSEEK_[A-Z_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (match) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const abs = path.join(ROOT, specifier.slice(2));
    const file = existsSync(`${abs}.ts`) ? `${abs}.ts` : abs;
    return nextResolve(pathToFileURL(file).href, context);
  },
});

const { commitOperations, getSite } = await import(pathToFileURL(path.join(ROOT, "lib/site-store.ts")).href);
const { simulatedPacks, wrapCompanyMaterials } = await import(pathToFileURL(path.join(ROOT, "lib/simulated-packs.ts")).href);
const { packDraft } = await import(pathToFileURL(path.join(ROOT, "tests/fixtures/pack-drafts.ts")).href);
const chatRoute = await import(pathToFileURL(path.join(ROOT, "app/api/sites/[siteId]/chat/route.ts")).href);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const createdSiteIds = [];
const createdConversationIds = [];
const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const command = "SITECRAFT_ENV_FILE=/Users/luckye/Documents/Code/sitecraft-ai/.env.local SITE_STORE=fs PORT=3036 node artifacts/t072/round-reason-real/capture.mjs";

async function readSse(response) {
  const text = await response.text();
  if ((response.headers.get("Content-Type") ?? "").includes("application/json")) return { status: response.status, json: JSON.parse(text) };
  const events = text.split("\n\n").map((chunk) => chunk.trim()).filter((line) => line.startsWith("data:"))
    .map((line) => JSON.parse(line.slice(5).trim()));
  return { status: response.status, done: events.findLast((event) => event.type === "done") ?? null };
}

function seedOperations(draft) {
  const operations = [
    { op: "set_text", target: "siteName", value: draft.companyName },
    { op: "set_text", target: "companyName", value: draft.companyName },
    { op: "set_text", target: "industry", value: draft.industry },
    { op: "set_text", target: "goal", value: draft.goal },
    { op: "set_text", target: "hero.title", value: draft.content.hero.title },
    { op: "set_text", target: "hero.subtitle", value: draft.content.hero.subtitle },
    { op: "set_text", target: "hero.cta", value: draft.content.hero.cta },
    { op: "set_text", target: "products.title", value: { zh: "接头产品目录", en: "Fittings catalog" } },
    { op: "set_text", target: "products.intro", value: { zh: "按系列查找接头规格。", en: "Browse fittings by series." } },
    { op: "set_text", target: "contact.email", value: draft.content.contact.email },
    { op: "replace_products", products: draft.products },
  ];
  for (const section of ["industries", "capabilities", "certifications"]) {
    if (draft.content[section]?.items.length) operations.push({ op: "set_catalog_section", section, value: draft.content[section] });
  }
  return operations;
}

const created = await fetch(`${BASE}/api/sites`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "外高桥流体接头P3E", templateId: "screwfast", locales: ["zh", "en"] }),
}).then((response) => response.json());
const siteId = created.id;
createdSiteIds.push(siteId);
const before = await getSite(siteId);
const seeded = packDraft("export", { companyName: simulatedPacks.export.companyName });
const imported = await commitOperations({
  siteId,
  baseRevision: before.draft.revision,
  source: "import",
  summary: "T-072 real export materials fixture",
  operations: seedOperations(seeded),
});
if (imported.status !== "applied") throw new Error("commitOperations seed did not apply");

const started = await chatRoute.POST(new Request(`${BASE}/api/sites/${siteId}/chat`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "start", message: wrapCompanyMaterials(simulatedPacks.export.body), baseRevision: imported.record.draft.revision }),
}), { params: Promise.resolve({ siteId }) });
const startResult = await readSse(started);
if (startResult.status !== 200 || !startResult.done?.conversationId) throw new Error(`alignment start failed: ${JSON.stringify(startResult)}`);
const conversationId = startResult.done.conversationId;
createdConversationIds.push(conversationId);

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

const port = String(9800 + (process.pid % 100));
const chrome = spawn(CHROME, [`--remote-debugging-port=${port}`, `--user-data-dir=${PROFILE}`, "--headless=new", "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore", detached: true });
let version = null;
for (let i = 0; i < 80 && !version; i += 1) { await sleep(250); version = await fetch(`http://127.0.0.1:${port}/json/version`).then((response) => response.json()).catch(() => null); }
if (!version?.webSocketDebuggerUrl) throw new Error("Chrome DevTools endpoint unavailable");
const browser = new Cdp(version.webSocketDebuggerUrl);
await browser.connect();
const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true });
await browser.send("Page.enable", {}, sessionId);
await browser.send("Runtime.enable", {}, sessionId);
await browser.send("Page.navigate", { url: `${BASE}/` }, sessionId);
await sleep(700);
await browser.evaluate(`localStorage.setItem(${JSON.stringify(`sitecraft-conversation:${siteId}`)}, ${JSON.stringify(conversationId)})`, sessionId);
await browser.send("Page.navigate", { url: `${BASE}/workspace?site=${siteId}` }, sessionId);
for (let i = 0; i < 160; i += 1) {
  const ready = await browser.evaluate(`(() => { const card = document.querySelector('[data-testid="alignment-card-question"]'); const frame = document.querySelector('.template-preview-frame'); const text = frame?.contentDocument?.body?.innerText || ''; return Boolean(card && text.includes(${JSON.stringify(simulatedPacks.export.companyName)}) && text.includes("快换接头")); })()`, sessionId).catch(() => false);
  if (ready) break;
  await sleep(250);
}

const report = {
  command,
  capturedAt: new Date().toISOString(),
  serverPort: 3036,
  serverCommit: commit,
  siteId,
  conversationId,
  seedRevision: imported.record.draft.revision,
  start: { status: startResult.status, state: startResult.done?.state ?? null, questionCount: startResult.done?.questions?.length ?? 0 },
  expected: { company: simulatedPacks.export.companyName, products: ["快换接头", "卡套接头"], reason: "资料中有 2 个产品，每个都有 5 项完整参数" },
  widths: [],
};
for (const width of [1440, 768, 375]) {
  await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: width === 375 }, sessionId);
  if (width === 375) await browser.evaluate(`[...document.querySelectorAll('.builder-mobile-tabs button')].find((button) => button.textContent?.includes('对话'))?.click()`, sessionId);
  await sleep(700);
  const file = path.join(OUT, `real-card-${width}.png`);
  const screenshot = await browser.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }, sessionId);
  writeFileSync(file, Buffer.from(screenshot.data, "base64"));
  const visible = await browser.evaluate(`(() => {
    const card = document.querySelector('.alignment-panel');
    const frame = document.querySelector('.template-preview-frame');
    const previewText = frame?.contentDocument?.body?.innerText || '';
    const buttons = [...(card?.querySelectorAll('button') || [])];
    return {
      hasCard: Boolean(card),
      aiUnavailable: document.body.innerText.includes('AI 暂不可用'),
      disabledButtons: buttons.filter((button) => button.disabled).length,
      cardText: card?.innerText?.slice(0, 1200) || '',
      previewText: previewText.slice(0, 1600),
      previewHasCompany: previewText.includes(${JSON.stringify(simulatedPacks.export.companyName)}),
      previewHasProducts: previewText.includes('快换接头') && previewText.includes('卡套接头'),
      previewHasParameter: previewText.includes('DN8') || previewText.includes('2.5 MPa'),
    };
  })()`, sessionId);
  report.widths.push({ width, screenshot: `artifacts/t072/round-reason-real/real-card-${width}.png`, visible });
}
writeFileSync(path.join(OUT, "workspace-screenshots.json"), JSON.stringify(report, null, 2));
await browser.send("Target.closeTarget", { targetId }).catch(() => {});
browser.ws.close();
chrome.kill();
for (const id of createdConversationIds) rmSync(path.join(ROOT, ".sitecraft-data", "conversations", siteId), { recursive: true, force: true });
for (const id of createdSiteIds) rmSync(path.join(ROOT, ".sitecraft-data", "sites", `${id}.json`), { force: true });
console.log(JSON.stringify(report));

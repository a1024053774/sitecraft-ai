import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { blockCatalog } from "./blocks/catalog.ts";
import type { SiteDraft } from "./site-document.ts";
import { normalizeSiteStyle } from "./blocks/site-style.ts";

const scanSource = fs.readFileSync(path.join(process.cwd(), "scripts/visitor-layout-scan.js"), "utf8")
  .replace(/export default scanVisitorLayout;?/g, "")
  .replace(/export function scanVisitorLayout/g, "function scanVisitorLayout");
const WIDTHS = [375, 768, 1440] as const;
export const SITE_STYLE_CHECK_TIMEOUT_MS = 90_000;

type CdpResult = { result?: { value?: unknown }; exceptionDetails?: { exception?: { description?: string }; text?: string } };
class Cdp {
  private nextId = 1;
  private pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  private ws!: WebSocket;
  private readonly url: string;
  constructor(url: string) { this.url = url; }
  async connect() {
    this.ws = new WebSocket(this.url);
    await new Promise<void>((resolve, reject) => {
      this.ws.addEventListener("open", () => resolve(), { once: true });
      this.ws.addEventListener("error", () => reject(new Error("Chrome DevTools connection failed")), { once: true });
    });
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as { id?: number; result?: unknown; error?: unknown };
      const waiter = message.id ? this.pending.get(message.id) : undefined;
      if (!waiter) return;
      const id = message.id;
      if (id === undefined) return;
      this.pending.delete(id);
      if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
      else waiter.resolve(message.result);
    });
  }
  send(method: string, params: Record<string, unknown> = {}, sessionId?: string): Promise<unknown> {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`${method} timed out`)); }, 60000);
      this.pending.set(id, { resolve: (value) => { clearTimeout(timer); resolve(value); }, reject: (error) => { clearTimeout(timer); reject(error); } });
    });
  }
  async evaluate(expression: string, sessionId: string) {
    const result = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId) as CdpResult;
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "Preview evaluation failed");
    return result.result?.value;
  }
  close() { this.ws?.close(); }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function startChrome(deadline: number) {
  const executable = process.env.CHROME_PATH;
  if (!executable || !fs.existsSync(executable)) throw new Error("站点样式没有应用：样式检查没有运行（找不到 Chrome，设置 CHROME_PATH 后重试）");
  if (Date.now() >= deadline) throw new Error("STYLE_CHECK_TIMEOUT");
  const port = 9950 + (process.pid % 100);
  const profile = path.join(process.cwd(), ".sitecraft-data", `site-style-check-${process.pid}`);
  const chrome = spawn(executable, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--headless", "--no-first-run", "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
  try {
    let version: { webSocketDebuggerUrl?: string } | null = null;
    for (let attempt = 0; attempt < 80 && !version; attempt += 1) {
      if (Date.now() >= deadline) throw new Error("STYLE_CHECK_TIMEOUT");
      await sleep(250);
      version = await fetch(`http://127.0.0.1:${port}/json/version`).then((response) => response.json()).catch(() => null);
    }
    if (!version?.webSocketDebuggerUrl) throw new Error("站点样式没有应用：Chrome DevTools endpoint 不可用");
    const browser = new Cdp(version.webSocketDebuggerUrl);
    await browser.connect();
    return { browser, chrome, profile };
  } catch (error) {
    chrome.kill();
    throw error;
  }
}

async function render(browser: Cdp, baseUrl: string, templateId: string, draft: SiteDraft, width: number, file: string, locale: string, deadline: number) {
  if (Date.now() >= deadline) throw new Error("STYLE_CHECK_TIMEOUT");
  const target = await browser.send("Target.createTarget", { url: "about:blank" }) as { targetId: string };
  const attached = await browser.send("Target.attachToTarget", { targetId: target.targetId, flatten: true }) as { sessionId: string };
  const sessionId = attached.sessionId;
  await browser.send("Page.enable", {}, sessionId);
  await browser.send("Runtime.enable", {}, sessionId);
  const mobile = width < 500;
  await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile }, sessionId);
  await browser.send("Page.navigate", { url: `${baseUrl}/api/templates/${encodeURIComponent(templateId)}/preview?site-style=${Date.now()}-${Math.random()}` }, sessionId);
  let ready = false;
  for (let attempt = 0; attempt < 300; attempt += 1) {
    if (Date.now() >= deadline) throw new Error("STYLE_CHECK_TIMEOUT");
    ready = Boolean(await browser.evaluate("document.readyState === 'complete' && typeof window.__sitecraftApplyDeclared === 'function'", sessionId).catch(() => false));
    if (ready) break;
    await sleep(100);
  }
  if (!ready) throw new Error("站点样式没有应用：预览桥没有就绪");
  if (Date.now() >= deadline) throw new Error("STYLE_CHECK_TIMEOUT");
  await browser.evaluate(`window.__sitecraftApplyDeclared(${JSON.stringify(draft)}, ${JSON.stringify(locale)}, [], "published", null, ${draft.englishReady})`, sessionId);
  const settle = `(async () => { await document.fonts.ready; await Promise.all([...document.images].filter((img) => !img.complete).map((img) => new Promise((done) => { img.addEventListener('load', done, { once: true }); img.addEventListener('error', done, { once: true }); setTimeout(done, 8000); }))); await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))); return Math.max(document.documentElement.scrollHeight, document.body.scrollHeight); })()`;
  if (Date.now() >= deadline) throw new Error("STYLE_CHECK_TIMEOUT");
  const height = Number(await browser.evaluate(settle, sessionId) || 900);
  await browser.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile }, sessionId);
  await sleep(150);
  if (Date.now() >= deadline) throw new Error("STYLE_CHECK_TIMEOUT");
  const scan = await browser.evaluate(`(() => { ${scanSource}; return scanVisitorLayout(document); })()`, sessionId) as {
    horizontalScroll: boolean;
    overflowElements: Array<{ block: string; amount: number; key: string }>;
    textOverlaps: Array<{ block: string; amount: number; key: string }>;
    heroTitleOrphan?: boolean;
    heroTitleWordBreak?: boolean;
    slots: Array<{ key: string; visible: boolean; block: string; contrast: number | null; contrastStatus?: string }>;
    textContrast?: Array<{ element: string; block: string; text: string; status: string; reason?: string; ratio: number | null; threshold: number; checkable: boolean }>;
    bodyLineLength?: Array<{ element: string; block: string; text: string; language: string; count: number; max: number; tooLong: boolean }>;
    lineLengthExemptions?: Array<{ element: string; reason: string; text: string }>;
    height: number;
  };
  if (file) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const shot = await browser.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }, sessionId) as { data: string };
    fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
  }
  await browser.send("Target.closeTarget", { targetId: target.targetId }).catch(() => {});
  return scan;
}

function blockLabel(block: string) {
  return blockCatalog[block as keyof typeof blockCatalog]?.label || block;
}

export type SiteStyleCheckResult =
  | { ok: true; widths: number[]; reports: Record<string, unknown>; screenshots: string[] }
  | { ok: false; reasons: string[]; widths: number[]; reports: Record<string, unknown>; screenshots: string[] };

async function runSiteStyleCheck(args: { templateId: string; draft: SiteDraft; baseUrl: string; outDir?: string; timeoutMs?: number }, deadline: number): Promise<SiteStyleCheckResult> {
  const normalized = normalizeSiteStyle(args.draft.siteStyle);
  if (!normalized || (!normalized.rules.length && !normalized.direction)) return { ok: true, widths: [...WIDTHS], reports: {}, screenshots: [] };
  const outDir = args.outDir || "";
  const screenshots: string[] = [];
  const reports: Record<string, unknown> = {};
  const reasons: string[] = [];
  let browser: Cdp | null = null;
  let chrome: ReturnType<typeof spawn> | null = null;
  let profile = "";
  try {
    ({ browser, chrome, profile } = await startChrome(deadline));
    for (const locale of args.draft.englishReady ? ["zh", "en"] : ["zh"]) for (const width of WIDTHS) {
      if (Date.now() >= deadline) throw new Error("STYLE_CHECK_TIMEOUT");
      const baselineDraft = { ...args.draft, siteStyle: undefined };
      const candidateDraft = { ...args.draft, siteStyle: normalized };
      const baselineFile = outDir ? path.join(outDir, `baseline-${locale}-${width}.png`) : "";
      const candidateFile = outDir ? path.join(outDir, `candidate-${locale}-${width}.png`) : "";
      const baseline = await render(browser, args.baseUrl, args.templateId, baselineDraft, width, baselineFile, locale, deadline);
      const candidate = await render(browser, args.baseUrl, args.templateId, candidateDraft, width, candidateFile, locale, deadline);
      if (baselineFile) screenshots.push(baselineFile, candidateFile);
      reports[`${locale}-${width}`] = { baseline, candidate };
      const newOverflow = candidate.overflowElements.filter((item) => !baseline.overflowElements.some((old) => old.key === item.key && old.amount >= item.amount));
      if ((candidate.horizontalScroll && !baseline.horizontalScroll) || newOverflow.length) {
        const item = newOverflow[0] || candidate.overflowElements[0] || { block: "页面", amount: 1 };
        reasons.push(`${width} 宽度下「${blockLabel(item.block)}」横向超出页面 ${item.amount}px。`);
      }
      const baselineOverlapKeys = new Set(baseline.textOverlaps.map((item) => item.key));
      const newOverlaps = candidate.textOverlaps.filter((item) => !baselineOverlapKeys.has(item.key) && item.amount > 2);
      if (newOverlaps.length) {
        const item = newOverlaps[0];
        reasons.push(`${width} 宽度下「${blockLabel(item.block)}」出现文字重叠。`);
      }
      if (candidate.heroTitleOrphan && !baseline.heroTitleOrphan) reasons.push(`${width} 宽度下「首屏」标题在词中间断开单字。`);
      if (candidate.heroTitleWordBreak && !baseline.heroTitleWordBreak) reasons.push(`${width} 宽度下「首屏」标题在汉字词中间断行。`);
      for (const item of candidate.textContrast || []) {
        if (!item.checkable) continue;
        if (item.status === "unmeasured") reasons.push(`${width} 宽度下「${blockLabel(item.block)}」正文对比度未测（${item.reason || "图片背景"}）。`);
        else if (typeof item.ratio === "number" && item.ratio < item.threshold) reasons.push(`${width} 宽度下「${blockLabel(item.block)}」正文对比度不足 ${item.threshold}:1。`);
      }
      for (const item of candidate.bodyLineLength || []) {
        if (item.tooLong) reasons.push(`${width} 宽度下「${blockLabel(item.block)}」正文一行过长（${item.count}，上限 ${item.max}）。`);
      }
      const oldSlots = new Map(baseline.slots.map((slot) => [slot.key, slot]));
      for (const slot of candidate.slots) {
        const old = oldSlots.get(slot.key);
        if (old?.visible && (!slot.visible || (typeof old.contrast === "number" && typeof slot.contrast === "number" && old.contrast >= 3 && slot.contrast < 3))) reasons.push(`${width} 宽度下「${blockLabel(slot.block)}」文字被遮住或对比度不足 3:1。`);
      }
    }
  } catch (error) {
    reasons.push(error instanceof Error && error.message === "STYLE_CHECK_TIMEOUT"
      ? `站点样式没有应用：检查没有完成（超过 ${Math.ceil((args.timeoutMs ?? SITE_STYLE_CHECK_TIMEOUT_MS) / 1000)} 秒），请稍后重试。`
      : error instanceof Error ? error.message : "站点样式没有应用：样式检查失败");
  } finally {
    browser?.close();
    chrome?.kill();
    // Profiles stay alongside evidence; no automatic deletion.
  }
  return reasons.length ? { ok: false, reasons: reasons.slice(0, 3), widths: [...WIDTHS], reports, screenshots } : { ok: true, widths: [...WIDTHS], reports, screenshots };
}

let pendingCheck: Promise<unknown> = Promise.resolve();
export function checkSiteStyle(args: Parameters<typeof runSiteStyleCheck>[0]): Promise<SiteStyleCheckResult> {
  const deadline = Date.now() + (args.timeoutMs ?? SITE_STYLE_CHECK_TIMEOUT_MS);
  const queued = pendingCheck.then(() => runSiteStyleCheck(args, deadline));
  pendingCheck = queued.then(() => undefined, () => undefined);
  const timeoutResult: SiteStyleCheckResult = {
    ok: false,
    reasons: [`站点样式没有应用：检查没有完成（超过 ${Math.ceil((args.timeoutMs ?? SITE_STYLE_CHECK_TIMEOUT_MS) / 1000)} 秒），请稍后重试。`],
    widths: [...WIDTHS],
    reports: {},
    screenshots: [],
  };
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) { settled = true; resolve(timeoutResult); }
    }, Math.max(0, deadline - Date.now()));
    queued.then((value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    }, () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(timeoutResult);
    });
  });
}

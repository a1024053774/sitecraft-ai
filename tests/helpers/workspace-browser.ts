import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { open, readFile, rm, stat, utimes } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// Shared by the workspace browser tests (T-043, T-052). They need the dev server on
// SITECRAFT_BASE (default http://127.0.0.1:3034) and a Chrome or Chromium binary.
export const base = process.env.SITECRAFT_BASE || "http://127.0.0.1:3034";
export const contrastScan = readFileSync(new URL("../../scripts/workspace-contrast-scan.js", import.meta.url), "utf8");

type ChromeRow = { pid: number; dataDir: string; port: number | null; command: string };
type OwnedChrome = { pid: number; dataDir: string; port: number };
const ownedChromes = new Map<number, OwnedChrome>();
let lifecycleHooksInstalled = false;

function chromeRows(): ChromeRow[] | null {
  const result = spawnSync("ps", ["-axo", "pid=,ppid=,command="], { encoding: "utf8" });
  if (result.status !== 0) return null;
  return result.stdout.split("\n").map((line) => line.trim()).filter(Boolean).flatMap((line) => {
    if (!line.includes("chrome-headless-shell")) return [];
    const pid = Number.parseInt(line.split(/\s+/, 1)[0] ?? "", 10);
    const match = line.match(/--user-data-dir=(\/tmp\/sitecraft-workspace-[0-9]+)(?:\s|$)/);
    const commandPort = Number.parseInt(line.match(/--remote-debugging-port=(\d+)/)?.[1] ?? "", 10);
    const port = commandPort === 0 && match ? readDevToolsPort(match[1]) : commandPort;
    return Number.isInteger(pid) && match && Number.isInteger(commandPort) ? [{ pid, dataDir: match[1], port, command: line }] : [];
  });
}

function readDevToolsPort(dataDir: string) {
  try {
    const port = Number.parseInt(readFileSync(path.join(dataDir, "DevToolsActivePort"), "utf8").split("\n", 1)[0] ?? "", 10);
    return Number.isInteger(port) && port > 0 ? port : null;
  } catch {
    return null;
  }
}

function establishedDebuggerConnection(pid: number, port: number | null) {
  if (!port) return null;
  const result = spawnSync("lsof", ["-nP", "-a", "-p", String(pid), `-iTCP:${port}`, "-sTCP:ESTABLISHED"], { encoding: "utf8" });
  if (result.error) return null;
  if (result.status !== 0 && !result.stdout.trim()) return false;
  return result.stdout.split("\n").some((line) => line.trim() && !line.startsWith("COMMAND"));
}

function killChromeRows(rows: Array<{ pid: number }>, signal: NodeJS.Signals) {
  for (const row of rows) {
    try { process.kill(row.pid, signal); } catch { /* already exited */ }
  }
}

function killChromeGroup(pid: number, signal: NodeJS.Signals) {
  try { process.kill(-pid, signal); } catch { /* not a detached group or already exited */ }
}

function killOwnedChrome(chrome: OwnedChrome, signal: NodeJS.Signals) {
  const rows = chromeRows();
  if (rows) {
    const matching = rows.filter((row) => row.dataDir === chrome.dataDir);
    for (const row of matching.filter((item) => item.command.includes("--remote-debugging-port="))) killChromeGroup(row.pid, signal);
    killChromeRows(matching, signal);
  }
  try { process.kill(chrome.pid, signal); } catch { /* already exited */ }
}

async function stopOwnedChrome(chrome: OwnedChrome) {
  killOwnedChrome(chrome, "SIGKILL");
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (!chromeRows()?.some((row) => row.dataDir === chrome.dataDir)) return;
    await sleep(25);
  }
  killOwnedChrome(chrome, "SIGKILL");
}

function installLifecycleHooks() {
  if (lifecycleHooksInstalled) return;
  lifecycleHooksInstalled = true;
  process.on("exit", () => {
    for (const chrome of ownedChromes.values()) killOwnedChrome(chrome, "SIGKILL");
  });
  const stopOnSignal = (signal: "SIGINT" | "SIGTERM") => {
    for (const chrome of ownedChromes.values()) killOwnedChrome(chrome, "SIGKILL");
    process.exit(signal === "SIGINT" ? 130 : 143);
  };
  process.on("SIGINT", () => stopOnSignal("SIGINT"));
  process.on("SIGTERM", () => stopOnSignal("SIGTERM"));
}

async function reclaimOrphanedChromes() {
  const rows = chromeRows();
  if (!rows) return;
  const byDataDir = new Map<string, ChromeRow[]>();
  const orphaned = new Set<string>();
  for (const row of rows) byDataDir.set(row.dataDir, [...(byDataDir.get(row.dataDir) ?? []), row]);
  for (const [dataDir, candidates] of byDataDir) {
    const ownerPid = Number.parseInt(dataDir.slice(dataDir.lastIndexOf("-") + 1), 10);
    if (!Number.isInteger(ownerPid) || processAlive(ownerPid)) continue;
    const connected = establishedDebuggerConnection(candidates[0].pid, candidates[0].port);
    if (connected !== false) continue;
    orphaned.add(dataDir);
  }
  for (let attempt = 0; attempt < 80 && orphaned.size; attempt += 1) {
    const current = chromeRows()?.filter((row) => orphaned.has(row.dataDir)) ?? [];
    if (!current.length) break;
    for (const row of current.filter((item) => item.command.includes("--remote-debugging-port="))) killChromeGroup(row.pid, "SIGKILL");
    killChromeRows(current, "SIGKILL");
    await sleep(25);
  }
}

let workspaceIdentityChecked = false;

export async function assertWorkspaceServer() {
  if (workspaceIdentityChecked) return;
  let response: Response;
  try {
    response = await fetch(`${base}/api/health`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "request failed";
    throw new Error(`SITECRAFT_BASE ${base} is unavailable while checking the development workspace identity: ${detail}`);
  }
  const body = await response.json().catch(() => ({})) as { testIdentity?: { cwd?: unknown } };
  const servedCwd = body.testIdentity?.cwd;
  if (typeof servedCwd !== "string") {
    throw new Error(`SITECRAFT_BASE ${base} does not expose a development workspace identity; refusing to test an unknown server`);
  }
  const expectedCwd = path.resolve(process.cwd());
  if (path.resolve(servedCwd) !== expectedCwd) {
    throw new Error(`SITECRAFT_BASE ${base} serves ${servedCwd}, but tests run from ${expectedCwd}`);
  }
  workspaceIdentityChecked = true;
}

// The Node test runner starts test files in parallel, while all browser fixtures share the one
// dev server on 3034. Serialize those browser sessions at their shared-resource boundary instead
// of letting concurrent Chrome pages compile/serve the workspace against one another. A dead
// owner is reclaimed so an interrupted test cannot strand later runs.
const browserLockStaleMs = 5_000;

function processAlive(pid: number) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function processStartToken(pid: number) {
  const result = spawnSync("ps", ["-o", "lstart=", "-p", String(pid)], { encoding: "utf8" });
  const token = result.status === 0 ? result.stdout.trim() : "";
  return token || null;
}

function browserLockPath() {
  let port = "default";
  try {
    const url = new URL(base);
    port = url.port || (url.protocol === "https:" ? "443" : "80");
  } catch { /* the request itself will report an invalid base URL */ }
  const key = process.env.SITECRAFT_BROWSER_LOCK_KEY || port;
  return `${os.tmpdir()}/sitecraft-workspace-browser-${key}.lock`;
}

async function staleBrowserLock(path: string) {
  const metadata = await stat(path).catch(() => null);
  if (!metadata) return true;
  let record: { pid?: unknown; start?: unknown };
  try { record = JSON.parse(await readFile(path, "utf8")) as { pid?: unknown; start?: unknown }; } catch {
    return Date.now() - metadata.mtimeMs > browserLockStaleMs;
  }
  if (!Number.isInteger(record.pid) || typeof record.start !== "string") {
    return Date.now() - metadata.mtimeMs > browserLockStaleMs;
  }
  if (!processAlive(record.pid as number)) return true;
  const start = processStartToken(record.pid as number);
  return start ? start !== record.start : Date.now() - metadata.mtimeMs > browserLockStaleMs;
}

async function acquireBrowserLock() {
  while (true) {
    try {
      const path = browserLockPath();
      const handle = await open(path, "wx");
      await handle.writeFile(JSON.stringify({ pid: process.pid, start: processStartToken(process.pid) ?? `pid:${process.pid}`, acquiredAt: Date.now() }));
      await handle.close();
      const heartbeat = setInterval(() => {
        const now = new Date();
        void utimes(path, now, now).catch(() => {});
      }, 1_000);
      heartbeat.unref?.();
      let released = false;
      return async () => {
        if (released) return;
        released = true;
        clearInterval(heartbeat);
        try {
          const record = JSON.parse(await readFile(path, "utf8")) as { pid?: unknown; start?: unknown };
          if (record.pid === process.pid && record.start === (processStartToken(process.pid) ?? `pid:${process.pid}`)) {
            await rm(path, { force: true });
          }
        } catch { /* a crashed or already-released owner leaves no work for this process */ }
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const path = browserLockPath();
      if (await staleBrowserLock(path)) {
        await rm(path, { force: true }).catch(() => {});
        continue;
      }
      await sleep(100);
    }
  }
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chromeBinary() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ];
  const found = candidates.find((item) => item && existsSync(item));
  if (!found) throw new Error("Chrome is required: set CHROME_PATH");
  return found;
}

export class Cdp {
  url: string;
  id = 1;
  pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  ws!: WebSocket;
  listeners = new Map<string, Array<(params: Record<string, unknown>, sessionId?: string) => void>>();
  private cleanupFn: (() => Promise<void>) | null = null;
  private closed = false;

  constructor(url: string) { this.url = url; }

  async connect() {
    this.ws = new WebSocket(this.url);
    await new Promise<void>((resolve, reject) => {
      this.ws.addEventListener("open", () => resolve(), { once: true });
      this.ws.addEventListener("error", () => reject(new Error("Chrome socket failed")), { once: true });
    });
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as { id?: number; error?: unknown; result?: unknown; method?: string; params?: Record<string, unknown>; sessionId?: string };
      if (message.method) for (const listener of this.listeners.get(message.method) ?? []) listener(message.params ?? {}, message.sessionId);
      const pending = message.id ? this.pending.get(message.id) : undefined;
      if (!pending) return;
      this.pending.delete(message.id!);
      message.error ? pending.reject(new Error(JSON.stringify(message.error))) : pending.resolve(message.result);
    });
  }

  send(method: string, params: Record<string, unknown> = {}, sessionId?: string) {
    const id = this.id++;
    this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${method} timeout`)), 45000);
      this.pending.set(id, {
        resolve: (value) => { clearTimeout(timer); resolve(value); },
        reject: (error) => { clearTimeout(timer); reject(error); },
      });
    });
  }

  on(method: string, listener: (params: Record<string, unknown>, sessionId?: string) => void) {
    this.listeners.set(method, [...(this.listeners.get(method) ?? []), listener]);
  }

  attachLifecycle(cleanup: () => Promise<void>) {
    this.cleanupFn = cleanup;
    this.ws.addEventListener("close", () => { void this.cleanup(); }, { once: true });
  }

  async cleanup() {
    if (this.closed) return;
    this.closed = true;
    await this.cleanupFn?.();
  }

  async close() {
    if (this.closed) return;
    this.ws.close();
    await this.cleanup();
  }

  async eval<T = unknown>(expression: string, sessionId: string) {
    const result = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId) as { exceptionDetails?: { text?: string; exception?: { description?: string } }; result?: { value?: unknown } };
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "evaluate failed");
    return result.result?.value as T;
  }
}

export async function openBrowser() {
  await assertWorkspaceServer();
  await reclaimOrphanedChromes();
  installLifecycleHooks();
  const releaseLock = await acquireBrowserLock();
  let ownedChrome: OwnedChrome | null = null;
  try {
    const dataDir = `/tmp/sitecraft-workspace-${process.pid}`;
    if (chromeRows()?.some((row) => row.dataDir === dataDir)) {
      throw new Error(`Chrome profile ${dataDir} is already owned by another process; refusing to reuse it`);
    }
    await rm(path.join(dataDir, "DevToolsActivePort"), { force: true });
    const args = ["--remote-debugging-port=0", `--user-data-dir=${dataDir}`, "--headless=new", "--no-first-run", "--disable-gpu", "about:blank"];
    if (process.getuid?.() === 0) args.unshift("--no-sandbox");
    const child = spawn(chromeBinary(), args, { stdio: "ignore", detached: true });
    if (!child.pid) throw new Error("Chrome process did not provide a PID");
    ownedChrome = { pid: child.pid, dataDir, port: 0 };
    ownedChromes.set(child.pid, ownedChrome);
    child.unref();
    let version: { webSocketDebuggerUrl?: string } | null = null;
    for (let attempt = 0; attempt < 60 && !version; attempt += 1) {
      const port = readDevToolsPort(dataDir);
      if (port) {
        ownedChrome.port = port;
        version = await fetch(`http://127.0.0.1:${port}/json/version`).then((response) => response.json()).catch(() => null) as { webSocketDebuggerUrl?: string } | null;
      }
      if (!version) await sleep(250);
    }
    if (!version?.webSocketDebuggerUrl) throw new Error("Chrome DevTools endpoint unavailable");
    const browser = new Cdp(version.webSocketDebuggerUrl);
    await browser.connect();
    let cleaned = false;
    browser.attachLifecycle(async () => {
      if (cleaned) return;
      cleaned = true;
      if (ownedChrome) {
        await stopOwnedChrome(ownedChrome);
        ownedChromes.delete(ownedChrome.pid);
      }
      await releaseLock();
    });
    return browser;
  } catch (error) {
    if (ownedChrome) {
      ownedChromes.delete(ownedChrome.pid);
      killOwnedChrome(ownedChrome, "SIGKILL");
    }
    await releaseLock();
    throw error;
  }
}

export async function closeBrowser(browser: Cdp) {
  await browser.close();
}

export type WorkspacePage = { sessionId: string; targetId: string };

// Next recompiles /workspace while other agents edit. The first navigation then
// never paints, and the original 20s render wait fails. Ask the dev server until
// the document is actually the workspace, once, before that first navigation.
let workspaceServerReady = false;

async function waitForWorkspaceServer() {
  if (workspaceServerReady) return;
  const started = Date.now();
  let last = "no response";
  while (Date.now() - started < 60000) {
    try {
      const response = await fetch(`${base}/workspace`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
      const body = await response.text();
      const marked = body.includes("builder-shell");
      if (response.status === 200 && marked) {
        workspaceServerReady = true;
        return;
      }
      last = `HTTP ${response.status}${marked ? "" : ", response has no builder-shell"}`;
    } catch (error) {
      last = error instanceof Error ? error.message : "fetch failed";
    }
    await sleep(250);
  }
  throw new Error(`workspace page was not ready at ${base}/workspace within 60s (${last})`);
}

export async function openWorkspace(browser: Cdp, options: {
  siteId: string;
  width: number;
  theme: "dark" | "light";
  conversationId?: string;
  accent?: string;
  reducedMotion?: boolean;
  height?: number;
}): Promise<WorkspacePage> {
  await assertWorkspaceServer();
  await waitForWorkspaceServer();
  const created = await browser.send("Target.createTarget", { url: "about:blank" }) as { targetId: string };
  const attached = await browser.send("Target.attachToTarget", { targetId: created.targetId, flatten: true }) as { sessionId: string };
  const { sessionId } = attached;
  await browser.send("Page.enable", {}, sessionId);
  await browser.send("Runtime.enable", {}, sessionId);
  await browser.send("Emulation.setDeviceMetricsOverride", { width: options.width, height: options.height ?? (options.width < 800 ? 812 : 1000), deviceScaleFactor: 1, mobile: options.width < 800 }, sessionId);
  if (options.reducedMotion) {
    await browser.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] }, sessionId);
  }
  const seed = [
    `localStorage.setItem("sitecraft-workspace-theme", ${JSON.stringify(options.theme)});`,
    // A reused Chrome keeps localStorage between runs; pin the accent (default 青花瓷).
    `localStorage.setItem("sitecraft-workspace-accent", ${JSON.stringify(options.accent ?? "porcelain")});`,
    options.conversationId ? `localStorage.setItem(${JSON.stringify(`sitecraft-conversation:${options.siteId}`)}, ${JSON.stringify(options.conversationId)});` : "",
  ].join("");
  await browser.send("Page.addScriptToEvaluateOnNewDocument", { source: seed }, sessionId);
  await browser.send("Page.navigate", { url: `${base}/workspace?site=${encodeURIComponent(options.siteId)}` }, sessionId);
  await waitForCondition(browser, sessionId, `(() => { const shell = document.querySelector('.builder-shell'); const frame = document.querySelector('[data-testid=open-source-template-frame]'); return Boolean(shell && shell.className.includes('workspace-theme-${options.theme}') && getComputedStyle(shell).display === 'grid' && frame); })()`, `workspace ${options.theme} ${options.width} shell`, 60000);
  if (options.width <= 600) {
    await waitForCondition(browser, sessionId, `Boolean([...document.querySelectorAll('.builder-mobile-tabs button')].find((item) => item.textContent.includes('预览')))`, `workspace ${options.theme} ${options.width} preview tab`, 10000);
    await browser.eval(`[...document.querySelectorAll('.builder-mobile-tabs button')].find((item) => item.textContent.includes('预览'))?.click()`, sessionId);
    await waitForCondition(browser, sessionId, `[...document.querySelectorAll('.builder-mobile-tabs button')].some((item) => item.textContent.includes('预览') && item.getAttribute('aria-selected') === 'true')`, `workspace ${options.theme} ${options.width} preview pane`, 10000);
  }
  const ready = await waitForCondition(browser, sessionId, `(() => { const frame = document.querySelector('[data-testid=open-source-template-frame]'); return Boolean(frame?.dataset.previewHydrated === 'true' && document.querySelector('[data-preview-state=ready]')); })()`, `workspace ${options.theme} ${options.width} preview hydration`, 60000).then(() => true);
  if (!ready) throw new Error(`workspace ${options.theme} ${options.width} did not render`);
  return { sessionId, targetId: created.targetId };
}

export async function waitFor(browser: Cdp, sessionId: string, expression: string, timeout = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await browser.eval<boolean>(expression, sessionId).catch(() => false)) return true;
    await sleep(150);
  }
  return false;
}

export async function waitForCondition(browser: Cdp, sessionId: string, expression: string, label: string, timeout = 10000) {
  if (await waitFor(browser, sessionId, expression, timeout)) return;
  throw new Error(`Timed out waiting for ${label} after ${timeout}ms`);
}

export async function waitForPreviewBridge(browser: Cdp, sessionId: string, timeout: number, label: string) {
  await waitForCondition(browser, sessionId, "document.readyState === 'complete' && typeof window.__sitecraftApplyDeclared === 'function'", `${label} preview bridge`, timeout);
}

export async function waitForSettled(browser: Cdp, sessionId: string, label: string, timeout = 5000) {
  await waitForCondition(browser, sessionId, "document.getAnimations().every((item) => item.effect?.getTiming?.().iterations === Infinity || item.playState !== 'running')", `${label} animations`, timeout);
}

export function previewRefreshCoverHistoryExpression(previousRevision: string, timeout = 10000) {
  return `(async () => {
    const covered = [];
    const started = performance.now();
    return await new Promise((resolve) => {
      const sample = () => {
        const layer = document.querySelector("[data-testid=preview-load-progress]");
        if (layer) {
          const rect = layer.getBoundingClientRect();
          const style = getComputedStyle(layer);
          if (rect.height > 8 && (style.backgroundColor !== "rgba(0, 0, 0, 0)" || style.backgroundImage !== "none")) covered.push(rect.height + "px " + style.backgroundColor);
        }
        const changed = document.querySelector("[data-testid=workspace-draft-revision]").textContent !== ${JSON.stringify(previousRevision)} && document.querySelector("[data-testid=open-source-template-frame]")?.dataset.previewHydrated === "true";
        if (changed || performance.now() - started >= ${timeout}) return resolve({ covered, changed });
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
  })()`;
}

export async function closePage(browser: Cdp, page: WorkspacePage) {
  await browser.send("Target.closeTarget", { targetId: page.targetId }).catch(() => {});
}

export async function createSite(name: string) {
  const response = await fetch(`${base}/api/sites`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, templateId: "forge", locales: ["zh", "en"] }),
  });
  const created = await response.json() as { id?: string };
  if (!response.ok || !created.id) throw new Error(`site creation failed: HTTP ${response.status}`);
  return created.id;
}

// A real round-one card: with no Prompt the server builds the look and color-set
// questions from the catalog, without calling the model.
export async function startAlignmentCard(siteId: string) {
  const response = await fetch(`${base}/api/sites/${siteId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "start" }),
  });
  const text = await response.text();
  const done = text.split("\n\n").filter((item) => item.startsWith("data:")).map((item) => JSON.parse(item.slice(5)) as Record<string, unknown>).findLast((item) => item.type === "done");
  if (!response.ok || typeof done?.conversationId !== "string") throw new Error(`alignment start failed: HTTP ${response.status}`);
  return done.conversationId;
}

export async function screenshot(browser: Cdp, sessionId: string) {
  const shot = await browser.send("Page.captureScreenshot", { format: "png" }, sessionId) as { data: string };
  return Buffer.from(shot.data, "base64");
}

// Runs in the page: clicks the first visible button or link that has the test id, else the text.
export function clickExpression(testId: string, text?: string) {
  return `(() => {
    const shown = (el) => el && el.getClientRects().length && getComputedStyle(el).visibility !== "hidden";
    let el = [...document.querySelectorAll('[data-testid="${testId}"]')].find(shown);
    if (!el && ${JSON.stringify(text ?? "")}) el = [...document.querySelectorAll("button, a, [role=button], [role=tab]")].find((item) => shown(item) && (item.textContent.trim().includes(${JSON.stringify(text ?? "")}) || item.getAttribute("aria-label") === ${JSON.stringify(text ?? "")}));
    if (!el) return false;
    el.click();
    return true;
  })()`;
}

export const closeModalExpression = `(() => { const backdrop = document.querySelector(".modal-backdrop"); if (!backdrop) return true; backdrop.click(); return true; })()`;

// Types into the chat box through React's value setter, then presses 发送.
export function sendChatExpression(text: string) {
  return `(() => {
    const box = document.querySelector(".chat-input textarea");
    if (!box) return false;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(box, ${JSON.stringify(text)});
    box.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  })()`;
}

// Makes the chat POST fail the way the server does when no model is configured (HTTP 503,
// the same body shape), so the failed-request UI is tested on any machine, including ones
// that do have a model key. Only POSTs to the chat route are answered; every other paused
// request continues untouched. Returns a stop function that removes the interception and
// lists what was answered.
export async function failChatRequests(browser: Cdp, sessionId: string, delayMs = 0) {
  const intercepted: string[] = [];
  const handler = (params: Record<string, unknown>, from?: string) => {
    if (from !== sessionId) return;
    const request = params.request as { url: string; method: string };
    if (request.method !== "POST") {
      browser.send("Fetch.continueRequest", { requestId: params.requestId }, sessionId).catch(() => {});
      return;
    }
    intercepted.push(`${request.method} ${request.url}`);
    const message = "模型服务尚未配置，草稿没有伪造修改。";
    const body = { error: "not_configured", message, userMessage: `${message} 配置模型后重新提交；当前草稿和已上传素材不会被覆盖。`, recovery: "configure_provider" };
    setTimeout(() => {
      browser.send("Fetch.fulfillRequest", {
        requestId: params.requestId,
        responseCode: 503,
        responseHeaders: [{ name: "Content-Type", value: "application/json" }],
        body: Buffer.from(JSON.stringify(body)).toString("base64"),
      }, sessionId).catch(() => {});
    }, delayMs);
  };
  browser.on("Fetch.requestPaused", handler);
  await browser.send("Fetch.enable", { patterns: [{ urlPattern: "*/api/sites/*/chat", requestStage: "Request" }] }, sessionId);
  return async () => {
    await browser.send("Fetch.disable", {}, sessionId);
    browser.listeners.set("Fetch.requestPaused", (browser.listeners.get("Fetch.requestPaused") ?? []).filter((item) => item !== handler));
    return intercepted;
  };
}

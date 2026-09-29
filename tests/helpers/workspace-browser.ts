import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

// Shared by the workspace browser tests (T-043, T-052). They need the dev server on
// SITECRAFT_BASE (default http://127.0.0.1:3034) and a Chrome or Chromium binary.
export const base = process.env.SITECRAFT_BASE || "http://127.0.0.1:3034";
export const contrastScan = readFileSync(new URL("../../scripts/workspace-contrast-scan.js", import.meta.url), "utf8");

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

  async eval<T = unknown>(expression: string, sessionId: string) {
    const result = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId) as { exceptionDetails?: { text?: string; exception?: { description?: string } }; result?: { value?: unknown } };
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "evaluate failed");
    return result.result?.value as T;
  }
}

export async function openBrowser() {
  const port = 9365 + (process.pid % 200);
  const probe = () => fetch(`http://127.0.0.1:${port}/json/version`).then((response) => response.json()).catch(() => null) as Promise<{ webSocketDebuggerUrl?: string } | null>;
  let version = await probe();
  if (!version) {
    const args = [`--remote-debugging-port=${port}`, `--user-data-dir=/tmp/sitecraft-workspace-${process.pid}`, "--headless=new", "--no-first-run", "--disable-gpu", "about:blank"];
    if (process.getuid?.() === 0) args.unshift("--no-sandbox");
    spawn(chromeBinary(), args, { stdio: "ignore", detached: true }).unref();
    for (let attempt = 0; attempt < 60 && !version; attempt += 1) {
      await sleep(250);
      version = await probe();
    }
  }
  if (!version?.webSocketDebuggerUrl) throw new Error("Chrome DevTools endpoint unavailable");
  const browser = new Cdp(version.webSocketDebuggerUrl);
  await browser.connect();
  return browser;
}

export type WorkspacePage = { sessionId: string; targetId: string };

export async function openWorkspace(browser: Cdp, options: {
  siteId: string;
  width: number;
  theme: "dark" | "light";
  conversationId?: string;
  accent?: string;
  reducedMotion?: boolean;
  height?: number;
}): Promise<WorkspacePage> {
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
  const ready = await waitFor(browser, sessionId, `(() => { const shell = document.querySelector('.builder-shell'); return Boolean(shell && shell.className.includes('workspace-theme-${options.theme}') && getComputedStyle(shell).display === 'grid' && document.querySelector('[data-testid=open-source-template-frame]')); })()`, 20000);
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
export async function failChatRequests(browser: Cdp, sessionId: string) {
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
    browser.send("Fetch.fulfillRequest", {
      requestId: params.requestId,
      responseCode: 503,
      responseHeaders: [{ name: "Content-Type", value: "application/json" }],
      body: Buffer.from(JSON.stringify(body)).toString("base64"),
    }, sessionId).catch(() => {});
  };
  browser.on("Fetch.requestPaused", handler);
  await browser.send("Fetch.enable", { patterns: [{ urlPattern: "*/api/sites/*/chat", requestStage: "Request" }] }, sessionId);
  return async () => {
    await browser.send("Fetch.disable", {}, sessionId);
    browser.listeners.set("Fetch.requestPaused", (browser.listeners.get("Fetch.requestPaused") ?? []).filter((item) => item !== handler));
    return intercepted;
  };
}

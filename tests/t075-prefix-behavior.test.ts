import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";
import { assertWorkspaceServer, base } from "./helpers/workspace-browser.ts";

const CHROME_PATH = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class Cdp {
  private id = 1;
  private pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();
  private ws: WebSocket;
  constructor(url: string) { this.ws = new WebSocket(url); }
  async connect() {
    await new Promise<void>((resolve, reject) => {
      this.ws.addEventListener("open", () => resolve(), { once: true });
      this.ws.addEventListener("error", () => reject(new Error("CDP connection failed")), { once: true });
    });
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as { id?: number; result?: unknown; error?: unknown };
      if (!message.id) return;
      const waiter = this.pending.get(message.id);
      if (!waiter) return;
      this.pending.delete(message.id);
      if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
      else waiter.resolve(message.result);
    });
  }
  send(method: string, params: Record<string, unknown> = {}, sessionId?: string) {
    const id = this.id++;
    this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    return new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`${method} timed out`)); }, 30000);
      this.pending.set(id, { resolve: (value) => { clearTimeout(timer); resolve(value); }, reject: (error) => { clearTimeout(timer); reject(error); } });
    });
  }
  async evaluate(expression: string, sessionId: string) {
    const result = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Runtime.evaluate failed");
    return result.result?.value;
  }
  close() { this.ws.close(); }
}

async function waitFor(cdp: Cdp, expression: string, sessionId: string, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await cdp.evaluate(expression, sessionId).catch(() => false)) return;
    await sleep(250);
  }
  throw new Error(`timeout waiting for ${expression}`);
}

test("undo message does not add an applied prefix to the action summary", async () => {
  await assertWorkspaceServer();
  const created = await fetch(`${base}/api/sites`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "T-075 behavior fixture", templateId: "screwfast", locales: ["zh", "en"] }),
  }).then((response) => response.json() as Promise<{ id: string }>);
  const draft = await fetch(`${base}/api/sites/${created.id}/draft`).then((response) => response.json() as Promise<{ draft: { revision: number } }>);
  const saved = await fetch(`${base}/api/sites/${created.id}/draft`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      baseRevision: draft.draft.revision,
      operations: [{ op: "set_text", target: "hero.title", locale: "zh", value: "T-075 首屏" }],
      summary: "写入首屏标题",
      source: "manual",
    }),
  });
  assert.equal(saved.status, 200, await saved.text());

  const port = 9900 + (process.pid % 100);
  const profile = `/tmp/sitecraft-t075-behavior-${process.pid}`;
  const chrome = spawn(CHROME_PATH, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--headless=new", "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore", detached: true });
  let version: { webSocketDebuggerUrl?: string } | null = null;
  for (let i = 0; i < 80 && !version; i += 1) { await sleep(250); version = await fetch(`http://127.0.0.1:${port}/json/version`).then((response) => response.json()).catch(() => null); }
  if (!version?.webSocketDebuggerUrl) throw new Error("Chrome DevTools endpoint unavailable");
  const cdp = new Cdp(version.webSocketDebuggerUrl);
  await cdp.connect();
  const { targetId } = await cdp.send("Target.createTarget", { url: `${base}/workspace?site=${created.id}` });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  await cdp.send("Page.enable", {}, sessionId);
  await cdp.send("Runtime.enable", {}, sessionId);
  try {
    await waitFor(cdp, `Boolean(document.querySelector('[data-testid="workspace-draft-revision"]'))`, sessionId);
    await waitFor(cdp, `Boolean(document.querySelector('button[aria-label="撤销"]') && !document.querySelector('button[aria-label="撤销"]').disabled)`, sessionId);
    await cdp.evaluate(`document.querySelector('button[aria-label="撤销"]')?.click()`, sessionId);
    await waitFor(cdp, `document.querySelector('.chat-messages')?.innerText.includes('已撤销：首屏标题')`, sessionId);
    const text = await cdp.evaluate(`document.querySelector('.chat-messages')?.innerText || ''`, sessionId) as string;
    const evidence = { undoSummary: text.match(/(?:已应用：)?已撤销：首屏标题/g) ?? [], duplicated: text.includes("已应用：已撤销：首屏标题") };
    console.log(JSON.stringify(evidence));
    assert.doesNotMatch(text, /已应用：已撤销：首屏标题/);
  } finally {
    await cdp.send("Target.closeTarget", { targetId }).catch(() => {});
    cdp.close();
    chrome.kill();
  }
});

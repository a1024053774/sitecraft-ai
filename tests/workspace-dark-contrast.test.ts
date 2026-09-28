import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import test from "node:test";

const scan = readFileSync(new URL("../artifacts/kiro-browse/contrast-all.js", import.meta.url), "utf8");
const base = process.env.SITECRAFT_BASE || "http://127.0.0.1:3034";
const port = 9365 + (process.pid % 200);
const out = new URL("../artifacts/t043/", import.meta.url);

type ContrastScan = { lowCount: number; low: string[]; checked: number };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class Cdp {
  url: string;
  id = 1;
  pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  ws!: WebSocket;

  constructor(url: string) { this.url = url; }

  async connect() {
    this.ws = new WebSocket(this.url);
    await new Promise<void>((resolve, reject) => {
      this.ws.addEventListener("open", () => resolve(), { once: true });
      this.ws.addEventListener("error", () => reject(new Error("Chrome socket failed")), { once: true });
    });
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as { id?: number; error?: unknown; result?: unknown };
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

  async eval(expression: string, sessionId: string) {
    const result = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId) as { exceptionDetails?: { text?: string }; result?: { value?: unknown } };
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "evaluate failed");
    return result.result?.value;
  }
}

test("workspace text nodes stay at or above 4.5:1 in dark and light, at 1440 and 375", async () => {
  let version = await fetch(`http://127.0.0.1:${port}/json/version`).then((response) => response.json()).catch(() => null) as { webSocketDebuggerUrl?: string } | null;
  if (!version) {
    spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [`--remote-debugging-port=${port}`, `--user-data-dir=/tmp/sitecraft-contrast-${process.pid}`, "--headless=new", "--no-first-run", "--disable-gpu", "about:blank"], { stdio: "ignore", detached: true }).unref();
    for (let attempt = 0; attempt < 40 && !version; attempt += 1) {
      await sleep(250);
      version = await fetch(`http://127.0.0.1:${port}/json/version`).then((response) => response.json()).catch(() => null);
    }
  }
  assert.ok(version?.webSocketDebuggerUrl, "Chrome is required to scan workspace text contrast");
  const browser = new Cdp(version.webSocketDebuggerUrl);
  await browser.connect();
  mkdirSync(out, { recursive: true });
  const report: unknown[] = [];
  try {
    for (const theme of ["dark", "light"]) {
      for (const width of [1440, 375]) {
        const created = await browser.send("Target.createTarget", { url: "about:blank" }) as { targetId: string };
        const attached = await browser.send("Target.attachToTarget", { targetId: created.targetId, flatten: true }) as { sessionId: string };
        const sessionId = attached.sessionId;
        await browser.send("Page.enable", {}, sessionId);
        await browser.send("Runtime.enable", {}, sessionId);
        await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 1200, deviceScaleFactor: 1, mobile: width < 800 }, sessionId);
        await browser.send("Page.addScriptToEvaluateOnNewDocument", { source: `localStorage.setItem("sitecraft-workspace-theme", ${JSON.stringify(theme)});` }, sessionId);
        await browser.send("Page.navigate", { url: `${base}/workspace?site=overlay-p3i-thick-20260925` }, sessionId);
        const views = width < 800 ? ["chat", "preview"] : ["workspace"];
        for (const view of views) {
          if (view === "preview") {
            for (let attempt = 0; attempt < 20 && !await browser.eval(`document.querySelector(".builder-mobile-tabs button") ? true : null`, sessionId); attempt += 1) await sleep(300);
            await browser.eval(`document.querySelectorAll(".builder-mobile-tabs button")[1]?.click()`, sessionId);
            await sleep(500);
          }
          let measured: ContrastScan | null = null;
          for (let attempt = 0; attempt < 24; attempt += 1) {
            await sleep(400);
            measured = await browser.eval("(() => { const shell = document.querySelector('.builder-shell'); if (!shell || !shell.className.includes('workspace-theme-" + theme + "')) return null; const needsMarker = " + (view === "workspace" || view === "preview" ? "true" : "false") + "; if (needsMarker && !document.querySelector('[data-testid=preview-change-markers]')) return null; if (!document.querySelector('.message-bubble') && !document.querySelector('.project-name')) return null; return " + scan + "; })()", sessionId) as ContrastScan | null;
            if (measured) break;
          }
          if (!measured) throw new Error(`${theme} ${width} ${view} did not render`);
          assert.equal(measured.lowCount, 0, `${theme} ${width} ${view}: ${(measured.low || []).join("; ")}`);
          const shot = await browser.send("Page.captureScreenshot", { format: "png" }, sessionId) as { data: string };
          writeFileSync(new URL(`workspace-${theme}-${width}-${view}.png`, out), Buffer.from(shot.data, "base64"));
          report.push({ theme, width, view, checked: measured.checked, lowCount: measured.lowCount });
        }
        await browser.send("Target.closeTarget", { targetId: created.targetId }).catch(() => {});
      }
    }
  } finally {
    browser.ws.close();
    writeFileSync(new URL("report.json", out), JSON.stringify(report, null, 2));
  }
});

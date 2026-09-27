#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const base = process.env.SITECRAFT_BASE || "http://127.0.0.1:3034";
const out = process.argv[2] || `artifacts/workspace-t023-${Date.now()}`;
await mkdir(out, { recursive: true });
const report = { ticket: "T-023", base, widths: [], steps: [] };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(step, url, body) {
  const response = await fetch(base + url, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
  const text = await response.text();
  const events = text.startsWith("data:") ? text.split("\n\n").filter((item) => item.startsWith("data:")).map((item) => JSON.parse(item.slice(5))) : [];
  const result = events.length ? events.findLast((item) => item.type === "done") : JSON.parse(text);
  report.steps.push({ step, url, input: body ?? null, status: response.status, result });
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
  assert.ok(response.ok, `${step}: HTTP ${response.status}`);
  return result;
}

class Cdp {
  constructor(url) { this.url = url; this.id = 1; this.pending = new Map(); }
  async connect() {
    this.ws = new WebSocket(this.url);
    await new Promise((resolve, reject) => { this.ws.addEventListener("open", resolve, { once: true }); this.ws.addEventListener("error", reject, { once: true }); });
    this.ws.addEventListener("message", (event) => { const message = JSON.parse(event.data); const pending = this.pending.get(message.id); if (!pending) return; this.pending.delete(message.id); message.error ? pending.reject(new Error(JSON.stringify(message.error))) : pending.resolve(message.result); });
  }
  send(method, params = {}, sessionId) {
    const id = this.id++;
    this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    return new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error(`${method} timeout`)), 30000); this.pending.set(id, { resolve: (value) => { clearTimeout(timer); resolve(value); }, reject: (error) => { clearTimeout(timer); reject(error); } }); });
  }
  async eval(expression, sessionId) {
    const result = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId);
    if (result.exceptionDetails) throw new Error(`${result.exceptionDetails.text}: ${expression.slice(0, 120)}`);
    return result.result.value;
  }
}

const debugPort = 9352;
const chromeDataDir = `/tmp/sitecraft-t023-${Date.now()}`;
let version = await fetch(`http://127.0.0.1:${debugPort}/json/version`).then((response) => response.json()).catch(() => null);
if (!version) {
  spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [`--remote-debugging-port=${debugPort}`, `--user-data-dir=${chromeDataDir}`, "--headless=new", "--no-first-run", "--disable-gpu", "about:blank"], { stdio: "ignore", detached: true }).unref();
  for (let attempt = 0; attempt < 40 && !version; attempt += 1) { await sleep(250); version = await fetch(`http://127.0.0.1:${debugPort}/json/version`).then((response) => response.json()).catch(() => null); }
}
if (!version) throw new Error("Chrome unavailable");

try {
  const site = await request("create", "/api/sites", { name: "T023 移动抽屉验收", templateId: "screwfast", locales: ["zh", "en"] });
  const draft = await fetch(`${base}/api/sites/${site.id}/draft`).then((response) => response.json());
  const message = "【公司资料】公司名：临港流体接头。产品：不锈钢卡套接头，按图加工。目标：OEM采购提交批量规格询盘。联系方式和认证未提供。先做无图版，不编造事实。请先在同一张需求卡让我选择页面范围和色彩集，色彩集在石墨工坊与工程暖橙中选。";
  const started = await request("start-alignment", `/api/sites/${site.id}/chat`, { action: "start", baseRevision: draft.draft.revision, message });
  assert.ok(started.conversationId && started.alignment?.questions?.length >= 1, "planner must return a question card");
  report.steps.push({ step: "planner-card", conversationId: started.conversationId, questions: started.alignment.questions.map((question) => ({ questionId: question.questionId, optionCount: question.options.length })) });

  const browser = new Cdp(version.webSocketDebuggerUrl);
  await browser.connect();
  for (const width of [375, 768]) {
    const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true });
    await browser.send("Page.enable", {}, sessionId);
    await browser.send("Runtime.enable", {}, sessionId);
    await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 800 }, sessionId);
    await browser.send("Page.addScriptToEvaluateOnNewDocument", { source: `localStorage.setItem("sitecraft-conversation:${site.id}", ${JSON.stringify(started.conversationId)});` }, sessionId);
    await browser.send("Page.navigate", { url: `${base}/workspace?site=${site.id}` }, sessionId);
    await sleep(6000);
    if (width === 375) {
      const initial = await browser.eval(`(()=>{const panel=document.querySelector(".alignment-panel");return {drawer:panel?.dataset.mobileDrawer === "true",step:document.querySelector("[data-testid=alignment-step]")?.textContent||"",questionCount:document.querySelectorAll("[data-testid=alignment-card-question]").length}})()`, sessionId);
      report.widths.push({ width, initial });
      assert.equal(initial.drawer, true, "375 alignment must use the bottom drawer");
      assert.match(initial.step, /1\s*\/\s*\d+/, "375 must expose one-question step progress");
      assert.equal(initial.questionCount, 1, "375 must show one question at a time");
      const total = await browser.eval(`document.querySelectorAll("[data-testid=alignment-step-total]").length ? Number(document.querySelector("[data-testid=alignment-step-total]").textContent) : 0`, sessionId);
      for (let index = 0; index < total; index += 1) {
        await browser.eval(`document.querySelector("[data-testid=alignment-card-question] .alignment-card")?.click()`, sessionId);
        await sleep(200);
        if (index < total - 1) await browser.eval(`document.querySelector("[data-testid=alignment-next]")?.click()`, sessionId);
        await sleep(200);
        report.widths.at(-1)[`step${index + 1}`] = await browser.eval(`({step:document.querySelector("[data-testid=alignment-step]")?.textContent,selected:[...document.querySelectorAll(".alignment-card.selected")].map(x=>x.textContent)})`, sessionId);
      }
      const beforeSubmit = await browser.eval(`(()=>{const button=document.querySelector("[data-testid=alignment-submit]");return {total:${total},disabled:button?.disabled,text:button?.textContent,selected:[...document.querySelectorAll(".alignment-card.selected")].map(x=>x.textContent),step:document.querySelector("[data-testid=alignment-step]")?.textContent}})()`, sessionId);
      report.widths.at(-1).beforeSubmit = beforeSubmit;
      await browser.eval(`document.querySelector("[data-testid=alignment-submit]")?.click()`, sessionId);
      await sleep(1500);
      const afterSubmitState = await request("read-after-submit", `/api/sites/${site.id}/chat`, { action: "state", conversationId: started.conversationId });
      const submitted = afterSubmitState.alignment?.answers?.length >= total ? "已保存全部答案" : "";
      assert.ok(submitted || total === 1, "375 submit must leave a readable saved state");
      await browser.send("Page.navigate", { url: `${base}/workspace?site=${site.id}` }, sessionId);
      await sleep(5000);
      const restored = await browser.eval(`(()=>({answers:document.querySelector(".alignment-summary")?.textContent||"",drawer:document.querySelector(".alignment-panel")?.dataset.mobileDrawer === "true"}))()`, sessionId);
      report.widths.at(-1).afterSubmit = { submitted, restored };
      assert.equal(restored.drawer, true, "375 drawer must survive refresh");
      assert.ok(restored.answers, "375 refresh must retain submitted answers");
      await browser.eval(`document.querySelector('.builder-mobile-tabs button:nth-child(2)')?.click()`, sessionId);
      await sleep(400);
      const overflow = await browser.eval(`(()=>{const toolbar=document.querySelector(".preview-toolbar"),buttons=[...document.querySelectorAll(".preview-toolbar button")].map(button=>{const rect=button.getBoundingClientRect();return {label:button.textContent?.trim()||"",left:rect.left,right:rect.right,visible:rect.width>0&&rect.height>0}});return {documentWidth:document.documentElement.scrollWidth,viewport:innerWidth,previewVisible:!document.querySelector(".preview-shell")?.classList.contains("mobile-hidden"),toolbarVisible:Boolean(toolbar&&toolbar.getBoundingClientRect().height),toolbarRight:toolbar?.getBoundingClientRect().right||0,toolbarOverflow:toolbar ? toolbar.scrollWidth > toolbar.clientWidth : true,buttons}})()`, sessionId);
      report.widths.at(-1).overflow = overflow;
      assert.equal(overflow.previewVisible, true, "375 preview tab must show the preview");
      assert.ok(overflow.documentWidth <= overflow.viewport, "375 document must not overflow horizontally");
      assert.equal(overflow.toolbarOverflow, false, "375 preview toolbar must fit");
      assert.ok(overflow.buttons.length > 0 && overflow.buttons.every((button) => button.visible && button.left >= 0 && button.right <= overflow.viewport), "375 preview toolbar buttons must be reachable");
    } else {
      const open = await browser.eval(`(()=>({chat:!document.querySelector(".builder-chat")?.classList.contains("mobile-hidden"),preview:!document.querySelector(".preview-shell")?.classList.contains("mobile-hidden"),tabs:[...document.querySelectorAll(".builder-mobile-tabs button")].map(x=>x.textContent)}))()`, sessionId);
      await browser.eval(`document.querySelector('.builder-mobile-tabs button:nth-child(2)')?.click()`, sessionId);
      await sleep(300);
      const preview = await browser.eval(`(()=>({chatHidden:document.querySelector(".builder-chat")?.classList.contains("mobile-hidden"),previewVisible:!document.querySelector(".preview-shell")?.classList.contains("mobile-hidden")}))()`, sessionId);
      await browser.eval(`document.querySelector('.builder-mobile-tabs button:nth-child(1)')?.click()`, sessionId);
      await sleep(300);
      const chat = await browser.eval(`!document.querySelector(".builder-chat")?.classList.contains("mobile-hidden")`, sessionId);
      report.widths.push({ width, open, preview, chat });
      assert.equal(preview.chatHidden, true, "768 preview tab must hide the chat drawer");
      assert.equal(preview.previewVisible, true, "768 preview tab must show preview");
      assert.equal(chat, true, "768 chat tab must reopen the chat drawer");
    }
    const screenshot = await browser.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }, sessionId);
    const screenshotPath = `${out}/workspace-${width}.png`;
    fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, "base64"));
    report.widths.at(-1).screenshot = screenshotPath;
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
  }
  report.result = "PASS";
  report.siteId = site.id;
  browser.ws.close();
} catch (error) {
  report.result = "FAIL";
  report.error = String(error);
  process.exitCode = 1;
}
await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ result: report.result, error: report.error, artifact: `${out}/report.json` }));

/**
 *
 * 一次性诊断工具 · 非门禁 · 无验收引用
 * 锁 A **第四轮**：抓桥 observer 回调里的异常。
 *
 * 前三轮都只读状态，没看**错误通道**。观察者回调抛错不会显示为
 * `page.evaluate` 失败，而是变成 window 的 error 事件 —— 必须单独监听。
 *
 * 用法：node e2e/scripts/diag-lockA-error.mjs
 */
import { chromium } from "playwright";

const URL = "http://127.0.0.1:3210/api/templates/shadcn-landing2/preview?__sitecraftSnapshotProbe=1";
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

page.on("pageerror", (e) => console.log(`★ PAGEERROR: ${e.message.split("\n")[0]}`));
page.on("console", (m) => {
  if (m.type() === "error") console.log(`★ CONSOLE.ERROR: ${m.text().slice(0, 160)}`);
});

await page.goto(URL, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);
console.log("初始:", JSON.stringify(await page.evaluate(() => ({
  len: window.__sitecraftSnapshotState.snapshotLen(),
  content: window.__sitecraftSnapshotState.snapshotContent(),
  last: window.__sitecraftSnapshotState.lastContent(),
}))));

console.log("--- 注入坏样本（触发 observer） ---");
const mid = await page.evaluate(() => {
  const main = document.querySelector("main") ?? document.body;
  const need = window.__sitecraftSnapshotState.snapshotContent() + 5;
  main.replaceChildren(document.createElement("script"), document.createElement("style"));
  for (let i = 0; i < need; i += 1) {
    const d = document.createElement("div");
    d.setAttribute("data-empty-shell", String(i));
    main.appendChild(d);
  }
  return need;
});
console.log(`构造 need=${mid}`);

await page.waitForTimeout(1200);
console.log("之后:", JSON.stringify(await page.evaluate(() => ({
  len: window.__sitecraftSnapshotState.snapshotLen(),
  content: window.__sitecraftSnapshotState.snapshotContent(),
  last: window.__sitecraftSnapshotState.lastContent(),
  divs: document.querySelectorAll("div").length,
}))));

await ctx.close();
await browser.close();

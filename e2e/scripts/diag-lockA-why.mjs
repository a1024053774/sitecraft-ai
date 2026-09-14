/**
 *
 * 一次性诊断工具 · 非门禁 · 无验收引用
 * 锁 A 场景**第三轮**取证：为什么"残页元素数 ≥ 快照"仍不覆盖？
 *
 * 读钩子内部状态，逐步观察 capture 是否真的会跑。
 *
 * 用法：node e2e/scripts/diag-lockA-why.mjs
 */
import { chromium } from "playwright";

const URL = "http://127.0.0.1:3210/api/templates/shadcn-landing2/preview?__sitecraftSnapshotProbe=1";
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

const state = () =>
  page.evaluate(() => ({
    len: window.__sitecraftSnapshotState.snapshotLen(),
    content: window.__sitecraftSnapshotState.snapshotContent(),
    last: window.__sitecraftSnapshotState.lastContent(),
    rewrites: window.__sitecraftSnapshotState.rewrites(),
    stableFor: Math.round(window.__sitecraftSnapshotState.isStable()),
    bodyText: document.body.innerText.trim().length,
    divs: document.querySelectorAll("div").length,
  }));

await page.goto(URL, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);
console.log("初始      ", JSON.stringify(await state()));

// 复刻锁 A 的坏样本
const mid = await page.evaluate(() => {
  const main = document.querySelector("main") ?? document.body;
  const need = window.__sitecraftSnapshotState.snapshotContent() + 5;
  main.replaceChildren(document.createElement("script"), document.createElement("style"));
  for (let i = 0; i < need; i += 1) {
    const d = document.createElement("div");
    d.setAttribute("data-empty-shell", String(i));
    main.appendChild(d);
  }
  return {
    contentEls: [...main.querySelectorAll("*")].filter(
      (el) => !["SCRIPT", "STYLE", "LINK", "META", "TEMPLATE"].includes(el.tagName),
    ).length,
    bodyText: document.body.innerText.trim().length,
    need,
  };
});
console.log("坏样本构造", JSON.stringify(mid));

// 每 200ms 采一次，看 capture 有没有跑
for (let i = 1; i <= 8; i += 1) {
  await page.waitForTimeout(200);
  console.log(`+${String(i * 200).padStart(4)}ms `, JSON.stringify(await state()));
}

await ctx.close();
await browser.close();

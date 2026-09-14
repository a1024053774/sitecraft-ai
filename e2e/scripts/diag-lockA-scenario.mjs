/**
 *
 * 一次性诊断工具 · 非门禁 · 无验收引用
 * 锁 A 场景设计取证（2026-09-14）。
 *
 * 锁 A 的坏样本（删掉 capture 守卫）下**仍绿**——说明场景没测到机制。
 * 本脚本直接看钩子读数，找出「什么时候快照真的会被残页覆盖」。
 *
 * 用法：node e2e/scripts/diag-lockA-scenario.mjs
 */
import { chromium } from "playwright";

const URL = "http://127.0.0.1:3210/api/templates/shadcn-landing2/preview?__sitecraftSnapshotProbe=1";
const browser = await chromium.launch();

async function scenario(name, steps) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await page.goto(URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const before = await page.evaluate(() => ({
      len: window.__sitecraftSnapshotState.snapshotLen(),
      content: window.__sitecraftSnapshotState.snapshotContent(),
      last: window.__sitecraftSnapshotState.lastContent(),
    }));
    await steps(page);
    const after = await page.evaluate(() => ({
      len: window.__sitecraftSnapshotState.snapshotLen(),
      content: window.__sitecraftSnapshotState.snapshotContent(),
      last: window.__sitecraftSnapshotState.lastContent(),
      rewrites: window.__sitecraftSnapshotState.rewrites(),
      bodyText: document.body.innerText.trim().length,
    }));
    const overwritten = after.content < before.content;
    console.log(
      `\n[${name}] ${overwritten ? "★ 快照被覆盖（残页）" : "快照未被覆盖"}\n` +
        `   before: len=${before.len} content=${before.content} last=${before.last}\n` +
        `   after : len=${after.len} content=${after.content} last=${after.last} rewrites=${after.rewrites} bodyText=${after.bodyText}`,
    );
  } catch (error) {
    console.log(`[${name}] ERROR ${error.message}`);
  } finally {
    await ctx.close();
  }
}

// 场景 1：当前锁 A 的做法（只留一个元素）
await scenario("1 只留 1 个元素", async (page) => {
  await page.evaluate(() => {
    const main = document.querySelector("main") ?? document.body;
    const keep = main.firstElementChild;
    main.replaceChildren(document.createElement("script"), document.createElement("style"));
    if (keep) main.appendChild(keep);
  });
  await page.waitForTimeout(800);
});

// 场景 2：清空到 0 → 等 restore → 再注入"残页"（模拟水合第二波）
await scenario("2 清空→等→再残页", async (page) => {
  await page.evaluate(() => {
    const main = document.querySelector("main") ?? document.body;
    main.replaceChildren(document.createElement("script"), document.createElement("style"));
  });
  await page.waitForTimeout(1500); // 让 restore 跑完
  await page.evaluate(() => {
    const main = document.querySelector("main") ?? document.body;
    // 再制造一个"水合中间态"：少量内容元素
    for (let i = 0; i < 5; i += 1) {
      const d = document.createElement("div");
      d.textContent = "residual";
      main.appendChild(d);
    }
  });
  await page.waitForTimeout(800);
});

// 场景 3：直接构造"内容元素很少但非 0"的态（不经过清空）
await scenario("3 直接残页（不先清空）", async (page) => {
  await page.evaluate(() => {
    const main = document.querySelector("main") ?? document.body;
    main.replaceChildren(document.createElement("script"), document.createElement("style"));
    for (let i = 0; i < 3; i += 1) {
      const d = document.createElement("div");
      d.textContent = "x";
      main.appendChild(d);
    }
  });
  await page.waitForTimeout(1200);
});

await browser.close();

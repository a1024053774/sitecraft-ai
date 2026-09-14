/**
 *
 * 一次性诊断工具 · 非门禁 · 无验收引用
 * T-14 门禁第 2 例**根因定位**（2026-09-14）。
 *
 * 上游 `diag-snapshot-spec2.mjs` 已证：起步有内容（5465 字符 / 13 sections /
 * 834 内容元素），清空后 **9/20 没还原** —— **不是时序假象，是真缺陷**。
 *
 * 本脚本回答下一个问题：断在**捕获**还是断在**还原**。
 *
 * 做法：把桥脚本内部的 capture/restore 判据**逐字复刻**到页面里，
 * 用**同一个 MutationObserver 机制**自己跑一遍，并打印每一步的读数。
 * 这不是"模拟"——它用的是与桥脚本相同的 DOM 事实，只是把中间量打出来。
 *
 * 用法：node e2e/scripts/diag-snapshot-probe.mjs 8
 */
import { chromium } from "playwright";

const N = Number(process.argv[2] ?? 8);
const URL = process.env.SITECRAFT_BASE_URL
  ? `${process.env.SITECRAFT_BASE_URL}/api/templates/shadcn-landing2/preview`
  : "http://127.0.0.1:3210/api/templates/shadcn-landing2/preview";

const browser = await chromium.launch();

for (let i = 1; i <= N; i += 1) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const logs = [];
  page.on("console", (m) => logs.push(m.text()));
  page.on("pageerror", (e) => logs.push(`PAGEERROR ${e.message}`));

  try {
    await page.goto(URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    // ── 复刻桥脚本的判据，并把中间量打出来 ──
    const trace = await page.evaluate(async () => {
      const NON_CONTENT = ["SCRIPT", "STYLE", "LINK", "META", "TEMPLATE"];
      const contentEls = (node) =>
        !node
          ? 0
          : Array.prototype.filter.call(node.querySelectorAll("*"), (el) => NON_CONTENT.indexOf(el.tagName) === -1)
              .length;
      const root = () => document.querySelector("main") || document.body;

      const out = {
        hasMain: !!document.querySelector("main"),
        rootIsBody: root() === document.body,
        contentElsNow: contentEls(root()),
        snapshotLen: 0,
        captureSkipped: null,
        observerFired: 0,
      };

      // 现在这一刻能不能采到？
      const main = root();
      const els = contentEls(main);
      out.captureSkipped = els === 0 ? "contentEls===0" : "可以采(capture 会成功)";
      if (els > 0) out.snapshotLen = main.innerHTML.length;

      // 装一个与桥脚本同形的 observer，看它在"清空"时会不会触发
      let fired = 0;
      const obs = new MutationObserver(() => {
        fired += 1;
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });

      // 模拟用例的清空
      main.replaceChildren(
        document.createElement("script"),
        document.createElement("script"),
        document.createElement("style"),
      );
      await new Promise((r) => setTimeout(r, 300));
      obs.disconnect();

      out.observerFired = fired;
      out.contentElsAfterClear = contentEls(root());
      return out;
    });

    console.log(
      `#${String(i).padStart(2)} main=${trace.hasMain} rootIsBody=${trace.rootIsBody} ` +
        `contentEls=${trace.contentElsNow} snapshotLen=${trace.snapshotLen} ` +
        `捕获判据=${trace.captureSkipped} observer触发=${trace.observerFired} 清空后contentEls=${trace.contentElsAfterClear}`,
    );
    if (logs.length) console.log(`     console: ${logs.slice(0, 3).join(" | ").slice(0, 200)}`);
  } catch (error) {
    console.log(`#${String(i).padStart(2)} ERROR ${error.message}`);
  } finally {
    await ctx.close();
  }
}

await browser.close();

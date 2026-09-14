/**
 *
 * 一次性诊断工具 · 非门禁 · 无验收引用
 * T-14 门禁第 2 例失败诊断（2026-09-14）。
 *
 * 复现 `hydration-snapshot.spec.ts:100` 的流程，逐次打印每步读数，
 * 用以回答一个**必须用取证回答的问题**：
 *
 *   它是 T-14 间歇白屏（页面自己没内容）导致的**用例缺陷**，
 *   还是快照在某个路径上**真的没兜住**（功能缺陷）？
 *
 * 判据：
 * - 若 `beforeText === 0` 的那些次占了失败：**用例缺前置守卫**，
 *   与第 1 例同样加 `beforeText > 0` 前置即可（快照没问题）。
 * - 若 `beforeText > 0` 却还原失败：**快照真缺陷**，转修实现。
 *
 * 用法：node e2e/scripts/diag-snapshot-spec2.mjs 20
 */
import { chromium } from "playwright";

const N = Number(process.argv[2] ?? 20);
const URL = process.env.SITECRAFT_BASE_URL
  ? `${process.env.SITECRAFT_BASE_URL}/api/templates/shadcn-landing2/preview`
  : "http://127.0.0.1:3210/api/templates/shadcn-landing2/preview";

const browser = await chromium.launch();
let beforeEmpty = 0;
let restoreFailed = 0;
let ok = 0;
const rows = [];

for (let i = 1; i <= N; i += 1) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  let verdict;
  try {
    await page.goto(URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    // 与门禁第 2 例逐字一致的步骤
    const beforeText = await page.evaluate(() => document.body.innerText.trim());
    const hadSnapshot = await page.evaluate(() => {
      // 桥脚本把快照存在闭包里，外部看不见——用"清空后能否还原"反推。
      // 这里只记录清空前的形态，供归因用。
      const main = document.querySelector("main") ?? document.body;
      return {
        mainFound: !!document.querySelector("main"),
        contentEls: [...main.querySelectorAll("*")].filter(
          (el) => !["SCRIPT", "STYLE", "LINK", "META", "TEMPLATE"].includes(el.tagName),
        ).length,
        sections: document.querySelectorAll("section").length,
      };
    });

    await page.evaluate(() => {
      const main = document.querySelector("main") ?? document.body;
      main.replaceChildren(
        document.createElement("script"),
        document.createElement("script"),
        document.createElement("style"),
      );
    });

    let afterText = "";
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      afterText = await page.evaluate(() => document.body.innerText.trim());
      if (afterText.length > 0) break;
      await page.waitForTimeout(250);
    }

    if (beforeText.length === 0) {
      beforeEmpty += 1;
      verdict = "BEFORE_EMPTY";        // 起步就是白屏 → 用例缺陷（缺前置守卫）
    } else if (afterText.length === 0) {
      restoreFailed += 1;
      verdict = "RESTORE_FAILED";      // 起步有内容、清空后没回来 → 真缺陷
    } else {
      ok += 1;
      verdict = "OK";
    }
    rows.push(
      `  #${String(i).padStart(2)} ${verdict.padEnd(15)} before=${String(beforeText.length).padStart(5)} after=${String(afterText.length).padStart(5)} sec=${hadSnapshot.sections} contentEls=${hadSnapshot.contentEls} main=${hadSnapshot.mainFound}`,
    );
  } catch (error) {
    verdict = "ERROR";
    rows.push(`  #${String(i).padStart(2)} ERROR           ${error.message}`);
  } finally {
    await ctx.close();
  }
}

await browser.close();

console.log(rows.join("\n"));
console.log(`\n[diag] N=${N}  OK=${ok}  BEFORE_EMPTY=${beforeEmpty}  RESTORE_FAILED=${restoreFailed}`);
if (beforeEmpty > 0 && restoreFailed === 0) {
  console.log("[diag] → 结论：失败全部来自「起步即白屏」（T-14 间歇态），快照本身没漏。");
  console.log("[diag]   修法=给第 2 例加与第 1 例同样的前置守卫（before > 0），无功能缺陷。");
} else if (restoreFailed > 0) {
  console.log("[diag] → 结论：起步有内容却还原失败 = **快照真缺陷**，需改实现。");
} else {
  console.log("[diag] → 本轮未复现失败（FAIL 是间歇的）。");
}

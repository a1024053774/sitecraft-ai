/**
 * T-14 水合快照**负向验证门禁**（2026-09-14）。
 *
 * ## 它守的是什么
 *
 * `shadcn-landing2` 这类 Next.js 导出站的白屏机制（**已实测查清**）：
 *
 * 1. 服务器发出含内容的 HTML（273KB）→ **内容进了 DOM**；
 * 2. 内联 flight payload 脚本**被 CSP 拦**（实测 7 条违规）→ React 拿不到数据；
 * 3. React 水合后**清空容器、渲染成空** → body 里只剩 8 个 `<script>` + 1 个 `<style>`。
 *
 * 修法是**水合快照**：桥接脚本在模板脚本跑完后把 DOM 序列化下来，
 * 之后若被清空，**原样还原**。**内容就不会消失。**
 *
 * ## 为什么必须有这条门禁
 *
 * 那个白屏是**间歇的**（实测 3/50 ≈ 6%）。删掉快照代码**大概率不会**让
 * 任何一次 e2e 跑红——**静默回归**。所以这里用 DOM 手术**确定性地**
 * 制造出"容器被清空"的状态，看快照能否救回来。
 *
 * ⚠️ **这是"删子树"型坏样本**（附则 A4）：只断言容器存在不算数，
 * 必须真的把内容清掉、断言内容能回来。
 *
 * ## 判据
 *
 * - **有快照**：人为清空 `<main>`（`MutationObserver` 会立刻回填）→ 内容回来 → 绿；
 * - **无快照**（把快照代码删掉）：清空后无人回填 → 内容仍在空状态 → **红**。
 *
 * 第二句就是这个文件存在的理由——**先证明它会红**。
 */
import { test, expect, chromium } from "@playwright/test";

/** 生产口径预览页（T-14 白屏就是在这个 URL 上实测到的）。 */
const PREVIEW_PATH = "/api/templates/shadcn-landing2/preview";

test.describe("T-14 · 水合快照", () => {
  test("容器被清空后快照能把内容还原（删子树坏样本）", async ({ baseURL }) => {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await page.goto(`${baseURL}${PREVIEW_PATH}`, { waitUntil: "domcontentloaded" });
      // 给模板脚本与快照足够的时间落定
      await page.waitForTimeout(3000);

      // 前置：正常态必须有内容（否则下面的"还原"没有意义）
      const before = await page.evaluate(() => ({
        text: document.body.innerText.trim().length,
        sections: document.querySelectorAll("section").length,
      }));
      expect(before.text, "前置：正常态必须有内容").toBeGreaterThan(0);
      expect(before.sections, "前置：正常态必须有 section").toBeGreaterThan(0);

      // ── 坏样本：**忠实复现真实白屏态**（白屏机制的第 3 步）──
      // 实测：真实 EMPTY 时 body 里只剩 8 个 <script> + 1 个 <style>，
      // **innerHTML 非空**。所以"清空 main"是不够忠实的——
      // 它会让 innerHTML 变成空串，从而被"有没有内容"的朴素判断放过。
      // 这里按真实剩余物重建。
      const cleared = await page.evaluate(() => {
        const main = document.querySelector("main") ?? document.body;
        main.replaceChildren(
          document.createElement("script"),
          document.createElement("script"),
          document.createElement("script"),
          document.createElement("style"),
        );
        return {
          text: main.innerText.trim().length,
          contentEls: [...main.querySelectorAll("*")].filter(
            (el) => !["SCRIPT", "STYLE", "LINK", "META", "TEMPLATE"].includes(el.tagName),
          ).length,
        };
      });
      expect(cleared.text, "坏样本必须真的把可见文本清掉").toBe(0);
      expect(cleared.contentEls, "坏样本必须真的把内容元素清掉").toBe(0);

      // ── 断言：快照必须在短窗口内还原内容 ──
      // 没有快照时这里会一直等到超时 → 红（这就是门禁的判别力所在）
      await expect
        .poll(() => page.evaluate(() => document.body.innerText.trim().length), {
          timeout: 5_000,
          message:
            "容器被清空后内容没有回来——水合快照缺失或未生效。\n" +
            "这正是 T-14 白屏的形态：DOM 被清空后无人还原。",
        })
        .toBeGreaterThan(0);

      const restored = await page.evaluate(() => ({
        sections: document.querySelectorAll("section").length,
        h1: [...document.querySelectorAll("h1")].filter((el) => el.innerText?.trim()).length,
      }));
      expect(restored.sections, "还原后 section 应恢复").toBeGreaterThan(0);
      expect(restored.h1, "还原后 h1 应恢复").toBeGreaterThan(0);
    } finally {
      await context.close();
      await browser.close();
    }
  });

  test("快照内容与清空前一致（不是只回填了个空壳）", async ({ baseURL }) => {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await page.goto(`${baseURL}${PREVIEW_PATH}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3000);

      const before = await page.evaluate(() => document.body.innerText.trim());
      expect(before.length).toBeGreaterThan(0);

      await page.evaluate(() => {
        const main = document.querySelector("main") ?? document.body;
        main.replaceChildren(
          document.createElement("script"),
          document.createElement("script"),
          document.createElement("style"),
        );
      });

      await expect
        .poll(() => page.evaluate(() => document.body.innerText.trim().length), { timeout: 5_000 })
        .toBeGreaterThan(0);

      const after = await page.evaluate(() => document.body.innerText.trim());
      // 不要求逐字相等（快照可能保留的是某个时点），但**必须实质相同**：
      // 只回填一个空壳（长度远小于原文）不算修好。
      expect(
        after.length,
        `还原后的文本量应接近原文（前 ${before.length} / 后 ${after.length}）——只回填空壳不算修好`,
      ).toBeGreaterThan(before.length * 0.8);
    } finally {
      await context.close();
      await browser.close();
    }
  });

  /**
   * 第三条（用户裁决 2）：**防修复变新 bug**。
   *
   * 快照还原是个"往回写 DOM"的动作——它最大的风险**不是救不回来，
   * 而是救过头**：把用户/模型的**合法编辑**也一起回滚掉。
   *
   * 所以这条用例专门造那个场景：快照已捕获 → **模拟就地编辑改了内容** →
   * 再触发一次**非清空的局部替换** → 断言**编辑结果还在**。
   *
   * 先跑它对当前实现：若红了，说明触发条件太宽（会误伤编辑），
   * 按"仅当内容元素从 N 塌缩到 ~0 才 restore"收紧后再转绿。
   */
  test("快照不得回滚合法编辑（收紧触发条件）", async ({ baseURL }) => {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await page.goto(`${baseURL}${PREVIEW_PATH}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3000);

      const before = await page.evaluate(() => document.body.innerText.trim().length);
      if (before === 0) test.skip(true, "本轮撞上 T-14 白屏态（环境命中），本用例需要正常态起步");

      // ① 模拟就地编辑：改掉首个 h1 的文本
      const EDITED = "SITECRAFT_EDIT_MARKER";
      await page.evaluate((marker) => {
        const h1 = document.querySelector("h1");
        if (h1) h1.textContent = marker;
      }, EDITED);

      // ② 触发一次**非清空的局部替换**（内容元素数没有塌缩到 0）
      await page.evaluate(() => {
        const main = document.querySelector("main") ?? document.body;
        const first = main.firstElementChild;
        if (first) {
          const swap = document.createElement("div");
          swap.appendChild(document.createTextNode("局部更新"));
          first.replaceChildren(swap);
        }
      });

      // ③ 断言：编辑结果**没有被快照回滚**
      await page.waitForTimeout(2000); // 给快照的兜底窗口足够时间（若它要误伤，早就动了）
      const stillEdited = await page.evaluate(
        (marker) => document.body.innerText.includes(marker),
        EDITED,
      );
      expect(
        stillEdited,
        "就地编辑的结果被快照回滚了——触发条件太宽，会误伤合法编辑。" +
          "收紧方向：仅当「内容元素数从 N 塌缩到 ~0」才 restore。",
      ).toBe(true);
    } finally {
      await context.close();
      await browser.close();
    }
  });
});

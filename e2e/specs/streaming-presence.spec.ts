import { test, expect } from "../helpers/fixtures";
import { mockAnalyze, readyIntent } from "../helpers/mock-ai";
import { analyzeAndConfirm } from "../helpers/ui";

/**
 * B5 · 流式在场感：中途状态必须**真的出现过**。
 *
 * ## 这个断言在测什么（也是最容易写成假门禁的地方）
 *
 * 它**不测"最终状态对"**——最终状态由 done 事件决定，无论逐事件消费还是
 * "buffer 收完取最后一个"，最后都会落到同一个终态。**测最终状态等于没测。**
 *
 * 它测的是：**生成过程中，界面上的"当前动作"文案至少变化过 2 次**。
 * 只有逐事件到达即更新，才会在中途产生 ≥2 种不同文案；
 * "收完再取最后一个"只会让文案**从初始值直接跳到最后一个**——
 * 中间那两次根本没机会被观察到。
 *
 * ## 为什么必须用真·逐块流的 mock
 *
 * 仓库既有 `mockExecute` 用 `route.fulfill({ body: sseBody(events) })`
 * **一次性吐完所有事件**——即使前端改成逐事件消费，客户端也只收到**一个 chunk**，
 * 于是**新旧两种实现表现完全一样**。用那种 mock 写出来的断言是**假门禁**：
 * 回退成"取最后一个"它照样绿。
 *
 * 所以这里覆写 `window.fetch`，把事件**分块并按真实时间间隔推送**。
 *
 * ## 为什么用 MutationObserver 而不是轮询
 *
 * 首版写成"每 60ms 读一次文案"，两个问题：① 轮询本身开销大、可能正好错过
 * 两次渲染之间的中间态；② `.isVisible()` 是**等待型**断言，在循环里会各等
 * 一次超时，把 60 秒预算吃光（首次运行就是这样超时的，不是断言失败）。
 * MutationObserver 挂在真实 DOM 变更上，**不会漏采**。
 */

/** 推送节奏（毫秒）：必须给 React 留出逐次渲染的时间，否则两次 setState 被合并。 */
const STEP_INTERVAL_MS = 260;

/**
 * 逐步推送的 execute 事件序列。
 *
 * 每个 status 事件都是一个**可观察的中途状态**——这正是"在场感"要传达的东西。
 * ⚠️ 字段名与 `GenerationProgress`（`lib/site-generator.ts`）保持同形；
 * 这里不 import 它（e2e 不进 lib 的构建图），但**改了那边要同步改这里**。
 */
const STREAM_STEPS: Array<Record<string, unknown>> = [
  { type: "status", value: "正在复用模板结构，并行填充首屏和板块内容…", phase: "content", completedSections: [], activeSections: ["hero", "about", "features", "services", "contact"], recoveringSections: [], failedSections: [] },
  { type: "status", value: "首屏已就位，正在写「关于」…", phase: "content", completedSections: ["hero"], activeSections: ["about"], recoveringSections: [], failedSections: [] },
  { type: "status", value: "「关于」已完成，正在写「优势」「服务」…", phase: "content", completedSections: ["hero", "about"], activeSections: ["features", "services"], recoveringSections: [], failedSections: [] },
  { type: "status", value: "正在校验内容并保存到模板草稿…", phase: "saving", completedSections: ["hero", "about", "features", "services", "contact"], activeSections: [], recoveringSections: [], failedSections: [] },
  { type: "done", status: "applied", partial: false, missingSections: [], draft: { revision: 1 } },
];

/**
 * 覆写 fetch，把 execute 的响应分块推送。
 *
 * ⚠️ 只有 `/generate` 的 `step === "execute"` 走这条；analyze 仍交给
 * `mockAnalyze`（本用例不测 analyze 的流式）。
 */
async function mockExecuteStreaming(page: import("@playwright/test").Page) {
  await page.addInitScript(({ steps, interval }) => {
    // 采集器：挂在真实 DOM 变更上，把"当前动作"那一行的文案变化全部记下来。
    // 必须在页面脚本之前定义，且不依赖 React 是否已挂载。
    const observed: string[] = [];
    (window as unknown as { __streamObserved: string[] }).__streamObserved = observed;
    const sample = () => {
      const nodes = document.querySelectorAll(".generate-steps > .step");
      const last = nodes[nodes.length - 1];
      const text = last?.textContent?.trim();
      if (text && observed[observed.length - 1] !== text) observed.push(text);
    };
    const start = () => {
      sample();
      new MutationObserver(sample).observe(document.documentElement, {
        childList: true, subtree: true, characterData: true,
      });
    };
    if (document.documentElement) start();
    else document.addEventListener("DOMContentLoaded", start);

    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      let body: { step?: string } | undefined;
      try {
        body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
      } catch {
        body = undefined;
      }
      if (!/\/api\/sites\/[^/]+\/generate$/.test(url) || body?.step !== "execute") {
        return nativeFetch(input, init);
      }
      const encoder = new TextEncoder();
      return new Response(new ReadableStream({
        start(controller) {
          // 逐块、按真实间隔推送。**不能一次 enqueue 全部**——
          // 那会退化成"一个 chunk"，本用例就失去了判别力。
          steps.forEach((step, index) => {
            window.setTimeout(() => {
              try {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(step)}\n\n`));
              } catch {
                // 流已被客户端取消（done 后前端会主动 cancel），忽略。
              }
              if (index === steps.length - 1) {
                try { controller.close(); } catch { /* 已关闭 */ }
              }
            }, interval * (index + 1));
          });
        },
      }), { status: 200, headers: { "Content-Type": "text/event-stream" } });
    };
  }, { steps: STREAM_STEPS, interval: STEP_INTERVAL_MS });
}

test.describe("B5 · 流式在场感", () => {
  test("生成过程中「当前动作」文案至少变化 2 次（逐事件到达，不是收完取最后一个）", async ({ page }) => {
    await mockAnalyze(page, { onMessage: () => readyIntent() });
    await mockExecuteStreaming(page);

    await analyzeAndConfirm(page, "工业自动化官网，面向海外客户");
    await page.getByRole("button", { name: /用此模板生成站点内容/ }).click();
    await expect(page.getByRole("progressbar", { name: "建站进度" })).toBeVisible();

    // 等到终态：进度视图消失（进 done / workspace）
    await expect(page.locator(".generate-progress-view")).toHaveCount(0, { timeout: 30_000 });

    const observed = await page.evaluate(
      () => (window as unknown as { __streamObserved?: string[] }).__streamObserved ?? [],
    );
    const distinct = [...new Set(observed)];

    // ⚠️ 本断言在 B5 开工时的定位，见文件头「它在测什么」——
    // 它是**回归网**，不是负向门禁：现状（旧的 buffer 重解析实现）也能通过，
    // 因为那个实现本来就是逐 chunk 推进的。别把它当成"证明改造生效"的证据。
    expect(
      distinct.length,
      `中途状态必须出现过 ≥2 种；实际观察到 ${distinct.length} 种：${JSON.stringify(distinct)}`,
    ).toBeGreaterThanOrEqual(2);
  });
});

/**
 * strict 生产形态的 e2e 入口（0.6 第 5 项）。
 *
 * ## 为什么需要单独一个入口
 *
 * 一个 `next start` 进程只能是 strict **或** relaxed——没法在同一服务里两样都测。
 * 而默认全套 e2e 跑 relaxed（e2e helper 不带访问头），所以 strict 的两条
 * spec（`strict-smoke` 与 `access-isolation`）必须**共用一个 strict 服务**跑。
 *
 * ## 与 `run-strict-access.mjs` 的关系
 *
 * 那个脚本先于本文件存在，只跑 `access-isolation.spec.ts`。本脚本把它一起带上
 * ——**两条 spec 都是 strict 专属**，分成两个入口只会让"该跑哪条"变成需要记的事。
 * 旧脚本保留（可能有外部习惯引用），但行为上已被本脚本覆盖。
 *
 * ## 关键：`SITECRAFT_ACCESS_MODE` 必须传进 playwright 进程
 *
 * `playwright.config.ts` 的 `webServer.env` 是 `{ ...process.env, PORT }`，
 * 而 `serve.mjs` 现在**尊重外部显式给的** `SITECRAFT_ACCESS_MODE`
 * （此前它写死 relaxed，把这里传的 strict 无声覆盖掉——见 0.6-1）。
 * 所以本脚本设的 env 会一路到被测服务。
 */
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const playwrightCli = resolve("node_modules/playwright/cli.js");

const specs = [
  "e2e/specs/strict-smoke.spec.ts",
  "e2e/specs/access-isolation.spec.ts",
];

const child = spawn(process.execPath, [playwrightCli, "test", ...specs], {
  cwd: process.cwd(),
  stdio: "inherit",
  env: { ...process.env, SITECRAFT_ACCESS_MODE: "strict" },
});
child.once("exit", (code) => process.exit(code ?? 1));

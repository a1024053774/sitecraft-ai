/**
 * 只读别名解析钩子：让 `node --test` 能 import 那些用了 `@/lib/...` 的路由模块。
 *
 * ## 为什么需要它
 *
 * `@/*` 是 Next.js/TS 的路径别名（`tsconfig.json` 的 `paths`），**node 原生不认**。
 * 所以仓库里至今**零个路由测试**——不是因为不想测，是因为 `import` 那一行就炸：
 * `ERR_MODULE_NOT_FOUND: Cannot find package '@/lib'`。
 *
 * 实测过的三条路（2026-09-12）：
 *
 * | 路子 | 结果 |
 * |---|---|
 * | 直接 import 路由 | ❌ 别名解析失败 |
 * | **本文件：`register()` 只读钩子** | ✅ 可用，且**不改 `npm test` 脚本、不碰 lib/** |
 * | `mock.module()` 替身 | ❌ Node 24 需 `--experimental-test-module-mocks`，要改脚本 |
 *
 * ## 它只做一件事
 *
 * `@/x/y` → `<仓库根>/x/y.ts`。**只解析路径，不改任何模块的行为**——
 * 没有替身、没有桩、没有副作用。测试跑的是真实模块。
 *
 * ## 用法
 *
 * ```ts
 * register("./alias-loader.mjs", import.meta.url);  // 必须在 import 路由之前
 * ```
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * 锚点 = 本文件位置（`tests/`）的上一级 = 仓库根。
 *
 * ⚠️ **不能用 `process.cwd()`**：解析钩子跑在独立的 worker 线程里，
 * 那里的 cwd 不是测试进程 chdir 之后的目录（实测踩过）。
 * `import.meta.url` 才是不受 cwd 影响的稳定锚点。
 */
const ROOT = new URL("../", import.meta.url);

export function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const base = new URL(specifier.slice(2), ROOT);
    // 依次试 `.ts` / `/index.ts` / 原样——与 tsconfig 的解析顺序一致
    for (const candidate of [new URL(`${base.href}.ts`), new URL(`${base.href}/index.ts`), base]) {
      if (existsSync(fileURLToPath(candidate))) {
        return { url: candidate.href, shortCircuit: true };
      }
    }
    // 找不到就交回默认解析——让它**如实报错**，不要在这里吞掉
  }
  return next(specifier, context);
}

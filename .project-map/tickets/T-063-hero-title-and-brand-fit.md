---
id: T-063
title: 首屏大标题和页眉公司名按长度放得下
type: build
status: open
blocked_by: [T-057]
claimed_by: codex-build
supersedes:
---

## What to build

T-060 验收时用三份模拟资料真实生成，工程工业页面出了两个老问题：
- 模型写的首屏长标题在 375/1440 下被裁或溢出，例如「不锈钢快换接头与卡套接头」「精密注塑模具与注塑件」。原因是工程工业 token 为 `keep-all` + `normal`，没有空格的长中文整句换不了行。
- 英文页 375 下页眉公司名被截断（「Menu」比「菜单」宽）。

浏览器的中文分词（`Intl.Segmenter`）会把「接头」「快换」切成单字，靠分词换行挡不住词中间断开。所以改成显示字号按长度适配：预览桥按标题和公司名的字数写一个 CSS 变量（只是数据，不测量布局），区块 CSS 用容器单位算 `min(样子字号, 可用宽度 / 字数)`，再设一个下限；只有到了下限还放不下，才按样子原有规则换行。本来就放得下的标题和公司名，字号和换行都不变。规则写在共享区块 CSS 和 token 里，不写针对某个样子的覆盖 CSS，不写模板分支，不按标点、字数猜断点。

不改：检查脚本只能加严，不能放宽；不手改模型生成的标题。

## Acceptance

- [ ] 测试先写、改动前先失败：用模型原始长标题和公司名（上面两例），在工程工业的 375/768/1440 中英文页都不裁、不溢出、不在词中间断开、没有孤字；英文页公司名不截断
- [ ] 工程工业 66 张、明亮/蓝白/灰底各 9 张对照，原本放得下的标题和页眉逐像素不变，只有原本溢出的那几张有变化，逐张说明
- [ ] T-060 的三份真实草稿（模型原始标题）`check-published` 中英文三档通过，检查不放宽；截图逐张看过
- [ ] `npm run typecheck`、`npm test`、`npm run build` 通过；代码审查通过；Claude 验收

## Resolution

- 失败证据：在 T-063 实现前运行 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node --test --experimental-strip-types tests/t063-hero-title-fit.test.ts`，源码契约与三档原始标题检查均失败，日志 `artifacts/t063-red-before.txt`；T-060 严格发布复现保存在 `artifacts/t060/strict-red-ff4fb1b/`。
- 实现提交：`5841a3d`（字符 CSS 变量和容器单位）、`0ffe615`（菜单预留宽度）、`3cbad1f`（仅由 look 声明启用）、`ff598ab`（保留整词断行）、`a1a99da`、`2feb531`、`b191b14`、`6befde4`（run 宽度、品牌独立和可断长句回归测试）。没有样子专用 CSS 覆盖、模板分支或 JS 布局测量；严格检查脚本未放宽。
- T-060 三份真实草稿用模型原始标题在最终代码 `b191b14` 后 `check-published` 中英文 9/9 通过，报告和截图 `artifacts/t063/published-final-current/`。
- 工程工业对照命令 `scripts/compare-engineering-default.mjs --old 7d09e6e` 的最终报告 `artifacts/t063/engineering-final-b191b14/`：原本放得下的工程工业页面保持一致；差异只落在注塑资料原本溢出的首屏标题/页眉区域。明亮产品、蓝白目录、灰底短路径分别为 `artifacts/t063/forge-final-current/`、`landwind-final-current/`、`tailwind-final-current/`，均 9/9 逐像素一致。
- 最终验证：`npm test` 521/521、0 失败/0 跳过（`artifacts/t063/full-final-b191b14.log`）；typecheck、build 通过（`artifacts/t063/typecheck-final-b191b14.log`、`build-final-b191b14.log`）。

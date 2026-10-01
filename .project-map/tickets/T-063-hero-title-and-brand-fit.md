---
id: T-063
title: 首屏大标题和页眉公司名按长度放得下
type: build
status: closed
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

- [x] 测试先写、改动前先失败：用模型原始长标题和公司名（上面两例），在工程工业的 375/768/1440 中英文页都不裁、不溢出、不在词中间断开、没有孤字；英文页公司名不截断
- [x] 工程工业 66 张、明亮/蓝白/灰底各 9 张对照，原本放得下的标题和页眉逐像素不变，只有原本溢出的那几张有变化，逐张说明
- [x] T-060 的三份真实草稿（模型原始标题）`check-published` 中英文三档通过，检查不放宽；截图逐张看过
- [x] `npm run typecheck`、`npm test`、`npm run build` 通过；代码审查通过；Claude 验收

## Resolution

- 失败证据：在提交 `a50d582` 前临时恢复 `--site-brand-fit-min: 4px` 与 `white-space: nowrap`，运行 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npx tsx --test tests/t063-hero-title-fit.test.ts`，同一条超长公司名在 375px 下得到 `fontSize: 12`、`lineCount: 1`、`scrollWidth: 272/clientWidth: 132` 并失败；日志 `artifacts/t063/red-brand-floor-before.txt`。恢复后同命令 4/4 通过。
- 实现提交：`a50d582` 将工程工业品牌字号下限改为 11px，并把 fitted brand 从 nowrap 改为 `white-space: normal; word-break: keep-all; overflow-wrap: normal`，允许在已有可断点换成多行；新增 375px 字号、行数和扫描断言。未加入样子专用覆盖、模板分支或布局测量。
- 最终证据均在 `a50d582` 之后生成：三份原始标题草稿的 `check-published` 报告和中英文截图 `artifacts/t063/published-final-a50d582/`，三份各 1440/768/375 均通过，英文参数值无汉字且品牌未截断。
- 对照均在 `a50d582` 之后生成：`scripts/compare-engineering-default.mjs --old 7d09e6e --out artifacts/t063/engineering-final-a50d582` 为 66 张中 65 张逐像素一致，1 张注塑资料首屏/参数区域有预期标题差异，报告标记 `only-hero+products`；`scripts/compare-look-baseline.mjs --template forge --old 7d09e6e --out artifacts/t063/forge-final-a50d582`、`--template landwind` 对应目录各 9/9 零差异；灰底短路径 `artifacts/t057/compare-tailwind-composed-delete-1a2b0a3.mjs --template tailwind-landing --old 9cdfabd --out artifacts/t063/tailwind-final-a50d582` 为 9/9 零差异。
- 最终验证命令均在 `a50d582` 之后运行：`npm test` 523/523、0 失败/0 跳过（`artifacts/t063/full-final-a50d582.log`）；`npm run typecheck` 与 `npm run build` 通过（对应 `typecheck-final-a50d582.log`、`build-final-a50d582.log`）。

- 代码审查：Astra PASS（候选 `d7aeb32`，`artifacts/review-astra-t060-t063.md`）；残余 P2 同 T-057（验收脚本宽度测量重复）。工程工业唯一差异图（注塑 1440）为原本贴住参数面板的首屏标题缩小后放进本栏，Claude 看过。

Claude 验收关闭（2026-10-01）。

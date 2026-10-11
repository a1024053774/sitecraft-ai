---
id: T-152
title: 预览里点选区块批注修改与快捷按钮，只改选中的那一段
type: build
status: open
blocked_by: []
claimed_by: Codex (t152-annotation-edits)
supersedes:
---

## Why

负责人 2026-10-09 排定的第 3 项。mainline 已定：用户可以用对话、预览批注点选、快捷按钮（更大胆 / 更克制 / 精简等）指定改哪里，模型直接改代码。现状：

- 对话修改（`handleCodeChat` → `claimRun('edit')` → `writeSiteCode` 带 current）每次让模型重写整站，再核对一次事实，用量很高：T-148 小样里只换首屏背景就用了 60,111 token。
- 改动范围不受控：同一次小样要求「只改首页」，模型改的是共享 `.hero`，产品页也带上了底图和署名。
- 批注线程（`lib/annotations.ts`）仍是旧路线的 slot/region 锚点，新路线预览没有点选入口（spec：「新路线预览批注编辑是后续范围」）。

## What to build

1. **点选**：工作台预览（中文版，1440/768/375 都可用）可进入「点选」状态，悬停高亮、点击选中一个可见区块。系统记录页面、稳定的 DOM 定位和文字快照，在对话框上方显示「已选：……」，可取消。锚点格式替换旧 slot/region 锚点，不保留两套；已有批注线程数据按 T-003 不删，读不懂的旧锚点如实显示为「旧批注，无法定位」。
2. **批注与快捷按钮**：选中后可以写一句修改意见，或点快捷按钮：更大胆、更克制、精简文字、换个版式（四个，文案按 `skills/frontend-less-ai-tone/`）。没有选中时快捷按钮作用于当前页。快捷按钮只是预设的修改意见，走同一条请求，不另设接口。
3. **局部修改**：有选中区块时，只把该区块的 HTML、相关 CSS 规则和必要上下文（页面大纲、资料摘要、风格）发给模型，模型只返回这一段的新 HTML 和需要新增或修改的 CSS；由代码写回原 DOM 位置。CSS 只允许新增或修改以本区块专属类名为作用域的规则，不改共享选择器；做不到就如实告诉用户并给出「改整页」的选择，不静默扩大范围。整页修改（没有选中区块）仍走现有路线。
4. **范围检查**：在提交入口确定性地核对改动范围：选中区块以外的页面 DOM 不变，其他页面的 HTML 不变，被改的 CSS 规则不影响区块外的元素（用渲染后的选择器匹配判断，不做像素或哈希比对）。越界按现有最多两轮修正交回模型，仍不过就如实告诉用户，不存版本。
5. **事实**：局部修改只核对新段落的事实，不重核整站；新增数字、型号、证书仍按现有底线检查拒收。
6. 版本、撤销、刷新沿用现有机制；版本摘要写明改的是哪一页哪一块。批注线程可选择性保存这次的意见和结果。
7. 同步 `intent.md`、`spec.md`、`mainline.md`、`CONTEXT.md`（锚点、局部修改、快捷按钮各只用一个名字）。

## Failure modes

点到装饰层或系统部件；同一区块在 375 下 DOM 不同导致定位漂移；刷新后选中状态丢失或指向旧版本；模型返回整页而不是一段；模型改了共享选择器，其他页或区块外跟着变；写回位置错（重复 id、相似结构）；局部改出新增事实；快捷按钮重复点击重复扣 token；中文改后英文版落后提示没出现；旧批注数据被删或报错；没有选中区块时误走局部路线。

## Acceptance

- [x] 先列出失效方式，再写红绿测试，测试在已知坏的实现上失败（至少：越界改共享 CSS 被拒、模型返回整页被拒、写回位置正确、旧批注数据不丢）
- [ ] 真实入口端到端（只一站，用现有评估站复制样本）：点选首屏 → 写意见改 → 撤销 → 点选另一块 → 点「精简文字」→ 刷新恢复；1440/768/375 截图看过；真实 DeepSeek 用量写进 Resolution，单次局部修改目标 ≤1.5 万 token，整轮上限 5 万，超了先停
- [ ] 改动前后成对截图交一个新的盲评实例：改动是否只发生在选中区块、结果是否比原来好（只这一站，不跑整轮 eval）
- [ ] Astra 审查通过；typecheck、test、build 通过

## Resolution

**INCOMPLETE（2026-10-10 EDT / 2026-10-11 UTC）**。执行候选为 `t152-annotation-edits` 上与本 Resolution 同一个本地提交，基线 `b9f8db0`；不推送、不关票。点选、局部写回、提交入口范围检查、四个快捷按钮、同版本点选刷新恢复和可选批注线程已实现。旧锚点拒绝新建、既有数据原样保留并显示无法定位。独立盲评及 Astra 审查由主控安排，以下技术通过不代表审美通过。

所有运行均在本 worktree，显式 `SITECRAFT_BASE=http://127.0.0.1:3164`，浏览器使用 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell`。样本只读复制主工作区的青禾纸包装 `fefa658d-7ce3-499a-8026-431f33313731`（首页、产品页及许可图片），主数据未写入。最终本地数据在 `artifacts/t152/final-data/`，真实失败数据保留在 `artifacts/t152/real-data/`。

技术证据（以下时间为 UTC，均对应本候选最后的代码改动之后）：

- `SITECRAFT_BASE=http://127.0.0.1:3164 CHROME_PATH=<上述路径> node --test --experimental-strip-types tests/t152-local-edits.test.ts`：01:26:44，9/9 通过，`artifacts/t152/green-contract-delivery.log`。父实现错误接受共享 CSS 的红态在 `red-contract.log`；整页回复、错误写回、丢弃旧锚点的反事实红态分别在 `red-mutant-whole-page-v2.log`、`red-mutant-wrong-position-v2.log`、`red-mutant-old-anchor.log`。新增行内计数器、事实输出额度红态在 `red-inline-counter.log`、`red-fact-output-cap.log`。早期非预期原因的失败产物保留，不用作反事实证据。
- 本地模型替身：`SITECRAFT_BASE=http://127.0.0.1:3164 node --experimental-strip-types scripts/t152-model-fixture.ts`（3165）。开发服务用 `SITE_STORE=fs SITECRAFT_DATA_ROOT=<本工作树数据目录> SITECRAFT_BASE=http://127.0.0.1:3164 DEEPSEEK_BASE_URL=http://127.0.0.1:3165 DEEPSEEK_API_KEY=local-fixture DEEPSEEK_MODEL=local-fixture CHROME_PATH=<上述路径> npm run dev -- --port 3164`。
- `SITECRAFT_BASE=http://127.0.0.1:3164 CHROME_PATH=<上述路径> node --experimental-strip-types scripts/t152-chat-boundaries.ts`：01:26:48，通过真实 chat 验证过期锚点、并发请求仅一次认领、整页/共享 CSS 最多两轮修正且不存版、未点选走原写作路线，以及事实提供方截断后候选仍保留。报告 `artifacts/t152/chat-boundaries-1791681999431/report.json`；候选丢失红态 `red-candidate-on-provider-failure.log`。
- `SITECRAFT_BASE=http://127.0.0.1:3164 SITE_STORE=fs CHROME_PATH=<上述路径> npm test`：01:28:00，348/348 通过，`npm-test-delivery.log`。`SITECRAFT_BASE=http://127.0.0.1:3164 npm run typecheck`：01:27:06 通过；同环境 `npm run build`：01:27:32 通过；日志为 `typecheck-delivery.log`、`build-delivery.log`。最初另设数据根造成旧测试固定路径读取失败，已用本 worktree 既有路径重跑；未改弱这些测试。
- `SITECRAFT_BASE=http://127.0.0.1:3164 T152_RUN_LABEL=local-delivery CHROME_PATH=<上述路径> node --experimental-strip-types scripts/t152-preview-e2e.ts`：01:28:17–01:28:32，通过「点首屏 → 意见修改 v2 → 撤销 v3 → 点另一块精简 v4 → 刷新」。断言精简后选中段落确实变短。三个新版本均经同一提交入口，2 页 × 3 档的溢出、重叠、对比度拒因均为 0。`artifacts/t152/local-delivery/report.json` 与 13 张截图均保留、逐张打开查看；这些是替身技术证据，不能代替真实模型或盲评。

真实尝试及未完成项：

- 01:23:12 开始获准的真实调用，使用 `scripts/t152-real-budget.ts` 在每次调用前预留输入估算与输出上限，整轮 50,000 token。密钥仅用指定的 `set -a; source /Users/luckye/Documents/Code/sitecraft-ai/.env.local; set +a` 载入该进程，未打印、复制或软链。真实服务指向 3166 预算代理及本 worktree 的 `artifacts/t152/real-data`。
- `SITECRAFT_BASE=http://127.0.0.1:3164 T152_RUN_LABEL=real-acceptance-ready CHROME_PATH=<上述路径> node --experimental-strip-types scripts/t152-preview-e2e.ts` 在首屏修改的事实校对处停止，没有新版本。写作 12,651 token（输入 9,330 / 输出 3,321）；事实校对 8,858（输入 4,763 / 输出 4,095，输出全为思考、正文为空、finish=length）。合计 **21,509 token**，超过单次 15,000 目标，低于整轮上限；没有重试。用量与预估在 `artifacts/t152/real-budget-1791681740918/usage.json`，任务与失败截图在 `artifacts/t152/real-acceptance-ready/`。更早一次点选时机错误尚未发出模型调用，产物在 `real-acceptance/`。
- 根因之一是本次曾把局部事实输出上限降为 4096；最终候选已恢复既有事实校对输出额度，没有关闭思考。真实失败当时只保留调用元数据，未保留写作候选正文；最终候选已改为先保存 `localResponses`，并有上述红绿证据。**这两项修复只做了本地验证，没有再调用真实模型，不能把真实验收写成通过，也未证明用量目标已达到。**
- 因真实修改没有存版，尚无合格的真实改动成对盲评包。主控需决定后续用量优化及是否重新授权一次真实验收，再安排独立盲评与 Astra 审查。票保持 open。

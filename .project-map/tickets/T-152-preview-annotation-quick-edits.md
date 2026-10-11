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
3. **局部修改**：有选中区块时，只把该区块的 HTML、匹配 CSS 规则和必要上下文（页面大纲、资料原文、风格要点）发给模型，不发整页 HTML 或全站 CSS；模型只返回这一段的新 HTML 和需要新增或修改的 CSS，由代码写回原 DOM 位置。资料不摘要改写或截断，仅去掉完全重复的副本并保留其最后出现顺序。CSS 只允许新增或修改以本区块专属类名为作用域的规则，不改共享选择器；做不到就如实告诉用户并给出「改整页」的选择，不静默扩大范围。整页修改（没有选中区块）仍走现有路线。
4. **范围检查**：在提交入口确定性地核对改动范围：选中区块以外的页面 DOM 不变，其他页面的 HTML 不变，被改的 CSS 规则不影响区块外的元素（用渲染后的选择器匹配判断，不做像素或哈希比对）。越界按现有最多两轮修正交回模型，仍不过就如实告诉用户，不存版本。
5. **事实**：局部修改固定非思考模式，只核对新段落的事实对资料原文，不重核整站；新增数字、型号、证书仍按现有底线检查拒收。整站生成的事实校对不变。
6. 版本、撤销、刷新沿用现有机制；版本摘要写明改的是哪一页哪一块。批注线程可选择性保存这次的意见和结果。
7. 同步 `intent.md`、`spec.md`、`mainline.md`、`CONTEXT.md`（锚点、局部修改、快捷按钮各只用一个名字）。

## Failure modes

点到装饰层或系统部件；同一区块在 375 下 DOM 不同导致定位漂移；刷新后选中状态丢失或指向旧版本；模型返回整页而不是一段；模型改了共享选择器，其他页或区块外跟着变；写回位置错（重复 id、相似结构）；局部改出新增事实；快捷按钮重复点击重复扣 token；中文改后英文版落后提示没出现；旧批注数据被删或报错；没有选中区块时误走局部路线。

## 主控决定：用量

2026-10-10 EDT 主控确认：局部事实校对改为非思考、输出留足非思考额度，整站事实校对不变；局部写作只发选中 HTML、匹配 CSS、大纲、风格要点和资料原文，记录同输入修前修后估算。再次授权一轮真实端到端，上限 25,000 token（此前剩余 28,491），第一次局部修改实际超过 15,000 就停止，不进入第二次；402 只试一次。通过后制作每次改动前后同页 1440/375 成对盲评包，随机命名和顺序，只问哪版更好、差异在哪里，不说明修改方式，映射保存在 private。新提交，不推送、不关票。

## Acceptance

- [x] 先列出失效方式，再写红绿测试，测试在已知坏的实现上失败（至少：越界改共享 CSS 被拒、模型返回整页被拒、写回位置正确、旧批注数据不丢）
- [ ] 真实入口端到端（只一站，用现有评估站复制样本）：点选首屏 → 写意见改 → 撤销 → 点选另一块 → 点「精简文字」→ 刷新恢复；1440/768/375 截图看过；真实 DeepSeek 用量写进 Resolution，单次局部修改目标 ≤1.5 万 token，整轮上限 5 万，超了先停
- [ ] 改动前后成对截图交一个新的盲评实例：改动是否只发生在选中区块、结果是否比原来好（只这一站，不跑整轮 eval）
- [ ] Astra 审查通过；typecheck、test、build 通过

## Resolution

**INCOMPLETE（2026-10-10 EDT / 2026-10-11 UTC）**。当前执行候选是基于 `5c1121e` 的本票新提交，文档与代码同提交，不推送、不关票。用量整改和本地验证已完成；本次真实首屏修改通过并保存 v2，撤销的整站事实校对在发送前被预算保护拦截，第二次局部修改未运行。独立盲评和 Astra 审查仍由主控安排。

本候选实现：局部事实校对固定非思考，输出额度 4096，整站事实校对的原提示、思考配置和 65536 额度不变；局部写作读取 `LOCAL-EDIT.md` 与所选风格首段要点，只发送选中 HTML、匹配 CSS、当前页大纲和资料原文。资料仅去掉完全相同的副本，保留最后出现顺序和恢复后的有效补充，不摘要、改写或截断。没有新增修改 API。原有局部范围、底线检查、候选留存和版本机制保留。

所有命令显式设 `SITECRAFT_BASE=http://127.0.0.1:3164`，Chrome 为 `/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell`（下文 `<Chrome>`）。复用此前已复制到本工作树的青禾纸包装两页原样本，没有写主工作区数据。之前的失败和证据保留，原实现与验收见 `5c1121e`。

### 红绿与输入估算

- `SITECRAFT_BASE=http://127.0.0.1:3164 T152_INPUT_LABEL=before CHROME_PATH=<Chrome> node --test --experimental-strip-types tests/t152-local-model-input.test.ts`：`artifacts/t152/usage-revision/red-local-model-v2.log` 中三项合同失败，分别为局部请求仍思考、资料重复、仍发送整站规划说明。初次脚本语法失败另存，不能当红态证据。
- 同命令改为 `T152_INPUT_LABEL=after-final`：2026-10-11 01:37:41 UTC，三项合同及样本估算均通过，`input-final.log`。另有 `green-local-model.log` 的局部边界回归通过。测试检查实际 HTTP 请求，证明局部 disabled、整站默认 enabled / 65536 及整站显式配置保持原样；资料原句和撤销后的有效更新保留，段外 HTML/CSS 哨兵未发送。
- 同站、同首屏、同修改意见，按相同字符估算公式，输入由 **15,453 → 6,709 token（减少 56.6%）**。完整输入与估算分别在 `artifacts/t152/usage-revision/before-1791682419562/input.json` 和 `after-final-1791682661541/input.json`。这是估算，不是上游计费值；本次真实写作输入实测 4,336，前次为 9,330。

### 本地检查

- `SITECRAFT_BASE=http://127.0.0.1:3164 SITE_STORE=fs CHROME_PATH=<Chrome> npm test`：2026-10-11 01:39:45 UTC，351/351 通过，`artifacts/t152/usage-revision/npm-test-final.log`。服务与测试都用本工作树 `.sitecraft-data`；之前的未就绪连接失败、数据根不一致造成图片 404 的失败已保留，没有修改这些旧测试来放行。
- `SITECRAFT_BASE=http://127.0.0.1:3164 npm run typecheck`、同环境 `npm run build`：分别于 2026-10-11 01:43:50、01:43:55 UTC 通过，`typecheck-handoff.log`、`build-handoff.log`。测试及构建均在本次代码改动之后运行，对应与本 Resolution 同提交的候选。
- 本地替身进程命令：`SITECRAFT_BASE=http://127.0.0.1:3164 node --experimental-strip-types scripts/t152-model-fixture.ts`，监听 3165。开发服务使用 `SITE_STORE=fs SITECRAFT_DATA_ROOT=<本工作树样本目录> SITECRAFT_BASE=http://127.0.0.1:3164 DEEPSEEK_BASE_URL=http://127.0.0.1:3165 DEEPSEEK_API_KEY=local-fixture DEEPSEEK_MODEL=local-fixture CHROME_PATH=<Chrome> npm run dev -- --port 3164`。
- `SITECRAFT_BASE=http://127.0.0.1:3164 T152_RUN_LABEL=usage-revision-local-ready CHROME_PATH=<Chrome> node --experimental-strip-types scripts/t152-preview-e2e.ts`：本地真实 UI 入口完整走通，产物在 `artifacts/t152/usage-revision-local-ready/`。这只是模型替身技术证据，不替代真实流程或审美结论。截图均打开检查；其中平板工作台图捕到了抽屉退场中间态，不作为平板静态界面验收图；截图脚本现等待抽屉隐藏，静态生成站截图正常。

### 本次真实用量与停止原因

2026-10-11 01:40 UTC，使用授权的 `set -a; source /Users/luckye/Documents/Code/sitecraft-ai/.env.local; set +a` 仅载入预算代理进程。`SITECRAFT_BASE=http://127.0.0.1:3164 DEEPSEEK_MODEL=deepseek-flash node --experimental-strip-types scripts/t152-real-budget.ts` 监听 3166，服务指向此代理及 `artifacts/t152/usage-revision/real-data`。运行 `SITECRAFT_BASE=http://127.0.0.1:3164 T152_RUN_LABEL=usage-revision-real CHROME_PATH=<Chrome> node --experimental-strip-types scripts/t152-preview-e2e.ts`。

- 首屏写作：输入 **4,336**，输出 **2,990**（其中推理 2,203），共 **7,326**。
- 局部事实校对：固定 disabled；输入 **2,414**，输出 **5**，共 **2,419**。没有拒因，当前站点保存为 **v2**；六个页面/宽度组合的溢出、重叠、对比度拒因均为 0。
- 首次局部修改合计 **9,745 token**，通过 15,000 实际用量门限。
- 撤销仍走原整站事实校对。调用前原始字符估算 13,839；按前次实测输入/字符估算比例加余量，调用预估为 9,988。再预留本验收代理的最大输出 6,144，加已用 9,745，得到 **25,877 > 25,000**。预算代理在调用上游前拒绝并停止；没有重置预算、缩减预留继续调用或重试。
- **本次实际只花 9,745**，没有耗尽 25,000；是调用前估算与输出预留触发保护。撤销未完成、第二次精简和末尾刷新未执行。没有遇到 402。此前失败已花 21,509，两次累计实际 **31,254**；原 50,000 总额剩余 **18,746**，不视为新的调用授权。

逐调用估算和上游用量：`artifacts/t152/real-budget-1791682810374/usage.json`。输入预估采用原字符公式 × 0.70 + 300，依据前次实测的 9,330/15,453 与 4,763/9,163 留余量，原始估算也同时记录；它仍是估算。首轮门限在 UI 驱动脚本中于撤销前核对实际用量。真实任务、候选、版本和截图保存在 `artifacts/t152/usage-revision-real/` 与对应 real-data；工作流报告保持 INCOMPLETE。

### 成对包与交接

仅为已通过提交入口的首屏改动制作了 **1 组、4 张**真实截图（同页改前/改后 × 1440/375），全部打开检查。命令：`SITECRAFT_BASE=http://127.0.0.1:3164 CHROME_PATH=<Chrome> node --experimental-strip-types scripts/t152-review-pack.ts artifacts/t152/usage-revision-real --completed-only`。

- 交盲评者：`artifacts/t152/review-pack-1791682991107/review/`。文件名、版本顺序随机；说明只问哪版更好和两版差异，不说明修改方式。
- 主控保管：同包 `private/mapping.json` 和 `private/source-shots/`。映射明确 `workflowStatus: INCOMPLETE`、`completedOnly: true`、`pairCount: 1`，不把这组包当作完整端到端通过。工具拒绝把本地替身结果制作成真实包，负例日志为 `reject-fixture-partial-pack.log`。
- 未生成第二组，也没有独立审美结论。继续真实流程需要主控决定预算预留/撤销校对方案并重新授权；本候选不擅自改变整站校对。Astra 审查、盲评和关票均留给主控。

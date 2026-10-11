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
6. 版本、撤销、刷新沿用现有提交机制；恢复已核对的目标且资料原文未变时，只跑确定性检查，事实结论沿用并在新版本注明「沿用 vX 的事实核对」。资料变更或依据不确定时照旧调模型，不用哈希。版本摘要写明改的是哪一页哪一块；批注线程可选择性保存意见和结果。
7. 同步 `intent.md`、`spec.md`、`mainline.md`、`CONTEXT.md`（锚点、局部修改、快捷按钮各只用一个名字）。

## Failure modes

点到装饰层或系统部件；同一区块在 375 下 DOM 不同导致定位漂移；刷新后选中状态丢失或指向旧版本；模型返回整页而不是一段；模型改了共享选择器，其他页或区块外跟着变；写回位置错（重复 id、相似结构）；局部改出新增事实；快捷按钮重复点击重复扣 token；中文改后英文版落后提示没出现；旧批注数据被删或报错；没有选中区块时误走局部路线。

## 主控决定：范围、文案与用量

局部事实校对固定非思考，只发选中 HTML、匹配 CSS、大纲、风格要点与资料原文。恢复已核对目标且资料原文未变时沿用事实结论，仍跑确定性检查；资料变化或依据不明重核。前次已完成首屏修改、0 token 撤销和另一块精简，决定及证据见 `648dbfe`。

2026-10-10 EDT 主控复审：新「精简文字」版获盲评略好，原意保留、用词更直接，变化只在选中段；首屏组此前持平。Astra 对 `5970a14` 仍有一项 NO_GO：伪类正则先截取 focus，遗漏 focus-visible/focus-within 对外部页面的影响。要求三处同类处理一起修复，先补外部焦点状态红测试；新测试改读 SITECRAFT_BASE，不绑定端口，在 3164 和另一端口各跑一次。此次不调用真实模型，新本地提交，不推送、不关票，最终 Astra 复核由主控安排。

## Acceptance

- [x] 先列出失效方式，再写红绿测试，测试在已知坏的实现上失败（至少：越界改共享 CSS 被拒、模型返回整页被拒、写回位置正确、旧批注数据不丢）
- [x] 真实入口端到端（只一站，用现有评估站复制样本）：点选首屏 → 写意见改 → 撤销 → 点选另一块 → 点「精简文字」→ 刷新恢复；1440/768/375 截图看过；真实 DeepSeek 用量写进 Resolution，单次局部修改目标 ≤1.5 万 token，整轮上限 5 万，超了先停
- [x] 改动前后成对截图交一个新的盲评实例：改动是否只发生在选中区块、结果是否比原来好（只这一站，不跑整轮 eval）
- [ ] Astra 审查通过；typecheck、test、build 通过

## Resolution

**执行验证 PASS；整票 INCOMPLETE，等待最终 Astra 复核。独立盲评已由主控反馈通过。** 本候选是本 Resolution 同一提交（父提交 `5970a14`），票保持 open，不推送。此前四项修复及真实验证记录保留在父提交与其产物中，不重复调用模型或重做盲评包。

### 修复与回归

- 三处交互态选择器处理（相关 CSS 提取、新 CSS 选择器、范围外规则匹配）都按完整名称消费 `focus`、`focus-visible`、`focus-within`，用 CSS 名称边界代替允许连字符后缀被截开的单词边界；大小写同样识别。没有新增接口、模型提示或样本例外。
- 外部状态测试先用 Chrome 的真实 Tab 键让产品页链接进入键盘焦点，分别确认 `a:focus-visible` 和 `a:focus-within` 的候选把外框从 2px 改为 8px，再要求 `pageId: home` 的提交拒收且不增版本。读取的是原生匹配与计算样式，不比截图像素。
- 局部正例验证选中链接/祖先的焦点 CSS 会进入写作上下文，合法的区块专属焦点样式仍可提交；防止通过一概拒绝焦点样式掩盖漏检。
- `tests/t152-scope-regressions.test.ts` 只要求显式设置 SITECRAFT_BASE，所有 URL 继续读取该值；不固定主机或端口，也不在缺值时回落到主工作区。

### 本次证据

日期：2026-10-11 UTC / 2026-10-10 EDT。证据目录 **`artifacts/t152/focus-review/`**。所有服务与数据均在本 worktree，使用 `SITE_STORE=fs` 和本工作树 `.sitecraft-data`；主数据、真实样本站和密钥均未访问。`<Chrome>` 为 `/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell`。

- 红态：`SITECRAFT_BASE=http://127.0.0.1:3164 CHROME_PATH=<Chrome> node --test --experimental-strip-types --test-name-pattern='focus' tests/t152-scope-regressions.test.ts`。旧实现三个用例全部失败：外部两种焦点 CSS 都错误 applied，写作上下文漏掉焦点规则。`red-focus.log` 保留原始断言；Chrome 的真实焦点和 2px/8px 断言先通过，故不是夹具失败。
- 端口红态：`SITECRAFT_BASE=http://127.0.0.1:3167 CHROME_PATH=<Chrome> node --test --experimental-strip-types tests/t152-scope-regressions.test.ts`。旧端口断言在测试入口拒绝 3167，`red-port-3167.log`。
- 3164 绿态：`SITECRAFT_BASE=http://127.0.0.1:3164 CHROME_PATH=<Chrome> node --test --experimental-strip-types tests/t152-scope-regressions.test.ts`，**10/10** 通过，`green-3164.log`。覆盖焦点、旧规则间接影响、当前页边界、选择器逗号和原生导航实际滚动。
- 3167 绿态：`SITECRAFT_BASE=http://127.0.0.1:3167 CHROME_PATH=<Chrome> node --test --experimental-strip-types tests/t152-scope-regressions.test.ts`，**10/10** 通过，`green-3167.log`。将本 worktree 开发服务由 3164 停止后，以 `SITECRAFT_BASE=http://127.0.0.1:3167 SITE_STORE=fs CHROME_PATH=<Chrome> DEEPSEEK_BASE_URL=http://127.0.0.1:3165 DEEPSEEK_API_KEY=local-only DEEPSEEK_MODEL=local-only npm run dev -- --port 3167` 启动；测试源码完全相同，没有内存替换端口。
- 全量：`SITECRAFT_BASE=http://127.0.0.1:3164 SITE_STORE=fs CHROME_PATH=<Chrome> npm test`，**367/367** 通过，日志 `npm-test.log`。
- `SITECRAFT_BASE=http://127.0.0.1:3164 npm run typecheck` 与同环境 `npm run build` 均通过，`typecheck.log`、`build.log`。测试仅使用受控本地 provider，提交入口、持久化与 Chrome 检查真实执行。

本次日志完成时间（UTC）：red-focus.log 02:44:17；red-port-3167.log 02:44:10；green-3164.log 02:45:31；green-3167.log 02:48:20；npm-test.log 02:47:29；typecheck.log 02:45:26；build.log 02:45:32。全量测试生成的浏览器截图已逐张打开查看；本次未改变生成页面内容，不重做真实截图。

### 既有真实验证与交接

本次真实模型调用 **0 次，0 token**。此前同块 v4 → v5 共 7,532 token，报告 `artifacts/t152/astra-simplify-real/report.json`；本票已知累计仍为 **46,222**，原 50,000 剩余 **3,778**，不视为新增调用授权。

已获盲评略好的是 v5 `7c53d31c-294d-4404-adfe-8585486b4e07`；原版 v3 / 新结果 v5 的 1440/375 随机 A/B 包仍为 **`artifacts/t152/review-pack-1791685708511/review/`**，映射在同包 `private/` 由主控保管。既有截图和失败记录保留。本次只修范围检查及测试环境，不更新生成站内容，不自审美。主控下一步只需安排 Astra 对本提交最终复核。

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

2026-10-10 EDT 主控转交 Astra NO_GO：旧 CSS 可因 DOM 变化影响外部；未点选快捷修改缺提交范围；预览拦截 hash/语言链接；逗号分隔误拆函数选择器。盲评首屏持平、精简原版更好，后者丢失先后衔接且缩句生硬；两组变化均只在选中处。要求四项先红后绿、四个按钮仅改通用提示，保留事实、操作顺序和自然商务中文，不加样本例外。授权同站同块再点一次精简，上限 10,000 token；成对包重新随机 A/B。新本地提交，不推送、不关票；独立复审由主控安排。

## Acceptance

- [x] 先列出失效方式，再写红绿测试，测试在已知坏的实现上失败（至少：越界改共享 CSS 被拒、模型返回整页被拒、写回位置正确、旧批注数据不丢）
- [x] 真实入口端到端（只一站，用现有评估站复制样本）：点选首屏 → 写意见改 → 撤销 → 点选另一块 → 点「精简文字」→ 刷新恢复；1440/768/375 截图看过；真实 DeepSeek 用量写进 Resolution，单次局部修改目标 ≤1.5 万 token，整轮上限 5 万，超了先停
- [ ] 改动前后成对截图交一个新的盲评实例：改动是否只发生在选中区块、结果是否比原来好（只这一站，不跑整轮 eval）
- [ ] Astra 审查通过；typecheck、test、build 通过

## Resolution

**执行验证 PASS；整票 INCOMPLETE，等待新一轮 Astra 与盲评。** 当前候选为本 Resolution 同一提交（父提交 `648dbfe`）。主控转交的上一轮 NO_GO 与盲评结果保留，不以技术测试代替审美结论。票保持 open，不推送。

### 修复

- 提交入口比较修改前后 CSS 规则的范围外匹配、声明与顺序；不是只检查新增 CSS。选中 DOM 导致旧 `+`、`:has()` 等规则增减外部命中也拒收。比较来自 Chrome 对静态渲染器文档的 DOM/CSSOM 查询，不用哈希、字节或像素比对。媒体和支持条件无论当前是否生效都检查；无法核对的嵌套 CSS 明确拒绝，不放过。
- 未点选快捷按钮的 `pageId` 经现有 chat、任务、每次候选及修正传入同一提交入口，其他页 HTML、公共片段及作用于其他页的 CSS 不得改变。合法的当前页 DOM 和仅当前页命中的 CSS 仍能存版。
- 未开点选时不取消链接默认动作，保留 hash 和语言切换。载入后同步工作台页面/语言，避免下一次点选或快捷修改使用旧范围。
- 选择器仅按顶层逗号拆分，保留嵌套函数、属性引号与转义；真正的顶层越界选择器仍拒收。
- 四按钮仅改通用预设意见。精简删除重复与空话，保留事实、先后衔接、解释和限制条件，不压成电报体；其余按钮分别说明保留内容、功能与顺序，改变层级/装饰/图文布局。没有公司或样本文字例外。

### 红绿与检查

以下证据均在 2026-10-11 UTC 生成，对应本候选代码。所有命令显式设 `SITECRAFT_BASE=http://127.0.0.1:3164`；`<Chrome>` 为 `/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell`。全量测试的服务和测试进程都使用本工作树 `.sitecraft-data`；真实流程只用本工作树 `artifacts/t152/usage-revision/real-data`，没有访问主数据。

- 新回归命令：`SITECRAFT_BASE=http://127.0.0.1:3164 CHROME_PATH=<Chrome> node --test --experimental-strip-types tests/t152-scope-regressions.test.ts`。依据主控给的 Astra 四项复现摘要，旧实现中兄弟与 :has 用例错误存版，pageId 两用例错误 complete，函数/属性逗号错误拒收；Chrome 中 hash、语言链接均被 preventDefault。红态保存在 `artifacts/t152/astra-fixes/red.log`、`red-navigation.log`。初次语言用例选错属性的夹具错误单独保留，修正选择器后再取得预期红态。
- 相同回归首轮 **7/7**，见 `green-first.log`；全量运行同时覆盖补充的当前页合法修改用例。主控补充具体内存复现后，把锚点放到首屏外，并验证跨页与同页 hash 的实际滚动距离、目标可见性；暂换回 `648dbfe` 的两个预览组件得到预期红态 `red-navigation-scroll-fixed-fixture.log`，恢复候选后 **2/2** 通过，`green-navigation-scroll.log`。首次补充夹具缺少首页同名锚点的错误也保留，不计红态。只替换 provider HTTP 与 Next after 调度；chat、提交、文件存储、静态预览、Chrome 原生点击均真实执行。
- `SITECRAFT_BASE=http://127.0.0.1:3164 SITE_STORE=fs CHROME_PATH=<Chrome> npm test`：**364/364**；补充滚动断言后再跑全量，日志 `artifacts/t152/astra-fixes/npm-test-final.log`，初次全量日志保留。
- `SITECRAFT_BASE=http://127.0.0.1:3164 npm run typecheck` 与同环境 `npm run build`：均通过，补充断言后日志 `typecheck-scroll.log`、`build-scroll.log`。之前 review-pack 的数组类型推断错误日志保留，已补显式类型。
- `SITECRAFT_BASE=http://127.0.0.1:3164 T152_RUN_LABEL=astra-simplify-local CHROME_PATH=<Chrome> node --experimental-strip-types scripts/t152-simplify-e2e.ts`：本地替身先跑通同一按钮、同块写入和刷新，`artifacts/t152/astra-simplify-local/report.json` 为 PASS。4 张本地工作台截图已打开。

### 真实验证与额度

本次只从已存 v4 的首页第三块点一次「精简文字」，没有撤销、重做首屏或第二次用户调用。2026-10-11 **02:28:06–02:28:21 UTC** 存 v5 `7c53d31c-294d-4404-adfe-8585486b4e07`，刷新仍为该版本；home/products × 375/768/1440 底线通过，无溢出、文字重叠或对比度拒因。无修正轮、重试、402。新段恢复「先给……再确认……」与「外尺寸不能当作可用空间」；这里只确认实际输出，不判文案优胜。

凭据仅按规定 source 到预算代理进程。代理为 `SITECRAFT_BASE=http://127.0.0.1:3164 DEEPSEEK_MODEL=deepseek-flash node --experimental-strip-types scripts/t152-real-budget.ts`，每次请求前估算输入；写作输出最多 4096，事实核对按剩余额度封顶。生产局部事实请求额度仍为 4096，本次预算代理把实际第二次上限收紧至 1269；两次都正常 stop。用完即停代理，不继续消耗剩余授权。

开发服务：`SITECRAFT_BASE=http://127.0.0.1:3164 SITE_STORE=fs SITECRAFT_DATA_ROOT=<本工作树>/artifacts/t152/usage-revision/real-data CHROME_PATH=<Chrome> DEEPSEEK_BASE_URL=http://127.0.0.1:3166 DEEPSEEK_API_KEY=local-budget-proxy DEEPSEEK_MODEL=deepseek-flash npm run dev -- --port 3164`。

真实命令：`SITECRAFT_BASE=http://127.0.0.1:3164 T152_RUN_LABEL=astra-simplify-real T152_BUDGET_REPORT=artifacts/t152/real-budget-1791685674100/usage.json CHROME_PATH=<Chrome> node --experimental-strip-types scripts/t152-simplify-e2e.ts`。

| 调用 | 输入预估 | 实际输入 | 实际输出 | 合计 |
| --- | ---: | ---: | ---: | ---: |
| 局部写作（enabled） | 4,664 | 3,901 | 1,349（含推理 912） | 5,250 |
| 局部事实（disabled） | 3,481 | 2,277 | 5 | 2,282 |
| 本次 | | 6,178 | 1,354 | **7,532** |

报告为 `artifacts/t152/astra-simplify-real/report.json`，预算账本为 `artifacts/t152/real-budget-1791685674100/usage.json`。本次 **7,532 < 10,000**；此前 38,690，本票累计 **46,222**，原 50,000 剩 **3,778**，不视为额外调用授权。真实工作台 1440/768/375 和选中态共 4 张已打开；历史失败对话仍保留。

### 盲评交接

命令：`SITECRAFT_BASE=http://127.0.0.1:3164 CHROME_PATH=<Chrome> node --experimental-strip-types scripts/t152-review-pack.ts artifacts/t152/astra-simplify-real`。

- 只交 **`artifacts/t152/review-pack-1791685708511/review/`** 给新盲评实例：原版 v3 与新结果 v5，同页 1440/375，共 4 张，全都打开看过，无载入态或缺图。评审说明只问哪版更好、差在哪里，不透露修改方式。
- **`private/` 由主控保管**：记录实际按钮输入 v4、对照基线 v3、结果 v5、随机抽签结果及 A/B 映射。本次只打包精简组；上一轮首屏持平的包和失败证据保留。上一包两组恰都呈现改前在先；本次明确 A/B 为随机展示位置，文件排序与说明顺序一致，随机位单独留在 private，未按结果重抽。
- 主控下一步：安排 Astra 对本提交复审、将新 review 目录交独立盲评。执行者不自审美、不关票。

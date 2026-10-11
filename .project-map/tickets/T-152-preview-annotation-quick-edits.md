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

## 主控决定：用量与恢复

2026-10-10 EDT 主控确认：局部事实校对固定非思考，整站生成和对话修改不变；局部写作只发选中 HTML、匹配 CSS、大纲、风格要点和资料原文。恢复目标当初已通过事实核对且资料文本未变时，沿用原结论并标明来源版本，只重新执行确定性底线检查；资料变更或依据不明仍调模型。通过直接比较文本或资料记录判断，不用哈希。本次从已存首屏修改 v2 续跑「撤销（0 token）→ 另一块精简文字 → 刷新」，独立上限 15,000 token，超额停止；不重做首屏，不推送、不关票。补齐两组 1440/375 成对包，随机名称与顺序，只问哪版更好、差异在哪里，映射归 private。此前阶段的决定与失败证据保留在 `325c308` 及其引用产物中。

## Acceptance

- [x] 先列出失效方式，再写红绿测试，测试在已知坏的实现上失败（至少：越界改共享 CSS 被拒、模型返回整页被拒、写回位置正确、旧批注数据不丢）
- [x] 真实入口端到端（只一站，用现有评估站复制样本）：点选首屏 → 写意见改 → 撤销 → 点选另一块 → 点「精简文字」→ 刷新恢复；1440/768/375 截图看过；真实 DeepSeek 用量写进 Resolution，单次局部修改目标 ≤1.5 万 token，整轮上限 5 万，超了先停
- [ ] 改动前后成对截图交一个新的盲评实例：改动是否只发生在选中区块、结果是否比原来好（只这一站，不跑整轮 eval）
- [ ] Astra 审查通过；typecheck、test、build 通过

## Resolution

**执行验证 PASS；独立审美与 Astra 审查待主控，票保持 open。** 2026-10-10 EDT / 2026-10-11 UTC，基线 `325c308`，当前候选是本 Resolution 与代码所在的新本地提交；不推送、不关票。前次已保存的首屏 v2 没有重做；真实续跑完成 v2 → 撤销 v3 → 精简 v4 → 刷新恢复。

### 实现与边界

- 新版本保存原始资料文本快照；目标通过事实核对且快照与当前原始资料完全相同时，恢复只略过模型事实调用。有效用户补充仍按目标版本请求链恢复，不改生成、对话修改或资料链语义。
- 旧版本缺快照时，只有完整的初次生成记录（首版、baseRevision=0、成功生成任务、版本关联和请求原文一致、成功 facts 调用）才可还原依据。未核对的导入、资料变化、证据缺失继续调模型；不回填、修改历史版本，不用哈希。
- 清理、资源与链接、数字来源和三档布局等确定性检查每次执行；失败不存版。`checks.factReviewFrom` 保存目标 ID、修订号及原核对时间，工作台与版本历史显示「沿用 vX 的事实核对」。英文版保留其中文核对依据；再恢复已沿用过的版本保留原核对时间。
- 续跑脚本读取前次报告、验证当前版本正是已存 v2，再开始撤销；账本在调用前后同时核对请求数和 token，防止把未计入账本的调用算作 0。

### 红绿与检查

所有命令显式使用 `SITECRAFT_BASE=http://127.0.0.1:3164`。浏览器统一为 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell`（下文 `<Chrome>`）。资料和版本只读写本工作树；真实站继续使用 `artifacts/t152/usage-revision/real-data`，主工作区数据未写入。

- 红态：`SITECRAFT_BASE=http://127.0.0.1:3164 CHROME_PATH=<Chrome> node --test --experimental-strip-types tests/t152-restore-facts.test.ts`，`artifacts/t152/restore-reuse/red-restore.log` 记录旧实现恢复时模型调用数从 2 增至 3，违反 0 次要求。
- 绿态：相同命令，2026-10-11 01:55:22 UTC，6/6 通过，`green-after-mutants.log`。相关版本历史用例与此文件合跑 15/15 通过，`green-contracts.log`。去掉资料比较、过度信任未知旧记录、跳过确定性检查三个坏实现分别触发预期断言失败，红态在 `red-mutant-changed-materials.log`、`red-mutant-unknown-proof.log`、`red-mutant-skip-deterministic.log`。
- `SITECRAFT_BASE=http://127.0.0.1:3164 SITE_STORE=fs CHROME_PATH=<Chrome> npm test`：2026-10-11 01:57:16 UTC，**357/357 通过**，`npm-test.log`。测试服务与进程均指向本工作树 `.sitecraft-data`。
- `SITECRAFT_BASE=http://127.0.0.1:3164 npm run typecheck`：02:06:17 UTC 通过；同环境 `npm run build`：02:06:20 UTC 通过。日志为 `typecheck-delivery.log`、`build-delivery.log`，对应本候选代码。
- 本地替身先验证同一续跑入口，报告 `artifacts/t152/restore-resume-local/report.json` 为 PASS。原始失败、旧版截图和前次半程包都保留，不替换或删除。

### 真实续跑与用量

授权凭据仍只用 `set -a; source /Users/luckye/Documents/Code/sitecraft-ai/.env.local; set +a` 载入预算代理进程。代理命令 `SITECRAFT_BASE=http://127.0.0.1:3164 DEEPSEEK_MODEL=deepseek-flash node --experimental-strip-types scripts/t152-real-budget.ts`，监听 3166，本次限额 15,000，启动即保存零用量账本。开发服务使用 `SITE_STORE=fs SITECRAFT_DATA_ROOT=<本工作树>/artifacts/t152/usage-revision/real-data SITECRAFT_BASE=http://127.0.0.1:3164 DEEPSEEK_BASE_URL=http://127.0.0.1:3166 DEEPSEEK_API_KEY=local-budget-proxy DEEPSEEK_MODEL=deepseek-flash CHROME_PATH=<Chrome> npm run dev -- --port 3164`。

续跑命令：`SITECRAFT_BASE=http://127.0.0.1:3164 T152_RESUME_REPORT=artifacts/t152/usage-revision-real/report.json T152_BUDGET_REPORT=artifacts/t152/real-budget-1791684110816/usage.json T152_RUN_LABEL=restore-resume-real CHROME_PATH=<Chrome> node --experimental-strip-types scripts/t152-preview-e2e.ts`。

2026-10-11 **02:02:30–02:02:52 UTC** 完成，`artifacts/t152/restore-resume-real/report.json` 为 PASS：

| 阶段 | 输入 | 输出 | 合计 |
| --- | ---: | ---: | ---: |
| 撤销 v2 → v3 | 0 | 0 | **0** |
| 精简选中区块写作 | 3,614 | 1,595（推理 1,176，已包含） | **5,209** |
| 局部事实核对（disabled） | 2,222 | 5 | **2,227** |
| 本次续跑 | | | **7,436** |

- 撤销前后账本新增请求数 **0**、新增 token **0**。v3 完整记录沿用 v1 的结论和 `2026-10-09T10:29:21.419Z` 原核对时间；没有伪造本次模型结论。
- 精简首次通过，无修正轮、无重试、无 402。选中段落文本确实缩短，E楞/B楞、按实物打样、外尺寸不作可用空间等内容保留。v3 与 v4 均重新通过 home/products × 375/768/1440 的确定性检查，溢出、重叠和对比度拒因均为 0；刷新仍为 v4。
- 本次实际 **7,436 < 15,000**。两次成功局部修改分别为前次 9,745、本次 7,436，完成流程合计 **17,181**；加上最初失败的 21,509，本票已知真实调用累计 **38,690**，原 50,000 额度剩余 **11,310**，不视为新调用授权。
- 完整逐调用预估和上游用量在 `artifacts/t152/real-budget-1791684110816/usage.json`；恢复及精简的新完整版本仍在本工作树 real-data。所有三档截图均已打开查看；本次没有改写或掩盖之前的失败记录。

### 盲评包与交接

命令：`SITECRAFT_BASE=http://127.0.0.1:3164 CHROME_PATH=<Chrome> node --experimental-strip-types scripts/t152-review-pack.ts artifacts/t152/restore-resume-real`。

完整包为 `artifacts/t152/review-pack-1791684250873/`：

- **交盲评者：`review/`**，首屏修改、精简文字各一组，改前/改后 × 1440/375，共 **8 张**。名称与顺序随机，说明只问哪版更好、两版差异，不说明修改方式。8 张均已打开检查，没有载入态或缺图。
- **主控保管：`private/`**，含映射及源截图；映射记录 `workflowStatus: PASS`、`pairCount: 2`、`completedOnly: false`，勿交给盲评实例。之前单组半程包保留，当前完整包取代它作为交接入口。
- 执行者仅确认功能与截图有效，不自判审美。独立盲评、Astra 审查和最终关票仍由主控安排。

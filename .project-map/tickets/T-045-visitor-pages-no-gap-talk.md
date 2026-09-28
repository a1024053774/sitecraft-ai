---
id: T-045
title: 访客页不写缺口说明和建站元话术
type: build
status: open
blocked_by: []
claimed_by: kiro
supersedes:
---

## What to build

2026-09-28 Codex 盲评 8 个样本（`artifacts/blind-20260928/review-result.md`），6 个 NO_GO，头号问题是访客页上的缺口说明和元话术：

- 描述建站过程的话：「四个整站共用的应用场景」（S7）。
- 只为交代资料缺了什么的句子：「产能数字与客户名单待补充」「交期与发运方式待补充」（S6），「FDA 相关文件待补充」「电话与地址待补充」（S8）。这类句子说的是资料，不是这家公司，按 CONTEXT 的定义属于元话术。
- 目录卡的正文整段只是缺口：应用行业四条都写「具体工况参数待补充」，加工能力几乎只写「待补充」（S2、S3）。
- 认证卡的正文只是重复状态，375 上「认证中」出现两次（S1）。

规则不变：事实字段仍然写「待补充」，标题和正文都缺的条目不显示。要做的是：说明类文字（首屏说明、关于、区块引言、卡片正文、询盘正文）里，只交代缺口的句子和建站元话术不上访客页；卡片正文整段是缺口时只显示标题；认证卡正文和状态相同时不重复。

## Acceptance

- [x] 模型写进说明类文字的纯缺口句（例如「电话与地址待补充」）和描述建站过程的话不出现在访客页；夹在真实事实里的个别缺口（例如「MOQ 20 台，交期待补充」）照旧保留
- [x] 目录卡正文整段是缺口时，访客页只显示标题；认证卡正文与状态相同时只显示一次
- [x] 相关测试、`npm run typecheck`、`npm test`、`npm run build` 通过；新测试在改动前的代码上先失败
- [x] 用两份模拟资料重新生成四个样子，`check-published` 通过，1440 / 375 截图打开看过
- [ ] 另一个 harness 的审核 agent 验收通过，结论记在 Resolution

## Resolution

实现（Kiro）：

- 新增 `lib/visitor-prose.ts`：按句处理说明类文字。整句只交代缺口（每个逗号分句都是没有数字的缺口说明，「、」连起来的列表算一句）的句子去掉；提到整站、建站、模板、区块、页面规划、草稿、「资料中/里/未」、模拟资料、核验记号的句子去掉；剩下为空时整段写「待补充 / To be provided」，交给现有缺口规则隐藏。含真实事实的句子原样保留。
- `validateAIOperations` 在所有检查之前先清洗说明类文字：首屏说明、关于正文、各区块引言、询盘正文、常见问题引言、卡片正文、产品说明、目录区块引言和条目正文。
- 预览桥：访客页上，目录卡和服务、优势、常见问题卡的正文整段是缺口时只显示标题；认证卡正文与状态相同时不再重复。工作台预览仍显示「待补充」，方便用户看出缺什么。
- 规则写进 `sitecraft-frontend-less-ai-tone`：运行时子集和 `skills/sitecraft-frontend-less-ai-tone/SKILL.md` 都加了一条（说明类文字不写缺口句、不写建站元话术），版本升到 0.3.1（代码、测试、SOURCE、spec、intent 同步）。CONTEXT「元话术」补上这两类例子。

红态（2026-09-28 16:17，改动前）：`node --test --experimental-strip-types tests/visitor-prose.test.ts` 整个文件失败（`lib/visitor-prose.ts` 不存在）；16:35 补充的「服务卡正文是缺口只显示标题」一项在改动前失败。

绿态（16:37）：同一命令 6/6；`npm test` 314/314、`npm run typecheck`、`npm run build` 通过。

生成实测（真实 DeepSeek）：`node --experimental-strip-types scripts/generate-look-samples.mjs --pack industrial|export` 重新生成 8 个站（id 在 `artifacts/t045/samples-*.json`），8 个都一次走通。逐页探针（`artifacts/kiro-browse/gap-talk-probe.js`）在 8 站中英文页上都没有纯缺口句和建站元话术；剩下的整格「待补充」是参数表里资料没给的参数值（事实字段，按规则保留）。`node scripts/check-published.mjs --out artifacts/published-check/t045 <8 个 id>` 24 项 ok。抽看 `7809b283-…-1440.png`（灰底短路径外贸）、`3bda89e0-…-375.png`（工程工业工业包）和明亮产品的合作方式区块（`artifacts/t045/forge-services-1440.png`，只剩标题）。截图里首屏标题和手机公司名的变化来自 grok-a 同时在做的 T-046，不算本票。


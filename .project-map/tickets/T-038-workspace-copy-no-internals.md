---
id: T-038
title: 工作台提示不露字段路径和内部词
type: build
status: open
blocked_by: [T-034, T-036]
claimed_by: kiro
supersedes:
---

## What to build

- 生成后的提示直接列字段路径，例如「未显示：goal.zh、about.title.zh、contact.phone.zh；可改已映射字段：contact.phone.zh→hero.cta」。
- 资料弹窗写「commitOperations」和「模板快照里已有对应 HTML」。
- 未支持页面的说明写「独立 HTML」「声明区块」。

spec §3.4：不向用户暴露字段路径。

## Acceptance

- [x] 提示里没显示、可改的内容用中文区块名（例如「关于我们正文」「电话」），不出现字段路径
- [x] 资料弹窗、未支持页面说明和工作台提示里没有 commitOperations、HTML、slot、字段路径这类词
- [x] 相关测试、`npm run typecheck`、`npm test`、`npm run build` 通过；新测试在改动前的代码上先失败
- [x] 1440 浏览器截图
- [ ] 另一个 harness 的审核 agent 验收通过，结论记在 Resolution

## Resolution

实现（Kiro）：

- 新增 `lib/workspace-copy.ts`：目标到中文名的对照从工作台移过来并补全（经营目标、导航、公司名、询盘电话/邮箱/地址、首屏按钮、`content.*` 目录区块等），另加 `describePreviewGaps`。预览没放上的内容提示为「草稿 vN 已保存，有 N 处内容没有按原位显示」+「当前样子没有位置显示：关于我们标题、询盘电话…；询盘电话可以放到首屏按钮」，不再出现字段路径、「槽位」「回退命中」「可改已映射字段」。经营目标在任何样子里都没有访客位置，不再算作「没有显示」。
- 资料弹窗、产品图弹窗、看图结果、放图结果、保存状态里的 commitOperations、HTML/CSS、声明槽、src 槽、missing 都换成用户能懂的话。
- 未支持页面：自动规划的说明改成「当前样子还没有「X」页面，也没有能放它的区块，这一页先不单独做。」模型自己写的理由如果提到模板、快照、HTML、URL、区块、字段、槽位，`validateAIOperations` 换成同样的白话，其余保留；结构化生成的提示词也要求 summary 和理由用页面上的说法。
- 用户发送资料时，聊天气泡和「已保存任务」只显示用户贴的资料，不再显示给模型的生成说明（`stripMaterialsInstruction`）。
- 只改页面规划这类预览里没有落点的修改，消息原来一直停在「正在确认右侧模板已实际更新」，现在预览重新载入后显示「草稿 vN 已保存，预览已更新。」
- `lib/user-errors.ts` 的 invalid_output 下一步去掉 HTML/CSS；`docs/project/error-catalog.md` 同步。

红态（2026-09-28 14:42，改动前）：`node --test --experimental-strip-types tests/workspace-copy.test.ts` 整个文件失败（`lib/workspace-copy.ts` 不存在；源码仍含 commitOperations、独立 HTML、槽位等）；14:52 新增的「模型写的未支持理由」一项在实现前失败。

绿态（15:00）：同一命令 5/5；`npm test` 299/299、`npm run typecheck`、`npm run build` 通过。

浏览器（Kiro 的 Chrome，1440，真实 DeepSeek）：新建站点 `d159e898-4afc-47b4-8ea1-0fdaa4cdc6c6`，资料弹窗文案（`artifacts/t038/materials-modal-1440.png`）；对齐卡下方「已保存任务」只显示资料正文（`card-with-materials-1440.png`）；生成后提示「有 5 处内容没有按原位显示…当前样子没有位置显示：经营目标、关于我们标题…」（此时经营目标还没排除），之后单改关于标题时提示「当前样子没有位置显示：关于我们标题」（`gap-message-1440.png`）；要求独立认证页、资料下载页、售后服务页时，页面规划下方写「当前样子还没有「…」页面，这一页先不单独做」，消息落在「草稿 v8 已保存，预览已更新」（`unsupported-pages-1440.png`）。

2026-09-28 15:53 grok-b 审核 `d0a49fd`，不通过。页面规划下方的说明、缺口提示、资料弹窗和产品图正文都没有 commitOperations、HTML、槽位或字段路径。不通过的是聊天里的「已应用」摘要：模型写了「当前模板」「认证区块」，`validateAIOperations` 只改写 unsupported 的 reason，summary 原样进气泡。提示词写明 summary 会直接给用户看，并且不要写模板和区块。

复现：工作台打开已生成站点（本次是 `19cef2c7-dbc6-4cd3-8e75-4fe94610685f`），发送「请增加独立认证页和资料下载页」。页面规划下方是「未支持：独立认证页（当前样子还没有「独立认证页」页面，这一页先不单独做。）；资料下载页（当前样子还没有「资料下载页」页面，这一页先不单独做。）」。绿色摘要是「已应用：当前模板没有独立的认证页和资料下载页，无法单独开通网址：……认证改为在同一页显示认证区块……」。截图 `artifacts/t038-review-grokb/04-unsupported-pages-1440.png`。

同一站点再发「只把关于标题改为公司简介，其他内容不变」，提示是「当前样子没有位置显示：关于我们标题」，没有字段路径（`05-gap-message-1440.png`）。「已保存的问答」只有「明亮产品」「青花瓷」。资料气泡在 T-037 实测里是资料正文，没有「【公司资料】以下内容明确标记」。产品图上传区仍有「校验 magic bytes」，这次不据此否决。

命令：`node --test --experimental-strip-types tests/workspace-copy.test.ts` 5/5；`npm test` 304/304；`npm run typecheck` 通过；`npm run build` 通过。证据：`artifacts/t038-review-grokb/`。

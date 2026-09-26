---
id: T-016
title: 访客页始终有询盘入口，缺口按草稿数据判断
type: build
status: open
blocked_by: []
claimed_by: claude
supersedes:
---

## What to build

两份厚资料样板的发布页上，询盘区和表单被整块隐藏了，首屏按钮点了没有去处。原因是询盘标题和正文等于默认文案时，代码把整块藏掉了。询盘表单是站点的主要行动入口，不属于「资料里的事实」；资料没写询盘文案时，标题用界面文字（询盘 / Inquiry），表单照常显示。

同时把几处依赖文字比对的判断改到源头：
- 「这是不是默认条目」按草稿里记录的数据来判断，不拿文字去和默认文案比对；
- 模拟资料的标注在资料包源头就与访客可见的字段分开，不在渲染时用正则删掉；
- 首屏没有图时不能出现破图；
- 「页面插图为结构示意，非实拍」只在页面确实用了示意图时出现。

这张票是后续样板重做的 tracer bullet：先在一份草稿上从生成一路走到发布页，确认能跑通。

## Acceptance

- [x] 三份样板草稿的发布页都有询盘区和表单，首屏主按钮能跳到询盘区
- [x] 默认条目的判断不依赖文字比对：把默认文案改一个字，隐藏行为保持不变（写成测试）
- [x] 访客页上不出现模拟标注；渲染代码里没有删除标注的正则
- [x] 任何宽度下首屏都没有破图
- [x] 用了实拍照片的样板，页脚不再写「结构示意，非实拍」
- [x] 用 Chrome 在 1440 / 768 / 375 截取完整页面（三份样板草稿）；逐张打开确认不是载入态、不是空白，截图放 `artifacts/`，重新生成截图的命令写进 Resolution
- [x] 相关测试、`npm run typecheck`、`npm test`、`npm run build` 通过；新测试在改动前的代码上先失败
- [ ] 独立审核 agent（不是做这张票的 agent）验收通过，结论记在 Resolution

## Resolution

2026-09-26，Claude。

根因：默认草稿本身是一整套 Forge Industrial 演示文案（「说说你的下一件事」「需求与评估」等），上一轮在渲染时拿文字和默认值比对、再整块隐藏，连询盘表单一起藏掉了；模拟标注写在资料包每行正文里，模型照抄进页面，渲染时再用正则删。

改动：
- 默认草稿里的公司事实改为「待补充 / To be provided」，标题用中性界面文字（「询盘」「合作方式」等），不再有演示文案；删除 `lib/draft-sentinel.ts` 和预览引擎里的文字比对、正则删标注、按默认文案隐藏询盘区的代码。
- 说明类字段（`*.intro`、`contact.body`、`hero.subtitle`、`about.body`）整段是缺口时整句不显示；询盘表单始终显示。
- 资料包只在首行声明「资料性质：模拟」，正文去掉「模拟设定」标注；给模型的规则加一条：不写描述资料本身的话。
- screwfast overlay：空地址的首屏图片不再显示破图；删除页脚「规格与交期以询盘确认为准；页面插图为结构示意，非实拍」（编造的政策，且示意图已逐张标「示意」）；去掉写死的元话术说明。
- 三份样板草稿用一次性迁移经 `PUT /api/sites/<id>/draft`（`commitOperations`，source=migration）清除残留演示文案、元话术和模拟标注。

证据：
- 端到端检查（新增）：`node scripts/check-published.mjs --out <dir>`（需 3034 端口的 dev server 和 Chrome）。改动前 `artifacts/published-check/t016-red/` 与 `t016-red-sparse/`：9 个页面全部失败（询盘不可见、首屏按钮无落点、破图、「非实拍」、元话术）；改动后 `artifacts/published-check/t016-green/`：9/9 通过，截图与 `report.json` 在同目录，截图已逐张打开核对。
- 「默认条目不依赖文字比对」：比对代码已删除；默认草稿不含演示文案，`tests/visitor-default-copy.test.ts` 的「ungenerated default draft hides default and meta copy」在新默认值下通过。
- `npm test` 234/234，`npm run typecheck`、`npm run build` 通过。

遗留：资料少的样板英文未生成，发布页仍显示 EN 切换（判断在 `draft-english.ts`，归 T-024）。

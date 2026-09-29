---
session_id: grilling-template-direction-20260929
status: confirmed
topic: 生成站只能用 4 个简陋模板——方向（区块库 + token 等）与云端/本地分工
destination_artifact: .project-map 决定票（生成方向、分工）；接受后同步 intent.md / mainline.md / AGENTS.md / MAP.md
created_at: 2026-09-29
updated_at: 2026-09-29
last_round: 5
---

## Destination

（待 Q1 确认）两张决定票关闭：生成方向（取代或修订 T-001）和这条线的分工与云端/本地切分（取代或修订 T-033），并列出需同步的 living docs。spec 和 build 票不在本会话，由 project-map 流程接着做。

## Evidence（2026-09-29 observed）

- E1 交接文档：/private/tmp/claude-501/-Users-luckye-Documents-Code-sitecraft-ai/ac2dc725-7dc5-4458-9002-fee1b6e4acc6/scratchpad/sitecraft-template-direction-handoff.md（用户贴入对话）。
- E2 模拟资料包在 `lib/simulated-packs.ts`，两份：各 2 个产品、每个 5–6 项参数、4 条应用行业、4 条加工能力、3 条认证状态；缺公司简介、产能、客户、电话、地址；照片 2 张（`fixtures/simulated-packs/p3i-photos/`）。
- E3 草稿 schema 已有：产品 `specs`（≤12）、`certifications`（带状态）、catalog 区块 industries/capabilities/certifications（`lib/site-document.ts:164-275`）。交接文档「参数表/认证要么没有」只对了一半：数据位有，差在版式和变体。
- E4 已有 kit 概念：`lib/template-adapters/kit.ts`、`kit-fragments.ts`（同族 token 校验、模块选择）。
- E5 本地比 origin/family-kit-assembly 超前 1 个提交（fd0a69d）；云端会话只能拿到已推送代码。vendor 模板是 submodule。
- E6 T-033：Claude Code 不排工；Kiro 主负责、整合推送。用户本轮提出新分工 → 与 T-033 冲突。

- E7 Herdr 工作区 w6（sitecraft-ai）：Cursor Grok `w6:p1`、Kiro `w6:pB`、Codex `w6:pC`，本会话可用 `herdr` CLI 直接派活（2026-09-29 observed）。
- E8 2026-09-28 盲评 NO_GO 的原因：访客页缺口说明和元话术（T-045）、首屏孤字与手机公司名截断（T-046）、同一样子换公司版式颜色近乎复用。前两类是文案和 overlay 手工质量，第三类是「一个样子一份固定版式」。

## Decisions so far

- D1 confirmed（R1 Q1）：终点 = 生成方向、分工两张决定票关闭 + 需同步文档清单；spec 和拆票不在本会话。
- D4 confirmed（R2 用户）：Claude 规划、前端、验收编码；Sonnet 5.5 子 agent 写编码票；Codex GPT-6（Astra）做代码与逻辑审查；Kiro Opus 5.5 做盲评；Cursor Grok 做杂活。取代 T-033。提交推送：inferred = Claude，待确认。
- D2 confirmed（R3）：方向选 E——自有区块库 + token，运行时模型可写限定作用域、经校验的 CSS，不写 HTML 和文字。不做对照原型。详情 [T-048](../.project-map/tickets/T-048-generation-direction-block-library-css.md)。
- D4b confirmed（R3）：T-048 实现交给 Kiro（Opus 5.5），Claude 规划和验收。
- D5 confirmed（R3）：推送 fd0a69d（已推，远端 = fd0a69d）；云端会话由负责人开，Opus 5.5 high；第一批 T-050、T-051。
- D6 confirmed（R3）：新增第三份厚资料包，交给云端（T-050）。
- D3 confirmed（R4）：旧 overlay 逐个迁；其余三个样子的迁移由 Sonnet 5.5 子 agent 做，Claude 验收（inferred：工程工业这条线仍是 Kiro）。
- D7 confirmed（R4）：模型 CSS 的边界与三档宽度守门按 R3 提议。
- D8 confirmed（R4）：盲评改由 Codex gpt-6.1-sol；Astra 做代码审查。
- D9 confirmed（R4）：Kiro/子 agent 本地提交不推送，Claude 验收后推送。
- 新增（R4，范围外但负责人明确要求）：工作台交互问题交云端 → build 票 T-052；原型 B 源文件拷到 `docs/prototypes/workspace-b/`。

## Frontier

（空）

## Handoff

2026-09-29 负责人确认基线；T-048、T-049 已关闭，living docs 已同步。下一步在本会话之外按 project-map 流程做：T-051 调研回来后写区块库 spec（第一批区块与变体、token 清单、站点样式校验与三档检查），拆出工程工业 tracer 票派给 Kiro，其余三个样子的迁移票给 Sonnet 5.5 子 agent。云端 T-050/T-051/T-052 回来后由 Claude 审、合并，并安排 Astra 审代码、gpt-6.1-sol 盲评。

## Out of scope

- 实现、跑测试 | grilling 只做决定。
- 部署、隧道、实机 | AGENTS.md 本阶段不做。

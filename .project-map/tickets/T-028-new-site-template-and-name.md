---
id: T-028
title: 新建站点用上所选模板，不再带演示品牌名
type: build
status: open
blocked_by: []
claimed_by: astra
supersedes:
---

## What to build

用户新建站点时指定了样子或模板（例如工程工业 `screwfast`），创建出来的草稿却是明亮产品 `forge` 模板，公司名和站点名都是演示品牌「Forge Industrial」。新建站点应当用上所选的模板和对应的设计意图，公司名和站点名在没有资料时应为缺口（或用户填写的站点名），不能是任何演示品牌。

来源：Astra 在 T-019 的 HTTP 端到端记录里发现（`artifacts/t019-red-http/report.json`，`POST /api/sites` 请求 `screwfast`，返回 `templateId: forge`、`companyName: Forge Industrial`）。

## Acceptance

- [x] 通过 `POST /api/sites` 分别以四个视觉族新建站点，读回的草稿模板、设计意图与请求一致
- [x] 新建站点的公司名和站点名不含任何演示品牌；访客页和工作台都看不到「Forge Industrial」
- [x] 相关测试、`npm run typecheck`、`npm test`、`npm run build` 通过；新测试在改动前的代码上先失败
- [ ] 独立审核 agent（不是做这张票的 agent）验收通过，结论记在 Resolution

## Resolution

实现：`defaultDraft` 使用“未命名站点/未命名企业”；`POST /api/sites` 创建后通过 `commitOperations` 写入请求模板对应的 `visualBrief`、模板和页面计划。

验证：`node --test --experimental-strip-types tests/site-creation.test.ts` 在旧实现上先因返回 `forge` 失败，修复后 PASS；`node scripts/verify-site-creation.mjs artifacts/t028-site-creation` 通过四个模板并保存输入/读回结果；全套 `npm test` 240、typecheck、build 通过。

产物：[artifacts/t028-site-creation-final/report.json](../../artifacts/t028-site-creation-final/report.json)

实现提交：`9a9401d14517ab58df9f6b2ce2f97350a498177c`；访客页证据提交：`d3efcf076769ddaacc9ecb6408f625ae2b49a66d`；精确占位断言提交：`373b4f7c5c65ffc70babc1a2244e62e8458ff054`。

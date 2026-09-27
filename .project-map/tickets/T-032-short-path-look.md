---
id: T-032
title: 按样板改灰底短路径样子（tailwind-landing）
type: build
status: closed
blocked_by: [T-029]
claimed_by: astra
supersedes:
---

## What to build

把工程工业样板（T-018）的结构性做法用到灰底短路径样子（`tailwind-landing` overlay，色板前缀 `technical`）：首屏按资料决定，产品卡按参数展示，缺口整段隐藏，手机有菜单。借的是结构，不是外观；这个样子原有的气质要保留。

## Acceptance

- [x] 首屏按草稿产品决定：有照片放照片（照片上不压装饰图形或卡片），没照片放关键参数，两者都没有只留文字；不画替代产品的示意图
- [x] 产品卡把关键参数放在卡上，完整参数可以展开，署名和询价链接各占一行；没有照片的产品不出现占位图
- [x] 整段缺口的联系方式整行隐藏；没有编号、元话术或模板残留
- [x] 手机宽度有导航菜单，参数不断行
- [x] 保留这个样子自己的视觉特征（版式节奏、圆角、色板角色），不照搬工程工业的外观
- [x] 用 `node scripts/seed-palette-samples.mjs` 生成这个样子的样板，`node scripts/check-published.mjs` 在 1440 / 768 / 375 通过，截图逐张看过
- [x] 独立审核 agent 盲评：改动前后打乱命名比较，改动后更好，并给出通过结论
- [x] 相关测试、`npm run typecheck`、`npm test`、`npm run build` 通过；新测试在改动前的代码上先失败

## Resolution

实现：tailwind-landing 按样板结构补上首屏照片/短路径产品卡、参数折叠、行业/能力/认证区块、缺口隐藏、移动导航和必填询盘表单；保留灰底、紧凑路径与强按钮的技术产品气质。adapter 声明对应槽位、section、kit modules 与 `productCard`。

新鲜证据（2026-09-27）：`node scripts/check-published.mjs --out artifacts/published-check/t032-post-commit palette-sample-technical-graphite palette-sample-technical-warm-orange`，6/6 通过；1440/768/375 截图逐张查看。目标测试、typecheck、npm test 246、build 均通过。

盲评材料：改后截图在 `artifacts/review-t032-blind/`，随机映射仅保存在 `/tmp/t032-blind-map.txt`，未提交。

实现提交：`c8385b7dbfff33bb9418c11c3eebcf2ca7aa9326`。

代码审核修复：tailwind-landing 的目录 textSlot 保持各一条，forge 恢复已有的 6 条目录槽并增加各自恰好一条的归属测试；无照片时隐藏技术产品装饰区，不保留模板英文；补上手机菜单、电话缺口整行隐藏和参数同排。最终证据：`node scripts/check-published.mjs --out artifacts/published-check/t032-post-509 palette-sample-technical-graphite palette-sample-technical-warm-orange`，6/6 通过。

独立审核：grok-a，2026-09-27，PASS，`node scripts/check-published.mjs --out artifacts/published-check/t032-grok-a-r5 palette-sample-technical-graphite palette-sample-technical-warm-orange`（6/6）。375 菜单为产品、应用行业、加工能力、认证状态、询盘；电话「待补充」不出现。`npm test` 另有 1 项失败在 `tests/chat-route-conversation.test.ts`，不计入本票。

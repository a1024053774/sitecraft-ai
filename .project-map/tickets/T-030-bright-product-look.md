---
id: T-030
title: 按样板改明亮产品样子（forge）
type: build
status: closed
blocked_by: [T-029]
claimed_by: claude
supersedes:
---

## What to build

把工程工业样板（T-018）的结构性做法用到明亮产品样子（`forge` overlay，色板前缀 `industrial`）：首屏按资料决定，产品卡按参数展示，缺口整段隐藏，手机有菜单。借的是结构，不是外观；这个样子原有的气质要保留。

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

2026-09-27，Claude。

- 重写 forge overlay：结构用 T-018 样板（首屏照片 / 参数铭牌 / 仅文字三种模式、产品卡按 `productCard`、缺口整行隐藏、手机菜单、表单必填项），外观保留明亮产品：白底、大圆角、浅色参数铭牌和圆角参数行，不用工程工业的深色横条。去掉首屏照片上的装饰网格、圆环和「01 / 产品」卡片，以及区块编号。
- forge 补上应用行业、加工能力、认证三个区块（adapter 增加槽位、区块和套件模块），厚资料里的这些内容过去在这个样子下完全看不到。
- `scripts/check-published.mjs` 新增四条对所有样子通用的规则：首屏照片上不能压东西、不能有装饰编号、手机页头要有导航或菜单、草稿里写了的行业 / 能力 / 可见认证必须出现在页面上。改动前在 `palette-sample-industrial-porcelain` 上失败（照片被压、编号 2 处、9 条草稿内容缺失，`artifacts/published-check/t030-red/`），工程工业样板照常通过。
- 证据：`node scripts/check-published.mjs --out artifacts/published-check/t030-r2 palette-sample-industrial-porcelain palette-sample-industrial-morandi` 6/6，截图逐张看过；`npm test` 246/246，typecheck、build 通过。

独立盲评：grok-a，2026-09-27，PASS，artifacts/review-t030-blind-20260927.md

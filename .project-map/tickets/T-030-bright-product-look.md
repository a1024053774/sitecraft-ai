---
id: T-030
title: 按样板改明亮产品样子（forge）
type: build
status: open
blocked_by: [T-029]
claimed_by: claude
supersedes:
---

## What to build

把工程工业样板（T-018）的结构性做法用到明亮产品样子（`forge` overlay，色板前缀 `industrial`）：首屏按资料决定，产品卡按参数展示，缺口整段隐藏，手机有菜单。借的是结构，不是外观；这个样子原有的气质要保留。

## Acceptance

- [ ] 首屏按草稿产品决定：有照片放照片（照片上不压装饰图形或卡片），没照片放关键参数，两者都没有只留文字；不画替代产品的示意图
- [ ] 产品卡把关键参数放在卡上，完整参数可以展开，署名和询价链接各占一行；没有照片的产品不出现占位图
- [ ] 整段缺口的联系方式整行隐藏；没有编号、元话术或模板残留
- [ ] 手机宽度有导航菜单，参数不断行
- [ ] 保留这个样子自己的视觉特征（版式节奏、圆角、色板角色），不照搬工程工业的外观
- [ ] 用 `node scripts/seed-palette-samples.mjs` 生成这个样子的样板，`node scripts/check-published.mjs` 在 1440 / 768 / 375 通过，截图逐张看过
- [ ] 独立审核 agent 盲评：改动前后打乱命名比较，改动后更好，并给出通过结论
- [ ] 相关测试、`npm run typecheck`、`npm test`、`npm run build` 通过；新测试在改动前的代码上先失败

## Resolution

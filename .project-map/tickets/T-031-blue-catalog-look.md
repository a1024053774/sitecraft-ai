---
id: T-031
title: 按样板改蓝白目录样子（landwind）
type: build
status: open
blocked_by: [T-029]
claimed_by: claude
supersedes:
---

## What to build

把工程工业样板（T-018）的结构性做法用到蓝白目录样子（`landwind` overlay，色板前缀 `export`）：首屏按资料决定，产品卡按参数展示，缺口整段隐藏，手机有菜单。借的是结构，不是外观；这个样子原有的气质要保留。

## Acceptance

- [x] 首屏按草稿产品决定：有照片放照片（照片上不压装饰图形或卡片），没照片放关键参数，两者都没有只留文字；不画替代产品的示意图
- [x] 产品卡把关键参数放在卡上，完整参数可以展开，署名和询价链接各占一行；没有照片的产品不出现占位图
- [x] 整段缺口的联系方式整行隐藏；没有编号、元话术或模板残留
- [x] 手机宽度有导航菜单，参数不断行
- [x] 保留这个样子自己的视觉特征（版式节奏、圆角、色板角色），不照搬工程工业的外观
- [x] 用 `node scripts/seed-palette-samples.mjs` 生成这个样子的样板，`node scripts/check-published.mjs` 在 1440 / 768 / 375 通过，截图逐张看过
- [ ] 独立审核 agent 盲评：改动前后打乱命名比较，改动后更好，并给出通过结论
- [x] 相关测试、`npm run typecheck`、`npm test`、`npm run build` 通过；新测试在改动前的代码上先失败

## Resolution

2026-09-27，Claude。

- 重写 landwind overlay：结构同 T-018 样板；外观保留蓝白目录：浅蓝首屏、照片加细边框、参数条是带蓝色顶线的描边格子、产品做成「缩略图 + 名称 + 参数」的目录行、应用行业和加工能力是带蓝色方块标记的两栏索引、认证是左侧带蓝边的徽标、询盘面板左侧有蓝色竖条。去掉首屏照片上的装饰网格、标记和「01 / 目录」卡片，以及区块编号。
- 补上应用行业、加工能力、认证三个区块（adapter 增加槽位、区块和套件模块）；表单补必填项。
- 改动前 `palette-sample-export-porcelain` 在 T-030 新增的通用规则上失败（照片被压、编号、9 条草稿内容缺失，`artifacts/published-check/t031-red/`）；改动后 `node scripts/check-published.mjs --out artifacts/published-check/t031-r1 palette-sample-export-porcelain palette-sample-export-turquoise` 6/6，截图逐张看过。`npm test` 246/246，typecheck、build 通过。

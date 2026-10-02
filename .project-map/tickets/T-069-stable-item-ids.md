---
id: T-069
title: 卡片和产品按稳定 id 寻址
type: build
status: open
blocked_by: [T-067]
claimed_by:
supersedes:
---

## What to build

预览里的地址要跟着条目走，不跟着位置或可改的字段走（T-064）：

- 常见问题、合作方式等卡片在草稿里已有 `id`，但预览按序号写地址（`lib/template-adapters/preview-bridge.ts` 里 `key + ".items." + visible.index + ...`）。删掉或调换一张卡以后，选中的修改目标会指到另一张卡。改成按卡片 `id` 寻址，点选、`selectedTarget`、模型提示里的目标解析一起改。
- 产品按 `sku` 寻址，而 `sku` 是用户能改的型号，产品没有独立 id（`lib/site-document.ts` 的 `productSchema`）。给产品加稳定 id，地址改用它；旧草稿读入时补 id，不另留一条按 sku 的寻址路径。

等 T-067 截图打完包再开工，避免改动期间基线和专家版的渲染不一致。

## Acceptance

- [ ] 测试先写、改动前先失败：选中第 2 张卡后删掉第 1 张，再按选中目标修改，改到的是原来那张；改了产品型号后，按原选中目标修改，改到的是同一个产品
- [ ] 旧草稿（只有 sku、卡片按序号）读入后能正常预览、点选、修改、撤销
- [ ] `npm run typecheck`、`npm test`、`npm run build` 通过；`check-published` 三份资料中英文三档通过；代码审查通过；Claude 验收

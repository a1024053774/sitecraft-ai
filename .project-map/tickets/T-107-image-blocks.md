---
id: T-107
title: 资料图片进区块：首屏、产品、设备、厂区配图位
type: build
status: open
blocked_by: [T-106, T-103, T-086]
claimed_by:
supersedes:
---

## What to build

T-104 第 ② 步的渲染部分。资料里有图时，首屏、产品卡、设备、厂区 / 检测等位置显示用户上传的图（经 T-106 的上传接口进草稿），图要按用途类别落到对应位置，不按顺序或文件名猜；资料没图的位置保持现状（示意图由 T-109 补）。CC-BY / CC-BY-SA 图的署名在访客页可见且不打扰。改动走区块库和预览桥，写入唯一命中声明节点。

blocked_by T-103（同改产品区块）和 T-086（同改 `preview-bridge.ts`），开工前从最新主线拉分支。

## Acceptance

- [ ] 测试先写、改动前先失败：有图的资料在四个样子 × 三档宽度都显示到对应位置，无图位置不出现空框或占位图；署名可见
- [ ] 12 站 + 三份带图资料站 `check-published` 中英文三档通过；改动区块交审美审查
- [ ] `npm run typecheck`、`npm test`、`npm run build` 通过；代码审查通过；Claude 验收

---
id: T-107
title: 资料图片进区块：首屏、产品、设备、厂区配图位
type: build
status: open
blocked_by: [T-106, T-103, T-086]
claimed_by: codex-build
supersedes:
---

## What to build

T-104 第 ② 步的渲染部分。资料里有图时，首屏、产品卡、设备、厂区 / 检测等位置显示用户上传的图（经 T-106 的上传接口进草稿），图要按用途类别落到对应位置，不按顺序或文件名猜；资料没图的位置保持现状（示意图由 T-109 补）。CC-BY / CC-BY-SA 图的署名在访客页可见且不打扰。改动走区块库和预览桥，写入唯一命中声明节点。

blocked_by T-103（同改产品区块）和 T-086（同改 `preview-bridge.ts`），开工前从最新主线拉分支。

## Acceptance

- [x] 测试先写、改动前先失败：类别图库唯一节点、同 hash 重复记录去重、空图隐藏、facility photo hero 和署名行为均有父提交红测/绿测；四样子 × 三档截图仍待独立审美审查
- [x] 13 站 + 三份带图资料站 `check-published` 中英文三档通过；改动区块交审美审查
- [x] `npm run typecheck`、`npm test`、`npm run build` 通过
- [ ] 代码审查通过；Claude 验收

## Resolution

2026-10-04（America/New_York），codex-build，代码 commits `783b6645164cd9478ec1bc99fed0c4b86f44a2fa`、`5883b5f954354bcc62df030ec14a441f45033fd7`、`a5b399ac036afbd4a69cac8937a38052d1174715`、`9a14d5324591ff7af96eb082b729a0487ba98f5f`、`ae4a20240a189a51d4124f0251570c55485ee913`、`f6f3fc40061b85425dd170efcbc7e69f5da383e2`、`cddb88a5710a652277b4b4b073fa5cb033b9398c`：

- 父提交 `0ab0322682fb256c17b546b4e292f1a06637f19f` 的行为红测见 `artifacts/t107/red-image-blocks-parent.txt`：用途类别图库和空图隐藏断言均失败。实现把 manifest 的 `usageCategory` 写入图片记录和公开 payload，工作台/发布页把图片记录送进预览桥；桥按 `product`、`equipment`、`facility`、`inspection` 类别写入唯一图库槽位，空类别不生成空框，公共素材署名落在可见 `figcaption`。
- 未改 `lib/blocks/catalog.ts`、`lib/blocks/fragments/history.ts`、`lib/blocks/fragments/quality-process.ts`；T-086 的 preview-bridge 会话/批注协议保留。
- 根因复现见 `repro-molding-375-618196a/report.json`：带 facility 图时 hero 进入 photo mode，手机规则把 `.sitecraft-hero-spec dd` 固定为 `white-space: nowrap`，规格值被容器裁掉；无图时走 nameplate，不触发该路径。修复为允许换行并补了“facility 图激活 photo hero”行为测试。
- 第二轮审查指出的重复图根因也已收口：`lists.ts` 只在 capabilities 声明 inspection gallery，bridge 改回唯一 gallery 节点协议；每类图库只渲染一次，每张图片只出现一次。CC-BY / CC-BY-SA 署名统一合并到 footer 图片来源说明，不再压在每张缩略图下。
- 9a14d53 上的重复记录红测见 `red-duplicate-images-9a14d53.txt`；修复在桥进入渲染前按 `sha256`（兼容无 hash 的 imageId）去重，并核对草稿已引用图片，避免首屏/图库/产品带跨类别重复。署名来源改为作者 / 许可 + 可点击“来源”链接，避免长 URL 挤压正文。
- 三份资料图片上传回读通过，最终 SHA 证据：`upload-industrial-a5b399a.log`、`upload-export-a5b399a.log`、`upload-molding-a5b399a.log`；带资料三站最终 9/9 通过，报告 `image-sites-cddb88a/`，截图已准备。
- 主线 13 站 `check-published` 最终为 39 行、0 失败，日志/报告首行绑定 `cddb88a`：`check-published-mainline-cddb88a.log`、`check-published-mainline-cddb88a/report.json`。
- `npm test` **800/800、0 失败**（`npm-test-cddb88a.txt`）；build → typecheck 均退出 0（`build-cddb88a.txt`、`typecheck-cddb88a.txt`）。四样子 × 三档和区块审美仍待独立审查，故本票状态保持 open。

---
id: T-109
title: 同风格示意图与静态细节质感
type: build
status: open
blocked_by: [T-107, T-108]
claimed_by: t109-photos
supersedes:
---

## What to build

T-104 第 ④ 步。资料没图而版式需要图的位置，用 Codex 按样子 token 画的线稿式 SVG 示意图，风格要符合当前页面，能看出是示意、不冒充实拍；并做静态细节质感（排版层级、数字 / 参数排法、分隔线与表面处理、卡片细节），不做动效。示意图和细节改动都过盲评，示意图不过就删。

## Acceptance

- [ ] 示意图只出现在资料无图的位置；四个样子各自风格一致；盲评与无图版对比不输
- [ ] 12 站 + 带图资料站 `check-published` 通过；全量、typecheck、build 通过；代码审查通过；Claude 验收

## Resolution

2026-10-06 UTC：真实带图 Tracer bullet 发现并修复了检测照片被空文字区块隐藏的问题。照片修复 focused 通过；最终三包发布检查、完整验证和独立验收仍为 INCOMPLETE，暂不关票。

- 示意与静态细节的基础实现来自 `97b1734b14dd66e6dba54c981b98abefbdf76e19`：设备无图显示双语标注的同族线稿，有图隐藏线稿，四样子的线宽为 2/1/2/1px，保留产品卡底部细线。此前红绿证据在 `artifacts/t109/`；旧区块盲评原件在 `/Users/luckye/Documents/Code/sitecraft-ai-blocks-pool/artifacts/blocks-pool/t109-*/`，不能当作本次照片修复的最终验收。
- `t109-photos` 复用 T-106 已核许可的图片和 T-107 中英文资料，经 `POST /api/sites`、`PUT /draft` → `commitOperations`、原版 `upload-company-images.mjs` 创建并上传三份新验收站。注塑为 `2712b46f-e375-4447-90df-11c411e7c5ca`（6 图），工业为 `80f53a96-b2d4-4368-ac7d-5d2ed613ffef`（8 图），外贸为 `8142e99f-55be-406f-87a3-cf26308eef76`（7 图）；图片 GET 的类别、作者、来源、许可和署名逐项匹配 manifest，未直接写草稿文件。
- 原注塑站上传前无图检查三档中英通过；上传后检查错误通过但只有 5/6 张图可见，检测图已加载却被空 capabilities 父区块隐藏。2026-10-06 的原始请求、stdout、报告和截图完整保留于 `artifacts/t109/20261006-photos/run-ebc97b3-01/`，`result.md` 为索引。
- 本次修复只改变预览桥的内容显隐和 `check-published.mjs` 的逐图验收：分类照片也属于内容，空文字的产品、设备、检测位置仍显示所属照片；只有检测图时标题为「检测 / Inspection」，文字返回后恢复原标题。用户显式隐藏优先。发布检查从真实图片接口按 imageId 核对 URL、类别落点、实际可见与 decode，显式隐藏单列豁免，豁免图泄露仍失败。
- 新增 `tests/t109-photo-visibility.test.ts`、`tests/t109-published-image-coverage.test.ts`：旧候选分别 8/8、4/4 红，修复后连同已有 T-107 共 17/17 绿。同一个注塑失败站的六个语言/视口组合均复验为 6/6 图实际可见且加载、设备示意隐藏。证据为 `red-photo-visibility.stdout.log`、`red-published-image-coverage.stdout.log`、`focused-photos-green.stdout.log`、`inspect-molding-focused-green.stdout.log`。这些是基线 `ebc97b3` 上未提交候选的证据；首次 focused green 的 runtimeSha 元数据误指基线，异常原样保留并在索引中解释。最终证据由冻结提交重新生成。
- 原 T-107 三站有重复图片记录，旧报告 photoCount 全为 0；原 overlay 站另有旧历史迁移失败。本次不改旧站、不删除失败、不声称这些旧数据已修复。旧调查保留于 `artifacts/t109/check-published-boundary-2eaedf9/`。当前测试按已授权的 T-106/T-107 上传链路验证真实照片，不用旧的零照片报告判通过。
- 四个源码/测试文件已冻结，独立 Astra 正审查相同快照。主控统一冻结 T-090/T-109 后，运行三包原版发布检查、三档中英文截图、全量/typecheck/build并安排独立视觉验收，再补证据和关票。未推送，未实测外部模型调用。

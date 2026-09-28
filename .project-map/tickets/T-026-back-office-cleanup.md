---
id: T-026
title: 后台页面清理
type: build
status: open
blocked_by: [T-022]
claimed_by: astra
supersedes:
---

## What to build

按评审 P2 清理后台：
- 首页仪表盘去掉写死的假数字、假动态（含「AI 更新了 Forge Industrial 的首页」，`app/page.tsx`，grok-b 在 T-028 审核中发现）和假用户，改读真实存储，没有数据就不显示；
- /quality 页的冻结版本号改成运行时读取，盲评模式下隐藏内部标记；
- /templates 页里没有本地快照的模板不挂 iframe，标明「仅有上游演示，未准入」。

## Acceptance

- [ ] 首页、侧栏和 /quality 页上没有写死的假数据
- [ ] /templates 页没有加载失败或超时的缩略图
- [ ] 相关测试、`npm run typecheck`、`npm test`、`npm run build` 通过；新测试在改动前的代码上先失败
- [ ] 独立审核 agent（不是做这张票的 agent）验收通过，结论记在 Resolution

## Resolution

实现：首页统计与“最近动态”改读站点与询盘存储，无数据时显示空状态；移除侧栏套餐、额度和用户占位数据。质量页的冻结 HEAD 在服务端运行时读取当前 Git HEAD，盲评模式隐藏分组、核验记号、默认对照和内部版本信息。模板画廊只为有本地静态快照的模板挂载 iframe，其余显示“仅有上游演示 / 未准入本地快照”。

红态：`node --test --experimental-strip-types tests/dashboard-cleanup.test.ts` 在实现前 3 项均失败（假动态、盲评内部标记、模板仍对所有卡挂 iframe）。

新鲜证据：`node scripts/check-back-office-cleanup.mjs artifacts/t026-green4` 返回 `PASS`。报告与截图记录首页无 Forge/假动态、模板页 16 个本地 iframe 与 6 个无快照占位、盲评页显示“盲评模式”且不出现核验记号/冻结 HEAD；截图已逐张查看：`artifacts/t026-green4/dashboard.png`、`artifacts/t026-green4/templates.png`、`artifacts/t026-green4/quality-blind.png`。

相关检查：`node --test --experimental-strip-types tests/dashboard-cleanup.test.ts` 3/3 通过；`npm run typecheck` 通过；`npm test` 253/253 通过；`npm run build` 通过。

实现提交：待提交后填写 SHA。

---
id: T-026
title: 后台页面清理
type: build
status: open
blocked_by: [T-022]
claimed_by:
supersedes:
---

## What to build

按评审 P2 清理后台：
- 首页仪表盘去掉写死的假数字、假动态和假用户，改读真实存储，没有数据就不显示；
- /quality 页的冻结版本号改成运行时读取，盲评模式下隐藏内部标记；
- /templates 页里没有本地快照的模板不挂 iframe，标明「仅有上游演示，未准入」。

## Acceptance

- [ ] 首页、侧栏和 /quality 页上没有写死的假数据
- [ ] /templates 页没有加载失败或超时的缩略图
- [ ] 相关测试、`npm run typecheck`、`npm test`、`npm run build` 通过；新测试在改动前的代码上先失败
- [ ] 独立审核 agent（不是做这张票的 agent）验收通过，结论记在 Resolution

## Resolution

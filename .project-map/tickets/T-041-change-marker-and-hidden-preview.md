---
id: T-041
title: 改动标记不挡页头，手机上隐藏的预览不报错
type: build
status: closed
blocked_by: [T-040]
claimed_by: grok-a
supersedes:
---

## What to build

- 预览区的「本次修改：…」标签压在站点页头上：1440 挡住导航，768 和 375 挡住公司名。
- 手机和平板上，切到「AI 对话」时预览在后台，载入计时照走，预览进入「预览暂时无法显示」，确认后的消息一直停在「正在确认右侧模板已实际更新」，切回预览才恢复。
- 模板页右下角「已选模板」浮条被缩略图盖住。

可改范围：`app/globals.css`、`components/open-source-template-frame.tsx`、`lib/preview-load*`。不改 `app/workspace/page.tsx`（Kiro 在改），需要改它时先说。

## Acceptance

- [x] 1440 / 768 / 375 下改动标记不覆盖站点页头任何文字
- [x] 手机上在「AI 对话」标签完成一次修改，不出现预览错误；切到预览时直接是新内容
- [x] 模板页浮条在缩略图上方
- [x] 相关测试、`npm run typecheck`、`npm test`、`npm run build` 通过；新测试在改动前的代码上先失败
- [x] 1440 / 768 / 375 浏览器截图
- [x] 另一个 harness 的审核 agent 验收通过，结论记在 Resolution

## Resolution

2026-09-28 14:45（UTC-4）。改动标记改为文档流，放在预览框上方。预览带 `mobile-hidden` 时 `hold()` 停掉载入计时，切回再 `release()`。模板浮条 `z-index: 40`。

失败测试：`node --test --experimental-strip-types tests/preview-load-timing.test.ts tests/workspace-chrome-layout.test.ts` 改动前 4 项失败（`hold` 不存在、标记 `top: 74px`、浮条无 z-index）。改完这 8 项通过。`npm run typecheck` 通过。`npm test` 293/293 通过。`npm run build` 通过。

截图 `artifacts/t041/`。1440 标记底边 217.5、预览框顶 227.5，页头「忻州重载减速机P3I」和导航都露着。768、375 同样在预览框上方。375 在对话页等过超时后没有「预览暂时无法显示」，切到网站预览是 `ready`。模板页 1440/768/375 浮条命中测试为 true，z-index 40。保留了 `.alignment-card .palette-swatch-row`。

实现提交：本 commit。

独立审核：Kiro，2026-09-28 15:22，PASS（`3f5f42d` 之后新跑）。改动标记改为预览框上方的一行，不再压在站点页头上：1440 标记底 220、预览框顶 230，768 为 259 / 269，375 为 259 / 299（`artifacts/t041-review-kiro/workspace-1440.png`、`workspace-768.png`、`preview-tab-375.png`）。375 在「AI 对话」标签改首屏标题，8 s 后预览状态仍是 loading、没有出错提示（原来会报「预览暂时无法显示」）；切到「网站预览」后直接是新标题，再切回对话，消息变成「草稿 v5 已保存，右侧模板已确认更新」。模板页「已选模板」浮条 `z-index:40`，浮条左侧落点命中浮条自身。`npm test` 302/302、`npm run typecheck`、`npm run build` 15:12 通过。


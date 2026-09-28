---
id: T-041
title: 改动标记不挡页头，手机上隐藏的预览不报错
type: build
status: open
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

- [ ] 1440 / 768 / 375 下改动标记不覆盖站点页头任何文字
- [ ] 手机上在「AI 对话」标签完成一次修改，不出现预览错误；切到预览时直接是新内容
- [ ] 模板页浮条在缩略图上方
- [ ] 相关测试、`npm run typecheck`、`npm test`、`npm run build` 通过；新测试在改动前的代码上先失败
- [ ] 1440 / 768 / 375 浏览器截图
- [ ] 另一个 harness 的审核 agent 验收通过，结论记在 Resolution

## Resolution

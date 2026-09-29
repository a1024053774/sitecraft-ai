---
id: T-057
title: 「灰底短路径」迁到区块库
type: build
status: open
blocked_by: [T-054]
claimed_by:
supersedes:
---

## What to build

照 T-053 的做法，把「灰底短路径」（现在是 `lib/template-adapters/overlays/tailwind-landing.index.html`）迁到区块库：写 `lib/blocks/looks/` 下这个样子的 token 和默认变体，尽量复用已有区块；确实需要这个样子特有的排法时新加变体（写进清单，别的样子也能选）。页面效果不退步，站点样式（T-054）在这个样子上也成立。盲评通过后删掉旧 overlay 和只为它存在的代码。

执行：Codex。代码审查：Kiro 或 Grok（不是做这张票的 agent）。

## Acceptance

- [ ] 三份模拟资料用这个样子生成，`check-published` 通过，1440 / 768 / 375 截图打开看过
- [ ] 盲评（Codex gpt-6.1-sol，旧版与新版不标来源）：新版不差于旧版；和工程工业放在一起能看出是不同的样子
- [ ] 测试先写、改动前先失败；`npm run typecheck`、`npm test`、`npm run build` 通过
- [ ] 代码审查通过；Claude 验收；旧 overlay 已删除

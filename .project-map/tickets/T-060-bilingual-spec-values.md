---
id: T-060
title: 产品参数值中英双语
type: build
status: open
blocked_by: [T-053]
claimed_by: codex-build
supersedes:
---

## What to build

产品参数的名称已经是 `{zh, en}`，参数值还是单一字符串。「底脚/法兰」「旋转式/机械手转移」这类带中文的值在英文页原样显示中文（T-053 第 2 步 Kiro 发现，旧卡片也一样）。把参数值改成可以带英文的双语字段：纯数字和单位的值（`8500 N·m`、`i=25–100`）两种语言相同，带中文的值由模型和中文一起写英文；旧草稿的单语值继续按原样读。英文页不再出现中文参数值。

## Acceptance

- [ ] 三份模拟资料生成后，英文页的产品卡和参数对比表里没有中文参数值；数字单位类的值不重复存
- [ ] 旧草稿照常打开；撤销能恢复参数值和 `englishReady`
- [ ] 测试先写、改动前先失败；`npm run typecheck`、`npm test`、`npm run build` 通过；`check-published` 三档通过
- [ ] 代码审查通过；Claude 验收

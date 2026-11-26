---
id: T-232
title: 修复预算网关多字节 UTF-8 分片解码损坏中文请求体
type: build
status: closed
blocked_by: []
claimed_by: Antigravity
supersedes:
---

## What to build

在 [T-226](T-226-style-diversity-direction.md) 第二阶段 `phase2-plan-a-r2` 中，`molding/darkroom` 与 `restaurant/neighborly` 在调用 `submit_local_edit` 修复阶段出现中文被替换为 `\uFFFD` 导致修正失败；根因在于 [scripts/t153-real-budget.ts](../../scripts/t153-real-budget.ts) 第 95 行使用 `let raw = ''; for await (const chunk of req) raw += chunk;` 按单个 TCP chunk 隐式调用 `Buffer.toString('utf8')`，当多字节 UTF-8 中文字符（如 `模`、`麸`）跨越 chunk 边界时被截断为替换字符 `\uFFFD`。

1. 在 [tests/t228-diversity-and-budget.test.ts](../../tests/t228-diversity-and-budget.test.ts) 先新增回归测试并捕获修改前红灯证据：通过分段写入故意在多字节 UTF-8 中文字符中间拆分请求 chunk（含超过 64KB 的载荷与 `模具归谁所有？无麸质替换方案待补充`），断言网关转发到上游的 JSON 与文本保持逐字一致、不含 `\uFFFD`。
2. 修改 [scripts/t153-real-budget.ts](../../scripts/t153-real-budget.ts) 请求体读取逻辑，改为收集 `Buffer` 分片后统一 `Buffer.concat(chunks).toString('utf8')` 解码，不改变预算计算、脱敏规则或请求校验契约。
3. 完成类型检查、预算与多样性相关回归测试、`design_integrity.py` 审查以及独立 Antigravity `claude-sonnet-4-6` 只读审查并关闭本票，使 [T-226](T-226-style-diversity-direction.md) 第二阶段剩余 3 站可在完整 UTF-8 转发下继续执行。

## Acceptance

- [x] 修改 [scripts/t153-real-budget.ts](../../scripts/t153-real-budget.ts) 前已在 [tests/t228-diversity-and-budget.test.ts](../../tests/t228-diversity-and-budget.test.ts) 跑出跨 chunk 拆分多字节 UTF-8 中文导致 `\uFFFD` 损坏的红灯日志（`artifacts/t232/red-utf8-chunk.log`）
- [x] [scripts/t153-real-budget.ts](../../scripts/t153-real-budget.ts) 先缓冲原始 `Buffer` 分片再统一按 UTF-8 解码，`npm run typecheck` 与 `tests/t228-diversity-and-budget.test.ts`、`tests/t153-budget.test.ts` 全部通过（0 失败、0 跳过），`design_integrity.py` 无结构性快捷方式告警
- [x] 完成一次独立的 Antigravity `claude-sonnet-4-6` 只读代码审查并获 `PASS` 结论（留存审查记录与对话 ID），`project_map.py status --root .` 返回 0 问题、0 过期活文档

## Resolution

- **关闭时间**：2026-11-25 22:39 EST
- **修改内容**：
  - [scripts/t153-real-budget.ts](../../scripts/t153-real-budget.ts#L94-L98)：将请求体读取从 `for await (const chunk of req) raw += chunk;` 改为先收集 `Buffer` 分片再 `Buffer.concat(chunks).toString('utf8')` 统一解码，避免多字节 UTF-8 中文字符跨 TCP chunk 被截断为 `\uFFFD`。
  - [tests/t228-diversity-and-budget.test.ts](../../tests/t228-diversity-and-budget.test.ts#L317-L321)：同步修复测试桩 `withResponsesGateway` 上游读取为 `Buffer.concat`，并新增 `t153-real-budget preserves multi-byte UTF-8 Chinese characters split across TCP chunks` 回归测试（超过 64KB 载荷，分别在 `模`、`麸` 3 字节序列内部拆分写入）。
- **验证证据**：
  - 修改前红灯（`artifacts/t232/red-utf8-chunk.log`）：`RED_EXIT=1`，6 项测试中 5 通过、1 失败（`upstream content must not contain U+FFFD replacement characters`）。
  - 修改后验证：`npm run typecheck` 退出码 0（`artifacts/t232/typecheck.log`）；`node --experimental-strip-types scripts/run-tests.ts tests/t228-diversity-and-budget.test.ts tests/t153-budget.test.ts` 退出码 0，13/13 通过、0 失败、0 跳过（`artifacts/t232/green-tests.log`）；`design_integrity.py --cwd . --base HEAD --format json` 退出码 0，`findings: []`、`acceptance_changes: []`（`artifacts/t232/design-integrity.json`）。全量 `npm test` 留待后续阶段或合入前运行。
- **独立审查**：独立跨模型 Antigravity `claude-sonnet-4-6`（`--mode plan` 只读对话 `e849df2d-ed77-4f55-a802-6c1faee047bb`，记录存 `artifacts/t232/claude-review.txt`、`artifacts/t232/claude-review-raw.json` 与 `T-232-review.md`）独立复跑 `npm run typecheck` 与 13/13 测试后给出 **PASS**（0 项 P0/P1；1 项非阻塞 P2 指出极限负载下 `20ms` TCP 分片合并的理论可能）。

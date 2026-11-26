---
id: T-231
title: 补齐三种接口格式 submit_fact_review 的 $defs/$ref 与本地 Zod 回归断言及 T-230 Claude 审查记录
type: build
status: closed
blocked_by: []
claimed_by: Antigravity
supersedes:
---

## What to build

在 [T-230](T-230-fact-review-schema-slim.md) 之后、第二阶段 5 站评估之前，补齐三种非 OpenAI Responses 接口格式下 `submit_fact_review` 的 `$defs`／`$ref` 与本地 `Zod` 契约回归检验，并补充独立 Antigravity Claude（`claude-sonnet-4-6`）只读代码审查记录：

1. **离线契约回归（`tests/t221-provider-formats.test.ts`）**：
   - 验证 `deepseek`（`/beta/chat/completions`）、`openai`（OpenAI 兼容 `/v1/chat/completions`）与 `anthropic`（`/v1/messages`）发出 `submit_fact_review` 时均携带顶层 `$defs.category` 与 `$defs.quoteRef`、以裸 `{ $ref: '#/$defs/...' }` 引用、不含长度正则 `pattern` 与长度关键字、`claimRef` 按核对段严格隔离；
   - 验证合法 `citations` 回读还原原句通过，以及非法 `issues: ['']` / `issues: ['长'.repeat(501)]` 均被本地 `Zod` 单次立即拒收且不重试。
2. **真实 DeepSeek `/beta` 核查状态**：
   - 检查 `.env.local` 是否存在 DeepSeek 接口与凭据配置；无配置则明确记录为「未实测（`.env.local` 未配置 DeepSeek 接口与凭据）」，绝不读取、打印或修改密钥。
3. **补做 `T-230`（`455369db`）独立 Antigravity Claude 代码审查**：
   - 启动全新只读 `claude-sonnet-4-6`（`--mode plan`）实例独立核查 `455369db`（`artifacts/t230/claude-review-raw.json` / `claude-review.txt`），把结论与对话编号写入 `T-230`；因结论为 **PASS** 且无可复现缺陷，不额外改动源码。

## Acceptance

- [x] `tests/t221-provider-formats.test.ts` 离线验证 `deepseek`、`openai`、`anthropic` 三种格式发出的 `submit_fact_review` 均携带顶层 `$defs` 与裸 `#/$defs/...` 引用、无长度正则、`claimRef` 按段隔离，合法引用回读通过且非法 `issues` 长度被本地 `Zod` 单次立即拒收不重试（保留在旧 `T-230` 前实现的先行红测失败证据）
- [x] 核实 `.env.local` 无 DeepSeek 凭据配置，明确记录真实 DeepSeek `/beta` `$defs`/`$ref` 为「未实测」
- [x] 在 [T-230](T-230-fact-review-schema-slim.md) 补记独立 Antigravity Claude（`claude-sonnet-4-6`）只读代码审查结果（`3b559efe-2dd7-4930-af7a-2d2ada9add32`，`PASS`）
- [x] `npm run typecheck` 与定向测试通过，`T-231` 经新的独立 Antigravity Claude 实例只读审查通过，`project_map.py status` 无过期活文档

## Resolution

- **关闭时间**：2026-11-25 22:05 EST
- **改动内容**（未修改 `lib/` 代码，0 真实模型调用）：
  - [tests/t221-provider-formats.test.ts](../../tests/t221-provider-formats.test.ts)：扩展本地 HTTP 替身支持 `WITH_CITATION`、`ZOD_EMPTY_ISSUE` 与 `ZOD_LONG_ISSUE`，新增 `deepseek, openai and anthropic submit_fact_review requests carry $defs/$ref and enforce local Zod bounds`，验证 `deepseek`（`/beta/chat/completions`、`strict: true`）、`openai`（`/v1/chat/completions`、`strict: true`）与 `anthropic`（`/v1/messages`）均发出顶层 `$defs.category`／`$defs.quoteRef` 与裸 `{ $ref: '#/$defs/...' }`、无长度正则 `pattern` 与长度关键字、`claimRef` 段隔离、合法引用还原与本地 `Zod` 单次拒收（不重试）。
  - [T-230-fact-review-schema-slim.md](T-230-fact-review-schema-slim.md)：补记独立 Antigravity `claude-sonnet-4-6`（`--mode plan` 只读新对话 `3b559efe-2dd7-4930-af7a-2d2ada9add32`，原始结果与报告存 `artifacts/t230/claude-review-raw.json`、`artifacts/t230/claude-review.txt` 与 CLI `t230-review-report.md`）对提交 `455369db` 的 **PASS** 审查结论；未发现可复现缺陷。
  - **真实 DeepSeek `/beta` 状态**：**未实测**（只读布尔核对 `.env.local`：`hasDeepSeekKey: false, hasDeepSeekBase: false, format: "openai-responses"`，未读取或打印任何密钥值）。
- **验证结果**（最终改动后通过，0 失败、0 跳过）：
  - 先行红态验证（`artifacts/t231/red-pre-t230.log`）：临时切回 `74349988` 旧版 `lib/code-site-model.ts` 后运行新增用例按预期失败（`RED_EXIT=1`，暴露 `pattern: "^[\\s\\S]{1,500}$"`），随后立即 `git checkout HEAD -- lib/code-site-model.ts` 并确认 `git diff --exit-code -- lib/code-site-model.ts` 为空。
  - `npm run typecheck` 退出码 0（`artifacts/t231/typecheck.log`）。
  - `node --experimental-strip-types scripts/run-tests.ts tests/t221-provider-formats.test.ts tests/t230-fact-review-schema.test.ts` 退出码 0（`artifacts/t231/green-tests.log`）：`t221`（21/21）与 `t230`（3/3）共 24/24 全部通过、0 失败、0 跳过。全量 `npm test` 留待合入前统一运行。
  - `design_integrity.py --cwd . --base HEAD --format json`（`artifacts/t231/design-integrity.json`）：`findings: []`、`acceptance_changes: []`。
  - `project_map.py status --root .` 退出码 0（`Problems (0)`、`Stale living docs (0)`、`Frontier (0)`）。
- **独立审查**：Antigravity `claude-sonnet-4-6`（`--mode plan` 只读独立对话 [37f53182](conversation://37f53182-1db5-411d-bd70-357bb4956f24)，原始记录存 `artifacts/t231/claude-review-raw.json` 与 `artifacts/t231/claude-review.txt`）第 1 轮核实全部技术与测试项通过并检出第 4 条复选框及「待补充」字样导致 `project_map.py status` 返回 `Problems (1)`；补勾选并更新记录后复审（见 `artifacts/t231/claude-rereview-raw.json`）。

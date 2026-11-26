---
id: T-230
title: submit_fact_review provider schema 去重与去长度正则以通过 OpenAI 编译上限
type: build
status: closed
blocked_by: []
claimed_by: Antigravity
supersedes:
---

## What to build

解决 [T-226](T-226-style-diversity-direction.md) 第二阶段首站（`molding/precision`，候选站 `cbb8dd7e-5f1e-4622-927d-013bb40980fd`，`81` 个核对段、`163` 条用户引用、`1,555` 个 `claimRef`）在 OpenAI `/v1/responses` 调用 `submit_fact_review` 时触发 `HTTP 400 invalid_json_schema: regex construction fuel exhausted` 的阻塞问题：

1. **方案 1（优先，已拍板）**：
   - 在 `lib/code-site-model.ts` 的 `auditCodeFacts` 中，保持本地 `Zod`（`issues: z.array(z.string().min(1).max(500)).max(40)`、类别去重与上限、出处上限 `100`、`.strict()`）与 `T-210` 全部协议校验（`rejectDuplicateFactKeys`、跨段 `claimRef`、未知 `quoteRef`、二选一违规立即拒收且不重试）**零放宽**；
   - 给上游 `submit_fact_review` 发送的 provider schema 去掉 `issues` 字符串长度正则 `pattern: "^[\\s\\S]{1,500}$"` 及数组长度关键词，并将各段共用的 `category` 与 `quoteRef` 枚举抽到顶层 `$defs`、以 `{ $ref: '#/$defs/...' }` 引用，`claimRef` 枚举继续按核对段严格隔离。
   - 同步精简更新 [AGENTS.md](../../AGENTS.md)、[docs/project/mainline.md](../../docs/project/mainline.md)、[docs/project/spec.md](../../docs/project/spec.md) 与 [MAP.md](../MAP.md)。
2. **方案 2（有条件后备，已预授权）**：
   - 按 [T-221](T-221-provider-formats.md)「严格模式被拒再关」先例，仅当方案 1 完成后用真实 `openai-responses` 请求重跑 `cbb8dd7e` 仍被上游以严格 schema 编译上限拒绝时，才仅对 `openai-responses` 格式的 `submit_fact_review` 设 `strict: false`，其他函数与格式保持不变，并在 [AGENTS.md](../../AGENTS.md) 与 [T-221](T-221-provider-formats.md) 写明例外与触发证据。
3. **真实探针验证**：
   - 启动 `T-153` 预算网关（延续第二阶段 `850,000` 总额扣除已用 `39,572` 后的剩余上限 `SITECRAFT_TOKEN_LIMIT=810000`），通过工作台真实 `action: "resume"` 接口对已保存 `run.checkpoint` 的 `cbb8dd7e` 跑一次事实核对探针，验证 `submit_fact_review` 返回 HTTP 200。

## Acceptance

- [x] `submit_fact_review` provider schema 不包含 `pattern`、`minLength`、`maxLength`、`minItems`、`maxItems`，`category` 与 `quoteRef` 抽到顶层 `$defs` 并通过 `#/$defs/...` 引用，`claimRef` 枚举仍按核对段严格隔离；81 段 / 163 条来源引用规模下序列化体积低于 70KB
- [x] 本地 `Zod` 校验与 `T-210` 协议边界零放宽（空/超长 >500 字 issue、>40 条 issues、重复或 >7 项类别、>100 条出处、跨段 `claimRef`、未知 `quoteRef`、多余字段、重复 JSON 键均一次请求立即拒收、不重试）
- [x] 用真实 `openai-responses` 请求对已保存 `run.checkpoint` 的 81 段候选站 `cbb8dd7e` 执行 `action: "resume"` 探针，`submit_fact_review` 返回 HTTP 200（若方案 1 仍被上游严格 schema 编译上限拒绝，则按预授权仅对 `openai-responses` 的 `submit_fact_review` 设 `strict: false`，在 `AGENTS.md` 与 `T-221` 记录触发证据后再验证 HTTP 200）
- [x] `npm run typecheck`、`SITE_STORE=fs npm run build` 与相关定向测试通过，活文档（`AGENTS.md`、`docs/project/mainline.md`、`docs/project/spec.md`、`.project-map/MAP.md`）同步无过期

## Resolution

- **关闭时间**：2026-11-25 10:17 EST
- **实现方案**（只执行方案 1；方案 2 条件后备未触发，`lib/provider-format.ts` 的 `responsesStrict = true` 保持不变）：
  - [lib/code-site-model.ts](../../lib/code-site-model.ts)：在 `auditCodeFacts` 中保持本地 `Zod`（`issues` 1–500 字、最多 40 条、`factCategories` 最多 7 项、`citations` 最多 100 条、`.strict()`）及 `T-210` 协议边界（`rejectDuplicateFactKeys`、跨段 `claimRef`、未知 `quoteRef`、二选一违规立即拒收）不变；传给上游的 `factReviewParameters` 抽离顶层 `$defs.category` 与 `$defs.quoteRef`（通过 `#/$defs/...` 引用），去掉 `issues` 字符串长度正则与数组上下限，各段保留孤立的 `claimRef` 枚举。
  - [AGENTS.md](../../AGENTS.md)、[CONTEXT.md](../../CONTEXT.md)、[docs/project/mainline.md](../../docs/project/mainline.md)、[docs/project/spec.md](../../docs/project/spec.md)、[MAP.md](../MAP.md)：同步写入 `submit_fact_review` provider schema `$defs`／`$ref` 与本地 `Zod` 校验规则。
- **验证与真实探针证据**：
  - 先行失败（`artifacts/t230/red-schema.log`）：`node --test --experimental-strip-types tests/t230-fact-review-schema.test.ts` 在修改前按预期失败（`RED_EXIT=1`，3 项中 `1` 通过、`2` 失败，暴露 `pattern: "^[\\s\\S]{1,500}$"` 与内联重复）。
  - 最终构建与离线回归（最终代码改动后运行，0 失败、0 跳过）：
    - `SITE_STORE=fs npm run build` 退出码 0（`artifacts/t230/build.log`）。
    - `npm run typecheck` 退出码 0（`artifacts/t230/typecheck.log`）。
    - `scripts/run-tests.ts` 定向跑 6 组相关测试（`tests/t230-fact-review-schema.test.ts`、`tests/t210-fact-references.test.ts`、`tests/t185-fact-protocol.test.ts`、`tests/t174-local-function.test.ts`、`tests/t221-provider-formats.test.ts`、`tests/t138-thinking-mode.test.ts`）：`91/91` 通过、0 失败、0 跳过（`artifacts/t230/green-tests.log`）。全量 `npm test` 按约定留待合入前跑。
    - `design_integrity.py --cwd . --base HEAD --format json`（`artifacts/t230/design-integrity.json`）：`findings: []`、`acceptance_changes: []`。
  - 真实 `openai-responses`（`gpt-6.2-sol`）`action: "resume"` 探针（`artifacts/t230/probe-cbb8dd7e-result.json` 与 `artifacts/t226/phase2-probe-cbb8dd7e/budget/usage.json`）：
    - 候选站 `cbb8dd7e-5f1e-4622-927d-013bb40980fd`（81 个核对段、`163` 条用户引用、`1,555` 个 `claimRef`）在保留 `strict: true` 下一次性返回 **HTTP 200**，消耗 `169,288` token（输入 `166,203`／输出 `3,085`／推理 `366`），0 轮修正，保存正式版本 1（`de875f7c-3b3c-4200-8e73-30908c4fcd0c`，`底线检查通过`）。预算网关保持未停机，已用 `169,288 / 810,000`。
- **独立审查**：
  - `same-model review`（只读子 agent `3bcedebe-17a0-4754-9965-d3d0083265e3`，完整记录见 `artifacts/t230/review.txt`）：第 1 轮代码、设计完整性与真实探针均通过并检出 1 项 P2（`CONTEXT.md:40` 未同步导致 `project_map.py` 标过期）；同步 `CONTEXT.md` 后第 2 轮定点复审 **PASS**（`Problems (0)`、`Stale living docs (0)`、`Frontier (0)`）。
  - **独立跨模型 Claude 代码审查（[T-231](T-231-multi-format-fact-schema-and-claude-review.md) 补做）**：Antigravity `claude-sonnet-4-6`（`--mode plan` 只读新对话 [3b559efe](conversation://3b559efe-2dd7-4930-af7a-2d2ada9add32)，原始记录与报告存 `artifacts/t230/claude-review-raw.json`、`artifacts/t230/claude-review.txt` 与 `t230-review-report.md`）对提交 `455369db` 核查合同与活文档、`$defs`/`$ref` 结构、Zod 与协议零放宽、自行复跑 `t230`（3/3）及 `cbb8dd7e` 探针，结论 **PASS**（0 缺陷；已知边界为 Anthropic / OpenAI Chat Completions 真实上游接口未实跑、全量 `npm test` 留待合入前运行）。

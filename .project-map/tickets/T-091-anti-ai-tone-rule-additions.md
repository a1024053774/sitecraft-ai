---
id: T-091
title: 去 AI 味规则补主任务、单主按钮、状态不只靠颜色，区块候选说明借 oil-ui 方法
type: build
status: open
blocked_by: [T-084]
claimed_by: rs-rules
supersedes:
---

## What to build

依据 [R4 调研](../../docs/research/前端收藏调研-2026-10-03/R4-rules-skills-prompts.md) 第 5 节，落在 T-084「规范在系统里怎么落地」的第 1、2 层。

- `skills/sitecraft-frontend-less-ai-tone/`：加入 5 条——先写页面和区块的主任务与可观察结果再选版式；每页一个主按钮，其他入口降级并写清动作；状态和资料缺口用文字、形状或图标表达，颜色只做加强；候选写一个记忆点、主动不做的装饰和与已有布局的结构差异；不把外部模板名或提示词当用户选项。每条注明来源。
- `lib/frontend-tone.ts`：同步加入对应的短规则，不放 45–75、4.5:1 这类数值（数值由 T-089、T-090 的浏览器检查执行）。
- T-073 区块候选说明模板（`candidate.md` 的字段要求，在 T-073 / 区块池流水线文档里）：加品类与参照、区块主任务、记忆点、结构差异、主动不做的装饰。
- 引用或改写 oil-ui（MIT）、oiloil-ui-ux-guide（Apache-2.0）的内容时保留许可要求的署名。

## Acceptance

- [x] `lib/frontend-tone.ts` 的测试先写，并在父提交上能加载、在断言处失败：新规则出现在给模型的提示里，且提示里不含数值门槛
- [x] 用真实 DeepSeek 对三份模拟资料各生成一次，确认新规则没让页面出现规则原文或数值（报告存 `artifacts/t091/`）
- [ ] `npm run typecheck`、`npm test`、`npm run build` 通过；代码审查通过；Claude 验收

## Resolution

2026-10-03（纽约时间），rs-rules。实现提交 `ff8978e`：

- `lib/frontend-tone.ts` 从 `sitecraft-frontend-less-ai-tone@0.3.1` 升到 `@0.3.2`，加入五条不含数值门槛的运行时规则：主任务/可观察结果、单一主要入口、状态和资料缺口的多通道表达、同族区块的记忆点与结构差异、用户选样子/布局而非外部模板名或提示词。
- `skills/sitecraft-frontend-less-ai-tone/SKILL.md` 同步规则并逐条写来源；`SOURCE.md` 记录 oil-ui MIT（revision `dba584210a02198c07f2c4e22739c0eeb3231570`）和 oiloil-ui-ux-guide Apache-2.0（revision `f32bc2bd210a6693f86841816a531ab511b258b4`）的改写范围与署名；没有复制 Jiro prompt/code。
- T-073 的 candidate.md 要求补充品类/参照、区块主任务、记忆点、结构差异、主动不做的装饰、资料条件和来源，并写明 oil 许可与 Jiro 限制。
- 更新 `.cursor` loader、`docs/project/{spec,intent,mainline}.md` 与现有版本断言，保持 living docs 与运行时版本一致。

证据（2026-10-03，纽约时间）：

- 红测：`node --test --experimental-strip-types tests/frontend-tone.test.ts` 在父提交 `fc25b37` 上加载成功、2 项新断言失败；输出 `artifacts/t091/red.txt`。改动后焦点测试 `node --test --experimental-strip-types tests/frontend-tone.test.ts tests/ai-provider-intent.test.ts tests/quality-comparison.test.ts` 为 28/28 通过。
- 真实模型：`SITECRAFT_ENV_FILE=/Users/luckye/Documents/Code/sitecraft-ai/.env.local node --experimental-strip-types artifacts/t091/generate.mjs`；三份模拟资料（industrial/export/molding）均 HTTP 200、`applied`，`ruleTextLeaks=[]`、`numericGateLeaks=[]`；输出 `artifacts/t091/real-generation.json`。脚本只记录脱敏状态，不写 prompt、资料原文或密钥。
- `npm run typecheck` PASS；`npm run build` PASS，输出 `artifacts/t091/build.txt`。
- vendor 快照补齐后，`SITECRAFT_BASE=http://localhost:3053 CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test` 为 652/655，3 项失败：两项区块浏览器检查在长跑期间无法取得开发服务健康响应，另 1 项既有 workspace motion 进度断言失败；完整输出 `artifacts/t091/npm-test-vendor.txt`。同一 worktree 的逐项重跑为区块 12/12（`targeted-blocks.txt`）和 workspace 5/5（`targeted-motion.txt`）。
- 为逐条核对无关性，在只读父提交 `fc25b37` 的临时副本（同样复制 vendor 快照）起 3053 服务：区块 + workspace 17/17 通过（`artifacts/t091/parent-targeted.txt`），全量 `npm test` 654/654 通过（`artifacts/t091/parent-npm-test.txt`）。未修改 `tests/helpers/workspace-browser.ts`，未手动终止 Chrome。当前票总体 **INCOMPLETE**，代码审查和 Claude 验收留空。
- r2：先在带 `.env.local` 的 3053 dev server 上确认 `/api/health` HTTP 200（响应保存在 `artifacts/t091/health-r2.json`），再运行同一完整命令；`npm test` 为 654/655，唯一失败仍是 `workspace-interaction.test.ts:246` 的 motion 进度断言，输出 `artifacts/t091/npm-test-r2.txt`。单独重跑该测试为 5/5 通过，输出 `artifacts/t091/workspace-motion-r2.txt`；未修改浏览器 helper，也未手动终止 Chrome。票据仍为 **INCOMPLETE**，等待 T-094/独立代码审查与 Claude 验收。

---
id: T-073
title: 区块素材流水线 tracer：一个新布局从制作、AI 味审查到进库
type: build
status: open
blocked_by: [T-071]
claimed_by: sonnet-blocks
supersedes:
---

## What to build

先让**一个**新布局走完整条线，再批量做（T-074）。

布局：产品区块的「型号索引表」——一张表列出全部产品：名称、类别、2–3 项关键参数、询这款的入口。适合产品多的目录型公司（注塑资料有 5 个产品）。和现有「参数对比表」不同：对比表要 2–4 个产品共有 3 项参数，索引表不要求共有参数，每行取该产品自己的前几项有值参数。资料条件：至少 3 个产品。

流水线：

1. **制作**（sonnet-blocks，Sonnet 5.5，在 worktree / 分支 `blocks-pool` 上）：按 `lib/blocks/catalog.ts` 的约定写变体（槽位、markers、parts、`requires`）、`lib/blocks/fragments/` 里的 HTML/CSS（只用 `--site-*` token，不写死颜色和字体；不用图标、图片、外部资源）。结构可以参考 HyperUI / Meraki UI（MIT，T-051 记录的提交），按我们的类名和 token 手工重写，并在候选说明里写参考来源。遵循 `skills/frontend-less-ai-tone/` 和 `skills/sitecraft-frontend-less-ai-tone/`。
2. **候选渲染**：写一个可复用脚本 `artifacts/blocks-pool/render-block.mjs`，用 T-065 / T-066 的三家公司草稿（把需要的站点记录复制进 worktree 的数据目录），把候选布局挂上后截出**这个区块本身**的裁切图（1440 / 768 / 375 × 三家），再截同一区块默认布局的对照图和一张 1440 整页上下文图；同时跑横向溢出、文字重叠扫描。输出到 `artifacts/blocks-pool/<候选名>/`，附 `candidate.md`（读哪些字段、资料条件、参考来源、和已有布局的区别）。
3. **AI 味审查**（codex-taste，gpt-6.1-sol，只读候选目录）：先用两三句描述看到的结构（可核对），再按 T-071 的判断依据给 ACCEPT / REVISE / REJECT。REVISE 最多来回两轮；REJECT 的候选删掉代码、保留审查记录。
4. **进库**：ACCEPT 后在 `blocks-pool` 分支提交（测试先写：资料条件、槽位唯一命中、三档无溢出），跑 `npm run typecheck`、`npm test`、`npm run build`；Astra 代码审查通过后由 Claude 合回 `family-kit-assembly`，在主工作区跑三家的 `check-published`，并确认模型的布局清单里出现这个新布局、资料不够时会被拒绝。

## Acceptance

- [ ] 「型号索引表」走完 1–4：候选目录、审查记录（含描述 + 结论）、提交、测试先失败的证据都在
- [ ] 渲染脚本一条命令可重渲任意候选，裁切图逐张看过，没有载入态、空白、截断
- [ ] Astra 代码审查通过；合回主线后三家 `check-published` 中英文三档通过；Claude 验收
- [ ] 流水线里卡住或返工的地方写进 Resolution，作为 T-074 批量做之前要改的地方

---
id: T-236
title: 系统图片署名部件 .sc-image-credits 样式与对比度隔离修复
type: build
status: closed
blocked_by: []
claimed_by: Antigravity
supersedes:
---

## What to build

按「功能部件由系统提供」原则，在系统渲染层 [lib/code-site.ts](../../lib/code-site.ts) 的 `.sc-image-credits` 部件自身作用域内固定背景、文字与折叠标记颜色及盒模型边界，防止生成站点的全局 `::marker`、`details`、`summary`、`p` 等样式覆盖系统署名部件导致可读性下降或对比度拒收：

1. **只改系统部件 `.sc-image-credits` 自身样式（不动检查器阈值、提交入口逻辑，不加豁免）**：
   - 在 `renderSiteCodeCss` 中对 `:root body details.sc-image-credits`、`:root body details.sc-image-credits > summary`、`:root body details.sc-image-credits > summary::marker` 与 `:root body details.sc-image-credits > p` 固定白底（`#fff`）、深灰字色与标记色（`#333`）、`border-radius: 0`、`background-clip: border-box`、`padding: 12px 24px`、`list-style-position: inside`（子级背景透明）、`opacity: 1`、`filter: none`、`mix-blend-mode: normal` 与 `z-index: auto`，确保站点 CSS（含全局 `::marker { color: <低对比色> }`、`details`/`summary`/`p` 暗色或低对比规则）无法覆盖署名区。
2. **先行红灯与三路一致性回归测试（[tests/t236-image-credits-isolation.test.ts](../../tests/t236-image-credits-isolation.test.ts)）**：
   - 修改 `lib/code-site.ts` 前先运行测试并保存红灯失败证据（`artifacts/t236/red-credits.log`）：当站点 CSS 含 `::marker { color: #b3c486 }` 及暗色 `details`/`summary`/`p` 规则且页面引用授权图片时，未修复前提交入口对比度仅 `1.78` 且标记背景覆盖无法核实而被拒收；
   - 修复后同一站点通过真实 `commitSiteCode`（`375`/`768`/`1440` 对比度 `0` 问题），且在 Chrome 中实测**预览**（`/api/sites/[siteId]/code-preview`）、**发布**（`/published/[siteId]`）与**站点包（T-171）**（`/api/sites/[siteId]/export` 解包 `file://` + `styles.css`）三条路径在折叠与展开态下 `summary`、`summary::marker` 与署名 `<p>` 对比度均 `>= 4.5:1`，且三条路径的署名部件渲染结果一致。
3. **活文档同步与独立审查**：
   - 同步 `AGENTS.md`、`CONTEXT.md`、`docs/project/mainline.md`、`docs/project/spec.md` 中关于系统图片署名部件的说明，通过 `typecheck`、相关回归测试、`design_integrity.py`、`project_map.py status --root .` 与独立 Antigravity `claude-sonnet-4-6` 只读审查后提交推送。

## Acceptance

- [x] 修改 `lib/code-site.ts` 前已捕获 `tests/t236-image-credits-isolation.test.ts` 红灯失败日志（`artifacts/t236/red-credits.log`）
- [x] 修改范围仅限 `lib/code-site.ts` 中 `.sc-image-credits` 系统部件样式，未改动提交入口或检查器阈值、未新增检查豁免
- [x] 站点 CSS 写 `::marker { color: <低对比色> }` 时，真实提交入口通过，且预览、发布、站点包（T-171）三条路径在 `375`/`768`/`1440` 下署名区（含 `summary`、`summary::marker`、署名文字）实测对比度均 `>= 4.5` 且渲染结果一致
- [x] `npm run typecheck`、`t236` 与 `t171` 等相关回归测试、`design_integrity.py`、活文档同步、`project_map.py status --root .` 及独立 Antigravity `claude-sonnet-4-6` 只读审查全部通过

## Resolution

- **修改内容**：
  - [lib/code-site.ts](../../lib/code-site.ts)：在 `renderSiteCodeCss` 系统样式末尾将 `.sc-image-credits` 收口为 `:root body details.sc-image-credits` 及子级 `> summary`、`> summary::marker`/`::-webkit-details-marker`、`> p`（含 `::first-line`/`::first-letter` 与禁注入 `::before`/`::after`）固定白底 `#fff`、直角 `border-box`、深色 `#333` 与子级透明底，`lib/code-site-check.ts` 与 `scripts/visitor-layout-scan.js` 零改动、无豁免。
  - 新增 [tests/t236-image-credits-isolation.test.ts](../../tests/t236-image-credits-isolation.test.ts) 并同步活文档 `AGENTS.md`、`CONTEXT.md`、`docs/project/mainline.md`、`docs/project/spec.md`。
- **验证证据**：
  - 修改前红灯：`artifacts/t236/red-credits.log`（`RED_EXIT=1`，提交入口因署名区对比度 `1.78 < 4.5` 及 `::marker` 背景覆盖无法核实而拒收）。
  - 类型检查：`npm run typecheck` 通过（`artifacts/t236/typecheck.log`）。
  - 回归测试：`artifacts/t236/green-tests.log` 中 `tests/t171-source-export.test.ts`（`23/23`）与 `tests/t192-check-transitions.test.ts`（`14/14`）通过；补齐英文夹具主体名 `英文名：Qinghe Packaging` 后 `artifacts/t236/green-t236.log` 中 `tests/t236-image-credits-isolation.test.ts`（`2/2`，0 fail）全部通过，`artifacts/t236/three-way-credits-parity.json` 记录中英双语 × 2 页 × 3 档视口 × 折叠/展开态在 `preview`、`published`、`package` 三路完全一致（`summary` 与 `summary::marker` 对比度 `12.63`，展开态署名 `<p>` 对比度 `12.47`）。
  - 设计完整性：`artifacts/t236/design-integrity.json`（`findings: []`，`acceptance_changes: []`）。
- **独立审查**：独立 Antigravity `claude-sonnet-4-6` 只读审查会话 [309f350b](conversation://309f350b-ce04-4b97-b69d-12f817e0f4fa)（宿主 `transcript.jsonl` 核实 `modelsUsed: ["claude-sonnet-4-6"]`，`artifacts/t236/claude-review.txt`）结论为 **`Verdict: PASS`**（0 确认缺陷）。

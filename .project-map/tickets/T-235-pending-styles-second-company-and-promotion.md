---
id: T-235
title: 三个 pending 风格第二家公司真实评估、独立盲评与通过风格转 ready
type: build
status: closed
blocked_by: [T-233, T-234]
claimed_by: Antigravity
supersedes:
---

## What to build

在 [T-233](T-233-fact-review-input-dedup.md) 与 [T-234](T-234-neighborly-pricing-and-heading-wrap.md) 推送生效后，为三个 `pending` 候选风格（`darkroom`、`indexgrid`、`craftposter`）执行第二家公司真实评估（累计预算硬上限 `SITECRAFT_TOKEN_LIMIT=400000`），配合第二阶段样本由隔离的 Antigravity `claude-sonnet-4-6` 执行 `company` 成对盲评（严格每轮至多读取 1 个 sample ID），仅将盲评通过的风格升级为 `ready`、未通过或受阻风格保持 `pending` 并留档明确原因：

1. **第二家公司真实生成与停服核验（总上限 `400,000` token，实际累计消耗 `241,574` / 剩余 `158,426`）**：
   - 首轮尝试 `artifacts/t235/eval-3sites` 因短暂网络 `fetch failed` 在第 1 次 `plan`（`e8658304`，`0` token 消耗）即受阻停止；按单次重试原则于 `artifacts/t235/eval-3sites-r2` 完成 `industrial/indexgrid`（`51cbadf9`，`v1: 7885350d`，`118,761` token），随后的 `packaging/darkroom`（`118c311e`）在 `submit_page_plan` 达 300 秒超时（`0` token 计费）。
   - 以剩余授权额度 `281,239` 于 `artifacts/t235/eval-3sites-r3` 运行剩余 2 站：`education/craftposter`（`8c3225b7`，`v1: 3c0a3f25`，`87,855` token）一次零修补生成通过；`packaging/darkroom`（`bef9b944`，`34,958` token）在第 0 次底线检查阶段确定性失败且保持 `pending`——停服前均保存运行态与无在途请求快照（`terminal-before-stop.json`）。
2. **`darkroom` 保持 `pending` 原因与最小后续选项**：
   - 根因 A（系统 CSS 隔离越权范围外）：[lib/code-site.ts](../../lib/code-site.ts#L281) 注入 `<details class="sc-image-credits"><summary>图片来源与许可</summary>...</details>`（白底 `#fff`、字色 `#333`，未加 `!important` 与 `.sc-image-credits summary::marker{color:#333!important}`）。`bef9b944` 的全局暗底 CSS `::marker{color:var(--moss)}`（`#b3c486`）渗入白底 `.sc-image-credits summary::marker`（`▸`/`▾`），Chrome 测得对比度 `1.88 < 4.5`；`T-187` 因无法核实伪元素范围而在进入 `facts` / `repair` 前拒收。由于本阶段冻结提交检查与系统渲染器修改，按规格不动 `lib/code-site.ts`、保持 `darkroom` 为 `pending` 并留待负责人拍板（最小修复：在 `lib/code-site.ts` 给 `.sc-image-credits` 及 `summary::marker` 加固定高对比规则，或由 `darkroom` 配方限定 `ul/ol li::marker` 作用域）。
   - 根因 B：`eval-new-route.ts` 将打包行业图固定标注为「授权行业配图... 不是该公司的实拍」，使 `T-234` 写明的「有授权实拍图时首页开场嵌实拍」在评估集未触发，`packaging/darkroom` 首屏仍为纯字+几何标、图片在正文后段。
3. **四站合并 `company` 盲评与宿主审计（保留历史 `879c377d` 错配记录）**：
   - 将已完成的 `design/indexgrid`（`b8e3659b`）+ `industrial/indexgrid`（`51cbadf9`）、`restaurant/craftposter`（`3a8b3420`）+ `education/craftposter`（`8c3225b7`）组合成 `artifacts/t235/combined-company-4sites`（2 对、4 个样本、8 张 PNG；完整保留 `artifacts/t226/phase2-plan-a-r3/*slotmixup-879c377d*` 不动）。
   - 隔离 Antigravity `claude-sonnet-4-6`（`8f770deb`）严格每轮只看 1 个 sample ID，读全 `8/8` PNG 且 `0` 越界访问（`artifacts/t235/blind-audit-proof.json`）：
     - **`craftposter`（`de2249341330`）：判 `sameTemplate: false`（通过）**——双行 vs 单行页头、两栏场景 vs 三栏课程、有步骤区 vs 无步骤区、单列纵轴 vs 四列横轴沿革、非对称 vs 通栏日志与不同色板。
     - **`indexgrid`（`1f0d46354f32`）：判 `sameTemplate: true`（不通过，保持 `pending`）**——虽然行业与图量完全不同，但两站共用了高度相似的「深色面包屑顶栏 + 左大字右浮动索引框 Hero + 左白/深蓝标题右分隔线列表 + 左纵年表右两格栏 + 日期日志 + 四格页脚」同一骨架与栅格。
4. **仅升级 `craftposter` 为 `ready`，并完成全链路验证（不引入自托管字体）**：
   - 从 `education/craftposter`（`8c3225b7`，`v1` `3c0a3f25`）审查版 `home-fold-1440.png` 缩放提取 `576×400` WebP（`public/style-previews/craftposter.webp`），登记于 [SOURCE.md](../../public/style-previews/SOURCE.md) 与 [lib/code-site-styles.ts](../../lib/code-site-styles.ts)（首屏纯模拟文字与 CSS 几何标，无写真图片再分发）。
   - 同步 [app/(workspace)/page.tsx](../../app/(workspace)/page.tsx) 动态显示 `{readyCodeStyleIds.length} 种风格`、更新 [skills/site-code-craftposter/SKILL.md](../../skills/site-code-craftposter/SKILL.md)、活文档（`CONTEXT.md`、`docs/project/mainline.md`、`docs/project/spec.md`）及测试（`tests/t153-style-preferences.test.ts`、`tests/t159-eval-entry.test.ts`、`tests/t227-style-recipes.test.ts`）。

## Acceptance

- [x] 新账本累计 `<= 400,000` token（实耗 `241,574`，余 `158,426`）完成 `industrial/indexgrid`（`51cbadf9`）与 `education/craftposter`（`8c3225b7`）`v1` 生成及 `packaging/darkroom`（`bef9b944`）错误归因，停服前均无在途调用（`terminal-before-stop.json`）；`879c377d` 错配历史证据完好保留
- [x] 4 站合并 `company` 盲评由隔离 `claude-sonnet-4-6` 严格按每轮至多 1 个 sample ID 完成（`8/8` PNG 全读、`0` 越界、行业语义吻合，`artifacts/t235/blind-audit-proof.json`）：`craftposter` 通过（`sameTemplate=false`），`indexgrid` 未通过（`sameTemplate=true`）
- [x] 仅 `craftposter` 提取 `576×400` WebP（`public/style-previews/craftposter.webp`）并在 `SOURCE.md` 与 `lib/code-site-styles.ts` 登记为 `ready`；`darkroom` 与 `indexgrid` 继续保持 `pending` 且原因写明；未新增自托管字体
- [x] `SITE_STORE=fs npm run build`（`.next <= 2GB`）、`npm run typecheck`、全部相关风格/入口/缩略图测试、`design_integrity.py`、活文档同步及独立 Antigravity `claude-sonnet-4-6` 只读代码审查全部通过

## Resolution

- **真实生成与预算结果**：在单一 `SITECRAFT_TOKEN_LIMIT=400000` 上限内分三轮（`r1` / `r2` / `r3`）执行，累计消耗 `241,574` tokens，剩余 `158,426` tokens：
  - `r1`（`artifacts/t235/eval-3sites`）：`industrial/indexgrid`（`e8658304-84c2-45ca-8ee2-90ada5d5aaa7`）在首次 `submit_page_plan` 遇瞬态 `HTTP 502`（`fetch failed`），消耗 `0` tokens，原始记录保留未删。
  - `r2`（`artifacts/t235/eval-3sites-r2`）：`industrial/indexgrid`（`51cbadf9-0cc1-452c-ab5a-d9ccf03e4285`，`v1` `7885350d-e302-43b4-9362-81926892742e`）完成（`118,761` tokens：`plan` 12,640 + `write` 21,167 + `facts` 84,954；0 次修正）；`packaging/darkroom`（`118c311e-96af-440d-a750-bad58e6be7fa`）在 `submit_page_plan` 达 300s 超时，`0` tokens，保留现场。
  - `r3`（`artifacts/t235/eval-3sites-r3`，剩余额度 `281,239`）：`packaging/darkroom`（`bef9b944-c68e-4168-9e8a-8e25fd9245d3`，`34,958` tokens：`plan` 12,863 + `write` 22,095）在提交入口确定性视觉检查被拒；`education/craftposter`（`8c3225b7-be4b-4840-8510-35bd956177bd`，`v1` `3c0a3f25-ae61-40eb-9e17-5e98327ad46d`）完成（`87,855` tokens：`plan` 12,395 + `write` 19,683 + `facts` 55,777；0 次修正）。停服前均写入 `terminal-before-stop.json`（`inFlightCalls: 0`）。
  - `packaging/darkroom`（`bef9b944`）两项根因（依命令边界未改 `lib/code-site.ts`，故不重跑）：① `renderSiteCodeCss`（`lib/code-site.ts:281`）在 `.sc-image-credits` 未覆盖主题全局 `::marker { color: var(--moss) }`，导致白色声明底上 `<summary>::marker` 对比度 `1.88 < 4.5`（18 处越线），于尝试 0 即拒绝；② 评估素材标注图片“不是该公司的实拍”，使首屏按规则保持无实拍图。
  - 历史记录 `artifacts/t226/phase2-plan-a-r3/*slotmixup-879c377d*` 原封保留未改。
- **隔离 `company` 盲评（`artifacts/t235/blind-audit-proof.json`）**：独立 Antigravity `claude-sonnet-4-6` 会话（`8f770deb-6f78-4c9d-9b6d-9c914744f50f`）只读临时副本（审后已清理），`outsideAccessesCount=0`、`pngReadsCount=8/8`（100% 唯一 PNG）、`maxSamplesPerTurn=1`（`AUDIT_PASS=true`）：
  - `craftposter`（配对 `de2249341330`：`restaurant/craftposter` + `education/craftposter`）：`sameTemplate: false` -> **通过**。
  - `indexgrid`（配对 `1f0d46354f32`：`design/indexgrid` + `industrial/indexgrid`）：`sameTemplate: true` -> **未通过**。
- **风格晋升与产物**：`craftposter` 提取 `public/style-previews/craftposter.webp`（`576×400`，`13,452` bytes，来源 `education/craftposter` `8c3225b7` / `v1` `3c0a3f25`，首屏无实拍图，无自托管字体），登记为 `ready` 并在 `public/style-previews/SOURCE.md`、`app/(workspace)/page.tsx`、`AGENTS.md`、`CONTEXT.md`、`docs/project/mainline.md`、`docs/project/spec.md` 同步；`darkroom` 与 `indexgrid` 维持 `pending` 并记录原因。
- **验证与独立审查**：`SITE_STORE=fs npm run build` 通过（`.next` 约 `758.74 MB <= 2GB`）、`npm run typecheck` 通过、`scripts/run-tests.ts` 相关 5 个测试套件全部通过（0 fail）、`design_integrity.py` 无发现；独立 Antigravity `claude-sonnet-4-6` 只读审查（`8322f9fd-0e66-4317-a266-481465843f9f`，`artifacts/t235/claude-review.txt`）结论为 `Verdict: PASS`（`lib/code-site.ts` diff 为 0）。

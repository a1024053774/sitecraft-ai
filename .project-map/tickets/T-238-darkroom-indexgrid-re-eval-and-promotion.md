---
id: T-238
title: darkroom 与 indexgrid 新配方四站真实评估、隔离 company 盲评与达标风格转 ready
type: build
status: closed
blocked_by: [T-236, T-237]
claimed_by: Antigravity
supersedes:
---

## What to build

在 [T-236](T-236-system-image-credits-style-isolation.md)（`.sc-image-credits` 系统样式隔离）与 [T-237](T-237-darkroom-no-real-photo-and-indexgrid-flexible-recipes.md)（`darkroom` 无实拍图成立配方 + `indexgrid` 按内容选排法解绑）推送生效后，新建单一预算账本（硬上限 `SITECRAFT_TOKEN_LIMIT=500000`），完成两套 `pending` 风格各两家跨行业公司的真实整站评估与隔离 `claude-sonnet-4-6` `company` 成对盲评，并将达标风格按 `craftposter` 规范流程转为 `ready`、未达标风格保持 `pending` 并写明原因：

1. **新账本四站真实整站生成（硬上限 `SITECRAFT_TOKEN_LIMIT=500000`，超出即停）**：
   - 使用 `SITECRAFT_EVAL_STYLES='darkroom,indexgrid'` 启动本工作树独立 dev 服务与 `T-153` 预算网关（账本目录 `artifacts/t238/eval-4sites/budget`）；
   - 通过 `eval-new-route.ts` 生成 `design/indexgrid`、`industrial/indexgrid`、`packaging/darkroom`、`education/darkroom` 共 4 站（4 家不同行业公司，覆盖重新生成 `design/indexgrid` + `industrial/indexgrid` 及新配方下 `darkroom` 双公司验证）；
   - 严格执行停服门禁：仅在全部站点 `run.status !== 'running'` 且预算网关无在途请求（写入 `terminal-before-stop.json`）后手动停止网关与 dev 服务。
2. **隔离 `claude-sonnet-4-6` `company` 盲评与宿主审计**：
   - 将生成的匿名 `review/company` 包复制到 `$env:TEMP` 独立目录，启动全新只读 `claude-sonnet-4-6` 会话评阅（每轮至多读取 1 个 sample ID，读全全部 PNG 且 `0` 越界访问，宿主核验 `transcript.jsonl` 并输出 `artifacts/t238/blind-audit-proof.json` 后清理临时副本）。
3. **按盲评结论处置风格状态（不新增自托管字体）**：
   - 盲评通过（`sameTemplate: false`）且生成通过底线的风格：从审查版 `home-fold-1440.png` 缩放生成 `576×400` WebP（`public/style-previews/<style>.webp`，quality 88），在 [SOURCE.md](../../public/style-previews/SOURCE.md) 登记完整来源与许可（若首屏含第三方授权配图，同步逐张列明作者、来源 URL 与许可），在 [lib/code-site-styles.ts](../../lib/code-site-styles.ts) 转为 `ready`，并同步 `SKILL.md`、活文档（`AGENTS.md`、`CONTEXT.md`、`README.md`、`docs/project/mainline.md`、`docs/project/spec.md`）及相关测试；
   - 未达标风格保持 `pending`，在票据与活文档如实写明原因，不反复重试。
4. **全链路构建、测试与独立审查**：
   - 运行 `SITE_STORE=fs npm run build`（核对 `.next <= 2GB`）、`npm run typecheck`、相关风格/准入/导出测试、`design_integrity.py`、`project_map.py status --root .` 及独立 `claude-sonnet-4-6` 只读审查后提交推送。

## Acceptance

- [x] 单一新账本 `SITECRAFT_TOKEN_LIMIT=500000` 内完成 `design/indexgrid`、`industrial/indexgrid` 与 `darkroom` 真实评估（若预算将超限则按规停下汇报），停服前保存无在途请求证据 `terminal-before-stop.json`
- [x] 隔离 `claude-sonnet-4-6` 完成 `company` 盲评并通过宿主 `transcript.jsonl` 审计（`0` 越界、PNG 全读、每轮至多 1 个 sample ID，`artifacts/t238/blind-audit-proof.json`）
- [x] 达标风格按 `craftposter` 同一标准提取 `576×400` WebP、登记 `SOURCE.md` 与 `lib/code-site-styles.ts` 转为 `ready`（未新增自托管字体）；未达标风格保持 `pending` 并写明原因
- [x] `SITE_STORE=fs npm run build`（`.next <= 2GB`）、`npm run typecheck`、相关回归测试、`design_integrity.py`、活文档同步、`project_map.py status --root .` 及独立 Antigravity `claude-sonnet-4-6` 只读审查全部通过

## Resolution

- **完成时间**：2026-11-26 03:45 EST
- **新预算账本四站真实评估（硬上限 `500,000` token，实耗 `329,845` token，占比 `66.0%`，`12` 次调用全部 `HTTP 200`）**：
  - 账本：`artifacts/t238/eval-4sites/budget/usage.json`（`limit=500000`、`spent=329845`、`stopped=false`）；评估输出：`artifacts/t238/eval-4sites/eval/`；停服门禁核验：`artifacts/t238/eval-4sites/terminal-before-stop.json`（全部 4 站终态、`inFlightCalls=0` 后停止网关与 dev 服务）。
  - `packaging/darkroom`（青禾纸包装）：`generated`，`siteId=458140ff-6c79-4952-9a7b-267d4519ffc3`，`versionId=562a2e3c-0523-4337-9551-16be84051bdb`，零修补首稿一次通过底线（验证 T-236 `.sc-image-credits` 系统隔离与 T-237 无企业实拍图成立配方生效），用量 `104,540` token（plan `13,128` + write `23,926` + facts `67,486`）。
  - `education/darkroom`（拾色绘画教室）：`generated`，`siteId=ea60f587-8474-428b-801d-0e748fb114c9`，`versionId=6b091053-0e59-4c48-9fd7-62b995f63d6d`，零修补首稿一次通过底线，用量 `86,651` token（plan `12,681` + write `20,110` + facts `53,860`）。
  - `design/indexgrid`（折页设计工作室）：`generated`，`siteId=a53fe6ac-74bd-40cd-9a27-119f95637cb0`，`versionId=5e382689-e2d7-4eea-ade4-b63468cb438d`，零修补首稿一次通过底线（通栏大字首屏 + 三栏服务网格 + 三栏横向步骤条，已解除旧版左文右框首屏与左标右列步骤锁定），用量 `92,111` token（plan `12,574` + write `20,991` + facts `58,546`）。三套真实生成站均保留在主工作区 `.sitecraft-data/code-sites/`。
  - `industrial/indexgrid`（忻州重载减速机）：`error`（底线拒收），`siteId=3f5dd749-e918-485b-9674-7cf832112398`，用量 `46,543` token（plan `12,959` + write `21,737` + repair `11,847`）。根因：模型将首页五步工序/质检 `<ol class="steps">` 排成横向 5 列网格时，写出了 `.steps li { margin-left: 2.35rem }` 搭配 `.steps li+li::before { content: ''; position: absolute; inset: 0 auto 0 -2.35rem; border-left: 1px solid var(--line) }` 竖向分隔线；该空 `::before` 伪元素绘制盒在 `768`/`1440` 视口与 `outside` `::marker`（`2.`–`5.`）相交，触发 `伪元素叠层无法核对实际底图` 与 `局部修正版面拒因无法定位……当前无法核实伪元素声明修正的完整影响范围，本次拒收`。按票据规则不反复重试。
- **隔离 `claude-sonnet-4-6` `company` 盲评与宿主审计**：
  - 独立无项目绑定会话：`0c2bb8b6-5fba-447e-abca-409b504557a1`（模型 `claude-sonnet-4-6`，已归档并清理 `$env:TEMP\sitecraft-blind-t238-company`）。
  - 宿主审计 `artifacts/t238/blind-audit-proof.json`：`totalToolCalls=6`、`outsideAccessesCount=0`、`expectedPngCount=4`、`uniquePngsReadCount=4`、`missingPngs=[]`、`maxSamplesPerTurn=1`。
  - 解盲结论 `artifacts/t238/unblinded-company-report.json`：`darkroom` 成对题 `89ef9e2bec98`（`9ec2aa7727e6` 青禾纸包装 vs `fc82657b8fad` 拾色绘画教室）判为 **`sameTemplate: true`**（同模板率 `100% > 50%`）。原因：尽管子色板（深墨绿 vs 炭黑暖金）、首屏右侧图形与第三区块内部组织（卡片行 vs 编号列表加说明卡）不同，但两站整页区块骨架与顺序仍高度一致（右上三项导航 → 左文右图形首屏 → 三列横线分类带 → 左大标题右内容区 → 四列年份沿革（375 下 2×2）→ 左标题右日期动态 → 页脚）。
- **风格状态处置与构建回归**：
  - `darkroom`（底线已双站零修补打通，但 `company` 盲评判 `sameTemplate: true`）与 `indexgrid`（`design` 零修补打通，但 `industrial` 横向有序列表触发 `li+li::before` 与 `::marker` 叠层拒收，缺第二站盲评）均按标准保持 `pending`（`lib/code-site-styles.ts` 不改动，零新增自托管字体，不开放普通用户选项），并在 `AGENTS.md`、`CONTEXT.md`、`public/style-previews/SOURCE.md`、`docs/project/mainline.md`、`docs/project/spec.md` 与 `tests/t227-style-recipes.test.ts` 同步当前事实。
  - 验证通过：`SITE_STORE=fs npm run build`（`.next` 体积 `813.9 MB <= 2GB`，`artifacts/t238/build.log`）、`npm run typecheck`（`artifacts/t238/typecheck.log`）、定向测试 6 文件 `29/29` 全绿（非浏览器 `6/6` + 浏览器 `23/23`，`artifacts/t238/green-tests.log`）、`design_integrity.py` `findings: []`（`artifacts/t238/design-integrity.json`）、`project_map.py status --root .` `Problems (0)` / `Stale living docs (0)`，独立只读审查会话 `3c41620c-8a12-4e88-abad-45d8750524c8`（`claude-sonnet-4-6`，`artifacts/t238/claude-review.txt`）结论 `Verdict: PASS`。

---
id: T-054
title: 站点样式：模型写结构化样式规则，校验加三档检查
type: build
status: open
blocked_by: [T-053]
claimed_by: codex-build
supersedes:
---

## What to build

按 [spec.md §4](../../docs/project/spec.md) 的「站点样式」和「三档检查」实现做法 A：草稿加站点样式规则表，operation `set_site_style`（整份替换、inverse 恢复前一份），服务端校验白名单（[T-051 调研](../../docs/research/区块素材与CSS校验调研-2026-09-29.md) §3.3）、从结构生成带前缀的 CSS 放进 `@layer site-style`，提交前在常驻无头 Chrome 里按 375 / 768 / 1440 对比基线检查新增溢出、重叠和被藏的槽位文字，不过就拒绝并说明。模型的 operation 白名单和提示里加上它。

先把会失败的方式列出来再写测试，至少覆盖：`content`、`list-style-type:"…"` 等任何字符串值、`u\72 l(` 转义、`image-set()`、`@import`、`!important`、`position:fixed`、超出清单的区块/部件、超出上限、`min-width` 撑破 375、负边距造成重叠。

## 实现决定（Claude，2026-09-30，依据 Kiro 的计划 `artifacts/kiro-t054-plan.md`）

执行交给 Codex（Herdr 里的 `codex-build`，GPT-6-Astra），照 Kiro 的计划分步做；Kiro 积分不够，只写了计划。

- 版式方向配方：开发侧写好 3 个方向（规格为主、目录为主、工厂实力），每个 12–20 条白名单规则、三份资料三档检查过；模型选一个方向，再按用户要求加规则。仍是「模型写受限的站点样式」，只是不从零写。`set_site_style` 整份替换「方向 + 规则」。服务端先按资料算出「建议方向」写进提示，模型可按用户的话改。
- CSS 由我们的序列化函数在预览文档里生成，桥和检查用同一段代码；不透传模型原文。区块样式在 `@layer sc-blocks`，站点样式在其后的 `@layer site-style`；缺口和显隐靠不开放 `display` 和 `!important` 保住。spec 相应措辞随第 1 步修改。
- 白名单按计划收窄：不放 `display`、`order`、十六进制颜色、渐变、阴影；导航和页脚不开放。
- 三档检查只查访客首页（中文三档，有英文时英文也查），含对比度；只拒绝新增问题；规则表为空时不开浏览器。撤销和重做不查（撤销必须永远能退回），之后内容变长导致的问题靠 check-published 发现。
- 样式那一条不占模型 24 条上限（24 + 1，对齐方案 27 → 28）。
- dev server 启动时带 `CHROME_PATH`（可写进 `.env.local`）；没有 Chrome 时样式修改被拒并说明，其余修改照常。
- T-053 遗留 c1：选了参数对比表时首屏不放参数条。c2：「目录为主」方向加重参数条。
- 区块顺序（`sectionOrder` 在区块库页面不生效）另开 T-062，不在本票。

## Acceptance

- [ ] 上面每种坏规则都被拒绝，测试在没有校验的实现上先失败
- [ ] 用 DeepSeek 实跑：对三份模拟资料各提一次样式要求（例如「首屏更有分量」「参数表更紧凑」），生成的规则通过校验并在三档都不破版；故意要一个会撑破手机宽度的改法时被拒绝，用户看到原因
- [ ] 撤销、重做、刷新恢复对样式都成立
- [ ] 盲评（Codex gpt-6.1-sol）：三份模拟资料在工程工业下，遮住文字只看版式（`-masked` 截图），能看出是三家不同的公司（2026-09-30 从 T-053 移来的硬性验收）；且不差于 T-053
- [ ] `npm run typecheck`、`npm test`、`npm run build` 通过；Codex Astra 代码审查通过；Claude 验收

## Resolution

Codex，2026-09-30（纽约时间）。第 1–5 步提交为 `5418d88`、`3cb449c`、`190238b`、`6dde6b2`、`af3b6eb`；最终修正与证据补充待本段一起提交，未推送。代码审查和盲评两项留空。

实现：

- 工程工业提供规格为主、目录为主、工厂实力三个方向，每个 12 条白名单规则；目录方向加重参数条，选产品参数对比布局时首屏参数条隐藏（c1），参数条动态部件 `spec/spec-label/spec-value` 可审查。
- 服务端根据资料中的产品类别、能力/设备清单和流程项目给出建议方向并写进模型提示；模型提示列出方向、部件、白名单、上限和已定位样式请求规则。模型 operation 上限为 24 条普通操作，`set_site_style` 另计；需求对齐 proposal 上限为 28。
- 提交守卫串行运行候选/无样式基线的三档检查，覆盖中文 375/768/1440，以及 `englishReady` 时的英文三档；检查绘制文字 range、横向溢出、对比度和新增文字重叠。无 Chrome 时只拒绝样式，混合普通操作继续提交；撤销/重做不查。方向只有规则时也触发检查。
- 预览桥注入单一 `data-sc-site-style` 节点并合并方向配方与追加规则；不透传模型 CSS 原文。

验证：

- 红态与修复证据：`artifacts/t054/step1-red.txt`、`step2-red.txt`、`step3-red.txt`、`step4-red.txt`；扫描器最后一轮红态和修复记录见 `artifacts/t054/final-root-red.txt`、`final-root-green-a.txt`、`final-direction-c1-red.txt`、`final-direction-c1-green.txt`。
- 三份资料 × 三个方向三档检查全部通过：[directions-materials-20260930-122154/report.json](../../artifacts/t054/directions-materials-20260930-122154/report.json)。同一份工业资料的 1440/375 截图：[directions-20260930-121736](../../artifacts/t054/directions-20260930-121736/)。旧目录 `directions/` 和中断尝试目录均保留。
- 最终 `npm run typecheck`、`npm run build`、`CHROME_PATH=... npm test` 均通过；全量 489/489 日志：[final-npm-test-2.txt](../../artifacts/t054/final-npm-test-2.txt)。

真实生成与发布：

- DeepSeek 串行记录：工业首轮 `eab8083f…` 未写样式且首轮有 parse 失败，重跑 `6ad1b135…` 写入 `capability-led`、`hero=statement`、`products=compare`；P3E `5f7b816f…` 写入 `capability-led`、`hero=statement`、`products=cards`、`contact=split`；注塑 `1b984f09…` 写入 `capability-led`、`products=grouped`。原始记录见 `artifacts/t061/t054-final-runs-summary.json`、`t054-final-industrial-rerun-summary.json`。三家最终同一方向是模型本次实跑结果，未手工改草稿。
- 最终三站 `check-published` 三档通过：[published-final-after-style-industrial/report.json](../../artifacts/t054/published-final-after-style-industrial/report.json)、[published-final-after-style-export-molding/report.json](../../artifacts/t054/published-final-after-style-export-molding/report.json)。
- 真实工作台输入框证据：[workspace-ui-1790788095591](../../artifacts/t054/workspace-ui-1790788095591/)。首屏更有分量只应用 `set_site_style`；手机四列 240px 请求显示“未修改：站点样式没有应用：375 宽度下「产品」横向超出页面 153px”。早期 API 直调/缺 Chrome 失败产物保留在 `workspace-style-*` 目录。
- 盲评包：[blind/README.md](../../artifacts/t054/blind/README.md)、[blind-key.json](../../artifacts/t054/blind-key.json)，正式包为 3 家 × 2 版 × 1440/768/375 原图与 `-masked.png`；旧/失败构建产物保存在 `blind-prior-*` 和 `blind-build-failures/`，未放进正式 README。

## Resolution

Codex，2026-09-30（纽约时间）。分步提交：`5418d88`（CSS layer 与部件）、`3cb449c`（规则 schema/白名单/序列化）、`190238b`（草稿、operation、桥、三档检查）、`6dde6b2`（提交守卫与 24+1 上限）、`af3b6eb`（三个工程工业方向与提示）。本次最终补充提交随本段文档更新；未推送。代码审查和盲评仍留空，等 Astra 与 gpt-6.1-sol。

做了什么：

- 工程工业增加规格为主、目录为主、工厂实力三个方向配方，每个 12 条白名单规则；目录方向加重参数条，参数对比布局会隐藏首屏参数条（c1）。方向规则通过同一序列化器和三档检查。
- 服务端按资料数量与明确材料行项目计算建议方向，提示中给出方向判断表、部件清单、规则白名单和“首屏更有分量”等已定位样式请求的直接 edit 约束。样式 operation 不占 24 条普通 operation；需求对齐 proposal 上限为 28。
- 三档检查使用候选/无样式基线，在 375、768、1440 检查横向溢出、绘制文字重叠、槽位可见性和对比度；检查队列串行，英文草稿检查中英文。无 Chrome 时样式提交拒绝并说明，混合普通修改继续提交；撤销/重做不调用浏览器。
- 访客桥把方向配方和追加规则写进唯一 `data-sc-site-style` 节点；方向内置的首屏参数部件带有 `spec/spec-label/spec-value` 部件名。

测试与构建：

- `npm run typecheck`：通过。
- `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test`：489/489 通过（`artifacts/t054/final-npm-test.txt`）。
- `npm run build`：通过。
- 三份资料 × 三个方向的三档检查全部通过：[directions-materials-20260930-122154/report.json](../../artifacts/t054/directions-materials-20260930-122154/report.json)。

真实生成与发布：

- DeepSeek 串行生成：工业首轮 `eab8083f…` 未写样式，保留记录；修复服务端建议方向后重跑工业 `6ad1b135…`，最终 `capability-led`、首屏 statement、产品 compare；P3E `5f7b816f…` 最终 `capability-led`、首屏 statement、产品 cards；注塑 `1b984f09…` 最终 `capability-led`、产品 grouped。原始记录：[t054-final-runs-summary.json](../../artifacts/t061/t054-final-runs-summary.json)、[t054-final-industrial-rerun-summary.json](../../artifacts/t061/t054-final-industrial-rerun-summary.json)。首轮 parse/schema 失败行保留在对应 summary。
- 三站 `check-published` 三档通过：工业 [report.json](../../artifacts/t054/published-final-after-style-industrial/report.json)，P3E/注塑 [report.json](../../artifacts/t054/published-final-after-style-export-molding/report.json)。
- 工作台真实对话最终证据：[report.json](../../artifacts/t054/workspace-style-final2-20260930-123203/report.json)。`首屏更有分量` 只提交并应用 `set_site_style`；“产品一行四张，每张至少 240 宽”被拒，原因是“375 宽度下「产品」横向超出页面 153px”。首次缺 Chrome/澄清的失败记录保留在前一目录。
- 盲评包：[artifacts/t054/blind/README.md](../../artifacts/t054/blind/README.md)、[blind-key.json](../../artifacts/t054/blind-key.json)，包含 3 家 × 2 版 × 1440/768/375 的原图与 `-masked.png`；正式包不透露版本含义，调试残留保存在 `blind-build-failures/`。

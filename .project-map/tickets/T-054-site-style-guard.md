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

- DeepSeek 串行记录：工业最终 `d72232c6…` 建议规格为主，模型选择 `capability-led`、产品 `compare`；P3E `92023362…` 建议目录为主，模型选择 `spec-led`、首屏 `statement`、产品 `cards`；注塑 `762782a3…` 建议工厂实力，模型选择 `capability-led`、产品 `grouped`、询盘 `band`。随后三站各走一次真实样式请求：工业“首屏更有分量”、P3E“参数表更紧凑”、注塑“分区之间紧凑一点”，三次均应用 `set_site_style`；样式证据见 [style-requests-final.json](../../artifacts/t054/style-requests-final.json)。三家的方向差异来自最终模型输出，未手工改草稿。原始记录见 `artifacts/t061/t054-final-final-summary.json`；此前首轮与修复重跑记录保留在 `t054-final-runs-summary.json`、`t054-final-industrial-rerun-summary.json`。
- 最终三站 `check-published` 三档通过：[published-final-final/report.json](../../artifacts/t054/published-final-final/report.json)。
- 真实工作台输入框证据：[workspace-ui-1790788095591](../../artifacts/t054/workspace-ui-1790788095591/)。首屏更有分量只应用 `set_site_style`；手机四列 240px 请求显示“未修改：站点样式没有应用：375 宽度下「产品」横向超出页面 153px”。早期 API 直调/缺 Chrome 失败产物保留在 `workspace-style-*` 目录。
- 盲评包：[blind/README.md](../../artifacts/t054/blind/README.md)、[blind-key.json](../../artifacts/t054/blind-key.json)，正式包为 3 家 × 2 版 × 1440/768/375 原图与 `-masked.png`；旧/失败构建产物保存在 `blind-prior-*` 和 `blind-build-failures/`，未放进正式 README。

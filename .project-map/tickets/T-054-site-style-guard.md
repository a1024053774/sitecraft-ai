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

Codex，2026-09-30（纽约时间）。第 1–5 步提交为 `5418d88`、`3cb449c`、`190238b`、`6dde6b2`、`af3b6eb`；返工提交为 `650d584`、`03670c7`、`0b61472`，均未推送。代码审查：待填写。盲评：待填写。

返工实现：

- `border-top/right/bottom/left` 与 `border` 共用 0–4px `solid` 站点颜色校验；`calc/min/max/clamp` 的每个长度字面量都逐项检查单位和上下界，`font-size` 的 `clamp` 允许 12–96px 与受限 vw 项，负值、超上限和嵌套非法值均拒绝。
- 三档站点样式检查以 90 秒总时限覆盖排队、Chrome 启动、渲染和扫描；超时返回“检查没有完成”，混合 operation 的普通修改继续提交。扫描器增加首屏标题单字断行检测；工厂实力方向在手机压低标题字号，标题使用 `keep-all`/`pretty` 避免词中断行。
- 注塑模拟资料删除占位电话和地址，并将「电话」「地址」写入 `missingFacts`；联系条不再满足该资料的版式前置条件，相关渲染测试同步。

返工前后证据：

- 白名单/函数的红态和绿态：`artifacts/t054/rework-red-border-calc.txt`、`rework-red-timeout.txt`、`rework-green-timeout.txt`；首屏断行与注塑缺口红态：`rework-red-orphan.txt`、`rework-red-orphan-molding.txt`，修复后规则、扫描、版式和模拟资料测试均通过。
- 真实 DeepSeek 需求对齐按工业、外贸、注塑依次各跑一次：`artifacts/t061/t054-rework-industrial-summary.json`（`ff393add…`，建议/选择方向与产品对比布局）、`t054-rework-export-summary.json`（`70060b1d…`，规格方向与产品卡片）、`t054-rework-molding-summary.json`（`9c10c17b…`，工厂实力与产品分组）。三次模型调用均记录；工业与外贸首个结构化响应因 schema 字段类型失败后按真实原因记录并由既有调用流程完成，未用静默成功掩盖。
- 三站各做一次真实样式对话并通过提交检查，记录在 [style-requests-rework.json](../../artifacts/t054/style-requests-rework.json)。实际工作台输入框证据在 [workspace-ui-1790790783953](../../artifacts/t054/workspace-ui-1790790783953/)：首屏更有分量只修改样式；375 宽度四列产品请求被拒，原因含「375 宽度下『产品』横向超出页面 153px」。
- 三站发布页三档最新检查通过：[published-rework-20260930-1755/report.json](../../artifacts/t054/published-rework-20260930-1755/report.json)；此前注塑 375 标题溢出的失败报告保留在 [published-rework-20260930-1750/report.json](../../artifacts/t054/published-rework-20260930-1750/report.json)。
- 全量 `npm test` 通过（490/490），`npm run typecheck` 和 `npm run build` 通过；完整日志见 [rework-npm-test-final.txt](../../artifacts/t054/rework-npm-test-final.txt)。
- 最新盲评包为 [blind/README.md](../../artifacts/t054/blind/README.md)、[blind-key.json](../../artifacts/t054/blind-key.json)，随机代号为 `99df`/`c52f`，三家各含带样式与去掉样式的 1440/768/375 原图及 `-masked.png`；上一包完整移至 [blind-r1](../../artifacts/t054/blind-r1/)，中间重建包保留在 `blind-prior-*`。

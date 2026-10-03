---
id: T-079
title: 商业条款 tracer：草稿字段 → operation → 模型抽取 → 事实检查 → 预览渲染
type: build
status: closed
blocked_by: [T-078]
claimed_by: terms-build
supersedes:
---

## What to build

T-078 的第一条线。用「商业条款」一项打通每一层，页面上先用一个朴素的默认布局，好看的布局交给 T-080。

- **草稿字段**：`content.commercialTerms`，条目列表，每条有稳定 `id`、`kind` 和 `value`。`kind` 只能取固定词典里的种类（至少：起订量 MOQ、交期、产能、贸易条款、付款方式、包装；需要新种类时加进词典，不让模型自造），种类的中英文名称由词典给出，不进草稿。`value` 是 `{zh, en}`，只写资料里的事实；资料没有的种类不出现。条目寻址按 T-069 的稳定 id，不按序号。
- **operation**：整组替换和单条更新 / 删除，都可撤销（inverse 正确），走 `commitOperations`；写入非缺口英文时按现有 `englishReady` 规则。
- **模型抽取**：整站生成时，模型只把资料里明确写出的条款写进来（例如工业资料「MOQ：20 台」、注塑资料「注塑件 5000 件起」「FOB 宁波和 EXW」「月注塑能力约 600 万件」）；资料里写「询盘后确认、没有具体天数」时，值就写这句事实，不编天数。operation 校验拒绝词典外的种类、空值和资料外的数字（按现有事实校验的做法）。
- **事实检查**：`scripts/published-facts.mjs` 把商业条款的每条值列为访客页必须能找到的事实（中英文），检查只加严。
- **预览渲染**：区块库新增区块「商业条款」（加入 `sectionOrder` 可排顺序和显隐），一个默认布局：种类名 | 值的行；没有条目时整块隐藏；四个样子都能用，只用 `--site-*` token；每个条目的值是唯一槽位（T-076 的唯一性检查要覆盖新区块）。
- **文档**：CONTEXT（已写术语）、spec、mainline 的布局清单同步。

不做：好看的布局（T-080）、设备（T-081）、质检流程和沿革（第二批）。

## Acceptance

- [x] 测试先写、改动前先失败（父提交上能加载、行为级失败）：schema 拒绝词典外种类；operation 写入 / 更新 / 删除 / 撤销正确；事实检查在缺少一条条款值时失败；区块无条目时隐藏、槽位唯一
- [x] 真实 DeepSeek：三份模拟资料各走一次完整需求对齐生成，记录写入的商业条款（`artifacts/t079/`）：每条都能在资料里找到、没有编造数字、资料没有的种类没有出现
- [x] 三家生成站 `check-published` 中英文三档通过（含新事实检查）；工作台里对一条条款发一次真实对话修改再撤销，1440 / 768 / 375 截图看过
- [x] `npm run typecheck`、`npm test`、`npm run build` 通过；代码审查通过；Claude 验收

## Resolution

2026-10-03，Astra 第三次复审 NO_GO 后在最终提交 `d5d0f96c4d5d6c0d30512d2b002fc480bbcd2fc8` 修复：

- 中文值只允许是去掉指令与行首标签后的同一句完整分句；kind 词表和英文代码只看该句，代码大小写归一。
- 英文数字按规范化多重集对应，单位按中英对照表核对（天/day、周/week、月/month、年/year、件/pc、台/unit/set/machine、套/set、万件/10,000 pcs、t/ton、kg/kg）；英文地名和主体翻译留在本票范围外。
- 五条 Astra 行为红证据在 `0317e50` 基线上保存于 `artifacts/t079/red-rework4-*.txt`；修复后商业条款测试 23/23 通过，六条真实条款仍全部接受。
- 最终真实 DeepSeek 原始 operation 保存在 `artifacts/t079/summary.json`，三份均 applied，注塑包含 trade_terms。
- 三家中英文三档发布检查通过，事实缺失为 0：`artifacts/t079/published-check-rework3/report.json`。
- `npm run typecheck`、`npm run build` 通过；全量测试 625 通过、6 项 vendor 资产检查失败，日志为 `artifacts/t079/npm-test-final-third.log`。

## 独立审核与验收（2026-10-03 EDT）

专门执行会话 terms-build（gpt-6.1-sol xhigh fast）在 worktree `../sitecraft-ai-terms`（分支 `commercial-terms`）实现。Astra 六轮审查（`artifacts/review-astra-t079.md`）：首审 NO_GO（单条更新绕过 kind 唯一、英文数字不核对、英文 gap、贸易条款没抽到）→ 复审 NO_GO（token 散落匹配可跨事实拼接、指令文本污染）→ 第二次复审 NO_GO（英文夹带代码、整句命中不查 kind、同片段拼数字）→ supervisor 改为「中文逐字原文子串 + kind 标签词表 + 英文数字 / 代码 / 单位对应」→ 第三次复审 NO_GO（截掉否定词、英文单位、小写代码、借相邻句上下文）→ 第四次复审 NO_GO（代码白名单漏 CNY/RMB）→ 第五次复审 PASS（`937e2a7`）。英文地名 / 主体是否译对按 [T-082](T-082-english-fact-fidelity.md) 记为已知限制。

真实结果（`937e2a7` 前最后一次真实轮次在 `1c60443`，原始 operation 在 worktree `artifacts/t079/summary.json`）：工业 MOQ 20 台；外贸交期「批量询盘后确认」；注塑 MOQ、交期、产能、贸易条款（FOB 宁波 / EXW / CIF），全部能在资料原文找到。

合回主线 `b4b9dc0`。合并后全量 639/640，唯一失败是 `tests/short-path-variants-browser.test.ts` 只取前 8 个区块、新增商业条款后认证被挤到第 9 个——codex-build 定位后改为断言完整 9 个顺序并分别检查商业条款与认证可见（`7509046`，Claude 看过 diff，是加严不是放宽）；之后全量 640/640、typecheck、build 通过（`artifacts/merge-b4b9dc0/`）。主线 `check-published`：三家商业条款站 + 工业专家站 + 四布局副本站 + 三家基线站中英文三档 24/24 通过。

发现的测试基础设施问题：12 个浏览器测试写死 `127.0.0.1:3034`，在 worktree 里跑时实际测的是主工作区的代码，所以 worktree 里的浏览器测试结果不能当该分支的证据（本票和 T-072 都已在合并后于主线重新验证）。另开 [T-083](T-083-browser-tests-honor-base.md)。Claude 验收关闭；关闭专门执行会话（worktree 保留，内有生成的站点数据）。

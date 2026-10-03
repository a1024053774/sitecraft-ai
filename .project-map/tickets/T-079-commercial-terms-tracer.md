---
id: T-079
title: 商业条款 tracer：草稿字段 → operation → 模型抽取 → 事实检查 → 预览渲染
type: build
status: open
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
- [ ] `npm run typecheck`、`npm test`、`npm run build` 通过；代码审查通过；Claude 验收

## Resolution

2026-10-03，Astra 第二次复审 NO_GO 后在最终提交 `1c60443fb701ca9e0d7cb681071826f63830a1d6` 修复：

- 商业条款中文值必须是去掉包装指令、去掉行首 `字段名：` 后的同一原始资料行/句连续子串；源片段必须命中可审查的 kind 标签词表。删除 token 集合旁路，精确命中也经过 kind 检查。
- 英文值只允许翻译；数字按规范化多重集对应（千位分隔、范围符号及万/million 表示可归一化），英文缩写/代码必须出现在中文值或同一源片段。
- 三个 Astra 例子的红证据在 `c29e19c` 上保存于 `artifacts/t079/red-rework3-english-extra.txt`、`red-rework3-kind-bypass.txt`、`red-rework3-mixed-capacity.txt`，均为行为级失败；修复后商业条款测试 18/18 通过，六条真实资料条款仍能写入。
- 最终真实 DeepSeek 命令：`SITECRAFT_ENV_FILE=/Users/luckye/Documents/Code/sitecraft-ai/.env.local T079_PACKS=industrial,export,molding node --experimental-strip-types artifacts/t079/generate.mjs`。三份均 `applied`，原始 operation 在 `artifacts/t079/summary.json`；注塑四条包含 `trade_terms`，资料/数字核对均 true。
- 最终三家 `check-published` 中英文 1440/768/375 通过，事实缺失为 0：`artifacts/t079/published-check-final-rework3/report.json`。
- `npm run typecheck`、`npm run build` 通过；全量测试 617 通过、6 项 vendor 资产检查失败，日志为 `artifacts/t079/npm-test-final-rework2.log`。

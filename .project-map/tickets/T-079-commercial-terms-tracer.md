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

2026-10-03 11:00 UTC，最终提交 `d29eb89429a93652dfd6249ee278719da0442960`。

- 先写测试的红证据：父提交 `9f2bd28c9784e8f0127544562cc24879e1925d63` 上运行 `node --test --experimental-strip-types tests/commercial-terms.test.ts`，5 个行为断言均失败且测试已正常加载；最终同一命令 5/5 通过。
- 相关聚焦检查：`npm run typecheck` 通过；商业条款、区块库、唯一槽位、事实检查、AI prompt、operation 和三档样式测试通过；`npm run build` 通过。
- DeepSeek 证据：`SITECRAFT_ENV_FILE=/Users/luckye/Documents/Code/sitecraft-ai/.env.local T079_PACKS=industrial,export,molding node --experimental-strip-types artifacts/t079/generate.mjs`；`artifacts/t079/summary.json` 记录三份资料均 `applied`，条款值资料/数字核对为 true，未写资料外种类；没有保存资料原文、prompt 或密钥。
- 发布页证据：`SITECRAFT_BASE=http://127.0.0.1:3037 CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node scripts/check-published.mjs --out artifacts/t079/published-check-final3 ...`，中英文 1440/768/375 全部通过，事实缺失为 0。
- 工作台证据：真实对话把 MOQ 从 20 台改为 30 台并保存，随后撤销恢复 20 台；报告显示已更新/已撤销商业条款，无 missing warning。截图与报告在 `artifacts/t079/workspace-screens-final/`。
- 完整套件：设置 `CHROME_PATH` 后 `npm test` 为 606 通过、7 失败；7 项是 vendor 子模块未初始化的 fresh/template 资产检查和 T-077 工作台动效锁定测试，已保留日志 `artifacts/t079/npm-test-final.log`，因此该勾选项保持未勾选。

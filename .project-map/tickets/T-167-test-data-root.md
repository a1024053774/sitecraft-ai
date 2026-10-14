---
id: T-167
title: 全量测试使用独立的临时数据目录
type: build
status: open
blocked_by: [T-166]
claimed_by:
supersedes:
---

## Why

全量测试经 `SITECRAFT_BASE` 指向主目录 3034 dev server，测试站写进主目录 `.sitecraft-data`（2026-10-14 已约 4,200 个 code-sites，每轮数百个），拖慢首页并混入用户的真实站点。2026-10-14 构思主控决定：全量测试用独立数据目录，主目录 3034 只留给真实站点。已有测试站删不删由负责人决定，本票不动。

## What to build

1. 标准测试入口每轮建一个临时数据目录，测试用的 dev server（随机端口）和测试进程都设 `SITECRAFT_DATA_ROOT` 指向它；code-site、conversation、annotation、lead 各 store 已读该变量，不另加兼容层。
2. 测试只读 `SITECRAFT_BASE`、不写死端口的规则不变；测试开始前核对 dev server 的数据根与测试进程一致（沿用 health 的 testIdentity），不一致即拒绝运行，防止写进主目录。
3. 同步 AGENTS.md「验收」中的标准测试命令与本票。不删除主目录任何数据。

## Acceptance

- [ ] 跑一轮标准全量后，主目录 `.sitecraft-data/code-sites` 数量不变；同一检查在父版本上失败（数量增加）
- [ ] 数据根不一致时测试拒绝运行（有测试）
- [ ] 全量 test、typecheck、build 通过；独立 sol 实例代码审查通过

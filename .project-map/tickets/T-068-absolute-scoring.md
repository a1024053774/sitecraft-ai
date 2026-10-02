---
id: T-068
title: 绝对评分与成对比较（gpt-6.1-sol high 盲评）
type: build
status: open
blocked_by: [T-067]
claimed_by: codex-scorer
supersedes:
---

## What to build

没参与 T-065、T-066、T-067 的 Codex 实例（gpt-6.1-sol high），只读 `artifacts/t067/blind/`，按包里 README 先逐页绝对评分、再做成对比较，结果写到 `artifacts/t068/scores.md`。评分者不读包目录以外的任何文件（仓库代码、票、对照表、git 历史）。

评分写完后，由 Claude 用对照表解码，按 T-064 写好的判读规则给出结论：
- 每个页面的各项分、合格与否、硬伤；
- 基线 6 页和专家 3 页的分数对比；
- 成对比较：交换位置后结论一致的才算数，翻转的记为不稳定；
- 采购任务的正确率（对照另存的答案）；
- 专家「想做但做不到」清单和评分者指出的问题有哪些重合。

## Acceptance

- [ ] `artifacts/t068/scores.md` 覆盖 9 页的绝对评分、硬伤、采购任务和 18 道成对比较
- [ ] 解码结果和判读写进本票 Resolution，并指出按 T-064 规则下一步走哪条
- [ ] 结论里写明：评分者和专家同一型号、没有人工校准、样本只有三家公司，只能支持方向判断

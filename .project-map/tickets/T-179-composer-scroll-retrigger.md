---
id: T-179
title: 批注浮层腾位后，用户手动滚动不应被再次推回
type: build
status: open
blocked_by: []
claimed_by: Codex
supersedes:
---

## Why

T-175 第三轮独立审查（2026-10-18）读源码推断：批注浮层为避开历史回看栏和「返回当前版本」自动腾位后，用户在预览里小幅往上滚，可能再次触发腾位，把阅读位置推回去。尚未实测，但若成立会直接伤到「修改/回看」的手感。

## What to build

1. 先实测：375/768/1440 三档，打开批注线程、触发一次腾位后，用真实滚轮小幅上滚与下滚，记录预览滚动位置是否被程序改写。
2. 不复现：把对照断言留作回归，写明结论关票。复现：只在用户主动滚动后停止自动腾位，直到用户再次点选目标或重新打开浮层；不改生成站代码，不放宽 T-162/T-175 已有的遮挡与可见性断言。
3. 顺带把 T-175 移交的小项改掉：「同一节点多占位」用例的两个预期片段改成两个不同出处。

## Acceptance

- [ ] 手动滚动对照断言三档成对（自动腾位仍生效 / 用户滚动后不被推回），复现时先在父版本失败
- [ ] T-162 mobile-reveal、scroll-edge、review-regressions 与 T-175 遮挡断言回归通过，截图逐张看过
- [ ] 不调用 DeepSeek；typecheck、test、build 通过；独立 fast 审查通过

## Resolution

**INCOMPLETE，2026-10-18（UTC）**。已实测复现并保留父版本红灯；修后主滚动断言通过，但补充的重新展开／点选断言失败，按负责人「任何一项失败都停下报我，不重跑掩盖」停止后续重任务。票不关闭，验收不勾选，独立 fast 审查留给主控另派。

目标是保留首次腾位并交还用户的阅读位置；不改生成站 HTML/CSS、不放宽 T-162/T-175 的既有断言。本票只是工作台的局部交互，不跨存储、领域和 API 层，故无需另建 Tracer bullet；沿用批注线程／批注草稿的 Ubiquitous language，不新增浅包装或平行接口，保持 Deep modules 的边界。

实测与红灯都在父提交 `4781659` 的产品代码上运行。修后测试使用本票提交 `wip(t179): 保留滚动复现与未通过的修复候选` 中的代码及测试；测试时 HEAD 仍为 `4781659`，尚未提交。三轮均经标准 npm test 入口，运行者只设置下述 CHROME_PATH，预检执行 memory_pressure 和 ps；每轮的命令、时间、退出码、进程记录及复制后的入口报告在对应目录。

```sh
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell python3 artifacts/t179/run-check.py baseline-measurement npm test -- tests/t179-composer-scroll.test.ts
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell python3 artifacts/t179/run-check.py parent-red npm test -- tests/t179-composer-scroll.test.ts
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell python3 artifacts/t179/run-check.py focused-green npm test -- tests/t179-composer-scroll.test.ts
```

| 运行 | UTC 时间 | 结果与证据 |
| --- | --- | --- |
| 只测量，不改产品 | 02:03:51–02:04:13；空闲 69% | 3/3 完成；[报告](../../artifacts/t179/baseline-measurement/report.json)、[测量脚本与数据](../../artifacts/t179/measurement-1792289031509-45580/) |
| 父版本需求断言 | 02:04:53–02:05:14；空闲 68% | 375 通过，768/1440 在保留原生位移处预期失败；三档首次腾位均通过；[报告](../../artifacts/t179/parent-red/report.json)、[脚本与数据](../../artifacts/t179/measurement-1792289094226-46179/) |
| 修后定向检查 | 02:06:18–02:06:40；空闲 70% | 1/3 整例通过；首次腾位及上／下滚核心断言三档均通过，补充恢复检查两档失败；[报告](../../artifacts/t179/focused-green/report.json)、[完整失败日志](../../artifacts/t179/focused-green/tests.log)、[脚本与数据](../../artifacts/t179/measurement-1792289178588-47468/) |

首次测量，上滚输入为 -48，scrollTop 与浮层 top 如下（CSS px）；外层预览 scrollTop 始终未变。768、1440 捕获到滚轮之后的程序 scrollBy 调用；下滚 +48 三档均完整保留位移。

| 宽度 | 内层 scrollTop 前 → 后 | 外层 scrollTop | 浮层 top 前 → 后 | 结论 |
| --- | --- | --- | --- | --- |
| 375 | 2271 → 2223 | 203 | 761 → 761 | 未推回 |
| 768 | 1927 → 1919（原生先到 1879） | 85 | 739.875 → 749 | 被程序推回 40 |
| 1440 | 1673 → 1658（原生先到 1625） | 0 | 738.015625 → 749 | 被程序推回 33 |

成对红灯场景增加了一句真实意见，以确保 1440 也实际发生首次腾位。修后同场景上滚结果为：375 `2271→2223`、768 `1946→1898`、1440 `1695→1647`，均无后续程序 scrollBy；下滚均加回 48，外层位置不变。采用 trusted 原生 wheel、scrollend 和帧间几何稳定等待，不用固定 sleep。

候选修改仅在 CodePreviewSelection 记录原生滚轮、触摸移动、滚动键或滚动条操作，停止后续自动腾位；点选／定位／展开时重置。工作台传入收起状态。T-175「同一节点多占位」改为两个不同原句，并逐项核对 snippet 与 quote；此项已改但尚未运行回归，不能报通过。spec 只补行为规则，AGENTS 只补一句同规则。

本轮失败与未决项：375 在重新展开后的 `首次腾位须避开目标` 断言失败；768 在重新点选后的 `须实际触发预览自动腾位` 断言失败；1440 完成全部定向断言。尚未判定这两个失败各自属于产品缺陷还是新增用例的场景／观察条件问题，不通过删断言或重复运行掩盖。wheel 以外的主动滚动输入尚未单独实测。

共 28 张本票截图均逐张打开：基线 9 张、父版本红灯 9 张、修后 10 张，均有真实内容；仅作交互与可见性检查，未自评审美。原失败报告和临时数据根保留，入口自启服务及 Chrome 均已退出。

**未运行**：T-162 mobile-reveal、scroll-edge、review-regressions，T-175 thread-placement 和 stale-placeholder，runner 回归、typecheck、同提交全量及 build。未读 .env.local、未调用 DeepSeek、未使用 rm 命令、未写主目录 .sitecraft-data、未推送。Next 自动改动 tsconfig.json 留在工作树且不提交。

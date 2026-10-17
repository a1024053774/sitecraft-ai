---
id: T-175
title: 补充新事实后提示其他页面同项的「待补充」
type: build
status: open
blocked_by: []
claimed_by: Codex
supersedes:
---

## Why

负责人 2026-10-17 决定开票。T-173 盲评发现：用户在首页批注里补了「外带包装费每单2元」，修改版正确去掉首页的「待补充」，但菜单页「米饭与收费」仍写「外带包装费待补充」。批注只改首页，不算越界，可两页信息不一致，用户自己很难发现。

## What to build

1. 版本存成后，如果本次用户消息带来新的出处原句（合同 D 的「你的第 N 条消息」），用确定性规则在**其他页面和本页范围外**查找含「待补充」的文字，且其前面紧邻的事项名（如「外带包装费」）逐字出现在本次新原句里，才算同项。不调用模型做匹配，不猜近义词。
2. 命中时在工作台对话里给一条提示：列出页面名和原文片段（如「菜单页还写着『外带包装费待补充』」），附「一起更新」按钮。按钮只把这些位置作为批注草稿加入（沿用 T-163 草稿与 T-164 多区块入口），由用户确认发送；不自动改站，不新建版本。
3. 没命中不提示；同一版本同一位置只提示一次，刷新后从版本记录恢复，不重复弹。
4. 同步 `spec.md`、`CONTEXT.md`（术语「同项待补充提示」）。

## Acceptance

- [x] 先列失效方式再写测试，测试先在父版本失败：事项名不逐字出现时不提示；本次修改范围内的「待补充」不重复提示；跨页命中；刷新不重复；按钮只加草稿不存版本
- [x] 用 `3e52f683`（禾巷小馆（批注验收））的 v2 只读副本，以本地替身重放首页包装费批注，工作台出现菜单页提示；1440/768/375 截图逐张看过
- [ ] 不调用 DeepSeek；typecheck、test、build 通过；独立 sol 审查通过

## 失效方式与验收边界

实施前列出（2026-10-17，父版本 d7e0aa2）：
- 旧消息、上传、原始资料、未通过核对或没有出处原句的请求误触发；本次新增消息未被采用为出处却触发。
- 用近义词、子事项、跨标点/换行/元素拼接匹配，或空事项名、单字符事项名误匹配；遗漏同一节点的多个占位。
- 本次单区块、多区块并集或整页范围内重复提示；跨页、本页范围外漏报。
- 同一位置被多条出处重复登记；刷新重新生成提示、增加版本或丢失提示；旧版本锚点被当作当前位置。
- 「一起更新」直接发送、调用模型、存版本，或覆盖已有/发送中的草稿；重复点击、刷新重复添加草稿。
- 草稿目标不是原区块/文字快照，意见缺少采用的原句，无法沿用单条及多条批注入口。

切分规则：每个 DOM 文本节点独立扫描；「待补充」前向左遇 Unicode 标点、换行或节点边界即止，首尾空白去除；事项名不足两个 Unicode 字符不匹配。不规范化、不猜同义词，完整事项名必须逐字出现在本次新增消息的已通过出处原句里。只扫描可沿现有批注合同定位的 main 正文区块。

## Resolution

执行状态：INCOMPLETE。构建、typecheck、入口回归与定向 6 项通过；获准执行的首轮全量为 796 通过、3 失败，T-175 三档端到端均在存版前遇到局部动态状态检查超时，原因待查。独立 sol 审查由主控另派，票保持 open。实现、文档与失败结论合入同一 T-175 本地提交，父提交 d7e0aa2，提交 SHA 见交付回报。

- 2026-10-17 13:09 UTC，父版本 d7e0aa2 的初次完整红测执行 5 项、5 项按预期失败：提交后提示数组为空；三档工作台提示数为 0。生产 chat 均完成存版，未因替身、导入或环境错误失败。完整日志 `artifacts/t175/parent-red.log`，报告 `parent-report.json`；中断轮另保留在 `parent-interrupted/`，不作为完整红测。
- 13:16 UTC，最终 6 项用例串行还原 d7e0aa2 的三个产品接入文件后全部按预期失败，含更换事项名的独立输入；还原期间不跑其他测试，结束原样恢复产品改动。日志 `artifacts/t175/parent-final-red.log`，报告 `parent-final-report.json`。
- 13:17 UTC，同一最终 6 项用例在本候选全部通过，typecheck 通过；日志 `artifacts/t175/targeted-candidate.log`、`typecheck-candidate.log`，标准入口报告 `artifacts/t167/test-run-1792242973606-12932/report.json`。两次红测及候选定向使用同一命令：`CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t175-stale-placeholder.test.ts`；类型检查为 `npm run typecheck`。
- v2 来源与 T-173 原批注在 `tests/fixtures/t175-restaurant.json`，只读取主工作区一次；每个用例只向标准入口新建并核对的临时根复制。生产 chat POST 与唯一提交入口处理修改，临时 HTTP 桥仅控制 after 调度及本地模型响应，不作实际 Next after 或真实模型能力通过的声明。没有调用 DeepSeek，没有读取 `.env.local`。
- `artifacts/t175/run-1792242974584-12937/prompt-{1440,768,375}.png` 三张提示截图均已逐张打开：菜单页原文与「一起更新」可见。对应的三张 `draft-*.png` 也已逐张打开；375 草稿截图只记录意见框和部分区块，不作为完整区块可见性的证据。端到端另验证了跨页回看意见、旧版不改、已有草稿保留、重复点击/刷新不重复添加、模型请求数和版本数不变。
- `spec.md`、`CONTEXT.md`、AGENTS、README 与 mainline 已同步；project-map status 无过期 living doc。Next 自动改动的 `tsconfig.json` 留在工作树，不提交。
- 13:24 UTC，重任务前 `memory_pressure` 空闲 54%，`ps` 无其他 Chrome 测试/Next 测试进程。按负责人指定顺序执行 `SITE_STORE=fs npm run build`，退出 0；日志 `artifacts/t175/build.log`。随后单独运行仓库要求的 `node --test --experimental-strip-types scripts/t167-runner-regressions.ts`，4/4 通过，日志 `runner-regressions.log`。
- 全量前再次核对内存空闲 50% 且无其他 Chrome 测试进程，仅设置 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test`。13:29:41 UTC 完成：115 文件、799 项，796 通过、3 失败、0 跳过，退出 1。失败均在 `tests/t175-stale-placeholder.test.ts:145`：1440/768/375 的真实 chat 任务报「局部动态状态检查超时，本次未保存版本。」，任务没有存成新版本；不能以此前定向通过代替全量通过。未重跑、未改变条件或绕过检查。
- 本轮完整日志 `artifacts/t175/full-test.log`；报告及每文件统计另存 `full-test-report.json`、`full-test-summaries.ndjson`；原始报告、检查诊断与 dev 日志在 `artifacts/t167/test-run-1792243472424-18680/`，失败数据根为 `/var/folders/7v/58svbpnj5k91zdnm5zggb38h0000gn/T/sitecraft-test-Umxvng`，均保留。负责人已另行授权：先提交此 INCOMPLETE 快照，再只读排查现有并发机制与本轮 timings；修复后先定向验证，下一轮全量/build 仍须 READY_FOR_HEAVY 后单独放行。

---
id: T-172
title: 英文保真误拒「ISO 9001 certified.」
type: build
status: open
blocked_by: [T-169]
claimed_by: Codex
supersedes:
---

## Why

T-169 执行中发现：T-151 的英文机械保真检查把「取得 ISO 9001 认证。」的正确译文「ISO 9001 certified.」判为不符而拒收。这是 T-151 规则本身的缺陷，不是 T-169 引入的。2026-10-14 构思主控决定另开小票、低优先级；T-169 只把它记成已知缺口。

## What to build

1. 用 T-169 记录的这条真实样本复现，找出是哪条保真规则误判（含数字记号、型号/单位抽取、缩写或公司名槽位等），在该规则层修正。
2. 不放宽其他保真保护：数字换序、新增数字、单位换算、整页修正等既有红例仍须拒收。

## Acceptance

- [x] 该样本先在父版本上被拒（红），修后通过（绿）
- [x] `tests/t151-fidelity-rules.test.ts` 等既有保真用例全部仍通过；不调用 DeepSeek
- [ ] 全量 test、typecheck、build 通过（主控本轮执行）
- [ ] 独立 sol 实例代码审查通过

## Resolution

- 根因：`tokens()` 的通用量值正则把「ISO 9001」拆成纯字母 `ISO` 与数值 `9001`，又把后面的「认证」或 `certified` 吸收为未知单位，导致中英文得到不同的 `quantity` 记号。
- 修复：在量值解析前，仅将独立的全大写字母缩写加分隔数字（如 `ISO 9001`、`GB 50016`）作为一个完整 `marker` 抽取；已有混合记号（如 `IP65`）和其他数字、单位、邮箱、网址规则不变。
- 回归测试新增 `tests/t172-iso-fidelity.test.ts`：按需求验证真实样本与 GB/IP 记号通过，`ISO 9002` 改号拒收。
- 下列原始证据属于已被主控 NO_GO 的 `e3435f4`，只保留作失败历史，不能替代本轮修复后的全量验收。
- 证据（2026-10-15 16:20 EDT，基于父版本 `3f88646`）：
  - 修改前：`CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node --test --experimental-strip-types tests/t172-iso-fidelity.test.ts`，真实样本 1 项失败并报「保真：含数字记号、数值与单位、邮箱或网址不一致」，改号拒收项通过。
  - 修改后同一命令：2 项通过。
  - `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t172-iso-fidelity.test.ts`：2 项通过。
  - `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t169-citations-browser.test.ts`：7 项通过，中英切换真实步骤通过。
  - `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t151-fidelity-rules.test.ts tests/t151-paragraph-repair.test.ts tests/t151-short-translation.test.ts tests/t151-english.test.ts`：62 项通过；数字换序、新增数字、单位换算、整页修正等既有红例仍拒收。
  - `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test`：530 项通过；`npm run typecheck`：通过；`npm run build`：通过。
  - 首次标准入口因工作树未安装依赖而提前退出，保留 `artifacts/t167/test-run-1792094992525-1745/dev.log`；按锁定文件 `npm ci` 后重新运行通过。
- 独立 sol 实例代码审查按本次执行指令未启动，故本票保持 open，不能把实现自查写成审查通过。

## NO_GO follow-up

- 主控对 `e3435f4` 的 P1：旧正则只把 `GB/T 50016` 的 `50016` 当作数值，`GB/T` 与 `GB/R` 因而被放过。修正为在量值解析前整体抽取「至少两位大写前缀 + `/` 或 `-` 连接的大写段 + 分隔数字」的完整 marker，覆盖 `GB/T`、`GB/Z`、`JIS-B`、`ISO/IEC`；任何前缀字母、连接符或数字改变都会产生不同 marker。
- 红证据（修复前，标准入口）：`CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t172-iso-fidelity.test.ts`，`GB/T 50016 → GB/R 50016` 实际返回 `applied`，测试失败。
- 绿证据（修复后，同一入口）：同一命令 22 项测试全部通过，且每项都经 `commitSiteCode` 英文版提交路径核对；覆盖 ISO 改号/换序/增删、GB/T 前缀变化、分隔变体、IP65 与单位混淆、多个型号、公司英文名与型号重叠。
- 相关回归：`npm test -- tests/t151-fidelity-rules.test.ts tests/t151-paragraph-repair.test.ts tests/t151-short-translation.test.ts tests/t151-english.test.ts tests/t169-citations-browser.test.ts` 共 69 项通过；`npm run typecheck` 通过。未运行全量 test/build，按主控指令留给主线。

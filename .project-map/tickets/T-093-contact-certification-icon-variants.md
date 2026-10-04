---
id: T-093
title: 联系方式和认证区块的图标变体，盲评决定去留
type: build
status: closed
blocked_by: [T-092, T-081]
claimed_by: blocks-build
supersedes:
---

## What to build

在 [T-092](T-092-icon-set-and-registry.md) 的注册表上，为联系方式（`lib/blocks/fragments/contact.ts`）和认证（`lib/blocks/fragments/sections.ts`）各做一个带图标的变体。走 T-073 区块池流水线（区块 HTML/CSS 是 sonnet-blocks 的范围），T-081 合回主线后再开始。

- 图标是辅助锚点：低对比、在文字旁边，不当主视觉；每个图标旁都有文字，不出现只有图标的按钮或空的装饰位。
- 图标由区块固定挂载，按 slot 唯一命中；事实文字照旧来自草稿。资料里没有的联系方式或证书不显示图标。
- 四个样子都要成立（工程工业用直角端点变体，如 T-092 规范有）。

## Acceptance

- [x] 测试先写，并在父提交上能加载、在断言处失败：资料缺某项联系方式时对应图标不出现；图标版与文字版槽位一一对应
- [x] 四个样子 × 1440 / 768 / 375 截取文字版与图标版的单区块裁切图，存 `artifacts/t093/`；独立审核 agent 盲评（不告诉哪张是新的），不比文字版好就删除图标变体，结论写进 Resolution
- [x] 三家 `check-published` 中英文三档通过；`npm run typecheck`、`npm test`、`npm run build` 通过；代码审查通过；Claude 验收

## Resolution

2026-10-04，盲评结论已落实：保留联系方式 `contact:icons`，删除认证 `certifications:icons`。认证图标变体、对应 catalog 声明、`.sitecraft-cert-icons` CSS/mask 和专属测试均未进入本次提交；认证卡片文字版继续保留。联系方式图标仍由 `lib/blocks/fragments/icon-svg.ts` 读取 T-092 注册表几何，不在区块里手写路径。`scripts/render-block.mjs` 保留 honeypot 的屏幕外扫描豁免。

- 红测复核：先将未提交工作保存到 `stash@{0}`，在 `44ad099` 临时取回 `tests/block-contact-icons.test.ts` 执行 `SITECRAFT_BASE=http://127.0.0.1:3035 CHROME_PATH=... node --test --experimental-strip-types tests/block-contact-icons.test.ts`，6/6 按预期失败；复核日志：`artifacts/t093/red-contact-icons-rechecked.txt`。
- 合并：`git merge family-kit-assembly` 快进至 `1b83785`，无冲突；随后恢复 stash 并按盲评删去认证变体。
- 本票相关测试：联系方式图标测试 6/6 PASS；`npm run build` PASS；`npm run typecheck` PASS。
- 全量旧证据：`artifacts/t093/npm-test-full-post-merge-3035.log` 为 774 PASS / 1 FAIL；最终 SHA 绑定的重跑见下一条。误用默认 3034 的失败日志 `artifacts/t093/npm-test-full-post-merge.log` 也保留，未覆盖。
- 最终证据绑定（2026-10-04，代码提交完整 SHA `1ff82593e9779f14898d5b9467c5b58391174268`）：`artifacts/t093/build-1ff82593.log`（首行含 `SHA=... UTC=2026-10-04T13:01:40Z COMMAND=npm run build`，`EXIT_CODE=0`）；`artifacts/t093/typecheck-1ff82593.log`（首行含 SHA、UTC、`COMMAND=npm run typecheck`，`EXIT_CODE=0`）；`artifacts/t093/npm-test-1ff82593.log`（首行含 SHA、UTC=`2026-10-04T13:02:53Z`、完整 3035 命令，773 PASS / 2 FAIL：T-100 缺历史证据，workspace motion 既有波动）；`artifacts/t093/check-published-1ff82593/run.log`（首行含 SHA、UTC=`2026-10-04T13:07:45Z`、12 站命令，`EXIT_CODE=0`），对应 `report.json` 为 12 站 × 3 档共 36 行 / 0 failures，对照基线 36 行 / 0 failures。
- 主线合并后重验基准：`b60f36085e4659d59006a2c97dcaee5ff4bf3f56` 的全量证据为 `artifacts/t103/final/npm-test-b60f360.log`，780/780 PASS、0 FAIL；该提交包含 `1ff8259` 的全部 T-093 代码，且没有改动联系方式图标实现。此前 `1ff8259` 上的 773/775（T-100 夹具缺失、workspace motion 波动）属于旧主线状态，以主线修复后的 780/780 为本票全量依据。其余最终主线检查见 `artifacts/t103/final/check-published-b60f360/run.log`：13 站 × 3 档共 39 行、0 failures。独立审核尚未由主控完成，`/root/t103_astra_review` 与 `/root/t103_blind_review` 结论仅作执行会话自查。

### 合回主线与关闭（Claude，2026-10-04 EDT）
- 独立盲评（codex-taste）：联系方式图标 KEEP、认证图标 DROP（已删除）。Astra r1 NO_GO（证据未绑定），r2 PASS（`artifacts/review-astra-t093-r2.md`）。随 blocks-pool `095337d` 合入主线 `104982b`。主工作区 3034 在 `104982b`：build、typecheck 通过，全量 789/789；主线 12 站 + 真实注塑站 `t097-real-936749b-molding` 共 13 站 `check-published` 39 行 0 失败，逐行测量不少于基线（`artifacts/merge-104982b/`）。 Claude 验收关闭。

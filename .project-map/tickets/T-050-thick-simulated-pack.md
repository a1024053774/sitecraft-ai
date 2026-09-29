---
id: T-050
title: 第三份厚模拟资料包
type: build
status: open
blocked_by: []
claimed_by: cloud
supersedes:
---

## What to build

现有两份模拟资料包（`lib/simulated-packs.ts`）故意留了缺口，用来测「待补充」。另加一份资料厚的模拟包，用来看页面的上限、给 T-048 的区块库和盲评用。现有两份不改。

新包：注塑模具与精密注塑件厂（国内加外贸），和减速机、流体接头都不同行。内容：

- 资料性质：模拟；核验记号 `P3T-` 加 4 位；公司名带 `P3T`。
- 公司简介 2–3 句；沿革 3–5 个年份节点。
- 5 个产品，每个 5–8 项参数（名称、数值、单位）。
- 产能数字、主要加工与检测设备、质检流程 4–6 步、应用行业 4–6 条。
- 认证：已有、认证中各至少一项。
- 常见问题 4–6 条；MOQ、交期。
- 联系方式：邮箱用 `.test` 域；电话、地址明显虚构。
- 仍留 1–2 个缺口（客户名单、评价），写进 `missingFacts`。不写客户名、评价、奖项、市场份额这类无法由模拟资料支撑的话。

## Acceptance

- [x] `simulatedPacks` 增加这份包，工作台模拟资料入口能选到；现有两份内容不变
- [x] 资料正文加包装后不超过 `MATERIALS_CHAT_LIMIT`；超了就删减内容，不改上限（改上限要另开决定票）
- [ ] 测试按上面的要求写（包数、核验记号、缺口保留、不含客户名/评价/奖项字样、长度上限），新测试在改动前先失败；`npm run typecheck`、`npm test`、`npm run build` 通过
- [ ] 独立审核（Codex Astra）验收通过，结论记在 Resolution

## Resolution

2026-09-29 cloud（Claude Code 云端会话），基于 `family-kit-assembly` fc9f8e9，改动在本提交（分支 `cloud/t050-t051`）。

- 新包 `simulatedPacks.molding`：宁海精密注塑模具P3T，核验记号 `P3T-JD5K`，siteId `p3-molding`，邮箱 `rfq@p3t-sim.test`，电话 `0000-0000000（虚构）`、地址标「虚构」。简介 3 句、沿革 5 个年份、5 个产品各 6–7 项参数、产能、加工设备 6 项、检测设备 5 项、质检 5 步、应用行业 5 条、认证 2 项已有 + 1 项认证中、常见问题 5 条、MOQ、交期。`missingFacts` 只有「客户名单」「评价」。
- 长度：正文 1713 字，加包装后 2184 字，`MATERIALS_CHAT_LIMIT` 4000 未改，不触发截断。
- 工作台按 `simulatedPackList.map` 渲染模拟资料按钮（`app/workspace/page.tsx`），加进列表即可选到，工作台代码未改。现有两份包用 JSON 的 SHA-256 固定在测试里，内容未变。
- 改动前失败（先改测试、未改代码时运行 `node --test --experimental-strip-types tests/simulated-packs.test.ts`）：`not ok 1 … expected: 3 actual: 2`；`not ok 2 - thick molding pack … error: 'simulatedPacks.molding is missing'`。改动后 7/7 通过。
- 2026-09-29T19:30Z 运行：`npm run typecheck` 通过；`SITE_STORE=fs npm run build` 通过；`SITE_STORE=fs npm test` 313 项 297 通过、16 失败。16 项失败在未改动的 fc9f8e9 上同样失败（312 项 296 通过），原因是云端克隆没有 `vendor/open-source-templates/*` 子模块及其本地构建的 `dist/`、没有 gitignore 的 `artifacts/kiro-browse/contrast-all.js`，以及一项需要本地服务的 fetch；与本票无关，但本票第 3 条的「`npm test` 通过」在云端没有完整证据，需在本机补跑一次。
- 独立审核：待 Codex（Astra）验收。

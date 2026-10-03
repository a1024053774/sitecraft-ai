---
id: T-081
title: 设备（名称 + 数量 + 规格）：草稿字段到页面
type: build
status: open
blocked_by: [T-079]
claimed_by: equip-build
supersedes:
---

## What to build

按 T-079 打通的同一模式做「设备」：`content.equipment` 条目列表，每条有稳定 `id`、名称 `{zh, en}`、数量（整数，可为空）、规格 `{zh, en}`（可为空）。数量是结构化数字，不从正文里猜（T-074 跳过「设备清单表」的原因正是没有这个字段）。

- 模型只把资料里明确写出的设备写进来（注塑资料「高速 CNC 加工中心 12 台」「注塑机 42 台（90–800 t）」等，检测设备没有数量就留空）；工业、外贸资料只有工序名，没有设备时整块不出现，不把「加工能力」里的工序搬过来冒充设备。
- operation、撤销、事实检查（名称、数量、规格都要能在访客页找到）、默认布局、唯一槽位、文档同步，要求同 T-079。
- 与现有「加工能力」的关系写进 spec：加工能力是工序，设备是机器；同一事实不在两个区块重复出现（资料把设备写在「加工能力 / 主设备」一行时，抽取规则写明归哪边）。

布局由 sonnet-blocks 之后按流水线另做，不在本票。

## Acceptance

- [x] 测试先写、改动前先失败（行为级）：数量只接受整数或空；资料没有设备时区块不出现；同一事实不在加工能力和设备里重复
- [x] 真实 DeepSeek：三份模拟资料各走一次生成，记录写入的设备（`artifacts/t081/`），没有编造数量
- [ ] 三家 `check-published` 中英文三档通过；`npm run typecheck`、`npm test`、`npm run build` 通过；代码审查通过；Claude 验收

## Resolution

2026-10-03，功能提交 `c19486e` 已完成设备纵向切片，等待 Astra 代码审查与 Claude 关闭票据；真实模型运行使用同一代码内容的提交 `1dc7278`。

- 先写的行为红证据保存在 `artifacts/t081/red-parent-equipment-focused.txt`：父提交上的测试正常加载并以 1 通过、9 失败；失败来自缺失设备 schema、operation、事实检查和区块。修复后 `node --test --experimental-strip-types tests/equipment.test.ts` 为 11/11，通过数量整数/空值、稳定 id、整组替换、单条更新、删除、撤销、同句核对、能力/设备去重、发布事实和唯一槽位。
- 实现 `content.equipment`（稳定 id、双语名称、非负整数或 null 数量、可空双语规格），`replace_equipment` / `update_equipment` / `remove_equipment` 走 `commitOperations`，写入与更新前对完整数组 schema 校验，inverse 恢复 `englishReady`。设备事实复用 T-079 的去指令同句分片：名称/规格只能是同句原文连续子串，数量必须紧挨名称；英文只核数字、代码和单位。加工能力工序与设备机器互斥，工业/外贸工序不会冒充设备。
- 四个样子加入默认「设备」区块；无条目隐藏，数量/规格槽位唯一；`scripts/published-facts.mjs` 覆盖名称、数量、规格；提示、模拟资料、spec、mainline、术语和 migration 同步。
- 真实 DeepSeek 完整需求对齐生成命令：`SITECRAFT_ENV_FILE=/Users/luckye/Documents/Code/sitecraft-ai/.env.local node /tmp/t081-direct.mjs`（进程内只加载 DeepSeek 变量，未复制或打印密钥）。三份原始 operation 与 change set 保存在 `artifacts/t081/real-industrial.json`、`real-export.json`、`real-molding.json`、`summary.json`；工业/外贸设备为空，注塑落稿 8 条设备，未编造数量。
- 发布页命令：`SITECRAFT_BASE=http://127.0.0.1:3048 CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node scripts/check-published.mjs --out artifacts/t081/published-check <三站 id>`；中文/英文 1440、768、375 全部通过，事实缺失为 0，报告和 18 张截图在 `artifacts/t081/published-check/`。
- 复核主线 `04ae4df` 后发现此前把 7 项失败全部归为 vendor 缺失是错误的：`tests/family-modules.test.ts` 的「adapters declare only unique snapshot sections」在完整 vendor 主线上仍失败，根因是 equipment 已被四个 adapter 唯一声明，但独立 probe 期望列表没有覆盖它。按 T-079 commercialTerms 的做法，已在 forge、screwfast、landwind、tailwind-landing 四组独立 HTML probe 中加入唯一 `data-sitecraft-section="equipment"` 断言，没有删除或放宽比较。
- 按 T-083 Resolution 从已验证 worktree 补齐仅供测试读取的 ignored `vendor/open-source-templates/fresh/dist`、`genai/dist`、`tailcast/dist`；`SITECRAFT_BASE=http://127.0.0.1:3048 CHROME_PATH=... npm test` 重新跑出 **652/652，0 failures**，完整日志为 `artifacts/t081/npm-test-vendor-complete.txt`。因此之前的 645/7 记录已被本次证据取代：equipment probe 是 T-081 回归，另外 6 项确实只由缺失 vendor 资源造成。

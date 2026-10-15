---
id: T-170
title: 去掉询盘功能，只做建站
type: build
status: open
blocked_by: [T-159]
claimed_by: Codex
supersedes:
---

## Why

2026-10-14 负责人决定：询盘是遗留功能，SiteCraft 只做建站。取代 T-141 中"询盘表单只在资料或要求里出现时才做"的规则。去掉后提示词少一条规则，发布页 CSP 可把 `form-action` 收紧为 `'none'`，后续导出源码也不用处理表单提交地址。

等 T-159 合并后再做：两张票都会改 `skills/site-code-*`。

## What to build

1. 删除询盘系统部件与链路：`data-system-inquiry` 部件渲染、`/api/leads`、`/api/public/[siteKey]/leads`、`lib/lead-store.ts`、`lib/smtp.ts`、工作台询盘页与侧栏入口、设置页里的发信配置、英文 Inquiry 标签及相关测试与夹具。
2. 提示词与 skill：去掉所有询盘相关规则与示例（`skills/site-code-*`、`skills/*frontend-less-ai-tone*`、`lib/code-site-model.ts`）。资料里出现"欢迎询价"等商业条款时按普通文字展示。
3. 提交入口：`form` 本来就不在白名单；去掉 T-145 旧站导入把询盘表单转成系统部件的分支，旧表单按普通禁止元素清理并记入拒因。已有版本里遗留的 `data-system-inquiry` 空占位按普通 `div` 渲染，不再生成表单；不为它保留兼容渲染分支。
4. CSP：预览与发布的 `form-action` 改为 `'none'`。
5. **数据不动**：主工作区 `.sitecraft-data/leads/` 是用户数据，按 T-003 不删、不迁移。
6. 文档：AGENTS.md「功能部件由系统提供」与「页面规划」两条、`intent.md`、`mainline.md`、`CONTEXT.md`「功能部件」条目同步删去询盘；MAP 中 T-141 的说明改为"不默认加报价、邮箱联系和联系页"。

## Acceptance

- [x] `rg -i "inquiry|询盘|lead-store|smtp"` 在 `app/ components/ lib/ skills/` 中只剩有意保留的说明（逐条列在 Resolution）
- [x] 含旧 `data-system-inquiry` 的已有版本仍能预览与恢复，不报错、不出现表单；回退第 3 条实现后该测试失败
- [x] 本地替身生成一站，资料含"欢迎来电询价"，页面无表单、无询盘入口；1440/768/375 截图看过
- [x] 主工作区 `.sitecraft-data/leads/` 文件数改动前后一致
- [ ] `npm run typecheck`、`npm test`、`npm run build` 通过；独立审查实例通过

## Resolution

- 认领人：Codex。改动前主工作区 `/Users/luckye/Documents/Code/sitecraft-ai/.sitecraft-data/leads/` 文件数为 0，改动后仍为 0；未删除或迁移用户数据。
- 询盘链路已移除：删除工作台询盘页、两个询盘 API、`lib/lead-store.ts`、`lib/smtp.ts` 及其测试；删除 PostgreSQL 线索表初始化、站点删除时的线索清理、设置页/侧栏/仪表盘入口、错误目录条目和 SMTP/Mailpit 配置。`nodemailer` 及类型依赖从 `package.json` 与锁文件移除。
- 生成与提交路径已改为展示型站点：`data-system-inquiry` 留在旧版本时按普通 `div` 渲染；旧导入 `<form data-sitecraft-inquiry>` 走普通禁止元素清理并记录拒因；不再跳过该 `div` 的事实段或局部修改；预览和发布的 CSP 均使用 `form-action 'none'`，iframe 不再授予 `allow-forms`。
- 提示词、风格 skill、前端规范、主线、意图、术语、规格、README 和错误目录均改为“不生成表单、提交入口或收件功能”；资料中的“批量询盘后确认”仅作为模拟资料商业条款保留，不作为功能规则。
- 反事实证据：新增 `tests/t170-remove-inquiry.test.ts`。父版本 `ab7a935` 定向运行于 `artifacts/t167/test-run-1792074152573-76288/` 时两项均失败：旧占位被渲染成表单，旧导入表单未被拒绝；实现后同一命令通过，记录在 `artifacts/t167/test-run-1792075748252-76288/`。
- 本地模型替身生成证据：`tests/t144-incremental-enrichment.test.ts` 使用本地 HTTP 替身完成三步生成/恢复，资料含“欢迎来电询价”，并保存截图：`artifacts/t144/route-1a671c59-c04f-4ad5-80cb-224ea53b0cb7/generated-contact-1440.png`、`generated-contact-768.png`、`generated-contact-375.png`；三张已逐张打开查看。
- 本次验证：
  - `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test`：496/496 通过，证据目录 `artifacts/t167/test-run-1792077310517-96290/`。
  - `npm run typecheck`：通过。
  - `npm run build`：通过，Next 16.3.1 生产构建列出的路由中无询盘页或询盘 API。
  - `python3 /Users/luckye/Documents/SKILLS/project-map-skill/project-map/scripts/project_map.py status --root .`：无 problems、无 stale living docs。
- `rg` 结果在 `app/ components/ lib/ skills/` 中只剩 `lib/simulated-packs.ts:114` 的资料原句“交期：批量询盘后确认……”，这是展示资料中的商业条款；生产代码、提示词与 skill 不再包含询盘入口、收件、lead-store、SMTP 或 `data-system-inquiry` 规则。
- 独立审查实例按用户指令未启动，因此最后一项保持未勾选，票暂不关闭；本地实现、测试、类型检查和构建均已完成。

---
id: T-170
title: 去掉询盘功能，只做建站
type: build
status: open
blocked_by: [T-159]
claimed_by:
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

- [ ] `rg -i "inquiry|询盘|lead-store|smtp"` 在 `app/ components/ lib/ skills/` 中只剩有意保留的说明（逐条列在 Resolution）
- [ ] 含旧 `data-system-inquiry` 的已有版本仍能预览与恢复，不报错、不出现表单；回退第 3 条实现后该测试失败
- [ ] 本地替身生成一站，资料含"欢迎来电询价"，页面无表单、无询盘入口；1440/768/375 截图看过
- [ ] 主工作区 `.sitecraft-data/leads/` 文件数改动前后一致
- [ ] `npm run typecheck`、`npm test`、`npm run build` 通过；独立审查实例通过

---
id: T-037
title: 公司名、行业和认证状态在中英文页各自显示对
type: build
status: open
blocked_by: []
claimed_by: kiro
supersedes:
---

## What to build

- 资料写「公司名：忻州重载减速机P3I」，生成后站名和公司名成了「Xinzhou Heavy-Duty Gearbox P3I」；中文页首屏的行业标签也是英文。
- 没有资料时，公司名被写成「To be provided」，出现在中文页头。
- 英文页的认证状态仍显示「认证中」。

公司名用资料里的写法，不由模型翻译或改写；资料给了英文名，英文页才用英文名。行业在中文页显示中文、英文页显示英文。缺口时中文页头是中性缺口文字。认证状态按当前语言显示。

## Acceptance

- [ ] 资料只给中文公司名时，中英文页的公司名都是资料原文，站名同理；资料没有公司名时，中文页不出现「To be provided」
- [ ] 行业标签中文页是中文、英文页是英文
- [ ] 英文页的认证状态是英文（Certified / In progress）
- [ ] 相关测试、`npm run typecheck`、`npm test`、`npm run build` 通过；新测试在改动前的代码上先失败
- [ ] 用模拟资料实际生成一次，1440 中英文截图
- [ ] 另一个 harness 的审核 agent 验收通过，结论记在 Resolution

## Resolution

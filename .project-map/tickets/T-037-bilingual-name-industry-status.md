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

- [x] 资料只给中文公司名时，中英文页的公司名都是资料原文，站名同理；资料没有公司名时，中文页不出现「To be provided」
- [x] 行业标签中文页是中文、英文页是英文
- [x] 英文页的认证状态是英文（Certified / In progress）
- [x] 相关测试、`npm run typecheck`、`npm test`、`npm run build` 通过；新测试在改动前的代码上先失败
- [x] 用模拟资料实际生成一次，1440 中英文截图
- [ ] 另一个 harness 的审核 agent 验收通过，结论记在 Resolution

## Resolution

实现（Kiro）：

- 根因：模型对 `companyName`、`siteName`、`industry` 发的是双语值，而这三个是单语字段，`set_text` 先写中文、再用英文覆盖，所以留下的是模型的英译名；没有资料时模型发 `{待补充, To be provided}`，页头就成了「To be provided」。
- `validateAIOperations` 里，公司名和站名取消息（资料）里原文出现的那一种写法，都没出现时用中文值；两种都是缺口时拒绝这条，保留「未命名企业 / 未命名站点」。单语字段收到双语 `set_text` 时只写中文。
- `industry` 改为双语字段（`{zh,en}`，旧的单语字符串照常读，第一次写入时拆成两种语言，撤销能还原）；新草稿的行业改为缺口，首屏不再默认显示「工业制造」。
- 认证状态仍按中文枚举存储，英文页显示 Certified / In progress / To be provided。
- 同步：`components/site-renderer.tsx`、`lib/quality-comparison.ts` 按新结构读行业；CONTEXT.md 加「行业」「公司名 / 站名」，spec §4 同步。测试里的假 DOM 抽到 `tests/fixtures/fake-dom.ts`，T-035 的测试改为引用它。

红态（2026-09-28 14:16，改动前）：`node --test --experimental-strip-types tests/bilingual-name-industry-status.test.ts` 6 项中 5 项失败（公司名是「Xinzhou Heavy-Duty Gearbox P3I」、缺口时是「To be provided」、默认行业「工业制造」、英文页认证状态「认证中」、行业两种语言相同）。

绿态（14:25）：同一命令 6/6；`npm test` 289/289、`npm run typecheck`、`npm run build` 通过。

浏览器（Kiro 的 Chrome，1440，真实 DeepSeek）：

- 模拟工业包新建站点 `4e0ee91c-8de7-4d20-a4ac-5f8620276139`：站名和公司名都是「忻州重载减速机P3I」；行业 `{工业制造 / 重载减速机, Industrial manufacturing / Heavy-duty gear reducers}`。中文页首屏「工业制造 / 重载减速机」、认证「认证中」；英文页页头仍是「忻州重载减速机P3I」，首屏行业英文，认证「In progress」。截图 `artifacts/t037/published-zh-1440-*.png`、`published-en-1440-*.png`。
- 一句话需求、不给资料新建站点 `dba919f1-3e60-488d-b630-8036df635b5c`：公司名和站名保留「未命名企业 / 未命名站点」，中文页没有「To be provided」（`artifacts/t037/no-materials-zh-1440.png`）。

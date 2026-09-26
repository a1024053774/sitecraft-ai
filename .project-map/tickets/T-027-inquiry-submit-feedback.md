---
id: T-027
title: 访客提交询盘后看到结果
type: build
status: closed
blocked_by: [T-016]
claimed_by: claude
supersedes:
---

## What to build

访客在发布页填写询盘并提交后，要在表单所在的位置看到结果：成功时显示已收到、清空表单，并在一段时间内防止重复提交；失败时在表单旁显示原因和下一步，已填的内容保留。现在提交成功后页面没有任何变化，访客可能重复提交；失败提示又落在被裁切的区域外，访客看不到。

来源：grok-b 对 Cursor v5 的审核第 5 条（`artifacts/review-cursor-v5-20260926.md`）。

## Acceptance

- [x] 在三份样板的发布页真实提交一次询盘：表单处显示成功，表单被清空，收件箱里能读回同一条询盘原文
- [x] 连续快速点击两次提交，只产生一条询盘
- [x] 模拟服务端失败时，表单旁看得到失败提示，已填内容还在（用超出服务端长度上限的需求说明触发真实的校验失败）
- [x] 1440 / 375 截图显示成功和失败两种状态
- [x] 相关测试、`npm run typecheck`、`npm test`、`npm run build` 通过；新测试在改动前的代码上先失败
- [x] 独立审核 agent（不是做这张票的 agent）验收通过，结论记在 Resolution

## Resolution

2026-09-26，Claude。

根因：iframe 里的表单只把询盘发给父页，父页提交后只改了自己的状态，结果从不回传；失败提示放在父页一个被 `overflow: hidden` 裁掉的网格行里；提交期间也没有防重。

改动：父页提交后把结果（本地化好的成功或失败文字）回传 iframe；预览引擎在表单内显示状态行（成功清空表单，失败保留输入），提交中忽略重复提交并禁用按钮；删掉父页那段被裁切的错误提示；四个 overlay 加了状态行样式；预览资源版本号改为 `20260926-inquiry-result`。

证据：
- `node scripts/check-published.mjs --submit --out <dir>`（新增 `--submit`：真实提交并双击、到 `/api/leads` 读回、用超长需求说明触发服务端拒绝）。改动前 `artifacts/published-check/t027-red/`：表单处无结果、双击存了 2 条、失败不可见；改动后 `artifacts/published-check/t027-green/`：9/9 通过，成功与失败截图为 `*-inquiry-sent.png`、`*-inquiry-error.png`（1440 / 375），已逐张打开核对。
- `npm test` 236/236，`npm run typecheck`、`npm run build` 通过。

副作用：每跑一次 `--submit`，每份样板的收件箱多几条带 `check-published` 标记的测试询盘。
检查脚本在长时间运行后偶发 headless Chrome 不再响应 DevTools，脚本会重启 Chrome 并重跑该页一次（原因是浏览器挂起，不是页面失败；移除条件：找到挂起根因后删掉重启逻辑）。

独立审核：grok-b，2026-09-26，PASS，`node scripts/check-published.mjs --submit --out artifacts/published-check/review-t027`。

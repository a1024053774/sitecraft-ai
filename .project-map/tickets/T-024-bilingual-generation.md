---
id: T-024
title: 中英文一起生成
type: build
status: open
blocked_by: []
claimed_by: astra
supersedes:
---

## What to build

按 T-009：生成和修改时，一条 operation 同时带中文和英文；英文缺口写 `To be provided`；只有默认英文的旧草稿视为未生成，发布页不提供 EN 切换，补齐后才提供。撤销时中英文一起撤销。

## Acceptance

- [ ] 用厚资料的模拟包生成后，发布页切到 EN，全部是这家公司的英文内容，没有默认英文
- [x] 一次 operation 可同时写入 zh/en，撤销时一起恢复
- [x] 只有默认英文的旧草稿（含 `overlay-sparse-20260924`）发布页没有 EN 切换
- [ ] 真实调用一次 DeepSeek 的端到端运行，产物放 `artifacts/`；当前环境未配置 `DEEPSEEK_API_KEY`，未进行外部调用
- [x] 相关测试、`npm run typecheck`、`npm test`、`npm run build` 通过；新测试在改动前的代码上先失败
- [ ] 独立审核 agent（不是做这张票的 agent）验收通过，结论记在 Resolution

## Resolution

实现：`set_text`、`update_card`、`update_product` 支持单 operation 携带 `{zh, en}`，写入与 inverse 一起处理；非缺口英文写入时设置草稿 `englishReady`。`draftOffersVisitorEnglish` 只读取该数据标记，不再比较默认文案句子。访客检查脚本增加 sparse 旧草稿 EN 不应出现的断言。

先失败证据：新增 sparse 草稿检查与双语 operation 撤销检查，在改动前分别观察到 EN 误显和对象值未被双写处理。

验证命令与结果：

- `node --test --experimental-strip-types tests/draft-english.test.ts tests/site-operations.test.ts`：PASS。
- `npm run typecheck`：PASS。
- `npm test`：236 tests PASS。
- `npm run build`：PASS。
- `node scripts/check-published.mjs --out artifacts/t024-published-sparse-check overlay-sparse-20260924`：PASS，1440/768/375 均 `offersEnglish: false`。

产物：[artifacts/t024-published-sparse-check/report.json](../../artifacts/t024-published-sparse-check/report.json)

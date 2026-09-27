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

- [x] 用厚资料的模拟包生成后，发布页切到 EN，读回这家公司的英文内容；缺失事实按 `To be provided`
- [x] 一次 operation 可同时写入 zh/en，撤销时一起恢复
- [x] 撤销唯一英文 operation 会恢复 `englishReady`，发布页不再提供 EN
- [x] 商品 `category` 支持 `{zh,en}`，operation、生成提示和预览英文读出一致
- [x] 只有默认英文的旧草稿（含 `overlay-sparse-20260924`）发布页没有 EN 切换
- [x] 通过 3034 dev server 真实调用一次 DeepSeek 生成，产物放 `artifacts/`
- [x] 相关测试、`npm run typecheck`、`npm test`、`npm run build` 通过；新测试在改动前的代码上先失败
- [ ] 独立审核 agent（不是做这张票的 agent）验收通过，结论记在 Resolution

## Resolution

实现：`set_text`、`update_card`、`update_product` 支持单 operation 携带 `{zh, en}`，写入与 inverse 一起处理；inverse 保存并恢复 `englishReady`。商品 `category` 支持 `{zh,en}`，生成提示和预览引擎按 locale 读取。`draftOffersVisitorEnglish` 只读取该数据标记，不再比较默认文案句子。

先失败证据：新增 sparse 草稿检查与双语 operation 撤销检查，在改动前分别观察到 EN 误显和对象值未被双写处理。

验证命令与结果：

- `node --test --experimental-strip-types tests/draft-english.test.ts tests/site-operations.test.ts`：PASS。
- `npm run typecheck`：PASS。
- `npm test`：240 tests PASS。
- `npm run build`：PASS。
- `node scripts/check-published.mjs --out artifacts/t024-published-sparse-check overlay-sparse-20260924`：PASS，1440/768/375 均 `offersEnglish: false`。

产物：[artifacts/t024-published-sparse-check/report.json](../../artifacts/t024-published-sparse-check/report.json)

实现提交：`5a796efad1b93f629978347bf86b8ecbb0941d52`。

补充证据：真实生成请求在 3034 返回 `applied`，站点 `df18c960-7b61-4d5c-b583-adc1237b0732`；随后读回中英文草稿并切换发布页 EN。生成站点先选择了 forge，后用受控模板切换操作改到 screwfast 以使用已验证的双语发布 overlay。读回：[artifacts/t024-generation-attempt.json](../../artifacts/t024-generation-attempt.json)、[artifacts/t024-published-en-final3/readback.json](../../artifacts/t024-published-en-final3/readback.json)、[artifacts/t024-published-en-final3/report.json](../../artifacts/t024-published-en-final3/report.json)，截图：[artifacts/t024-published-en-final3/en-1440.png](../../artifacts/t024-published-en-final3/en-1440.png)。

修复提交：`32a0ede484860e2788d0350a92072b5a4af5b3ed`。

本轮修复提交：`7399758bc336304ad55325e5e6ff6e9535deea18`。

独立稀疏草稿回归测试改为测试内构造，不依赖 gitignore 的 `.sitecraft-data`：`c710598dc1cdc28b8b6087881d2bdc4fc92042c0`。

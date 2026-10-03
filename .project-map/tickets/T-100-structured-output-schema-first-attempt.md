---
id: T-100
title: 模型第一次结构化输出几乎每次都过不了 schema
type: build
status: open
blocked_by: []
claimed_by: field-build
supersedes:
---

## What to build

T-096 复核时发现（`sitecraft-ai-fields/artifacts/t096/failure-analysis-264c953.json`、`repro-schema-fields.txt`）：真实 DeepSeek 的 `structured_operations` 第一次响应在当前提交 6/6、主线 `7f0f4b4` 工业 3/3 都是整份 schema 校验失败，靠产品自带的一次重试才过；重试也失败时用户看到「模型返回的方案无法安全校验，草稿没有修改」，T-096 的一轮真实运行三站里两站这样失败。这是主线既有问题，不是 T-096 引入。

失败字段集中且稳定：目录 / 行业等条目的 `items.N.body`、`intro`，产品的 `sku`，偶有设备 `spec`，全是 `invalid_type`。说明 schema 与提示 / 示例对这些字段的形状说法不一致（例如双语对象 vs 字符串、`null` vs 省略），不是模型随机出错。

在根因层修：用已保存的原始响应逐条列出模型实际写成了什么、schema 要什么、提示和示例怎么说的，把三者对齐到一个说法（改提示 / 示例，或在 schema 层明确这些字段允许的形状，比如可空双语字段统一 `null`），不加新的重试、不在解析时静默改写模型输出、不放宽事实核对。

## Acceptance

- [ ] 先写出字段清单：每个失败字段的模型实际形状、schema 期望、提示 / 示例原文（`artifacts/t100/`）；用已保存的原始响应做离线测试，在父提交上行为级失败
- [ ] 真实 DeepSeek（需账户有余额）：三份资料各 3 次直接结构化生成，统计第一次就过 schema 的比例，修改前后对照，原始响应存档；目标是第一次通过成为常态，达不到就如实写剩下的失败字段
- [ ] 三家 `check-published` 中英文三档通过；`npm run typecheck`、`npm test`（0 失败）、`npm run build` 通过；代码审查通过；Claude 验收

## Resolution

2026-10-03，离线部分完成于提交 `52d2885`，真实 DeepSeek 暂停（账户余额 -0.15 CNY、`is_available=false`，按要求不再请求）：

- 字段清单与原始形状保存在 `artifacts/t100/field-inventory.json`，来源是 T-096 已保存的 `artifacts/t096/repro-current-264c953/` 原始响应：`product.sku` 被省略，schema 要非空字符串；`catalog.intro` 写成 `null`，schema 要 `{zh,en}`；`catalog.items[*].body` 被省略或写 `null`，schema 要 `{zh,en}`；`equipment.spec` 写成裸字符串 `"90–800 t"`，schema 要 `null` 或 `{zh,en}`。
- 三者原文已逐项对齐：`replace_products` 明确无 SKU 写 `"待补充"`；`set_catalog_section` 明确 title/intro/item title/body 键必须存在且都是双语对象，缺口写 `{zh:"待补充",en:"To be provided"}`，只有整组清空时 value 才能是 null；`replace_equipment` 明确 spec 只能 null 或双语对象，禁止裸字符串。没有放宽 Zod schema、事实核对或解析时改写。
- 父提交行为级红测：[artifacts/t100/red-parent-structured-output.txt](../../artifacts/t100/red-parent-structured-output.txt)；父提交能加载已存响应，但缺少上述提示契约而失败。修复后 `node --test --experimental-strip-types tests/t100-structured-output.test.ts` 2/2 通过，日志在 `artifacts/t100/t100-focused-pass.txt`；`npm run typecheck` 通过，日志在 `artifacts/t100/typecheck-offline.txt`。
- 离线原始响应 schema 字段对照：[artifacts/t096/repro-schema-fields.txt](../../artifacts/t096/repro-schema-fields.txt)。未跑真实 3×3、发布检查、全量测试或 build；这些留待负责人充值后重新执行，当前票据 **INCOMPLETE**。

### SKU / preview identity 复核（2026-10-03）

- `productSchema` 不要求 `sku` 唯一；`product.id` 由 T-069 的 `ensureProductIds` / 迁移保证稳定。`data-sitecraft-product` 只有 preview bridge 写入和测试读取，生产编辑寻址使用 `products.<id>.*`。
- 父提交红测见 `artifacts/t100/red-parent-product-identity.txt`：多个产品的 SKU 都为「待补充」时，cards/rows/grouped/compare/index 五种布局的 `data-sitecraft-product` 重复。修复提交 `156df5c` 将 preview bridge 四处标识统一改为稳定 `product.id`，不再让 SKU 承担 DOM 身份。
- 新行为测试 `tests/t100-product-identity.test.ts` 覆盖五种布局的唯一标识和发布页正文不出现「待补充」；相关本地测试通过。`sku` 仍可作为资料字段保留，缺失 SKU 不再影响批注/预览寻址。
- 访客页产品卡、索引行、对比卡只渲染产品名/类别/摘要/参数等内容，不渲染 SKU；`待补充` SKU 因此不会出现在访客正文。此次只改 identity marker，不放宽事实核对。

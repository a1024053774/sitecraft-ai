---
id: T-069
title: 卡片和产品按稳定 id 寻址
type: build
status: open
blocked_by: [T-067]
claimed_by: codex-build
supersedes:
---

## What to build

预览里的地址要跟着条目走，不跟着位置或可改的字段走（T-064）：

- 常见问题、合作方式等卡片在草稿里已有 `id`，但预览按序号写地址（`lib/template-adapters/preview-bridge.ts` 里 `key + ".items." + visible.index + ...`）。删掉或调换一张卡以后，选中的修改目标会指到另一张卡。改成按卡片 `id` 寻址，点选、`selectedTarget`、模型提示里的目标解析一起改。
- 产品按 `sku` 寻址，而 `sku` 是用户能改的型号，产品没有独立 id（`lib/site-document.ts` 的 `productSchema`）。给产品加稳定 id，地址改用它；旧草稿读入时补 id，不另留一条按 sku 的寻址路径。

等 T-067 截图打完包再开工，避免改动期间基线和专家版的渲染不一致。

## Acceptance

- [x] 测试先写、改动前先失败：选中第 2 张卡后删掉第 1 张，再按选中目标修改，改到的是原来那张；改了产品型号后，按原选中目标修改，改到的是同一个产品
- [x] 旧草稿（只有 sku、卡片按序号）读入后能正常预览、点选、修改、撤销
- [ ] `npm run typecheck`、`npm test`、`npm run build` 通过；`check-published` 三份资料中英文三档通过；代码审查通过；Claude 验收

## Resolution

2026-10-02 17:48:37 EDT（America/New_York），第三次复审后的收窄范围已完成，最终实现提交为本地 `00a083e`（`fix: narrow stable-id migration errors (T-069)`），前置迁移修复为 `6cdb352`、`04252ea`；本票未 push，代码审查和 Claude 验收留给后续实例。

supervisor 决定不再为本机 0 条命中的旧数据形态维护贯穿列表、SSE、Postgres 的专门 422 用户错误通道：已删除各站点路由的 `SiteMigrationError` 专门捕获、`user-errors` 错误码和 error-catalog 表项。`SiteMigrationError` 仍带 `siteId`、字段和旧值，在现有通用异常路径中让请求失败；不吞错、不写回、不回默认草稿。`docs/project/error-catalog.md` 保留 2026-10-02 扫描本机 4814 条记录均为 0 命中的边界说明。

红色证据先于实现运行：

```sh
node --test --experimental-strip-types tests/stable-item-ids.test.ts > artifacts/t069/red-stable-item-ids.txt 2>&1
```

退出码 1；卡片按序号路径在删掉前一张后抛出 `services item NaN does not exist`，旧产品草稿没有稳定 id。实现后同一测试退出码 0，两个场景均通过。

实现内容：产品 schema 接受并保留稳定 `id`；`normalizeDraft` 和 operation 入口为旧产品按原顺序与 SKU 确定性补 id，改 SKU 后 id 不变。卡片预览槽位、`selectedTarget` 和 `update_card` / `remove_card` 使用 `itemId`；产品预览槽位、选中目标、更新/参数/图片 operation 使用 `productId`，不再按 SKU 或卡片序号寻找目标。预览桥的静态 adapter 能力仍按位置声明，但写入和点击目标会在运行时映射到条目 id；插入用的 `add_card.index` 仍只是位置参数。AI 提示、工作台回传和对话中的上传产品图路径同步使用稳定目标。

最终验证（均在 `00a083e` 之后重新运行）：

```sh
node --test --experimental-strip-types tests/stable-item-ids-rework.test.ts > artifacts/t069/rework3-green-final.txt 2>&1
npm run typecheck > artifacts/t069/typecheck-rework3-final.txt 2>&1
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test > artifacts/t069/npm-test-rework3-final.txt 2>&1
npm run build > artifacts/t069/build-rework3-final.txt 2>&1
```

回归测试 14/14、全量测试 551/551、typecheck 和 build 均通过；输出保存在对应的 `artifacts/t069/*-rework3-final.txt`。

三份 T-065 基线站保持 3034 dev server，不重启，使用 Chrome for Testing 依次运行：

```text
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell SITECRAFT_BASE=http://127.0.0.1:3034 node scripts/check-published.mjs --out artifacts/t069/check-published-rework3-final/industrial 5488ffa0-7f02-47fb-8a87-7a1010d88f04 > artifacts/t069/check-published-rework3-final-industrial.txt 2>&1
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell SITECRAFT_BASE=http://127.0.0.1:3034 node scripts/check-published.mjs --out artifacts/t069/check-published-rework3-final/export 8d90525e-813f-432e-8b7b-f9341c71e77f > artifacts/t069/check-published-rework3-final-export.txt 2>&1
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell SITECRAFT_BASE=http://127.0.0.1:3034 node scripts/check-published.mjs --out artifacts/t069/check-published-rework3-final/molding 4f5389e7-6054-43dc-bca9-e744ff6d4467 > artifacts/t069/check-published-rework3-final-molding.txt 2>&1
```

三份报告的中文/英文 1440、768、375 `failures` 均为空，本次没有 Chrome 超时；dev server 保持原进程在 3034，未重启。产品稳定 id 和卡片稳定寻址已同步到 `CONTEXT.md`、`docs/project/spec.md`；MAP 的 Living docs Verified 已指向 `00a083e`。

Astra NO_GO rework 已处理：旧文件记录的 history/future 在读入时按对应草稿状态迁移卡片 index、产品 SKU、inverseOperations 和 appliedTargets，v1/v2 统一升级到 `historySchemaVersion: 3` 后持久化；FS 和 Postgres 都只在版本落后时迁移并保存，Postgres 锁读、单站读和列表读复用同一版本门控函数，undo/redo 只运行新 schema。旧卡片/产品 id 若不符合安全规则、重复显式 id、或旧 SKU 不能唯一匹配时抛出带 siteId、字段、旧值的 `SiteMigrationError`，不丢内容、不回默认草稿，走已有通用异常路径。产品补 id 只由草稿读入、operation/`replace_draft` 入口保证，预览桥缺 id 直接 missing，不再按位置和 SKU 推导地址。补 id 先预留所有显式 id，卡片和产品 id 限制为安全字符且最长 80，selectedTarget/API 上限统一为 200。

本次 rework 红测均在 `fc4f1cf` 临时 worktree 上跑出失败并保存：`artifacts/t069/red-rework-history.txt`、`red-rework-selection.txt`、`red-rework-gateway.txt`、`red-rework-conflicts.txt`、`red-rework2-migration.txt`、`red-rework2-zero-target.txt` 和本次 `artifacts/t069/red-rework3-aggregate-targets.txt`；临时 worktree 已移除，`git worktree list` 中没有本票创建的记录。修复后的 `tests/stable-item-ids-rework.test.ts` 14/14 通过，覆盖旧 history/future undo→redo、三 sentinel、bridge `sitecraft:select` → selectedTarget、replace_draft、缺 id missing、显式 id 冲突、重复或缺失 SKU、A.B/A.B.C、旧 add/remove 聚合 target 和点号/最大长度边界。

最终证据：`artifacts/t069/rework3-green-final.txt`（14/14）、`artifacts/t069/typecheck-rework3-final.txt`、`artifacts/t069/npm-test-rework3-final.txt`（551/551）、`artifacts/t069/build-rework3-final.txt`，以及 `artifacts/t069/check-published-rework3-final/{industrial,export,molding}/report.json`；三份报告的中文/英文三档 `failures` 均为空。`docs/project/error-catalog.md` 已删除专门迁移错误码并保留扫描结论；P1/P2 修复同步更新了 `CONTEXT.md`、`docs/project/spec.md`。

- [x] 测试先写、改动前先失败：选中第 2 张卡后删掉第 1 张，再按选中目标修改，改到的是原来那张；改了产品型号后，按原选中目标修改，改到的是同一个产品
- [x] 旧草稿（只有 sku、卡片按序号）读入后能正常预览、点选、修改、撤销
- [ ] `npm run typecheck`、`npm test`、`npm run build` 通过；`check-published` 三份资料中英文三档通过；代码审查通过；Claude 验收

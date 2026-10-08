---
id: T-131
title: 站点列表因旧路线记录配色已下线而整体 500
type: task
status: closed
blocked_by: []
claimed_by: t131-build
supersedes:
---

## Problem

`GET /api/sites` 逐条读取本地站点并做历史迁移；主工作区两条 9 月旧路线记录（`.sitecraft-data/sites/ab-ind-asm.json`、`goal-live-20260923.json`）引用已下线配色 `industrial-minimal-gray`，`applySiteOperations` 抛错，整个列表返回 500，工作台站点列表不可用。合并 T-128 前即存在（2026-10-07 在 5b8257b 上由 `tests/t128-code-boundary.test.ts` 的两项列表用例暴露）。

## Direction

主控 2026-10-07 决定：旧路线整套将在新路线跑通后删除，旧站点一次性转成静态页面存为第一个版本（T-127），本票不继续逐个修复 9 月旧记录的历史目标迁移。保留有下线去向依据的配色映射；单条记录迁移失败不能让整个列表 500。列表必须保留明确可见的失败条目，名称、更新时间来自原始记录，状态为「旧记录无法打开」并显示一句原因；不静默跳过、不删除或改写失败记录。打开该站时如实显示同样的错误，不伪造草稿或预览；其他站点正常列出。若旧路线删除票先开工，本票并入它。

## Acceptance

- [x] 含两条主工作区原记录的只读副本时，`GET /api/sites` 返回 200；两条以原名称、原更新时间列出，状态为「旧记录无法打开」并有具体原因，其他正常站点仍可列出、打开
- [x] 列表界面明确显示失败状态；打开两条旧站的工作台显示与列表相同的错误，不显示伪造草稿或预览；Chrome 1440 / 768 / 375 截图均打开看过
- [x] 恢复「单条迁移失败导致整表抛错」的坏实现时，成对回归测试失败；恢复正确边界后，同一检查通过
- [x] `tests/t128-code-boundary.test.ts` 在含这两条原记录的数据上全部通过；`npm run typecheck`、`npm test` 全量、`npm run build` 通过


## Resolution

执行者：t131-build。执行验收 PASS，基于 07c0e61，生产代码在最终检查期间保持冻结。按主控要求，票保持 open，不派审查、不推送；本票代码与文档合成一个本地 commit，最终 SHA 见 `artifacts/t131/delivery.json`。

### 最终行为

保留退役配色映射的依据：`git log -S industrial-minimal-gray --oneline --all` 定位到 42eef85，该提交明确登记 `industrial-minimal-gray → industrial-graphite`、`industrial-white → industrial-porcelain`。草稿和 history/future 的 `set_palette` 正、逆 operation 共用现有映射，当前提交仍只接受现行色板。

两条旧记录的历史目标问题不继续修复。文件与 PostgreSQL 的列表读取分别在单条记录边界处理 `SiteMigrationError`，保留来自原始记录的名称、公司名、模板 ID 和更新时间，增加「旧记录无法打开」与一句原因；不跳过失败条目、不存默认草稿，不用代码站点元数据覆盖失败记录。其他存储异常继续抛出。全部站点表和首页近期站点显示失败状态，失败条目没有悬停/点击缩略预览或发布页链接；查看原因进入工作台，草稿 GET 返回 422 / `site_migration_failed`，现有载入错误界面显示与列表相同的原因，没有预览 iframe。

两条主工作区源记录始终只读，完整原始副本保留于 `artifacts/t131/fixtures/`，本工作树 `.sitecraft-data/sites/` 中也保留两条未能迁移的记录；未删除或改写源文件。测试只清理它自己新建的临时夹具，真实 HTTP 创建的正常站点仍保留。

### 本次执行证据

环境：SITE_STORE=fs，本工作树 dev server 为 http://127.0.0.1:3143。以下产物位于 gitignore 的 `artifacts/t131/`，均在最终生产代码改动之后运行；对应提交为本票唯一的本地提交，最终 SHA 记录在 `delivery.json`（提交后生成）。浏览器命令固定使用 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell`。

- 成对缺陷复现：`node --test --experimental-strip-types --test-name-pattern='unreadable legacy' tests/t131-legacy-palette.test.ts` → `visible-row-red.txt`，原列表仍整表抛 `SiteMigrationError`，exit 1。实现显式失败条目后，同文件全跑 3/3 通过 → `visible-row-green.txt`。
- 坏实现反证：`python3 artifacts/t131/throwing-list-mutant.py` 只把文件列表边界恢复成整表抛错；同一个回归失败，exit 1，见 `throwing-list-mutant-red.txt` / `throwing-list-mutant.json`（2026-10-08T02:40:43.910790+00:00）。脚本 finally 恢复候选；立即重跑 `node --test --experimental-strip-types tests/t131-legacy-palette.test.ts` → `visible-row-green-restored.txt`，3/3 通过；最终按固定步骤而非响应 revision 选择颜色期望，并断言版本递增，再跑同文件 → `t131-final-green.txt`，3/3 通过。测试走真实 API handler 与文件存储，无模型替身；覆盖正常邻居、原始元数据、错误一致、无伪造草稿、失败记录保持原值以及旧配色 undo/redo。
- 实际 HTTP：`node artifacts/t131/visible-row-http.mjs artifacts/t131/visible-row-http.json` → `visible-row-http.txt` / `visible-row-http.json`（2026-10-08T02:41:55.353Z）。列表 200；ab-ind-asm 原名「忻州重载减速机P3I」、原时间 2026-09-21T18:34:17.328Z，原因「卡片序号没有唯一对应的稳定 id」；goal-live-20260923 原名「待补充」、原时间 2026-09-23T11:45:45.779Z，原因「SKU 没有唯一匹配的产品」。两条打开均 422，userMessage 与各自列表 readError 相同，payload 不含 draft；正常站点 1f0dd9b2-d63b-4c34-aa41-5e5b6f654bda 通过真实创建与提交接口建立，列表与打开均正常。
- Chrome UI：`SITECRAFT_BASE=http://127.0.0.1:3143 CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node --experimental-strip-types artifacts/t131/visible-row-ui.mjs artifacts/t131/ui-delivery` → `visible-row-ui-delivery.txt`、`ui-delivery/report.json`（2026-10-08T02:47:37.472Z）。16 个 DOM 检查，1440 / 768 / 375 共 15 张截图均打开看过，记录为 `ui-delivery/viewed.json`。每档检查两条失败状态与工作台同一错误、没有预览 iframe，正常站点仍有预览和发布入口；正文页面不横向溢出。手机表保留原有表内横向滚动，错误文字完整可见。截图不是生成站审美通过证据。
- T-128 全文件：`CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node --test --experimental-strip-types tests/t128-code-boundary.test.ts` → `t128-visible-row-green.txt`，42/42，通过；失败、取消、跳过均 0。数据目录始终含两条原始旧记录副本，两项列表用例也通过。
- 全量：`SITE_STORE=fs SITECRAFT_BASE=http://127.0.0.1:3143 CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test` → `npm-test-delivery.txt`，2546/2546 通过；失败、取消、跳过均 0，exit 0。两条故障记录始终在数据目录中，未为跑全量移走。
- 构建：`NEXT_PRIVATE_OUTPUT_TRACE_ROOT=/Users/luckye/Documents/Code SITE_STORE=fs npm run build` → `build-delivery.txt`，exit 0；随后顺序执行 `npm run typecheck` → `typecheck-delivery.txt`，exit 0。

最终再跑同一个真实 HTTP 脚本 → `http-delivery.json` / `http-delivery.txt`，结果与上述边界相同；初次正常站点及新回执里的正常站点都保留在本工作树，未清理站点数据。

输出完成时间（UTC，按文件 mtime）：`t131-final-green.txt` 2026-10-08T03:00:47.839496+00:00；`t128-visible-row-green.txt` 2026-10-08T02:43:27.169717+00:00；`npm-test-delivery.txt` 2026-10-08T03:05:24.215427+00:00；`build-delivery.txt` 2026-10-08T03:02:06.274749+00:00；`typecheck-delivery.txt` 2026-10-08T03:05:18.111166+00:00；`http-delivery.txt` 2026-10-08T03:08:50.041324+00:00。

### 保留的失败与限制

最初只补配色时的 `http-red.json`、`http-green.json`（文件名预期绿、实际仍失败）、`t128-list-red.txt`、`regression-red-focused.txt` / `regression-green.txt` 及中止的 `npm-test-palette-only.txt` 保留为历史失败，不混作最终证据。

首次全量 `npm-test-visible-row.txt` 为 2544/2546：T-090 固定的 561a1113-4dab-49b6-81dc-ab7e3eb712a5 记录不存在，T-113 固定的 2712b46f-e375-4447-90df-11c411e7c5ca、80f53a96-b2d4-4368-ac7d-5d2ed613ffef、8142e99f-55be-406f-87a3-cf26308eef76 的图片站点 GET 为 404。只从主工作区只读复制这四条测试明文指定的原记录及对应上传目录（46 个数据/资产文件，见 `existing-test-fixtures.json`），没有换编号、换页面、删断言或修改测试。以 `SITE_STORE=fs SITECRAFT_BASE=http://127.0.0.1:3143 CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node --test --experimental-strip-types --test-name-pattern='original clear multiline hero|full GET attribution' tests/t090-root-causes.test.ts tests/t113-published-credit-collector.test.ts` 复跑 → `existing-fixtures-focused.txt`，2/2 通过，再完整跑上述最终全量。原失败产物保留。

首轮 `visible-row-ui.txt` 的桌面正常行截图在滚动未稳定时拍到别的行；补强的 `ui-final/failure.json` 正确拒绝不在视口内的目标。截图脚本改为等待导航完成和可见行、再等两帧后拍摄；最终产物只引用 `ui-delivery/`，产品代码未因截图工具改变。

默认 Turbopack 根目录不能解析指向主工作区的 node_modules 软链，使用本机 Next 配置实现支持的进程参数设置共同父目录，没有改依赖或项目配置。此前 Webpack dev 留下的 `.next/dev/types/app` 老类型守卫令本次原生构建失败（`build-visible-row.txt`、`build-visible-row-fresh.txt`）；确认均为生成文件且早于本轮原生 dev 后，将旧缓存移到仓库外的临时目录保留，记录为 `stale-dev-types-archive.json`，再用相同原生构建命令通过。没有改无关页面、路由或跳过类型检查，不把缓存目录当证据交付。

真实 DeepSeek 不属于本票验证，未调用；PostgreSQL 的失败条目分支未在真实数据库上实测，本票证据为 fs。旧记录本身仍不可打开，这是主控明确保留的状态，后续随旧路线删除转成版本；本票不宣称修复这些旧历史目标。

### 合并验收（Claude）

Astra（新实例 t131-astra，2026-10-07 23:19 EDT）审 07c0e61..6fe1a42：PASS（仅 SiteMigrationError 转为可见失败；JSON 损坏、权限错误、code-sites 读错照常抛出；失败记录不覆盖不删除）。合并为 e3aefbd，主工作区 3034：`GET /api/sites` 200，ab-ind-asm 与 goal-live-20260923 显示「旧记录无法打开」；`npm run typecheck`、`SITECRAFT_BASE=http://127.0.0.1:3034 CHROME_PATH=<指定路径> npm test` 2546/2546、`npm run build` 通过（输出 gitignore 的 `artifacts/merge-t131/`）。T-128 合并复验时失败的两项列表用例在主工作区数据上已通过。

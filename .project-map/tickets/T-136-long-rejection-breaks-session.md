---
id: T-136
title: 生成失败的拒因摘要过长会写坏会话，之后草稿接口持续 500
type: build
status: open
blocked_by: []
claimed_by: t134-build
supersedes:
---

## Why

T-134 整轮评估（`sitecraft-ai-t134/artifacts/t134/alignment-failure-observed.json`）：一站生成三轮均被底线检查拒收，失败摘要 678 字超过会话字段上限 400，持久化后会话快照无效，`GET /api/sites/<id>/draft` 之后一直返回 500，用户刷新后整站打不开。T-133 Resolution 已记录同类现象。这是主流程（生成 → 刷新恢复）上的缺陷。

## What to build

在根因层修：写入会话的失败说明不能产生无效快照。用户看到的说明保持简短中文（例如说明哪类问题、可以怎么做），完整拒因留在运行记录和版本检查结果里，不丢失、不截断存档。修复后已被写坏的会话不需要自动迁移（不自动改用户数据），但读取时若遇到超长字段要如实报错并让站点其余部分可打开，不能整站 500。

## Acceptance

- [x] 用 T-134 那一站的真实失败拒因做夹具，真实入口复现 500（父实现失败），修后同一路径刷新可打开站点、显示简短失败说明，完整拒因可在运行记录中查到
- [x] 读取已写坏的旧会话不再整站 500，有测试
- [ ] Astra 审查通过；typecheck、test、build 通过

## Resolution

**功能与相关检查 PASS；整票 INCOMPLETE，保持 open。** 执行者 t134-build。Astra 最终审查由主控安排；全量测试还有两项旧 worktree 数据失败，不报全套 PASS。未派审查、关票或推送。全程模型服务只用本地夹具，真实 DeepSeek 调用为 0。

本次运行基于 `a3c90db` + dirty，生产代码在原生绿验证之前完成，之后仅增加共享摘要边界测试和更新文档。对应本票单一提交 `fix: preserve sessions after long code-site rejections`；最终 SHA、命令完成时间和交接状态在 gitignore 的 `artifacts/t136/handoff.json`。证据均为 2026-10-08 本次工作产生，不引用 T-134 的旧绿结果作为修复验收。

### 根因与最小修复

- 原生成失败把完整拒因直接写入 `lastResult.summary` 和 `history[].summary`，超出已有 400 字约束；写入不验证快照，下一次读取失败。本票使用 T-134 `alignment-failure-observed.json` 和 `private/t134-case8-current.json` 中的真实材料、四页末轮候选、五条完整拒因和 678 字失败说明，整理为 `tests/fixtures/t136/long-rejection.json`，注明来源；T-134 原记录未改。
- 生成三次拒收后给会话 41 字的简短中文说明，说明未存版及补充资料/调整要求后重试；完整拒因不截断，仍在 `CodeRun.issues` 与三轮 `attempts[].checks.issues`。工作台可展开最后一轮完整问题。
- 共享 `applyCommittedResult` 限制摘要并用同一合法摘要记录结果与历史，保护其他调用者。文件替换和 PostgreSQL 更新前都验证会话快照；非法写入拒绝，原记录保留。
- 已有会话读取仅在所有校验错误均为超长字符串时返回明确 `conversationError`，资料/运行/版本继续读；不截短、不重置或写回旧记录。界面提示、停用对话输入，预览和版本历史可查看。状态读取先识别该警告，避免改旧任务元数据；其他损坏继续报错，不用宽 catch 隐藏。

### 红绿与坏实现

环境：SITE_STORE=fs，本 worktree 的 3148、默认 Turbopack。CHROME_PATH 为 AGENTS 指定的 chrome-headless-shell。模型地址只指向本地夹具，检查服务用本地不可达地址隔绝上游；没有加载或复制真实密钥，没有向真实 DeepSeek 发请求。只关闭自有 dev/Chrome/夹具进程。

1. 父实现红命令：`CHROME_PATH=<指定路径> node --test --experimental-strip-types tests/t136-session-summary.test.ts` → `artifacts/t136/parent-red.log`，19:50:55 UTC，三项 AssertionError：新拒收后刷新 500≠200；旧坏会话 500≠200；写入接受非法快照。API handler、提交入口、Chrome 和存储真实，仅 provider HTTP 与 Next 延后调度为夹具。
2. 实际 Next 父入口：3148 dev，对上述测试创建的两个隔离记录读 `GET /api/sites/<id>/draft`，均 HTTP500；`native-parent-red.json`，19:52:49 UTC，cwd/driver 已确认。修后同两个记录 HTTP200、明确会话警告，前后原文件内容一致，`native-legacy-green.json`；没有修补数据使读测试变绿。
3. 相关绿命令：`CHROME_PATH=<指定路径> node --test --experimental-strip-types tests/t136-session-summary.test.ts tests/alignment.test.ts tests/conversation-store.test.ts tests/t128-code-boundary.test.ts tests/t130-run-records.test.ts` → `related-green.log`，20:06:27 UTC，63/63、exit0，无取消/跳过。四项本票检查覆盖完整拒因、新记录合法、旧读取不写回/不调模型、已存版本可读、非法写入保留前文件、其他损坏不被伪装、共享结果和历史两个摘要都满足既有上限。
4. `artifacts/t136/mutant-loader.mjs` 只改测试进程加载的源码，不编辑生产文件。命令形式：`T136_MUTANT=<模式> CHROME_PATH=<指定路径> node --import ./artifacts/t136/mutant-loader.mjs --test --experimental-strip-types --test-name-pattern='<用例>' tests/t136-session-summary.test.ts`。五个模式全部 exit1 / 目标 AssertionError，日志 `mutant-<模式>-red.log`：
   - `unbounded-result` / `shared committed-result`：摘要与历史不限制长度；
   - `no-write-guard` / `a writer cannot`：非法快照被接受；
   - `no-reader` / `old oversized`：旧读取重新 500；
   - `broad-reader` / `a writer cannot`：其他类型损坏被错误当作可读，200≠500；
   - `truncate-issues` / `real long rejection`：完整拒因被截短，与真实输入不符。

### 原生入口与三档界面

命令：`CHROME_PATH=<指定路径> node --experimental-strip-types artifacts/t136/native-flow.mjs`。脚本创建自有本地 provider 与真实 Next dev，通过 HTTP 创建站点、资料/风格/大纲确认、生成、提交检查、刷新；没有替换 Next 的 after。随后经真实 PUT 提交入口保存一个合法版本，仅对本次新建的隔离会话注入真实旧长文，读取工作台与历史，再刷新并核对旧文件原文未变。

`native-flow-green-2.log` / `native-2026-10-08T20-04-39-384Z/report.json`：20:04:57.304 UTC，PASS；本地夹具 8 次请求（规划、三次写页、三次拒因校对及一次合法版本校对），真实模型 0 次。新拒收站 `cc51feb6-3b10-42ff-a977-d6e37acc3c94`：三轮候选均拒，未存版，会话说明 41 字，五条完整拒因与三轮检查保留，draft/state 刷新可读。旧会话站 `caf961cf-15e9-4f6a-b89c-fb8859ec21a7`：明确警告、停用对话，已有第 1 版可预览/看历史，读取及刷新不改旧文件。原生脚本首次因未打开的日志流而启动失败（`native-flow-green.log`），未进入验收；失败保留，只修辅助启动顺序后复跑同一流程，不算产品红证据。

新失败说明、旧会话警告、版本历史各 1440/768/375，共 9 张工作台截图全部打开；清单 `artifacts/t136/viewed.json`。拒收后的无版本预览是应有的工作台空状态，不把它当作成功生成页或审美证据。

### 最终检查与边界

- `SITE_STORE=fs SITECRAFT_BASE=http://127.0.0.1:3148 DEEPSEEK_BASE_URL=http://127.0.0.1:9 DEEPSEEK_API_KEY=<本地夹具值> DEEPSEEK_MODEL=t136-fixture CHROME_PATH=<指定路径> npm test -- --test-concurrency=1` → `npm-test.log`，20:17:52 UTC，2589/2591、exit1，取消/跳过 0。仅 T-090 固定旧站点 `geometry-real-hero/scan.json` 缺失、T-113 固定旧图片 GET404；与此前 worktree 记录相同，未复制旧数据、跳过检查或改弱断言。
- `npm run build`（默认 Turbopack）→ `build.log`，20:20:57 UTC，exit0；随后 `npm run typecheck` → `typecheck-final.log`，20:22:40 UTC，exit0。`git diff --check`、UTF-8 回读与 project-map status 无问题/无过时 living doc。没有新增依赖、重试或平行站点 API。
- 本票不自动迁移已经损坏的用户会话；人工修复前该会话的对话不可用，站点其余记录保持可读。PostgreSQL 更新也加入同一写前校验，但未实测外部数据库，本票验收使用 fs。Astra 与主控最终验收待安排，不关闭票、不推送。

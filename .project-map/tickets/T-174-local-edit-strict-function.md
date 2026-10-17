---
id: T-174
title: 局部写作改用严格函数参数提交（T-173 第二组遗留）
type: build
status: open
blocked_by: [T-173]
claimed_by: Codex
supersedes:
---

## Why

T-173 第二组（首页用餐场景 + 菜单页午市组合，跨页多区块）在追加授权的唯一一次重跑中，首个局部写作调用 HTTP 200、finish_reason=stop，但回答 1,284 字符不是合法 JSON，系统如实拒收、未存版（2026-10-17，实付 5,633）。局部写作仍走 `response_format: json_object`，与翻译、大纲的严格函数参数提交不是同一机制；失败时只记字符数，原始回答未保存，无法确认具体缺陷。真实用户批注同样会随机碰到。

## 构思主控决定（2026-10-17）

- 局部写作和修正轮改用严格函数参数提交，与翻译同一套机制；不保留 json_object 旧路径。
- 任何解析失败都把原始回答、finish_reason、用量存进任务记录。格式错误不重试、不宽松解析，不变。
- 余额 19,367 属负责人已批的 T-173 第二组 2.5 万额度，修好并经新的 sol 实例复审通过后可沿用：在导入主目录的「（批注验收）」站的 v2 副本上只跑一次第二组，截断、超额或拒收即停；存版后交新实例盲评。
- 同一时间最多一个重任务。

## What to build

1. 坏例先行：覆盖这次失败形态（回答 1284 字符、finish_reason=stop、不是合法 JSON）。原文未保留，按「合法 stop 但 JSON 不完整」构造本地模型替身；在当前主线上证明原始回答未保存（失败），修好后格式错误如实拒收且原始回答已保存。
2. 局部写作（单区块、多区块批次）与修正轮改为严格函数参数提交，函数参数 schema 与现有局部写作输出合同一致；删除 json_object 路径。
3. 解析失败（含函数缺失、参数非 JSON、schema 不符）统一在任务记录保存原始回答、finish_reason、用量；不进修正轮、不重试。
4. 同步 AGENTS.md 相关规则（只写规则）、spec.md。

## Acceptance

- [ ] 坏例测试先红后绿；独立 sol 复审通过；typecheck、test、build 通过
- [ ] 真实 chat 入口在「（批注验收）」站 v2 副本上跑第二组并存版，用量写进 Resolution；工作台三档出处显示正确
- [ ] 独立盲评实例对比第二组原版和修改版的结论写进 Resolution

## Resolution

### 离线修复（2026-10-17，Codex）

本轮只修局部写作格式边界；独立 sol 复审、真实第二组运行及盲评由主控另行安排，票保持 open，原验收项不勾选。已只读核对 T-173「第二组追加授权的单次重跑」及主工作区 `artifacts/t173/blind2-20261017T050426Z/private/outcome.json`：原回答正文未留存，1,284 字符坏例为按失败形态构造的替身，不能当作真实原答复原。

单区块、多区块各组和局部修正轮统一调用已有 `functionOutput`，用 `submit_local_edit` 严格函数参数提交原合同的两种互斥对象（html/css 或 cannotEdit），删除局部 json_object 路径。schema 沿用 `strictFunctionParameters` 的转换和响应端 Zod 校验；格式校验在模型响应边界完成，工作流只把区块范围和内容底线拒因交回修正。没有兼容开关或替代写作路径。Deep modules：复用既有模型入口，没有增加生产包装层；Ubiquitous language 沿用「局部修改」「区块」「修正轮」。

现有大纲在思考开启时用 beta strict tools 与 tool_choice=auto，翻译关闭思考后才强制指定函数；局部写作沿用大纲的做法，仍开启思考、上限 12288。响应必须是唯一匹配函数且 finish_reason=tool_calls，stop 不视为成功，length 如实报截断。局部事实核对仍固定非思考、4096。所有严格函数响应在解析前记录 content、tool_calls、finishReason 和 usage；局部 schema 错误也保留这些字段，不重试、不宽松解析、不进入修正轮、不继续后续组。任务不保存凭据、请求头或完整请求。

#### 红绿证据

父版本 `1497da824003efa3ac6decf5a2c8acde7d855aa8` 在生产实现未改前运行 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t174-local-function.test.ts`，2026-10-17T05:48:40.638Z：28 项均按未实现合同失败。日志 `artifacts/t174/parent-1497da8-red.log`，报告 `artifacts/t167/test-run-1792216091958-71834/report.json`，临时根 `sitecraft-test-MrwuSg` 保留。父版本 `local-function-1792216095568-71859/single-stop-1284.json` 明确为 HTTP 200、stop、answerChars=1284、一次请求、未存版，但 rawMessage 缺失；合法函数回复也被旧正文解析路径拒收。期望来自票的合同，没有导入生产 schema 或用实现输出生成答案。

相同命令修后于 05:49:49.725Z 28/28 通过，日志 `artifacts/t174/local-function-green.log`，报告 `artifacts/t167/test-run-1792216161282-72649/report.json`，临时根 `sitecraft-test-xWo7UZ` 保留。覆盖合法单区块与跨页批次实际改标题并经提交入口存版、二者的真实修正轮请求、坏 JSON、Markdown 包装、缺函数／错函数／多函数、schema 缺字段／多字段／混用对象、stop 与 length、合法 cannotEdit。坏例均核对原始回答、结束原因、用量、零修正与不存版；不是仅断言抛错。Tracer bullet 由生产 chat POST、原任务、HTTP 模型替身、统一提交入口及普通 dev 服务读回构成，只控制 after 调度，不称为真实 Next after 集成或真实模型能力证据。

#### 规定验证

`CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t174-local-function.test.ts tests/t164-*.test.ts tests/t173-*.test.ts tests/t169-*.test.ts tests/t151-*.test.ts tests/t154-*.test.ts tests/t162-inline-annotation.test.ts tests/t162-element-hint.test.ts tests/t163-model-elements.test.ts tests/t152-local-model-input.test.ts` 于 05:52:41.256Z 通过 321/321，失败／取消／跳过为零。日志 `artifacts/t174/focused.log`，报告 `artifacts/t167/test-run-1792216237083-73528/report.json` 保存 29 个展开文件与身份，临时根 `sitecraft-test-T8ph1i` 保留。现有替身只调整局部回复的传输编码及大纲函数识别，原业务断言保留。

随后串行运行 `node --test --experimental-strip-types scripts/t167-runner-regressions.ts`，05:52:55.835Z 4/4（`artifacts/t174/runner.log`）；`npm run typecheck`，05:52:58.471Z 通过（`typecheck.log`）；确认工作树不存在 `.env.local` 后运行 `SITE_STORE=fs npm run build`，05:53:23.940Z 通过（`build.log`）。时间均为 UTC，日志 mtime 记录对应完成时间。

定向生成的 29 张批注、重叠确认及原始资料／消息／上传／表格出处截图均逐张打开，清单 `artifacts/t174/focused-screenshot-views.json`。`artifacts/t162/self-contained-1792216240385-73631/rejected-1440-*.png` 的预览仍显示载入态，不作为有效截图证据；composer-375 只作输入状态，reveal-375/768 是工作台缩放的 1440 预览，不作生成站相应宽度版式证据。其余三档出处图可见原句与来源文字。本轮不自评审美。

AGENTS 与 spec 同步严格提交、格式错误终止与响应留存规则，局部运行时合同同步函数要求；CONTEXT 与 mainline 窄改对应当前说明，避免 living doc 过时。

#### 冻结全量与交接

实现及测试冻结到本地提交 `d459ae342f539d1553b3553789f96ab15985a149`。05:53:40Z 全量前 `memory_pressure` 空闲 58%，`ps -axo pid,ppid,command` 无其他 Chrome 无头测试、node --test 或 Next build；原始输出为 `artifacts/t174/pre-full-memory.txt`、`pre-full-processes.txt`。在该冻结提交上只串行运行一次 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test`，2026-10-17T05:58:05.441Z 完成：751/751，失败／取消／跳过为零，耗时 226576ms。日志 `artifacts/t174/full.log`，报告 `artifacts/t167/test-run-1792216457382-80038/report.json`；临时数据根 `/var/folders/7v/58svbpnj5k91zdnm5zggb38h0000gn/T/sitecraft-test-k5XelS` 保留。没有重跑全量、放宽断言、延长预算或更换入口。05:58:40Z 结束进程检查无残留本轮测试 Chrome、node --test、dev server 或 Next build（`post-processes.txt`）。

本轮离线修复及规定本地验证 **PASS**；整票验收仍 **INCOMPLETE**，独立 sol 复审、真实第二组存版、三档真实出处显示及独立盲评由主控安排，不以替身或自查代替。真实 DeepSeek strict schema 兼容性及生成效果本轮未实测。未调用 DeepSeek、未读取 `.env.local`、未使用 rm、未推送、未写主目录 `.sitecraft-data`；`tsconfig.json` 的 Next 自动修改保留未提交。最后只补本 Resolution 并 amend 同一个功能提交，运行实现与测试仍等于上述冻结提交；project-map 检查无问题及过时 living doc，票继续由 Codex 领取等待交接。

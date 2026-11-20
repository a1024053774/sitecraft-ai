---
id: T-221
title: 模型接口支持 OpenAI 兼容与 Anthropic 兼容格式
type: build
status: open
blocked_by: []
claimed_by:
supersedes:
---

## What to build

2026-11-20 负责人确认：模型接口除 DeepSeek 外，还要能用 OpenAI 兼容格式和 Anthropic 兼容格式的 key。起因是 T-220 审查时用 OpenAI 官方接口实跑，规划请求被发到 `/beta/chat/completions`，返回 HTTP 404。

- 设置页「模型接口」加「接口格式」：DeepSeek（默认）、OpenAI 兼容、OpenAI Responses、Anthropic 兼容。旧设置没有这一项，按 DeepSeek 处理。
- 模型客户端只有一处发请求。按格式换请求和回复的写法，回复之后的校验、检查、修正、存版、拒收规则不变。
- DeepSeek 格式的请求和记录与改动前逐字段相同。

## 三种格式的差别

| | DeepSeek | OpenAI 兼容 | Anthropic 兼容 |
| --- | --- | --- | --- |
| 地址 | 函数输出发 `/beta/chat/completions`，其余 `/chat/completions` | `/chat/completions`；地址不带路径时补 `/v1` | `/v1/messages`；地址已以 `/v1` 结尾时不重复 |
| 凭据头 | `Authorization: Bearer` | `Authorization: Bearer` | `x-api-key` 加 `anthropic-version: 2023-06-01` |
| 函数输出 | 严格函数，`tool_choice: auto`（翻译为指定函数） | 严格函数，指定函数 | 工具调用，指定工具 |
| 整站写作与修正 | `response_format: json_object` | `response_format: json_object` | 没有 JSON 模式，按提示词输出 JSON 文本后解析 |
| 思考开关 | 按用途固定开或关 | 不发送，任务记录里不写 thinking | 不发送，任务记录里不写 thinking |
| 温度 | 0.5，翻译 0.2 | 不发送 | 不发送 |
| 输出上限 | 按用途，最高 65536 | `max_completion_tokens`，同一数值但不超过 32000 | `max_tokens`，同一数值但不超过 32000 |
| 结束原因 | 函数输出须为 `tool_calls` | 指定函数时上游报 `stop`，以唯一匹配的函数调用为准 | `tool_use` |

不发思考开关和温度的原因：Anthropic 指定工具时不能开思考，两家较新的模型会拒绝非默认温度。32000 的原因：两家常见模型的输出上限低于 65536，超限会直接 400。被截断仍然报错、不存版本。

事实核对的「重复 JSON 属性立即拒收」：Anthropic 返回的函数参数已是解析后的对象，重复属性只在 HTTP 正文里看得到，所以对正文原文做同一检查。

## Acceptance

- [x] DeepSeek 格式的请求地址、请求头、请求体与改动前相同（`tests/t221-provider-formats.test.ts` 逐字段断言）。（2026-11-20 独立审查有反例，见「独立审查」）
- [x] OpenAI、Anthropic 两种格式下，规划与事实核对经本地替身通过共用校验；截断、函数名不符、HTTP 404、Anthropic 正文重复属性均拒收，每次请求只记一条调用，不重试，凭据不进记录。（2026-11-20 独立审查有反例，见「独立审查」）
- [x] 请求头 `X-SiteCraft-Provider-Format` 可缺省（按 DeepSeek），未知值返回 400；`AI_PROVIDER_FORMAT` 供本机环境变量使用。（2026-11-20 独立审查有反例，见「独立审查」）
- [x] 设置页可选格式，切换时只替换表单自己填的默认地址和模型名；1440 与 375 无横向溢出。
- [x] Chrome 里用本地替身分别以 Anthropic 格式（环境变量）和 OpenAI 格式（设置页保存后经请求头）从新建走到第 1 版。
- [x] 真实 OpenAI 接口跑通规划、生成、批注修改、整页修改（`gpt-6.2-sol`，经 OpenAI Responses 格式；chat completions 格式下该模型被上游拒绝，见实跑记录）。
- 真实 Anthropic 接口实跑：2026-11-20 负责人决定不再作为本票验收。Anthropic 兼容格式只经本地替身验证，产品页、演示和 README 已如实写明。
- [x] `npm run typecheck`、`npm run build`、全量 `npm test` 通过（加入 Responses 格式之前的提交）。加入之后重跑：非浏览器 144/144，浏览器 1116/1116。2026-11-20 合并后的主线 c5c09cdd 在负责人 Mac 重跑：入口回归 18/18，非浏览器 144/144，浏览器 1121/1121，`npm run typecheck` 通过（先 `npx next typegen`，见 T-223 第 7 节）；`npm run build` 按规则不在 Mac 运行。
- [ ] 回复文字被拆成多段、拼起来才含 key 时，调用记录和返回内容里都不留 key（OpenAI Responses、Anthropic）
- [ ] 非 2xx 回复的编号响应头里出现转义形式的 key 时，记录里不留可还原的 key（`request-id`、`x-request-id`、`x-ds-trace-id`）
- [ ] OpenAI Responses 回复里被采用的输出项自身未完成（`incomplete`、`in_progress`）时拒收
- [ ] DeepSeek 格式下，地址以 `//` 结尾、HTTP 200 正文不是 JSON 这两种输入的请求地址和调用记录与 0eefc1f6 相同；或由负责人确认接受这两处差异
- [ ] 请求只带 `X-SiteCraft-Provider-Format` 且值未知时返回 400

## Notes

- 提示词、风格规范和思考开关的取舍都是在 DeepSeek 上定的；另外两种格式的生成质量没有评估过。
- OpenAI 严格函数对 JSON Schema 的要求与 DeepSeek 不完全相同。现有 schema 没有在真实 OpenAI 接口上发过，被拒时会显示上游的 400。
- `scripts/` 下的真实预算脚本仍只认 `api.deepseek.com`，本票不改。
- OpenAI 兼容格式走的是 `/chat/completions`。另一轮会话记录过（未经本票验证）：官方接口上的 `gpt-6.2-sol` 只允许经 `/v1/responses` 使用函数工具，且 `submit_fact_review` 的严格 schema（约 5.9 万字符）在那里返回 HTTP 500。若属实，该模型需要另加 Responses 格式并放宽严格模式，这要负责人另行确认；其他支持 chat completions 的 OpenAI 兼容服务不受影响。

## 真实接口实跑记录

- 2026-11-20，OpenAI 官方接口，`gpt-6.2-sol`，OpenAI 兼容格式，本机环境变量配置。新建站点、载入模拟纸包装包（1921 字）、风格选「帮我选」后规划。请求到达 `https://api.openai.com/v1/chat/completions`，上游返回 HTTP 400：`Function tools with reasoning_effort are not supported for gpt-6.2-sol in /v1/chat/completions. To use function tools, use /v1/responses or set reasoning_effort to 'none'.` 没有用量，没有存大纲。工作台停在第 3 步「页面大纲没有拟出来」。只试了这一次，大纲之后的步骤没跑。
- 结论：地址和凭据是对的（不再是 404），但这个模型在 chat completions 下不能带推理调用函数。要跑通它有两条路，都需要负责人定：加 Responses 格式（保留推理）；或在 chat completions 下把推理关掉（规划、事实核对、局部修改都不带推理）。
- 这类 400 现在显示「上游不允许这个模型在此接口上带推理调用函数，请换模型或接口格式」。

### OpenAI Responses 格式（2026-11-20，负责人选定：保留推理，严格模式被拒再关）

`POST <地址>/responses`，`instructions` 放系统提示，`input` 放用户消息，函数为 `{type:function,name,parameters,strict:true}` 并指定调用，整站写作用 `text.format: json_object`，`max_output_tokens` 取原数值与 32000 中较小者，`store:false`，不发推理设置和温度。回复从 `output` 里取唯一匹配的 `function_call` 或 `message` 文本；`status: incomplete` 且原因为 `max_output_tokens` 记为截断。

同一站点、同一 key、`gpt-6.2-sol`，Chrome 1440 操作，各步只跑一次，全部 HTTP 200：

| 步骤 | 调用 | 结果 |
| --- | --- | --- |
| 规划 | plan 18 秒，14653 token（推理 258） | 大纲 3 页，等待确认 |
| 生成 | write 64 秒 18482 token；facts 31 秒 77986 token | 第 1 版保存，底线检查通过 |
| 两条批注一起发送 | local-edit 7 秒与 12 秒；local-facts 5 秒 | 合并 2 个区块，第 2 版保存；画布退出，草稿清空 |
| 整页修改 | select 2 秒；write 75 秒 24196 token；facts 31 秒 80738 token | 第 3 版保存，底线检查通过 |

- 严格模式没有被拒：`submit_page_plan`、`submit_local_edit`、`submit_fact_review` 都以 `strict:true` 通过，所以没有关。
- 这一轮没跑的撤销、内容修正轮、375 与 768 宽度，在下面 2026-11-20 的主线实跑里补上了。

### 合并后主线实跑（2026-11-20，c5c09cdd，负责人 Mac，本机环境变量配置）

模拟主体「岚坞茶叶专业合作社」（茶叶合作社，1842 字，现有资料包里没有的行业），Chrome 1440 从工作台真实入口操作，三个站点。有记录的 26 次模型调用都是 HTTP 200，各站页面在 1440、768、375 下无横向溢出、无坏图。

| 站点 | 步骤 | 调用 | 结果 |
| --- | --- | --- | --- |
| `15ceba41`，`gpt-6.2-sol`，OpenAI Responses | 规划、生成 | plan 23 秒 14,421；write 87 秒 18,323；repair 3 秒 10,414；facts 29 秒 60,053 | 第 1 版，用了一轮修正（T-223 第 1 条） |
| 同上 | 补 4 张图的整站修改 | select 5 秒 7,470；write 76 秒 24,043；facts 33 秒 67,262 | 第 2 版 |
| 同上 | 三条批注一次发送 | local-edit 三次共 14,287；local-facts 10 秒 19,726 | 第 3 版，三个区块都按意见改了 |
| 同上 | 首页快捷修改「更大胆」 | select 4 秒 7,313；write 56 秒 23,003；repair 2 秒 10,894；facts 30 秒 70,638 | 第 4 版，用了一轮修正（T-223 第 4 条） |
| 同上 | 撤销 | 请求 35.9 秒，调用没有记录（T-223 第 3 条） | 第 5 版，代码与第 3 版相同 |
| `a2acadb0`，`gpt-6.2-sol`，OpenAI Responses | 先传 4 张图再规划、生成 | plan 27 秒 15,051；write 103 秒 20,120；facts 37 秒 84,541 | 第 1 版，没有修正轮 |
| 同上 | 一条批注换掉一张图 | local-edit 14 秒 5,632；local-facts 9 秒 16,638 | 第 2 版，其余页面和页头页脚不变；公开样品见 [T-222](T-222-tea-sample-showcase.md) |
| `b41df306`，`deepseek-flash`，DeepSeek | 规划、生成 | plan 20 秒 15,488；write 170 秒 51,806；facts 131 秒 88,770 | 第 1 版，没有修正轮 |
| 同上 | 补 4 张图的整站修改 | select 4 秒 7,159；write 68 秒 35,552；facts 45 秒 81,098 | 第 2 版已保存，任务却被标成中断（T-223 第 2 条） |

- 有记录的用量：OpenAI 两站 489,829 token（20 次调用），DeepSeek 一站 279,873 token（6 次调用）。
- 页面质量：把同资料的 `gpt-6.2-sol` 与 `deepseek-flash` 成对交 Codex gpt-6.1-sol（high，每对一个新实例，只看匿名截图）。无图一对选了 `deepseek-flash`，有图一对选了 `gpt-6.2-sol`。一家公司、每对一位评审，1 比 1，对两个模型的优劣没有结论。
- 仍没跑：非 DeepSeek 格式下的英文版翻译（`submit_english_translation`）和检查续跑、设置页填 key 经请求头的路径、OpenAI 兼容（chat completions）格式的真实成功调用。Anthropic 兼容格式没有真实接口结果，负责人已决定不再验证。
- 证据在这台 Mac 上 gitignore 的 `artifacts/t221/real-openai-2026-11-20/` 与 `artifacts/t221/followup-2026-11-20/`（各站的任务记录、截图、盲评包与原始结论）；全量测试日志在 `artifacts/t221/mainline-checks/`。

### 独立审查（2026-11-20）

Codex gpt-6.1-sol（high，只读，独立实例）按 design-integrity-review 审 0eefc1f6..2909c2f7 五个提交，结论 **FAIL**：5 项新发现，另 1 项在本票之前就有。原文在 `artifacts/t221/review/design-integrity.codex-gpt-6.1-sol.txt`。主控用合成凭据和内存里的假回复逐项复现（`artifacts/t221/review/repro.ts`，结果 `repro.txt`），没有改代码：

1. **拆开的 key 进了记录**（P1）：OpenAI Responses 回复把 key 拆在两段 `output_text` 里，正文检查查不到；两段拼起来后，完整的 key 留在调用记录的 `response.rawMessage.content`。规划入口已复现；同一段 key 连续出现时会被正确舍弃。审查方称写页入口会把含 key 的 CSS 返回，Anthropic 同理，这两点主控没有单独复现。
2. **编号响应头里转义的 key**（P1）：HTTP 400 的 `request-id` 头里放 `\uXXXX` 形式的 key，记录的 `httpError.requestId` 原样保留，解码即得 key。`request-id` 是本票新加的；`x-request-id`、`x-ds-trace-id` 的同样问题在本票之前就有。明文 key 会被替换成 `[REDACTED]`。
3. **未完成的输出项被接受**（P2）：外层 `status: completed`，里面的 `function_call` 自身是 `incomplete` 或 `in_progress`，仍被当成正常的函数调用。官方接口是否会给出这种组合没有核实。
4. **DeepSeek 与改动前不一致**（P2）：地址以 `//` 结尾时，原来请求 `…//beta/chat/completions`，现在请求 `…/beta/chat/completions`；HTTP 200 而正文只有 `{` 时，原来的调用记录没有 `response` 字段，现在多了三个空值字段，报错文字也变了。正常地址下两边相同。
5. **只带格式头时不校验**（P2）：请求只带 `X-SiteCraft-Provider-Format: unknown`、不带地址、key 和模型名，处理函数照常执行并返回 200；四个头都带时返回 400。

对应的五条验收已加在上面，票保持打开。修复涉及模型客户端和凭据处理，要负责人先安排。


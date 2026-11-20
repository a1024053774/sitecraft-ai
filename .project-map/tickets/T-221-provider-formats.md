---
id: T-221
title: 模型接口支持 OpenAI 兼容与 Anthropic 兼容格式
type: build
status: open
blocked_by: []
claimed_by: Devin
supersedes:
---

## What to build

2026-11-20 负责人确认：模型接口除 DeepSeek 外，还要能用 OpenAI 兼容格式和 Anthropic 兼容格式的 key。起因是 T-220 审查时用 OpenAI 官方接口实跑，规划请求被发到 `/beta/chat/completions`，返回 HTTP 404。

- 设置页「模型接口」加「接口格式」：DeepSeek（默认）、OpenAI 兼容、Anthropic 兼容。旧设置没有这一项，按 DeepSeek 处理。
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

- [x] DeepSeek 格式的请求地址、请求头、请求体与改动前相同（`tests/t221-provider-formats.test.ts` 逐字段断言）。
- [x] OpenAI、Anthropic 两种格式下，规划与事实核对经本地替身通过共用校验；截断、函数名不符、HTTP 404、Anthropic 正文重复属性均拒收，每次请求只记一条调用，不重试，凭据不进记录。
- [x] 请求头 `X-SiteCraft-Provider-Format` 可缺省（按 DeepSeek），未知值返回 400；`AI_PROVIDER_FORMAT` 供本机环境变量使用。
- [x] 设置页可选格式，切换时只替换表单自己填的默认地址和模型名；1440 与 375 无横向溢出。
- [x] Chrome 里用本地替身分别以 Anthropic 格式（环境变量）和 OpenAI 格式（设置页保存后经请求头）从新建走到第 1 版。
- [ ] 真实 OpenAI 接口跑通规划、生成、批注修改、整页修改。
- [ ] 真实 Anthropic 接口跑通同样的步骤。
- [x] `npm run typecheck`、`npm run build`、全量 `npm test` 通过。

## Notes

- 提示词、风格规范和思考开关的取舍都是在 DeepSeek 上定的；另外两种格式的生成质量没有评估过。
- OpenAI 严格函数对 JSON Schema 的要求与 DeepSeek 不完全相同。现有 schema 没有在真实 OpenAI 接口上发过，被拒时会显示上游的 400。
- `scripts/` 下的真实预算脚本仍只认 `api.deepseek.com`，本票不改。
- OpenAI 兼容格式走的是 `/chat/completions`。另一轮会话记录过（未经本票验证）：官方接口上的 `gpt-6.2-sol` 只允许经 `/v1/responses` 使用函数工具，且 `submit_fact_review` 的严格 schema（约 5.9 万字符）在那里返回 HTTP 500。若属实，该模型需要另加 Responses 格式并放宽严格模式，这要负责人另行确认；其他支持 chat completions 的 OpenAI 兼容服务不受影响。

## 真实接口实跑记录

- 2026-11-20，OpenAI 官方接口，`gpt-6.2-sol`，OpenAI 兼容格式，本机环境变量配置。新建站点、载入模拟纸包装包（1921 字）、风格选「帮我选」后规划。请求到达 `https://api.openai.com/v1/chat/completions`，上游返回 HTTP 400：`Function tools with reasoning_effort are not supported for gpt-6.2-sol in /v1/chat/completions. To use function tools, use /v1/responses or set reasoning_effort to 'none'.` 没有用量，没有存大纲。工作台停在第 3 步「页面大纲没有拟出来」。只试了这一次，大纲之后的步骤没跑。
- 结论：地址和凭据是对的（不再是 404），但这个模型在 chat completions 下不能带推理调用函数。要跑通它有两条路，都需要负责人定：加 Responses 格式（保留推理）；或在 chat completions 下把推理关掉（规划、事实核对、局部修改都不带推理）。
- 这类 400 现在显示「上游不允许这个模型在此接口上带推理调用函数，请换模型或接口格式」。


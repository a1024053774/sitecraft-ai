---
id: T-165
title: 预算网关按 token 估算预留
type: build
status: open
blocked_by: []
claimed_by: Codex (t165-token-reserve)
supersedes:
---

## Why

`scripts/t153-real-budget.ts` 按 UTF-8 字节预留输入（每字节 1 token + 8192），中文一个字记 3 个 token，实际约 1 个，预留约为实际的 3 倍。它误拦了 T-160 教育站的修正调用和 T-162 的真实单条批注（青禾纸品局部修改预留 16,598，实际同类约 7–10k），T-159 也因单次预留过大导致写页截断。2026-10-13 负责人批准改为按 token 估算。优先级 3，但一直在挡真实运行，可与 T-159 并行。

## What to build

1. 输入预留改为按 token 估算：中文（CJK）、ASCII、其他字符分别按保守系数计，再加请求框架余量。系数和余量依据现有真实账本（`artifacts/t153`、`t158`、`t160` 的 usage.json：请求体与 DeepSeek 返回的 prompt_tokens）定，写明来源；估算值须不低于这些真实调用的实际 prompt_tokens。
2. 仍然拦住超支：累计已用 + 本次输入估算 + 本次输出上限不超过 SITECRAFT_TOKEN_LIMIT；实际用量超出估算时记入账本并停下（沿用现有 stopped 语义）。不加重试、不加宽松回退。
3. 不改网关的其他合同（显式上限、账本、resume、目录白名单、本地 origin 校验）。同步 AGENTS.md 中相关一句与本票。

## Acceptance

- [x] 红绿：用 T-160 被拦的修正请求和 T-162 青禾纸品两次调用的真实请求体做测试，旧规则下判为放不进、新规则下放得进；测试先在父版本上失败
- [x] 不放松安全：用真实账本里每次调用的请求体，断言新估算 ≥ 实际 prompt_tokens；构造超支场景（剩余额度不足）仍被拦
- [ ] 不调用 DeepSeek；typecheck、test、build 通过；独立 sol 实例代码审查通过

## Resolution

本地执行 **PASS**；整票验收 **INCOMPLETE**（独立审查未执行）。依负责人要求，票保持 open，独立审查由主控另行安排，执行实例不自审、不推送。执行代码、夹具与本票证据说明在同一本地提交，父版本 `351f278`；最终提交 SHA 保存在 gitignore 的 `artifacts/t165/commit.json` 并随交付回报，未用父版本的绿测代替本次验证。

### 改动与系数

只修改 `reserveRequest` 的输入预留计算：遍历完整 JSON 请求的 Unicode 码点（包含消息、工具 schema 和请求参数），汉字（`Script=Han`）×1.5、ASCII ×0.5、其他码点 ×4，向上取整后加 256 token 框架余量。汉字与 ASCII 系数分别留出文本和代码的保守余量；其他码点取 4，保守处理标点、其他文字和 emoji，不能把代理对当成一个 ASCII 字符。34 份真实 usage 的复原请求均被覆盖，去掉 256 框架余量后仍至少高于实际 prompt_tokens 674；没有靠框架余量补足样本低估。这是基于现有样本的估算，不是 tokenizer 的数学上界，实际超估仍沿用记账后 stopped 的行为。

原接口、4096 最低可用输出、显式授权、目录白名单、origin 检查、串行请求、resume 及账本终止语义均沿用。旧测试的「输入必须不低于 UTF-8 字节数」是被本票取代的算法约束，改为正整数检查；安全依据改由真实 prompt_tokens 与 HTTP 网关检查提供。AGENTS 同步一句当前规则。

Tracer bullet 经原 HTTP 网关跑两次青禾纸品请求，再发一个放不进的请求；Deep modules 保留原 `reserveRequest` 接口，不加估算器包装或第二套 API；Ubiquitous language 沿用「输入预留、输出上限、累计授权」，账本字段不另起名字。

### 样本来源与缺口

已先向负责人如实报告：T-153/T-158/T-160 的 usage.json 只保存预留与 usage，没有原始模型请求体，不能声称拿到了原始抓包。按负责人允许的复原路径，用对应历史模型提示和 skill、eval 包的资料/大纲/上传编号/候选/拒因重建请求；事实段上下文按原有确定性提取器复原。账本与应用记录逐次核对 promptTokens/prompt_tokens，未把重复保存的账本重复计入。复原只捕获模型函数即将提交的请求，不出网、不调用 DeepSeek。夹具只保存 `{body, usage}`，不保存请求头、认证信息或密钥。原始资料是模拟公司资料。

| 夹具 | 请求数 | 主工作区 `artifacts/` 下的只读来源 | 提示/skill 来源版本 |
| --- | --- | --- | --- |
| `tests/fixtures/t165/t153-approved.json` | 12 | `t153/approved/real-2026-10-11T03-58/private/{default,low}/code-site.json`、uploads、budget/usage.json | `1daede8` |
| `tests/fixtures/t165/t153-joint.json` | 3 | `t153/joint-t154-t155-20261011/private/default/code-site.json`、uploads、budget/usage.json | `efd377f` |
| `tests/fixtures/t165/t158.json` | 9 | `t158/real-20261011T123145Z/private/case-{1,2,3}/`、budget/usage.json | `23b11d7` |
| `tests/fixtures/t165/t160.json` | 5 | `t160/real-20261012014829Z/private/case-{1,2}/`、budget/usage.json | `13e5422` |
| `tests/fixtures/t165/t160-edu.json` | 3 | `t160/real-edu-20261013T150614Z/private/case-1/`、budget/usage.json | `80cae11` |
| `tests/fixtures/t165/t160-blocked.json` | 1，无 usage | T-160 初稿候选、原三档对比度拒因；当时已用 98,490 / 150,000，修正未出网 | `13e5422` |
| `tests/fixtures/t165/t162.json` | 2 | T-162 工作树 `artifacts/t162/real-35000-2026-10-14T02-19-31-094Z/` | 写作取 actual-target-preflight；事实请求按 before/after 实际候选与资料复原，usage 取原账本 |

T-162 预检事实输入按布局候选构造，不能当成实际响应。本票事实请求改按实际保存的候选和原资料复原；两次真实用量分别为 1132+1766=2898、350+5=355，总计 3253，未沿用预检中的估计用量。完整来源映射和一次性复原命令保留在 gitignore 的 `artifacts/t165/{reconstruct.mjs,provenance.json,reconstruct-first.log}`；复原使用历史源码的内存求值，没有把源码、依赖或构建目录复制成证据。

### 本次红绿证据

2026-10-14 UTC，父版本 `351f278` 的网关源码未改时运行：

`SITECRAFT_BASE=<本次随机本地 origin> node --test --experimental-strip-types tests/t165-token-reserve.test.ts`

红测 **4/7 通过、3/7 失败，退出 1**：T-160 修正与 T-162 预留均被原规则以 `Remaining authorization` 拒绝；原网关 HTTP 入口首个青禾纸品请求返回 502 而非 200。34 条实际输入覆盖与已付超估终止的安全检查在旧版仍通过。证据 `artifacts/t165/red-351f278.{log,json}`，没有用导入错误或环境错误充当红测。

修改后同一信号加既有预算检查：

`SITECRAFT_BASE=<本次随机本地 origin> node --test --experimental-strip-types tests/t165-token-reserve.test.ts tests/t153-budget.test.ts`

**11/11 通过、0 跳过，退出 0**，证据 `artifacts/t165/green-focused.{log,json}`。T-160 输入估算 30,642，剩余 51,510 可留输出 20,868；T-162 两次分别预留 8,878 与 5,376，合计 14,254，即使第一次花满预留也保留完整 6144/4096 输出。HTTP 替身重放真实 usage 后账本实用 3253；大输入在出网前被拦，上游请求数仍为 2；另两项超估/超授权样本把已付 usage 记入账本并停止后续请求。替身只在测试子进程拦截官方 transport，生产 origin 检查没有修改。估算明细见 `artifacts/t165/final-estimates.json`。

`npm run typecheck` 已于本次实现之后退出 0（`artifacts/t165/typecheck.json`）；`npm run build` 于 02:34:57–02:37:56 UTC 退出 0（`build.{log,json}`）。首轮 `npm test` 于 02:34:57–02:40:58 UTC **426/440 通过、14 失败、0 跳过，退出 1**（`test.{log,json}`），完整保留：执行者额外设置 `SITECRAFT_DATA_ROOT=artifacts/t165/full-data`，与既有测试直接读取 `.sitecraft-data` 或自行切换 cwd 的方式冲突，造成 ENOENT/位置断言失败；原测试所找的一个会话文件确实不存在，但位于该额外 data-root 下的对应文件存在。另有 Page.navigate/站点地址等待超时，不能声称这些超时已由预算改动修复。第二次全量验证只纠正启动配置：撤去额外 data-root，让开发服务与既有测试读当前工作树默认目录；普通开发服务路由预热完成且 build 已结束后，于 **02:42:29–02:47:58 UTC** 运行同一个 `npm test`，**440/440 通过、0 失败、0 跳过，退出 0**（`test-standard.{log,json}`）。两次运行分开记录，首轮不删不覆盖；没有修改测试断言、放大超时、跳过用例或调整生产代码来取得第二次结果。

未载入 .env.local、未调用 DeepSeek；无本票 UI 改动或浏览器验收要求。为复原已有修正片段/事实上下文，沿用现存 DOM 确定性 helper；全量既有测试也会使用指定 CHROME_PATH，未把这些运行当成本票页面质量或审美验收。

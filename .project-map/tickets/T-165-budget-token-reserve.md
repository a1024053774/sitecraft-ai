---
id: T-165
title: 预算网关按 token 估算预留
type: build
status: closed
blocked_by: []
claimed_by: Codex (t165-token-reserve)
supersedes:
---

## Why

`scripts/t153-real-budget.ts` 按 UTF-8 字节预留输入（每字节 1 token + 8192），中文一个字记 3 个 token，实际约 1 个，预留约为实际的 3 倍。它误拦了 T-160 教育站的修正调用和 T-162 的真实单条批注（青禾纸品局部修改预留 16,598，实际同类约 7–10k），T-159 也因单次预留过大导致写页截断。2026-10-13 负责人批准改为按 token 估算。优先级 3，但一直在挡真实运行，可与 T-159 并行。

## What to build

1. 输入预留改为按 token 估算：ASCII、官方离线验证的单 token 汉字、其他码点分别按保守系数计，再加请求框架余量。系数和余量依据现有真实账本与官方 tokenizer，写明来源及版本；估算值须不低于这些真实调用的实际 prompt_tokens，也须覆盖 Unicode 转义、base64、短 ASCII 串、生僻字与混合输入的官方离线计数。不加运行时 tokenizer 依赖。
2. 仍然拦住超支：累计已用 + 本次输入估算 + 本次输出上限不超过 SITECRAFT_TOKEN_LIMIT；实际用量超出估算时记入账本并停下（沿用现有 stopped 语义）。不加重试、不加宽松回退。
3. 不改网关的其他合同（显式上限、账本、resume、目录白名单、本地 origin 校验）。同步 AGENTS.md 中相关一句与本票。

## Acceptance

- [x] 红绿：用 T-160 被拦的修正请求和 T-162 青禾纸品两次调用的真实请求体做测试，旧规则下判为放不进、新规则下放得进；测试先在父版本上失败
- [x] 不放松安全：用真实账本里每次调用的请求体，断言新估算 ≥ 实际 prompt_tokens；官方 tokenizer 对抗样本先在 c243f10 失败，再被新估算覆盖；构造超支场景（剩余额度不足）仍被拦
- [x] 不调用 DeepSeek；typecheck、test、build 通过；独立 sol 实例代码审查通过

## Resolution

当前 **INCOMPLETE**：主控的新 sol 审查将 `c243f10` 判为 NO_GO（P2，ASCII 0.5 与统一 Han 1.5 低估），该判断已用官方 tokenizer 红测复现；修复后的非浏览器聚焦检查通过，等待主控浏览器独占结束后的全量验证通知与重新审查。依负责人要求，票保持 open，执行实例不自审、不推送。本次父版本 `c243f10`，原始证据完整保留；本次提交 SHA 单独保存在 gitignore 的 `artifacts/t165/adversarial-commit.json` 并随交付回报，不把前一提交的全量绿测写成本次通过。

### 改动与系数

`reserveRequest` 遍历完整 JSON 请求的 Unicode 码点（含工具 schema、转义与请求参数）：ASCII ×1；官方 V4.1 tokenizer 离线验证为单 token 的 5246 个基本汉字 ×1.5；其余汉字、其他文字、标点和 emoji ×4，向上取整后加 128 token 框架余量。`scripts/t165-single-token-han.ts` 仅保存离线生成的静态字符表，运行时不装、不加载 tokenizer，不按宽泛 Han 范围把生僻字当常用字。框架余量从 256 减至 128：官方完整两条消息的测试提示包含 31 token 框架，JSON 请求结构也参与估算；未通过增加余量掩盖低估。去掉 128 后，34 条真实 usage 的复原请求至少仍高于实际输入 820，15 组对抗提示至少仍高于官方完整提示 90。实际超估继续记账后 stopped；不宣称有限样本是所有未来模型输入的数学证明。

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

### 原误拦的红绿证据

2026-10-14 UTC，父版本 `351f278` 的网关源码未改时运行：

`SITECRAFT_BASE=<本次随机本地 origin> node --test --experimental-strip-types tests/t165-token-reserve.test.ts`

红测 **4/7 通过、3/7 失败，退出 1**：T-160 修正与 T-162 预留均被原规则以 `Remaining authorization` 拒绝；原网关 HTTP 入口首个青禾纸品请求返回 502 而非 200。34 条实际输入覆盖与已付超估终止的安全检查在旧版仍通过。证据 `artifacts/t165/red-351f278.{log,json}`，没有用导入错误或环境错误充当红测。

修改后同一信号加既有预算检查：

`SITECRAFT_BASE=<本次随机本地 origin> node --test --experimental-strip-types tests/t165-token-reserve.test.ts tests/t153-budget.test.ts`

前一提交曾 **11/11 通过、0 跳过，退出 0**，证据 `artifacts/t165/green-focused.{log,json}`，但该覆盖不足以拦截 P2。当前同一误拦信号仍通过：T-160 输入 40,157，剩余 51,510 可留输出 11,353；T-162 分别预留 9397/5394，总计 14,791，即使第一次花满预留也保留完整 6144/4096 输出。HTTP 替身重放真实 usage 后账本实用 3253；大输入在出网前被拦，上游请求数仍为 2；超估/超授权样本把已付 usage 记入账本并停止后续请求。替身只在测试子进程拦截官方 transport，生产 origin 检查没有修改。本次明细 `artifacts/t165/adversarial-estimates.json`，旧明细保留。

### 官方 tokenizer 的独立对抗证据

来源：[deepseek-ai/deepseek-recipe docs/tokenizer.md](https://github.com/deepseek-ai/deepseek-recipe/blob/8cadfede7063c896b944e7bae05daa3549ae97ea/docs/tokenizer.md)，仓库版本 `8cadfede7063c896b944e7bae05daa3549ae97ea` 的 `static/tokenizers/v41/tokenizer.json`；离线环境 Python 3.11，`tokenizers==0.23.3`、`deepseek-recipe==0.1.1`，完整提示用 `DeepseekV41Encoding`。工具只装在 gitignore 的 `artifacts/t165/tokenizer-py311`，package.json/lockfile 无改动。原系统 Python 3.9 不满足这两包的 >=3.10 要求，未修改系统环境。

`scripts/t165-tokenizer-oracle.py` 不读取网关实现或其估算结果，按官方编码生成 `tests/fixtures/t165/tokenizer-adversarial.json` 的期望值；随机输入种子 165，实际输入原文与完整提示计数一同保存，base64 是独立可复现的 16,000 字符样本，并非声称获得了审查者未提供的原始串。覆盖文字转义、base64、连续 ASCII、短词、控制转义、基本区及扩展区生僻字、工具 schema、常用/生僻混合和组合字符，并有 128 个独立混合样本。静态汉字表由逐字官方计数生成，U+4E00..U+9FA5 中不是单 token 的字与扩展区均按 4 预留。

原始文件 URL、离线生成命令、版本与运行结果保留于 `artifacts/t165/tokenizer-source/source.json`、`oracle-generation.{log,json}`、`oracle-reproduction.{log,json}`；重现命令：

`SITECRAFT_BASE=<显式随机本地 origin> artifacts/t165/tokenizer-py311/bin/python scripts/t165-tokenizer-oracle.py --tokenizer artifacts/t165/tokenizer-source/tokenizer.json --output artifacts/t165/oracle-regenerated.json --han-output artifacts/t165/han-regenerated.json --runtime-table scripts/t165-single-token-han.ts`

2026-10-14 03:34:20 UTC，`c243f10` 未修改网关时运行 `node --test --experimental-strip-types tests/t165-tokenizer-adversarial.test.ts`，**4/16 通过、12/16 因低估失败，退出 1**（`artifacts/t165/red-c243f10-adversarial.{log,json}`）。Unicode 转义旧预留 14,317 < 官方完整提示 16,031；base64 8317 < 11,192；扩展区生僻字 7517 < 19,231。不是导入/工具错误充当红测。

03:35:30 UTC 修改后运行 `node --test --experimental-strip-types tests/t165-tokenizer-adversarial.test.ts tests/t165-token-reserve.test.ts tests/t153-budget.test.ts`，显式 SITECRAFT_BASE、CHROME_PATH 为空、无浏览器，**27/27 通过、0 跳过，退出 0**（`artifacts/t165/green-adversarial-focused.{log,json}`）。对应新预留分别为 28,249、16,249、19,449，完整提示均覆盖；所有真实 usage、原预算放行及终止合同也同次验证。当前聚焦结果不替代全量验收。

静态表用相同离线命令重现、新测试显式验证 SITECRAFT_BASE 后，03:42:00 UTC 同一聚焦命令再次 **27/27 通过、0 跳过、退出 0**（`artifacts/t165/green-adversarial-final.{log,json}`），这是本次本地提交的聚焦证据；运行时文件、测试与版本来源说明在同一提交中。

前一提交的 `npm run typecheck`、`npm run build` 与全量日志均保留为历史证据，不用于本次修复验收。其中首轮 **426/440 通过、14 失败**（`test.{log,json}`），由执行者额外 data-root 与测试路径冲突及浏览器等待超时组成；纠正启动配置后 **440/440 通过**（`test-standard.{log,json}`），没有放大超时或改断言。原文件不删不覆盖。本次 typecheck/build/npm test 仍待主控浏览器独占结束后的通知，未运行、不写成已完成。

未载入 .env.local、未调用 DeepSeek；无本票 UI 改动或浏览器验收要求。为复原已有修正片段/事实上下文，沿用现存 DOM 确定性 helper；全量既有测试也会使用指定 CHROME_PATH，未把这些运行当成本票页面质量或审美验收。

### 关票（主控）

独立 sol 实例 t165-review：c243f10 NO_GO（ASCII/生僻字低估），a06e8e1 复审 PASS（固定版本官方 tokenizer 独立重生成样本一致）。2026-10-14 00:35 前后（纽约时间）主控在主线 `58f2827`（含 T-162/T-165/T-166 合并）无其他 Chrome 测试时运行 `SITECRAFT_BASE=http://127.0.0.1:3034 CHROME_PATH=… npm test` **465/465**（119 s），`npm run typecheck`、`SITE_STORE=fs npm run build` 通过；日志 `artifacts/merge-58f2827/`。

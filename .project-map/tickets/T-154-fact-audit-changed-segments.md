---
id: T-154
title: 事实核对只核改动过的段落，修正轮与整页对话修改不再重核整站
type: build
status: open
blocked_by: []
claimed_by: Codex (t154-fact-segments)
supersedes:
---

## Why

负责人 2026-10-11 排定。T-153 首站 144,698 token 中，两次修正后的整站事实复核占 42,034；两次修正本身输出只有 106 token。现在 `checkSiteCode`（`lib/code-site-check.ts`）每次都把整站可读文字交给 `auditCodeFacts`，修正轮只改了几句，也要整站重核；没有选区的对话修改同样整站重核。DeepSeek 钱包紧，这是当前最大的可省开销。

## What to build

1. **按段核对**：把站点可读文字（HTML 文字、可见属性、CSS 生成文字）切成稳定的「核对段」，段的边界要让一个事实和它的限定条件落在同一段里（例如表格按行并带表头、列表项带所属标题、定义列表的项与值、图片 alt 与说明）。核对请求给每段编号，模型按段返回问题；没有问题的段视为通过。
2. **复用已核过的段**：资料文本、段文字及其所在容器的完整有序内容都和某次整组通过的核对完全相同（直接比较文字，不用哈希），才沿用结论。表格、列表、dl 或带标题小节内任何段新增、删除、改动、重排或仍有拒因，都整组重核；不得拼接多轮部分通过。复用来源：本次任务里前一个候选的核对结果，以及当前站点已存版本的核对记录。资料改过、段文字有任何变化、或无法确定时都重新核对（保守）。版本检查记录里写明本次新核了几段、沿用了几段。
3. 只核新段时，提示里附上这些段所在页面的大纲和相邻标题作为上下文，但上下文不算待核内容。
4. 整站生成第一次核对、恢复（T-152 的沿用规则）、局部修改的现有行为保持；本票只减少重复核对。
5. 同步 `spec.md`、`mainline.md`、`CONTEXT.md`（「核对段」只用一个名字）。

## Failure modes

删除同组条件、增加内容或重排后仍沿用旧数值；多轮部分通过拼成虚假的整组通过；片段前导/尾随空白和交界文本导致 DOM 定位错位；改了表头或限定词、数值段没变，结果数值段沿用旧结论而错过新错误；段切分在两次渲染间不稳定导致全部重核（省不下钱）或错位沿用；资料更新后仍沿用旧结论；模型按段返回的编号错乱或漏段；CSS 生成文字、alt 被漏切；英文版或旧站转换误走新逻辑；沿用记录让恢复版本绕过检查。

## Acceptance

- [x] 先列失效方式再写红绿测试，在已知坏实现上失败（至少：表头改了值没改要重核、资料改了要全核、段文字一字之差要重核、编号错乱拒收）
- [x] 用 T-153 保存的真实候选与核对记录（`artifacts/t153/approved/real-2026-10-11T03-58/private/`）离线重放：在不调用模型的前提下算出新方案在同样两轮修正下要发多少段、估算 token，对比当时的 42,034
- [x] 真实验证与 T-155 合跑一次品牌画册生成（主控按负责人批准的预算），Resolution 写各次核对的段数与 token
- [ ] Astra 审查通过；typecheck、test、build 通过

## Resolution

本次真实合跑与盲评制包 PASS；票保持 open，不推送、不宣称全票或审美验收通过。模型写站、提交入口和 T-155 画册规范来自 `af94ce3`；本次只把 T-153 预算脚本改为显式读取已批准上限，并记录核对请求段数。脚本、测试与本文同一本地提交，最终 SHA 见交付报告和 `artifacts/t154/joint-real/report.json`。

实现仍为：资料与完整有序组都不变，且同一次核对整组通过才可沿用；同组增删改、重排或部分被拒均整组重核，旧格式记录不作为复用依据。前导/尾随空白与交界文本按 body 上下文、元素顺序定位。前次红绿、独立审查反例与修复证据保留在 `artifacts/t154/review-followup-*.log`、`review-followup-independent-evidence.json`；不以本次没有修正轮替代那些复用回归。

2026-10-11 09:00:13.997–09:03:12.262 UTC，只生成一次，默认滑杆 5/6、品牌画册；没有追加生成或对话修改。资料和八张授权图只读自 `/Users/luckye/Documents/Code/sitecraft-ai/artifacts/t130/round-2026-10-09T10-14-09-315Z/private/case-2`，生成数据写本 worktree 的文件存储。没有读取主工作区 `.sitecraft-data`。

预算硬上限为负责人批准的 120,000 total token。`scripts/t153-real-budget.ts` 与 `scripts/t153-real-generation.ts` 必须显式设置 `SITECRAFT_TOKEN_LIMIT`；每次上游调用前用完整输入的保守上界预留额度，再收紧输出上限，剩余额度不足即停；账本保留累计用量、402/网络错误不重试。测试 `tests/t153-budget.test.ts` 在旧实现上先红（120,000 被错误按 300,000 预留），修后 2/2 通过，日志位于 `artifacts/t154/joint-real/private/budget-red.log`、`budget-green.log`。真实网关状态确认 `limit=120000`，只有三次上游调用，均 HTTP 200、无截断。流程结束后网关已停，未用额度不再调用。

| 阶段 | 调用次数 | Prompt token | Completion token | Total token |
| --- | ---: | ---: | ---: | ---: |
| 规划 | 1 | 9,149 | 3,296 | 12,445 |
| 写页 | 1 | 10,839 | 41,433 | 52,272 |
| 事实核对 | 1 | 9,624 | 3,370 | 12,994 |
| 修正 | 0 | 0 | 0 | 0 |
| 合计 | 3 | 29,612 | 48,099 | **77,711** |

唯一一次事实核对：**新核 32 段、沿用 0 段、12,994 token**，其中 reasoning 3,076 token；首次候选通过并保存 v1。两页 × 375/768/1440 的确定性检查溢出、重叠、对比度、正文长行均为 0。机械质量反馈仍保留在报告及版本检查中，不按这些非拒收项重跑。没有真实修正轮，因此本次没有观察到段沿用，不能把总 token 变化归因为复用省量。

入口事实检查：Chrome 视口高 1000；1440 宽时两类接头入口 y=382.875–445.797，「查看产品与规格」按钮底边 y=525.641；375 宽时两个入口分别 y=361.422–448.625、468.625–531.547，按钮底边 y=611.391，均在首屏。首屏文字同时说明接单前核对管径/螺纹/密封材料、样品确认后再定批量版本。首页、产品页的 1440/375 全页图和首屏图均打开看过，无载入态、空白或错误截图；只确认内容与位置，不自评审美。测量与首屏图在 `artifacts/t154/joint-real/private/entry-measurements.json`、`home-fold-1440.png`、`home-fold-375.png`。

成对盲评包：`artifacts/t154/joint-real/review/`，仅八张首页/产品页截图和中性 `questions.md`；A/B 分配与查看顺序分别随机。旧版明确使用 `fecaa36c-2aaf-44ee-bdc0-8e38102f84b0`，只读复用 `/Users/luckye/Documents/Code/sitecraft-ai/artifacts/t153/approved/real-2026-10-11T03-58/private/default/` 的真实截图，未重生成。映射、版本 ID、原始用量与完整站点记录保存在 `artifacts/t154/joint-real/private/`；未执行成对审美评判，后续评审实例只可读取 review 包。

可复核命令（在本 worktree 执行，均显式配置本地端点）：

- 网关先按授权方式 `set -a; source /Users/luckye/Documents/Code/sitecraft-ai/.env.local; set +a` 只把密钥载入进程，再设置 `SITECRAFT_BASE=http://127.0.0.1:3176 SITECRAFT_BUDGET_BASE=http://127.0.0.1:3177 SITECRAFT_TOKEN_LIMIT=120000 T153_BUDGET_DIR=artifacts/t153/joint-t154-t155-20261011/private/budget DEEPSEEK_BASE_URL=https://api.deepseek.com DEEPSEEK_MODEL=deepseek-flash`，运行 `node --experimental-strip-types scripts/t153-real-budget.ts`。应用用 `SITE_STORE=fs`、3176 端口、DeepSeek 地址指向本网关，应用只持本地占位 key；真实 key 未打印、复制或软链。
- 相同 BASE/BUDGET_BASE/TOKEN_LIMIT 及 CHROME_PATH 环境下：`node --experimental-strip-types scripts/t153-real-generation.ts prepare artifacts/t153/joint-t154-t155-20261011 /Users/luckye/Documents/Code/sitecraft-ai/artifacts/t130/round-2026-10-09T10-14-09-315Z/private/case-2`，随后只运行一次 `node --experimental-strip-types scripts/t153-real-generation.ts default artifacts/t153/joint-t154-t155-20261011`。已有账本与阶段记录不可重置；这些命令记录本次过程，不授权重跑。
- 不调用模型的报告/制包过程：`SITECRAFT_BASE=http://127.0.0.1:3176 CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node --experimental-strip-types artifacts/t154/joint-real/private/finalize.mjs`。总报告 `artifacts/t154/joint-real/report.json`；原始生成记录 `artifacts/t153/joint-t154-t155-20261011/private/`。
- 本次 09:03–09:08 UTC 的 `npm run typecheck`、`npm test`（400/400，0 skipped）、`npm run build` 均 PASS；全部设置 `SITE_STORE=fs SITECRAFT_BASE=http://127.0.0.1:3176`，浏览器测试使用上述 CHROME_PATH，未设置全局 SITECRAFT_DATA_ROOT。日志在 `artifacts/t154/joint-real/private/{typecheck,test,build}.log`。运行全量测试前已停止真实网关。

独立 Astra 对本次冻结的预算脚本与联合运行证据给出技术 PASS：核验三次调用、77,711 token、32/0 段数、入口截图和包内信息隔离；独立预算测试 2/2 通过。该核验不代替审美盲评，也不把未触发的真实复用或 402/网络停止场景写成实测。

主控后续：把 review 包交新实例做两题成对盲评，再结合最终代码审查决定 T-154/T-155 的全票验收。现有 T-156 `type: decision` 校验问题未改；本次不关票、不推送。

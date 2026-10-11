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
2. **复用已核过的段**：段文字与资料文本都和某次已通过的核对完全相同（直接比较文字，不用哈希），就沿用结论，不再发给模型。复用来源：本次任务里前一个候选的核对结果，以及当前站点已存版本的核对记录。资料改过、段文字有任何变化、或无法确定时都重新核对（保守）。版本检查记录里写明本次新核了几段、沿用了几段。
3. 只核新段时，提示里附上这些段所在页面的大纲和相邻标题作为上下文，但上下文不算待核内容。
4. 整站生成第一次核对、恢复（T-152 的沿用规则）、局部修改的现有行为保持；本票只减少重复核对。
5. 同步 `spec.md`、`mainline.md`、`CONTEXT.md`（「核对段」只用一个名字）。

## Failure modes

改了表头或限定词、数值段没变，结果数值段沿用旧结论而错过新错误；段切分在两次渲染间不稳定导致全部重核（省不下钱）或错位沿用；资料更新后仍沿用旧结论；模型按段返回的编号错乱或漏段；CSS 生成文字、alt 被漏切；英文版或旧站转换误走新逻辑；沿用记录让恢复版本绕过检查。

## Acceptance

- [x] 先列失效方式再写红绿测试，在已知坏实现上失败（至少：表头改了值没改要重核、资料改了要全核、段文字一字之差要重核、编号错乱拒收）
- [x] 用 T-153 保存的真实候选与核对记录（`artifacts/t153/approved/real-2026-10-11T03-58/private/`）离线重放：在不调用模型的前提下算出新方案在同样两轮修正下要发多少段、估算 token，对比当时的 42,034
- [ ] 真实验证与 T-155 合跑一次品牌画册生成（主控按负责人批准的预算），Resolution 写各次核对的段数与 token
- [ ] Astra 审查通过；typecheck、test、build 通过

## Resolution

状态：INCOMPLETE（本阶段实现、红绿证据和离线重放已交付；真实验证与修后 Astra 复审留给主控）。遵照本次派工不关票、不推送。执行分支 `t154-fact-segments`，父提交 `2bccc24`；代码、测试与本文同一提交，最终 SHA 见交付报告。

实现：唯一提交入口提取带条件的核对段，公共内容及三档重复文字去重；模型必须逐编号显式返回结果，编号错乱整批失败。只复用当前版本或相同任务中通过的段，比较完整有效资料、原始资料和段文字；保存本轮新核/沿用数量及每段结论。空的或重复的请求沿用现有资料原文去重规则，不把新设计请求自行判为“无事实变化”。新版对话带入不同请求时仍保守全核；局部、英文、恢复原合同不变。旧 HTTP 测试夹具只迁移编号协议，原有行为断言保留。

2026-10-11 UTC 本次证据（全部位于本 worktree 的 gitignore `artifacts/t154/`）：

- 首次红灯 `red-parent.log` 中首项是 dev server 未就绪，不能当合同证据；其余失败和该日志保留。使用只在当前测试进程加载父实现的钩子复跑，`red-parent-confirmed.log` 的 7 项全部按新合同失败。命令：设置下述环境后，`T154_MUTANT=parent node --experimental-strip-types --import ./tests/fixtures/t154-counterfactual.ts --test tests/t154-fact-segments.test.ts`。
- 去掉表头、去掉资料比较、放过编号三种坏实现分别被断言拒绝；最终代码上的 `red-delivery-headers.log`、`red-delivery-materials.log`、`red-delivery-ids.log` 保留对应结果。复现命令同上，将 `T154_MUTANT` 改为 `headers`、`materials`、`ids`，并加 `--test-name-pattern='changed table header|source change|new user facts|unknown, missing'`。
- 独立 Astra 审查首次候选为 FAIL：`section > header > h2` 改产品名时，表格数值被错误沿用。审核者的真实提交记录保存于 `astra-counterexample.json`。按该外部反例补测，并扩展侧栏/列表条件及合并单元格：`red-astra.log` 两项失败；修后 `green-astra-fixed.log` 12/12 通过。运行命令：`node --test --experimental-strip-types tests/t154-fact-segments.test.ts`。最终实现把区块内 header、aside、列表、定义列表与图片说明保留在区块条件中；表头作用域、合并关系和引用说明也参与比较。修后没有再宣布独立审查通过，待主控复审。
- 最终检查（2026-10-11 05:21–05:23 UTC，修后当前代码）：`npm run typecheck` PASS、`npm test` 388/388 PASS、`npm run build` PASS，输出分别在 `typecheck-delivery.log`、`full-tests-delivery.log`、`build-delivery.log`。运行环境：`SITE_STORE=fs`，`SITECRAFT_BASE=http://127.0.0.1:3176`；浏览器检查使用 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell`。测试模型全部为本地替身，不读取主工作区数据或密钥。
- 离线重放命令：同上环境下运行 `node --experimental-strip-types scripts/t154-replay-fact-segments.ts /Users/luckye/Documents/Code/sitecraft-ai/artifacts/t153/approved/real-2026-10-11T03-58/private/default/code-site.json`。最终输出在 `replay-astra-fixed.log` 及 `replay-2026-10-11T05-21-17-657Z/replay.json`；三个真实候选均重新按三档渲染提取，无模型调用。为防止靠沿用后来发现的错误制造省量，将历史各轮拒因引号内原句对应的段都保守排除复用，映射随报告保存。

| 核对轮次 | 全部核对段 | 新核 | 沿用 | 输入 token 估算 | 输出按文字量缩减的总 token 情景 | 输出保持历史用量的总 token 情景 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 首轮 | 28 | 28 | 0 | 11,760 | 31,233 | 31,233 |
| 修正一 | 28 | 2 | 26 | 5,704 | 7,780 | 25,946 |
| 修正二 | 28 | 1 | 27 | 5,304 | 5,732 | 16,201 |

两次修正合计情景为 13,512 / 42,147 token，对照历史实测 42,034。输入使用“汉字×1.5 + 其他字符÷3 + 固定提示预算 1,800”的保守估算，不是 tokenizer 或账单；模型思考输出未知，首轮带条件和编号的输入也可能变长，不能据此承诺真实省量。主控与 T-155 合跑时须记录各轮 `checks.factSegments` 段数、模型 token 与是否漏核。

本票无 UI/预览渲染改动，不声明审美通过。`project_map.py status` 无 stale living doc；既存 T-156 的 `type: decision` 校验问题未改。主控待办：修后 Astra 复审、按已批准预算与 T-155 做一次真实验证，再决定验收与合并。

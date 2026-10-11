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
- [ ] 真实验证与 T-155 合跑一次品牌画册生成（主控按负责人批准的预算），Resolution 写各次核对的段数与 token
- [ ] Astra 审查通过；typecheck、test、build 通过

## Resolution

状态：INCOMPLETE（本轮复审修复、红绿测试和离线重放已完成，修后独立复审与真实验证待主控）。按派工新增本地提交，不关闭票、不推送。父提交 `81c976b`；本轮代码、测试与文档同提交，最终 SHA 见交付报告。

当前实现：段必须归属于完整有序内容一致、且在同一次核对中全部通过的组才能沿用；任何成员增删改、重排或被拒都会让整组进入请求。嵌套 section 仍绑定外层列表/dl/带标题小节；模型用短 groupId 识别共同条件，组快照只保存在代码核对记录中。`factSegments.format=2` 不采用缺少组依据的旧格式记录。片段按 body 上下文解析，按元素顺序映射真实 DOM，文本读取清理后的源片段，避免前导空白被丢弃和交界文本合并造成计数错位。未调用真实模型；局部、英文、恢复规则保持。

2026-10-11 UTC 本次证据（本 worktree 的 `artifacts/t154/`；旧失败和旧估算文件均保留）：

- `review-followup-red.log`：在 `81c976b` 上，10 项新回归中 8 项按预期失败，2 项尾随空白原本通过。覆盖删条件行、删列表项、新增行、重排行，以及前导/尾随/全部交界空白、相邻原始文案。命令：`node --test --experimental-strip-types --test-name-pattern='whole group|fragment boundaries' tests/t154-fact-segments.test.ts`。可用 `T154_MUTANT=review-base node --experimental-strip-types --import ./tests/fixtures/t154-counterfactual.ts --test --test-name-pattern='whole group|fragment boundaries' tests/t154-fact-segments.test.ts` 在测试进程内加载旧实现重现，不改工作树。
- 独立 Astra 确认删除条件、嵌套 dl/ol 及空白边界通过，但发现同组部分通过时仍会省略已通过条件，结论 FAIL；原始请求与结果保留为 `review-followup-independent-evidence.json`。按独立反例加入“同组拒一行、再次检查仍带条件、不能拼接多轮部分通过”的回归，`review-followup-partial-red.log` 先红；随后改为整组在同一次核对中全部通过才可沿用。该追加修复未再自称独立审查通过。
- 最终定向结果、全量 test/typecheck/build 见本节交付检查结果。所有检查显式设置 `SITE_STORE=fs`、`SITECRAFT_BASE=http://127.0.0.1:3176`；Chrome 为 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell`。模型回复来自隔离本地 HTTP 替身。
- 最新离线重放命令：上述环境下运行 `node --experimental-strip-types scripts/t154-replay-fact-segments.ts /Users/luckye/Documents/Code/sitecraft-ai/artifacts/t153/approved/real-2026-10-11T03-58/private/default/code-site.json`。输出 `review-followup-complete-group-replay.log` 及其指向的 `replay.json`，三候选均重新按三档渲染提取，无模型调用。历史各轮拒因对应的组未被当作通过，避免通过漏核制造省量。

| 核对轮次 | 全部核对段 | 新核 | 沿用 | 输入 token 估算 | 输出按文字量缩减的总 token 情景 | 输出保持历史用量的总 token 情景 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 首轮 | 28 | 28 | 0 | 11,906 | 31,379 | 31,379 |
| 修正一 | 28 | 2 | 26 | 5,714 | 7,790 | 25,956 |
| 修正二 | 28 | 1 | 27 | 5,309 | 5,737 | 16,206 |

两次修正估算情景合计 13,527 / 42,162 token，对照历史实测 42,034；这份样本的改动没有扩及其他组，因此本次段数不变。输入使用“汉字×1.5 + 其他字符÷3 + 固定提示预算 1,800”，不是 tokenizer 或账单；思考输出未知，不承诺真实省量。主控与 T-155 合跑时仍须记录各轮段数、模型 token 和是否漏核。

交付检查结果（2026-10-11 05:36–05:39 UTC，最终代码）：定向 `node --test --experimental-strip-types tests/t154-fact-segments.test.ts` 23/23 PASS，`npm test` 399/399 PASS，`npm run typecheck` PASS，`npm run build` PASS。输出分别为 `review-followup-complete-group-green.log`、`review-followup-complete-group-test.log`、`review-followup-complete-group-typecheck.log`、`review-followup-complete-group-build.log`。旧版本进程内回放 `review-followup-base-replay-red.log` 再次得到同样 8 红、2 绿，证实反事实可重复。主控待办：最终候选的独立复审、与 T-155 的真实联跑，再决定全票验收与合并。本票无 UI/预览渲染改动，不声明审美通过；project-map 的 T-156 `type: decision` 既存校验问题不在本次修复范围。

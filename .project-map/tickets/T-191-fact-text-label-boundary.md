---
id: T-191
title: 事实核对段把标签和值连成一串，模型看不出边界
type: build
status: open
blocked_by: []
claimed_by: codex-t191
supersedes:
---

## Why

T-188 的 restaurant/precision 站，页面「位置与通行」写着「地址 | 杭州市拱墅区；门牌地址待补充」，把服务区域写成了门店地址，事实核对没有拦住，存进了版本（见 T-188 Resolution 的残留 1）。

执行主控对照原文看到：这一段送给模型的核对文本是「地址杭州市拱墅区；门牌地址待补充」，标签和值之间没有任何分隔。T-180、T-183 里同类错误是完整陈述句（「门店在…」），都被拦下了。

如果核对文本在 dt/dd、th/td、标签 span 与值之间不加分隔，模型就看不出「地址」是标签，事实核对等于在读一串粘连的文字。这可能是代码层的根因，资料措辞只是诱因。

## What to build

1. **先确认**：查看 `lib/code-site-fact-segments.ts` 的核对文本和 claimTexts 是怎么构造的，以及 T-188 这一段保存的 factInput，确认标签与值、相邻单元格、相邻块级元素之间是否缺分隔。T-181 和 T-185 已经处理过表格行边界，要说明本问题与它们的关系。
2. **如果确认缺分隔**：按渲染语义加分隔，例如块级与单元格边界加换行或制表，dt/dd 用「标签：值」的形式。要做到：
   - 不改 claim 逐字复制和归属校验的规则；
   - claimTexts 与页面文字的定位保持一致；
   - 核对段复用（T-154）在分隔规则变化后整组重核，不沿用旧结果。
3. **如果分隔本来就有**：如实写明，并在 Resolution 里说明 T-188 那条漏拦更可能的原因，例如 noFacts=true 判断或模型本身漏看。不改代码。
4. **成对测试**：用 T-188 这一段的真实结构做夹具。旧实现产生粘连文本，新实现能分清标签与值。另加一个 dl 用例和一个标签 span 用例。
5. **真实探针**：在 restaurant/precision 上跑一次，预算网关显式 `SITECRAFT_TOKEN_LIMIT=300000`，用新账本，资料用 T-190 改后的版本。

## Acceptance

- [x] 是否缺分隔的结论写进 Resolution，附原文定位
- [x] 若改代码：成对测试先红后绿，真实探针结果如实记录
- [ ] 合并后主线验证通过；独立 fast 审查通过

## Resolution

INCOMPLETE（2026-10-19 最新）：T-190 合并后门控通过，唯一一次真实探针已执行，3 页首次存版通过，实际用量 106010/300000 token；评估命令因第二个外部对照页转场检查失败而 exit 1，不重跑。主线验证与独立 fast 审查仍待执行，票保持 open；详细结果见末节。以下保留各阶段原始证据。

### 只读确认

原始记录只读自 `/Users/luckye/Documents/Code/sitecraft-ai-t188/artifacts/t188/eval-data/code-sites/2fb7236c-f317-435a-b7af-9b888881d1d1.json`：

- 第 9093 行的 `runs[1].modelCalls[1].factInput.segments[23]` 为 s24，groupId=g20，pageId=visit，heading 为「位置与通行」。原 text 中逐字出现 `地址杭州市拱墅区；门牌地址待补充。`、`入口与无障碍门店入口台阶和无障碍通行条件待补充。`；claimTexts[0] 同样粘连，NFKC 后分号为半角。
- 第 181 行的 `versions[0].code.pages[2].html`，版本 `b37d5b6e-bf2f-41bb-bcc5-0516af321e9b`，对应原 DOM 为 `<ul class="notice-list"><li><strong>地址</strong><span>杭州市拱墅区；门牌地址待补充。</span></li>…</ul>`；`.notice-list li` 实际使用两列 grid、gap:20px，手机改为一列、gap:4px。视觉上独立的标签和值被当作连续行内文字读取。
- 同一次 facts 回复解析 `response.rawBody.body → choices[0].message.content → results[id=s24]`，原值为 `{"id":"s24","issues":[],"noFacts":true,"factCategories":[],"citations":[]}`。普通地址按合同可以填 noFacts=true，但仍应核对事实；此字段本身不是违规。代码层缺分隔已复现，是否因此让模型漏看尚待真实探针，不能把文本修复等同于已证明不再漏拦。摘录保存在本工作树 `artifacts/t191/t188-original-excerpt.json`。

调用链和边界：

- `lib/code-site-check.ts:609` 在三档候选文档内调用 `readCodeFactSegments`；读取器在 `lib/code-site-fact-segments.ts:192` 递归拼接子节点。父版本只按第 159 行的固定标签集换行，故 div/p 等普通块、dt/dd 已有换行，th/td 有结构标记及换行，并非所有结构都缺分隔；CSS 变成块、flex/grid 子项或独立行内盒的 span/strong，以及未列入集合的 address 等块会漏掉。
- `lib/code-site-model.ts:306` 的 `codeFactAuditInput` 直接保留 text，经 `normalizeFactClaimText`（`lib/code-site-fact-segments.ts:29`）生成 claimTexts：NFKC、空白折叠、去单元格标记、按 TR 边界分条。因此前一步没有的标签边界不会在这里补出。
- T-181 增加可逐字复制的 claimTexts，防止模型抹掉已有空白、补标点或跨 TR 拼接；T-185 确认跨条 claim 应拒收，仅修正「把上下文补进 claim」及 issues 格式的提示歧义。两票保留的单元格和表格行边界有效，本票补的是渲染产生而固定标签集合未识别的边界，不改变跨行或跨编号的归属规则。

### 第一轮最小修复与本地证据（1cb2192）

`lib/code-site-fact-segments.ts:203` 在既有标签和表格边界之外读取实际 display，为独立排版盒补换行；普通 inline/contents 不额外插入空白，不添加冒号或其他原文没有的标点。整站、局部及 target.readable 共用 read；原始 DOM 快照、成员文本、offset 和 path 不改。claim 的逐字复制、NFKC/空白匹配、TR 边界及来源验真均未修改。

T-154 直接比较 text 和完整 group（`lib/code-site-fact-segments.ts:386`），分隔变化使受影响组自然失效，无需新增格式或兼容路径。新测试用父版本旧回执证明同 DOM/CSS 也重核整组，包含未改字的表格行；另用 inline→grid 成对验证只改变边界时，无关组仍可沿用。旧回执仅作历史输入，重核期望来自整组合同。T-173 成员仍来自原文本节点（第 95–104 行）；T-175 从实际资料原句及 DOM 节点逐字匹配（`lib/code-site-placeholders.ts:8`、`:73`），没有改用新增的显示分隔。

Tracer bullet：真实 Chrome 渲染 → 原核对段读取 → 生产 claimTexts 构造 → 出处回绑／组复用，既有生产提交入口测试覆盖后续调用链。Deep modules：只改原读取器，不增 API 或平行解析。Ubiquitous language：text 为带结构核对文本，claimTexts 为可复制网页文字，quote 为资料原句。

新测试先列出失败方式，再在父版本 `38969d9b69cd3f0cd65ad78f4847433b4a8c6102` 的生产读取器上运行：T-188 原 DOM 在 375/768/1440 的整站和局部读取、标签 span、dl/块/单元格、整组复用，6/6 按缺分隔或错误沿用失败。最终测试在实现回退至该父版本后再跑一遍仍为 6/6 预期失败，见 `artifacts/t191/parent-red-final.log`；断言来自排版语义，不使用哈希、字节或像素比对。最初改后复跑发现测试路径期望少算 main 一层，已按原 DOM 层级修正，原失败保留在 `artifacts/t191/focused-green.log`，未覆盖。

代码和最终测试已本地提交为 **`1cb2192a2de1bb41eb410553028cbc1b6238be7f`**（2026-10-19 04:03 EDT），未推送。以下改后证据对应此提交的代码与测试；后续记录提交仅更新本票和 MAP。

| 检查 | 时间（2026-10-19 EDT）与结果 | 本工作树证据 |
| --- | --- | --- |
| 最终父版本反例 | 03:57，6 项预期失败，exit 1；生产实现与 38969d9 一致 | `artifacts/t191/parent-red-final.log` |
| 本票及相关定向测试 | 03:58–04:03，14 文件 **173/173 通过**，含本票 6/6，exit 0 | `artifacts/t191/related-green.log`、`related-report.json`、`related-summaries-browser.ndjson`；本票输入/输出在 `label-boundary-1792396885657-73331/` |
| typecheck | 04:03，exit 0 | `artifacts/t191/typecheck-final.log` |

定向文件用 `rg -l 'code-site-fact-segments|claimTexts|factSegments|factCitations|出处|核对段|stalePlaceholder' tests/t154* tests/t169* tests/t173* tests/t175* tests/t181* tests/t185*` 找全，结果留在 `artifacts/t191/related-selection.txt`。以下命令由标准入口提供独立数据根和随机端口，身份报告确认 cwd 为本工作树；没有写主工作区数据。

```sh
export CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell
# 父版本反例（修复前）；修复后同一测试包含在下一条门控中
npm test -- tests/t191-fact-label-boundary.test.ts
npm test -- tests/t191-fact-label-boundary.test.ts tests/t154-fact-segments.test.ts tests/t173-citation-repair.test.ts tests/t173-fact-boundary.test.ts tests/t173-fact-members.test.ts tests/t173-repair-scope.test.ts tests/t175-stale-placeholder.test.ts tests/t181-claim-copy.test.ts tests/t181-fact-replies.test.ts tests/t185-fact-protocol.test.ts tests/t169-contract-d.test.ts tests/t169-production-contract.test.ts tests/t169-fact-citations.test.ts tests/t169-citations-browser.test.ts
npm run typecheck
```

首次 typecheck 与测试服务启动并行，读到正在生成的 Next routes/validator，exit 2，保留 `artifacts/t191/typecheck.log`。测试自然结束后串行运行相同 typecheck 命令即通过，没有修改配置或跳过类型文件来绕过。`tsconfig.json` 的 Next 自动变化留在工作树，未提交。AGENTS、CONTEXT 与 mainline 对本次边界修复仍准确，规格补充当前行为，MAP Verified 更新为上述代码提交。

**停点与限制**：本轮 1–4 的只读确认、实现、父版本反例及定向门控已完成。未实测真实 DeepSeek 模型；真实探针等负责人通知合入 T-190 补改，再用 restaurant/precision、`SITECRAFT_TOKEN_LIMIT=300000` 和新账本。独立 fast 审查与合并后主线验证尚未执行，两个剩余验收项不勾选，票不关闭。

### 主控补充：三档统一分隔

2026-10-19 负责人指出第一轮按当前视口 computed display 分隔，再按 `[group,text]` 合并，可能将同一 DOM 拆成两个核对段。以下补改取代第一轮的逐档独立分隔判定；第一轮原始证据保留。

**复现。** 新增手机 block／桌面 inline、手机 inline／桌面 block 的正反夹具，另加仅 768 为 block 的夹具，防止只取手机或桌面。生产实现保持 `1cb2192`，新增测试先运行：`artifacts/t191/responsive-parent-red-final.log` 中原有 6 项通过、新增 3 项均在「375 与 768 必须共用段文本和身份」处失败。每个夹具的生产 `checkSiteCode → facts` 输入均实际发送了两个价格段：一段含 `单份价格32 元/份`，另一段含 `单份价格\n32 元/份`；原记录在 `artifacts/t191/label-boundary-1792397416550-22832/*-commit.json`，对照摘录为 `artifacts/t191/responsive-comparison.json`。最初红灯夹具只有 visit 页，未满足生产 schema 的首页要求，失败日志 `responsive-parent-red.log` 保留，但不作为缺陷反例；补齐 home 后才取得上述有效红灯。

**现在由哪一档判定。** 不选定某一档。`lib/code-site-check.ts:504` 的同一 widths 列表用于两阶段：每页先在 375、768、1440 分别渲染完整候选，待字体和图片状态稳定、展开 details 并处理与原核对一致的 aria 状态，再调用 `readCodeFactSeparators`（`lib/code-site-fact-segments.ts:67`）收集该档需要分隔的元素路径及标签；按 body 相对路径取三档并集。任一档有独立排版盒，就在三档读取时一律分隔；inline、contents、none 沿用无新增盒分隔的规则，原固定块级、dt/dd、单元格和 TR 边界仍保留。

**三档不一致怎么处理。** display 不一致按并集处理，不产生三个版本的分隔文本。`readCodeFactSegments` 的第四参数为必填的整页并集；它只按这份判定读文字、group 和 target.readable，不再自行按当前视口 display 改分隔。采集阶段同一路径标签不同、或正式读取时路径不存在／标签不符，明确报「三档事实核对的文字分隔节点不一致」或「三档事实核对的文字分隔位置无法核实」，不调用模型猜测、不用某一档兜底。原有三档事实读取仍保留，以覆盖原先已支持的 CSS 生成文案；本次只统一排版分隔，不改这些文案的事实范围。

**验证边界。** 三个夹具逐档直接核对 text/group、成员和 claimTexts 相同，固定原句 `单份价格 32 元/份` 均准确回绑到同一 p；生产检查入口只发送一个价格段，后续同源同组提交沿用全部核对段且不再调用模型，出处保持一致。改后本票定向 9/9 通过，日志 `artifacts/t191/responsive-focused-green.log`，三个生产输入都由两段收敛为一段。测试期望是三档文本与身份一致及明确的 DOM/资料原句，未以实现输出作答案，未做哈希、字节或像素比较。

Tracer bullet：三档真实 Chrome → 分隔路径并集 → 三档核对段 → 生产 facts 输入 → 出处回绑与核对段复用。Deep modules：采集与读取同归原核对文本模块，三档调度归原提交检查入口；旧的逐档 display 读取删除，不留兼容分支。Ubiquitous language：分隔判定只描述网页文字边界，不替代 claim、quote 或版本锚点。T-159 的 CDP 替身只补新采集函数的空返回以保持原准入场景；响应式语义由上述真实浏览器用例证明。

**当前代码提交：`14638ea3edfb23596d20e668f8296d48c27ac8f6`**（2026-10-19 04:17 EDT），以下证据均在本次补改之后生成；后续记录提交只改本票和 MAP。

| 检查 | 时间（2026-10-19 EDT）与结果 | 本工作树证据 |
| --- | --- | --- |
| 第一轮实现反例 | 04:10，原有 6 项通过，新增 3 项预期失败；生产事实输入为两个价格段，exit 1 | `artifacts/t191/responsive-parent-red-final.log`、`responsive-comparison.json` |
| 本票修复后 | 04:12，9/9，三个夹具各只发送一个价格段，exit 0 | `artifacts/t191/responsive-focused-green.log`、`label-boundary-1792397516118-34688/` |
| 相关定向门控 | 04:12–04:17，15 文件 **189/189 通过**，exit 0 | `artifacts/t191/responsive-related-green.log`、`responsive-related-report.json`、`responsive-related-summaries-browser.ndjson` |
| typecheck | 04:17，测试自然结束后串行运行，exit 0 | `artifacts/t191/responsive-typecheck.log` |

```sh
export CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell
npm test -- tests/t191-fact-label-boundary.test.ts
npm test -- tests/t191-fact-label-boundary.test.ts tests/t154-fact-segments.test.ts tests/t173-citation-repair.test.ts tests/t173-fact-boundary.test.ts tests/t173-fact-members.test.ts tests/t173-repair-scope.test.ts tests/t175-stale-placeholder.test.ts tests/t181-claim-copy.test.ts tests/t181-fact-replies.test.ts tests/t185-fact-protocol.test.ts tests/t169-contract-d.test.ts tests/t169-production-contract.test.ts tests/t169-fact-citations.test.ts tests/t169-citations-browser.test.ts tests/t159-task-admission.test.ts
npm run typecheck
```

相关文件仍按第一轮的 rg 检索规则选取，另加入直接受影响的 T-159 准入测试。入口核对 cwd 为本工作树、数据根为本轮临时目录，未写主工作区 `.sitecraft-data`；`tsconfig.json` 自动变更仍未提交。规格已改为三档并集判定，AGENTS、CONTEXT 和 mainline 的事实、复用与归属合同未变，已复核并更新 MAP Verified。

**当时停点（真实探针前）：INCOMPLETE（本轮补改与本地门控完成，整票仍待真实探针及后续验收）。** 未推送，未合入 T-190，未调用真实模型，未开审查或盲评实例，未跑全量、runner 或 build。继续等待负责人通知，再合入 T-190 补改并用 restaurant/precision、新账本及 `SITECRAFT_TOKEN_LIMIT=300000` 跑真实探针。

### 合入 T-190 后的唯一真实探针（2026-10-19）

**候选与门控。** 本分支尝试 `git merge --no-ff t190-materials-rewrite` 后，在 MAP 和 spec 两份文档冲突处按指令停下。负责人解决冲突并完成合并提交 **`661edbc016c0de1a509f5d84e9e2a69f22ba6ee9`**，第二父提交为已复审的 T-190 **`1002c28fcf1a8f2510f125775d5244d65d4f324e`**。以下门控和真实探针均对应合并后的同一代码，没有再改生成、核对、资料或评估程序。

| 检查 | 2026-10-19 EDT 与结果 | 本工作树证据 |
| --- | --- | --- |
| 合并后定向测试 | 04:21，本票 9/9、T-190 资料合同 23/23，共 **32/32**，exit 0 | `artifacts/t191/post-merge-tests.log`、`post-merge-report.json` |
| typecheck | 04:21，定向测试结束后串行执行，exit 0 | `artifacts/t191/post-merge-typecheck.log` |
| 唯一真实生成 | 04:24–04:29，restaurant/precision，首次整站核对存 v1，修正 0 轮 | `artifacts/t191/probe/private/case-1/code-site.json`、`probe-final-draft.json` |
| 评估命令整体 | exit 1，INCOMPLETE；生成 outcome=generated，外部对照 restaurant/1 转场检查失败 | `artifacts/t191/probe-eval.log`、`probe-eval-exit.json`、`probe/private/round.json` |

```sh
CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- tests/t191-fact-label-boundary.test.ts tests/t190-materials-contract.test.ts
npm run typecheck
SITECRAFT_BASE=http://127.0.0.1:52262 SITECRAFT_BUDGET_BASE=http://127.0.0.1:52263 SITECRAFT_TOKEN_LIMIT=300000 CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm run eval:new-route -- --only restaurant/precision --out artifacts/t191/probe
```

**隔离与一次性约束。** 普通 dev 的 cwd 是本工作树，数据根是本工作树 `artifacts/t191/probe-data`；health 返回 200，核对 cwd、dataRoot、deepseek-flash 及 development-file，通过记录为 `probe-health.json`。应用仅持 `local-budget-gateway` 占位凭据，模型地址指向随机端口 52263 的本地网关。真实凭据只在网关子进程中 source 既有环境文件，source 输出和网关 stdout/stderr 均丢弃，未读回父进程、写入文件、日志、提交或 prompt。网关仍用 `scripts/t153-real-budget.ts`，显式上限 300000，唯一新账本 `artifacts/t174/t191-label-probe/usage.json`，不 resume；初始零用量与单次登记在 `probe-initial-ledger.json`。`run-unique-probe.mjs` 以独占创建的 `probe-authorized-once.json` 防止重复发送；实际 npm 命令仅启动一次。所有启动脚本和身份记录均在本工作树 `artifacts/t191/`，不写主工作区数据或 artifacts。

**实际生成结果。** 站点 `ea4974bd-bef6-424c-8714-382f83329395`，v1 `83bac9de-1809-47b2-a0d1-b59e7afc6cfc`，home/menu/visit 三页。实际 draft 的 generate run `471aec4b-0d7f-41a0-98d4-cbfea224f1d5` 为 complete，step 原文 `版本 1 已保存，底线检查通过。`。首次核对 40 段、沿用 0 段，模型 40 个结果的 issues 全部为 `[]`，无协议或出处拒收、无修正，版本汇总出处 47 条。唯一提交检查的 `passed=true`、`issues=[]`，3 页 × 375/768/1440 共 9 档检查通过；完整质量反馈也保留，没有把反馈改成无问题。

**全部核对输入与拒因。** 实际事实调用是站点记录的 `runs[1].modelCalls[1]`，`factInput.segments` 的 40 段及每段 claimTexts 均原样保留，完整 HTTP 回复原文、finish_reason=stop、用量、解析后的 40 个 results 在 `probe-facts-all.json`。所有运行的 step/issues、所有提交 attempts 的完整 checks 在 `probe-checks-all.json`；原站点完整快照在 `probe-final-draft.json`。本次模型拒因和提交拒因均为空数组，不补造拒因，不把外部截图失败归成模型或底线失败。

按实际 span/标题价格、dt/dd、表格列及原文冒号结构核对，共 26 个带标签/值的段。它们完整的 text 与 claimTexts 另列于 `probe-label-value-excerpts.json` 的 `labelValueSegments`，同文件的 `allFactInputSegments` 保留其余 14 段，避免筛选遗漏。下表的 `\n` 是实际 text 中的换行；仅节录对应片段，完整前后文见上述 JSON。claimTexts 中半角逗号、分号、冒号来自既有 NFKC，不是模型新补标点。

| 段编号 | factInput.text 原片段 | claimTexts 对应连续片段 |
| --- | --- | --- |
| s1 | `禾巷小馆\n\n社区家常菜` | `禾巷小馆 社区家常菜` |
| s2 | `香菇鸡腿饭\n\n32 元/份` | `香菇鸡腿饭 32 元/份` |
| s4、s15 | `香菇鸡腿饭\n\n32 元/份，含米饭` | `香菇鸡腿饭 32 元/份,含米饭` |
| s5、s16 | `午市单人组合\n\n38 元/份，含米饭` | `午市单人组合 38 元/份,含米饭` |
| s7、s18 | `番茄炖牛腩\n\n58 元/份` | `番茄炖牛腩 58 元/份` |
| s8、s19 | `时蔬豆腐煲\n\n36 元/份` | `时蔬豆腐煲 36 元/份` |
| s9 | `午市\n\n11:00–14:00`；`午市停止点菜\n\n13:30`；`晚市\n\n17:00–20:30`；`晚市停止点菜\n\n20:00` | `午市 11:00–14:00 午市停止点菜 13:30 晚市 17:00–20:30 晚市停止点菜 20:00` |
| s10 | `2018\n\n从午市饭菜开始经营。` | `2018 从午市饭菜开始经营。` |
| s12 | `服务社区：杭州市拱墅区。`；`门牌地址：待补充` | `服务社区:杭州市拱墅区。`；`门牌地址:待补充`（原文冒号分隔） |
| s21 | `葱油拌面\n\n22 元/份` | `葱油拌面 22 元/份` |
| s22 | `当日清炒时蔬\n\n18 元/份` | `当日清炒时蔬 18 元/份` |
| s24 | `<TD>香菇鸡腿饭</TD>\n\n<TD>32 元/份</TD>` | `香菇鸡腿饭 32 元/份 含米饭 午市、晚市` |
| s25 | `<TD>午市单人组合</TD>\n\n<TD>38 元/份</TD>` | `午市单人组合 38 元/份 含米饭 仅午市` |
| s26 | `<TD>番茄炖牛腩</TD>\n\n<TD>58 元/份</TD>` | `番茄炖牛腩 58 元/份 单点 3 元/碗 午市、晚市` |
| s27 | `<TD>时蔬豆腐煲</TD>\n\n<TD>36 元/份</TD>` | `时蔬豆腐煲 36 元/份 单点 3 元/碗 午市、晚市` |
| s28 | `<TD>葱油拌面</TD>\n\n<TD>22 元/份</TD>` | `葱油拌面 22 元/份 单点 3 元/碗 仅午市` |
| s29 | `<TD>当日清炒时蔬</TD>\n\n<TD>18 元/份</TD>` | `当日清炒时蔬 18 元/份 单点 3 元/碗 午市、晚市` |
| s32 | `午市\n\n11:00–14:00\n\n停止点菜 13:30` | `午市 11:00–14:00 停止点菜 13:30` |
| s33 | `午市\n\n11:00–14:00，停止点菜 13:30。` | `午市 11:00–14:00,停止点菜 13:30。` |
| s34 | `地址与社区\n\n服务社区：杭州市拱墅区；门店所在区与门牌地址待补充。` | `地址与社区 服务社区:杭州市拱墅区;门店所在区与门牌地址待补充。` |
| s37 | `下午什么时候能来？\n\n午市 14:00 结束，晚市 17:00 开始，两市之间为休息整理时间。` | `下午什么时候能来? 午市 14:00 结束,晚市 17:00 开始,两市之间为休息整理时间。` |
| s38 | `食品经营许可证编号\n\n待补充。` | `食品经营许可证编号 待补充。` |

s24–s29 的表头单独位于各自 claimTexts[1]：`[scope=col] 菜品 [scope=col] 价格 [scope=col] 米饭 [scope=col] 供应时段`，数据行位于 claimTexts[2]；没有将表头与数据行跨 TR 拼接。s9、s32、s33 的营业与到店时间、s34 的地址/社区、s38 的资质/联系方式均能区分标签和值；没有出现 T-188 的 `地址杭州市拱墅区` 粘连形式。

**最终页面与资料逐字并列核对。** 资料是本次实际发送的 `probe/private/case-1/materials.txt`；最终 HTML 在 `probe-final-code.json`。完整字段、DOM 位置和出处行号保存在 `probe-field-comparison.json`，人工结论与措辞差异在 `probe-manual-verdict.json`，不把语义对应写成整句逐字相同。

| 资料原文 | 最终页面原文 | 对照结论 |
| --- | --- | --- |
| 第 15 行 `门牌地址：待补充。`；第 16 行 `服务社区：杭州市拱墅区（门店所在区未提供）。` | 到店页 `地址与社区` 的值为 `服务社区：杭州市拱墅区；门店所在区与门牌地址待补充。` | 所在区和门牌仍未知；拱墅区明确属于服务社区，没有变成门店所在地。括号说明改为待补充陈述，非整句逐字相同。 |
| 同上 | 公共页脚 `服务社区：杭州市拱墅区。`、`门牌地址：待补充` | 页脚省略括号说明，但标签仍是服务社区；门牌独立保留待补充。三页共用同一页脚。 |
| 第 14 行 `周二至周日`、`午市 11:00–14:00、晚市 17:00–20:30；周一休息。午市停止点菜时间为 13:30，晚市为 20:00` | `营业日`：`周二至周日；周一休息。`；`午市`：`11:00–14:00，停止点菜 13:30。`；`晚市`：`17:00–20:30，停止点菜 20:00。` | 拆为字段，日期、营业范围和点菜截止对应；没有把点菜截止换成营业结束。首页、到店首屏、到店详情及页脚相互对应。 |
| 第 14 行 `节假日营业安排待补充。`；第 17 行 `到店时间：午市、晚市的接待与停止点菜时间按营业安排。` | `节假日`：`营业安排待补充。`；到店常问为 `午市 14:00 结束，晚市 17:00 开始，两市之间为休息整理时间。` | 没有新增全天营业、节假日安排或其他到店时间。休息整理也见资料厨房安排中的两市之间整理工作台。 |
| 第 18 行 `到店通行条件：门店入口台阶和无障碍通行条件待补充。` | `到店通行`：`门店入口台阶和无障碍通行条件待补充。` | 未将未知通行条件改为便利或无障碍承诺。 |
| 第 19 行 `堂食区有 24 个座位，以两人桌和四人桌为主，不设包间。儿童座椅数量、停车条件和实时空位待补充。` | `堂食区`：`24 个座位，以两人桌和四人桌为主，不设包间。儿童座椅数量、停车条件和实时空位待补充。` | 数量与缺口保留，没有把座位数改成实时空位。 |
| 第 24 行资质状态待补充；第 32 行邮箱与电话待补充 | 许可证编号、健康证明、电话均为 `待补充。`；邮箱 `hello@hexiang-kitchen.luckye.online` | 未补造资质或电话，邮箱原样。 |

**用量与账本。** 三次上游调用均 HTTP 200，没有截断、重发或未知用量，单轮登记、已知总用量 **106010/300000 token**。原账本为 `artifacts/t174/t191-label-probe/usage.json`，只读副本为 `artifacts/t191/probe-ledger-final.json`。

| 调用 | 输入 token | 输出 token（含思考） | 合计 | 结束原因 |
| --- | ---: | ---: | ---: | --- |
| 页面规划 | 9040 | 2293 | 11333 | tool_calls |
| 写整站代码 | 10479 | 29302 | 39781 | stop |
| 事实核对 40 段 | 15689 | 39207 | 54896 | stop |
| 合计 | 35208 | 70802 | **106010** | 未知 0 次 |

**截图、评估失败与关闭。** 9 张生成站全页图、1 张首页首屏图、1 张外部对照图及 4 张审包副本共 15 张 PNG 已逐张打开，均有实际内容；清单为 `probe-screenshot-views.json`。仅核实载入与字段，不作审美判定。评估错误原文为 `对照 restaurant/1：AssertionError [ERR_ASSERTION]: 页面入场或转场未结束，本次未保存截图`；未替换对照、跳过检查或重跑命令，`round.status` 与 exit 1 如实保留。mixed/company 包由原评估器生成，但没有开启审核/盲评实例或送评。

评估器在 04:29:50 EDT 退出后，又经实际 draft GET 确认 run 为 complete，并经网关 `/status` 确认零 in-flight，记录在 `probe-pre-stop.json`、`probe-manual-stop-guard.json`。随后手动 SIGTERM 本轮网关和 dev 两个独立进程组，于 **04:30:26 EDT** 确认 **52262 与 52263 均已关闭**，见 `probe-stopped.json`。账本的 stopped=false 表示没有触发预算或上游错误停止条件，不代表进程仍在运行；没有为展示“已停”改写原账本。

**当前交付：INCOMPLETE（本次获批步骤已执行完，评估整轮仍为 INCOMPLETE，整票待主线验证及独立审查）。** 当前合并候选未复现地址/服务社区混淆，标签和值在实际 facts 输入中分隔清楚；本轮同时使用 T-190 资料与 T-191 代码，不能凭单次探针将效果单独归因。未推送，未改资料或生成代码；只提交本票记录。`tsconfig.json` 自动改动保留未提交。不再发真实探针，按负责人要求报 SHA 后停下。

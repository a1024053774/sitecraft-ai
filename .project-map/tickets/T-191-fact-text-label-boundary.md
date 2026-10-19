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
- [ ] 若改代码：成对测试先红后绿，真实探针结果如实记录
- [ ] 合并后主线验证通过；独立 fast 审查通过

## Resolution

INCOMPLETE：2026-10-19，codex-t191 按负责人本轮指令先完成本地修复与定向门控，再本地提交停下。真实探针须等 T-190 补改合入后另行通知；本轮不跑真实模型、不跑全量、runner、build，不开审查或盲评实例，票保持 open。

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

**当前停点：INCOMPLETE（本轮补改与本地门控完成，整票仍待真实探针及后续验收）。** 未推送，未合入 T-190，未调用真实模型，未开审查或盲评实例，未跑全量、runner 或 build。继续等待负责人通知，再合入 T-190 补改并用 restaurant/precision、新账本及 `SITECRAFT_TOKEN_LIMIT=300000` 跑真实探针。

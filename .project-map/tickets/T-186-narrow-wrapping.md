---
id: T-186
title: 375 下时间、参数与标签碎折行
type: build
status: open
blocked_by: [T-190]
claimed_by: codex-t186
supersedes:
---

## Why

T-180 company 盲评发现约 7 站在 375 宽度下出现碎折行：营业时间的起止值被拆开，「10:00—17:00」、开放日「周四」单独换到一行，减速机的长参数串多次折行，桌面页脚的邮箱也被断开。代表截图：

- restaurant/editorial：`artifacts/t180-r2/round2-selected/private/case-1/home-375.png`
- education/documentary：`artifacts/t180-r2/round1-full/private/case-12/home-375.png`
- industrial/documentary：`artifacts/t180-r2/round1-full/private/case-2/home-375.png`

2026-10-19 构思主控改排期：等 T-190 新资料基线出来，按固定口径确认 375 碎折行仍存在再做；不存在则关票并写明。

## What to build

1. **先查根因**：对照源码，看问题出在模型写的 CSS（栏宽、white-space、标签和值的排法），还是核心规范缺少相应约束。
2. **在根因层修**：可以是提示约束（时间区间、短标签、型号、邮箱不拆开；长参数串在窄屏改为上下排列等），也可以是确定性的系统样式。修法以不引入横向溢出为前提。
3. **只作质量反馈**：如果新增机械检查，只作为质量反馈，不拒收、不触发修正轮（与 T-160 一致）。
4. **证据**：在 T-184 之后的主线上，用 `--only` 跑代表组合，预算 `SITECRAFT_TOKEN_LIMIT=1000000`。375、768、1440 截图都要逐张打开看过，company 盲评交独立实例。

## Acceptance

- [ ] 根因写进 Resolution
- [ ] 代表组合 375 截图不再出现上述碎折行，同时无横向溢出；盲评如实记录
- [ ] typecheck、test、build 通过；独立 fast 审查通过

## Resolution

执行：codex-t186，2026-10-19。当前 INCOMPLETE：提示合同门控通过，单次真实评估与逐图核对待完成。遵循本次负责人指令，不跑全量、runner、build，不开审查或盲评实例；原验收中这些项交主控处理，未勾选。工作树基于 4708f86；未修改 T-196 占用的 `scripts/visitor-layout-scan.js` 与 `lib/code-site-check.ts`。

### 根因与改法

本次直接改善生成站可读性。Tracer bullet 取生产规划、写页和局部修改入口的实际模型请求；Deep modules 保持既有提示加载接口，不新增系统样式或检查 API；Ubiquitous language 将这些现象统一称为「语义短串碎折行」。不按行业硬编码，不新增机械反馈、拒收条件或修正轮。

只读判定：`/Users/luckye/Documents/Code/sitecraft-ai/artifacts/t186/judgement.md`。下表路径前缀 B 为 `/Users/luckye/Documents/Code/sitecraft-ai/artifacts/t190/baseline-worktree-evidence/`；行号指向实际当前存版的源字段，不修改原 JSON。为便于逐条读 CSS，本工作树 `artifacts/t186/baseline/<组合>/` 另存按原换行展开的 HTML/CSS；这些是只读摘录，不是修改后的站点。

| 组合 | 源码位置（B 下）与根因 |
| --- | --- |
| industrial/documentary | `r2/round1-full/private/case-2/code-site.json:66` 首页 `.prod-meta` 将六项规格放进一个文本 span，含「中心距」「底脚/法兰」；`:61` 的 CSS 只设 display:block、14px，无字段子元素、短串保护或手机重排。`.wrap` 在 375 仅剩 339px，虽然整体网格折为一列，串内仍按中文默认规则任意断行；对应摘录 `industrial-documentary/home.html:29`、`css.css:39`、`:120`。未设置 word-break、overflow-wrap 或该处 min-width；不是强制断词导致。产品页逐项 dl 能完整呈现，说明长串排法才是差别。 |
| molding/documentary | `r2/round1-full/private/case-6/code-site.json:76` 的结构件 li 把重量与机台范围接成一句，`90–800 t` 中普通空格允许单位独行；`:91` 的 FAQ 左标签「贸易条款」仍占 22% 栏宽。`:71` 的 `.spec-terms th{width:22%}` 配 16px 右内边距，在 339px 内容栏约只剩 59px 文字空间，15px 四字标签放不下，手机没有覆盖；对应摘录 `home.html:43`、`faq.html:35`、`css.css:88-92`。相关元素没有 nowrap、独立数值单元或最小标签宽，word-break/overflow-wrap 未设置。 |
| packaging/documentary | `r2/round1-full/private/case-8/code-site.json:81` 的订购表保留包装名、MOQ、交期、起算点四列，数量单位和时间范围是未保护的文本；`:66` 的 `.spec` 宽100%、左右各12px单元格内边距，手机只将包装列从8.5em改为7em并取消 nowrap，其他列未重排，内容栏335px被四列共同压缩。不是设置大 min-width 撑出的溢出，而是把数字、单位和产品名压碎；对应摘录 `sampling.html:11`、`css.css:68-75`、`:137`。`.contact-plain .mail{word-break:break-all}` 另有邮箱风险，但判定中的邮箱这次完整；不能把它当成本表根因。 |
| restaurant/editorial | `r3/round2-selected/private/case-1/code-site.json:81` 的到店页导语 `.lede` 将午晚时段和停止点菜时间连成一段；`:66` 的导语17px、max-width:34em，在375由两侧20px留白收窄至335px，时间没有独立 span 或 nowrap，连接符后是合法换行点。无该处 min-width、break-all 或 anywhere；对应摘录 `visit.html:1`、`css.css:11`、`:81`。同页下方营业表完整，不能据此忽略导语。 |
| restaurant/neighborly | `r3/round2-selected/private/case-2/code-site.json:65` 公共页脚把日期、两个时段、休息日和停止点菜时间都塞进同一 p；`:66` 的页脚14.5px、max-width:52em，手机 `.wrap` 留白后335px，晚市17:00–20:30没有短串保护，仍按连接符换行。对应摘录 `footer.html:1`、`css.css:90-93`。`.info-table .num` 已有 nowrap 只保护营业表，页脚未复用；`.facts dd{overflow-wrap:anywhere}` 不匹配页脚，不是此处直接原因。 |
| education/editorial | `r3/round2-selected/private/case-3/code-site.json:65` 页脚把周中和周末时间写在同一 p，`:66` 的14px文字在335px内未保护时间范围。`:81` 学习须知 `.plain-table` 的首列9em、15px字、16px右内边距，约119px可用文字宽，小于「周一、周二与周四」八字的120px，故单独剩「四」；手机没有覆盖该表。对应摘录 `footer.html:11`、`guide.html:38-40`、`css.css:101-103`、`:113`。表格是auto布局，未设最小标签宽，相关 white-space 默认为normal，word-break/overflow-wrap 未设置。 |

共性缺口在 `skills/site-code-core/SKILL.md:22`：原规则只有多列折叠、三档不溢出，不保护时间、数量单位和标签内部。documentary、editorial、neighborly（以及同一运行合同的 precision）风格首段也没有这些约束。`lib/code-site-model.ts:20` 的 rules 同时服务 planSiteCode/writeSiteCode；`:215` 的 writeLocalEdit 只取风格首段，因此本次核心加详细规则，四种风格首段补同一条简明合同，保持首段截取逻辑不变。优先上下排字段、窄屏表格变字段行，完整短串仅局部保护，长邮箱独占行；不以隐藏、裁切、横向滚动或难读小字掩盖宽度问题。未添加确定性系统样式，故没有「旧站经系统样式修复」的主张或对应夹具。

### 提示合同与门控

新增 `tests/t186-narrow-wrapping.test.ts`，期望来自本票需求，经过生产 planSiteCode/writeSiteCode/writeLocalEdit 截获实际请求；四种风格分别检查核心与风格规则及局部首段，还保留原资料与12288输出合同。只能证明提示送达，不能证明模型遵从或审美通过。

- 首次夹具解析遗漏生产提示附加行，失败保存在 `artifacts/t186/contract-red.log`；这是测试夹具错误，不作为产品红证据，未修改产品行为。
- 修正夹具后，在父版本4708f86的原提示上运行 `CHROME_PATH=… npm test -- tests/t186-narrow-wrapping.test.ts --browser-concurrency=1`：4/4因「时间区间保持完整」断言失败。证据 `artifacts/t186/contract-red-2.log` 和 `artifacts/t167/test-run-1792434170531-17420/`。之后才修改提示。
- 同一新测试连同 `tests/t184-style-visual.test.ts`、`tests/t188-condition-scope.test.ts` 经标准 npm test 入口，浏览器池串行：19/19通过，无取消或跳过。证据 `artifacts/t186/contract-green.log` 和 `artifacts/t167/test-run-1792434201949-21879/`。
- `npm run typecheck` 退出0，见 `artifacts/t186/typecheck.log`。未运行全量、runner、build、独立审查或盲评，遵照本次指令；tsconfig.json的Next自动改动不提交。

### 单次真实评估准备

`curl -m 15 -sS -o /dev/null -w 'HTTP %{http_code}\\n' https://api.deepseek.com/` 唯一次检查退出0，HTTP401，证明端点可达，不代表凭据调用已验证。拟跑本票指定六组合，仅一次，失败站不重跑。T-190第一轮14组合、第二轮6组合均与本次六组合集合不同，`scripts/eval-set-report.ts:125` 明确要求集合一致，`--previous-materials-changed` 也不豁免集合，因此不加 `--previous`，不做伪成对比较。

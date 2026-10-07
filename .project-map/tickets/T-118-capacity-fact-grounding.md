---
id: T-118
title: 产能事实保留来源关系，拒绝记录可定位
type: build
status: open
blocked_by: []
claimed_by: 
supersedes:
---

## What to build

T110真实注塑/工程工业Tracer站`d0d1ebf1-7e17-4cb4-9e2f-f2962a0c68c6`首次模型生成后，原资料的约180套模具/年、约600万注塑件/月均未在最终草稿保留。API返回applied并报告capacity被拒；发布页128项草稿事实全部可见不能证明原资料没有遗漏。被拒的模型原始值没有保存，本例不能归因为已知的误拒或模型改错。

已确认的独立合成反例在 `artifacts/t110/generation/molding-screwfast-tracer/capacity-diagnostic-20261006/`：合法annual/monthly及中文仅去空格会误拒，排序数字/单位集合相同但周期或产出单位互换却会放过。这些对照不是恢复的模型原值。T110停止剩余11格和盲评，原站、原资料、照片和第一次失败完整保留。

先做 **Tracer bullet**，在现有商业条款验证/生成入口保留正确来源关系。**Deep modules**：最小修复落在现有groundCommercialTerm及直接caller，不另造事实系统、通用NLP、草稿schema或平行API。**Ubiquitous language**：资料已给的数量、产出单位、周期与限定条件必须对应，未给的维度保持未给，不要求产能原话必须有数字或周期。设备存量/规格不能借周期或产出单位冒充生产量；产能行内原样设备说明的真实性与产能事实完整性分开核对。允许已经明确等价的空格、annual/year、monthly/month等表示，不把不同周期推算换算，不允许只对排序后的数字/单位袋放行。

保留被拒的结构化原值、具体失败原因及来源匹配依据，利用现有结果/会话记录边界，保持有界并排除密钥/请求头/模型推理正文。拒绝内容不得回流为新的可信公司资料，也不为后续功能预置接口。英文沿用T082的机械范围，不能宣称已验证专名或完整翻译语义。

执行者先读代码、直接caller、相关测试并回报最小文件清单。主控持有living docs、T110协议和整合。没有授权改已冻结样本或再调用模型；源码审查通过后由主控安排同一原站的受控真实修复/验证，只恢复原资料事实，不能换站、改资料、重生成挑美观结果或手工绕过验证。

## Acceptance

- [x] 原真实失败及模型原值未知的限制保留；新永久回归在已知坏实现上业务红，预期来自资料/独立合成输入
- [ ] 已确认等价表达通过；错数、错单位、错周期、关联互换、丢失限定或资料外推算被拒；设备数量不冒充产能
- [x] 被拒原值和具体条件可追溯，不泄露秘密或成为事实来源；不将合成对照伪称原模型输出
- [ ] 相关测试及必要完整检查通过，不同Astra独立审查通过；真实原站仅在主控统一安排下复验，其他事实、样子及照片不变
- [ ] living docs/票据说明边界，T110仍按预先门槛执行，不把草稿自身事实门等同原资料完整性

## Resolution

**INCOMPLETE：真实原站恢复被拒后的连字符等价修复已冻结，等待新独立Astra审核。** 当前改动仅将既有产能修饰语 `injection molded` 接受为 `injection-molded` 的ASCII连字符拼写，单位身份、数量/周期/限定关系及完整残余拒绝沿原路径；不全局删除连字符，不新增词库、NLP、schema或API。

真实失败证据 `artifacts/t118/original-site-recovery/44053fd-once/audit-result.json`：在 `44053fdb0e6c65be8970c5bbc50a048dcde7acb9` 上于2026-10-07 09:44:30–09:44:36Z执行唯一chat POST，HTTP200但SSE no_change，恢复0/2。来源匹配成功，保存的capacity候选英文为“Approximately 180 mold sets per year; approximately 6 million injection-molded pieces per month”，失败为english_capacity_parse/english_unsupported_syntax，trace `5ae4feb27dcea5f9607a17547e422540`。原站仍revision3，完整草稿/history/future、三旧条款及六照片/metadata逐字节未变，会话仅新增no_change。实际模型尝试/重试UNKNOWN；这份新诊断不能倒推旧T110首次拒绝的未知原因。没有第二POST或手工补稿。

执行证据 `artifacts/t118/live-capacity-hyphen/44053fd/HANDOFF.json` 于09:54:53Z冻结：原227个测试文件旧字节保留，T118新增内容只追加；最终相同回归在未改44053fd上有两项有效业务红（纯校验和实际chat导出），不是聚合父测试失败计数。修后 `node --test --experimental-strip-types --test-name-pattern=T118 live hyphen tests/t118-capacity-grounding.test.ts` 于09:52:49–09:52:50Z为13/13；指定六文件于09:53:06–09:53:12Z为1617/1617；`npm run typecheck` 于09:53:16–09:53:20Z exit0。合成loopback provider→真实chat导出→commitOperations→隔离非空FS核两事实、三旧terms保留、拒绝不写和undo；只有capacity来自已保存诊断，其他terms来自before，不声称恢复完整模型原响应。初次运行器路径setup及过细诊断断言混合红均保留。

主控对最终green/related/typecheck前后及frozen-source作80项直接字节核对，全部相等，见 `artifacts/integration/20261007-live-capacity-hyphen/binding.json`；CONTEXT/spec只补此拼写等价。新候选full/build、运行绑定、原站再次验证尚未执行，不能承接上一生产字节版本的完整通过。源码审查通过后才安排这些检查及同原站受控复验。

先前共享事实门在 `00aba7bec2fd0055ec4a510b9296fe13c886ab45` 获独立软件PASS/LIMITED_GO（147有效检查，父模块62业务红），证据 `artifacts/t118/astra-00aba7b/REVIEW.md`。`44053fd` 的有效工程结果为：00aba7b的build于08:10:57–08:11:28Z exit0并按生产字节一致承接；440 typecheck于09:15:25–09:15:27Z exit0；修正运行器输出目录后09:31:01–09:37:52Z完整npm test为2453/2453、0skip/cancel，见 `artifacts/t118/validation-44053fd-harness-corrected/REPORT.md`。前轮909项的T118模块ENOENT是运行器setup失败，旧报告未改写。

已保留的验收限制：732972d原全量2452/2453中，T117静态1440zh图顶部150px以下全白；夹具补两个生产高度类获独立scoped PASS/LIMITED_GO并单独提交44053fd，但原collector/compositor因果与触发频率仍未知，不宣称永久可靠。证据根 `artifacts/t117/full-failure-732972d/`。Next自动生成next-env.d.ts已按安装版官方指南停止Git跟踪，运行时仍单独字节绑定，旧冻结漂移在 `artifacts/t118/validation-00aba7b/` 保留。所有旧候选、失败、setup、原图和额度断点证据不覆盖。整票及T110正式盲评未完成，原站产能仍缺失，本票open、未推送。

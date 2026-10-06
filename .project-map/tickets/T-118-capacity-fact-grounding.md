---
id: T-118
title: 产能事实保留来源关系，拒绝记录可定位
type: build
status: open
blocked_by: []
claimed_by: t118-units-resume
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

**INCOMPLETE：冻结00aba7b已获独立软件PASS / LIMITED_GO，完整工程检查与原站恢复尚未完成。** 报告 `artifacts/t118/astra-00aba7b/REVIEW.md` 对 `00aba7bec2fd0055ec4a510b9296fe13c886ab45` 给出147项有效独立检查通过（L1 109、loopback真实chat导出/HTTP/SSE/非空FS读回撤销32、诊断6），父事实门模块检出62项业务失败；首尾368项与Git直接字节一致，无有效产品反例。setup和无效夹具失败单列保留。LIMITED_GO仅覆盖有限机械合同与隔离提交链路，不证明外部模型、Next路由或原站。已派干净交付员工在 `artifacts/t118/validation-00aba7b/` 先build、受控绑定3034至冻结源码后跑全量；不改源码或原站，不据软件PASS关闭票。

本轮基线 `23dc505058557725ac89a06ef07b49b712e4516b` 的独立失败见 `artifacts/t118/astra-23dc505/REPORT.txt`：117→17及AX-731B→AX-731的来源截短可落盘。旧测试逐字节保留；直接有效红18项，最终46例冻结旧模块回放20项业务红。最终聚焦46/46、六文件1604/1604、typecheck exit0，2026-10-07 07:50:27Z冻结；命令、UTC、exit、源码、patch及初次种子/夹具失败见 `artifacts/t118/unit-identity-resume/23dc505/HANDOFF.json`。初次装配精确开始UTC未捕获，仅保留已知区间，不补造。合成loopback实际chat/SSE→commitOperations→隔离非空FS共92/92请求通过，非法拒绝有原因且revision/history/字节不变，合法保存与undo-redo通过；不证明外部模型、Next路由或原站。

主控将三个source/test文件与作者冻结、最终四项检查前后快照，以及HTTP七文件首尾作41项直接字节核对，全部相等；绑定在 `artifacts/integration/20261007-source-token-spans/source-binding.json`。CONTEXT/spec窄同步来源命中区间及完整词元边界；作者证据不替代新独立审核。原基线NO_GO、所有中间红与setup失败保留，不用局部绿关闭本票。

此前额度停工的终端、工作树diff与断点快照保存在 `artifacts/handoff/20261007-herdr-quota/`，旧窗口已清理。2026-10-07 02:39Z已确认新实例实际working；所有旧候选、源、patch、异常与独立NO_GO原样保留。

工程检查：00aba7b的build于2026-10-07 08:10:57–08:11:28Z单次exit0、源码前后字节相同。随后受控启动3034时，Next自动把next-env.d.ts的类型引用改为.next/dev/types，旧冻结门正确报漂移，完整测试未启动；证据 `artifacts/t118/validation-00aba7b/` 保留原/现字节。按安装版本Next 16.3.1随包指南，将该生成文件从Git索引移除并忽略，磁盘文件保留，运行时另存字节绑定；不手动改回、不抹去失败。边界记录 `artifacts/integration/20261007-generated-next-env/boundary.json`。新冻结后重绑服务、typecheck及全量待完成；应用源码未变，已通过build承接直接字节证据。

原站两项产能仍未恢复，首次被拒模型值及因果未知；原站资料、照片未改。工程检查通过后才安排同一原站的一次真实对话恢复及回读/撤销重做/刷新/双语发布门。T110及正式盲评仍未完成，本票保持open、未推送。

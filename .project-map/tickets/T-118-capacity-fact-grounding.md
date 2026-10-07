---
id: T-118
title: 产能事实保留来源关系，拒绝记录可定位
type: build
status: open
blocked_by: []
claimed_by: t118-build
supersedes:
---

## What to build

T110真实注塑/工程工业Tracer站`d0d1ebf1-7e17-4cb4-9e2f-f2962a0c68c6`首次模型生成后，原资料的约180套模具/年、约600万注塑件/月均未在最终草稿保留。API返回applied并报告capacity被拒；发布页128项草稿事实全部可见不能证明原资料没有遗漏。被拒的模型原始值没有保存，本例不能归因为已知的误拒或模型改错。

已确认的独立合成反例在 `artifacts/t110/generation/molding-screwfast-tracer/capacity-diagnostic-20261006/`：合法annual/monthly及中文仅去空格会误拒，排序数字/单位集合相同但周期或产出单位互换却会放过。这些对照不是恢复的模型原值。T110停止剩余11格和盲评，原站、原资料、照片和第一次失败完整保留。

先做 **Tracer bullet**，在现有商业条款验证/生成入口保留正确来源关系。**Deep modules**：最小修复落在现有groundCommercialTerm及直接caller，不另造事实系统、通用NLP、草稿schema或平行API。**Ubiquitous language**：资料已给的数量、产出单位、周期与限定条件必须对应，未给的维度保持未给，不要求产能原话必须有数字或周期。设备存量/规格不能借周期或产出单位冒充生产量；产能行内原样设备说明的真实性与产能事实完整性分开核对。允许已经明确等价的空格、annual/year、monthly/month等表示，不把不同周期推算换算，不允许只对排序后的数字/单位袋放行。

保留被拒的结构化原值、具体失败原因及来源匹配依据，利用现有结果/会话记录边界，保持有界并排除密钥/请求头/模型推理正文。拒绝内容不得回流为新的可信公司资料，也不为后续功能预置接口。英文沿用T082的机械范围，不能宣称已验证专名或完整翻译语义。

本轮范围由负责人2026-10-07指令授权：只核验现有根因修复、补行为测试，并用真实DeepSeek对原注塑资料执行一次产能恢复。使用本worktree中原站同ID的数据副本，主工作区原站不改；不换资料、样子或照片，不重生成挑结果，不手工绕过验证。主控持有living docs、T110协议和整合；T120冻结的验收工具链保持原样。

## Acceptance

- [x] 原真实失败及模型原值未知的限制保留；新永久回归在已知坏实现上业务红，预期来自资料/独立合成输入
- [x] 已确认等价表达通过；错数、错单位、错周期、关联互换、丢失限定或资料外推算被拒；设备数量不冒充产能
- [x] 被拒原值和具体条件可追溯，不泄露秘密或成为事实来源；不将合成对照伪称原模型输出
- [ ] 相关测试及必要完整检查通过，不同Astra独立审查通过；真实原站仅在主控统一安排下复验，其他事实、样子及照片不变
- [x] living docs/票据说明边界，T110仍按预先门槛执行，不把草稿自身事实门等同原资料完整性

## Resolution

**INCOMPLETE（低负载验收口径）：产能关系行为、真实DeepSeek恢复、独立Astra软件审查、相关测试、typecheck、build、全量npm test及13站检查均已通过。全量以负载3.96启动，但运行峰值33.85，不能声称全程低于负责人要求的12；是否只要求启动门槛待主控明确。本轮执行已完成，不再重跑或扩修验收工具。** 本轮以 `d68323ce1cfc6e2a254e9dfd4dcd5bf557755ba1` 为起点，复用已合入的根因修复 `732972d` 和连字符等价修复 `4b95521`，不再增加生产实现。新增文件仅 `tests/t118-capacity-contract.test.ts`，另更新本票。没有改验收工具、草稿schema、事实API或living docs。

父版反事实只替换 `732972d` 父提交 `bcd2949` 的 `lib/site-operations.ts` 模块，其他依赖使用当前树；不是声称重跑整个旧提交。命令 `node --import /tmp/t118-parent-loader.mjs --test --experimental-strip-types tests/t118-capacity-contract.test.ts` 于2026-10-07 12:35Z执行，18项中10项在业务断言失败，覆盖合法年/月与空格表达误拒、周期互换及丢约数误放。预期来自原资料和独立字面输入。最终相关命令 `CHROME_PATH=<批准的headless-shell> node --test --test-concurrency=2 --experimental-strip-types tests/t118-capacity-contract.test.ts tests/t118-capacity-grounding.test.ts tests/commercial-terms.test.ts tests/draft-english.test.ts tests/equipment.test.ts tests/quality-process.test.ts tests/history-field.test.ts` 为1638/1638、0skip/cancel；`npm run build`及最终`npm run typecheck`均exit0。新测试首次漏写update的kind造成3项预期错误，修正后的父版仍10项业务红；初次日志保留。

唯一真实chat POST于2026-10-07 12:37:42–12:37:51Z运行（`node /tmp/t118-live-once.mjs`，3064、SITE_STORE=fs），沿同一会话对原站 `d0d1ebf1-7e17-4cb4-9e2f-f2962a0c68c6` 的本worktree数据副本恢复缺失产能，真实模型 `deepseek-flash`，HTTP200、applied、rejected=[]、revision3→4。写入中文“模具年产约 180 套；月注塑能力约 600 万件”，英文“Approximately 180 mold sets per year; approximately 6 million injection-molded pieces per month”。原三条商业条款、其他草稿内容/设计及既有history按领域对象核对保持；没有比较哈希、字节或像素，没有复制源码/依赖/构建目录。六张原图保留同ID，补齐原图片存储前置数据后于12:53Z全部HEAD返回200。主工作区原站保持revision3；复验副本和实际请求/结果留在本worktree，不代表已向主线数据回写。

独立gpt-6-astra对冻结候选进行一次只读软件审查，未发现阻断项；独立unseen数量463套/年、910万件/月、29台设备及80–520 t规格共20/20通过。结论仅为产能校验的软件行为PASS，不是审美、英文专名/完整语义或资料完整提取PASS。报告 `artifacts/t118/current/astra-review.md`。

13站清单仍为 `/Users/luckye/Documents/Code/sitecraft-ai/artifacts/handoff/mainline-12-sites.txt`（实际13项）。命令 `SITECRAFT_BASE=http://127.0.0.1:3064 CHROME_PATH=<批准的headless-shell> node scripts/check-published.mjs --out artifacts/t118/current/published-13 <清单13个ID>` 于12:38–12:42Z通过，39个站点/宽度结果、0失败、78张中英文截图；已逐站打开包含全部六图的整页联系表，无空白、载入态或截断。报告仍来自原脚本；未做询盘提交、部署、实机或盲评。

完整命令 `SITECRAFT_BASE=http://127.0.0.1:3064 CHROME_PATH=<批准的headless-shell> npm test -- --test-concurrency=1` 于2026-10-07 12:52:28–12:58:38Z为2490/2490、0fail/skip/cancel、exit0，启动负载3.96、运行峰值33.85，日志 `artifacts/t118/current/full-test-final.log`。功能与软件检查已PASS；低负载约束没有全程满足，本票保持open待口径明确，不改冻结工具、不修系统、不另开基础设施票。

两次无效前置配置均保留：第一次误用默认3034，2394通过、60项server-root失败、4取消，日志 `full-test.log`；第二次正确端口但未复制T113三个固定图像署名样本，2489通过、1项GET 404，日志 `full-test-correct-base.log`。补齐原样的同ID站点及 `uploads/demo/<siteId>` 图片后，原T113入口1/1通过，再跑相同完整命令获得上述2490通过；没有换样本、改断言、跳调用或重试掩盖。首次复制时错读uploads层级导致的setup失败及其短测试日志也保留。

本轮证据根 `artifacts/t118/current/`；旧T110首次拒绝的模型原值未知，合成对照不能倒推旧模型原因。前轮44053fd真实恢复no_change及历史报告继续保留在Git票据历史和主控原证据边界，本轮没有把它们改写成成功。T110仍按T104/T120原门槛执行；草稿自身事实可见不等于原资料完整提取。当前project-map status为Problems0、Stale living docs0。对应本地交付提交、命令和时间见本轮 `REPORT.md` 首行及各日志；低负载口径明确后由主控收口。本地提交、不push。

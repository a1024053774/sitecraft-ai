---
session_id: grilling-sitecraft-ai-generation-20260915
status: confirmed
topic: SiteCraft AI 中小企业自主建站方案
created_at: 2026-09-15T20:20:00+08:00
updated_at: 2026-09-16T12:00:00+08:00
last_round: 8
stage: execution
---

## Goal

为中小企业自动建站确定可审查需求和计划；重点是行业适配、美观、去同质化、可修改性，以及内嵌的可选需求对齐体验。

负责人和阶段确认人：当前用户。需求事实在 `docs/project/intent.md`；设计与执行草案在 `spec.md`、`plan.md`。本文件只记录会话，不构成第二份产品规格。

## Non-goals

- 公开部署和真实资料删除未授权；本轮可按已确认计划实施、验收并逐模块提交推送，不合并 PR #4、不回滚无关工作。
- 不把研究建议、模型自评或通过测试数量当成真实用户验收。
- 不把 Notion 恢复为详细工程证据库；只同步摘要。
- 不因问题回答完成自动授予实现或部署授权。

## Confirmed requirements and constraints

- 当前交付：内部技术 Demo，负责人模拟多行业企业；首批主场景为工业/设备/零部件/外贸 B2B。
- 长期按未来自助平台许可与数据归属边界考虑；不要求先找到 3–5 家真实客户。
- 企业输入：简介、产品表、图片、联系方式、主要行动目标与品牌偏好。
- 生成前有风格/主题选项，不向用户暴露 Skill 名称。
- 聊天框加号可选需求对齐；选项点击后自动继续同一任务，不复制 AI 输出、不另发“继续”。
- AI 自动出初稿；模板、重大视觉方向和发布前确认；普通修改差异可见、可撤销。
- 复用现有模板，并寻找更多不同主题/场景的开源模板；候选扩充与生产准入分开。
- 首轮 3 行业 × 1 份资料 × 4 组流程，共 12 个结果；稳定后扩到 24。
- 当前使用 DeepSeek，允许第三方模型；质量优先，暂不设成本/时延 KPI。
- 数据保留 90 天并提供开关；保护已发布站点及其引用素材，详见 Q17。
- 页面规划遵循用户明确要求、模型按需求规划、默认三类页面的优先级，详见 Q18。
- 委派统一使用 Cursor Grok 4.6 High Fast，以 TodoWrite 跟踪；按模块验收后提交并推送到自己的 fork。
- 本项目独立环境文件，不使用软链接；不把密钥写入 Git、Notion、prompt 或浏览器。

## Decision tree

Plan / intent 与 Design / spec 经用户回答及开始执行指令确认，进入 Build。模块实施采用 TodoWrite，证据写回现有 plan；每个模块验收后独立提交并推送到自己的 fork。不得把一次模块完成当作整个 Demo 已验收。

## Decisions

- D1 | confirmed | 既有用户决定 | 自己的 fork main 是主线，交付暂留 fork。
- D2 | confirmed | 既有用户决定 | PR #4 只按能力评估，不整体合并。
- D3 | confirmed | 既有 Q1 | 保留 submodule 和版本固定的本地/CI snapshot，不提交全量 dist。
- D4 | superseded（范围限制部分） | 既有 top5 + 本轮 Q14 | forge/atlas/kindred/signal/lonestone 仍是已有优先复核名单；候选范围不受五套或两套限制，参见 D12。
- D5 | confirmed | 用户 22:32/22:45 开始执行 | 原生 React/shadcn 系统性改造保留后续决策门；一句话建站目标保留，按当前 plan v0.3 的模块顺序执行。
- D6 | inferred | 研究综合 | visualBrief/模板契约/operations/截图组成内部方案；不是用户逐字段批准的架构。此前标 confirmed 过强，本轮校正。
- D7 | confirmed | Q8 C，Q15 B | 内部验证、按未来平台边界设计；Q15 明确近期不用真实客户试点。
- D8 | confirmed | Q9 A，Q10 A | 工业/B2B 为重点；采用企业资料包输入。
- D9 | confirmed | Q11 A | 自动初稿，重大方向和发布前确认，普通修改可撤销。
- D10 | confirmed | Q12 A | 先 12 个结果，稳定后再扩 24。
- D11 | confirmed | Q11/Q13 补充 | 风格/主题面向用户；Skill 名称不出现在用户选择中。内部具体 Skill 未选定。
- D12 | confirmed | Q14 自定义回答 | 多主题、多场景开源候选 + 复用现有；不采纳“只选 forge 和相邻模板且不查新来源”的限制。
- D13 | confirmed | Q15 补充 | 内部模拟公司、DeepSeek、质量优先、允许第三方模型、90 天保留与开关。
- D14 | confirmed | 新功能说明 | 可选内嵌需求对齐，点选/等待/恢复；默认关闭、每轮题量及事件字段是设计建议，尚未获逐项确认。

## Answer history

上一轮问题 Q1–Q7 未收到逐题回答，其前沿已被 Q8–Q15 替代；没有把未回答选项自动视为接受。

- Q1 首批用户 → superseded by Q9。
- Q2 资料输入 → superseded by Q10。
- Q3/Q4 审美验收和人工确认 → superseded by Q11/Q12。
- Q5 技术路线 → superseded by 当前 spec 的待确认方案。
- Q6 首个范围 → superseded by Q14。
- Q7 目标与运行边界 → superseded by Q15。
- Q8 | confirmed | C；内部验证兼顾未来自助平台。原建议中真实客户数量由 Q15 覆盖。
- Q9 | confirmed | A；工业、设备、外贸 B2B。
- Q10 | confirmed | A；企业简介、产品表、图、联系方式、行动目标、品牌偏好。
- Q11 | confirmed | A + 可视化风格选项。
- Q12 | confirmed | A；12 个结果起步。
- Q13 | confirmed（用户体验） / pending（内部选型） | 用风格/主题代替 Skill 选择；不等于批准所有候选 Skill。
- Q14 | confirmed | 研究多主题/适用场景开源模板并利用现有模板；原二选模板建议 rejected。
- Q15 | confirmed | B；内部 Demo、自模拟；第三方模型允许，保留 90 天并要开关；质量优先，暂不设成本/时延指标，使用 DeepSeek。
- Q16 | resolved by evidence | 三份 env.md 的文本 DeepSeek 地址/key 一致，本项目 .env.local 已配置相同值；普通文件模式 100644、已忽略且未跟踪。不需要重复确认路径；没有改 key 或调用 API。

## Assumptions and facts

- A1 | observed | 主应用 Next.js 16.3.1 / React 19.2.0；现有工作台不是 Tailwind 主栈。
- A2 | observed | 当前预览使用第三方 Astro/HTML iframe；引用方式不直接消费 React 组件。此事实不能证明该渲染路线质量足够或永远不能改变。
- A3 | measured（历史） | T1 曾对极小 PNG 获得 HTTP 200，只证明传输探测；产品图识别和视觉质量未验收。
- A4 | observed | 工作树包含 conversation store、Chat/intent 等未验收变更，本轮保留原样。
- A5 | inferred | 最终目标企业缺少专职设计/开发资源；当前直接用户已明确为内部测试者。
- A6 | confirmed / unknown | 行业重点和输入方式已回答；真实客户资料和付费模式未选定且不是当前 Demo 阻塞。
- A7 | unknown | 审美阈值和外部用户偏好尚未测量；内部盲评不能外推转化率。
- A8 | inferred | “需求对齐”建议按会话默认关闭，选项可跳过非关键偏好，关闭不取消事实与发布校验。

## Research evidence

- E1 | observed | 现有 Chat 已出现 answer/clarify/commit 分支和 conversationId，但尚无持久化待回答问题组/点击恢复闭环；适合先复用入口，不先新增另一套 Agent 服务。
- E2 | inferred | 先模板约束、后按证据决策原生渲染，是此前路线调研的建议；60–90 天拆分不是实测工期。
- E3 | pending | 真实 slot 覆盖与视觉效果仍需实际浏览器证据；本轮改用用户允许的模拟资料，不把真实企业包设为前置。
- E4 | inferred（验收原则） | 生成模型不能是唯一审美判据；机器行为证据和人工视觉判断分开记录。
- E5 | superseded（样本规模部分） | 原建议 3+1 未见包；以用户批准的 3×4 起步，仍保持评测输入独立于生产 prompt。
- E6 | pending | 内部盲评基线、固定截图环境及必要的业务收件证据尚未建立。
- E7 | observed | resources.json 实际索引 30 项资源（修正先前“26”）；全部是未固定版本、未生产批准的候选。resources/SKILL.md 是流程草案，不提供执行器。
- E8 | confirmed（方向） | 内部 Demo 采用未来平台的许可与数据边界，普通客户交付许可不能外推平台再分发。
- E9 | inferred | 将 DESIGN/page-plan 思路按消费者整合，避免平行存储契约。
- E10 | inferred | 单一审美主流程、按需文案和规范检查是内部选型建议；不是把某个 Skill 包直接当用户主题。
- E11 | unknown | Vercel 包装仓库和独立规则仓库的许可证证据粒度不同；固定采用文件与修订后复核，不直接称法律结论冲突。

## Confirmed frontier / Execution handoff

- Q17 | confirmed | user 22:32 | 采用 A：90 天自动清理过期对话、临时产物、无引用上传与过期未发布草稿；保护已发布站点和引用素材；关闭暂停自动清理并保留手动删除。
- Q18 | confirmed | user 22:32 | 用户明确要求的页面优先；未明确时模型按需求规划；仍不能确定才采用首页/产品服务/联系默认方案。原“固定三类页面”建议 superseded，不是上限。
- Q19 | confirmed | user 22:45 | 委派只用 Cursor Grok 4.6 High Fast；使用 TodoWrite 替代原生 Goal；每个模块验收后独立 commit 并 push 到自己的 fork。
- 执行授权 | confirmed | user 22:32 / 22:45 | 用户已要求开始执行，不再反复询问规格总批准。spec/plan v0.3 纳入上述修正后交付实施；公开部署仍需额外授权。

本阶段需求前沿为空。新出现的重大范围或安全决策才重新开启对齐；具体模板/Skill 的可用性、数据库及浏览器验证由实施核验，不把未验证事实写为完成。

## Risks and conflicts

- R1 | 功能/测试数量不等于建站质量，特别是已 staged 与未提交改动不能视为已验收版本。
- R2 | IDE Skill 安装不能替代运行时集成；也不能泛化为 Skill 永远无法由运行时使用。
- R3 | 新主题要有真实可生成差异；模板风格承载和素材不足需明确反馈，不能只换标签。
- R4 | 旧 top5/两模板限制被本轮 Q14 更新；保留旧文档历史，不让其覆盖新要求。
- R5 | 同一会话连续不要求模型调用一直运行；必须保存等待状态、处理重复点击/旧答案和 revision 冲突。
- R6 | 用户没选择 Skill 产品名；Impeccable/UI UX Pro Max 等仍需准入和效果验证。
- R7 | 数据删除具有不可逆影响，清理范围需 Q17 决定；90 天本地保留不能代表供应商侧保留。
- R8 | 内部模拟结果不能宣传为真实企业交付、客户满意度或转化率提升。

## Final baseline

需求对齐已确认，执行授权已确认。spec/plan v0.3 已写入 Q17/Q18、High Fast、TodoWrite 和模块提交推送规则；下一步执行规则模块验收与提交，然后冻结并审查已有 T2/T3/T4 代码。

## Changelog

- Round 1: Notion 摘要化，创建 intent 与本会话记录；提出 Q1–Q7（未收到逐题答案）。
- Round 2: 读取 GPT-6 Pro resources，记录采用/未验证内容，前沿改为 Q8–Q15。
- Round 3: 记录 21:31 的回答和可选内嵌对齐新需求；Q15 覆盖真实客户试点目标，Q14 覆盖封闭两模板限制。核验环境解决 Q16；新增 Q17/Q18；修正资源数和确认状态过强的表述。
- Round 4: 用户确认 Q17=A、Q18 页面优先级，并授权开始执行；更新为 Build 阶段；协作固定为 Grok 4.6 High Fast + TodoWrite；每个模块验收后独立 commit/push origin。
- Round 5: 用户确认不整仓搬 PR4，只取模板 adapter 精华与多出的 6 套模板；以 submodule 接入，不提交 dist。旧 D5“先不接 6 套”被本轮覆盖为“源码进 vendor，未建快照前不声称已可精确生成”。
- Round 6: 用户确认槽位不要正则冒充命中；意图走模型，落点走声明 slot map。发现与待办写入 `docs/research/PR4模板adapter抽取-2026-09-16.md`，交给主任务继续。
- Round 7（2026-09-16 10:02）: 用户授权主任务读取侧边栏 `7f18c351-9e4d-4266-9658-9f28a5eea55e`，将关键边界写入 AGENTS.md 并执行交接待办。主任务已用真实浏览器复现未声明联系/商品被写入且 missing 为空，确认声明落点取代猜写的方向；模板、快照、许可分别核验，不能冒充整个建站产品已完成。
- Round 8（2026-09-16）：声明 bridge、静态快照 loader、模板就绪 gallery 和六套素材审计完成；45 tests/build/Docker/浏览器验证通过。Next export、SPA 预渲染、客户素材准入和服务端发布 gate 保留为未完成项；模板模块已 commit `230d00b7845905a34003b75695d25dfb97cb6704` 并 push `origin/main`，远端 SHA 已核对。
- Round 9（2026-09-16）：Docker PostgreSQL 真实会话读写与 10 路并发追加通过，数据已清理；真实 chat answer/clarify 单次探针通过。后端“草稿 commit 后会话持久化失败”的一致性边界保留为下一模块。

# SiteCraft AI 执行计划

状态：`approved-for-execution`；版本 v0.3；2026-09-15。
依据：[需求基线](./intent.md)、[设计规格](./spec.md)及用户 22:32 开始执行、22:45 按模块验收/提交/推送的授权。

## 1. 交付与边界

近期交付内部技术 Demo，由项目负责人使用模拟企业资料自测；工业/B2B 为重点，同时覆盖不同主题和行业。真实客户试点、公开平台、成本或时延 KPI 不作为近期验收条件。

用户已批准按模块开始执行。进度由 TodoWrite 跟踪，模块证据和同步记录留在本文；每个功能经独立验收、主负责人核对后单独 commit 并 push 到 `origin` fork。既有未验收代码先核验，不混入规则文档提交。

旧 T1–T26 任务书和综合规划作为历史输入，不再驱动“先做完全部对话任务才看建站质量”的固定顺序。新的优先路径是：资料与风格 → 可选对齐 → 受控生成 → 可见修改 → 截图质量对照。

## 2. 已有证据与缺口

- 当前工作树有会话存储、Chat、模型意图及测试修改；代码存在不等于前端已接通或通过新需求验收。
- 当前草稿/iframe 预览以首页内容为主；Q18 已确定需求驱动的页面范围，必须实现页面身份、每页内容、导航和预览/发布读取，不能以固定三页替代。
- T1 的极小图片 HTTP 200 只证明传输格式被接受，不证明产品识别能力。
- `.env.local` 已包含与既有 `env.md` 一致的 DeepSeek 文本配置；Git 模式为普通文件 `100644`，被忽略且未跟踪。无需重复复制或建立软链接，本轮未发新 API 请求。
- 历史“阶段 0 全部完成”不能代表远端 CI、真实产品图、Skill 集成和全部旧门禁完成；重新以具体证据核验。

## 3. 执行顺序

### P0：确认规格，核验已有变更

范围：当前 `lib/conversation-store.ts`、`lib/ai-provider.ts`、`lib/site-operations.ts`、`lib/postgres.ts`、Chat route、工作台调用者及相关测试。

- 冻结 diff，区分已暂存、未暂存与未跟踪文件；保留用户已有工作。
- 执行 typecheck/test/build，记录当前退出码；核对 conversationId 是否往返、问题/回答是否不改草稿、PostgreSQL 路径是否有真实证据。
- 产出保留/修正清单。修复只针对可达问题和新契约，不按整个 PR 或整文件搬运。

完成条件：确定可复用入口、需要修正的具体边界；缺少数据库/浏览器证据的路径保持未验证，不用 mock 宣称已生产可用。

### P1：按场景筛选模板，定义可兑现的风格

这是用户 Q14 要求的独立只读调研/整理任务，应提前做，而不是先强制实现 forge 加一套。

- 从现有 16 套和 `resources/resources.json` 候选出发，核验具体来源与修订；覆盖工业规格、外贸目录、专业服务、本地服务、品牌作品、技术产品等不同内容结构。
- 当前 top5 保留优先复核地位，但候选范围不受其限制。先查现有能否适用，再引入确有差异的新来源；相似皮肤不算扩大场景。
- 分别记录代码/图片/字体许可、生成器使用权、技术栈、语言、所需素材、页面范围、实际可编辑能力及本地预览证据。仓库未构建时只称候选。
- 为首批真正可生成的主题设计卡片（名称、示意、素材要求）；不足的主题先不宣传可生成。

完成条件：能解释每个主题为何适用、选中的模板能承载什么。实际接入名单由场景覆盖与实测选择，不预设强制两套或一次全部接入。

### P2：同一聊天入口的对齐与恢复

范围：现有 conversation store、Chat route、`lib/ai-provider.ts`、工作台聊天组件与必要的共享 schema。

- 按 spec 扩展一个会话状态，不新增独立 alignment 服务或第二套聊天接口。
- 实现加号“需求对齐”、风格卡片、问题卡片、补充说明与摘要确认。建议默认关闭；无需用户复制问题或另发“继续”。
- 复用 `clarify/status/done` 事件载荷承载待回答卡片，点击提交 question ID/版本和 option IDs；保存成功再恢复 Agent。
- 等待用户时停止当前模型请求，保留待回答状态；刷新可读取同一会话，失效选择、多标签页冲突、重复点击不重复推进。
- 关闭访谈不关闭风格入口、事实核验或发布确认。用户已提供的信息不反复追问。

完成条件：真实工作台走过开启/关闭、回答、刷新、取消、过期提交；等待期间草稿不变。只测服务端函数不算完成前端体验。

### P3：设计、图片与预览形成一次完整生成

范围：`site-document` 的最小迁移、现有 operations/apply/inverse、template catalog/preview/frame、图片归属存储与实际 UI 调用者。

- 页面集合依次来自用户明确要求、模型根据需求规划，最后才是首页/产品服务/联系默认值。先定义实际页面 ID、每页内容/导航和预览/发布读取；验收必须含不同页面集合、显式单页要求和默认值使用条件，不能把首页字段复制到所有页。
- 会话中的设计预案转为同一份 `visualBrief`；主题、模板和内容修改都经 `commitOperations` 与 revision 校验。
- 所选模板的显式槽位、图片、字阶/颜色等必须可见且可撤销；不支持的字段明确报告，不用通用卡片网格掩盖适配失败。
- 接入上传、magic bytes、site/workspace 归属与视觉分析。用独立产品图验证识别与事实性；HTTP 200 不作为语义验收。
- 单点修改只影响选定字段；风格变更先说明影响并确认，不能绕过旧草稿版本检查。
- 模板源与构建快照固定版本。使用真实浏览器验证预览；远端 demo 和演示表单不作为本站发布成果。

完成条件：模拟企业资料 → 风格选择 → 可选对齐 → 方向确认 → 页面生成 → 对话修改 → 三设备预览，全部真实可见。具体图片和主题契约随当前调用者迁移，不为未来能力预置大量空 schema。

### P4：12 个结果的质量对照

- 冻结当前基线、模型/规则/模板修订和素材，独立准备 3 份模拟资料；建议工业制造、外贸目录、专业服务。
- 每份运行 A 当前流程、B 加审美指导、C 加资料驱动模板/设计约束、D 加截图审查与有限修复，共 12 个结果。
- 同一资料只变流程组；C 属组合改动，只报告组合收益。更换风格的输入依赖检查与长标题/缺图等反例作为补充证据。
- 保存浏览器截图和真实行为结果。隐藏组别随机展示，由负责人评价；记录作者自评和小样本局限，不宣称客户偏好或转化改善。
- 若结果只改变文案或标签，停止宣称风格生效；若提升稳定，再决定是否扩 24 个结果和更多模板。

完成条件：事实/操作/渲染问题与审美评分分开报告，能回答“提升来自什么、哪些仍失败”；不靠模型自评或通过测试数量宣布美观。

### P5：保留策略与内部 Demo 收尾

- 按 Q17=A 实现“90 天自动清理”开关：过期对话、临时产物、无引用上传和过期未发布草稿可清理；已发布站点及引用素材受保护。关闭只暂停自动清理，保留手动删除；明确各数据类别的过期时间起点。
- 先在受控测试数据预演过期/清理/关闭自动清理；不真实删除已有用户资料。项目代码、模板与来源文档不混入客户数据清理。
- 更新本地结果和 Notion 摘要。取消、超时、有限局部修复仍有效；记录费用/耗时但不以其作为现阶段质量门槛。
- 按页面范围验证导航、表单校验和受控收件/线索读取。公开部署继续需要额外授权。

## 4. 职责和冻结审查

主负责人负责需求、范围、技术取舍、证据核验、最终文档与 Git 同步；Cursor Grok 4.6 High Fast 负责有明确范围的实现杂项、调研和独立模块验收。不可用时报告，不静默替换。不得多人同时改相同文件，不把整个目标一次交给实现者。

TodoWrite 保留完整计划和当前模块状态，不以任务清单勾选代替证据；每个模块必须完成“验收 → 单独 commit → push origin 当前分支 → 核对远端 SHA”。保护其他已暂存内容，不全量 add/reset，不 force-push、不推 upstream。

每个有结构或验收面变化的实现批次，冻结后调用一次匹配审查；文档整理不重复启动代码评审。出现阻塞先修拥有该问题的层，不用旁路、假成功或重复 API 绕过。

## 5. 变更与回退边界

- 现有未提交变更只在确认后的独立批次处理，不随文档整理被覆盖或回滚。
- 草稿 schema 迁移保留真实旧样本；缩减图片、主题或页面范围时，同步调整可生成卡片，不能前端承诺后端不支持。
- 新主题未达标时从可生成清单撤下而保留来源记录，不影响已有草稿；切模板、重生成和撤销遵守 revision。
- 当前渲染路线若不能提供所需版式，先记录实际失败再提交一个受控替代模板方案，保留后续原生 React 决策门，不在内部 Demo 同时维护两套完整引擎。
- 所有新资源在许可/运行/效果核验前保持候选；不安装整套 Skill 或市场镜像。

## 6. 当前模块：侧边栏模板交接（2026-09-16）

目标：落实侧边栏 `7f18c351-9e4d-4266-9658-9f28a5eea55e` 确认的模型意图/声明槽位边界、六套 submodule、静态快照、素材核验和浏览器验收。只处理这一模板模块，不混入未验收的 T2/T3/T4、CI/T1 或无关暂存修改。

现实门：**PASS（声明落点取代猜写的方向）**；不代表模板全部已验收。

- 观测：当前桥接先写 adapter 槽位，随后仍通过 `scopeBy`、卡片猜测和自动商品网格写入未声明内容；快照检测先接受 dist，SPA 空壳仍可能被误判。
- 实测：当前 typecheck 退出 0，27 tests 通过；在已运行 Docker 镜像的真实 `tailwind-landing` 预览注入 revision=91601 的独立测试资料，未声明 contact/product 仍被写入，生成网格数=1，报告 missingSlots=[]。截图 `template-baseline-undeclared-write-20260916.png`，浏览器工具保存位置另见执行证据。
- 预期：只有声明的唯一节点可变；未声明字段/集合保持原 DOM，报告 missing；覆盖不能按前缀或其他语言误计。
- 未知：四套构建/导出方式和每套素材权利，交由独立任务实测；失败不得用上游演示或截图伪装本地快照。
- 环境观测：本机 web/postgres/redis/mailpit 正在运行；只重建本项目 web，不执行 compose down，不删除数据卷或用户资料。

任务：
- [x] 读取侧边栏原对话，核对交接和真实错误，规则写入 AGENTS.md。
- [x] 声明单节点落点、真实覆盖报告、拒绝正则猜写，具备失败前/修复后证据；集合槽位只保留真实手写映射。
- [x] screwfast/fresh/forge 固定来源构建；tailwind-landing 源 HTML；Next 两套明确 blocked；SPA 不误报。
- [x] 六套新增模板代码/图片/字体/图标/商标完成独立审计；未核验项不准入生成物。
- [x] forge/screwfast/tailwind-landing 浏览器 bridge 验证；不存在的 contact 字段明确缺失，不制造节点假通过。
- [x] 完整 `typecheck/test/build`（45 tests 全绿）；重建 web；`--pull never` 启动并回读健康结果；dist/out 不提交。
- [x] 冻结候选并通过 Grok 4.6 High Fast 只读验收；准备仅模板模块提交推送 origin。

未完成且保留：
- [ ] `nextjs-landing` / `shadcn-landing2` 的 `output: export`：需要修改 submodule 源配置或另立受控方案。
- [ ] `shadcn-landing` SPA 预渲染：当前空壳且 lock 不一致，不改名为静态快照。
- [ ] 客户素材替换、notice 和服务端发布准入：素材报告只提供阻断清单，不是授权证明。
- [ ] 工作区 query 直达和发布路径的服务端模板/素材准入：当前 gallery/detail 是展示层门禁，不是安全边界。
- [ ] 更多页面与集合槽位：只在真实页面和手写映射完成后扩展。

## 6.1 当前模块：可选需求对齐与自动恢复

状态：核心会话流程已验收并提交 `7f2909bbe0514f19d5368b0493cfdb9e51217ef9`，已推送 `origin/main` 且远端 SHA 一致。首次冻结审查两项发现已修复，定向复核 `PASS`（`d1238e17-cdb9-442f-b117-667c009b708f`）。范围沿 P2；完整风格预览/视觉落地仍留在 P3，不以偏好文案冒充已应用设计。

- 现实门：`PASS`。沿用同一 Chat POST、会话 JSON/JSONB 和 `commitOperations`。原任务、模型澄清问题、已答选项与实际 operations 提案持久化；点选自动继续同一任务，确认只应用原提案。
- 红证据：连续两问复用 `needs-2/opt-2-1`；重复确认缺少工作台所需 changeSet；草稿提交后会话结果丢失导致恢复卡住；取消后的迟到 answer 仍送到 UI；取消丢弃已答内容；已保存偏好接受伪造 revision。各定向断言在修复前退出 1，修复后退出 0。
- 修正：问题 epoch 单调递增，确认 ID 全局唯一；重复提交匹配 ID/版本/选项/补充；取消保留已答内容，后续新任务清除旧任务答案；迟到结果不推进已取消状态。断流解析保留完整 SSE 帧，传输断开不改变已保存结果。
- 草稿提交边界：服务端确认 ID 写入现有 ChangeSet.id；文件锁/PG 行锁内先匹配收据再检查 revision。恢复先读草稿收据；若已经确认但尚未写稿，恢复继续同一受控提交，不重调模型、不重复改稿。四路同时恢复的文件存储反例通过。收据被历史裁剪后仍以 revision 冲突阻止旧方案覆盖，不能承诺无限历史恢复。
- 本地验证：定向 alignment/chat/provider/SSE tests 通过；`npm run typecheck` 0、`npm test` 66/66、`npm run build` 0。UI 静态源码断言只作补充，不替代浏览器证据。
- PostgreSQL 16.15：`node --check scripts/verify-alignment-postgres.mjs` 与 `node --experimental-strip-types scripts/verify-alignment-postgres.mjs` 均退出 0。旧 `{}` alignment/turn 保留、错误 site/workspace/缺失会话拒绝、10 路 select 只调模型 stub 一次、10 路 confirm 仅一个历史记录且 revision=2、提交收据恢复不重复写稿均通过；独立探针数据精确清理为 0。此脚本用模型 stub，不证明 DeepSeek。
- 真实浏览器与 DeepSeek：生产构建 `localhost:3011`，隔离 workspace `p2-browser-20260916`，同一会话 `8657ea8d-9adc-4f4e-867b-88259b7dc33e`。模拟企业任务先选择工业方向，模型返回两个标题选项；刷新恢复问题，点击“可靠零件，按需交付”，刷新恢复确认卡，确认后 v1→v2、history=1，iframe 首屏标题真实改变。第二个独立任务返回“获取报价/查看规格”而非旧标题问题；关闭并刷新仍 cancelled，revision=2，未提交第二个任务。
- 浏览器截图（本机证据，不含密钥）：`/var/folders/7v/58svbpnj5k91zdnm5zggb38h0000gn/T/cursor/screenshots/` 下 `p2-alignment-question-restored-20260916.png`、`p2-alignment-confirm-375-20260916.png`、`p2-alignment-applied-768-20260916.png`、`p2-alignment-applied-1440-20260916.png`、`p2-alignment-cancel-restored-20260916.png`。375/768/1440 状态检查通过，无横向溢出；截图证明交互/字段落点，不证明行业审美或素材授权。
- 已推送基线干净检出：`1c0d84fdda4081e3bb1bc3c6e376fe49bd2eb8b7` 的独立 worktree `npm ci`、typecheck、47 tests、build 均退出 0；不依赖当前未提交代码或密钥。
- 未验证/非本模块：完整历史消息恢复、多选问题、风格示意与独立风格入口、需求驱动多页、图片、12 组质量对照、表单收件均未完成；真实 DeepSeek 是单次路径证据，稳定性评测 `UNVERIFIED`。进程崩溃采用持久化状态故障注入，不声称做过真实 kill 故障演练；模型运行中服务器永久退出的自动重试未实现，可取消后重新提交，不自动计费重跑。
- 冻结审查发现并处理：首次只读验收发现恢复提交后工作台未采纳新 draft（P1）和撤销后旧收据误报 applied（P2）。P1 已在真实浏览器复现（顶栏 v2、聊天 v3）；修复为草稿加载完成后再恢复会话，并采纳恢复响应中的 draft。P2 定向 `after undo` 先红后绿，文件/PG 提交收据与当前 revision 不一致即 conflict，不再把撤销内容当当前应用。最终 typecheck 0、67 tests、build 0、真实 PG 探针再次通过。补充截图 `p2-recovery-stale-preview-red-20260916.png` 与 `p2-recovery-current-preview-green-20260916.png`：修复后顶栏/聊天均 v4，iframe 真实标题为“恢复验证：精密制造918”。
- Docker 最终候选 `build --pull=false web` 与 `up -d --pull never web` 成功；启动瞬间首次 health 请求 `ECONNRESET`，服务启动后回读 HTTP 200、status=ready、persistence.driver=postgres、database=ready。构建仍会访问镜像元数据/依赖边界，不据此声称离线可用。
- 不新增第二套 API、队列或模板/图片改造。CI/T1/tsconfig 等已有暂存内容继续保留，前后索引指纹 `ec1e63cd0dbaaa7283d3039c875c09d963d2a57e` 一致；模块只提交明确路径。
- 收尾：隔离浏览器 workspace 的 1 个会话与 1 个 site 已精确清理，剩余均 0；3011 验收进程停止，3000 Docker web 保留。GitHub 对 `7f2909b` 返回 check_runs=0、status=pending/total_count=0，未宣称远端 CI 通过；既有 CI workflow 仍是用户未提交暂存项。下一步补齐风格可见效果与需求驱动页面生成，不把本模块当整个 Demo 完成。

## 6.2 当前模块：主题方向到真实预览（2026-09-17）

状态：**部分完成**。主题卡片、版本化 `visualBrief`、兼容模板切换和后续模型上下文已落地；完整整站生成、图片和多页仍在 P3 后续范围。

- 现实门：`PASS（最小真实落点）`。用户卡片只提交固定 `briefId`；服务端从版本化 catalog 取 canonical brief，并以同一个 `set_visual_brief` operation 原子更新 `visualBrief` 与兼容 `templateId`，仍经 `commitOperations`、revision 和 undo/redo。
- 红证据：新增 operation 前测试无法让主题选择改变草稿；修复后 `site-operations` 断言通过。模型意图 union 明确拒绝 `set_visual_brief`，主题选择保持在用户可见入口，不让模型静默换主题。
- 真实浏览器与 PostgreSQL：隔离 workspace `p3-browser-20260917` 中，点击“外贸目录”后草稿 v1→v2、当前模板变为 `landwind`；切回“工业专业”后 v3、模板变回 `forge`；刷新后再次选择外贸目录为 v4，主题卡片与 iframe 状态均恢复。Landwind 截图显示紫色导航/宽版标题布局，Forge AX 树显示工业模板标题与服务内容，证明落点是实际模板而非摘要变化。
- 模型边界：`visualBrief` 会进入大草稿精简上下文，保留主题受众、摘要和主要行动；主题卡片使用的操作不进入 AI operation 白名单。未把“AI 推荐”或素材许可核验冒充已完成。
- 本地验证：`npm test` 68/68、`npm run typecheck` 0、`npm run build` 0；主题/模板定向测试与浏览器证据均通过。
- 限制：目前四个主题方向只是少量已审查模板的真实映射；部分模板仍依赖上游预览，Landwind/Forge 的内容槽位覆盖不等于整页生成完成；客户素材授权、图片规划、完整页面规划、12 组质量对照和独立 AI 推荐未完成。主题视觉证据为实现可达性，不代表审美人工评审通过。
- 收尾：本轮 PostgreSQL workspace 仅用于浏览器验收，结束前精确清理；Docker 正式工作台不受影响。CI/T1/tsconfig 和 `AGENTS.md` 的用户变更不纳入本模块提交。

## 6.3 当前模块：前端去 AI 味 Skill（2026-09-17）

状态：**规则已接入，效果评测未完成**。基于上游 `lieflat-less-ai-tone` MIT revision `27d29232f10124db904ca9c0536d0b67cb3b2833` 做前端窄化改编，Skill 位于 `skills/sitecraft-frontend-less-ai-tone/SKILL.md`，来源记录位于同目录 `SOURCE.md`，运行时约束位于 `lib/frontend-tone.ts`。

- 保留上游有证据的边界：白名单触发、信息守恒、结构不随意重排、未命中保持原文；没有把写作规则硬套成“所有渐变/卡片/字体都不许用”。
- SiteCraft 侧新增的规则关注层级、重复承诺、虚构指标/Logo/评价、无资料占位和 visualBrief 依据；通过现有模型 system prompt 消费，仍不允许模型直接输出或执行 CSS/HTML。
- 已核对项目内模板、视觉和许可研究；当前模板数量足够进入 3×4 质量对照，但只有少量模板路径具备稳定本地快照，演示素材仍需独立授权核验。
- 未完成：不同 Skill/流程组的 12 组截图对照、人工盲评、独立 AI 推荐、整站生成、多页和图片规划。规则接入不等于“去 AI 味”质量通过。

## 6.4 当前模块：质量对照前置修复（2026-09-17）

状态：**部分完成**。旧 v2 草稿与主题撤销已修好；Landwind 首屏声明槽位已能随两份独立模拟资料变化。这不是 12 组审美对照，也不是整站生成完成。

- 现实门：`PASS（对照前置）`。对照前必须保住已有草稿，并让外贸方向的 Landwind 首屏写入声明节点；缺少内容 adapter 时换主题仍会显示上游文案，不能进入 12 组对照。
- 红证据：缺 `visualBrief` 的 v2 草稿被 v1 迁移重建，revision 43→1、正文丢失；主题撤销按 catalog id 重放，旧 `signal` 映射被改成 `tailwind-landing`。Landwind 无 adapter 时，独立样本 A17/B84 无法写入首屏。修复前定向测试退出 1，修复后退出 0。
- 修正：`normalizeDraft` 对 `schemaVersion === 2` 只补缺失的 `visualBrief`，不重建正文；`set_visual_brief` 的 inverse 使用已有 `replace_draft` 恢复当时保存的模板与 brief。Landwind 手写唯一槽位：`companyName`、`hero.title`、`hero.subtitle`、`hero.cta`；联系邮箱保持 missing，并可提出改 `hero.cta`。未声明的后续标题不写入。
- 真实预览：隔离 `next dev --port 3012`，`GET /api/templates/landwind/preview` 返回 `X-Sitecraft-Preview-Source: local-open-source-snapshot`。浏览器 `querySelectorAll` 对四个声明选择器均为 1。样本 A「汉川精密阀业A17」与样本 B「北湾流体接头B84」先后写入后，品牌/标题/说明/按钮均不同；上游 “Building digital” 消失；未声明 h2 “Work with tools you already use” 保持原样。375 宽度无横向溢出。截图与 JSON 在 gitignored `artifacts/p3-readiness-20260917/`。
- 冻结审查：只读验收 `PASS`（`e702692f-0eb2-44d1-9602-b66df725ac71`）。审查方独立复测了 v2 保留、catalog 重映射撤销和真实预览双样本；实现侧测试只作泄漏检查，不是唯一 oracle。
- 本地验证：`npm run typecheck` 0；`npm test` 73/73；`npm run build` 0。
- 限制：只覆盖 Landwind 首屏文本，不含图片、后续功能区、多页或工作台整条生成旅程；上游演示图和“600 million users”等文案在 workspace 变体中仍可见，published sanitize 未在本轮浏览器验收。Docker 守护进程本次未运行，正式 `localhost:3000` 镜像未重建。CI/T1/`tsconfig` 与 `AGENTS.md` 的既有改动不纳入本模块。12 组质量对照、Forge 以外模板的同等内容落点、需求驱动页面仍未完成。

## 6.5 当前模块：同一资料换主题的首屏对照（2026-09-17）

状态：**部分完成**。同一份受控草稿可以落到 Forge 和 Landwind 的声明首屏，布局确实不同；换一份独立资料后正文也不同。这不是 12 组流程对照，也不是整站生成或审美通过。

- 现实门：`PASS（主题对照）`。Forge 本地快照 `vendor/open-source-templates/small-bis/dist/index.html` 中 `data-testid="hero-text"` / `intro-text` 均为 1；Landwind 首屏槽位上一模块已核验。对照只走已有 `commitOperations` 内核 `applySiteOperations` 与预览 bridge，不新增模板 API。
- 红证据：把 Forge `hero.title` 选择器改成不存在的 `hero-text-missing` 后，定向测试仍看到上游 “Main Keywords”，退出 1；恢复选择器后退出 0。
- 契约：工业方向保持 `forge`，外贸方向切到 `landwind`，正文不丢；Forge 没有品牌名和主按钮槽位，这两项记 missing，不猜写；Landwind 未声明 h2 “Work with tools you already use” 保持原样；Forge 未声明 “LOGO” 保持原样。
- 真实预览：隔离 `next dev --port 3013`，两个模板的 `GET /api/templates/{id}/preview` 都返回 `X-Sitecraft-Preview-Source: local-open-source-snapshot`。样本 A「汉川精密阀业A17」和样本 B「北湾流体接头B84」分别写入后，Forge 为全幅照片叠字，Landwind 为紫导航/宽标题/插画；同资料截图哈希不同，同模板换资料哈希也不同。375 宽度下 Forge 的 `scrollWidth === clientWidth`。证据在 gitignored `artifacts/p4-theme-compare-20260917/`。
- 冻结审查：只读验收 `PASS`（`d77719b9-b12c-4514-aeb3-18891d65404c`）。审查方用 vendor 快照、截图哈希和 `applySiteOperations` 内核复测，不把伪造 DOM 片段当作布局 oracle。
- 本地验证：定向测试先红后绿；`npm run typecheck` 0；`npm test` 76/76；`npm run build` 0。
- 限制：未走工作台 `demo` 站点或 DeepSeek 整段生成；Forge 服务卡/联系槽位未纳入本轮对照；Landwind 下游演示图、Figma 按钮和 “600 million users” 仍在 workspace 变体中可见。Docker 正式镜像、CI/T1/`tsconfig`/`AGENTS.md` 既有改动、12 组质量对照和需求驱动多页均未完成。

## 7. 模块收据

- `rules-and-plan`：commit `533954ba3bdc0e78413d3ff1482068877a2d0c58`，已 push 到 `origin/main`；规则模块经 Cursor Grok 4.6 High Fast 只读复审通过。
- `rules-receipt`：commit `0438780c45deec720b7effaaedcaa4b83786fefc`，已 push 到 `origin/main`；记录规则模块收据和下一模块。
- `workspace-chat-bridge`：commit `626e9435d903460248d6c13a71cfbe060f3db474`，已 push 到 `origin/main`；`typecheck`、22 tests、`build` 通过，真实 `/workspace` answer 显示和 localStorage 会话 ID 刷新保留通过，Grok 只读复审 `PASS`。范围仅为工作台 conversationId 往返、answer/clarify 展示和 clarify 选项回填。
- `workspace-chat-bridge` 限制：完整历史 GET、对齐状态机、PostgreSQL 实测、真实模型稳定 clarify 未在本模块完成，不能标作已完成。
- 下一模块：核验并决定现有 T2/T3/T4 后端变更的保留/修正范围；完成后另建单独 commit 并 push。
- `p0-chat-backend`：commit `a1899899e3a93003aa68a9ccab4807e9de92fd56`，已 push 到 `origin/main`；包含会话文件/PG 路径、意图三态、上下文精简、Chat SSE、工作台 conversationId/answer/clarify 和持久化失败一致性修复。
- `p0-chat-backend` 验证：typecheck 0、47 tests、build 0；真实 PostgreSQL 单轮读写与 10 路并发探针通过；真实 Docker DeepSeek answer/clarify 单次探针通过；探针数据已清理。
- `p0-chat-backend` 限制：完整历史 GET、可选需求对齐状态机、真实模型稳定性评测、PostgreSQL 持久化失败的 live 外部故障仍未覆盖；UI 警告测试使用 route 反例和静态控制流，不声称完整浏览器 UI 证据。
- `template-preview-contract`：commit `230d00b7845905a34003b75695d25dfb97cb6704`，收据 `1c0928fdd778cba079d8fc3744696847d13e8829`，已推送 `origin/main`；对应的是声明槽位/加载器/候选展示，不代表所有静态导出和素材准入完成。
- `template-preview-contract` 验证：`npm run typecheck` 0；`npm test` 45/45；`npm run build` 0；Docker `build --pull=false web` 0；`up -d --pull never web` 后 health ready。修复前后浏览器反例见交接文档；未声明字段不会写入，missing 不会消失。
- `template-preview-contract` 限制：nextjs-landing/shadcn-landing2 无 export，shadcn-landing 是 SPA 壳；六套演示素材仍需替换/授权，gallery 的入口门禁不是服务端发布安全边界；这些不随本提交标为完成。

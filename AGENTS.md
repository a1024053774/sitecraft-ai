<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# SiteCraft AI 项目规则

## 当前项目目标

本项目先交付一个内部技术 Demo：使用模拟的工业、设备、零部件、外贸 B2B 和相邻行业资料，生成可预览、可修改、可验收的网站。重点是行业适配、视觉差异、事实可信、预览可见和可恢复的对话流程。生成按「样子 → 同族模块 → 声明槽位」三层落地，细则以 `docs/project/mainline.md` 为准。

长期目标可以扩展为客户自助生成/复制/导出平台，因此模板、图片、字体、图标和区块必须按平台级许可边界审查；普通客户交付许可不能直接推导为生成器许可。

## 需求与开发前门禁

1. 开始功能前先读取：`docs/project/mainline.md`、`docs/project/intent.md`、`docs/project/spec.md`、`docs/project/plan.md`、`.grilling/ACTIVE.md` 指向的会话记录。用户提起主线、reality-first 或 `/grilling` 时先对照主线，避免在局部实现里换方向。
2. `spec.md` 或 `plan.md` 未经项目负责人确认时，只做文档、只读调研和必要的基线核验，不新增业务功能。
3. 需求对齐应优先通过产品选项表达：用户选择风格/主题/行业方向，不选择内部 Skill 名称。
4. 项目聊天中的可选需求对齐必须是可恢复状态：选项通过结构化请求保存，Agent 使用同一会话继续；不能要求用户复制 AI 输出或手动发送“继续”，不能用无限保持的 HTTP 请求等待用户。
5. 所有设计选择必须能落到 `visualBrief`、模板能力/slot map 或白名单 operation；只改 prompt 文案而不改变可见结果不算完成。
6. 页面规划以“用户明确要求 → 模型依据业务需求规划 → 无法确定时首页/产品服务/联系”排序；默认三类页面不是页面数量或类型上限。用户要求的页面无法支持时必须说明，不得静默缩成首页。
7. 删除须由用户明确选择；系统不得替用户主动删除对话、草稿、上传或站点。不实现 90 天自动清理，也不保留可暂停的自动清理开关。已发布站点仍由用户控制，不得静默删除。
8. 新模板和 Skill 需逐项核验来源、版本、许可和实际效果；资源调研不等于安装或准入。

## 变更边界与 PR #4

- 以自己的 fork `a1024053774/sitecraft-ai` 为主线；不得向 `upstream` 推送。
- `hlanan886/sitecraft-ai#4` 只按能力竖切参考，不整体 merge、批量 cherry-pick 或搬运其全量 dist。
- 现有未提交代码是用户已有工作。编辑前先查看 `git status` 和 diff；不得覆盖、回滚或重排无关变更。
- 所有草稿修改必须经过 `commitOperations`；Skill、模型、bridge、测试夹具不得旁路写草稿。
- 不为未来功能预置平行 API、兼容层、空 schema、双渲染器或 speculative abstraction。

## 模板意图、落点和就绪边界

- 模型负责理解请求并产生受控意图/操作；预览只执行版本固定的声明槽位，不在每轮调用模型猜 DOM。
- adapter 是可审查的数据（选择器、目标、属性和必要集合映射），不存每模板可执行 JS 字符串；使用一个共享预览引擎。
- 只向唯一且符合声明的节点写入；未声明、未命中或有歧义均报告 `missing`，不按标题正则、元素顺序或通用卡片形状猜写。
- features/services/products 集合只有手写且经实际模板核验的映射才能修改；不得为填满页面自动追加通用商品网格。
- `covered/applied` 只来自实际成功落点；`fallbackMatched` 只记录实际采用的回退，不把没有 adapter、上游演示或截图当作精确命中。默认关闭正则写稿，必要的例外须明确范围、证据与用户授权。
- 固定文本清理、HTML 安全处理或路径校验中的正则不属于意图识别；清理演示内容也不得冒充草稿字段应用。
- submodule 源码、构建后的静态 HTML、浏览器实测、素材许可和可生成状态分别记录。SPA 的空 `index.html`（包括 dist 中的空壳）不是静态快照；代码 MIT 不批准图片/字体/商标。
- Docker 本地已有镜像时可用 `--pull never` 启动；改源码后需重建 web。镜像缓存、构建依赖、模板网络资源是不同边界，不能据镜像启动成功宣称整个应用离线可用。

## Grok 代理分工

委派统一使用 **Cursor Grok 4.6 High Fast**；不可用时报告阻塞，不静默改用其他模型。进度用 **TodoWrite** 跟踪当前模块，不使用原生 Goal 工具。

Grok 可处理：

- 有明确文件范围的实现杂项；
- 模板/开源资源/许可证/技术栈清单调研；
- 独立模块的测试和验收准备；
- 冻结候选后的只读结构/行为验收；
- 研究报告、基线记录和本地文档整理。

主负责人负责：需求、规格、架构取舍、资源准入、跨模块集成、风险判断、最终验收和 Git 提交/推送。委派任务必须说明输入、允许修改的文件、禁止范围、命令、验收条件和回报格式。多个代理不得同时修改相同文件。

## 验收与证据

每个独立功能完成后必须：

1. 保留失败证据或明确说明未覆盖的外部边界；
2. 运行相关测试，再运行 `npm run typecheck`、`npm test`、`npm run build`；
3. UI/预览功能必须做真实浏览器截图和状态检查；截图一致不等于审美通过；
4. 生成质量必须区分机器否决项、浏览器证据和人工评审；模型自评不能作为唯一美观 oracle；
5. 关键外部路径（DeepSeek、PostgreSQL、文件存储、表单收件）未实测时标为 `UNVERIFIED`，不声称已完成；
6. 结构风险或验收面改变时，在冻结候选上调用一次匹配的审查流程，不重复刷审查。

机器否决项至少包括：事实只能来自用户资料或“待补充”、提问不改 revision、非法 target/index/SKU 不静默错改、注入不改变系统规则、fallback 不冒充精确 slot、来源与许可可追溯。

## Git 提交与 GitHub 同步

每个独立功能完成并通过验收后，必须单独提交并推送到自己的 GitHub fork：

1. 提交前确认只包含本模块文件，检查暂存区与未暂存差异；不得 `git add -A` 混入用户工作，也不得为方便提交清空或重排无关暂存内容。必要时使用显式路径的单模块提交。
2. 业务模块提交前运行目标测试与全套 `typecheck/test/build`；纯文档/规则模块执行文本、链接、敏感信息和范围核验，不宣称业务已验收。
3. 提交一个可读的单模块 commit，不把多个未验收模块混在一起。
4. 推送前核对 `origin` 为 `a1024053774/sitecraft-ai`，再推送当前工作分支；绝不推送 `upstream`，不 force-push。
5. 回读远端分支 SHA 与本地 commit 对照，记录 commit、分支、验证命令和未解决限制。
6. GitHub CI 未完成时不能声称远端门禁已通过；推送失败时保留本地 commit 并报告，不绕过认证。

## 密钥、环境与资源

- 项目使用本地 `.env.local`；密钥只存在被 gitignore 的本地文件，不进入代码、文档、prompt、SSE、截图或提交。
- 当前环境来源已从 `env.md` 映射到 `.env.local`；不创建软链接，不复制原始 `env.md` 到项目。
- 生成物默认只接受来源、版本和再分发许可可核验的 MIT/Apache 资源；图片、字体、图标、商标和演示素材必须分别核验。
- 用户提供的 `resources/` 是研究资料，不是运行时 Skill 自动加载目录；每个资源要经过版本、许可、执行方式和效果验证。

## 多语言文本和文档

保留中文用户文案、任务书、注释和现有提示词的 UTF-8 内容；窄改优先，不做无关格式化、全文件重写或标点归一化。对文档和 prompt 的宽改要检查 diff 中的乱码、替换字符、BOM 和换行变化。

## 完成定义

“功能完成”同时要求：需求契约满足、实现路径可达、针对性失败证据已处理、相关测试通过、必要的浏览器/外部证据已取得、冻结候选已审查、单功能 commit 已创建并推送到 `origin`。缺少其中一项时使用“部分完成/未验证”，不要用代码存在或测试数量替代验收。

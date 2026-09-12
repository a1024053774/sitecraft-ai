# AI 对话与自然语言建站局部优化调研

- 日期：2026-09-03
- 场景：中文企业资料匹配英文开源模板、生成高质量初稿，并在工作台通过 AI 对话局部微调
- 方向：产品 / AI 生成 / 模板槽位 / 流式体验 / 对抗性验收
- 置信度：6（本项目确定性测试通过；真实 provider 与本次 Playwright 对抗运行未完成）
- 层级：复合
- 状态：部分验证
- 复用量：0

## 问题

项目采用 DeepSeek 单模型、结构化 `SiteOperation`、真实模板 iframe 和 SSE。当前主要风险是中文输入对英文模板的语义匹配、真实 provider 延迟、初稿事实与布局质量，以及工作台 AI 修改的目标和权限边界。

## 借鉴方案

1. [Duda AI-ready templates](https://developer.duda.co/docs/building-ai-ready-templates)：保持模板结构和布局不变，只填充受支持元素；不支持的组件跳过但不破坏页面；通过模板占位内容和能力清单指导生成。适合复用为 `TemplateManifest` 和槽位前置约束。
2. [Vercel AI SDK structured data](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)：`streamText` 的结构化输出可使用 Zod/JSON Schema；结构化流的部分对象未必满足完整 schema，完整数组元素可用 element stream。适合参考 provider 层，但不替换本项目的业务 SSE 事件协议。
3. [Vercel AI SDK useChat](https://ai-sdk.dev/docs/ai-sdk-ui/use-chat)：transport、状态和恢复能力可参考；本项目已有 `status/done/conflict/need_confirmation` 业务状态，迁移不是当前优先事项。
4. [Crystallize Page Builder pattern](https://github.com/CrystallizeAPI/ai/blob/main/use-crystallize/skills/content-model/references/page-builder-pattern.md)：固定区块类型、稳定内容块 ID、布局 token 和多语言结构分离；适合参考稳定槽位、重复项 ID 和 localized structure。

## 关键决策

- 不引入 WebContainers 或任意代码生成；项目非目标是自由 HTML/CSS/JS，真实模板 iframe 已是正确预览边界。
- 不为通用 JSON renderer 重写 `SiteDraft`；先完善模板语义、槽位和 `SiteOperation`。
- 中文输入先归一化为行业、受众、站点类型、风格和能力，再做候选模板评分；模型只在白名单候选中排序和解释。
- 首稿按首屏/核心转化路径优先交付，慢请求告警与硬截止分离；自评不阻塞首稿。
- 工作台一次用户请求默认作为一个逻辑事务；高风险操作确认后再提交。

## 搜索策略

- GitHub：按 stars、pushed_at、许可证筛选 JSON UI、流式 SDK、预览沙箱和结构化输出项目。
- Exa：搜索官方文档和生产案例，关键词包括 AI-ready templates、structured output、streaming UI、page builder pattern。
- agent-reach doctor 未返回后端状态；抖音/小红书本次未验证，不以无来源内容替代。

## 验证记录（证据链）

- `[test]` `npm test`：223/223 通过。
- `[test]` `npm run typecheck`：退出码 0。
- `[test]` `npm run build`：退出码 0，Next.js 16.3.1 生成 14 个页面。
- `[test]` 本次组合 Playwright（生成、工作台、观测、模板预览）运行卡住，未生成最终报告；随后单独运行工作台 spec 仍卡住，已终止遗留进程，不能标记前端对抗验收通过。
- `[read]` 项目账本已有 2026-09-02 的 E-007/E-009/E-011/E-012 浏览器专项通过证据，但不覆盖本次新增的完整对抗清单。
- 未验证：真实 DeepSeek P50/P95、跨用户权限隔离、恶意输入/XSS、双标签并发、抖音/小红书经验。

## 落地版（如已落地）

尚未改动运行代码。下一次实施应优先处理 F-011、稳定 `itemId/targetId`、字段前置值冲突、模板能力前置约束、修改差异展示和分片 Playwright 对抗套件。

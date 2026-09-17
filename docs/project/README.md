# SiteCraft AI 项目文档入口

本地保存需求、规格、计划和证据；Notion 只同步方向、计划、资源摘要。主线见 [mainline.md](./mainline.md)。2026-09-17 Round 15 写入样子/模块/Jiro 配方与模型名。

## 当前文件

- [mainline.md](./mainline.md)：核心主线；样子 → 同族模块 → 声明槽位；模型名；jiro 用法；防漂移。
- [intent.md](./intent.md)：已记录的产品需求、Q17/Q18 和执行授权。
- [spec.md](./spec.md)：v0.4 规格；样子盘、同族模块、可选内嵌对齐、需求驱动页面和数据边界。
- [plan.md](./plan.md)：v0.6 短计划；按手头快照分类的样子、Jiro 配方用法、Skill 收口和下一步。
- [AGENTS.md](../../AGENTS.md)：项目规则、Cursor Grok 4.6 High Fast 分工、模块验收/提交/推送流程。
- [Notion 摘要](https://app.notion.com/p/3dbfaa7adad8810c8a12e58e4b79ce42)：主要方向与进度，不存密钥或完整日志。

## 资料归属

- `../plan/` 与 `../tasks/`：历史规划和原始 T1–T26 任务书，保留追溯，不覆盖当前确认需求。
- `../research/`：路线、质量与资源研究；建议不等于已准入或已验收。
- `../../resources/`：用户提供的原始调研，不自动作为产品运行时 Skill 加载。
- `../baseline/`、`../spikes/`：特定时间/版本的实测记录，不能代替当前端到端验收。
- `../../.grilling/ACTIVE.md`：已确认的需求会话指针；保存问题历史与阶段状态，不复制产品规格。

每个独立模块验收后单独 commit 并推送到自己的 `origin` fork；既有未验收代码先核验，不混入文档提交。公开部署需要额外授权。

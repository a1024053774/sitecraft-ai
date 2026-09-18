# 来源与改编

SiteCraft 叠加层。通用规则在 `skills/frontend-less-ai-tone/`。运行时只注入 `lib/frontend-tone.ts` 的 `sitecraft-frontend-less-ai-tone@0.3.0`。不要另写一套规则。P4 冻结基线仍是 `@0.2.0`。

目录里的 `LICENSE.txt` 是文案层上游的 MIT 副本，不是样子层的许可证，也不批准任何模板图片、字体、图标或商标。

## 文案层

- 来源：https://github.com/larashero3-dotcom/lieflat-less-ai-tone
- 钉死 revision：`27d29232f10124db904ca9c0536d0b67cb3b2833`
- 许可：MIT（`LICENSE.txt`，Copyright shiujan）
- 项目内对应：Codex `chinese-document-writing` 的保真写法
- 采用：事实守恒、不编造、不整页顺手润色、不靠机械句式黑名单丢信息
- 不用：把上游全文当生成 prompt

## 样子层

- 来源：https://github.com/anthropics/skills/tree/main/skills/frontend-design
- 参考钉死：`41bbe19d1a1a7eaab5e7bb9050a417e5c6cffc8f`（2026-09-03 树）
- 许可：Apache-2.0（上游技能目录 `LICENSE.txt`，不在本目录覆盖 MIT 副本）
- 采用：先做方向盘、对照 brief 检查是否像「给谁都那一套」、一个记忆点、少动效
- 本叠加层不用：模型写 CSS/HTML、任意指定未授权字体、现场发明 DOM。通用前端任务以 `skills/frontend-less-ai-tone/` 为准。

## 否决与底线（不主控审美）

- 常见 AI 界面破绽目录：https://github.com/claudiusararu/unslop-ui-skill （MIT，作 veto，不把示例皮肤当新默认）
- 可访问性/表单/动效底线：https://github.com/vercel-labs/web-interface-guidelines （MIT）；agent-skills 包装仓库不要当许可证来源去跟 `main`

## 运行时

- 规则子集：`lib/frontend-tone.ts`
- 注入点：`lib/ai-provider.ts` 的生成 system prompt
- 用户选项不得出现本 Skill 名称；测试钉在 `tests/frontend-tone.test.ts`

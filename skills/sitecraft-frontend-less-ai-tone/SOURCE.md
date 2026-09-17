# 来源与改编

本 Skill 是项目内合成，不把上游全文塞进运行时 prompt。

## 文案层

- 来源：https://github.com/larashero3-dotcom/lieflat-less-ai-tone
- 钉死 revision：`27d29232f10124db904ca9c0536d0b67cb3b2833`
- 许可：MIT
- 项目内对应：Codex `chinese-document-writing` 的保真写法；SiteCraft 只保留事实守恒、不编造、不整页顺手润色

## 样子层

- 来源：https://github.com/anthropics/skills/tree/main/skills/frontend-design
- 参考钉死：`41bbe19d1a1a7eaab5e7bb9050a417e5c6cffc8f`（2026-09-03 树）
- 许可：Apache-2.0（技能目录 `LICENSE.txt`）
- 采用：先做方向盘、对照 brief 检查是否像「给谁都那一套」、一个记忆点、少动效
- 不用：模型写 CSS/HTML、任意指定未授权字体、现场发明 DOM

## 否决与底线（不主控审美）

- 常见 AI 界面破绽目录：https://github.com/claudiusararu/unslop-ui-skill （MIT，作 veto，不把示例皮肤当新默认）
- 可访问性/表单/动效底线：https://github.com/vercel-labs/web-interface-guidelines （MIT）；agent-skills 包装仓库不要当许可证来源去跟 `main`

## 运行时

- `/Users/luckye/Documents/Code/sitecraft-ai/lib/frontend-tone.ts`
- 本记录不批准任何模板图片、字体、图标或商标

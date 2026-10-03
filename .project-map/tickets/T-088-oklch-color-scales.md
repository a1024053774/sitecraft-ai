---
id: T-088
title: 用 OKLCH 把种子色展开成完整色阶，替换自定义品牌色的 HSL 算法
type: build
status: open
blocked_by: [T-084]
claimed_by:
supersedes:
---

## What to build

依据 [R2 调研](../../docs/research/前端收藏调研-2026-10-03/R2-color-sets.md) 第 4、6 节。不新增用户可选的色彩集。

- 新增 `lib/color-scale.ts`：HEX ↔ OKLCH、超出 sRGB 时降低彩度、从种子色生成中性色和主色色阶、角色分配（background / surface / text / muted / border / diagram / tint / accent / accentStrong / accentSoft），逐项检查 WCAG 对比度（正文、次要文字、白字按钮），找不到达标档时拒绝并给出原因。不新增依赖。
- `lib/custom-brand-color.ts` 改用它生成自定义品牌色色板，保留 source / sourceColor / 调整说明，撤销行为不变。输出仍是现有的 token 角色字段，`TemplateKitTokens` 不加新字段；只有出现第二个真实使用者时才加色阶数据。
- 现有 24 套色板（6 套色彩集 × 4 个样子）数值不变，回归测试保证。

## Acceptance

- [ ] 测试先写，并在父提交上能加载、在断言处失败：用 R2 的 S007、S021、C16 和 3 个难色（很浅的黄、很亮的绿、接近黑的蓝）当输入，正文 ≥ 4.5:1、白字按钮 ≥ 4.5:1；无法达标时返回拒绝原因而不是静默改色；现有 24 套色板不变
- [ ] 工作台输入 3 个自定义品牌色，四个样子 × 1440 / 768 / 375 截图存 `artifacts/t088/`，每张打开看过；三家 `check-published` 通过
- [ ] `npm run typecheck`、`npm test`、`npm run build` 通过；代码审查通过；Claude 验收

## Resolution

---
id: T-025
title: 自定义品牌色
type: build
status: open
blocked_by: [T-020, T-022]
claimed_by: astra
supersedes:
---

## What to build

用户输入一个主色，或从上传的 Logo 里取色，由固定规则生成整套色板（不让模型写 CSS），并检查对比度；对比度不够时自动调整，并告诉用户做了调整。入口在工作台的「配色」按钮里。

## Acceptance

- [ ] 输入 3 种有代表性的颜色（很浅、很深、高饱和），生成的色板都通过对比度检查
- [ ] 从一张 Logo 取色得到的主色合理
- [ ] 应用后可以撤销
- [ ] 相关测试、`npm run typecheck`、`npm test`、`npm run build` 通过；新测试在改动前的代码上先失败
- [ ] 独立审核 agent（不是做这张票的 agent）验收通过，结论记在 Resolution

## Resolution

实现：新增固定的 `generateCustomPalette` 规则，接受主色或 Logo 采样色，生成背景、表面、正文、次文字、强调、强调深、浅底和边框等完整色板；强调色逐步压暗直到白字对比度达到 4.5:1，并把是否调整及原因保存到 `customPalette.adjustmentNote`。新增 `set_custom_palette` 白名单 operation，撤销恢复上一份自定义色板；选择预设色彩集会清除自定义色板。预览引擎优先读取草稿自定义色板，页面仍走同一个 adapter/bridge。

红态：`node --test --experimental-strip-types tests/custom-brand-color.test.ts` 在实现前因缺少 `lib/custom-brand-color.ts` 失败。

新鲜证据：`node scripts/check-custom-brand-color.mjs artifacts/t025-brand-green2` 返回 `PASS`。脚本用 Logo 来源的浅色 `#f4fbff` 真实写入草稿、读回调整说明和色板、调用历史撤销确认 `customPalette=null`，再应用后读回发布壳并跑 1440/768 工作台截图；同一报告还对浅色、深色、高饱和三种主色检查正文与白字按钮均达到 4.5:1。截图已查看：`artifacts/t025-brand-green2/workspace/workspace-1440.png`、`artifacts/t025-brand-green2/workspace/workspace-768.png`。

相关检查：`npm run typecheck` 通过；`npm test` 250/250 通过；`npm run build` 通过。

实现提交：待提交后填写 SHA。

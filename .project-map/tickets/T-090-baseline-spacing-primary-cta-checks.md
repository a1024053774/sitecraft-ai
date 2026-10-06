---
id: T-090
title: 按区块声明检查基线对齐、组间距和每页一个主按钮
type: build
status: open
blocked_by: [T-089]
claimed_by: t090-fix
supersedes:
---

## What to build

依据 [R4 调研](../../docs/research/前端收藏调研-2026-10-03/R4-rules-skills-prompts.md) 第 B、6 节。检查按区块变体的声明判定，不扫描全页去猜。

- `lib/blocks/catalog.ts` 的变体可声明：基线组（同一行里字号不同、应沿基线对齐的文字节点）、语义组（哪些节点同属一组）、按钮角色（primary / secondary）。没有声明的变体不检查，并在报告里列出「未声明」。
- `scripts/render-block.mjs`（区块进库）和 `scripts/check-published.mjs`（发布页）：声明的基线组在三档宽度的适用范围内基线差 ≤ 2px；同一语义组内间距小于组与组之间的间距；每页可见的 primary 按钮最多一个，按钮文字是具体动作（不接受「了解更多 / Learn More」这类空泛文案）。[T-114](T-114-mobile-footer-layout.md) 明确 `footer:line` 在 375px 单列，不要求跨行同基线；768/1440px 保留同基线。手机须记录不适用依据并检查间距、断行和溢出。
- 现有变体逐个补声明；补声明后检查不过的是真实缺陷，修区块，不放宽。

## Acceptance

- [x] 测试先写，并在父提交上能加载、在断言处失败：基线错 4px 失败、组内间距大于组间距失败、一页两个 primary 失败、空泛按钮文案失败、未声明的变体报「未声明」而不是通过
- [ ] 全部已进库变体三档跑区块进库检查、三家 `check-published` 中英文三档通过，报告存 `artifacts/t090/`
- [ ] `npm run typecheck`、`npm test`、`npm run build` 通过；代码审查通过；Claude 验收

## Resolution

**INCOMPLETE。** 区块进库检查、字形重叠测量的修复已提交并通过独立代码复审；375px 双列的独立视觉否决尚待 T-113 按负责人选择的 T-114 单列方案处理，暂不关票。

- `c464084` 把共享声明扫描器接入真实 `render-block.mjs` CLI，违规输出非空测量并退出非零；修正最小组间距 0 被覆盖。父版的漏接、32.16px 基线差与间距反例保留在 `artifacts/t090/20261006-accept/`、`artifacts/t090/20261006-fix/red-verified.log` 和 `red-footer.log`。旧固定13站基线测量为0的绿报不能代替变体覆盖。
- `89a0ae5` 改为按实际字形墨迹测文字重叠，保留同节点压缩与不同节点叠放检查。2026-10-06 在 `f53dc1eaf3466ee499f2ae95e3f2f8df4676a286` 下，全部41变体逐一运行原版 `node scripts/render-block.mjs`，三档中英文共246组合全部通过；原始完整命令、输入和报告在 `artifacts/t090/20261006-fix/admission-f53dc1e/`。旧11变体误报保留在同级 `admission-e422fc7/`，未换 case。
- 独立 Astra 进一步发现 CSS uppercase 与原始小写测量不一致，原反例保留在 `artifacts/t090/20261006-review-geometry/`。`ff615e30a1066f092d7d4cb90b6e09461e9e62cc` 修复后 focused 24/24；2026-10-06 06:02:54Z 完成的独立相关测试9/9、退出0，报告 `artifacts/t090/20261006-review-uppercase/review.md`。命令为指定 Chrome 路径下的 `node --test --experimental-strip-types --test-name-pattern='T-090 real render-block geometry measures' tests/t090-root-causes.test.ts`；压缩反例退出1，正常行距退出0。
- 集成基线 `f53dc1e` 的 `npm test` 839/839、typecheck、build以及固定13站原版发布检查39/39（每行含中英文）均通过；完整命令、UTC和原始日志在 `artifacts/integration/20261006-f53dc1e/`。这些不冒充后续 T-113 候选的全量结果。
- 独立视觉报告 `artifacts/acceptance/20261006-visual-f53dc1e/review-output/review-with-product-scope.md` 指出375px长文本双列拥挤；T-114已定手机单列、平板和桌面保留≤2px同基线。最终按响应式声明重新检查、独立复审和视觉验收后再勾选。

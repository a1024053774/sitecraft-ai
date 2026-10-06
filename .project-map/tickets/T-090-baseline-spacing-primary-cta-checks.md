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
- `scripts/render-block.mjs`（区块进库）和 `scripts/check-published.mjs`（发布页）：声明的基线组在三档宽度下基线差 ≤ 2px；同一语义组内间距小于组与组之间的间距；每页可见的 primary 按钮最多一个，按钮文字是具体动作（不接受「了解更多 / Learn More」这类空泛文案）。
- 现有变体逐个补声明；补声明后检查不过的是真实缺陷，修区块，不放宽。

## Acceptance

- [x] 测试先写，并在父提交上能加载、在断言处失败：基线错 4px 失败、组内间距大于组间距失败、一页两个 primary 失败、空泛按钮文案失败、未声明的变体报「未声明」而不是通过
- [ ] 全部已进库变体三档跑区块进库检查、三家 `check-published` 中英文三档通过，报告存 `artifacts/t090/`
- [ ] `npm run typecheck`、`npm test`、`npm run build` 通过；代码审查通过；Claude 验收

## Resolution

2026-10-06 UTC：根因修复已实现，focused 通过；完整进库覆盖、独立复审和主控验收仍为 INCOMPLETE，暂不关票。

- 独立 Astra 在基线 `ebc97b3691dd43493f28c3ebb5893d6ae81d4685` 发现三个可复现缺陷：`render-block.mjs` 漏接声明检查，手机 `footer:line` 基线差 32.16px，以及三组布局中有效的最小组间距 0 被后续非零间距覆盖。原始审查、CLI 成功却缺测量的报告和截图保留于 `artifacts/t090/20261006-accept/review.md` 及同目录。
- `t090-fix` 修复范围为 `scripts/render-block.mjs`、`scripts/visitor-layout-scan.js`、`lib/blocks/fragments/contact.ts` 和 `tests/t090-root-causes.test.ts`。区块 CLI 复用共享扫描器，保存中英文声明测量、缺失落点和未声明状态，违规返回非零；最小间距单独初始化以保留 0；页脚响应式布局满足原有 2px 基线门槛，不删除声明或提高阈值。
- `artifacts/t090/20261006-fix/red-verified.log` 记录间距与真实 CLI 漏接红测，`red-footer.log` 记录 375px 页脚红测；初次夹具缺路径的失败另行保留，不计为缺陷证明。
- 2026-10-06 的 focused 命令为指定 `CHROME_PATH`、`SITECRAFT_BASE=http://127.0.0.1:3034` 下的 `node --test --experimental-strip-types tests/t090-root-causes.test.ts tests/t090-layout-declarations.test.ts`。`green-independent.log` 为 14/14、退出码 0，包含八项独立 CLI 场景。原审查的 footer CLI 复验见 `original-footer.log`，三档中英文基线差均为 0.16px，文字重叠、横溢、事实缺失均为 0。以上是提交前工作树候选证据，最终验证须绑定合并后的运行时代码提交。
- 固定 13 站在修复前的发布检查为 39/39、每行含英文结果，报告在 `artifacts/t090/20261006-accept/published/`；其基线测量为 0，不能代替全部 41 变体的原版进库检查。最终源码冻结后由主控协调完整变体检查和一次全量/typecheck/build，独立 Astra 复审及页脚视觉检查完成前不勾剩余验收项。

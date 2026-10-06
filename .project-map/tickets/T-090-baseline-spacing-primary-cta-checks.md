---
id: T-090
title: 按区块声明检查基线对齐、组间距和每页一个主按钮
type: build
status: closed
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
- [x] 全部已进库变体三档跑区块进库检查、三家 `check-published` 中英文三档通过，报告存 `artifacts/t090/`
- [x] `npm run typecheck`、`npm test`、`npm run build` 通过；代码审查通过；Claude 验收

## Resolution

**PASS，2026-10-06 主控验收关闭。** 最终运行时代码为 `0ad88aa0cb232e5d439dadae0d062e527bd2302a`。手机口径由负责人在T-114明确选择；本票不包含T-112照片清晰度或T-115行业说明取舍。

- 真实区块CLI复用共享声明扫描器，声明违规必须有实际失败测量且退出非零；最小组间距0不再被当初始化值。字体重叠按真实绘制字形测量，CSS uppercase与字面大写等价，压缩同节点和不同节点叠放仍拒绝。原漏接、32.16px基线差、间距0及字形误报/漏报证据保留于 `artifacts/t090/20261006-accept/`、`20261006-fix/` 与 `20261006-review-geometry/`，未覆盖。
- 最终41个已进库变体逐一执行 `node scripts/render-block.mjs --block <block> --variant <variant> --cases <cases.json> --out <render>`，1440/768/375中英文共246组合全部exit0。沿用原f53输入；完整逐条命令、UTC、退出码、声明与非空测量在 `artifacts/t090/20261006-fix/admission-0ad88aa/report.json`。4项适用基线实测、2项375页脚明确不适用、462项语义组间距和246项主按钮测量；没有把不适用当测量PASS。批次命令为设定Chrome路径及3034后运行 `node --experimental-strip-types artifacts/t090/20261006-fix/admission-0ad88aa/run.mjs`。
- 源图自查完成：246个PNG包含125个不同画面，全部不同画面逐张打开，121个逐像素相同文件记录复用关系；未见空白、载入态、误截、丢底或文字覆盖。逐文件记录在 `admission-0ad88aa/visual-selfcheck/results.json`，07:36:52Z完成。短尾行/孤立句号等观察如实保留，这不是新的审美评分。
- 固定13站发布检查39/39（每行含英文）和三包带图18视图通过；分别见 `artifacts/integration/20261006-0ad88aa/published-13/` 与 `artifacts/t112/final-0ad88aa/`。78张固定站原图的全部原尺寸区域已查看，完整性自查在前者 `visual-selfcheck/`；三包原版图也已自查。
- 同一SHA的 `npm run build`、`npm run typecheck`、`npm test` **887/887**通过，测试于07:15:08Z结束；完整命令/UTC/退出码在 `artifacts/integration/20261006-0ad88aa/`。独立Astra对uppercase的先前结论在 `artifacts/t090/20261006-review-uppercase/review.md`；本轮对响应式缺目标的真实CLI反例、有效N/A、桌面≤2px及有关增量复审PASS在 `artifacts/t113/independent-0ad88aa/review-result.json`。
- 独立视觉已确认D压力页脚三档可读，375单列、768/1440同排符合已确认要求；报告 `artifacts/acceptance/20261006-reading-ce7df9d/frozen-review/review.md`。0ad对该视觉候选只改检查器和测试，页脚绘制代码未变。报告的行业语义重复总体NO_GO保持原样，由T-115处理，未冒充整页审美通过。

---
id: T-113
title: 修复生成页重复正文、拥挤署名和手机页脚
type: build
status: open
blocked_by: []
claimed_by: page-reading
supersedes:
---

## What to build

处理独立视觉审核中可直接归因于展示的缺陷：图片署名挤在页脚导航列，名称和正文仅差句号的内容重复，开发标记遮挡联系信息，以及手机页脚长文本被双列挤断。使用现有视觉 token、声明节点和唯一预览桥；不编文案、不翻译用户只提供一种写法的公司名，不把模拟邮箱当成需更换的产品缺陷。

手机页脚按已关闭的 [T-114](T-114-mobile-footer-layout.md) 选择 A：375px 公司名在上、联系方式在下；768/1440px 保留真实同基线，偏差 ≤2px。基线声明与现有手机 CSS 断点 `max-width: 480px` 一致，从 481px 起适用；手机保留报告条目，明确不适用及断点依据，检查真实间距、行长/断行和溢出。截图底部须按页面实际高度核对，不能把截图截断直接当页面裁切，也不能把截断截图当完整证据。

## Acceptance

- [ ] 图片作者、许可和来源链接保留且在独立区域清楚可读，三档中英文无覆盖或挤压
- [x] 名称与说明完全重复的条目只显示一次有效内容，真实不同说明保留；事实检查与实际落点仍成立
- [ ] 最终访客截图没有开发标记遮挡，截图底部完整；手机长公司名、邮箱和电话可读且通过独立视觉审核
- [ ] 按负责人确认的响应式口径验证声明、间距和溢出；相关红绿测试、完整测试及独立代码审查通过

## Resolution

**INCOMPLETE（总验收）**：实现及 focused 证据已冻结，等待主控统一检查、不同 Astra 实例代码审查及独立视觉审核；未获授权执行全量测试/build、commit 或 push。本次候选基于 `ff615e30a1066f092d7d4cb90b6e09461e9e62cc` 的未提交工作树，源码清单、副本和显式范围 diff 在 `artifacts/t113/freeze/manifest.json`。

已实现：署名沿唯一声明节点移到独立全宽区域，逐项显示完整 credit、真实 attribution（含修改说明）、精确 licenseUrl 与原 sourceUrl；不改 API、许可政策或图片资料。同一条目只在首尾空白及至多一个末尾 `。`/`.` 的精确定义内合并标题/正文，两字段各有真实可见 DOM 落点，事实预期数量保留。开发标记使用 Next 16.3.1 本地官方 `devIndicators: false`。截图等待实际 iframe 重排与页脚稳定，记录页/iframe/PNG 几何，截断或开发标记进入失败报告。

T-114 选择 A 已实施：375 单列，实际组间距 16px、字号 ≥14px、无溢出；基线条目保留为 `not-applicable`，`delta/pass` 为 null，报告 481px 起适用的依据。768/1440 中英文真实基线偏差均 0.16px，上限仍 2px。邮箱所有位置继续同一 `emailBreakPoints`；压力输入的 @ 前整段实测 346.46px、整行 343px，必要强制断行按既有例外记录，没有新增 hyphen 断点。

2026-10-06 UTC 的 focused 验证（各产物时间在 freeze manifest，以下命令均在本仓库执行）：

- **PASS**：`node --test --experimental-strip-types tests/t113-page-reading.test.ts tests/quality-process.test.ts tests/published-facts.test.ts`，20 项；`artifacts/t113/after/focused-reading-final.log`。相同字段/句号、首尾空白、大小写/内部空白/问叹号/型号/范围/单位边界、原事实丢失、实际双落点及完整 credit 均覆盖。
- **PASS**：`node --test --experimental-strip-types --test-name-pattern='T-113 footer line|T-113 baseline applicability|three semantic groups' tests/t090-root-causes.test.ts`，3 项；`artifacts/t113/after/phone-A.log`。使用 approved Chrome、3034；六张压力截图、真实区块 CLI 和 480/481 边界报告在 `artifacts/t113/after/phone-A/`。
- **PASS**：`node --test --experimental-strip-types tests/t113-published-credit-collector.test.ts`；`artifacts/t113/after/real-credit/` 保存原三站真实 GET、collector 报告、运行命令及18张中英文三档截图。逐 imageId 验证完整署名、修改说明和原始许可/来源链接；A/B/C 事实预期分别仍为 114/44/43，缺失均 0。18张原图和6张压力图均已打开；自查不代表审美通过。
- **PASS**：`node --test --experimental-strip-types --test-name-pattern='real render-block CLI rejects|geometry measures glyphs' tests/t090-root-causes.test.ts`，18 项；`artifacts/t113/after/declaration-negatives.log`。保留缺落点、基线/间距/主按钮负例及 ff615e3 uppercase、压缩、叠放行为。
- **PASS**：`node --test --experimental-strip-types tests/block-catalog.test.ts tests/t090-layout-declarations.test.ts`，11 项；`artifacts/t113/after/catalog-declarations.log`。
- **PASS**：`npm run typecheck` 和 `git diff --check`；`artifacts/t113/after/typecheck-final.log`。

浏览器命令环境为 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell`、`SITECRAFT_BASE=http://127.0.0.1:3034`；各输出目录环境变量和精确命令见 freeze manifest，可用新输出目录重现，不覆盖旧证据。

红信号保留于 `artifacts/t113/before/`：重复正文/导航内署名、完整 credit、真实 GET 修改说明缺失、手机 A 及“不适用”被 CLI 误判失败。原 B-zh-375 截断和异步重排几何在 before/after probe 中保留；未把它判为网页自身裁切。`artifacts/t113/counterfactual-02/` 对旧 f53dc1e、宽泛标点判等和丢失来源三个已知坏候选均退出 1。原独立视觉否决 `artifacts/acceptance/20261006-visual-f53dc1e/review-output/review.md` 完整保留。

主控所有的 MAP/mainline/spec/AGENTS、T-090/T-109/T-114 文档和自动生成 next-env.d.ts 未由本员工覆盖；project-map 无结构问题，仍报告 AGENTS 的旧 Verified 对 scripts/check-published.mjs 陈旧，交主控冻结时处理。中文原公司名及 `.test` 邮箱未改，外部送达不测。

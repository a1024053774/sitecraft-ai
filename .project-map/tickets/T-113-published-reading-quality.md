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

**INCOMPLETE（总验收）**：初版已提交为 `ce7df9d6e287f1c60ec5cef07dda3b1d7d1c1484`，构建/typecheck通过，全量为851项849pass/2fail。独立Astra发现手机不适用分支漏验目标、同署名图片误配来源两项P2，原NO_GO保留在 `artifacts/t113/independent-ce7df9d/review-result.json`。两项P2与两项旧测试假设已完成针对性修订，等待统一冻结、完整复验及增量复审；不推送、不关票。

页面的独立阅读审核已逐张查看24图：页脚压力场景375单列、768/1440同排，署名可读性、截图底部和无开发标记均通过，精确去重范围内未发现可见失败。整体阅读仍为NO_GO，剩余两项是工业/外贸行业说明的语义重复，超出本票精确判等规则，已交 [T-115](T-115-industry-description-redundancy.md) 等负责人决定；原文保持不变。报告与原图在 `artifacts/acceptance/20261006-reading-ce7df9d/frozen-review/`。

本轮修订让有效选择器和可见目标检查先于响应式不适用；署名以整条文字与来源/许可URL联合匹配。DOM唯一性不再计入CSS文本，正文覆盖从输入字段与稳定slot推导，保留完整文本、原可读性门和两份T103原始夹具。`artifacts/t113/rework-ce7/freeze/manifest.json` 记录两项P2有效红、DOM红及19项逻辑/6项浏览器/真实GET绿；T103专用证据在 `artifacts/t113/t103-coverage-fix/`。初版源码与工作树证据仍在 `artifacts/t113/freeze/`，其中 `commit-binding-ce7df9d.json` 证明11文件与初版提交一致。

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

MAP/mainline/spec/AGENTS及相关票由主控整合；源码作者未覆盖其他员工文件或自动生成的next-env.d.ts。中文原公司名及`.test`邮箱未改，外部送达不测；最终关闭前由主控核对project-map和实际冻结提交。

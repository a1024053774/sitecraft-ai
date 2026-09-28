---
id: T-047
title: 灰底短路径桌面版的字号和留白
type: build
status: closed
blocked_by: []
claimed_by: grok-a
supersedes:
---

## What to build

2026-09-28 第二轮盲评（`artifacts/blind-20260928-r2/review-result.md`）7 PASS、1 NO_GO。NO_GO 的 R4 是灰底短路径 + 模拟工业包（站点 `543a6783-7b9a-437b-99c5-39b93a53e72a`）：「1440 整页内容和文字都明显偏小，首屏、产品、应用、加工、询盘之间留下大块空白…375 像把桌面版整体缩小」。Kiro 在 1440 下看到（`artifacts/t047/technical-1440-00.png`、`-01.png`）：

- 产品卡里的参数行只有约 11px（速比范围 / 额定输出扭矩 / 中心距），其他三个样子是有标签列和数值列的参数表；
- 首屏没有照片时，右半边整块空着（工程工业在同样情况下显示黑色参数铭牌）；
- 产品卡里「全部参数（5 项）」「询这款规格」像没加样式的默认文字；
- 应用行业、加工能力卡只剩标题，卡片很高很空；各区块上下内边距约 82px。

只改灰底短路径的 overlay（`lib/template-adapters/overlays/tailwind-landing.index.html`），需要新的声明位置时在 `lib/template-adapters/registry.ts` 的 tailwind-landing adapter 里加，复用预览桥已有的首屏参数铭牌和参数表渲染，不写新的渲染逻辑。不改另外三个样子。

## Acceptance

- [x] 1440 下产品参数至少 14px，按标签 / 数值两列排；「全部参数」「询这款规格」有明确的链接或按钮样式
- [x] 没有首屏照片但有产品参数时，首屏右侧显示参数铭牌；两者都没有时首屏不留半边空白
- [x] 只有标题的目录卡更紧凑，区块间距收紧到和其他样子相近；375 不是缩小的桌面版（单列、字号正常）
- [x] 相关测试、`npm run typecheck`、`npm test`、`npm run build` 通过；新测试在改动前的代码上先失败
- [x] 灰底短路径的两个样本站（`543a6783-…`、`7809b283-07ae-4254-9f75-272ce53e0e2d`）和 `palette-sample-technical-graphite` 跑 `check-published` 通过，1440 / 768 / 375 截图打开看过
- [x] 另一个 harness 的审核 agent 验收通过，结论记在 Resolution；之后交 Codex 盲评

## Resolution

2026-09-28 18:01（UTC-4）。灰底短路径接上已有的首屏铭牌钩子：没有照片但有参数时右侧是铭牌，两者都没有时网格收成一列。产品参数改为 14px 的标签 / 数值两列，「全部参数」「询这款规格」用链接样式。目录卡收紧，区块内边距改为 64px。375 目录和产品单列，铭牌改成整行标签加数值。

红态（17:50）：`node --test --experimental-strip-types tests/technical-desktop-density.test.ts` 失败，overlay 没有 `data-sitecraft-section="hero"`，exit 1。

绿态：同一命令通过。`npm test` 315/315、`npm run typecheck` 通过（17:55）。`npm run build` 通过（18:01）。

`node scripts/check-published.mjs --out artifacts/published-check/t047 543a6783-7b9a-437b-99c5-39b93a53e72a 7809b283-07ae-4254-9f75-272ce53e0e2d palette-sample-technical-graphite` 9/9 通过（17:58–18:01，exit 0）。看过 1440：没有照片的两站右侧是参数铭牌，graphite 右侧是产品照片；参数行是两列，链接是蓝色加号和箭头。375 铭牌是四行「标签 / 数值」，目录卡单列。

实现提交：本 commit。

跨 harness 审核：

独立审核：Kiro，2026-09-28 18:10，PASS（`a386a8a` 之后新跑）。1440：两个没有照片的站首屏右侧是参数铭牌，graphite 样板是产品照片；产品参数 14px，标签 / 数值两列；「全部参数」「询这款规格」是蓝色链接；区块内边距 64px；只有标题的目录卡变矮（`artifacts/t047-review-kiro/543a6783-1440-*.png`）。375：正文 16px，产品卡 343px 单列，铭牌逐行，没有横向溢出（`543a6783-375-00.png`）。`node scripts/check-published.mjs --out artifacts/published-check/t047-review-kiro 543a6783-7b9a-437b-99c5-39b93a53e72a 7809b283-07ae-4254-9f75-272ce53e0e2d palette-sample-technical-graphite` 9/9 ok；`npm test` 315/315。已把这三个站匿名后交 Codex 盲评（`artifacts/blind-20260928-r3/`）。


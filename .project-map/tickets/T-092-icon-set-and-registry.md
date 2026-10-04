---
id: T-092
title: 自制第一批区块图标和图标注册表（联系、认证）
type: build
status: closed
blocked_by: [T-084]
claimed_by: rs-iconfont
supersedes:
---

## What to build

依据 [R5 调研](../../docs/research/前端收藏调研-2026-10-03/R5-icons-fonts.md) 3.1–3.3 节。只做图标数据，不改区块 HTML/CSS（接入在 [T-093](T-093-contact-certification-icon-variants.md)）。

- **规范**：参考 Cursor 图标文章的方法定一份短规范——24px 网格、描边粗细、端点和圆角、光学修正、一概念一图标的概念表。工程工业样子需要直角端点的变体时在规范里写明。
- **来源**：Lucide（ISC，工作台已在用）里有的概念直接取它的路径并保留 ISC 声明；Lucide 没有的（例如认证证书、检测报告、出口资质）由执行者按规范自己画。负责人给的 Amicons、Smallbits 只是风格参考，不描摹、不复制它们的路径或文件。
- **注册表**：新文件 `lib/blocks/icon-registry.ts`，每个图标存 id、语义、viewBox、路径、默认尺寸、来源与许可；模型只能选 id，不能提交 SVG、路径或 URL。
- 第一批只覆盖联系（邮箱、电话、地址、表单提交）和认证（证书、检测报告、资质状态）需要的概念，并出一张 16 / 20 / 24px 的预览图。

## Acceptance

- [x] 测试先写，并在父提交上能加载、在断言处失败：每个图标有来源和许可字段；注册表拒绝未登记的 id；路径只含 SVG 几何命令，不含文字、外链或脚本
- [x] 16 / 20 / 24px 预览图（浅底、深底各一张）存 `artifacts/t092/`，打开看过；独立审核 agent 看过预览图和参考作品，确认风格一致、小尺寸可辨认、自画图标不是参考作品的描摹
- [x] `npm run typecheck`、`npm test`、`npm run build` 通过；代码审查通过；Claude 验收

## Resolution

2026-10-03 14:03 EDT，Codex rs-iconfont：

- 新增 `lib/blocks/icon-registry.ts`：联系 4 个 Lucide 0.511.0 图标（Mail、Phone、MapPin、Send）保留 ISC 声明；认证 3 个自画证书/检测报告/出口资质图标；认证状态使用 Lucide BadgeCheck、Clock3、CircleX。注册表只接受登记 id，记录语义、24px viewBox、几何记录、16/20/24 尺寸、来源和许可；规范记录圆角/直角端点、1.75px 笔画、3 单位光学间隙和一概念一图标。
- 新增 `tests/icon-registry.test.ts`。红测命令（父提交桩行为）输出保存于 `artifacts/t092/red.txt`，断言在空注册表/错误规范处失败；实现后 `node --test --experimental-strip-types tests/icon-registry.test.ts` 通过 6/6。
- 预览命令从 registry 读取数据生成 `artifacts/t092/icon-preview-light.svg`、`icon-preview-dark.svg` 及 PNG；参考图 `reference-smallbits.png` 只在 artifacts 中，来源 `https://smallbits.design/images/og.png`，未进入仓库。两张 PNG 已打开检查。
- 预览已由执行者打开检查；独立审核 agent 尚未看过，故该勾选项保持未勾选。
- `npm run typecheck` PASS；`npm run build` PASS。`SITECRAFT_BASE=http://localhost:3054 CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test`：649 通过、11 失败，完整日志为 `artifacts/t092/npm-test.log`；失败来自 vendor 快照缺失、模板资产缺失、健康检查超时/503 和既有 workspace motion 检查，未归因于本票 registry 测试。因完整测试未全绿，状态保持 open，代码审查和 Claude 验收未勾选。

2026-10-03 14:35 EDT 复核与修复：

- 在 3054 启动 dev server，`curl http://localhost:3054/` 返回 200；重新执行全量 `npm test`，日志为 `artifacts/t092/npm-test-2.log`：660 tests，658 pass、1 fail、1 cancelled。vendor 快照/资产不再失败；唯一断言失败是 T-077 已知不稳定的 workspace motion，另一个 alignment-card 在全量运行中 180 秒超时。
- alignment-card 逐条核对：当前提交单测复跑通过，证据为 `artifacts/t092/alignment-card-isolated-2.log`；父提交 `fc25b37` 的同一测试也通过，证据为 `artifacts/t092/parent-alignment-card-2.log`。因此全量超时/先前 1px 波动属于测试运行环境/无头浏览器稳定性，不归因于本票；没有修改 `tests/helpers/workspace-browser.ts`，没有手动结束 Chrome。
- 预览根因是临时渲染器把 24px viewBox 按 32px 单元平移（`x/y - 32 * scale`），并把首行图标中心放在顶部标签附近；已改为按 24px viewBox 居中（`x/y - 12 * scale`）并下移首行，标签不再压图标。注册表的三个自画图标同时扩大到接近 3–22 的光学边界；出口资质重画为明确的文件 + 外箭头，16px 可辨认。
- 重新生成并打开：[浅色预览](../../artifacts/t092/icon-preview-light.png)、[深色预览](../../artifacts/t092/icon-preview-dark.png)；`node --test --experimental-strip-types tests/icon-registry.test.ts` 6/6 PASS；`npm run typecheck` PASS；`npm run build`（日志 `artifacts/t092/build-2.log`）PASS。独立审核仍未完成，状态保持 open。

2026-10-03 18:29 EDT，按独立审查报告 `T-092-review-1.md` 修复：

- 第一批十个图标统一使用圆端点和统一 1.75px 笔画；`futureEngineeringLineCap: "square"` 只作为以后工程工业变体的规范记录，本票不启用。自画证书、检测报告、出口资质图标继续使用统一圆端点和较疏的几何。
- Lucide ISC 许可记录补齐 Cole Bemis/Feather 与 Lucide Contributors 两组版权归属，链接固定到 `https://raw.githubusercontent.com/lucide-icons/lucide/0.511.0/LICENSE`；测试断言两组归属、固定链接和 round cap。
- 几何测试对所有字符串字段统一走命令/数字/分隔符白名单，`polyline.points` 单独收紧为数字分隔符，并加入 path/polyline 坏实现回归断言；定向测试 7/7 PASS。
- 通过指定命令 `/Users/luckye/Documents/Code/sitecraft-ai/artifacts/research/threads-2026-10-03/briefs/fulltest.sh /Users/luckye/Documents/Code/sitecraft-ai-t092 3054 artifacts/t092/npm-test-3.log`：661/661 PASS、0 fail、0 cancelled。`npm run typecheck` PASS；`npm run build` PASS（`artifacts/t092/build-3.log`）。
- 重出并打开：[浅色预览](../../artifacts/t092/icon-preview-light.png)、[深色预览](../../artifacts/t092/icon-preview-dark.png)；参考图仍只在 `artifacts/t092/reference-smallbits.png`。独立审核和 Claude 验收仍未完成，票保持 open。

### 当前状态（2026-10-03 18:39 EDT，Claude 验收）

- 独立审查（rs-ui，未参与实现）：第一轮 `REVISE`（圆/直角端点混用、Lucide ISC 归属不全、几何字段白名单不全），报告 `artifacts/research/threads-2026-10-03/reviews/T-092-review-1.md`（在 sitecraft-ai 主工作区）；第二轮 `PASS`，报告 `reviews/T-092-review-2.md`，含对浅/深预览与 Amicons、Smallbits 公开参考的对照：十个图标笔画一致、16px 可辨认、自画图标不是参考作品的描摹。
- 证据都在 `db54cf4` 之后重新生成：全量 `npm test` 661/661（`artifacts/t092/npm-test-3.log`，经 `fulltest.sh`），`npm run build` 通过（`artifacts/t092/build-3.log`），浅/深预览 18:25 重出。
- Claude 验收：并入主线 `2a1fd65`（合并提交 `7d66af8`）后，`tests/icon-registry.test.ts` 7/7、`npm run typecheck` 通过，`project_map.py status` 无问题、无过时 living doc。本票只新增注册表数据，没有改区块 HTML/CSS；接入在 T-093。历史段落里的 open/未完成描述是当时状态，以本段为准。

---
id: T-092
title: 自制第一批区块图标和图标注册表（联系、认证）
type: build
status: open
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
- [ ] 16 / 20 / 24px 预览图（浅底、深底各一张）存 `artifacts/t092/`，打开看过；独立审核 agent 看过预览图和参考作品，确认风格一致、小尺寸可辨认、自画图标不是参考作品的描摹
- [ ] `npm run typecheck`、`npm test`、`npm run build` 通过；代码审查通过；Claude 验收

## Resolution

2026-10-03 14:03 EDT，Codex rs-iconfont：

- 新增 `lib/blocks/icon-registry.ts`：联系 4 个 Lucide 0.511.0 图标（Mail、Phone、MapPin、Send）保留 ISC 声明；认证 3 个自画证书/检测报告/出口资质图标；认证状态使用 Lucide BadgeCheck、Clock3、CircleX。注册表只接受登记 id，记录语义、24px viewBox、几何记录、16/20/24 尺寸、来源和许可；规范记录圆角/直角端点、1.75px 笔画、3 单位光学间隙和一概念一图标。
- 新增 `tests/icon-registry.test.ts`。红测命令（父提交桩行为）输出保存于 `artifacts/t092/red.txt`，断言在空注册表/错误规范处失败；实现后 `node --test --experimental-strip-types tests/icon-registry.test.ts` 通过 6/6。
- 预览命令从 registry 读取数据生成 `artifacts/t092/icon-preview-light.svg`、`icon-preview-dark.svg` 及 PNG；参考图 `reference-smallbits.png` 只在 artifacts 中，来源 `https://smallbits.design/images/og.png`，未进入仓库。两张 PNG 已打开检查。
- 预览已由执行者打开检查；独立审核 agent 尚未看过，故该勾选项保持未勾选。
- `npm run typecheck` PASS；`npm run build` PASS。`SITECRAFT_BASE=http://localhost:3054 CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test`：649 通过、11 失败，完整日志为 `artifacts/t092/npm-test.log`；失败来自 vendor 快照缺失、模板资产缺失、健康检查超时/503 和既有 workspace motion 检查，未归因于本票 registry 测试。因完整测试未全绿，状态保持 open，代码审查和 Claude 验收未勾选。

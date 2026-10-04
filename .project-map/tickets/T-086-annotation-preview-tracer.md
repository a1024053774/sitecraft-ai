---
id: T-086
title: 预览上点选批注，到模型只改这一处、能单独撤销
type: build
status: open
blocked_by: [T-085, T-081]
claimed_by: codex-t086
supersedes:
---

## What to build

在 [T-085](T-085-annotation-contract-store-undo.md) 的契约和存储上，打通工作台画板的批注全线。T-081 合回主线后再从主线拉分支（两边都改 `preview-bridge.ts`）。

- **预览桥**（`lib/template-adapters/preview-bridge.ts`）：批注模式下显示透明捕获层和悬停描边；点选只命中已声明的 `data-sitecraft-slot`，回报 slot、目标相对矩形、文字快照、视口、语言、revision；拖框回报完整包含在框内的全部 slot。草稿或页面变化后按 slot 唯一查找重新定位：命中 1 个为 attached，0 个为 stale，多于 1 个为 ambiguous，不按文字或顺序猜。
- **iframe 消息**（`components/open-source-template-frame.tsx`）：批注消息带会话标识和类型版本校验，iframe 重载后恢复批注模式。
- **工作台**（`app/workspace/page.tsx` 加新的批注组件）：批注按钮、输入框、当前页批注列表、标记点和脱离状态；1440 侧栏、768 窄侧栏或底部抽屉、375 底部抽屉且默认点选。
- **交给模型**（`lib/ai-provider.ts`）：批注作为不可信的定位上下文传入，模型只返回白名单 operation，经 `commitOperations` 提交；目标 stale 或 ambiguous 时要求用户重新指定，不提交；修改摘要只来自实际落点（T-070）。

## Acceptance

- [x] 测试先写，并在父提交上能加载、在断言处失败：点中的产品卡在其他产品删除或重排后仍指向原产品；目标消失时显示 stale 且模型不提交；圈中多个目标时未指定主目标不允许修改
- [x] 端到端（真实 DeepSeek，工作区自己的 dev 端口和 `SITECRAFT_BASE`）：1440 / 768 / 375 各走一次「点产品卡 → 写一句批注 → 模型只改这张卡 → 单独撤销 → 后续改同一处后再撤显示冲突」，截图和批注、修改记录 JSON 存 `artifacts/t086/`，每张截图打开看过
- [x] spec.md、CONTEXT.md 与实现一致；`npm run typecheck`、`npm test`、`npm run build` 通过；[ ] 代码审查；[ ] Claude 验收

## Resolution

2026-10-04（America/New_York），`t086-annotation-preview`。实现了预览桥批注捕获与唯一槽位重定位、session/typeVersion iframe 协议、工作台三档批注抽屉、可信边界上的 AI 定位上下文、attached/stale/ambiguous 提交门和选择性撤销 API。产品卡按 `data-sitecraft-product-id` 与 `products.<productId>` 稳定寻址；型号索引表保留 specs 槽位唯一命中。

证据：`node --test tests/t086-annotation-tracer.test.ts tests/preview-failure.test.ts` 通过；`artifacts/t086/fulltest-r3.txt` 为 774/774；`artifacts/t086/typecheck-r3.txt`、`artifacts/t086/build-r3.txt` 通过；`artifacts/t086/annotation-check-r3.json` 为三档 attached PASS，截图 `annotation-r3-1440/768/375.png` 已打开；`artifacts/t086/real-chain-r2.json` 为三档 `model=ai / undo=applied / manual=applied / conflict=conflict`，冲突目标非空，截图与批注记录在 `artifacts/t086/real-*.png`、`real-sites-r2.json`；`artifacts/t086/modification-real.json` 为真实 DeepSeek `deepseek-flash` applied revision 4；旧的未配置失败和第一轮 no-op 证据分别保留在 `modification.json`、`real-chain.json`。

12 站发布检查 `artifacts/t086/mainline-r3.log` / `mainline-r3-incomplete.json` 标为 INCOMPLETE：首两个站点连续等待英文 locale 超过 15 分钟，未生成 `report.json`；仅中断自己的 runner shell，未杀 Chrome。原始 fulltest 773/763/10 仍在 `fulltest.txt`，vendor 补齐后的中间 771/2 在 `fulltest-r2.txt`，对应失败归因为协议源代码断言和可见开发标签，已在 r3 清零。

后续根因修正（基于 `829b8d1`）：`sitecraft:locale` 与 `sitecraft:inquiry` 也带 `typeVersion` / `sessionId`，并有 bridge 回归测试；旧的 visitor-error 源码断言改为检查实际错误映射，不泄露内部协议词。验收脚本移入 `scripts/check-t086-annotation.mjs`、`scripts/check-t086-real-chain.mjs`，只用 isolated world 读槽位和矩形，实际点击走 CDP `Input.dispatchMouseEvent`；`artifacts/t086/annotation-check-pointer.json` 三档 PASS，`artifacts/t086/real-chain-pointer-r2.json` 三档均 `model=ai / undo=applied / manual=applied / conflict=conflict`。协议定向测试 44/44、`fulltest-protocol-r1.txt` 775/775、`typecheck-protocol-r2.txt` 和 `build-protocol-r2.txt` 通过。12 站仍沿用 `mainline-r3-incomplete.json` 的 INCOMPLETE 结论，未重新运行。

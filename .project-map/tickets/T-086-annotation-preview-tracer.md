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

2026-10-04（America/New_York），合并复验完成。合并提交为 `37758d84a33749ef20eadfdca8eac8813a94c702`（短 SHA：`37758d8`）；冲突只保留 T-086 批注协议/真实点击修复，并采用主线的 `getExistingSite` 语义。未改 `lib/blocks/catalog.ts` 或 T-108 内容。

本次证据均绑定合并 HEAD `37758d84a33749ef20eadfdca8eac8813a94c702`：

- `npm run build` 清理 `.next` 后通过，证据：`/Users/luckye/Documents/Code/sitecraft-ai-t086/artifacts/t086/build-merge-rerun-clean.txt`；首次旧缓存失败证据保留在 `build-merge-rerun.txt`。
- `npm run typecheck` 通过，证据：`/Users/luckye/Documents/Code/sitecraft-ai-t086/artifacts/t086/typecheck-merge-rerun.txt`。
- `fulltest.sh` 在隔离端口 3071、`SITECRAFT_BASE=http://127.0.0.1:3071` 下真实退出 0，795/795 通过，首行绑定 HEAD，证据：`/Users/luckye/Documents/Code/sitecraft-ai-t086/artifacts/t086/fulltest-merge-rerun-3071.txt`。
- 13 站主线复验真实退出 0：`mainline-rerun-3071/report.json` 为 39 rows、13 sites、375/768/1440、0 failures、0 INVALID；证据目录：`/Users/luckye/Documents/Code/sitecraft-ai-t086/artifacts/t086/mainline-rerun-3071/`，运行记录首行绑定 HEAD。
- 主工作区站点目录已强制复制到 worktree，源/目标均为 7091 个 JSON；复制记录：`/Users/luckye/Documents/Code/sitecraft-ai-t086/artifacts/t086/mainline-rerun-3071/copy.log`。
- 3070 启动/复验失败证据保留：`/Users/luckye/Documents/Code/sitecraft-ai-t086/artifacts/t086/fulltest-merge-rerun-bootstrap.txt` 与 `dev-3070.log`。失败原因是 3070 server 未持续运行/共享 Next lock；随后改用隔离 3071 完成通过复验。英文 locale 未复现 timeout。

未完成项：代码审查、Claude 验收仍待独立执行。

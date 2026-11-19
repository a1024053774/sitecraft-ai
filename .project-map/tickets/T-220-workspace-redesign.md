---
id: T-220
title: 按 T-219 重做首页、新建流程和修改工作台的界面
type: build
status: closed
blocked_by: []
claimed_by: Devin
supersedes:
---

## What to build

按 [T-219](T-219-workspace-redesign-direction.md) 的决定改界面，不改生成路径、提交入口、检查、版本和接口。

- **统一外观**：首页、站点列表、设置页和工作台共用一套「分步工单」样式（灰纸、黑线、方角，青瓷蓝只标当前步骤和选中项）。去掉侧栏；「内容与商品」占位页和「团队协作」入口删除。
- **首页**：上次改的站点、全部站点一张表（每行写明做到五步里的哪一步、当前版本、下一步动作）、五步说明、四种风格的真实示例、模型接口状态。不放假数据。
- **新建流程**：第一版生成前不显示空白预览，资料、风格、大纲、生成各占整屏；顶部步骤条写明每步定下了什么。大纲按页拆成条目。生成时写明阶段。
- **修改工作台**：预览加右侧「修改单」（对话、待发送批注、已保存批注），顶栏按钮带文字，预览宽度叫电脑、平板、手机，删除收进「更多」。
- **批注时切画布**：点选、圈选或批注浮层打开时切换成炭黑画布样式，预览占满，右侧只留修改清单；退出批注回到修改单。

不做：
- 不改生成站代码、提交入口、检查、事实出处、版本与恢复的行为。
- 不新增接口；不删除现有功能入口（英文版、资料出处、版本历史、下载、撤销、图片、模拟资料包）。

## Acceptance

- [x] 首页、站点列表、设置、工作台在 1440 / 768 / 375 下不横向溢出，截图逐张看过
- [x] 新站点在第一版生成前依次看到资料、风格、大纲、生成四步整屏页面，步骤条状态正确
- [x] 有版本的站点进入修改步；点「批注」后切到画布样式，退出后恢复
- [x] 现有 data-testid 与测试依赖的 class 保留，相关浏览器测试通过
- [x] `npm run typecheck` 通过
- [x] spec 工作台一节、CONTEXT 术语与代码一致

## Resolution

2026-11-19（UTC），随本票提交，Linux 开发机，分支 `devin/1795091783-workspace-redesign`。独立审查还没做，等负责人安排审查实例。

- `lib/code-site.ts` 新增 `codeSiteSteps`、`codeSiteStep`，`lib/code-site-store.ts` 的列表项带 `progress`（步骤、版本号、页数、检查、英文、任务失败）；都从已保存记录推出，不新增存储字段和接口。
- 新增 `components/app-topbar.tsx`、`components/site-progress.tsx`；首页、`/sites`、`/settings`、`sites-table`、`local-site-list`、`provider-settings` 改成分步工单样式。删除 `components/app-sidebar.tsx` 和 `/content` 占位页。
- `components/code-workspace.tsx`：顶栏按钮带文字、「更多」菜单、五步步骤条、第一版前各步标题与生成阶段清单、批注时的画布类名。请求、存储、批注与提交逻辑没有改动；原有 data-testid 和测试依赖的 class 都保留。
- `app/globals.css`：工作台浅色（分步工单）与深色（批注画布）两套 `--ws-*` 变量，步骤条、整屏分步、修改单、画布和 900／600 断点样式。
- 检查（均在上述改动之后运行）：`npm run typecheck` 通过；`npm run build` 通过；`npm test -- tests/dashboard-cleanup.test.ts tests/sites-list.test.ts tests/t105-retire-template-gallery.test.ts tests/site-preview.test.ts tests/t145-workspace-navigation.test.ts tests/workspace-dark-contrast.test.ts tests/t162-inline-annotation.test.ts tests/t162-mobile-reveal.test.ts tests/t162-scroll-edge.test.ts tests/t163-area-drafts.test.ts tests/t169-citations-browser.test.ts tests/t175-thread-placement.test.ts tests/t179-composer-scroll.test.ts tests/t210-check-resume.test.ts tests/t153-style-preferences.test.ts tests/t162-review-regressions.test.ts tests/t175-stale-placeholder.test.ts` 非浏览器 6/6、浏览器 72/72 通过。未跑全量，按规则留给主线合并后验证。
- Chrome 截图（gitignore 的 `artifacts/redesign/impl/`，每张都打开看过，`scrollWidth - innerWidth` 均为 0）：首页、`/sites`、`/settings` 各 1440／768／375；工作台资料步 1440／768／375，风格、大纲、生成步 1440／375，修改步 1440／768／375，批注画布 1440／375。风格、大纲、生成三步用本地替身模型走真实 chat 入口得到，最后存为第 1 版并进入修改步。点「批注」后类名含 `code-canvas-mode`，再点一次恢复。
- 没测：真实模型下的生成步（阶段文字只按进度文案区分「写页面」和「检查」两段）；浏览器存储模式（`SITE_STORE=browser`）下的首页只经类型检查和静态测试，没有截图。
- 提交后的浏览器实操测试（本地替身模型）发现：1280×841 下留着两条待发送批注并退出批注，`.chat-messages` 被压到 32px，英文面板被裁。原因是输入区按内容高度占满右栏（main 上已有的 flex 规则）。修改：非画布、非首版前的 `.chat-messages` 加 `min-height: clamp(140px, 22vh, 220px)`。修改后同一操作对话区 185px；此时输入区自身滚动，整页输入框要在输入区内下滑才看到。375 宽度无草稿时两个区域高度与修改前相同。上述定向测试重跑，非浏览器 6/6、浏览器 72/72 通过。
- 该次测试没覆盖：批注和整页修改成功存版（替身模型不返回合格的修改结果，两次提交被拒收，第 1 版和草稿保留）。

---
id: T-223
title: 修掉 2026-11-20 真实实跑里发现的问题
type: build
status: closed
blocked_by: []
claimed_by: Antigravity
supersedes:
---

## What to build

2026-11-20 在合并后的主线（提交 c5c09cdd）上，用模拟主体「岚坞茶叶专业合作社」从工作台真实生成并修改了三个站点（两个 `gpt-6.2-sol` 经 OpenAI Responses 格式，一个 `deepseek-flash`），调用与用量见 [T-221](T-221-provider-formats.md)。过程中发现下面的问题，负责人要求登记成一张票。

证据在负责人 Mac 上 gitignore 的 `artifacts/t221/real-openai-2026-11-20/`、`artifacts/t221/followup-2026-11-20/` 和 `artifacts/t223/`；三个站点仍在这台 Mac 的 `.sitecraft-data/` 里（`15ceba41…`、`b41df306…`、`a2acadb0…`）。下面每条都写了不看证据也能复核的事实。第 1 到 6 条所在的代码行按 `git blame` 核对，都早于 PR #3、#4。

### 1. 同一个日期换一种写法，被判成「资料没有的数字」

- 现象：资料写 `2026-05-08（模拟动态）`，模型在首页写「2026 年 5 月 8 日」，检查拒收「资料没有的数字：8」，占掉两轮修正里的一轮（修正调用 10,414 token）。修正只把这一条改回 `2026-05-08`，首页三条动态成了「2026 年 10 月 12 日／2026-05-08／2026 年 3 月 21 日」三种写法混排。
- 位置：`lib/code-site-check.ts` 的机械数字检查。`numbers()` 取出的是数字原文，资料里是 `05`、`08`，页面是 `5`、`8`；`5` 恰好在资料别处出现，`8` 没有。
- 站点 `15ceba41` 第 1 版，拒因的定位是 `pages/home/html` 里的文字「2026 年 5 月 8 日」。

### 2. 版本已经保存，任务却被标成「中断」

- 现象：DeepSeek 站点 `b41df306` 补图的整站修改，第 2 版在 06:03:02.333Z 保存并通过检查，对话里也写了「版本 2 已保存，底线检查通过」（06:03:03.190Z）；任务记录却在 06:03:03.688Z 变成 `status: error`、「检查进程已中断，已生成的页面保留。可点击继续检查」，同时带着已保存版本的 `versionId`。站点列表显示红字「第 5 步 · 修改，上次改动没有保存」，工作台显示中断提示，但没有「继续检查」按钮。
- 位置：`lib/code-site-workflow.ts` 的 `handleCodeChat`，`action: 'state'` 分支：用先前读到的站点记录判断 `run.status === 'running' && !active.has(run.id)`，成立就把任务写成中断。任务收尾是先写 `status: 'complete'`、再从 `active` 里移除。
- 原因是按代码推断的，没有做确定性复现：轮询读到的还是「运行中」的旧记录，等它检查 `active` 时任务刚好结束，于是把已完成的任务覆盖成中断。当天 11 个任务里出现 1 次；当时除界面每 2 秒的轮询外，测试脚本也在每 2 秒轮询，会提高撞上的概率。

### 3. 撤销时调用模型核对事实，用量没有记录

- 现象：OpenAI 站点 `15ceba41` 从第 4 版撤销，请求用了 35.9 秒，存成第 5 版（代码与第 3 版完全相同）。第 5 版的事实核对是重新做的（`factSegments` 里 `audited: 23`、`reused: 0`），但站点的任何任务记录里都没有这次模型调用，站点有记录的用量因此少算一次整站事实核对（同站另外三次是 60,053、67,262、70,638 token）。
- 位置：`app/api/sites/[siteId]/history/[action]/route.ts` 直接经 `queuedCommit` 调 `commitSiteCode`，不在 `codeModelCalls.run(…)` 里，也不建任务记录；`lib/code-site-model.ts` 只在有调用列表时才登记调用。
- 这次重新核对本身符合规则：第 3 版来自批注批次，只核对过被改的区块，没有整站核对结果可沿用。问题只在调用和用量看不见。

### 4. 被清理掉的无害元素占用一轮修正（需负责人先定）

- 现象：OpenAI 站点 `15ceba41` 的首页快捷修改，模型写了一个 `<wbr>`。清理步骤把它去掉，同时记成拒因「已去掉禁止元素 wbr」，于是交回修正：修正调用 10,894 token、输出 12 token，没有改任何内容，第二次检查通过。
- 位置：`lib/code-site-check.ts` 清理 HTML 时 `issues.push('已去掉禁止元素 …')`，而 `passed` 的条件是没有任何 `issues`。
- 要定的事：`<wbr>` 只提示可换行的位置，不带脚本和资源。是把它放进允许的元素，还是「已清理掉、内容不受影响」的元素不算拒收，还是维持现状。这是提交入口的规则，改之前要负责人确认。
- **2026-11-25 负责人已定**：把 `<wbr>` 加入允许的元素集合（`lib/code-site-check.ts` 第 25 行 `allowed`；`<wbr>` 只提示换行位置，无脚本无资源）；不采用「被清理掉的元素不算拒收」；其他禁止元素维持现状。

### 5. 大纲确认卡里出现「。；」

- 现象：确认大纲时每页的条目显示成「…简介。；标题下以宽栏…」。三次规划都有（`gpt-6.2-sol` 两次、`deepseek-flash` 一次，每次 14 到 15 处），与模型无关。
- 位置：`lib/code-site-model.ts` 的 `planSiteCode` 用 `page.outline.join('；')` 把短句数组拼成一段，而模型给的每个短句都以句号结尾。

### 6. `background: var(--x)` 后面再跟同族属性，保存下来的 CSS 丢了背景

- 现象：站点 `a2acadb0` 第 1 版，模型写的是 `.tone{background:var(--leaf);background-clip:border-box;border-radius:0}`，保存下来的是 `.tone{background-image: ; background-position-x: ; … background-color: ; background-clip: border-box; border-radius: 0px;}`，八个属性值是空的。这个区块原本要有底色，实际没有；检查全部通过，没有任何提示。公开样品 `landing/samples/tea/` 的「加工与批次标签」区块因此没有底色。
- 位置：`lib/code-site-check.ts` 的 `safeCss` 返回 `style.cssText`。Chrome 154 对「带 `var()` 的简写属性加同族长属性」就是这样序列化的；单独的 `background:var(--leaf)` 和不带 `var()` 的写法都正常。隔离复现的三行结果在 `artifacts/t223/css-shorthand-repro.txt`，脚本是同目录的 `css-shorthand-repro.ts`。
- 附带现象：对这个站点做一次局部批注修改后，保存的全站 CSS 里这八个空声明消失了（`.tone{background-clip: border-box; border-radius: 0px;}`）。渲染结果没变，范围检查按解析后的规则比较所以通过，但共享 CSS 的文本确实被改写了。

### 7. 局部批注里新增图片，模型不知道图片怎么写

- 现象：站点 `a2acadb0` 第 2 版，对首页一个原本没有图片的区块批注「放一张茶园配图，用图片编号 img_5a48…」，模型写成 `<img src="img_5a48…">`，整批拒收：「已去掉资源或空链接 src=…；图片编号未授权：未提供编号」，没有修正轮，两条批注都没保存。把意见改成明写 `<img data-image-id="…">` 后模型照做。之前换图那次成功，是因为区块里已有一张带 `data-image-id` 的图可以照着写。
- 位置：局部写作的合同（`skills/site-code-core/LOCAL-EDIT.md`）只说「沿用系统图片编号」，没有写法；`writeLocalEdit` 也不带站点的图片清单。

### 8. 页面变高后出现滚动条，被判成「修改越界」

- 现象：同一站点，对首页介绍区块加图的批注被拒收：`修改越界：home/768 状态 baseline … 改变范围外元素路径 [1,0] 的完整计算样式`，共 17 条，全部在 768 一档，涉及页头、其他区块和页脚。
- 原因是推断，没有隔离复现：检查的视口高 1000（`lib/code-site-check.ts`），这个首页在 768 宽时原本高约 1000，刚好没有竖向滚动条；加图后页面变高，出现滚动条，可用宽度变窄，范围外元素的计算宽度全变了。1440 和 375 两档原本就有滚动条，所以只有 768 报错。

### 9. 岚坞站点的英文版两次都没生成出来

- `gpt-6.2-sol`（OpenAI Responses）：11 次翻译调用全部 HTTP 200，两轮修正后仍有 23 段「保真：含数字记号、数值与单位、邮箱或网址不一致」，没有保存。看到的译文例子：「3 月下旬至 4 月上旬」译成「Late March (3) to early April (4)」，「680 元/公斤」译成「CNY 680/kg」。哪些是规则误报、哪些是真问题没有逐段分。
- `deepseek-flash`：4 次调用后「英文译文格式无效，本次未保存版本」，按规则不重试。原始回复在站点的任务记录里，没有分析。
- 记录在 `artifacts/t224/runs/state-after-english.json` 和 `artifacts/t224/english-deepseek/`。

### 10. 还没核实的观察

- 开发模式下，首页写「这个浏览器里还没有保存模型接口」，而本机环境变量已配置、能正常生成。提示只看浏览器里保存的设置。
- 375 宽的工作台，步骤条和「修改单」标题之间有一条模糊的灰带（`artifacts/t221/real-openai-2026-11-20/shots/08-workbench-v1-375.png`），原因没有查。
- 浏览器存储模式的站点列表：站点包里的记录解不开时，`lib/browser-sites-client.ts` 的 `bundleProgress` 返回空，`components/site-progress.tsx` 可能把它显示成「已有版本 · 继续修改」而没有任何提示。只读了代码，没有复现。
- 删掉路由后，旧的 `.next/types/validator.ts` 仍引用已删除的页面，`npm run typecheck` 会报 2 个错，运行 `npx next typegen` 后通过（当天在这台 Mac 上遇到，旧文件生成于 T-220 删除 `/content` 页之前）。

## Acceptance

每条修复都要有一个在当前代码上会失败的回归测试。

- [x] 资料写 `2026-05-08`、页面写「2026 年 5 月 8 日」时，机械数字检查不拒收；资料里确实没有的数字仍然拒收
- [x] 任务在保存版本后结束的同时有状态轮询，任务不会被改成「中断」；站点列表和工作台显示版本已保存
- [x] 撤销或恢复需要调用模型核对事实时，这次调用的用途、耗时、HTTP 状态和用量能在站点记录里查到
- [x] 按负责人 2026-11-25 决定，将 `<wbr>` 加入 `lib/code-site-check.ts` 允许元素列表（含回归测试：页面含 `<wbr>` 不触发清理拒收与修正轮，其他禁止元素仍照常清理并拒收）
- [x] 确认大纲的卡片里，条目之间不出现「。；」
- [x] 模型写 `background: var(--x)` 再跟同族属性时，保存后的 CSS 渲染出的背景与模型写的一致，或者明确拒收并交回修正
- [x] 局部批注要求新增已登记图片时，模型能写出合规的图片标记，或拒因明确告诉用户怎么写
- [x] 修改让页面在某一档从「不滚动」变成「滚动」时，不因滚动条占宽而判越界；真正改到范围外的仍然拒收
- [x] 查明岚坞站点两次英文翻译失败的原因，逐条归为规则误报、模型问题或提示问题
- [x] 第 10 节的四条观察逐条核实，各自有结论：修复、不修，或另开票

## Resolution

完成时间（纽约时间）：2026-11-25 05:11 EST。

### 修复实现（第 1–8 条）

1. **日历日期等价数字**（[lib/code-site-check.ts](../../lib/code-site-check.ts)）：`allowedNumbers` 新增 `calendarDateNumbers()`，对 `YYYY-MM[-DD]` 与 `[YYYY年]M月[D日]` 双向生成 `N` / `0N` 日期等价数值集合；非日期零补号与资料中缺失的数字继续拒收。
2. **轮询竞态不覆盖已完成任务**（[lib/code-site-workflow.ts](../../lib/code-site-workflow.ts)）：`handleCodeChat` 的 `action: 'state'` 在 `updateCodeSite` 站点锁内复检 `current.run?.id === staleRunId && current.run.status === 'running' && !active.has(current.run.id)`，仅在实际标记中断后同步 `updateConversationAlignment`。
3. **撤销／恢复直调记录模型调用**（[lib/code-site-store.ts](../../lib/code-site-store.ts)）：`commitSiteCode` 新增 `recordDirectRestore = !parentCalls && !!restore`，仅对撤销／恢复直调用 `codeModelCalls.run(directCalls, executeChecks)` 收集直接调用、用途、耗时、HTTP 状态与用量并写入 `CodeRun`（将 `restore?.english` 检查一并纳入同一 `try/catch`）；`PUT /draft` 等非恢复保存不再生成空运行记录。
4. **`<wbr>` 决定与清理边界**（[lib/code-site-check.ts](../../lib/code-site-check.ts)）：按负责人 2026-11-25 决定将 `'wbr'` 加入 `allowed` 元素集合，不采纳「被清理掉的元素不算拒收」，其他禁止元素继续清理并拒收。
5. **大纲条目拼接**（[lib/code-site-model.ts](../../lib/code-site-model.ts)）：导出 `joinPageOutline(items: string[])`，在 `planSiteCode` 拼接前剥除每条末尾 `[。；;]+`，消除「。；」。
6. **保留带 `var()` 的 CSS 简写加同族长属性**（[lib/code-site-check.ts](../../lib/code-site-check.ts)）：`cleanCandidate` 不再经 `CSSStyleRule`/`style` 整段序列化规则样式表，改为 `stripCssComments` + `splitCssBlock` + 逐声明 `cleanDeclaration`/`cleanDeclarations` 校验；`safeCss` 同时遍历 `[...style]` 与 `style.cssText` 拦截危险值，从而完整保留 `background: var(--x)` 与同族长属性。
7. **局部批注新增已登记图片**（[skills/site-code-core/LOCAL-EDIT.md](../../skills/site-code-core/LOCAL-EDIT.md)、[lib/code-site-model.ts](../../lib/code-site-model.ts)、[lib/code-site-workflow.ts](../../lib/code-site-workflow.ts)、[lib/code-site-check.ts](../../lib/code-site-check.ts)）：`LOCAL-EDIT.md` 补充 `<img data-image-id="img_xxx" alt="真实说明">`（不写 `src`/`srcset`）、`data-system-icon`、`data-system-backdrop` 与 `<wbr>` 语法；`writeLocalEdit` 与 `writeLocalEditBatch` 接收 `images`（过滤 `usageScope !== 'docs-only'`），由 `executeLocalEdit` / `executeLocalEditBatch` 传入 `await listSiteImages(site.siteId)`；误写 `<img src="img_...">` 且缺 `data-image-id` 时在 `cleanHtml` 给出明确用法拒因。
8. **局部范围对比隐藏滚动条与 Windows 浏览器稳定性**（[lib/code-site-local-edit.ts](../../lib/code-site-local-edit.ts)、[lib/code-site-check.ts](../../lib/code-site-check.ts)、[lib/code-site-browser.ts](../../lib/code-site-browser.ts)）：`prepareOutsideCssApplications` 在对比期间发送 `Emulation.setScrollbarsHidden` (`{ hidden: true }`)，`checkSiteCode` 的 `if (edit && pageIsEdited)` `finally` 在 `if (completed)` 时复位 `{ hidden: false }`（探针中途失败不额外发 CDP 命令掩盖原错），避免高度增加触发滚动条改变视口宽度引起假越界；另在 `codeCheckBrowser` 增加 `DevToolsActivePort` 轮询 `EBUSY` 容错、临时档案清理重试，以及命中 WHATWG 受限端口时最多重试 6 次。

### 第 9 条调查结论（岚坞站点两次英文翻译失败分类，不修改翻译规则）

基于 [artifacts/t224/runs/state-after-english.json](../../artifacts/t224/runs/state-after-english.json)、[artifacts/t224/english-deepseek/](../../artifacts/t224/english-deepseek/)、[artifacts/t224/english-deepseek.log](../../artifacts/t224/english-deepseek.log) 与 [lib/code-site-english.ts](../../lib/code-site-english.ts) 逐条核对：

- **`gpt-6.2-sol`（OpenAI Responses，11 次 HTTP 200 调用，两轮修正后余 23 条 `englishFidelity` 失败）**：**23/23 均为规则误报**（其中 1 条兼受行内 DOM 拆槽影响）：
  - 6 条单价分母单位缺失（`680/420/260/180/560/340 元/公斤`，`servings` 仅映射 `份/碗/单`、`units` 未登记 `公斤='kg'`）；
  - 5 条中文历月被误判为持续时长（`"3 月下旬至 4 月上旬"`、`"3 月下旬"`、`"4 月中旬至 5 月上旬"`、`"4 月下旬"`、`"3 月下旬至 5 月上旬"`，`units['月']='months'` 强制要求 `quantity:N@months`）；
  - 4 条中文量词/面积单位缺失（`"46 户"`、`"12 户"`、`"15 人"` 中 `counts` 缺 `户`/`人`；`"1280 亩"` 中 `units` 缺 `亩`）；
  - 1 条量词 `个` 后多字中文单位未识别（`"3 个工作日"`）；
  - 6 条中文序数、历年或数字固定搭配误拆（`"第一批"`、`"2026 年"`、`"同一/一年/一次"`、`"白叶一号"`、`"一年两次"`、`"同一套/三道"`）；
  - 1 条规则误报叠加上下文行内 DOM 拆槽（`"一次最多 "` 与相邻 `"15 人"` 分槽）。
- **`deepseek-flash`（4 次调用 `[1380,200],[1945,200],[4247,200],[4300,200]`，报 `"英文译文格式无效，本次未保存版本。"`）**：归为 **提示问题 + 模型问题**：第 3 批（`garden-cooperative`）相邻槽位 `"分布在海拔 "`（`s9`）+ `"600–900 米"`（`s10`）+ `"的山坡上"`（`s11`，`page:garden-cooperative:29:text`）中，英文语序将地点宾语前移写入 `s9`（`"Located on slopes at an elevation of "`），导致 `s11` 返回空字符串 `""`，触发 `z.string().min(1)` 校验失败（提示缺少碎片化行内槽位不可输出空串的约束，模型也实际输出空串）。

### 第 10 条逐项核实与结论

- **10.1 开发模式接口提示**：**修复**（[lib/provider-settings-client.ts](../../lib/provider-settings-client.ts)、[components/provider-settings.tsx](../../components/provider-settings.tsx)、[app/(workspace)/page.tsx](../../app/(workspace)/page.tsx)）。`NODE_ENV !== 'production' && ai.configured` 时向 `Dashboard` 与 `LocalDashboard` 的 `ProviderStatus` 传入 `serverModel`，由 `providerStatusText` 提示当前使用本机环境变量接口；第 10.1/10.3 回归用例通过。
- **10.2 375 宽工作台上方模糊灰带**：**修复**（[app/globals.css](../../app/globals.css)）。`@media (max-width: 600px)` 下的 `.code-workspace .builder-chat` 改为常规静态流式布局并取消固定定位与向上 `box-shadow`（`.mobile-hidden { display: none; }`），改前灰带见 `artifacts/t223/red-workbench-375.png`，改后 375/768/1440 截图（`artifacts/t223/workbench-{375,768,1440}.png`）均已人工看图确认无灰带与遮挡，回归用例第 10.2 项通过。
- **10.3 浏览器存储损坏伪装已保存**：**修复**（[lib/browser-sites-client.ts](../../lib/browser-sites-client.ts)、[components/local-site-list.tsx](../../components/local-site-list.tsx)）。以 `readBundleProgress(bundle)` 替代静默捕获，损坏以及 `record.route` 既非 `code` 也非 `unavailable` 时均显式返回 `{ status: '本地存档损坏', readError }` 并在列表显示错误原因；第 10.1/10.3 回归用例与 `t202-browser-storage`、`t220-site-flow` 均通过。
- **10.4 删路由后旧 `.next/types/validator.ts` 报错**：**核实不修**。`tsconfig.json` 包含 `.next/types/**/*.ts` 属 Next App Router 标准配置，且 `npm run typecheck` 为只读 `tsc --noEmit`；删除路由后执行 `npx next typegen` 刷新生成类型即可，不在 `package.json` 混入副作用构建步骤，无需另开票。

### 回归、文档与审查证据

- 改前红灯日志：`artifacts/t223/red-tests.log`（`tests/t223-real-run-fixes.test.ts` 0/10 通过、10/10 失败；注：其中第 4 项在改前先触发 `chrome_debug.log` `EBUSY` 清理冲突，而检查 `HEAD` 版 `lib/code-site-check.ts:25` 确认当时确未收录 `wbr`；第 8 项记录的是收窄 768 滚动条场景前的初稿失败）、改前 375 截图 `artifacts/t223/red-workbench-375.png`。
- 测试监听器适配：[tests/fixtures/t159-entry.ts](../../tests/fixtures/t159-entry.ts) 与 [tests/t223-real-run-fixes.test.ts](../../tests/t223-real-run-fixes.test.ts) 的临时回环服务跳过 WHATWG 受限端口，避免 Windows 顺序端口分配撞上 `6000` 等端口导致 `bad port`；第 8 项同时包含静态 (`probeStates === false`) 与作者 `:hover` 双浏览器动态 (`probeStates === true`) 用例。
- 最后编辑后验证：
  - `SITE_STORE=fs npm run build`（`artifacts/t223/build.log`）：exit 0，23 条路由全部构建通过；
  - `npm run typecheck`（`artifacts/t223/typecheck.log`）：exit 0；
  - 27 个 Windows 兼容定向套件（`artifacts/t223/green-tests-verified.log`）：非浏览器池 `t220-site-flow` (5/5) + 浏览器池 26 文件 (`t223-real-run-fixes` 10/10、`t128-code-boundary` 41/41、`t133-floor-checks` 8/8、`t148-system-backdrops` 9/9、`t152-local-edits` 9/9、`t152-local-model-input` 3/3、`t159-task-admission` 13/13、`t162-mobile-reveal` 3/3、`t164-dynamic-gate` 16/16、`t164-local-output-limit` 3/3、`t164-multi-block-edit` 16/16、`t169-citations-browser` 9/9、`t175-thread-placement` 3/3、`t178-full-style-equivalence` 1/1、`t186-narrow-wrapping` 4/4、`t187-repair-fragments` 14/14、`t188-condition-scope` 9/9、`t192-check-transitions` 14/14、`t194-number-node-boundary` 13/13、`t199-contrast-effects` 62/62、`t202-browser-storage` 7/7、`t202-provider-flow` 6/6、`t205-interrupted-materials` 3/3、`t210-check-resume` 11/11、`t221-provider-formats` 15/15、`workspace-dark-contrast` 1/1) 共 **27/27 文件、308/308 用例全部通过，0 失败、0 跳过**；另前次 15 套件试跑已确认 2 个既有 POSIX 测试夹具在 Windows 上不适用（`tests/t173-port-readiness.test.ts` 第 28 行硬编码 `/DevToolsActivePort` 正斜杠致使 9 子测试未匹配；`tests/t204-check-browser-exit.test.ts` 第 16 行写 `#!/bin/sh` 报 `spawn ... ENOENT`）。
- 设计完整性静态扫描：`artifacts/t223/design-integrity.json`（`acceptance_changes: []`，4 处 `exception-boundary` 均为损坏上报、受限端口重连或记账后原样抛出）。
- 独立复审（`same-model review`，`6c2791e2-242c-41ad-848b-dafdd76a1305`）：首轮 `FAIL` 检出的构建/套件验证缺口与 3 处代码细节已全部修复并复跑通过，次轮复审结论 **`STATUS: PASS`**（见 `artifacts/t223/review.txt`）。
- 活文档同步：已更新 [CONTEXT.md](../../CONTEXT.md)、[docs/project/mainline.md](../../docs/project/mainline.md) 与 [docs/project/spec.md](../../docs/project/spec.md)；遵照负责人关于 `AGENTS.md` 硬约束不擅自修改的规则，[AGENTS.md](../../AGENTS.md) 与 [README.md](../../README.md) 在 `T-223` 提交后按 [MAP.md](../MAP.md) 同仓模式更新 `Verified` 提交编号。

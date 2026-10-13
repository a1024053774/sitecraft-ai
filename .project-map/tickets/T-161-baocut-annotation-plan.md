---
id: T-161
title: 参照 BaoCut 升级预览批注，确认交互与多区块修改范围
type: decide
status: closed
blocked_by: []
claimed_by:
supersedes:
---

## Question

负责人 2026-10-12（纽约时间）要求：参照 JimLiu/baocut 的 `7aa049e8` 优化画板批注，先规划。本票交付源码对照、建议交互、下一批纵向切片与验收条件；不实施，不领取 T-159，不干扰已领取的 T-160。

**目标**：用户能在预览上指出问题、就地写意见、核对修改范围，并从批注回到对应位置；多处意见可以收集后统一交给系统处理。对应主线的「更好改」。

**非目标**：移植完整设计编辑器；自由绘图、无限画布、多人协作、设计系统编辑、PDF 导出；新增发布路线或旁路写站点；重做生成页面风格；把英文局部编辑加入本批。

**待决定**：是否确认以下三步，以及第三步把单个 `selectedTarget` 扩展为本次明确选中的区块集合。这个集合仍绑定同一中文版本，所有候选仍经唯一提交入口；不得静默扩大成整页或整站修改。该扩展改变 T-152 单区块合同，需要负责人确认后才能实施。

## 源码对照与证据

核对日期：2026-10-12（纽约时间）。本项目基线 `fed2d1e`。外部目标完整提交：[`7aa049e82e1367da013b7aba80f0b79033fa04ad`](https://github.com/JimLiu/baocut/commit/7aa049e82e1367da013b7aba80f0b79033fa04ad)，父提交 `cb61e6a526ad19e0ed0eaff88ed8220bb6d450e6`。

使用用户指定的 REA skill；完整源码可得，按其路由规则使用源码工具，不启动反编译或 REA readiness。以下为 **observed（源码观察）**，不是运行体验实测，也未验证整个大提交。GitHub commits API 只返回前 300 个文件；另取该提交完整 recursive tree（truncated=false），从中选择批注入口与直接依赖，避免把 300 文件清单当作全量 diff。

| 能力 | BaoCut 源码观察 | SiteCraft 当前实现 | 建议 |
| --- | --- | --- | --- |
| 进入与退出 | 按钮/单键 C 切换；输入中、IME composing 等状态不截获 C；区域拖拽支持 Escape、pointercancel、失焦取消 | 工具栏「点选区块」，选中后切到对话 | 批注模式保持在预览；支持 C、Esc 与键盘焦点管理 |
| 定位 | 元素、画板、区域等锚点；矩形拖拽有移动阈值、虚线框、区域缩放手柄 | 只取 main 内最近 section/article 等区块，无矩形圈选 | 视觉指向可更细，但明确展示实际可修改区块；坐标仅辅助展示 |
| 写意见 | 父窗口在目标位置打开一个批注框；显示位置、输入、取消、「添加到对话」；⌘/Ctrl+Enter 添加 | 点选后在对话输入框写，勾选保存线程，发送即开始修改 | 预览旁就地输入，添加为待发送批注，尚不调用模型 |
| 编号与回看 | 编号与草稿添加顺序一致；列表可跳回目标，逐条/全部移除；已发送列表只读 | 线程在对话底部 details 中；定位设置页面与 target，没有显式滚入目标 | 编号、列表、目标高亮对应；定位先滚入视口，再打开意见 |
| 多条发送 | 标注集合随下一条消息交出；发送后只移除本次发送的 id，发送期间新增的保留 | chat 只收一个 selectedTarget；批注结果追加为助手回复 | 先收集，再明确发送；第三步增加可核验的多目标提交合同 |
| 草稿恢复 | draft-design-annotations-store 明确只在当前窗口，不持久化 | 当前选中目标在 localStorage 同版本恢复，线程在 FS/PG | 保留并扩展刷新恢复；版本变化后显示失效，不猜新位置 |

外部直接来源（均固定到该提交）：

- [canvas-controller.tsx](https://github.com/JimLiu/baocut/blob/7aa049e82e1367da013b7aba80f0b79033fa04ad/packages/design-runtime/src/comments/canvas-controller.tsx)：模式、悬停、定位与 C 快捷键。
- [area-drawing.tsx](https://github.com/JimLiu/baocut/blob/7aa049e82e1367da013b7aba80f0b79033fa04ad/packages/design-runtime/src/comments/area-drawing.tsx)：矩形圈选、取消与缩放手柄；最终矩形两个方向均有最小阈值。
- [comments-bridge.ts](https://github.com/JimLiu/baocut/blob/7aa049e82e1367da013b7aba80f0b79033fa04ad/packages/slides/src/editor/comments-bridge.ts)：design-host 复用此宿主；compose/threads/reveal/placed 与编号图层。参考编号本身是 pointer-events:none，不宣称其编号可点击。
- [editor-pane.tsx](https://github.com/JimLiu/baocut/blob/7aa049e82e1367da013b7aba80f0b79033fa04ad/packages/ui/src/components/workspace/editor-pane.tsx)：就地批注框、单个 composer、⌘/Ctrl+Enter。
- [design-annotations.ts](https://github.com/JimLiu/baocut/blob/7aa049e82e1367da013b7aba80f0b79033fa04ad/packages/ui/src/model/design-annotations.ts)、[草稿 store](https://github.com/JimLiu/baocut/blob/7aa049e82e1367da013b7aba80f0b79033fa04ad/packages/ui/src/state/draft-design-annotations-store.ts)、[annotations-token.tsx](https://github.com/JimLiu/baocut/blob/7aa049e82e1367da013b7aba80f0b79033fa04ad/packages/ui/src/components/annotations-token.tsx)：编号、集合、移除、跳转、发送快照与窗口内存边界。
- [harness 测试](https://github.com/JimLiu/baocut/blob/7aa049e82e1367da013b7aba80f0b79033fa04ad/packages/harness/src/design-annotations.test.ts)：源码包含批注随消息进入模型输入的覆盖；本轮未运行这些测试。

本项目直接来源：`components/code-preview-selection.tsx`、`components/code-workspace.tsx`、`lib/annotations.ts`、`lib/annotation-store.ts`、`lib/code-site-workflow.ts`、annotations API、`tests/t152-*.test.ts`、`scripts/t152-preview-e2e.ts`。现有根因是选择、意见、定位分散在预览和对话两处；存储与局部提交能力已有，不需要平行建一套。

参考快照在 gitignore 的 `artifacts/annotation-planning-20261012/`，不进入运行时、不复制完整仓库或依赖。源码许可证为 source-available 的 BaoCut Community License；本方案借鉴交互并在现有代码中实现，不以开源名义直接引入其 runtime 或资产。

## 建议交互

1. 预览工具栏显示「批注」。进入后悬停高亮；点一下选择位置，拖一下圈出矩形。正常浏览状态保留链接导航、选择文字与滚动。
2. 点击标题/图片等具体位置时，在其附近弹出意见框，并显示「修改范围：页面 · 区块」。实际修改仍以 T-152 区块为边界，不能把小点的视觉精度说成只改一个文字节点。
3. 主按钮「添加批注」，不是立即调用模型。添加后出现编号，允许继续指出下一处；375 下采用底部输入面板，保留位置和修改范围摘要，不强制跳离预览。空意见不能添加；普通 Enter 换行，⌘/Ctrl+Enter 添加；Esc 取消并恢复焦点。
4. 对话输入框上方显示「待发送批注 · N 条」。展开列出页面、区块、意见，可回看、编辑与显式移除。第一步只发单条；第二步收集多条并允许选一条发送；第三步提供一次发送整批。快捷按钮生成待发送意见，仍由用户明确发送。
5. 发送快照冻结本次 id、原始版本和目标；任务中的条目不能重复发送。成功后仅归档本次完成条目，发送期间新加的保留。失败保留意见与可见拒因，不自动重试、不清成成功；刷新能看到持久化任务状态。
6. 编号在当前页显示；列表定位切到该页、滚动到目标、突出范围并展开意见。草稿编号按当前列表顺序，已发送批次保留发送时编号。可明确关闭/重开线程；修改成功写结果和版本，但「已修改」与用户确认「已处理」不混为一谈。
7. 版本变化时，旧意见保留，提示「来自 vX，请重新点选」；用户重新定位并确认后才允许发送。旧锚点继续只读，不能模糊匹配或用坐标猜位置。归档、解决线程不等于删除记录。

**点选与圈选的含义**（规划审查后修改）：点选或圈选都要落到模型能用的信息上，不能只是画在屏幕上的框。点选：修改边界仍是 T-152 的区块；用户点中的具体元素（标题、某张图、某段文字）作为「用户指的是这里」的提示，和区块 HTML 一起发给模型。圈选：系统算出框内覆盖的区块和具体元素。只覆盖一个区块时，等同于点选并附带多个元素提示；跨多个区块时，列出这些区块，第 1、2 步请用户收窄到一个，第 3 步可以确认为多区块。框的坐标只用于显示，不发给模型，也不保存为定位依据。不做缩放手柄：要改范围就重新拖。

**视觉**：同一工作台体系，主要行动是添加/发送批注，记忆点是与意见对应的编号。只用 `app/globals.css` 里工作台现有的 `--ws-*` 角色变量（线、正文、强调色等），深浅主题和强调色切换自动跟随，不写死色值。字体继承现有工作台，控制沿用当前 4px 圆角，浮层参考现有面板尺度，不带入参考编辑器的 S2 组件皮肤。不新增字体、图标包或状态库。

## 下一批切片（提案，尚未创建 build 票）

| 顺序 | 依赖 | 用户可用的完整交付 | 主要验收 |
| --- | --- | --- | --- |
| 1. 就地写一条批注并完成修改 | 本票确认 | 点选 → 就地输入 → 添加草稿与编号 → 发送单条 → 现有局部修改 → 结果/定位/刷新 | 离屏定位、三档宽度、同版本草稿恢复、取消与焦点、真实修改范围不变 |
| 2. 圈选与多条草稿管理 | 第 1 步 | 圈选 → 收窄/确认区块 → 多条意见 → 编辑/移除/定位 → 选择一条发送 → 其他草稿保留 | 缩放/滚动/拖拽方向、手柄、取消、IME、发送时新增、版本改变后的保留与失效 |
| 3. 多条批注一次修改 | 第 2 步；多目标合同确认 | 同版本多区块意见 → 一次任务 → 一份完整新版本 → 各条结果 → 撤销/刷新 | 整批成功才存版；范围外 DOM/其他页面/CSS 交互态无变化；事实与修正预算不放宽 |

使用 **Ubiquitous language**：批注草稿、批注线程、锚点、修改范围、局部修改；不把临时草稿与已发送线程叫成同一种状态。使用 **Deep modules**：沿用现有 annotations 存储与唯一提交入口；覆盖层负责展示与采集，不新增 host capability 框架或第二套修改 API。每张票都是 **Tracer bullet**，完成一条用户操作到存储与版本的路径后才扩大范围。

第三步建议合同：同区块多条意见按添加顺序组成该区块的一组；祖先/后代重叠目标须先让用户确认同一范围，不能在写回时互相覆盖。各组只传该段 HTML、匹配 CSS、大纲、资料与风格要点；候选在原始版本上组装为一个完整版本，提交入口核对允许区块集合的并集及所有范围外影响。冲突或任一组底线失败不存部分版本，不把多条请求拼进现有整站写作来冒充局部修改。最多两轮修正与事实核对复用条件仍按现有合同；具体组装算法在实施前用最小坏例验证，不预设新抽象。

## Reality gate 与验收约定

**REALITY GATE: INCOMPLETE（达到参考的实际体验尚无实测证据）。** 源码对照与计划已形成；measured 项暂无。inferred：可在现有预览覆盖层、批注存储、chat 和提交入口上完成；unknown：参考运行时的浮层避让/滚动手感、圈选在本项目缩放 iframe 上的体验、多区块 CSS 交互与模型效果。

- 最小交互 probe：执行者用双页面长页，放重复文案、深层区块与底部链接；经真实鼠标/键盘进入批注、圈选、输入、滚动和定位，在 Chrome 1440/768/375 保存截图并逐张看。参考运行体验若未取得，只报告已匹配源码定义，不宣布「一样好」。
- 多目标 probe：第三步实施前，用两个共享样式区块和另一个页面，经真实 chat 入口验证合法两处修改、共享 CSS 外溢拒收、重叠目标处理、任一组失败无新版本；一次明确失败即定位根因，不用整页路线代替。受控 provider 仅证流程，真实模型质量另测。
- 草稿与任务 probe：刷新、请求失败、任务被拒、发送中新增、换版本、撤销和重复点击逐项验证。不能因“清空列表”掩盖未发送/失败条目。
- 独立证据来自预先定义的用户行为和已知坏例。新回归必须在父版本或 mutant 红态失败；圈选和输入用真实指针/键盘，不只 dispatchEvent 绕过 iframe 命中与坐标换算。
- 每张 build 票跑相关测试、typecheck、npm test、build；日志、截图、运行命令/时间/提交放该票 Resolution。使用显式 SITECRAFT_BASE 与本机 CHROME_PATH；本轮规划不需要运行应用构建或调用模型。
- “一样好”的验收交给未参与实现的新审核实例：就地添加是否顺手、范围是否看懂、编号与意见是否对应、窄屏能否完成、失败后意见是否保留；生成结果由另一独立盲评实例比较原版与修改版。技术通过不等于体验或审美通过。
- 真实模型 probe 前由负责人批准本次 token 上限，显式 SITECRAFT_TOKEN_LIMIT；不沿用 T-152 历史额度、不为取得截图重跑整轮评估。证据位置为实施票的 artifacts 目录。

## 规划审查（2026-10-13，右侧规划会话）

负责人要求审查这份规划（Codex 用 REA skill 写的，线程 `01a12fad-7f69-7070-b31f-592b04196740`），修正不合理的地方后发出。源码对照、现有代码引用和工作台配色变量已逐项核对属实。修改如下：

1. **许可**：BaoCut Community License 是 source-available 许可。它把「基于其代码的修改」也算作它的软件，商用要另外签授权。执行者只按本票和 build 票写的交互说明独立实现，不打开、不复制、不改写 BaoCut 源码。`artifacts/annotation-planning-20261012/reference/` 只留作规划记录，不提供给执行者。
2. **圈选要有用**：原方案的矩形「仅用于显示」，模型拿不到任何信息，等于白做。改为框内的区块和元素作为提示交给模型（见上文「点选与圈选的含义」），同时去掉缩放手柄。
3. **草稿存哪里**：待发送的批注草稿按站点和版本存在浏览器 localStorage，和现有的点选记录一样；发出去的批注线程沿用服务端已有的 annotations 存储。不为草稿新建服务端存储。
4. **「一样好」怎么判**：参考产品是整套设计编辑器，跑它的运行时来对比代价高、收益低，不做。改由未参与实现的新审核实例，按固定的任务脚本操作并打分：点选、写意见、编号对应、回看定位、窄屏完成、失败后意见保留。
5. **第 3 步单独把关**：多区块一次修改改变了 T-152 的单区块合同，按 AGENTS.md「改动前须负责人重新确认」。T-164 开工前要负责人单独确认合同，并报批 DeepSeek 用量。
6. 配色不写死色值，只用 `--ws-*` 角色变量。

## Resolution

负责人 2026-10-13 让规划会话审查后发出：第 1、2 步按上述修改确认，拆为 [T-162](T-162-annotation-inline-compose.md)、[T-163](T-163-annotation-area-and-drafts.md)；第 3 步拆为 [T-164](T-164-annotation-multi-block-edit.md)，依赖 T-163，开工前要负责人确认多区块合同和用量。优先级在「更好改」（2），排在 frontier 上的页面质量票（T-159）之后或并行，不占用 DeepSeek 预算的部分可以并行做。

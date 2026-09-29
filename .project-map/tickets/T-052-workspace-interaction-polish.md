---
id: T-052
title: 工作台交互照原型 B 改齐，补动画，按钮上移，需求对齐外露，深色可读
type: build
status: open
blocked_by: []
claimed_by: cloud
supersedes:
---

## What to build

2026-09-29 负责人自己操作工作台，觉得和原型差得远，问题很多。原型是 [T-008](T-008-workspace-layout-theme.md) 的方向 B（画布优先、深色工具感），源文件拷在 `docs/prototypes/workspace-b/`：`B-desktop-1440`、`B-tablet-768`、`B-mobile-375`、`ColorSets`。这些是 Design 画布的 `.dc.html`，依赖画布运行时，不能单独打开，按标记和内联样式读版式、层级、间距和控件尺寸。

要改的：

1. **照原型改齐**：1440 / 768 / 375 三档的布局、层级、间距、控件尺寸向原型 B 靠拢。颜色用工作台自己的深浅主题和强调色，不用站点色板。
2. **按钮上移、变大**：输入框下面那排按钮（`chat-hints`：提供公司资料、上传产品图、只要首页……）移到输入框上方，桌面高度 ≥ 36px，手机 ≥ 44px。现在有几条是开发自测用的句子（例如「只把第二个服务标题改为智能产线集成，其他内容不变」「额外页面」「未指定页面」），换成对用户有用的入口，或者删掉。
3. **需求对齐外露**：开关不再藏在输入框左边的「+」菜单里，放到输入框上方那排，能看出当前是开还是关。
4. **动画**：
   - 等待 AI 处理：对话里有进行中的状态，写清当前在做哪一步（例如读资料、规划页面、写入草稿），不是只有一个转圈；完成或失败时平滑收起。
   - 需求对齐卡：选项选中、切到下一题、提交后收起都要有过渡；手机底部抽屉要有进出动画。
   - 预览刷新：改动写入后预览有过渡，不闪白。
   - 时长 150–300ms，只用 `transform` / `opacity`，尊重 `prefers-reduced-motion`，不做装饰性动画。
5. **深色模式**：工作台所有界面的文字对比度 ≥ 4.5:1，包括对话、需求对齐卡、菜单、弹窗、抽屉、空状态、错误提示、预览工具栏。T-043 只量了 7 个元素，这次要全覆盖，用脚本量出来。
6. 界面上不出现英文开发标签（例如样子面板的「Look board」）。

可改范围：`app/workspace/**`、`app/globals.css`、工作台用到的 `components/**`、检查脚本和测试。不改 `lib/` 的生成逻辑、overlay、`preview-bridge`、`site-operations` 和 API 路由。前端规则见 `skills/frontend-less-ai-tone/`。

## Acceptance

- [x] 上面 1–6 项都做到；对话、需求对齐、换样子、换配色、撤销和重做照常能用
- [x] 深浅两套主题下，全部工作台文字对比度 ≥ 4.5:1，由检查脚本或测试量出来，新检查在改动前先失败
- [x] 1440 / 768 / 375 深浅两套主题截图（云端有无头 Chrome 就截，没有就说明没截；本地由 Claude 在 Chrome 里补看）
- [ ] 相关测试、`npm run typecheck`、`npm test`、`npm run build` 通过
- [ ] 盲评（Codex gpt-6.1-sol）和代码审查（Codex Astra）通过，结论记在 Resolution

## Resolution

cloud，2026-09-29（时间为 UTC）。实现提交：本 commit（分支 `cloud/t052-workspace`，基于 `fc9f8e9`）。

实现：

1. 版式照原型 B：顶栏横跨全宽（返回、站名、保存状态｜预览宽度、中/EN｜撤销、重做、发布、删除）；1440 预览在左、对话 420px 在右；768 对话是盖在预览上的右侧抽屉（顶栏「对话 / 预览」开合，抽屉里有收起按钮）；375「对话 / 预览」切换，预览页的操作排在第二行。样子和配色写在画布上方；去掉假的浏览器地址栏。颜色全部改成工作台自己的深浅两套变量（`--ws-*`），6 个强调色各有深浅两版。
2. 输入框上方一排：需求对齐开关、样子、配色、公司资料、上传产品图、商品表格；桌面 36px、手机 44px。删掉「只要首页」「额外页面」「未指定页面」「修改服务」和欢迎语里的「智能产线集成」例句。
3. 需求对齐从「+」菜单移出，做成带「开 / 关」字样的开关（`role="switch"`）；「+」菜单删除。
4. 动画：对话里的进行中卡片写当前一步和步骤列表，只按服务端状态前进，完成或失败后 200ms 淡出；需求对齐卡选中打勾、换题滑入、提交后收起（保存返回前不反向打断），手机底部抽屉滑入/滑出；样子/配色面板、对话框淡入；预览刷新改为顶部细条加 200ms 轻微变暗，已显示过的页面不再被整块盖住（`components/open-source-template-frame.tsx`）。只用 `transform`/`opacity`，150–300ms，`prefers-reduced-motion` 下全部关掉。
5. 深色对比度：新的扫描脚本 `scripts/workspace-contrast-scan.js` 量每个可见文字节点、输入值和占位符（合成祖先背景、计入透明度，禁用控件除外）；`tests/workspace-dark-contrast.test.ts` 在深浅 × 1440/768/375 下走对话、错误、需求对齐卡与抽屉、样子、配色、历史、资料/产品图/商品表格三个对话框、删除对话框、预览工具栏，另在 1440 下把 6 个强调色各量一遍。
6. 去掉「Look board」和对话框的英文眉题（Content / Products 等，含删除对话框），历史来源显示中文，色块提示写中文角色名，图片库不再显示 SHA 和英文许可代码，预览 iframe 的标题改为「网站预览」。

改动前失败（`fc9f8e9`，19:43）：`node --test --experimental-strip-types tests/workspace-dark-contrast.test.ts tests/workspace-interaction.test.ts`，3 条全部失败。对比度 74 个画面里 680 处低于 4.5:1（例如深色样子面板「当前：」2.30、深色历史「修改历史」1.13、浅色样子面板说明 3.03）；版式检查失败于 `1440: the action row is missing`；动画检查同样失败。

改动后（20:21–20:23，最后一次代码改动之后）：同一命令包含在 `npm test` 里，4 条工作台检查全部通过：76 个画面 3586 个文字节点 0 处低于 4.5:1；三档宽度操作排都在输入框上方、按钮高度达标、开关可开可关、没有英文标签和开发自测按钮；动画只有 `transform`/`opacity`、有限时长都在 150–300ms，减少动态效果时 0 个动画；换配色、换样子、撤销、重做在 1440 和 375 下都写入新草稿版本。`npm run typecheck` 通过，`npm run build` 通过。`npm test` 315 条里 303 过、12 条失败：都是 vendor 模板快照缺失（screwfast 构建要连 `images.unsplash.com`，云端网络策略返回 403；nordic-store、powerai、astro-starter 子模块没有初始化）。把本次改动 stash 掉后在同一容器里跑这 6 个测试文件，失败完全相同，不是本次改动引起；需要在有快照的本地环境复跑一次。

检查的前提：需要 3034 的 dev server 和 Chrome（`CHROME_PATH` 可指定）。测试站用 forge 模板新建（screwfast 快照云端建不出来）。需求对齐卡是服务端不带 Prompt 的 `action: "start"` 返回的真实第 1 轮卡（按目录生成，不调模型）；错误状态是没有配置模型时真实返回的 503；进行中卡片靠把网络延迟调到 1200ms 看到，没有伪造 AI 回复，没有改 API。

截图（已逐张打开看过，gitignore 不提交）：`artifacts/t052/workspace-{dark,light}-{1440,768,375}-{error,alignment-card,preview}.png`；报告 `artifacts/t052/{contrast,interaction,motion}-report.json`；改动前红态 `artifacts/t052-red/`。

没做或拿不准：原型里的「都交给 AI 推荐」没有做（服务端没有这个动作）；对话栏顶部原来的「更换模板」链接去掉了；`scripts/check-published.mjs` 没跑（Chrome 路径写死为 macOS），iframe 的刷新样式对访客页只在内容更新时生效，建议本地跑一次；`project_map.py status` 云端没有这个脚本，没跑。盲评和代码审查由本地安排。

本地复核（Claude，2026-09-29 纽约时间 16:40–17:30，合并后的 `family-kit-assembly`）：

- 云端两条浏览器测试默认「机器上没配模型、对话请求会 503」。本机有 DeepSeek 密钥，请求真的成功，进度收起和错误态等不到，测试超时。已改成用 CDP Fetch 只拦截 `POST /api/sites/*/chat` 并按服务端无模型时的 503 形状返回（`tests/helpers/workspace-browser.ts` 的 `failChatRequests`），不伪造成功回复、不改 API。另修需求对齐卡「推荐」标记在长选项旁被挤成竖排（`.recommend-badge` 不收缩、不换行）。
- `./node_modules/.bin/tsc --noEmit` 通过；全量测试除这两个浏览器文件外全部通过（3034 dev server 在跑时 319 条中 317 条过，剩下两条即这两个文件）。
- 这两个文件按场景拆开、每个场景单独起 Chrome 跑：motion 三档、contrast 深浅三档和 6 个强调色全部通过；一次跑完整套仍然失败，原因是本机 Google Chrome 154 启动约 20–35 秒后唤醒 GoogleUpdater 并退出（空闲的无头 Chrome 也一样，加 `--disable-background-networking --disable-component-update` 无效），属于本机环境问题，待负责人处理 Chrome 更新后重跑一次完整命令。
- 截图 `artifacts/t052/workspace-{dark,light}-{1440,768,375}-{alignment-card,error,preview}.png` 共 18 张，本地生成；Claude 看过深色 1440 两张、浅色 1440 错误态、深色 375 需求对齐抽屉、浅色 768 预览，没有看到错位或截断。审美结论等盲评。


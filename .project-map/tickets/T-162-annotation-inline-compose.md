---
id: T-162
title: 预览里就地写一条批注并完成局部修改
type: build
status: open
blocked_by: []
claimed_by: Codex (t162-build)
supersedes:
---

## Why

T-161 第 1 步。现在点选区块后要回到对话框写意见，选择、意见和定位分在两处，不顺手。

## What to build

按 T-161「建议交互」第 1–3、5–7 条做单条批注，**只按本票和 T-161 的说明独立实现，不读也不复制 BaoCut 源码**（许可原因见 T-161 规划审查第 1 条）。

1. 预览工具栏的「点选区块」改为「批注」模式：悬停高亮，点击选中。快捷键 C 进入、Esc 退出；输入框获得焦点或 IME 输入中不截获 C。正常浏览状态下链接、选字和滚动不受影响。
2. 点中后在目标旁弹出意见框，显示「修改范围：页面 · 区块」。点中的具体元素作为提示和区块一起发给模型（例如「用户指的是这张图」），修改边界仍是 T-152 的区块。375 宽度下改为底部输入面板，位置和范围摘要保留。空意见不能添加；Enter 换行，⌘/Ctrl+Enter 添加；Esc 取消并把焦点还回去。
3. 「添加批注」只生成待发送草稿，不调用模型；草稿带编号，按站点和版本存进 localStorage，刷新后恢复。对话框上方显示「待发送批注 · N 条」；本票只允许发送一条。
4. 发送后走现有局部修改和唯一提交入口。发送时冻结这条草稿的版本和目标，任务进行中不能重复发送；成功后归档，失败则保留意见和可见的拒因，不自动重试。
5. 批注线程可以从列表回到预览：切到该页、滚动到目标、高亮范围并展开意见。版本变化后，旧草稿提示「来自 vX，请重新点选」，不猜新位置。
6. 视觉沿用工作台的 `--ws-*` 变量，遵循 `skills/frontend-less-ai-tone/`；不新增字体、图标包或状态库。
7. 同步 `spec.md`、`CONTEXT.md`（批注草稿、批注线程两个词分开）。

## Acceptance

- [x] 先列出失效方式（离屏目标、iframe 缩放后坐标、IME、Esc 焦点、刷新恢复、发送中重复点击、版本变化），按清单写测试，测试先在父版本上失败
- [x] 真实 Chrome 用真实指针和键盘操作，不只 dispatchEvent：双页长页面，含重复文案、深层区块和底部链接，1440/768/375 截图逐张看过
- [ ] 局部修改的范围检查与 T-152 一致：区块外 DOM、其他页面和外部 CSS 都不变；真实模型跑一次单条批注修改（上限由主控报批，预计远小于 1 万 token）
- [ ] 未参与实现的新审核实例按任务脚本试用（点选、写意见、回看定位、窄屏完成、失败后意见保留），结论写进 Resolution
- [ ] Astra 审查通过；typecheck、test、build 通过

## 失效方式与测试合同

实施前列定（2026-10-13；父版本 416bd84）：

1. 离屏与跨页：重复文案不能被文字搜索定位；深层区块及底部链接仍按 DOM 路径定位，先切页、滚入目标，再展开意见。
2. iframe 缩放：真实指针点中的元素与区块一致，外框、编号和意见框按缩放换算，不能遮住输入或越出视口。
3. 键盘与 IME：C 在输入框、可编辑元素或组合输入时不切模式；普通 Enter 换行，Ctrl/⌘+Enter 添加；空意见不添加。Esc 取消后焦点返回预览；正常浏览保留链接、选字与滚动。
4. 草稿恢复：添加只写本站点/版本的 localStorage，不发 chat、不调用模型；刷新保留意见、编号、锚点，不混入其他站点。版本变化仍保留旧意见并禁止发送，不猜位置。
5. 发送快照：双击及任务中刷新不能重复发送；发送冻结版本、区块和具体元素提示。成功只归档这条；HTTP 失败、模型失败及确定性拒收均保留意见与可见拒因，不自动重试。
6. 修改范围：真实 chat 加本地替身只改选中区块；范围外 DOM、其他页面、公共片段及 CSS 应用不变。具体元素提示须在选中区块内且快照一致，不能用它扩大范围。
7. 三档界面：1440/768/375 经 CDP 真实指针与键盘完成，375 留在预览用底部面板；截图逐张打开。线程状态区分「已修改」与「已处理」，旧锚点只读。
8. 历史回看不能落到当前页修改：v3 回看 v2 线程期间，四个快捷按钮停用，手写修改也不发送 chat；提示回到当前版本并重新点选。测试须观察实际发送边界，并分别回退发送保护与按钮停用以取得红态。
9. 连续点选不能丢输入焦点：意见框保持打开，先点首屏、再点深层区块，真实 CDP 输入须进入第二个目标的 textarea；单独回退目标切换聚焦即失败。
10. 点选记录存储被拒不能破坏工作台：分别拒绝 getItem、setItem、removeItem 及全部存储，页面仍可点选/输入，有可见降级说明；读、写、删除保护分别回退后取得红态。

以上为新行为合同的预期红态，不宣称父版本已有缺陷。真实模型、独立试用与 Astra 审查由主控另行安排。

## Resolution

2026-10-13 Astra 对 `a47c036` 的 NO_GO 已按本轮授权整改，复现记录 `artifacts/t162/astra-*` 原样保留。**本轮修复与确定性验证 PASS；整票验收 INCOMPLETE，等待主控安排复审和真实模型验证**。不推送、不关票，不调用真实 DeepSeek，不自行开启审核实例，不打开 BaoCut 参考目录或复制/改写其源码。

三项修复都在工作台层：历史回看时四个快捷按钮停用，sendEdit 拦住当前版本编辑并提示回到当前版本重新点选；目标切换后通过 textarea ref 显式聚焦；点选记录的 localStorage 读、写、删除均捕获拒绝，保留内存点选及可见提示，状态清理不依赖存储成功。spec、CONTEXT 与 AGENTS 已同步。原局部提交入口、范围检查和事实合同保持。

本轮父版本为 `a47c036a067a39aaca3c2e14abd1cfa585cc5715`，本票与修复同一提交；最终 SHA 与检查时间见 `artifacts/t162/review-receipt.json`。共同进程环境：`SITE_STORE=fs`、显式 `SITECRAFT_BASE=http://127.0.0.1:3192`、替身 `DEEPSEEK_BASE_URL=http://127.0.0.1:3193`、`DEEPSEEK_MODEL=local-only` 及本机 CHROME_PATH。认证占位只在进程环境，不载入 `.env.local`，全量不设置全局 SITECRAFT_DATA_ROOT。应用与替身启动命令仍为 `npm run dev -- --hostname 127.0.0.1 --port 3192` 和 `SITECRAFT_FIXTURE_BASE=http://127.0.0.1:3193 node --experimental-strip-types scripts/t162-model-fixture.ts`。

| 本次证据 | 命令、完成时间（UTC，2026-10-13） | 结果 |
| --- | --- | --- |
| 三项行为红态 | `node --test --experimental-strip-types tests/t162-review-regressions.test.ts`；`review-baseline-red.log` 的 P1/P3 和 `review-focus-red.log` 的 P2 | 实际出现当前 v3 编辑请求、第二目标输入为空/焦点留在 iframe、存储拒绝崩溃；不是入口文案失败 |
| 独立修复回退 | `node --experimental-strip-types scripts/t162-review-counterfactual.ts`；16:18:23；`review-counterfactual-final.log` | 六个窄变异分别红态，结束即恢复修复；逐项日志及命令在 `review-counterfactual-1791908252854/` |
| Chrome 进程前置检查 | `review-chrome-preflight.txt`；16:19:57 | 其他 Chrome/测试进程为 0，随后运行全量 |
| 全量测试 | `T162_LABEL=review-final npm test`；16:22:12；`review-full-test.log` | 427/427，通过；0 跳过，含三项新增回归及 T-152 范围检查 |
| 类型检查 | `npm run typecheck`；16:19:58；`review-typecheck-final.log` | 通过 |
| 构建 | `npm run build`；16:24:12；`review-build.log` | 通过 |

修复回退按责任分别验证：`history-send` 去掉发送保护后观测到真实 chat 请求；`history-buttons` 只去掉四按钮停用后断言失败；`focus` 只去掉目标切换聚焦后真实输入进不了意见框；`selection-read`、`selection-setItem`、`selection-removeItem` 分别去掉存储保护后出现未捕获错误。注入器记录被拒的方法，避免把 Chrome 仅显示「Uncaught」当作完整拒因；回退脚本核对各项失败原因，不把设置/超时错误算作红态。恢复后原断言在全量中全绿，三个新用例覆盖三档历史回看、三档连续点选、四种存储拒绝。

本次截图分两包，共 20 张，全部逐张打开：`review-final-1791908438075/` 是原单条流程的三档输入/恢复、越界/模型/传输失败保留；`review-final-1791908438512/` 是三档历史拦截、三档连续点选及 getItem/setItem/removeItem/全部存储拒绝。两包中的 JSON 为对应本次观察与提交检查，合法局部修改仍有三档共 6 个页面/宽度检查通过。截图检查不代替独立体验或审美判断。

旧产物和本轮失败均保留，旧 `receipt.json` 不改写成本轮证据。`review-baseline-red.log` 的初次 P2 停在离屏旧外框，随后 `review-focus-red.log` 才取得有效焦点红态；`review-fixes-green.log` 的 768 指针在滚动更新前被浮层挡住，等待滚动定位完成后仍用真实指针命中；首次 `review-counterfactual-run.log` 的存储阶段因失败截图检查阻断清理及拒因缺失而不计有效红态，修正测试清理及外部故障记录后才得到完整六项回退证据。没有放宽行为断言、换公司或自动重试模型。

主控待办：Astra 复审、新实例试用、真实单条修改预算报批及执行；这些仍未执行，整票与审美不标 PASS。

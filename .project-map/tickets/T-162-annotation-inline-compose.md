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
11. 手机定位不能被意见面板挡住：完成一次修改、切产品页、从线程定位回首页旧版本；375×1000、预览宽度 375 下，目标标题、正文和链接必须在实际可见区域且不被意见面板遮挡，真实滚轮仍能查看目标。
12. 收起回看面板不能丢上下文：收起后高亮与原意见摘要仍可见，展开恢复同一线程与目标；375 的遮挡和收起丢失分别在当前 `55cf192` 上取得红态，1440/768 作为对照。
13. 目标滚出视野不能带走意见面板：1440/768/375 点选首屏标题并输入意见，以真实 CDP mouseWheel 滚到目标完全离屏；面板、textarea 和操作按钮仍完整位于视口内，原意见保留，真实指针继续输入及添加可用。在 `1825142` 上取得 1440/768 顶部截断红态，375 为不回退对照。
14. 标准测试不能依赖外部模型环境：普通同目录 dev server 与测试进程均无 DEEPSEEK_*，只设 SITECRAFT_BASE/CHROME_PATH 跑全量；测试内自建随机端口替身，夹具和批注发送仍经过生产提交入口。503 health 仍须核对同目录身份，不跨工作树写数据；临时服务和任务在测试结束时关闭。父 `88b40d6` 的全量已取得 13 项缺模型配置红态。

以上为新行为合同的预期红态，不宣称父版本已有缺陷。真实模型、独立试用与 Astra 审查由主控另行安排。

## Resolution

2026-10-13 主控在 merge `1389c55` 的标准命令中发现 T-162 依赖预先设置的替身环境；原日志 `/Users/luckye/Documents/Code/sitecraft-ai/artifacts/merge-1389c55/test.log` 保留。**本轮测试自足修复与本地验证 PASS；整票验收 INCOMPLETE，实际 Next after 集成、独立复试、Astra 复审和真实模型验证由主控决定/安排**。不推送、不关票，不调用真实 DeepSeek，不开审核实例，不读取 BaoCut 参考目录。

本轮父版本 `88b40d6733ceb31933be1b6c71fb4aa0b5c99c99`，最终 SHA 与命令/时间见 `artifacts/t162/self-contained-receipt.json`。本次仅改测试、替身共用实现和文档，产品代码与提交入口不变。helper 自建两个随机端口的本地服务：模型替身，以及调用生产 chat/history POST 的 HTTP 服务。浏览器只把这些模型相关请求交给后者，保留原 body 和真实 HTTP 响应；调度沿用 T-152 的受控 after，执行原任务、事实核对、范围检查、唯一提交入口和存储。不伪造任务/版本、不跳过用例，不把环境依赖藏成成功。阻断传输的回归仍阻断实际请求地址。

普通 dev server 提供界面、预览、站点创建、批注读写和版本读回；测试进程的本地模型设置不会改变它的环境。health 的 testIdentity 取决于开发模式，模型未配置时虽返回 503，cwd 仍须等于当前运行目录；跨树仍拒绝写入。每次夹具提交后，普通服务的 draft GET 须读到相同版本。本树验证前后 health 都是 503/configured=false；本次只读主目录 3034 的 health 得到正确主目录 cwd，但当前 configured=true，所以无模型标准验证使用本树 3192。记录分别为 `self-contained-health.json`、`self-contained-health-after.json`、`self-contained-main-health.json`。

验证前清除启动进程中的 DEEPSEEK_*、AI_*、SITE_STORE、SITECRAFT_DATA_ROOT 和 T162_LABEL，不载入 `.env.local`；dev server 与 npm test 只设置 `SITECRAFT_BASE=http://127.0.0.1:3192` 和 AGENTS 指定 CHROME_PATH。开发服务命令 `npm run dev -- --hostname 127.0.0.1 --port 3192`。替身认证占位只在测试进程环境，不使用真实密钥。

| 本次证据 | 命令、完成时间（UTC，2026-10-13） | 结果 |
| --- | --- | --- |
| 父版本标准全量红态 | `SITECRAFT_BASE=… CHROME_PATH=… npm test`；19:40:18；`self-contained-red.log` | 433 项，420 通过/13 失败；13 项均为夹具提交时缺模型配置，0 跳过 |
| 首次修复验证 | `node --test --experimental-strip-types tests/t162-inline-annotation.test.ts tests/t162-mobile-reveal.test.ts tests/t162-review-regressions.test.ts tests/t162-scroll-edge.test.ts`；19:42:57；`self-contained-focused.log` | 11/13；两个撤销仍走无模型普通服务，422；日志和失败截图保留，随后在生产 history POST 层补齐测试内模型环境 |
| 全量前置检查 | `self-contained-green-preflight.json` | 无其他 Chrome/测试进程 |
| 标准全量绿态 | `SITECRAFT_BASE=… CHROME_PATH=… npm test`；19:48:18；`self-contained-green.log` | 433/433，0 失败/0 跳过；T-162 全部 13 项浏览器用例通过 |
| 类型检查 | `npm run typecheck`；19:45:00；`self-contained-typecheck.log` | 通过 |
| 构建 | `npm run build`；19:48:45；`self-contained-build.log` | 通过 |
| 收尾 | 核对 cwd 后 `kill -TERM 5908`；19:50:38；`self-contained-cleanup.json` | 临时服务和测试进程已结束，本树无残留 dev server，3192/3193 无监听，Next dev 锁已释放 |

最终三档截图四包共 35 张，全部逐张打开：`self-contained-1791920742183/`（输入、恢复、发送及失败保留 10 张）、`self-contained-1791920742932/`（手机定位/收起及对照 6 张）、`self-contained-1791920747502/`（历史/焦点/存储 10 张）、`self-contained-1791920757740/`（三档真实滚轮 9 张）。首次修复验证四包 `self-contained-1791920527659/`、`…27662/`、`…27666/`、`…27667/` 共 30 张也逐张打开；成功片段不冒充整次通过。原失败、旧 receipt 和此前修复证据均保留。

实际 Next after/服务端模型出口的边界未由本次入口测试证明。若主控要补这部分，应另起隔离服务并配置本地替身，在全新 Chrome 页中直接操作，不加载 helper 的 fetch 转发；普通主服务保持不变。前置条件：SITECRAFT_BASE、SITECRAFT_FIXTURE_BASE 分别为已选本地 HTTP origin，SITECRAFT_PORT 为对应应用端口，CHROME_PATH 按 AGENTS 设置，SITECRAFT_FIXTURE_AUTH 仅在终端提供无秘密的替身认证占位。可复现命令（两个终端共享这些进程变量）：

```sh
node --experimental-strip-types scripts/t162-model-fixture.ts
SITE_STORE=fs DEEPSEEK_BASE_URL="$SITECRAFT_FIXTURE_BASE" DEEPSEEK_API_KEY="$SITECRAFT_FIXTURE_AUTH" DEEPSEEK_MODEL=local-only npm run dev -- --hostname 127.0.0.1 --port "$SITECRAFT_PORT"
```

随后直接打开 `$SITECRAFT_BASE/workspace?site=<本次 send.json 中的合法夹具 id>`，点选区块 → 写一条意见 → 添加 → 发送，检查新版本及批注线程；不要用未点选整页写作（替身明确拒绝）。此项命令/前置条件交主控决定，本轮未执行。真实 DeepSeek 单条修改仍须主控另行报批；独立试用与审美不标 PASS。

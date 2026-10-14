---
id: T-163
title: 圈选与多条批注草稿管理
type: build
status: open
blocked_by: [T-162]
claimed_by: Codex (t163-area-drafts)
supersedes:
---

## Why

T-161 第 2 步。用户常常一次看出好几处问题，需要先全部记下再逐条处理；有些问题不是一个区块，而是一片区域。

## What to build

只取 BaoCut 的画板批注部分，把它做得好的地方融进我们的批注。可以参考 `artifacts/annotation-planning-20261012/reference/` 里的 `area-drawing.tsx`、`canvas-controller.tsx`、`annotations-token.tsx`、`design-annotations.ts`、草稿 store，剪辑等其余部分不碰。改写进来的代码在文件头标明来源，并在 `resources/baocut-annotation/SOURCE.md` 记录来源与许可（见 T-161 规划审查第 1 条）。

1. 批注模式下拖动画框：超过移动阈值才算圈选，可以按 Esc、pointercancel 或失焦取消；不做缩放手柄。系统算出框内覆盖的区块和具体元素：只覆盖一个区块时，等同点选并附带多个元素提示；跨多个区块时列出这些区块，请用户收窄到一个。框的坐标只用于显示，不发给模型。
2. 允许连续添加多条草稿；草稿列表可以编辑、逐条移除、回到预览定位。编号按列表顺序显示，预览上的编号和列表一一对应。
3. 从列表里选一条发送；发送期间新增的草稿保留，成功只归档发出去的那一条。版本变化后的处理同 T-162。
4. 同步 `spec.md`、`CONTEXT.md`。

## Acceptance

- [x] 失效方式清单（滚动或缩放中拖动、反向拖、极小框、跨区块、IME、发送中新增、换版本）先写好，测试先在父版本上失败
- [x] 真实 Chrome 真实指针操作，1440/768/375 截图逐张看过
- [x] 改编自 BaoCut 的文件都有来源标注，SOURCE.md 已建；不调用 DeepSeek；局部修改沿用 T-162 已验证的路径
- [ ] 新审核实例按任务脚本试用多条草稿；Astra 审查通过；typecheck、test、build 通过

## 失效方式与测试合同

实施前列定（2026-10-14；父版本 6e0ccfe），以下是新行为合同的预期红态：

1. 圈选：真实指针正向/反向拖动同一区块内标题和正文，得到同一修改范围及多个元素提示；极小移动仍按点选处理，不生成空区域。坐标不进入发送请求。
2. 拖动期间滚动、预览缩放、Esc、pointercancel 或窗口失焦必须取消未完成框，不留下错误目标或意见框；普通浏览保留链接、选字及滚动。
3. 跨区块框列出覆盖区块，未收窄前不能添加/发送；选择其中一个后只保留该区块内元素提示，不扩大 T-162 修改边界。
4. 连续添加、编辑和移除：至少三条独立意见，编辑不改列表位置，移除只删一条；列表与预览编号按剩余列表顺序对应，同区块多条编号也须可分别操作。
5. 输入：IME 组合输入不被快捷键截获；Enter 换行，Ctrl/⌘+Enter 添加，空意见不添加。选择别的草稿回看不得改写原草稿。
6. 发送：明确选择其中一条，重复点击不能多发；任务暂停期间仍可点选/圈选并新增草稿。成功只归档冻结条目，失败保留条目及拒因，不能用发送时的旧数组覆盖新草稿。
7. 刷新及换版本：本站点全部草稿、编号和元素提示恢复，不串站；版本变化保留旧意见，禁止发送，回看旧位置，重新点选逐条确认；冻结条目不可编辑或移除。
8. 服务端逐项核对多个元素的路径、标签和快照；任何一项失效必须在模型调用前拒绝，模型仍只见选中区块、相关 CSS 与元素提示。

验收命令读取 SITECRAFT_BASE/CHROME_PATH，夹具经既有生产提交入口保存到本工作树独立测试目录；不调用 DeepSeek。父版本失败日志与后续同命令结果保存在 artifacts/t163/；真实指针覆盖 1440/768/375，截图逐张打开。独立试用与代码审核由主控安排，本执行实例不自开。

## 独立试用任务脚本

主控另开未参与实现的 sol 实例，在本票最终提交上试用；不以执行者自查代替审核。应用 origin 由 SITECRAFT_BASE 提供，站点使用本票验收夹具，不接真实模型。

1. 1440 下进入批注，反向圈住深层纸袋的标题和正文，写第一条意见；点另一处写第二条，再回同一区块写第三条。核对修改范围、元素提示与编号。
2. 从列表编辑第二条、移除第二条，确认第一/第三条及原位置保留，预览编号变为 1/2；点编号回看第三条。刷新并跨页回看。
3. 跨两个区块拖框，核对范围提示并收窄；拖框期间用 Esc、滚轮或更换预览宽度取消，不得留下错误目标。输入中文、Enter 换行、Ctrl/⌘+Enter 添加。
4. 经本地替身暂停第二条发送，在预览新增第三条，放行任务；核对成功仅归档第二条，其他意见仍在且旧版本需重新点选。另跑越界拒收，确认意见、拒因和发送期间新增条目都保留。
5. 在 768 和 375 重复连续添加、列表编辑/移除、编号回看与刷新；375 仍留在预览写意见，面板与按钮可操作，不横向溢出。

分别报告点选/圈选、范围理解、编号对应、回看、窄屏完成和失败保留的 PASS/NO_GO；审美结论及代码审查由主控安排，执行者不宣布通过。


## Resolution

2026-10-14，基于父版本 `6e0ccfe9bd560b72573641e59ca4cb06c3f8fe65` 完成圈选、多条浏览器草稿及逐条发送。**T-163 功能测试 PASS；整票 INCOMPLETE：全量 467/475，8 项既有测试路径失败；独立试用与 sol 代码审查待主控安排，票保持 open。** 本次功能提交包含本 Resolution，提交 SHA 与收尾状态记录在 `artifacts/t163/receipt.json`；不推送。

拖框使用屏幕移动阈值，正向/反向归一；Esc、原生 pointercancel、滚轮、blur 与缩放取消未完成框。缩放在抬起时也核对实际视口及 iframe 宽度，防止 resize 回调尚未执行时提交旧坐标。覆盖内容按区块归组，直接文字与 blockquote 同样参与；跨区块先收窄，多个元素逐项核对后传入既有局部写作。坐标不存入目标、不发模型。连续添加保持批注模式，已保存的编号仍可回看；编辑保留顺序，移除仅影响选定条目。发送快照按 ID 与提交标识冻结，完成、拒收及丢失 HTTP 回复均更新当前集合，保留发送期间新增的意见。

BaoCut 只参考票中列出的画板文件；两个改编组件已标来源，`resources/baocut-annotation/SOURCE.md` 保留版本、改编范围、版权和许可全文。不引入状态库、字体或其他 BaoCut 功能。同步了 spec、CONTEXT、单区块局部合同及相关 AGENTS/mainline 说明。本次未调用 DeepSeek、未载入 .env.local、未写主目录 .sitecraft-data，也未自行开审查实例。

本次应用 origin 为 `SITECRAFT_BASE=http://127.0.0.1:63567`，普通同目录 dev server 使用 `SITE_STORE=fs`、`SITECRAFT_DATA_ROOT=/Users/luckye/Documents/Code/sitecraft-ai-t163/artifacts/t163/data`；CHROME_PATH 为任务指定的 `chrome-headless-shell` 154.0.8037.92 完整路径。测试与脚本只读显式 SITECRAFT_BASE，不回退其他工作树。模型替身和生产 POST 的临时 HTTP 服务由既有 T-162 helper 自建随机端口并在 test.after 关闭；UI、预览及持久化读回来自普通服务。此证据不宣称真实 DeepSeek 或实际 Next after 集成通过。

父版本红态与最终证据（时间均为 UTC）：

- `node --test --test-concurrency=1 --experimental-strip-types tests/t163-elements-contract.test.ts tests/t163-model-elements.test.ts tests/t163-area-drafts.test.ts`：父版本 9/9 预期失败，`parent-final-red.log`（05:15:05）。圈选元素缺失、跨区块未收窄、多草稿被阻止、发送中不能新增、模型提示缺失及失效元素未拒绝均符合新行为红态。先前 `parent-browser-red.log` 原样保留。
- 同一测试文件用 `--test-name-pattern='自由 HTML'`、`--test-name-pattern='选择第二条'` 和 `--test-name-pattern='三条草稿：1440'` 分别在父版本失败：`parent-free-red.log`（05:16:02）、`parent-send-red.log`（05:22:00）、`parent-continuous-red.log`（05:42:49）。最后一项明确为添加后模式 false 而要求 true。临时回退仅涉及本实例改动的六个文件，在内存保存当前文本，串行测试结束即恢复；没有复制源码作为证据。
- 当前代码全量：上述 SITECRAFT_BASE、SITE_STORE、SITECRAFT_DATA_ROOT、CHROME_PATH，加 `T163_LABEL=full T162_LABEL=t163-full npm test`。05:58:06 结束，205.6 秒，**467/475，8 失败、0 取消、0 跳过**，退出码 1，`full-test.log`。T-163 十项全部通过，T-162 元素、就地输入、冻结发送、历史回看、连续点选、存储拒绝、手机定位与滚轮边界回归全部通过。最终连续添加修复、局部合同及样式改动均已在这次全量之前落定。
- `npm run typecheck`：05:54:42 通过，`typecheck-final-delivery.log`；`SITE_STORE=fs SITECRAFT_DATA_ROOT=… npm run build`：05:58:48 通过，`build.log`。UTF-8 严格回读、diff 检查和 project-map status 通过，未改依赖。

八项全量失败属于五个未改的文件：site-delete（2）、site-images（1）、t136-session-summary（3）、t145-code-only-entry（1）、t145-legacy-import（1）。它们读取默认 `.sitecraft-data` 或临时 cwd 下的默认目录，运行时则依照显式 SITECRAFT_DATA_ROOT 写入，导致路径存在性断言失败或 ENOENT；存储入口尊重配置，测试读取路径未一致。该范围由 T-167 负责；不修改其文件，不合入主线、不换目录重跑来绕过失败。主控整合相关修复后再验全量。

本次 `full-1791957324668/` 的 14 张圈选/草稿截图和 `artifacts/t162/t163-full-*/` 的 35 张回归截图均逐张打开；三档新列表、预览编号、375 对话输入、实时拖框、跨区块选择、冻结新增、版本重选及拒收/HTTP 失败均有可见内容。成功站点 `6d290f61-fa17-4358-a594-19d7bde20b36` 的提交入口通过 6 个页面/视口检查，冻结目标携带标题 `[0]` 与正文 `[1]` 两项提示，见 `full-1791957324668/send.json`；越界拒收不新增版本。截图只核对技术状态，不作为自评审美通过。父版本及失败运行截图同样保留并打开。

限定与失误均保留：headless target 切换未产生实际失焦（focus.json 为 focus=true/events=[]），因此 blur 仅用浏览器受控 FocusEvent 核对边界，拖动仍为真实指针，不宣称实测系统窗口失焦；Meta+A 在该 CDP 输入下未选全文，测试改用 Chrome 原生 selectAll 编辑命令并断言实际替换结果。原 `green-1.log`、`focus-diagnosis.log`、`green-2.log` 保留；其中缩放抬起早于 resize 的失败在根因层修复。一次 `blur-red.log` 在 ps 已有其他工作树测试时误启动，试图停止时已自然结束，未操作其他进程，该次不作验收证据。最终全量开跑前已向主控报告并确认无其他 Chrome/node --test。

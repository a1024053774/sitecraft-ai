---
id: T-128
title: 新路线最小闭环：模型写三页 → 底线检查 → 版本 → 对话修改 → 撤销
type: build
status: open
blocked_by: []
claimed_by: t128-build
supersedes:
---

## What to build

用户在工作台新建站点（沿用现有资料上传、图片和需求对齐），确认后模型按核心规范加一个风格，直接写出首页、产品、联系三页的站点代码（页面可并行生成）。写完经唯一提交入口：去掉脚本和外部资源 → 底线检查（事实对照资料、图片只用已上传的编号、无空链接、375/768/1440 不横向溢出、正文对比度）→ 不过就把问题交回模型修，最多两轮，仍不过在工作台如实说明 → 存成版本。预览在禁脚本沙盒里显示当前版本。用户在对话里说一句修改（例如「首屏换成深色」），模型直接改代码，经同一入口存成新版本；点撤销回到上一版（撤销也是新版本）；刷新后显示当前版本。工作台显示生成进行到哪一步，刷新后继续显示。

本票只做中文。核心规范以 `artifacts/route-probe-2026-10-07/guide.md` 为初稿，风格先做「精密工程」「现场实拍」两个。不做：版本历史面板、风格卡、批注、快捷按钮、截图打磨、模板味检测、英文、删除旧路径（各有后续票）。旧路线在本票期间不改动。

## Acceptance

- [x] 用真实 DeepSeek 在工作台跑通 export 和 molding 两家模拟公司：生成三页、对话改一句、撤销、刷新，全程截图（1440/768/375）并逐张看过
- [x] 底线检查有一个反例证据：人为让一页带外链脚本或资料里没有的数字，提交入口拦下并交回模型修，或如实告诉用户
- [x] 版本记录可读：每个版本有作者、一句话摘要、检查结果；撤销后上一版内容完全恢复
- [ ] 独立评审（gpt-6.1-sol 新实例）把两家公司新旧路线的首页放在一起盲比，结论写进 Resolution
- [ ] Astra 代码审查通过；`npm run typecheck`、`npm test`、`npm run build` 通过

## Resolution

执行者：t128-build。本次三项修复执行验收 PASS；对应 Astra 对 e30d905 的收窄复核 NO_GO，原 3/4/5/7 用例已通过，但并排卡片误拦、shorthand 与嵌套变量生成文字漏检尚需修复。T-128 总体验收仍 INCOMPLETE，独立盲评与 Astra 再审由 Claude 安排，保持 open、不推送。实现、测试和当前文档同一个本地提交，定位：`git log -1 --format=%H --grep='^fix: measure T-128 rendered text by layout context$'`。

### 当前实现

新路线仍是模型写每页 HTML、公共页头页脚和一份 CSS，经同一提交入口清理、底线检查、完整存版。此前两轮修正上限、baseRevision 冲突 409、确认删除及预览 404、统一字体度量与标题祖先、嵌套 CSS 保留或明确拒绝、语义豁免、列表读取代码站点名称与时间等修复保留。本批未改生成提示、核心 skill 或存版逻辑，没有加兼容层、双写、依赖或平行 API。

| 本次审查项 | 根因修复 | 当前红/绿证据（artifacts/t128/ 下） |
| --- | --- | --- |
| P1 正常并排卡片误拦 | 每个文本节点归属最近块级或独立排版容器，含 inline-block、inline-flex、inline-grid 与 flex/grid 子项；在各容器内用 Range.getClientRects 取行宽和字数，不跨容器按纵坐标合并 | review3-red.txt：inline-block/inline-flex 的三个独立 18 字行被合成 54 字；review3-mutants/inline-contexts-red.txt、independent-grid-items-red.txt、long-body-red.txt；三列卡片通过与 54 字长单段拒绝成对检查 |
| P2 shorthand 变量漏检 | 渲染后对 display:list-item 读取计算后的 listStyleType，对每个元素读取 ::before/::after/::marker 的 content；其中字符串与 HTML 文字共用数字和事实检查，decimal/disc 等标准结构序号放行 | review3-red.txt：shorthand 的 840271 被存版；review3-mutants/rendered-markers-red.txt、generated-pseudos-red.txt、generated-fact-audit-red.txt；无来源数字/保修文字拒绝与 decimal/资料内文字通过成对检查 |
| P2 嵌套变量漏检 | 浏览器负责解析变量、shorthand 与嵌套，删除原声明文本判词、变量收集和传播分支，仅保留一套渲染文字检查 | review3-red.txt：嵌套变量的 840271 被存版；review3-mutants/rendered-markers-red.txt；嵌套变量拒绝与 decimal 通过，attr 正常文字和无生成文字通过；authored-content-ban-red.txt 证明恢复旧声明禁令会误拦 |

CSS 资源和不安全语法清理、嵌套规则序列化保留；CSS 生成文字不再被一律清除，而是核对资料。事实校对调用只执行一次，输入包含 HTML 和三档渲染收集的生成文字。未修改旧路线的测试来兼容新行为；本票先前的 CSS 测试按主控新契约改为断言无来源数字禁止存版，移除本机 Chrome 已忽略、不实际生成文字的 symbols() 写法反例。浏览器计算样式的观察输出是 review3-css-probe.txt，包含 shorthand、嵌套、attr 与 marker；这只是诊断，不作为绿证据。

### 本次验证

环境：SITE_STORE=fs，真实应用服务 http://127.0.0.1:3138，health 的 cwd 对应本工作树。CHROME_PATH 使用 `/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell`，只关闭自有浏览器进程。

- 失败方式在 tests/t128-code-boundary.test.ts 中先列出：独立并排容器被合并，shorthand/嵌套隐藏生成事实；判读依据是每张卡 18 字、单段 54 字，以及资料没有 840271 和终身保修。42 项相关检查走真实 API handler、提交入口、文件存储和 Chrome；仅模型 HTTP 与 Next 延后调度在测试进程隔离。
- 原实现红命令：`CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node --test --experimental-strip-types --test-name-pattern=review3 tests/t128-code-boundary.test.ts` → review3-red.txt；e30d905 上 6 项中 4 项失败。grid/flex 在该版本因浏览器将子项块化已通过，当前保留正常用例，并用定向变异验证隔离容器失效时会失败。
- 坏实现：review3-mutation-summary.txt、review3-mutants/result.json 中七项全部 exit 1，逐项 AssertionError 保留。六项变异由 `python3 artifacts/t128/review3-mutations.py` 执行；补充恢复旧 content 声明禁令，attr 正常用例失败（authored-content-ban-red.txt），还原后通过（review3-attr-green-restored.txt）。该脚本现包含七项，支持复现；未用源码副本、哈希或像素比对作证据。
- 当前相关绿命令：`CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node --test --experimental-strip-types tests/t128-code-boundary.test.ts` → review3-green-final.txt，42/42 通过，失败/取消/跳过均 0。包含两轮修正上限、过期写入 409、删除、span、嵌套、正文语义豁免和列表读取等既有回归。
- 实际预览入口：`CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node --experimental-strip-types artifacts/t128/review3-cards-ui.mjs` → review3-cards-ui-final.log、review3-cards-ui/report.json。读取正常夹具经真实 API handler 和提交入口存成的版本，再打开实际应用 code-preview；站点 54af55d4-bf16-4b4e-bcfa-dcbed7e0bf65，版本 f204a283-340f-4f4c-9355-94bbbd01545a。cards-1440.png、cards-768.png、cards-375.png 全部打开看过，三列分别成行，375 各自折行；这是检查器正常夹具，不是本批真实模型生成或审美通过证据。
- 全套命令：`SITECRAFT_BASE=http://127.0.0.1:3138 CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test` → review3-npm-test.txt，2543/2543 通过，失败/取消/跳过均 0、exit 0；`npm run build` → review3-build.txt，exit 0，随后顺序执行 `npm run typecheck` → review3-typecheck.txt，exit 0。

输出完成时间（UTC）：review3-red.txt 2026-10-07T23:30:40.858702+00:00；review3-green-final.txt 2026-10-07T23:38:57.055654+00:00；review3-npm-test.txt 2026-10-07T23:43:01.700555+00:00；review3-build.txt 2026-10-07T23:39:49.671494+00:00；review3-typecheck.txt 2026-10-07T23:39:50.303498+00:00；实际预览 report.json 2026-10-07T23:42:08.996Z。最终候选验证之后没有再改生产代码；补充变异在 finally 中恢复，并立即重跑该用例确认通过。

### 保留的失败与历史

本批截图辅助脚本初次按未序列化的 CSS 字符串查找夹具，因 CSSOM 插入空格未找到版本，失败保留在 review3-cards-ui.log；只改辅助脚本选择器，随后经相同 code-preview 入口得到三档截图，未改产品或绕过提交。

9e0042b、094734d、e30d905 及此前各阶段闭环和失败证据均保留为历史：上一轮 review2-red.txt、review2-mutants/、review2-npm-test.txt、review2-npm-test-final.txt 的失败，与 review2-green-delivery.txt、review2-npm-test-delivery.txt 等修复后结果不混作本次证据；上一轮并行 typecheck/build 的生成类型竞争保留在 review2-typecheck.txt。

最近真实 DeepSeek 两公司完整闭环属于 094734d 的历史证据：astra-export-identity/export-report.json（15a34d20-1b7f-480d-b59b-95a4ce751849，2026-10-07T21:55:47.734Z）与 astra-molding-identity/molding-report.json（4a85a769-0f13-4b27-a66f-49bca3e285cf，2026-10-07T21:56:04.018Z），包含生成三页、对话修改、撤销、刷新及版本作者/摘要/检查记录，69 张截图逐张查看记录为 viewed-identity.json；旧 molding-final 回执也明确为历史证据。本批只改底线检查，未改生成提示或提交入口的存版逻辑，按主控条件不重新跑真实 DeepSeek 全流程，不把旧回执说成本批重跑。

### 已知限制与待验收

主控明确不修 line-height:0 的完全重叠及 filter:opacity 等滤镜后的对比度：它们属于刻意构造的极端写法，本阶段以避免误拦模型正常页面、限制验证工具范围为先，由 T-130 评估集截图与独立盲评兜底，Claude 安排评估和盲评。

独立盲评与 Astra 再审待 Claude 安排，执行者不宣布审美通过、不自行派评审、不关票；此前已记录 molding 375 页头导航换行较碎，未做本票禁止的截图打磨。外部邮件送达与生产 PostgreSQL 未实测，不作为本票阻塞项。未加入版本面板、风格卡、批注、快捷按钮、模板味检测、英文或旧路线删除。

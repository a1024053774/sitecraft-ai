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

执行者：t128-build。本次修复执行验收 PASS；本次针对 Astra 对 094734d 的复审 NO_GO 修复主控要求的五项；T-128 总体验收仍 INCOMPLETE，独立盲评与 Astra 再审由 Claude 安排，保持 open、不推送。实现、测试和当前文档同一个本地提交，定位：`git log -1 --format=%H --grep='^fix: reduce T-128 normal-page false rejections$'`。

### 当前实现

新路线仍是模型写每页 HTML、公共页头页脚和一份 CSS，经同一提交入口清理、底线检查、完整存版；两轮修正上限、baseRevision 冲突 409、确认删除及预览 404 等上一轮修复保留。本批未改生成提示、核心 skill 或存版逻辑，没有加兼容层、双写、依赖或平行 API。

| 本次审查项 | 根因修复 | 当前红/绿证据（artifacts/t128/ 下） |
| --- | --- | --- |
| P2-3 span 改变结论 | 同元素和跨元素文本片段统一使用字体 em 矩形；标题语义从最近 h1–h6 祖先识别，门槛仍按实际文字字号/字重决定 | review2-red.txt 的正常 span 行/标题失败；review2-mutants/span-metrics-red.txt、heading-role-red.txt；当前 34 项绿输出 |
| P2-4 有序列表误拦 | decimal、decimal-leading-zero、罗马/字母序号等标准结构序号放行，普通变量引用也保留；只清理字符串、symbols()、content 等任意文案 | review2-red.txt 的标准序号和普通变量失败；review2-mutants/ordered-list-red.txt、marker-variable-red.txt；标准序号保留与任意字符串拒绝成对检查 |
| P2-5 嵌套 CSS 静默删除 | 递归清理并保留 CSSStyleRule 子规则、media/supports 与 CSSNestedDeclarations，保持声明顺序；无法处理则明确拒绝，不默默存 main{} | review2-mutants/nested-style-red.txt、nested-declarations-red.txt、unsupported-nesting-red.txt；正常嵌套与嵌套低对比度成对检查 |
| P2-6 只测 p 行长 | 按承载文本的块测实际文字行，覆盖 div、li、dd、figcaption、blockquote；嵌套块分别测、不重复算父块；显式豁免标题、导航、参数表、按钮/控件、邮箱/电话、声明的型号/参数字段、系统图片署名/许可信息，普通图片说明仍检查 | review2-red.txt 的五类长正文被放过；review2-mutants/body-lines-red.txt、body-exemptions-red.txt、credits-exemption-red.txt；每类长行拒绝与合理折行通过成对检查 |
| P2-7 列表名称/时间 | 在共用 listExistingSites 读取代码站点 name、updatedAt，并据此排序；API、全部站点页与删除列表共用同一读取，旧站仍读旧记录，不双写 | review2-mutants/list-name-red.txt、list-updated-red.txt；列表改名、固定时间、旧记录不变及旧站保留成对检查；review2-list-ui/report.json 和三档截图 |

CSS 嵌套的规则与尾部声明分别保留，语义依据 [CSS Nesting 的 CSSOM 与嵌套声明规则](https://drafts.csswg.org/css-nesting-1/#cssom)，并由本机 Chrome 实际解析/渲染验证。

### 本次验证

环境：SITE_STORE=fs，真实应用服务 http://127.0.0.1:3138；health 的 cwd 对应本工作树。CHROME_PATH 使用 `/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell`，只关闭自有浏览器进程。

- 失败方式先写在 tests/t128-code-boundary.test.ts：合法 span 误拦、标准序号被删、嵌套声明消失、正文换标签漏测、列表读旧种子或双写。原 19 项与本批成对用例共 34 项，走真实 API handler、文件存储和 Chrome；模型 HTTP 与 Next 延后调度仍只在测试进程隔离。
- 红命令：`CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node --test --experimental-strip-types --test-name-pattern=review2 tests/t128-code-boundary.test.ts` → review2-red.txt，094734d 上 12 个正常页面/列表行为失败；保留原输出。
- 坏实现命令：`python3 artifacts/t128/review2-mutations.py` → review2-mutation-summary.txt、review2-mutants/result.json，10 个定向变异全部 exit 1；尾部嵌套声明与图片署名豁免另各有一个独立变异，共 12 个。逐项 AssertionError/失败原因保留，恢复源码后跑绿。
- 当前相关绿命令：`CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node --test --experimental-strip-types tests/t128-code-boundary.test.ts` → review2-green-delivery.txt，34/34 通过，失败/取消/跳过均 0。
- 实际列表入口：`CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node --experimental-strip-types artifacts/t128/review2-list-ui.mjs`。真实 POST 新建代码站点、POST chat 提交公司资料改名、GET 列表、打开 /sites；不确认生成，模型调用为 0。站点 e8c24d03-d1b5-4224-89a7-7e6b16c4355b 显示「复审列表·代码站点」，代码更新时间 2026-10-07T22:57:05.705Z，旧草稿名称/公司名/时间未变。输出 review2-list-ui.log、report.json；sites-1440.png、sites-768.png、sites-375.png 都已打开看过。
- 全套命令：`SITECRAFT_BASE=http://127.0.0.1:3138 CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test` → review2-npm-test-delivery.txt，2535/2535 通过，失败/取消/跳过均 0、exit 0；`npm run build` → review2-build-delivery.txt，exit 0，随后顺序执行 `npm run typecheck` → review2-typecheck-delivery.txt，exit 0。

输出完成时间（UTC）：review2-red.txt 2026-10-07T22:48:01.762457+00:00；review2-green-delivery.txt 2026-10-07T23:08:57.531111+00:00；review2-npm-test-delivery.txt 2026-10-07T23:12:07.937420+00:00；review2-build-delivery.txt 2026-10-07T23:09:35.116067+00:00；review2-typecheck-delivery.txt 2026-10-07T23:09:35.700873+00:00。

### 保留的失败与历史

首轮完整 npm test 已完整结束，2534 项中 3 项失败（review2-npm-test.txt）：系统图片署名和许可证 URL 被当正文误拦；在扫描根因层加语义豁免，未改 T-113/T-117 旧测试。第二轮启动时署名新夹具尚未补上系统实际使用的小字号/长 URL 折行，运行进程读到旧夹具，因此仅该新用例失败（review2-npm-test-final.txt）；修正夹具后，去掉豁免的坏实现仍失败，当前相关检查 34/34 通过。相关失败全部保留，不作绿证据。初次 typecheck 与 build 并行导致 Next 生成类型被清理的竞争，输出 review2-typecheck.txt 保留；改为 build 完成后顺序 typecheck，未改配置或修验证工具。

9e0042b、094734d 及此前各阶段完整闭环与失败证据均保留为历史。最近真实 DeepSeek 两公司闭环是 094734d 的 astra-export-identity/export-report.json（15a34d20-1b7f-480d-b59b-95a4ce751849，21:55:47.734Z）与 astra-molding-identity/molding-report.json（4a85a769-0f13-4b27-a66f-49bca3e285cf，21:56:04.018Z），69 张截图逐张查看记录为 viewed-identity.json；旧 molding-final 回执明确为历史证据。本批只修误拦和列表读取，按主控明确要求不重新跑真实 DeepSeek 全流程，不把历史回执说成本批重跑。

### 已知限制与待验收

主控明确不修 line-height:0 的完全重叠及 filter:opacity 等滤镜后的对比度：它们属于刻意构造的极端写法，本阶段以避免误拦模型正常页面、限制验证工具范围为先，由 T-130 评估集截图与独立盲评兜底，Claude 安排评估和盲评。

独立盲评与 Astra 再审待 Claude 安排，执行者不宣布审美通过、不自行派评审、不关票；此前已记录 molding 375 页头导航换行较碎，未做本票禁止的截图打磨。外部邮件送达与生产 PostgreSQL 未实测，不作为本票阻塞项。未加入版本面板、风格卡、批注、快捷按钮、模板味检测、英文或旧路线删除。

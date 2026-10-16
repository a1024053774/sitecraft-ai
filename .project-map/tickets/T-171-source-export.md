---
id: T-171
title: 导出生成站源码：下载当前版本的静态站点包
type: build
status: closed
blocked_by: [T-167, T-159]
claimed_by: codex-build
supersedes:
---

## Why

负责人 2026-10-14 决定（来源是模拟面试复盘，由改进方案会话转交，构思主控 2026-10-14 确认）：用户应该能把生成好的网站拿走，证明它是一份真实、可独立运行的静态站，而不是只能在 SiteCraft 里看的预览。一键部署仍然不做（「本阶段不做」）。XSS 成对测试作为本票的验收项，不单独开票。「模型不写 JS」已经是现行硬约束（提交入口会去掉所有脚本），本票不改。

## What to build

1. 工作台为当前中文版本提供「下载网站」：一个 zip，内含每页一份完整 HTML、公共 CSS、该版本引用的已授权图片与系统底图、`LICENSES.txt`（系统汇总的图片署名、图标与底图许可）。已经生成英文版时，英文页面放进 `en/` 子目录。
2. 页面内容必须和发布页一致：复用 `lib/code-site-serving.ts` 的同一个静态渲染器，不另写一套导出渲染。站内链接改成相对路径，解压后直接双击 `index.html` 就能在本地浏览，不依赖 SiteCraft 服务。
3. 包里只放该版本真正用到的文件；不含站点资料原文、对话、批注、事实核对出处（T-169）、内部编号表或任何密钥。
4. 导出只读，不新建版本，不经过模型；导出的永远是当前版本，历史版本先恢复成当前版本再导出。
5. 同步 `spec.md`、`CONTEXT.md`（新术语「站点包」）。

## Acceptance

- [x] 先列出失效方式，再按清单写测试，测试先在父版本或 mutant 上失败：导出页与发布页不一致、链接指向 SiteCraft 服务、漏图或多带了未引用的图、`LICENSES.txt` 缺署名、包里混进资料原文或内部数据
- [x] XSS 成对测试：用含 `<script>`、`onerror=`、`javascript:` 链接、`<iframe>`、外部 `url()`、SVG 内嵌脚本的恶意候选，分别走提交入口和导出两条路径。恶意版本在提交入口就被拒，不会存成版本；正常版本导出后的包里，找不到任何脚本、事件属性或外部资源。每一种都和一个正常对照成对出现
- [x] 真实 Chrome 用 `file://` 打开解压后的包，1440/768/375 截图逐张看过，并和同版本的发布页截图对照
- [x] 不调用 DeepSeek；typecheck、test、build 通过；独立审查实例通过

## Resolution

状态：**INCOMPLETE，执行验证完成后仍待主控独立复审**。主控确认上一轮六项已修好，705098d 的 sol 复审剩系统属性选择器与公共 CSS 被 CSP 拦截两项；本节与本次修复代码同一提交，父提交为 705098d，最终 SHA 见交付回复。不推送、不自行开审查，旧红测和审查证据均保留。

- 根因修复：去掉导出专用 stripInternalAttributes 开关，保留与发布页相同的 data-image-id 等系统属性，只改写资源与站内地址。这些属性不是资料、内部编号表或密钥；CSS 的属性选择器和相邻节点选择器保持相同匹配。
- 公共 CSS 与系统样式统一由 renderSiteCodeCss 汇总。发布页只内联一次；导出页只链接实际生成的 styles.css，没有内联样式表副本，CSP style-src 允许 self 及已有的 style 属性。真实 file:// Chrome 已验证修改解压后的文件会改变页面颜色。中英文汇总样式相同时共用文件；旧英文依赖不同样式时使用 en/styles.css，并按该文件位置生成资源相对地址。
- 新增两项失效方式：图片属性丢失造成尺寸/可见性变化；公共样式表不能加载却被重复内联掩盖。标准测试 helper 现在从真实导出 HTTP 入口解包，通过 file:// 和发布 URL 在中文/英文、各页、1440/768/375 逐一比较可见文字、DOM、全部元素矩形与页面宽度，不再用 setDocumentContent 代替离线加载。九类 XSS、资源/许可、敏感元数据、只读与版本不变回归保留；旧英文样式不同的版本链也纳入实际布局比较。
- 红测：未改生产代码的 705098d 上，规定 CHROME_PATH 加 npm test -- --test-name-pattern='file://' tests/t171-source-export.test.ts 两项均预期失败，记录为 artifacts/t167/test-run-1792112124427-96275/；原样运行审查复现文件中的两项（--test-name-pattern='independent attribute selectors|independent exported common' artifacts/t171/independent-review-705098d-v2.test.ts）也均失败，记录为 artifacts/t167/test-run-1792112146037-96682/。两者均通过真实提交、导出与 file:// Chrome，改前图片 1600×1200、隐藏段落出现，修改 CSS 文件后标题仍为原颜色。审查复现产物 artifacts/t171/independent-1792112146828/ 的十二张截图已逐张打开。
- 改后聚焦：同一个标准入口运行 tests/t171-source-export.test.ts，**23/23 PASS**，记录 artifacts/t167/test-run-1792112305289-97804/；原样运行完整审查复现文件 **4/4 PASS**，记录 artifacts/t167/test-run-1792112345220-98377/，测量与十二张中英三档截图为 artifacts/t171/independent-1792112346228/。复跑审查者给的测试不是新的独立审查结论。
- 最终验证（2026-10-16 00:58–01:07 UTC，本次修复工作树）：node --test --experimental-strip-types scripts/t167-runner-regressions.ts **4/4 PASS**，日志 artifacts/t171/style-fidelity-fix/runner.log；规定 CHROME_PATH 加 npm test **576/576 PASS，零跳过**，记录 artifacts/t167/test-run-1792112499533-99192/；npm run typecheck 与 npm run build 均通过，日志分别为 artifacts/t171/style-fidelity-fix/typecheck.log、build.log。聚焦及全量生成的普通站点包三档发布/离线截图共十二张均已逐张打开，全量截图为 artifacts/t171/source-export-69c8189e-94e3-4f94-b9db-bcdbae940c2f/t171-85f74f4dba664ac7a482/；审查复现改后十二张截图也已逐张打开。未作审美或独立审查结论。
- 没有访问 DeepSeek、读取 .env.local、写主目录数据、执行删除命令或进行哈希/字节/像素比对；浏览器、全量与 build 前均核对磁盘和进程。仍待主控安排新的独立复审，故票保持 open，最后一项验收不勾选。

### 关票（主控）

独立审查（均为新 sol 实例）：a111ff9 NO_GO（P1 home/index 都导出成 index.html；P2 中英文署名混用、扫 img_ 文本多打包、图片文件名未过滤并注入 LICENSES.txt、导出写回旧图片元数据、对整个 body 正则替换误删正文）；705098d NO_GO（P1 删除 data-image-id 破坏 CSS 选择器语义，离线页图片 1600×1200 溢出、隐藏段落显示；P2 CSP 拦截 styles.css、靠重复内联掩盖）；1c03ed3 复审 PASS（无 P0–P2；定向 29/29，九类 XSS 成对、敏感数据隔离、只读与版本不变、中英文三档逐页文本/DOM/布局尺寸一致；CSP 实测本地 CSS 生效、脚本/事件属性/跨来源资源被拦）。

主线验证（合并提交 `9954670`）：
- 第一次（2026-10-15 21:19–21:20 EDT）全部失败：主目录 node_modules 缺本票新增依赖 parse5、postcss、postcss-value-parser（typecheck TS2307、build module-not-found、3034 500），日志保留 `artifacts/merge-9954670/`。
- 主目录按锁文件 `npm ci` 后重跑（21:21–21:25 EDT，暂停 3034）：`scripts/t167-runner-regressions.ts` 4/4；`CHROME_PATH=… npm test` **576/576**；清空 .next 后 `SITE_STORE=fs npm run build` 通过；`npm run typecheck` 通过；code-sites 279→279；3034 与真实站 1e472b8b 均 200。日志 `artifacts/merge-9954670/rerun/`。
- 新增运行时依赖：parse5 ^8.0.0、postcss ^8.5.23、postcss-value-parser ^4.2.0（用于在解析后的 DOM/CSS 上处理导出，替代整段文本正则）。


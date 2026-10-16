---
id: T-171
title: 导出生成站源码：下载当前版本的静态站点包
type: build
status: open
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
- [ ] 不调用 DeepSeek；typecheck、test、build 通过；独立审查实例通过

## Resolution

状态：**INCOMPLETE，修复后待主控安排独立复审**。主控报告 `a111ff9` 的 sol 审查为 NO_GO；本节与修复代码同一提交，父提交为 `a111ff9`，最终 SHA 见交付回复，不推送、不自行开审查。

- 失效方式先列在 `tests/t171-source-export.test.ts`：home/index 重名、ZIP 非法/重复条目、两种语言署名混用、正文编号被当图片、上传原名构成路径或许可行注入、读取旧元数据时写回、正文中的属性串被误删，以及九类 XSS 与正常对照。新增测试在未改生产代码的 `a111ff9` 上先得到 9 项预期失败，原始日志与临时数据保留在 `artifacts/t167/test-run-1792110319087-64906/`。
- 根因修复：发布与导出的 `renderSiteCode` 共用 `lib/code-site-dom.ts`。parse5 解析元素树，链接、图片、图标、属性清理仅处理元素属性；PostCSS 和 CSS 值解析器仅处理声明的 URL 节点。正文、注释和 CSS 文字不被当资源或属性，署名按当前语言的实际图片引用收集。
- 页面文件映射预留首页 `index.html`，重名依次加数字后缀并同步站内/语言链接；ZIP 写入前拒绝非法和重复条目。图片文件只用图片编号和 MIME 规范扩展名；`LICENSES.txt` 不使用上传原名。导出按实际引用调用 `readSiteImage(..., {readOnly:true})`，不枚举未引用图片，也不迁移写回旧字段；测试逐文件核对本站点资料、会话、版本与图片的 mtime/大小，没有哈希、字节或像素比对。
- 测试通过真实 `commitSiteCode` 与真实导出 GET；中英文不同图片使用真实三版本链（中文 A → 英文 A → 中文 B、英文仍为 A）。仅该链的事实 HTTP 响应来自随机本地端口的受控替身，其他候选使用既有可信离线导入合同；没有访问 DeepSeek。正常包和同版本同语言发布页逐页比较可见文字和 DOM 结构；九组恶意候选均在提交入口拒绝、不存版本、导出返回 422，正常对照经导出入口检查。
- 主体 20 项的反事实命令：`CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test -- --import=./tests/fixtures/t171-parent.ts tests/t171-source-export.test.ts`。2026-10-16 UTC 得到 20 项中 10 项预期失败，证据在 `artifacts/t167/test-run-1792110678925-72722/`；加载钩子仅在内存读取父版本四个模块，不替换工作树源码或数据根。
- ZIP 末尾换行另有定向用例：上述反事实命令加 `--test-name-pattern='ZIP 拒绝尾部换行条目'` 在父版本得到 1 项预期失败（`artifacts/t167/test-run-1792111123449-82238/`）；校验改为直接拒绝非允许字符，避免正则 `$` 放过末尾换行。
- 改后聚焦命令去掉上述 `--import`，2026-10-16 UTC **21/21 PASS**：`artifacts/t167/test-run-1792111143451-82437/`。最终全量中真实 Chrome 打开解压包 file:// 与同版本发布页的三档截图位于 `artifacts/t171/source-export-27e4bdd5-8398-4582-8f98-aea6e70c6162/t171-95d2bc1d10394cd5aed9/`，六张已逐张打开核对载入与内容；不作审美判断。全部检查前核对磁盘和进程，T-164 有测试进程时等待。
- 本轮源码最终验证（2026-10-16 00:35–00:43 UTC）：`node --test --experimental-strip-types scripts/t167-runner-regressions.ts` **4/4 PASS**（`artifacts/t171/review-fix/runner.log`）；只设规定 CHROME_PATH 的标准 `npm test` **574/574 PASS，0 skipped**（`artifacts/t167/test-run-1792111196402-83065/report.json`、`tests.log`）；`npm run typecheck`、`npm run build` **PASS**（`artifacts/t171/review-fix/typecheck.log`、`build.log`）。上一轮 573/573 及所有红测保留。没有访问 DeepSeek、读取 `.env.local`、写主目录数据或执行删除命令；只撤去 Next 自动追加的重复类型目录，其他配置不变。

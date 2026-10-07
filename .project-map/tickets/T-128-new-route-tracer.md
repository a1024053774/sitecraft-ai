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

执行者：t128-build。本次修复执行验收 PASS；T-128 总体验收 INCOMPLETE，保持 open，未推送。9e0042b 的 Astra 结论为 NO_GO，下面六项已修复，最终候选的独立盲评和 Astra 复审由 Claude 安排。实现、测试和文档另做一个本地提交，定位：`git log -1 --format=%H --grep='^fix: address T-128 review safety failures$'`。

### 修复与证据

| 审查项 | 根因修复 | 本次证据（artifacts/t128/ 下） |
| --- | --- | --- |
| CSS 可见文案 | 清理字符串/变量列表标记、symbols()、非空 content（含 attr）；清理问题拒绝存版，文案放 HTML。Chrome 丢弃的 symbols() 也显式报告 | astra-red-confirmed.txt；mutations-final/mutant-css-*-red.txt；astra-green-measured.txt 的六类独立 CSS 反例 |
| 重叠与不可见正文 | 同元素不同文字行纳入测量；按实际 -webkit-text-fill-color 算对比度；透明填充、背景裁切文字明确拒绝。Range 行位置/横向范围配字体 em 高度，避免把 CJK 字体度量留白当成重叠 | mutations-final/mutant-same-element-lines-red.txt、mutant-actual-fill-red.txt、mutant-transparent-fill-red.txt、mutant-clipped-text-red.txt；normal-lines-confirmed-red.txt；当前 19 项检查见 astra-npm-test-identity.txt |
| 撤销 baseRevision | 客户端发送所见 revision；接口要求非负整数并原样交给提交入口的锁，过期 409、不存版，缺失 400 | mutations-final/mutant-stale-undo-red.txt、mutant-stale-commit-red.txt；两家公司 report 的 stale 区 |
| 删除残留 | 既有输入站点编号确认的删除流程一并删除 code-sites 完整记录（代码版本、资料、运行记录），与提交共用锁；预览同时要求主站点记录存在；已删除的待执行任务不重建资料或对话 | mutations-final/mutant-confirmed-delete-red.txt、mutant-orphan-preview-red.txt、mutant-deleted-job-red.txt；当前 handler 回归检查 |
| 独立反例及上限 | 脚本、外部 CSS 资源、虚构数字分别验证清理与禁止存版；事实必须报告，不能静默擦掉。初稿加两份修正版，第三次失败后 error、版本数 0、对话如实说明 | mutations-final/mutant-script-clean-red.txt、mutant-resource-clean-red.txt、mutant-fact-check-red.txt、mutant-fact-erasure-red.txt、mutant-repair-budget-red.txt；两个 report 的 negatives 区，各自 422、版本数不增加 |
| 最终候选两家闭环 | 同一真实工作台入口，新建 → 资料/图片 → 风格与大纲确认 → 三页 → 对话修改 → 撤销成新版本 → 刷新。没有恢复失败运行、替换资料或静默回退 | astra-export-identity/export-report.json；astra-molding-identity/molding-report.json；两目录下共 69 张截图，逐张打开记录 viewed-identity.json |

复用 visitor-layout-scan 的测量根因已修正；旧区块库、adapter、operation、commitOperations 和旧测试未改，没有新增兼容层或依赖。核心规范增加缺失信息用自然客户口吻或「待补充」的引导，避免「资料未提供」「资料未给」；只改引导，没有加入文案硬过滤。

### 最终候选运行（2026-10-07，UTC）

环境：SITE_STORE=fs；真实服务 http://127.0.0.1:3138，health 的 cwd 为本工作树，模型 deepseek-flash。密钥只由原工作树 .env.local 加载进服务进程。以下 CHROME_PATH 为负责人指定的 `/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell`；独立临时 profile，只关闭自有进程。

- export：`SITECRAFT_BASE=http://127.0.0.1:3138 T128_ARTIFACTS=artifacts/t128/astra-export-identity CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node --experimental-strip-types scripts/check-new-route-flow.ts export`；日志 astra-export-identity.log，回执时间 21:55:47.734Z，站点 15a34d20-1b7f-480d-b59b-95a4ce751849，无图、精密工程。
- molding：`SITECRAFT_BASE=http://127.0.0.1:3138 T128_WITH_IMAGES=1 T128_ARTIFACTS=artifacts/t128/astra-molding-identity CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node --experimental-strip-types scripts/check-new-route-flow.ts molding`；日志 astra-molding-identity.log，回执时间 21:56:04.018Z，站点 4a85a769-0f13-4b27-a66f-49bca3e285cf，现场实拍风格，真实上传两张已准入行业照片。
- 两家都是助手 v1、助手 v2、用户 v3。v2 的实际首屏背景为 rgb(23, 33, 43)；v3 完整内容恢复 v1，restoredFrom 指向 v1，刷新保持 v3。各版本 9 个页面/宽度检查全部通过（共 54 个），溢出、重叠、对比度、行长问题均 0。每家三个独立反例各返回 422，手改与撤销过期请求各返回 409，版本数仍 3。
- `npm run typecheck` → astra-typecheck-identity.txt，exit 0；`SITECRAFT_BASE=http://127.0.0.1:3138 CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test` → astra-npm-test-identity.txt，2520/2520 通过，失败/取消/跳过均 0；`npm run build` → astra-build-identity.txt，exit 0。这些在最终源码与规范改动之后重跑；旧输出不作当前通过证据。
- 新增 `tests/t128-code-boundary.test.ts` 的失败方式先列后测：CSS 漏清、压缩行距、正常中文字体误判、填充色错算/不可测、过期写入、删除残留与修正超限。测试走真实 API handler Request/Response、文件存储和 Chrome；仅隔离 Next 延后执行调度与模型 HTTP 回复，以确定性证明最多两轮修正。当前共 19 项，通过上述 npm test。
- 坏实现验证：`python3 artifacts/t128/prove-mutations.py`；mutations-final/mutation-results.json 和 mutation-summary-final.txt 记录 16 个定向变异各 exit 1，另有 deleted-job 和 fact-erasure 的独立变异输出，共 18 个定向坏实现；正常中文行距的确认红证据另见 normal-lines-confirmed-red.txt。临时变异后恢复源码，再跑当前绿结果。没有削弱断言或修改旧路线测试。
- 六类 CSS 反例同时变异：mutations-final/mutant-css-all-red.txt 的六项各自失败（exit 1），随后恢复源码跑 astra-green-identity.txt，19/19 通过。

### 失败保留与历史证据

- 检查器曾从 JSON 健康接口建立文档，候选 HTML 被当纯文本。现从禁载应用脚本的 HTML 文档建立同源检查环境，渲染后验证候选页面实际挂载；坏实现见 mutations-final/mutant-html-measurement-red.txt。
- 实测 molding 大纲超过既有 outline 800 字上限：astra-molding-final/failure.txt、failure.png 与对应日志。现将既有大纲字段长度合同交给模型，不截断、不放宽 schema、不自动重试。
- 同元素测量最初把 PingFang 留白误判为重叠：astra-molding-bounded/failed-layout.json、failed-candidate-375.png，原标题 25px、行距 33.5px 却报告 2.5px 重叠。正常行距的红/绿与 20px/4px 必拒绝同时验证；较早默认字体未复现的 normal-lines-red.txt 不当红证据。
- 事实校对曾要求补回被核心规范禁止的核验记号（audit-metadata-conflict-red.json），astra-export-measured 因矛盾反馈两轮后仍失败、未存版；现明确元信息必须省略，不因其缺失报告企业事实缺失。astra-molding-release/failure.txt、failure.png 保留完整公司名被缩短的失败；引导和校对现保留企业名称/型号，只去除明示核验记号的完整值，原验收断言未放宽。
- astra-export-bounded/failure.png 保留恢复被事实检查拒绝的用户提示；脚本等待撤销完成超时，版本仍为 2，不是成功闭环。旧首版在恢复时被指出改换“加工能力/主设备”的事实标签及交期表述，未绕过检查或强行恢复。
- astra-red.txt 的早期模型测试桩格式错误不是回归红证据；astra-red-confirmed.txt 才复现审查问题。第一次透明绘制测试只断言“拒绝”时变异存活，mutation-summary.txt 保留原结果；现断言无法测量的未知结果，对应变异失败。后续所有失败产物保留。
- 旧 molding-final/molding-report.json（fc0306f3-e13d-4cce-b888-699d32b95003，20:10:26Z）及 fact-edit 回执明确为 9e0042b 时期历史证据；旧 export-delivery（ee87cb60-6f3e-4277-8b76-3027aff7d1fe，20:44:56Z）、real-flow、export-continued 和本次较早的 astra-*-final/bounded/measured/release 也仅保留历史或失败证据，不替代最终 identity 回执。

### 尚未完成与限制

独立盲评与 Astra 复审未通过，执行者看图不等于审美通过。自查 molding 375 页头导航换行较碎（molding-home-375.png），已如实回报，未做本票禁止的截图打磨。事实校对是模型判断，实际通过结果不代表完备性证明，仍需独立验收。外部邮件送达与生产 PostgreSQL 未实测，不作为本票阻塞项。没有加入版本面板、风格卡、批注、快捷按钮、截图打磨、模板味检测、英文或旧路线删除。

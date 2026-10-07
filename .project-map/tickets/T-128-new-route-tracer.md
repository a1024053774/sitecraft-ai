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

执行者：t128-build。交付状态：INCOMPLETE（独立盲评与 Astra 审查由 Claude 安排；票保持 open，未推送）。实现与本文同一个本地提交，提交定位：`git log -1 --format=%H --grep='^feat: implement T-128 model-written site route$'`。

### 实现

新建工作台站点保存站点代码记录，复用资料/表格读取、图片上传与许可记录、会话及结构化选项校验、DeepSeek 配置。运行时加载核心规范与精密工程/现场实拍风格。大纲确认后直接写每页 HTML、共用页头页脚和 CSS；后台步骤持久化，刷新观察同一个运行。所有存版与恢复经 `commitSiteCode`，先清理资源，再检查图片编号、链接、事实数字、三档布局与对比度、正文行长及企业事实。拒绝交回模型最多两轮，失败保留候选与检查结果、明确显示，不回退。完整版本记录作者、摘要、请求、检查结果；撤销生成新版本。

图片由系统解析编号与署名，询盘表单和图标由系统提供，预览双重 CSP/iframe 沙盒禁脚本与同源权限。用户明确补充的事实进入有效请求链；恢复同时恢复资料链，后续修改不重新采用已撤销的事实。旧区块库、adapter、operation 与 commitOperations 未修改或删除；API 仅增加新路线分流。未添加依赖。

### 验收证据（2026-10-07，UTC；本次工作树）

运行环境：开发服务 `http://127.0.0.1:3138`、SITE_STORE=fs、模型 deepseek-flash。密钥仅由原工作树 `.env.local` 加载进服务进程。浏览器为用户指定的 chrome-headless-shell 154.0.8037.92，独立临时 profile，只停止本次自有进程。

- 创建入口先红后绿：`SITECRAFT_BASE=http://127.0.0.1:3138 node scripts/check-new-route.mjs`；`artifacts/t128/contract-red.txt` 在实现前因缺少 codeSite.route 失败，`contract-green.txt` 通过；首次服务未就绪的连接失败另存 `contract-before.txt`，不当契约反例。
- export 的早期完整闭环：站点 `c6c53af6-c040-4aa3-9b96-38cadb15a304`，无图/精密工程。生成阶段见 `artifacts/t128/real-flow-4/`；修复截图脚本在禁脚本文档中等待 requestAnimationFrame 的错误后，继续同一已存版站点，未重新生成或替换卡片。命令 `SITECRAFT_BASE=http://127.0.0.1:3138 T128_RESUME_SITE=c6c53af6-c040-4aa3-9b96-38cadb15a304 T128_ARTIFACTS=artifacts/t128/export-continued CHROME_PATH=<上述指定路径> node --experimental-strip-types scripts/check-new-route-flow.ts export`。`export-continued/export-report.json` 在 19:44:25Z 记录三页、真实修改、撤销、刷新及反例全部通过；版本 1/2/3 依次为助手/助手/用户，版本 3 的整份代码与版本 1 完全一致。此回执早于最后的事实提示与资料链补齐，只作历史行为证据。
- molding 完整闭环：站点 `fc0306f3-e13d-4cce-b888-699d32b95003`，现场实拍，上传两张已准入产品照片。命令 `SITECRAFT_BASE=http://127.0.0.1:3138 T128_WITH_IMAGES=1 T128_ARTIFACTS=artifacts/t128/molding-final CHROME_PATH=<上述指定路径> node --experimental-strip-types scripts/check-new-route-flow.ts molding`。`molding-final/molding-report.json` 在 20:10:26Z 记录三页、修改、撤销、刷新及反例通过，三版分别有 9 个页面/宽度检查，溢出/重叠/对比度/行长问题均为 0。全部截图在该目录；每张打开看过。生成/修改/撤销/刷新各有 1440/768/375，另有三页全文截图。
- 最新资料链实测：`node artifacts/t128/check-fact-edit.mjs`，输出 `artifacts/t128/fact-edit.log`、`fact-edit-report.json`。真实对话把邮箱更新为 trace-proof@p3t-sim.test，保存版本 4；撤销恢复版本 3 的完整代码；再次仅改样式未复活已撤销邮箱；再次撤销恢复相同代码，当前版本 7。直接读取回执见 `final-site-readback.txt`。
- 数字/脚本反例：两份 report 的 negative 区记录真实 `PUT /api/sites/<id>/draft`，在候选附加年产量 99999999 与外链脚本；HTTP 422，脚本清除并报告、数字没有来源，版本数不增加。夹具没有旁路写新站点。
- 条件/对象反例：早期 molding 的首版曾漏判“图纸确认周期”和将产品尺寸上限当全厂范围，恢复时拒绝（`molding-flow/failure.png`、原站点 `4d16895a-4ae0-44f0-a026-b34bfe7b6391`），没有恢复或静默放过。加强事实名/角色、对象、单位、范围与起算条件核对后，读取同一旧首版经真实 PUT 提交，19:57:46Z（`known-bad-facts-after.txt` 的 checkedAt），HTTP 422、版本数仍 2；该输出给出原资料与具体错配。模型事实校对不是完备性证明，仍需独立审核。
- 失败未覆盖：`real-flow-1` 是截图脚本错误；`real-flow-2/3` 保留清理拒绝及 JSON 模式参数错误，调用边界显式加入 json 指令后修正；`real-flow-5` 带图 export 两轮后仍编出“认证中所以不能提供报告”，没有存版；`export-final` 两轮后仍编出询盘处理流程，没有存版。最后修复规划与修正提示之间“不能删内容”的冲突，允许删除无来源承诺、保留有来源信息；最后一次运行 `SITECRAFT_BASE=http://127.0.0.1:3138 T128_ARTIFACTS=artifacts/t128/export-delivery CHROME_PATH=<上述指定路径> node --experimental-strip-types scripts/check-new-route-flow.ts export` 已通过；站点 `ee87cb60-6f3e-4277-8b76-3027aff7d1fe`，`export-delivery/export-report.json` 的 checkedAt 为 2026-10-07T20:44:56.512Z，三页、修改、撤销、刷新、数字/脚本反例全部通过，各版 9 个页面/宽度检查均无问题。版本 3 整份代码完全恢复版本 1。该次材料与风格不变，规划/修正提示修复后按相同入口重新运行；早期拒绝站点没有被写成成功。
- `npm run typecheck`、`npm run build` 输出见 `typecheck-ready.txt`、`build-ready.txt`（2026-10-07 20:39 后，本次最终候选）；`SITECRAFT_BASE=http://127.0.0.1:3138 CHROME_PATH=<上述指定路径> npm test` 输出见 `npm-test-delivery.txt`，2501/2501 通过、fail/cancelled/skipped 均 0。此前 `npm-test-final.txt` / `npm-test-latest.txt` 均为 2501/2501，通过后发生的源码改动已安排本次重跑，不引用旧结果作为最终通过。
- 旧测试初次因载入框架和 next/server 原生导入失败；代码根因已修，未改旧测试做兼容。其余两项缺失固定旧夹具，通过原 commitOperations 与图片上传入口准备原工作树已有数据（只读原数据，不复制源码/依赖/构建目录），命令 `node --experimental-strip-types artifacts/t128/prepare-legacy-fixtures.ts`，输出 `legacy-fixture-setup.txt`。旧 `check-published` 已由 T-113 原测试在同一 3138 服务运行。

### 尚未完成与限制

独立新旧首页盲比和 Astra 审查均未安排、未通过；不得把执行者看图算审美通过。本次执行检查完成；没有用既有抽屉滑动中截断的额外聊天截图作为稳定布局证据，最新 export 截图在等待既有 240ms 过渡结束后采集。外部邮件送达与生产 PostgreSQL 未实测，不作为本票阻塞项。没有版本面板、风格卡、批注、快捷按钮、截图打磨、模板味检测、英文或旧路径删除。

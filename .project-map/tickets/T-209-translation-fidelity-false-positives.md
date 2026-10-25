---
id: T-209
title: 英文版保真检查对价格、年份、时间区间等常见写法的误报
type: build
status: closed
blocked_by: []
claimed_by: Codex
supersedes:
---

## What to build

2026-10-21 T-207 为演示翻译「禾巷小馆」（餐饮站，v3）时，三批首译都成功，但提交入口保真检查拒收 31 段。修正第 1 轮后仍有拒因，第 2 轮被预算守卫拦下，最终没有存版本，实付 11,595 token。

拒因与中英对照存放在 `artifacts/t207/translation-rejected-pairs.json`，原始回复保留在该站点记录的 run 中。执行主控的分类如下，需要在修之前逐条核实：

1. **价格（13 段）**：「32 元/份」被译成「CNY 32 per portion」或「32 yuan/portion」后被拒。疑为没有登记元与 CNY/yuan 之间的确定等价。
2. **年份（4 段）**：「2018 年」被译成「2018」后被拒。疑为把「年」当作必须保留的时间单位。
3. **营业时间（6 段）**：「11:00–14:00」原样保留仍被拒。疑为时间区间的多重集合比较出错。
4. **无数字段（3 段）**：段落里没有数字，仍报数字不一致。疑为路径归属或 CSS 生成文字归属出错。
5. **待补充（1 段）**：「待补充」被译成句中小写的 to be provided。需要核对现行规则要求的写法，以及是否该允许句中小写。
6. **公司名（2 段）**：资料没有英文名，模型把店名音译成「Hexiang Xiaoguan」，按现行规则属于真违规。不放宽规则，改为核对翻译提示：没有声明英文名时，是否明确要求原样保留中文店名。

修正原则：

- 只在根因层修，即单位等价表、时间区间解析、段落归属和提示词；
- 不放宽数字、型号、邮箱、网址的保真要求，不新增豁免路径；
- 现有 T-151 测试保持全绿。

## Acceptance

- [x] 用本次真实回复做夹具，成对测试：旧代码对第 1–5 类误报（测试失败），新代码通过；同时保留真违规反例（数字被改动、单位被换算、公司名被音译），新旧代码都应拒收
- [x] T-151 现有保真、段落修正和短编号测试全部通过；typecheck 通过
- [x] 修完后，经构思主控批准，对禾巷小馆再跑一次真实翻译（上限 15,000 token），存下英文版，并补进 T-207 演示

## Resolution


2026-10-25，Codex 单人完成，按负责人本轮授权读取本地 `.env.local`，不采用旧主控／worker 分工。

- **PASS：误报红绿证据。** `tests/fixtures/t209-restaurant-real-response.json` 保留 T-207 的真实回复；`CHROME_PATH=<AGENTS 路径> npm test -- tests/t209-restaurant-fidelity.test.ts` 在旧实现上 48 项中 30 项失败（`artifacts/t209/red.log`）。真实无数字段的根因是无数量的频率词，以及「一家」和 a/one 的计数表达，不是路径错位。价格、历年和时刻分别按同币种金额／计价对象、明确历年、完整时刻核对；持续时长、价格符号、单位、型号、联系方式继续保护。占位大小写在文字写回时统一，保留固定输出合同。
- **PASS：相关验证。** `CHROME_PATH=<AGENTS 路径> npm test -- tests/t209-restaurant-fidelity.test.ts tests/t151-fidelity-rules.test.ts tests/t151-paragraph-repair.test.ts tests/t151-short-translation.test.ts` 最终 94/94；`npm run typecheck` 通过，见 `artifacts/t209/final-tests.log`、`final-typecheck.log`。第一轮新增全局 order 单位引发的两个既有误报保留在 `green-1.log`，已在金额所属层修正，没有放宽既有断言。
- **PASS：真实入口。** 独立副本 `artifacts/t209/real-data` 的禾巷小馆 v3，经普通 Next dev 的生产 chat/after/提交入口翻译，保存 v4、英文基于中文 v3；实付 11,973 token，四次调用均 HTTP 200，其中一轮为原有定点修正，上限 15,000。`translation-start.json`、`translation-result.json` 和副本内 run 保留原始回复。没有重发真实任务，没有改主数据。
- **PASS：实际画面。** 两页英文 1440/768/375 共六张完整截图逐张打开检查，`artifacts/t209/screenshots/`；版本三档检查均通过。更新的英文、下载和设置步骤共九张截图经原 T-207 身份／版本／帧／OCR 检查并逐张打开，`demo-screenshots-2/`；第一次复查因旧帧文件预期拒绝，失败日志保留。更新步骤是实际 v4，早先 v2/v3 步骤保留。站点 ZIP 含中文、英文、CSS 和许可六个条目。
- **素材交付。** `demo/` 已补真实英文页和中英文站点包；`scripts/t207-capture-demo.mjs` 可从指定步骤继续截取，保持此前步骤。复现命令：先用 `scripts/t207-build-demo-stages.mjs artifacts/t209/real-data <新目录>` 生成阶段副本，启动无 key 的 fs dev，再执行 `node scripts/t207-capture-demo.mjs <CHROME_PATH> <base> <阶段目录> <已有演示副本> english`。本轮按负责人要求最终部署 Windows，未更新 VPS 公网素材，不将本地截图当作公网验证。
- **验收审计。** 对照原始双语内容、真实入口保存版本与负例逐项核对；恒返回通过的实现会被数字／币种／时长／计价对象／公司名负例拦截。按负责人要求未派独立 agent，未宣称独立盲审。全量和 build 留到三票合并候选统一验证，未把相关测试冒充全量。

交付提交为包含本 Resolution 的 `fix: preserve restaurant translation fidelity and refresh English demo`；以 `git log -1 --format=%H -- .project-map/tickets/T-209-translation-fidelity-false-positives.md` 查询。

---
id: T-205
title: 未生成过的站点在任务中断后，后续消息不得覆盖资料
type: build
status: closed
blocked_by: []
claimed_by: Codex
supersedes:
---

## What to build

2026-10-21 T-204 公网验收中发现：站点已有资料和确认的大纲、还没有任何版本时，服务重启使生成中断，页面提示「生成进程已中断，请重新提交要求」，且不显示确认按钮。用户照提示在输入框发一句话（如「按已保存的页面大纲生成网站。」），这句话把 `codeSite.materials` 整段替换；原资料只剩在 factSources 第 1 条里，重新规划退化为「资料稀薄」的单页。访客照提示操作就会丢资料。

修正：

- 中断后的后续消息按追加处理，保留原有资料和来源；不得用新消息替换已有资料。
- 中断时若已有确认的大纲，页面给出从该大纲重新生成的入口，不要求用户重新提交要求。
- 提示文案与实际可做的操作一致。

不改提交入口、事实核对、版本与出处规则；不新增平行的生成入口。

## Acceptance

- [x] 成对测试经生产入口复现：有资料、有确认大纲、无版本、任务中断后发送一句后续消息；旧代码资料被替换（测试失败），新代码原资料与来源保留
- [x] 中断且有确认大纲时，可从该大纲重新生成；本机 `SITE_STORE=browser` 下用模型替身走一遍，1440/768/375 截图看过
- [x] typecheck 与相关定向测试通过

## Resolution


2026-10-25，**PASS**，Codex 按负责人要求单人完成。未生成过版本时，资料更新在原站点锁内追加；来源仍走既有登记，不改变提交检查、事实核对或来源快照。首次生成中断从已确认的持久化大纲恢复确认卡，新编号使旧请求失效；仍由原 confirm 启动 generate，没有平行入口。补充消息取消旧确认并重新对齐，未确认的规划不恢复成生成入口。

- **红证据**：`CHROME_PATH=<AGENTS 路径> npm test -- tests/t205-interrupted-materials.test.ts`，旧代码 3 项中 2 项失败，分别是原资料被替换和确认卡丢失，见 `artifacts/t205/red.log`。夹具只准备无版本的崩溃元数据，生成代码仍由原提交入口保存。
- **相关验证**：`CHROME_PATH=<AGENTS 路径> npm test -- tests/t205-interrupted-materials.test.ts tests/t202-browser-storage.test.ts tests/t202-provider-flow.test.ts`，16/16；`npm run typecheck` 通过。见 `green-1.log`、`typecheck.log`。包含新旧确认、重复确认、刷新零模型调用、原资料与逐条来源保留、补充后重新对齐、两页完整存版和未确认规划不误开放。
- **真实 Next 集成**：`CHROME_PATH=<AGENTS 路径> node --experimental-strip-types artifacts/t205/browser-check-2.mjs`，普通 dev、`SITE_STORE=browser`、随机端口 HTTP 模型替身与真实 after/提交/Chrome 检查；三档分别从中断记录经 IndexedDB/hydrate 打开工作台，真实鼠标点击重新生成，每档均保存两页 v1，2 次替身调用。实际公司改为「榆溪修缮」，没有复用测试用例的公司名作为输出断言。
- **画面**：`artifacts/t205/browser-shots-2/` 的恢复与生成后共六张截图逐张打开；375 按钮与完整提示可见，生成后切到对应 375/768/1440 预览。第一轮 768 截到过渡中的面板，保留 `browser-shots/`、`browser-check.log` 和原脚本；补截等待实际过渡完成，没有放宽产品检查。
- **限制**：入口测试的 after 是受控调度，单独的浏览器检查才是实际 Next after 集成；替身不证明真实模型能力，真实模型全流程在 T-208 Windows 部署验收。未派独立 agent，不宣称独立审核。全量和 build 按负责人规则留到最终合并候选。

交付提交：包含本 Resolution 的 `fix: keep materials and restore outline confirmation after interruption`，以 `git log -1 --format=%H -- .project-map/tickets/T-205-interrupted-run-keeps-materials.md` 查询。

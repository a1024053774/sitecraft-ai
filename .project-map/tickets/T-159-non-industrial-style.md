---
id: T-159
title: 补 1–2 个非工业风格，风格卡带真实缩略图
type: build
status: open
blocked_by: [T-157, T-158]
claimed_by: Codex (t159-nonindustrial-style)
supersedes:
---

## Why

T-156 定为任何行业的展示型官网。现有精密工程、现场实拍、品牌画册都是按工业企业写的方向；非工业资料选「帮我选」时没有贴合的风格。

## What to build

1. 先看 T-158 的非工业生成结果与盲评：现有风格用在非工业站是否已经够好，够好就不新增，本票如实关闭。
2. 不够时新增 1–2 个风格（例如面向门店与生活服务的温和亲近方向、面向专业服务的克制文字方向），每个一份短 skill，在 `lib/code-site-styles.ts` 登记，缩略图来自真实生成版本；按 T-153 规则，未验证的候选不提供给用户。
3. 「帮我选」按资料从已登记风格里挑，不按行业硬映射。

## Acceptance

- [ ] 风格区分盲评：新风格与最接近的现有风格在同一非工业资料上可辨（新实例，随机命名）
- [ ] 「像这家店/机构」成对盲评不差于现有风格；真实预算主控报批
- [x] typecheck、test、build 通过

## Resolution

执行者 Codex，父提交 `84ad844`，2026-10-13。本票保持 open，不推送；负责人已批准累计 260,000 token，单次 70,000，上限不追加。

**新增判断：先验证一个候选。** 已只读主工作区 T-158、T-160 及 t160-review-*：T-158 两家非工业的独立盲评均为 5/10；T-160 餐饮、培训升至 6/10，餐饮首页紧接首屏的深色「承接范围」被判偏事务，培训仍有重复限制声明。现有现场实拍强调整宽照片、大字与深浅交替，品牌画册强调暖纸和衬线阅读节奏，精密工程强调细线业务目录；不能据这些结果宣布现有方向已充分适配。指定目录没有设计工作室的真实生成和盲评，t160-review-* 是窄列机械反例，不能当审美结论。餐饮 home-1440/menu-375 与最新培训 home-375/courses-1440 已打开核对位置。

先做「邻里日常」：店内价目与告示的排法、系统黑体、柔和色面，让已有项目与相应价格/时间靠在一起；与最接近的「品牌画册」用完全相同的 restaurant quick 资料、版式 5/密度 6 成对验证。采用 **Tracer bullet** 经正常需求对齐、确认和提交入口生成两页；保持 **Deep modules** 的单一风格登记与现有入口，不另设生成 API；**Ubiquitous language** 沿用风格、页面大纲、提交入口和盲评包。范围不含资料修订、核心事实/修正合同、新图片或第二风格；视觉收益必须由主控另开实例判断。资料缺口和重复声明是已知限制，新增风格不保证解决它们。

新增测试在父代码运行为 7/11 PASS、4 个预期失败（未登记候选、CLI 不接受 editorial、预算目录拒绝 t159），原日志 `artifacts/t159/parent-red.log`；最小改动后同组加既有 quick CLI 为 13/13 PASS，`focused-green.log`。真实评估暂在本隔离工作树的普通选择合同登记候选，未伪造缩略图；最终 pending 候选已从用户选择和「帮我选」移除，盲评通过后再由主控开放。正常 chat 入口以新的教育资料回读四个公开选项（含 auto），没有候选，见 `artifacts/t159/selection-gate.json`。

**真实生成 INCOMPLETE，已停下。** 2026-10-14 01:26–01:27 UTC（纽约 2026-10-13），在父提交 `84ad844` 加本票工作树改动上运行一次：

```sh
SITECRAFT_BASE=http://127.0.0.1:54474 SITECRAFT_BUDGET_BASE=http://127.0.0.1:54475 SITECRAFT_TOKEN_LIMIT=70000 CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm run eval:new-route -- --quick --only restaurant/neighborly --out artifacts/t159/real-neighborly-20261014T012608Z
```

端口由 `artifacts/t159/run-real.mjs` 分配并显式传入，没有默认地址。启动前 ps 未见其他 Chrome/测试；应用 health 的 cwd 与本工作树一致，数据只在本工作树 `.sitecraft-data`。密钥仅在预算网关子进程按负责人指定命令 source 主目录 `.env.local`，没有复制或写入文件；应用只拿非密钥占位值。网关目录唯一改动为白名单加 t159，预留、累计账本和停止规则未变。账本 `artifacts/t159/budget-neighborly-20261014T012608Z/usage.json` 与应用两次调用的 HTTP、finish_reason 和 total token 逐项相等。

| 阶段 | 输入 | 输出（含思考） | 思考 | total | 上游结果 |
| --- | ---: | ---: | ---: | ---: | --- |
| 规划 | 8,398 | 7,388 | 6,613 | 15,786 | HTTP 200，tool_calls，保存大纲 |
| 写页 | 9,583 | 5,401 | 5,401 | 14,984 | HTTP 200，length，无可见正文 |

累计 **30,770 / 260,000**，剩余 **229,230** 未用。写页前累计 15,786；网关输入保守预留 48,813，在单次 70,000 内只留下 **5,401** 输出额度，全部用于思考，回复截断。网关 stopped=true，应用如实报「DeepSeek 回答被截断，本次未保存版本」。事实核对、确定性底线与修正均未运行；没有 HTML/CSS 候选或已存版本。没有 402 或网络错误，不能把截断写成模型质量或底线不通过。

站点 `4c13530a-af1d-454a-a8e6-6f7a7801b950` 的版本数为 0；大纲、会话及失败运行留在本工作树。详细用量与实际文件路径在本轮 `report/summary.json`、`report/data-files.json`，由 `node artifacts/t159/report.mjs` 回读生成。评估只产出官网对照图，两张文件均打开且载入完整；`private/blind-coverage.json` 明确 complete=false。没有可交盲评的生成页、缩略图或成对包，不能把只含对照的 review/mixed 发给评审。未调用 editorial，也未开始第二风格，不补跑、不调整网关、不花剩余额度掩盖失败。

下一次真实运行需要主控先解决单次 70,000 与保守请求预留的冲突并重新确认授权；本票不改变预算算法。之后仍须同资料的邻里日常/品牌画册两版经提交入口存版、制作真实缩略图与随机盲评包，再决定是否开放及是否做第二风格。

**技术检查与已知限制。** 2026-10-14 01:27–01:35 UTC，在最终源码改动后 `npm run typecheck`、`SITE_STORE=fs npm run build` 通过，日志 `artifacts/t159/typecheck-final.log`、`build.log`。短规范的 YAML 与 UTF-8 经 Ruby YAML 解析通过；skill-creator 的 Python validator 因缺 PyYAML 未运行成功，未为此加依赖。第一次全量检查 360/435、75 失败（`test-final.log`）：真实运行脚本结束时 dev 子进程退出，端口 ECONNREFUSED；原失败保留。后续将同地址服务改为独立前台进程，核对 cwd，预算网关仍关闭；没有通过更换模型/资料、扩大用例超时或删断言规避失败。

最终 `SITE_STORE=fs SITECRAFT_BASE=http://127.0.0.1:54474 SITECRAFT_TOKEN_LIMIT=70000 CHROME_PATH=<上述路径> npm test` **435/435、0 skipped**，`artifacts/t159/test-service-fixed.log`。三档工作台（1440/768/375）截图由 `SITECRAFT_BASE=http://127.0.0.1:54474 CHROME_PATH=<上述路径> node artifacts/t159/capture-selection.mjs` 生成，最终证据为 `selection-complete-{1440,768,375}.png`，逐张打开，风格、滑杆与提交按钮完整可见，候选未露出。最初 1000px 高的 `selection-{1440,768,375}.png` 也保留并打开；1440 的提交区超出截面，不引用它作为完整卡片证据。这些是工作台选项隐藏检查，不能当生成站或风格审美验收。

`project_map.py status --root .` 为 Problems 0、Stale living docs 0。本地候选的精确提交及运行时间由 `artifacts/t159/delivery.json` 关联；独立技术审查记录单独交接，不自审或冒充页面盲评。本票整体 **INCOMPLETE**，两个盲评验收项未完成，保持 open 与 claimed_by，不推送、不关票。

**独立技术审查未通过。** 新 Astra 实例按 behavioral-acceptance-review 只读审查冻结候选 `918cfa6`，原文在 `artifacts/t159/acceptance-review.txt`，没有调用模型或再次审美评审。审查复现 P1：最终候选的正常 styleQuestion 已排除 pending，CLI 虽构造 `restaurant/neighborly`，chat select 会返回 400 invalid_option，无法开始规划；P2：新增 CLI 测试提前停在旧轮次不匹配，只证明组合构造，不能拦住选择门禁冲突。因此 435/435 不构成候选完整评估入口通过。此前真实调用发生在本隔离工作树临时提供候选的状态，不能作为最终隐藏状态的入口证据。

主控需先确认受控内评如何选择 pending 候选、仍保持普通用户与 auto 隐藏并共用提交入口；再加实际 CLI→chat 边界反例，修复后验证。该准入合同尚未确认，本次不扩大 API 或临时公开候选继续跑。预算预留冲突也仍需主控处理，真实生成与盲评没有完成。收尾只将审查原文登记进票，代码、测试及生成产物未再改；不将未通过审查的候选宣称可合并。

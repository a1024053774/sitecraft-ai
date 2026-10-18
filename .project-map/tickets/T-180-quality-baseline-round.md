---
id: T-180
title: 页面质量基线轮：全矩阵真实生成 + 独立盲评，找出下一批质量缺口
type: build
status: open
blocked_by: [T-181]
claimed_by: Codex
supersedes:
---

## Why

2026-10-18 T-179 关闭后 frontier 为空。10-09 之后的工作集中在「修改」流程（T-162～T-179），生成页面质量（优先级 1）没有再做整轮评估；提交入口、出处、事实核对、风格登记等都已变化。负责人 2026-10-18：「你跑吧，预算不限，deepseek 给了赠金」。

## What to build

1. 在主线最新提交上，用标准评估入口 `npm run eval:new-route` 跑**整轮默认矩阵**（7 家公司 × precision/documentary 整站），`--previous` 指向最近一次同档整轮（没有同档整轮就如实记录无对照）。
2. 另跑一轮 `--only`，覆盖 editorial 与 neighborly 两种已登记风格：每种风格各选 3 家资料最合适的公司（选择理由写进本票，不按行业硬映射）。
3. 真实生成走预算网关，显式 `SITECRAFT_TOKEN_LIMIT=3000000`（负责人授权不限额，此为本票封顶，用完即停报构思主控）；每轮实际用量写进 Resolution。
4. 盲评：`review/mixed/` 与 `review/company/` 各交一个新的 fast 盲评实例，跨轮比较交第三个实例；各实例互不读取对方的包，也看不到实现与票。`private/` 映射由执行主控保管。
5. 汇总：把盲评结论按「同类问题出现在几个站」排序，列出前 5 个质量缺口，每个附代表截图路径与站点 ID；技术检查（提交入口拒收、底线失败、机械反馈）单独列。结论交构思主控开后续修复票。本票不改代码。
6. 生成成功的站复制进主目录 `.sitecraft-data`，站名加「（质量基线 10-18）」，方便负责人在 3034 查看。

## Acceptance

- [x] 两轮评估的命令、提交、时间、用量、成功/失败站数写进 Resolution；失败站保留失败记录，不重跑掩盖
- [ ] 三份独立盲评结论原文路径与汇总的前 5 个质量缺口写进 Resolution
- [ ] 生成站已复制进主目录且 3034 可打开；构思主控据此开出后续票

## Resolution

**INCOMPLETE。** 执行者 Codex；两轮已跑完，成功 0、失败 20，全部因事实核对协议问题未存版。本票不改代码、不推送、不重跑失败站。独立盲评由构思主控另派实例；执行者未读取 review/ 内提示词或结论，未自评审美。无成功站可交审或复制，后两项验收未完成，票保持 open。

运行源码为 `447332073fadec72a0551cf985cbc318698d94b5`，仅本票认领与记录使工作树 dirty。开跑前 memory_pressure 可用内存 39%，缺依赖已用 `npm ci` 安装，未建软链接。应用独占 `http://127.0.0.1:52203`，数据根 `/Users/luckye/Documents/Code/sitecraft-ai-t180/.sitecraft-data`；health 已核对 fs 存储与本工作树身份，启动命令显式传固定 CHROME_PATH 和本地网关占位凭据。ps 未暴露 worker 环境，不能冒充进程内环境已读回；本次落盘检查包含实际 375/768/1440 浏览器结果，证明应用已调用 Chrome。主目录 3034 与数据未用于生成。

两轮共用 `SITECRAFT_TOKEN_LIMIT=3000000` 和唯一账本 `artifacts/t174/t180-quality-baseline/usage.json`。现有 `scripts/t153-real-budget.ts` 的目录白名单不含 t180，故账本放在它已允许的 t174 子目录，未修改脚本或放宽预算；网关地址 `http://127.0.0.1:52204`。账本 default/high 分别标记两轮，评估器滑杆均为原默认 5/6。真实密钥只由网关进程 source 主目录 `.env.local`，应用只持本地网关占位凭据，评估器不加载密钥；未重置、未另开账本。实际累计 **1,681,673 / 3,000,000 token**，余 **1,318,327**；61 次 HTTP 200，实际用量全部已知，没有因预算或上游 HTTP 错误停止。

**对照：无对照。** 已核查主目录 artifacts 下的 private/round.json，包括 `artifacts/t130/round-*`：最近的 `round-2026-10-09T10-14-09-315Z` 为 quick、4 组合，并非本次 full、14 组合；未找到已实际运行的同档、同资料、同矩阵整轮。因此第 1 轮不加 --previous；验证记录 `artifacts/t180/previous-round-verification.json`。第 2 轮也无同六组合整站对照。

第 2 轮选择（全部按资料内容，保持 full，不加 --quick；评估器 --only 支持以下六组合）：

| 风格 | 公司资料 | 选择理由 |
| --- | --- | --- |
| editorial | packaging | 纸盒、内托有明确系列、结构和打样条件；画册可组织系列差异与有授权的题材图，参数仍可查阅。 |
| editorial | education | 课程前提、材料、练习顺序和学习须知有层次；无授权作品图，适合通过字阶与栏宽组织阅读。 |
| editorial | design | 服务交付与三条文字项目记录充分，且作品图片未授权；以排版呈现项目过程符合现有资料边界。 |
| neighborly | restaurant | 菜价、米饭口径、午晚供应和停止点菜时间明确，适合店内菜单与告示式查阅。 |
| neighborly | education | 课程收费、人数、材料自备和开放时间均有原文，可把选择条件与对应课程放在一起。 |
| neighborly | design | 三项服务各有交付、周期与不包含事项，需先帮助小型品牌选择服务；无统一套餐价，不强造价目。 |

零成本预检曾误用不存在的静态页标记断言，未调用模型；已按 public/code-check.html 的真实固定标记核对，失败记录 `artifacts/t180/preflight-first-failure.json` 保留。最终预检 `artifacts/t180/preflight.json`。

**两轮运行。** 以下时间均为 2026-10-18 纽约时间（EDT）；结束时间取最终 round.json 写入时刻，退出码另由实际进程核对。两轮均为 full 整站，未加 --quick、未加 --previous。

| 轮次 | 起止时间 | 本轮实际 token | 网关调用 | 成功 / 失败 / 未运行 | 结果与 out |
| --- | --- | ---: | ---: | --- | --- |
| 第 1 轮：默认 7 家 × precision/documentary | 10:09:01–10:58:12 | 1,217,537（输入 474,518；输出 743,019） | 43 | 0 / 14 / 0 | INCOMPLETE，exit=1；`artifacts/t180/round1-full-20261018` |
| 第 2 轮：上述六组合 | 10:58:25–11:18:28 | 464,136（输入 171,936；输出 292,200） | 18 | 0 / 6 / 0 | INCOMPLETE，exit=1；`artifacts/t180/round2-selected-20261018` |

两条实际 npm 命令如下，固定 CHROME_PATH 同时显式传给应用启动命令和评估器：

```sh
SITECRAFT_BASE=http://127.0.0.1:52203 SITECRAFT_TOKEN_LIMIT=3000000 CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm run eval:new-route -- --out artifacts/t180/round1-full-20261018
SITECRAFT_BASE=http://127.0.0.1:52203 SITECRAFT_TOKEN_LIMIT=3000000 CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm run eval:new-route -- --only packaging/editorial,education/editorial,design/editorial,restaurant/neighborly,education/neighborly,design/neighborly --out artifacts/t180/round2-selected-20261018
```

每轮实际 command、源码提交与起止时间见各自 `private/completion.json`；失败记录按原评估器保存在各轮的 `private/case-*/report.json`、`private/case-*/code-site.json`、`private/round.json` 和 `private/http-requests.json`，现存记录未删除或覆盖成成功。事实调用只保存协议拒因、响应元数据和用量，没有完整事实回复正文；协议异常多在 checks 落盘前终止，不能把未留的回复或检查当作证据。运行日志为 `artifacts/t180/round1-eval.log`、`round2-eval.log`；账本起止快照只供核对，活动账本始终为上文同一个 usage.json。

**技术结果，非审美判断。** 20 个组合全部为 outcome=error、版本数 0；不是经过两轮内容修正后的普通底线拒收，也不是预算不足。

| 终止原因 | 第 1 轮 | 第 2 轮 | 合计 |
| --- | ---: | ---: | ---: |
| noFacts=false 却返回空企业事实类别，协议拒收 | 12 | 5 | 17 |
| 核对段回复格式或编号无效（遗漏、重复或越界） | 1 | 1 | 2 |
| 资料出处声明不在当前核对段 | 1 | 0 | 1 |

第 1 轮仅 packaging/documentary 有一轮 checks 记录落盘（`private/case-8/code-site.json`）：首页同一文字在三档对比度 4.12、要求 4.5，先被确定性检查拒收，按标准流程修正后又在事实协议处终止，没有重发生成。该一站一轮的非拒收质量反馈为正文行长 6、未门控 hover 99、375 点击区 38、产品图 cover 裁切 9；它们是跨页面/视口的发生数，不是独立站点数，裁切反馈不证明主体丢失。其余协议中断与第 2 轮没有 checks 记录，机械检查覆盖率不能按 20 站计算，零反馈不表示通过。

第 1 轮官网对照图 12/14，第 2 轮 7/8；缺失为 saihao.com 空白/未载入及 bluefrog 页面入场未结束，原 errors 保留，未额外重试或修网络。两轮生成站截图均为 0，各自 `private/blind-coverage.json` 均 complete=false；mixed 只有官网对照、company 无生成候选，没有可用的盲评包。无同档对照故未请求跨轮比较。不把这些目录当作可审材料，不编造独立盲评结论或审美前五缺口，留给构思主控处理下一步。

**复制与收尾。** 无成功站，未向主目录 `.sitecraft-data` 新增或覆盖任何文件，未触碰索引，故没有要备份的索引，也未执行所要求的新站 3034 code-preview/workspace 的 200 核对。主目录服务未停止、端口未改。两轮各自的 `private/terminal-observation.json` 已经实际 /draft 接口核对；最后于纽约 **11:19:01** 再核对 20 个 run 全部终态、版本均 0、61 次调用 complete、未知用量 0、in-flight=0，见 `artifacts/t180/terminal-before-gateway-stop.json`。之后才手动 SIGTERM 网关 PID 94647，再停本工作树 dev；**11:19:06** 两个自建端口均 ECONNREFUSED，见 shutdown.json。没有评估器退出即关闭网关的编排钩子。账本、失败站、private 映射与输出均留在原工作树，未发给评审实例。

本次只改本票，不运行 typecheck、npm test 或 build，不引用旧检查的绿灯；本次真实入口证据是上述两次 exit=1。后续修复与再次生成不在本次执行范围内。交构思主控验收及决定后续票，执行者本地提交后停在 idle。

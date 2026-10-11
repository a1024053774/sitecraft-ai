---
id: T-158
title: 核心规范与事实核对去掉工业 B2B 预设，按资料判断访客与重点
type: build
status: open
blocked_by: [T-157]
claimed_by: Codex (t158-build)
supersedes:
---

## Why

T-156 定为任何行业的展示型官网。`skills/site-code-core/SKILL.md` 第 6 行把身份定为「为工业、零部件、外贸 B2B 企业做官网」、访客是采购工程师/OEM 采购/贸易商；事实核对提示（`lib/code-site-model.ts` 的 `auditCodeFacts`）围绕参数、交期、起订量、认证、排产；英文翻译提示面向海外 B2B 采购；风格与骨架卡里也有工业措辞。

## What to build

1. 核心规范：身份改为中小企业与机构的官网设计师；访客、页面任务和视觉重点由模型按资料判断（如餐饮的菜单与到店、诊所的项目与资质、工厂的产品与采购）。事实红线保持，承诺类清单改成通用的价格、时间、资质、承诺、效果、客户与评价。不写行业例外名单，保持文件短。
2. 事实核对提示同样通用化；核对段、整组沿用、拒收规则不变。
3. 英文翻译提示去掉「海外 B2B 采购」预设，按资料行业用常规商务英语；保真规则不变。
4. 骨架卡与三个现有风格只删行业写死的措辞，风格方向不变；风格是否适用非工业由 T-159 决定。
5. 系统部件不扩充：不加预约、菜单或价目部件；营业时间、地址、价目按资料以普通 HTML 排出。
6. 同步 `mainline.md`、`spec.md`、`CONTEXT.md`。

## Failure modes

第一阶段先验证以下失效方式（真实模型与审美另由主控安排）：

- 整站或局部事实提示漏掉价格、时间、资质、承诺、效果、客户与评价，未要求无数字的说法逐项对照资料原句。
- 无来源的「无痛治疗」「包教包会」「当天出餐」未随核对段或选中段进入请求，或混入事实来源；组编号、条件与原文传递被改坏。替身只检查请求合同，不证明模型语义拦截能力。
- 核心、骨架或风格仍将访客固定为工业采购；翻译仍预设海外 B2B，而不是按原文业务使用常规商务英语。
- 通用化时弱化工业规格、单位、条件、否定与承诺边界，或增加无依据的询盘、预约和系统部件。
- 替身只接受非工业页面，工业回归未能经过同一规划、写页和提交入口。新合同必须在父提交上因对应缺项失败。

第一阶段采用 Tracer bullet：请求合同红绿 → 两家替身整站生成 → 全量检查。Deep modules：保留现有模型入口和核对逻辑，只改规范措辞，不另加抽象。Ubiquitous language：沿用资料、核对段、局部修改、提交入口；不引入行业例外名单。

## Acceptance

- [x] 先列失效方式，事实核对的红绿测试用非工业承诺句（在旧提示的已知坏行为或替身上失败）
- [ ] 真实生成（预算主控报批，预计每站 quick 约 9 万 token）：T-157 的 2 家非工业 + 1 家工业回归；非工业站交新实例盲评「像不像这家店/机构自己建的」，工业站与改动前成对盲评不变差
- [ ] Astra 审查通过；typecheck、test、build 通过

### 第一阶段（负责人限定：不调用真实模型，不关票）

- [x] 核心、局部、骨架与三个风格规范去掉行业身份，文件均未变长；整站/局部事实提示与英文语气同步，核对段、沿用、拒收与保真逻辑不改
- [x] 本地替身跑通 restaurant/documentary 与 industrial/precision 的 quick 评估；完整资料与通用提示经实际请求核对，三档截图逐张打开
- [x] typecheck、全量 test、build 通过，mainline、spec、CONTEXT 与 AGENTS 的对应事实口径同步

## Resolution

第一阶段技术检查 PASS（2026-10-11）；完整 T-158 仍 INCOMPLETE，保留 open 与 claimed_by，不推送、不关票。真实模型语义、非工业审美及工业质量回归尚未验证，按负责人本次要求由主控另行申请预算与安排。独立行为验收按冻结的本地提交执行，结论存 `artifacts/t158/acceptance-review.txt`，不以执行者自查代替独立审美。本次改动与本文在一个本地提交；精确 SHA 和证据对应关系在提交后登记到 `artifacts/t158/delivery.json`，也可用 `git log -1 --format=%H -- .project-map/tickets/T-158-generalize-core-and-facts.md` 查询。

规范句前后要点：

- 「为工业、零部件、外贸 B2B 企业做官网；访客是采购工程师/OEM 采购/贸易商」→「中小企业与机构的官网设计师；按资料判断访客、页面任务与视觉重点」。
- 报价、交期、付款、售后、认证的行业清单 → 价格、时间、资质、承诺、效果、客户与评价；无数字的流程和政策仍逐项找资料原句，无来源仍拒收，不加入样本例外。
- 「面向海外采购的 B2B 官网」→「按原文的行业与业务语境使用常规商务英语、美式拼写和准确术语」。copper/dispatch 的保真示例、数字/单位/名称与严格短编号协议均保留；只同步旧测试中的语气断言。
- 工程师产品目录/对车间有信心的工厂/工业产品画册 → 业务目录/授权现场照片/品牌画册。网格、配色、字体、栏宽、照片尺度与入口优先级不改；骨架按业务与场景组织，工业规格仍保留单位、条件、否定与边界。营业时间、地址、价目用普通 HTML，不增加预约、菜单或价目系统部件。

检查均在基线 `1814617` 应用本次改动后执行（评估记录 dirty=true）。所有命令显式使用以下环境，不载入 `.env.local`，不调用 DeepSeek，不读写主工作区数据：

```sh
export SITECRAFT_BASE=http://127.0.0.1:3184
export SITECRAFT_FIXTURE_BASE=http://127.0.0.1:3185
export CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell
export SITE_STORE=fs
```

- 请求合同红绿：`node --test --experimental-strip-types tests/t158-general-prompts.test.ts tests/t157-non-industrial-cases.test.ts`。改实现前 2/7 PASS、5 项预期失败（`contract-red-confirmed.log`）：整站/局部缺通用类别、工业身份、B2B 翻译及替身不认产品页；修改后 7/7（`contract-green.log`）。三个无来源承诺句作为待核内容，与带未知尾部值的资料分开传递；断言来自负责人要求，替身不判断语义。首份 `contract-red.log` 含一项不必要的槽位顺序假设，改为独立核对短编号与原文集合后重新记录有效红灯。
- 更新旧提示断言后的反证：`python3 artifacts/t158/check-parent-model.py`，仅暂用父提交的模型文件，finally 恢复当前文件；18 项中 5 项因旧事实类别/B2B 提示失败，退出 1，见 `parent-model-red.log`。脚本和失败证据保留，不复制源码作为证据。
- 替身：`node --experimental-strip-types scripts/t157-model-fixture.ts --out artifacts/t158/provider-final`。应用：`SITECRAFT_DATA_ROOT=/Users/luckye/Documents/Code/sitecraft-ai-t158/.sitecraft-data DEEPSEEK_BASE_URL=http://127.0.0.1:3185 DEEPSEEK_API_KEY=local-fixture-only DEEPSEEK_MODEL=local-fixture-only AI_API_KEY='' npm run dev -- --hostname 127.0.0.1 --port 3184`。共 6 次本地请求，完整原文在 `provider-final/requests.json`。
- 最终评估：`npm run eval:new-route -- --quick --only restaurant/documentary,industrial/precision --out artifacts/t158/eval-final`，PASS，两站四页各存首版，共 12 个页面/视口检查，零拒因、零修正；报告、版本快照与底线结果在 `eval-final/private/`。`SITECRAFT_BASE=http://127.0.0.1:3184 node artifacts/t158/verify-eval.mjs artifacts/t158/eval-final artifacts/t158/provider-final` 再从真实 API 核对资料、页集合与已存版本，并检查发出的核心/事实提示，PASS。12 张三档整页图、2 张首屏与 2 张对照图共 16 张均打开看过，只确认载入与流程。替身直接排资料，且事实回复为空问题；其工业页包含资料中的配图说明，不代表真实生成、语义合规或美观通过，不提交盲评。
- 最终检查：`npm run typecheck`（`typecheck-final.log`）、`npm test`（407/407、0 skipped，`test-final.log`）、`npm run build`（`build-final.log`）均 PASS；时间 2026-10-11 11:32–11:35 UTC。全量初次 404/407 的原始失败保留在 `test-run-1.log`；恢复 T-141 原授权句，更新 T-142 事实清单与 T-151 语气断言后全量转绿，未弱化功能或保真检查。最后一次规范文字调整后已重新跑评估与全部检查，早期 `eval-run-1/` 保留但不作最终证据。
- `git diff --check` 与 `project_map.py status --root .` 通过，living docs 过时项为 0。所有修改文件按 UTF-8 回读，未引入 BOM、替换字符或换行风格变化。

---
id: T-157
title: 加 2–3 家非工业模拟公司资料，进入评估集
type: build
status: open
blocked_by: []
claimed_by: Codex (t157-build)
supersedes:
---

## Why

T-156 定为任何行业的中小企业与机构展示型官网。现在 `eval:new-route` 的 4 个样本全是工业（精密件、外贸接头、注塑、纸包装），换公司与成对盲评只证明了工业站的质量；没有非工业资料就无法验证 T-158、T-159。

## What to build

1. 新增 2–3 家模拟公司资料包，行业彼此差别明显，建议：一家社区餐饮店、一家口腔诊所或培训机构、一家设计工作室或律所。每家资料厚度与现有样本相当：公司介绍、服务/菜单/课程或作品、价格或收费口径（按需）、地址与营业时间、资质；明确标为模拟。只用资料里写出的事实，留真实缺口（「待补充」）。
2. 图片按 T-010 许可规则（CC0/公有领域/CC-BY/CC-BY-SA，内容对得上）准入并登记来源；找不到合适授权图的就不带图。
3. 接进 `eval:new-route`：可用 `--only` 单独选非工业样本；现有 4 个工业样本保留，不改它们的资料。同步 `CONTEXT.md` 的「评估轮次」。
4. 不调用真实模型；用本地替身跑一次非工业样本，确认资料进入规划与写页请求、流程走通。

## Acceptance

- [x] 2–3 家非工业资料包与图片许可登记
- [x] `eval:new-route -- --quick --only <非工业样本>` 用本地替身跑通，报告与截图看过
- [x] typecheck、test、build 通过

## Resolution

PASS（T-157 执行范围，2026-10-11）。按主控要求保留 `status: open`，不关票、不推送；资料、脚本、测试和本文在同一个本地提交。精确提交 SHA 与证据对应关系见本工作树 `artifacts/t157/delivery.json`（提交后登记），也可用 `git log -1 --format=%H -- .project-map/tickets/T-157-non-industrial-eval-cases.md` 查询。本次运行是在基线 `9ee5a3d` 上应用改动后进行，评估记录 `dirty: true`，不是引用基线产物。

新增禾巷小馆P3C（社区家常餐饮，1,866 字）、拾色绘画教室P3L（成人业余绘画培训，2,166 字）、折页设计工作室P3D（品牌与纸上视觉设计，2,383 字）。每家明确标注模拟，包含业务细节、收费条件、时间、流程、场景和 FAQ，保留资质、门牌地址、电话、公开作品等缺口；没有询盘或预约要求。三家不带图片，`fixtures/simulated-packs/{restaurant,education,design}/manifest.json` 登记空图片清单、无图用途与 T-010 许可口径，无待署名的图片来源。原四家工业资料逐字段未改，见 `artifacts/t157/industrial-preservation.json`。

评估默认为七家公司 × 两种现有风格；快速档每家一种风格，新三家为 documentary，分别要求首页与菜单、课程、作品，保留工业样本原有产品页。`--only` 可单独选三家；无图登记不触发上传。`CONTEXT.md` 已同步。新增真实官网对照仅作私有评审材料，不作为运行图片准入；快速档本次采集 Wagas、新东方、Pentagram，整轮的第二份来源未做浏览器采集。

本次检查时间为 2026-10-11 11:13–11:18 UTC；所有应用连接均为本工作树 `http://127.0.0.1:3180`，替身为 `http://127.0.0.1:3181`。未读取或载入 `.env.local`，未调用真实 DeepSeek，未接触主工作区数据。命令使用以下环境：

```sh
export SITECRAFT_BASE=http://127.0.0.1:3180
export SITECRAFT_FIXTURE_BASE=http://127.0.0.1:3181
export CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell
```

- 替身：`node --experimental-strip-types scripts/t157-model-fixture.ts --out artifacts/t157/provider-run-1`；请求原文保存在该目录 `requests.json`。应用以 `SITE_STORE=fs SITECRAFT_DATA_ROOT=/Users/luckye/Documents/Code/sitecraft-ai-t157/.sitecraft-data DEEPSEEK_BASE_URL=http://127.0.0.1:3181 DEEPSEEK_API_KEY=local-fixture-only DEEPSEEK_MODEL=local-fixture-only AI_API_KEY='' npm run dev -- --hostname 127.0.0.1 --port 3180` 启动。
- 评估：`npm run eval:new-route -- --quick --only restaurant/documentary,education/documentary,design/documentary --out artifacts/t157/eval-run-1`，PASS，三站六页各存一版，三次首轮检查全部通过，共 18 个页面/视口结果，无修正。报告与独立站点快照在 `eval-run-1/private/`，运行日志 `eval-run-1.log`。
- 完整资料核对：`node --experimental-strip-types scripts/t157-check-fixture-run.ts --round artifacts/t157/eval-run-1 --provider artifacts/t157/provider-run-1`，PASS；三家完整资料均进入各自规划与写页请求，没有混入其他公司，实际 API 回读版本一致，上传记录为空。结果为 `eval-run-1/private/fixture-verification.json`。
- 新合同：`node --test --experimental-strip-types tests/t157-non-industrial-cases.test.ts`，3/3 PASS，见 `focused-final.log`。改动前缺包与 `--only` 失败见 `contract-red.log`；临时将替身资料读取截至未知尾部事实之前，执行 `node --test --experimental-strip-types --test-name-pattern='local provider propagates' tests/t157-non-industrial-cases.test.ts`，预期失败，见 `provider-mutant-red.log`，随后原位恢复。本地 HTTP 合同使用两家未知公司名与随机尾部内容，拦截固定输出与截断。
- UI：`node --experimental-strip-types artifacts/t157/capture-workspace.mjs`，三档资料按钮与完整输入 PASS，见 `workspace/observations.json`。逐张打开看过三档六页截图 18 张、首屏截图 3 张、真实官网对照 3 张及工作台截图 3 张，共 27 张；都为内容已载入的截图，仅确认流程和内容，不判审美。
- 原工业资料：`node --experimental-strip-types artifacts/t157/check-industrial.mjs`，PASS，四家逐字段与基线相同，见 `industrial-preservation.json`，不做哈希或像素比对。
- `npm run typecheck` PASS，见 `typecheck-run-2.log`；`env -u SITECRAFT_DATA_ROOT SITE_STORE=fs npm test` 403/403 PASS、0 skipped，见 `test-run-2.log`；`SITE_STORE=fs npm run build` PASS，见 `build.log`。均继承上面显式 BASE 与 CHROME_PATH。

失败证据保留：首轮全量 400/402 见 `test-run-1.log`，图片上传合同仍假定全评估只有四家，已用显式 `--only` 保留其四家/八组合图片检查；T-145 隔离 cwd 被运行命令中的全局数据根覆盖，移除该覆盖后原测试通过，未改 T-145。验证脚本初次字段名错误见 `typecheck-final.log`，修正为记录实际的 `materials` 字段。

独立 behavioral-acceptance-review（新的 Codex GPT-6 Astra 实例）对冻结行为候选给出 PASS，无范围内阻断发现；独立经 API 核对 cwd、版本、页面与资料事实。记录见 `artifacts/t157/acceptance-review.txt`。本票证据只证明本地替身流程、完整资料传递和提交存版；替身事实校对返回空问题，不证明真实模型理解、事实语义、审美或发布质量。主控后续做正式代码审核与整合，T-158/T-159 的真实模型和风格验证仍按各自预算执行。

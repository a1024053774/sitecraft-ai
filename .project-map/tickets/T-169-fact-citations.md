---
id: T-169
title: 高风险事实在工作台标出资料出处
type: build
status: open
blocked_by: []
claimed_by: Codex (t169-resume)
supersedes:
---

## Why

2026-10-14 负责人决定：像模型回答带来源角标那样，在工作台里给生成站的高风险企业事实标出资料出处。现在事实核对拒收时会给"段落原句：资料原句"，但**通过的声明不留依据**，用户看不出页面上"服务 30 家客户""取得 ISO 9001"凭的是资料哪一句。目标是"更真"：用户能逐条核对，系统也能证明出处不是模型编的。

## What to build

1. **范围只限高风险类别**：客户与合作方、资质认证、业绩与数量、价格与收费、时间与交期承诺、效果、评价。普通介绍、标题、导航不标出处。
2. **核对返回出处**：整站与局部事实核对在通过一条高风险声明时，同时返回其所依据的资料原句。不新增模型调用，沿用现有核对调用与非思考/思考模式设置。
3. **出处由代码验真**：引文必须能在本次核对所用资料原文中找到（NFKC 并压缩空白后做子串匹配，不做模糊匹配）。找不到即视为无依据，作为拒因进入现有最多两轮修正；仍不过如实告知用户，不静默放过。
4. **绑定版本**：出处随该版本的检查结果保存；按 T-154 复用核对段时一并复用出处，资料或整组内容变化则整组重核、旧出处不沿用。没有该字段的旧版本显示"未记录出处"，不当成零条。
5. **只在工作台展示**：预览中标出有出处的声明，悬停或点选显示"资料原句"；定位沿用 T-162 的锚点方式（版本、页面、DOM 路径与文字快照），不往站点代码里写任何属性。发布页、版本历史外的公开路径、英文版都不出现标记。
6. 同步 `docs/project/spec.md`、`mainline.md` 与 AGENTS.md 中事实核对相关句；新术语"资料出处"写进 `CONTEXT.md`。

非目标：不给每句文案溯源；不证明资料本身真实；不另调第二个模型核对。

## Failure modes

实现前的合同失败方式清单（2026-10-14）：

- 编造、空白或来自网页／其他输入字段的引文被当作资料出处；跨字段跳过标签拼接也被误收。必须在本次 materials 内找到连续原句，语义支持仍由同一次模型核对负责。
- 真引文只差全半角或连续空白被误拒；除 NFKC 与空白压缩外的近似文字被误收。
- 核对返回遗漏出处数组、错误类别或不在该核对段的声明，却存为已记录；普通介绍被要求逐句标记。
- T-154 只复用通过结论而丢出处，或拼接不同核对轮的证据；旧版本缺字段被解释成零条。
- 资料改一字、整组增删改或重排后仍沿用旧出处；恢复版本时错用当前版本的出处。
- 局部修改仍核整站、丢失范围外出处，或新段的 DOM 路径变化后标记落到别处；未知旧依据被补成已核对。
- 页面切换、历史版本、刷新、缩放和滚动后标记与文字快照失配；375 的资料原句面板出界或截断。
- 为标记修改站点 HTML，或标记泄漏到预览独立 URL、发布页和英文版。
- 编造引文的拒因未进入现有两轮修正，或修正耗尽仍保存版本。

验收先跑非浏览器核对协议合同测试的预期红态；提交入口和工作台测试在主控释放 Chrome 后跑，再逐项回退对应改动确认可检错。证据留在 gitignore 的 artifacts/t169/。

## Acceptance

- [ ] 先列出失败方式清单（编造引文、引文只差空白或全半角、引文来自另一字段、复用段带旧出处、资料改后旧出处残留、局部修改后出处错位），再按清单写测试；每条测试在回退对应实现后失败
- [x] 确定性测试：真实原句通过；编造原句、跨字段拼接原句被拒并进入修正轮；资料改一个字后旧出处不沿用
- [x] 本地替身端到端：生成一站含至少 3 条高风险声明，工作台 1440/768/375 截图逐张看过，出处标记与原句显示正确，发布页无任何标记
- [ ] T-165 关票后，在负责人批准的 `SITECRAFT_TOKEN_LIMIT` 内跑一次真实小资料生成，记录出处条数、验真失败条数与 token 用量
- [ ] `npm run typecheck`、`npm test`、`npm run build` 通过；独立审查实例通过

## Resolution

当前 **INCOMPLETE**，票保持 open：中文工作台、确定性出处验真、段复用、局部修改、旧版未知状态与恢复绑定已验证；本分支标准全量仍有 9 项失败，英文切换验证尚未完成，真实模型预检超上限，独立审查未由主控安排。执行实例不自开审查、不推送。基线为合入 `6e0ccfe` 后的 `4be1f98`；本票以一个本地功能提交保留未完成候选，提交信息为 `feat: record verified fact citations in workspace (T-169)`，最终 SHA 在提交后写入 `artifacts/t169/commit.json` 并向主控回报（该提交包含本文，故不在本文写自指 SHA）。所有下列功能证据来自本次代码改动之后，保留在本工作树 gitignore 的 `artifacts/t169/`，未写主目录 `.sitecraft-data`。主控报告主线 `dfb9d5e` 已含 T-167，但 build 与测试入口正在修；明确通知前不合入 family-kit-assembly。

Tracer bullet 经生产 chat POST、受控 after、原提交入口、fs 版本与普通 dev server 工作台跑通；不称为真实 Next after 集成通过。Deep modules 保留原核对调用与提交入口，不添第二次模型核对或站点写入路径。Ubiquitous language 使用「资料出处」「资料原句」「核对段」，定位元数据属于版本检查，站点 HTML 不写标记。

### 本次验证（UTC，2026-10-14）

- 04:59:38：`node --test --experimental-strip-types tests/t169-fact-citations.test.ts`，**5/5 PASS**（`protocol-ready.log`）。实现前 `protocol-red.log` 为 **0/4、退出 1**，属于新增合同的预期红态。`T169_MUTANT=<normalize|quote|claim|reuse|bind|source> node --experimental-strip-types --import ./tests/fixtures/t169-counterfactual.ts --test --test-name-pattern=<对应合同名> tests/t169-fact-citations.test.ts` 各在预期断言失败，日志 `counterfactual-*.log`；未用导入或环境错误充当回退证据。
- 05:07:59：`SITE_STORE=fs SITECRAFT_BASE=http://127.0.0.1:57783 SITECRAFT_DATA_ROOT=/Users/luckye/Documents/Code/sitecraft-ai-t169/artifacts/t169/dev-data CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node --test --experimental-strip-types --test-name-pattern='本地替身' tests/t169-citations-browser.test.ts`，**1/1 PASS**（`browser-ui-settled.log`）。同票 `browser-chinese.log` 的修正耗尽与局部复用两项已通过；其 UI 等待失败原样保留，改为等待实际视口与渲染完成后使用同一场景通过。`browser-1791954462432/workspace-{1440,768,375}.png` 三张逐张打开看过，均有编号、资料原句与有效网页。替身首版有 3 条出处，1 次 facts 调用，三档底线检查通过，发布页及独立预览无标记。`T169_MUTANT=<record|quote|local>` 的对应入口测试分别因空出处、编造引文仍存版、局部后只剩 1 条而失败（`counterfactual-browser-*.log`）。
- 05:12:20：同一 fs/base/dataRoot/Chrome 环境下，`node --test --test-concurrency=1 --experimental-strip-types tests/t154-fact-segments.test.ts tests/t152-local-edits.test.ts tests/t152-restore-facts.test.ts tests/t152-local-model-input.test.ts tests/t138-thinking-mode.test.ts tests/t158-general-prompts.test.ts` 为 **47/48**；唯一失败为 T-158 仍要求旧文本提示格式。改为验证结构化请求保留原文且只核新段后，05:17:22 的 `SITECRAFT_BASE=http://127.0.0.1:57783 node --test --experimental-strip-types --test-name-pattern='local audit' tests/t158-general-prompts.test.ts` **1/1 PASS**（`t158-local-green.log`）。
- 05:24:22：已先报告主控并用 ps 确认无其他 Chrome / node --test 后，在上述 fs/base/dataRoot/Chrome 环境并设置 `DEEPSEEK_BASE_URL=http://127.0.0.1:57782 DEEPSEEK_API_KEY=local-only DEEPSEEK_MODEL=local-only` 运行 `npm test`，**465/474，9 失败，退出 1**（`npm-test-first.log`）。8 项为旧测试读写硬编码 `.sitecraft-data`，与显式独立根不一致；本分支测试基线未含 T-167（其提交 `e7cee62`），本票不绕回默认数据根。1 项为原句「取得 ISO 9001 认证。」译成「ISO 9001 certified.」后被现有英文保真检查拒收；请求主控决定是否纳入修复，未改 T-151 实现或换输入掩盖失败。T-162 的标准三档交互、移动定位、历史只读、存储拒绝和滚轮检查均在本轮通过。
- 05:15:29：`SITE_STORE=fs SITECRAFT_DATA_ROOT=/Users/luckye/Documents/Code/sitecraft-ai-t169/artifacts/t169/build-data DEEPSEEK_API_KEY=local-only DEEPSEEK_BASE_URL=http://127.0.0.1:1 DEEPSEEK_MODEL=local-only npm run build`，**PASS**（`build-delivery.log`）。05:31:14 的 `npm run typecheck` **PASS**（`typecheck-legacy-order.log`）；当前 project-map status **0 problems / 0 stale living docs**。文档回读为 UTF-8，无 BOM、替换字符或无关格式化。

06:23:56：恢复 Chrome 使用后，以同一工作树服务的新随机 origin `http://127.0.0.1:50532`、上述 dataRoot/Chrome 和本地模型替身重跑 `node --test --experimental-strip-types tests/t169-citations-browser.test.ts`（`browser-resume.log`）：**3/4**，首次 iframe 正文与外部给定 HTML 完全一致、三档显示、修正轮、复用与局部定位通过；最后一项的恢复与旧版未知状态断言已执行通过，仍在随后的英文提交处因同一保真拒因失败，英文 UI 没有执行。`browser-1791959009410/workspace-{1440,768,375}.png` 三张逐张打开看过。06:25:28 的 `T169_MUTANT=old node --experimental-strip-types --import ./tests/fixtures/t169-counterfactual.ts --test --test-name-pattern='旧版本' tests/t169-citations-browser.test.ts` 在英文提交之前因真实工作台显示「0 条资料出处」而非「未记录出处」失败（`counterfactual-browser-old.log`），证明该旧版合同可检错；其余已记录变体保持。没有重跑全量、真实请求或合入未获准的主线。

### 真实模型：INCOMPLETE（预检 NO_GO）

04:45:35，`node --experimental-strip-types artifacts/t169/preflight.mjs` 只向本地替身捕获当前规划、写页、事实核对的完整请求，使用 T-165 的 `reserveRequest` 离线计算；60 字资料，只要求一页，三次当前输出上限均为 65,536。规划预留 83,025，写页 81,551，事实核对 69,149，合计 **233,725**；乘 1.2 为 **280,470 > 80,000**（`preflight.json`）。按批准规则停止在出网前，没有启动真实网关或真实生成；真实出处条数、验真失败条数 **未测**，实际付费 token **0**。主要原因是完整输出上限的预留，未自行调低上限、换材料重跑或借历史预算。

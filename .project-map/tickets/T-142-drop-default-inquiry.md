---
id: T-142
title: 落实 T-141：规划、写页与模拟资料不再默认带询盘、报价、邮箱联系和联系页
type: build
status: open
blocked_by: []
claimed_by: t137-build
supersedes:
---

## What to build

按 T-141：
1. 规划与写页提示（`lib/code-site-model.ts` 的规划/写页文字、`skills/site-code-core/` 规范与骨架卡、两份风格 skill）删除默认安排联系页、系统询盘表单、报价/样品/规格表入口、邮箱联系的引导；改为「用户资料或要求里有才做」。资料少就少做，不为凑页面编结构；骨架卡里依赖询盘的序列改为可选。
2. 系统询盘表单（`data-system-inquiry`）保留为用户要求时可用的功能部件，不再出现在默认流程与示例里。
3. 四家模拟资料去掉遗留的「目标：让采购…询价」「主按钮：索取…」「询盘要求」等推销询价的条目；联系方式只在资料本身就有时保留（邮箱仍用 luckye.online）。评估用的页面要求同步，不再要求联系页。
4. 事实校对里承诺/政策类核对清单保留（模型自己编报价、交期仍要拦），但不再把询盘流程当作默认内容。
5. 不调用真实 DeepSeek；用本地夹具证明：资料里没有询盘/联系要求时，规划不出联系页、页面不含询盘表单与报价入口；资料里明确要求时仍能生成。

## Acceptance

- [x] 提示词、规范、骨架卡、模拟资料与评估要求中不再默认引导询盘/报价/联系；有测试，坏实现（恢复默认询盘）失败
- [x] 用户明确要求询盘表单或联系方式时仍可生成，有测试
- [ ] Astra 审查通过；typecheck、test、build 通过

## Resolution

INCOMPLETE（本票改动与相关验证已完成；全套历史夹具问题、Astra 审查仍待主控）。执行者 `t137-build`，2026-10-09，基于 `9b123ff`。本节与代码同在唯一的本地功能提交中，确切 SHA 见执行汇报；不派审查、不关票、不推送。

规划、写页实际发送的提示、核心规范、八张骨架卡、两份风格规范已统一 T-141：按用户给的资料安排内容，少资料可以只做首页；不默认增加询盘表单、报价/样品入口、邮箱联系或联系页。联系方式资料可按原文展示，但单项邮箱不强制联系页，商业条件不等于网站询盘功能要求。每张骨架的固定联系/询盘收尾已移除，有明确功能要求时才追加。工作台空状态和超长资料提示也不再要求先补联系方式。

四家模拟资料的原始正文移除了目标、主按钮、询盘要求等推销性建站指令。旧路线仍消费的辅助 goal/heroCta 字段改为产品展示与产品浏览，不增加第二套接口或兼容路径。已有邮箱事实仍为 `luckye.online`；产品、规格、设备、质检、沿革、交付、MOQ 和交期等业务事实保留。原询盘要求中的技术输入改为「选型资料」，保留工况、图纸、材料、尺寸、版本等信息，不据这些信息授权网站营销功能。原有外贸批量交期句仍作为已提供的业务条件保留，不扩展为询盘流程。

完整评估的明确页面请求从 3/5/5/4 同步为 2/3/4/3（工业：首页、产品；外贸：首页、产品、认证与材料追溯；注塑：首页、产品、生产与质检、常见问题；纸包装：首页、包装产品、打样与订购）。数量验证同步，没有要求联系页或资料索取表单。快速档仍按原规模只请求首页和产品页，不新增联系页。真实模型评估未运行，输入变化后的轮次仍按原规则拒绝与旧资料轮次混作成对比较。

系统询盘渲染器、提交入口和事实校对未删除或绕过。`lib/code-site-model.ts` 仅规划和写作提示文字发生改变；thinking、temperature、max_tokens、tools、response_format 等调用参数均未修改，auditCodeFacts 的政策核对清单全文未修改。现有资料与用户补充中的真实报价/交期仍须校对。没有新增确定性关键词拦截、回退或重试。

本次证据（UTC，对应本 Resolution 所在本地提交；artifacts 为 gitignore，失败证据保留）：

- `CHROME_PATH=<AGENTS 指定路径> node --test --experimental-strip-types tests/t142-material-inputs.test.ts tests/t142-no-default-inquiry.test.ts`：原实现四项全部失败，分别为营销目标、评估联系页、骨架固定收尾、实际规划请求仍带默认联系/询盘。`artifacts/t142/red.log`，09:43 UTC。
- 恢复默认询盘反例：仅将实际规划提示一行恢复为 `9b123ff` 的旧文字，再运行 `tests/t142-no-default-inquiry.test.ts`，实际出站请求重新带“联系资料很薄时只安排…系统询盘表单”和三页默认值，断言失败。日志 `artifacts/t142/default-inquiry-mutant.log`，10:00 UTC；原文件在 finally 中精确恢复，随后同一场景通过，未改模型参数。
- `CHROME_PATH=<AGENTS 指定路径> node --test --experimental-strip-types tests/t142-material-inputs.test.ts tests/t142-no-default-inquiry.test.ts tests/t130-eval-set.test.ts tests/t138-quick-eval.test.ts tests/t140-review-materials.test.ts tests/simulated-packs.test.ts tests/t137-materials.test.ts tests/t137-eval-images.test.ts tests/chat-route-block-layouts.test.ts tests/chat-route-truncated.test.ts`：40/40 通过（`artifacts/t142/related-final.log`，10:00 UTC）。完整/快速评估均由真实 CLI 提前拒绝不兼容的本地旧轮次，未调用模型或外部对照站点；校验实际写出的资料页面请求。
- 本地创建 → 资料 → 风格选择 → 规划 → 确认 → 原提交入口 → 刷新读取：薄资料只有首页，已存版本无 form、mailto、报价或联系入口。随后同一会话明确补充邮箱并要求联系页与系统询盘，新增第二版本，联系页出现表单和对应邮箱，第一版本保持原样。两版本均通过三档底线检查；模型与事实审核响应是独立本地夹具，不是对真实模型智能或事实审核准确率的证明。最新流程记录在 `artifacts/t142/flow-*/report.json`，内含请求、版本和检查；每次运行新目录，不覆盖旧反例。
- `npm run typecheck` 与 `SITE_STORE=fs npm run build` 均退出 0，构建使用 Turbopack。日志 `artifacts/t142/typecheck-delivery.log`、`build-delivery.log`，10:00 UTC。
- `SITE_STORE=fs SITECRAFT_BASE=http://127.0.0.1:3152 CHROME_PATH=<AGENTS 指定路径> npm test`：2643/2647 通过，无跳过（`artifacts/t142/full-test.log`，09:57 UTC）。两项旧路线测试因当前资料已无默认目标而进入 business-goal 提问；已在各自场景输入中明确补上产品展示目标，未恢复生产默认、未删断言，相关六项单测通过（`legacy-callers-final.log`，09:59 UTC）。另两项为 T-090 缺历史站点导致无 scan.json、T-113 固定历史站点的图片 GET 404，不在本票修基础设施。没有把单测结果拼成全套通过，本票未再次运行完整套件。
- `CHROME_PATH=<AGENTS 指定路径> node --experimental-strip-types artifacts/t142/browser/check.ts`：3152 身份确认为本工作树，真实 code-preview HTTP 读取第一/第二版本，1440/768/375 校验无要求时 forms=0、无 mailto；明确要求时 forms=1、mailto 为用户补充的邮箱。再通过工作台新建入口检查空状态不要求联系方式；共九张截图全部打开。证据 `artifacts/t142/browser/report.json` 与 PNG。图为技术夹具，不作为独立审美通过证明。
- UTF-8/LF、无 BOM/替换字符、`git diff --check` 通过；CONTEXT/mainline/spec 已同步，project-map 无 Problems、无 stale living docs。

真实 DeepSeek 调用 0 次。3152 检查服务的模型地址禁用，单测使用本机 HTTP 响应；没有邮箱发送、真实生成或盲评。第三项验收未勾选；票保持 open，交主控验收、Astra 审查。

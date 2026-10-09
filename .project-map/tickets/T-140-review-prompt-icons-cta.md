---
id: T-140
title: 盲评提示与模拟邮箱按 T-139 更新；扩充系统图标；减少页头与首屏重复入口
type: build
status: closed
blocked_by: []
claimed_by: t137-build
supersedes:
---

## Why

快速档盲评（`artifacts/blind-quick-2026-10-09/`）理由里，除 T-139 已决定的两项外，还有：全站只用同一个纸飞机图标（系统只提供 `arrow`、`mail` 两个图标）；页头与首屏重复同一个询盘按钮。

## What to build

1. 按 T-139：评估包的 mixed、company、comparison 提示词写明「待补充」是产品有意展示的资料缺口，不作为判断依据；四家模拟资料与评估资料的邮箱改为 `luckye.online` 域名下的地址（不使用任何真实企业域名）。
2. 扩充系统图标：沿用 T-084 的规则（Lucide 有的直接用，项目已依赖 lucide-react），按 B2B 官网常用场景补到约 10–15 个（如电话、地图位置、下载、文档、证书、工厂、齿轮/加工、检测、包裹/物流、时钟/交期、外部链接不提供），提交入口的白名单与渲染同步；核心规范里给出图标清单和「按含义选、不要每个链接都加图标」的引导。
3. 核心规范引导：页头已有主询盘入口时，首屏换成不同任务的入口（如看产品、下载资料）或只保留一个；不加确定性硬拦。
4. 不调用真实 DeepSeek；用本地夹具证明图标渲染、白名单、提交检查与提示词变化。

## Acceptance

- [x] 三类评审提示词包含「待补充」不计入判断的说明；资料与评估邮箱均为 luckye.online；有测试
- [x] 新图标经提交入口渲染、未知图标仍被拒；坏实现失败
- [x] Astra 审查通过；typecheck、test、build 通过

## Resolution

INCOMPLETE（执行改动与相关检查已完成；全套有两项历史夹具失败，Astra 未审）。执行者 `t137-build`，2026-10-09，基于 `de6d763`；本节与代码同在唯一的本地功能提交中，具体 SHA 见执行汇报。按负责人要求不派审查、不关票、不推送。

T-139 已落实到实际输出：mixed、company、comparison 三种评审包共用的提示词明确「待补充」是有意展示的资料缺口，不作为来源、同模板、不合格或跨轮优劣的判断依据。模拟资料中的四个邮箱改为 `inquiry@xinzhou-drive.luckye.online`、`catalog@waigaoqiao-fluid.luckye.online`、`rfq@ninghai-mould.luckye.online`、`sample@qinghe-pack.luckye.online`；评估直接保留同一份资料地址，不再转换为 `.example`。旧的历史记录和独立反例输入未重写。相关期望值只更新了直接消费四家当前资料的测试，缺口、正文事实和模拟标记继续保留。

系统登记十四个 Lucide 图标：arrow、mail、phone、map-pin、download、file-text、certificate、factory、cog、inspection、package、truck、clock、wrench。arrow 现在是 ArrowRight，不再映射为纸飞机。提交白名单与渲染共用 `lib/code-site-icons.ts`；未登记名称、external-link、constructor、__proto__ 仍拒收，不增加版本。只用已安装的 `lucide-react@0.511.0` 公共组件，没有自画图标或新增依赖。Next 的 RSC 图禁止运行时导入 `react-dom/server`，因此用 `node scripts/generate-code-site-icons.mjs` 开发侧导出静态 SVG；运行时只有这套静态登记表，没有另一条渲染路径，访客页不加载 React。统一 20px、1.75 笔画、currentColor、装饰性 aria-hidden/focusable；生成 HTML 保留上游完整 ISC 说明。

核心规范提示按含义选图标、不为每个链接加图标；页头已有询盘时，首屏使用不同任务入口或只保留一个询盘入口，下载须有真实资料和可用目标，没有新增确定性 CTA 拦截。资料已标明的缺口保留待补充。`lib/code-site-model.ts` 只改写作提示开头的一句缺口说明；modelJson 请求参数、thinking、temperature、max_tokens、tools、response_format 等均未修改，另一执行者的思考模式工作未介入。CONTEXT、intent、mainline、spec 已同步当前规则。

本次证据（UTC，对应本 Resolution 所在提交；artifacts 为 gitignore）：

- `CHROME_PATH=<AGENTS 指定路径> node --test --experimental-strip-types tests/t140-review-materials.test.ts tests/t140-code-icons.test.ts`：原实现五项全部失败。图标被真实提交入口拒收，提示缺少占位说明，资料与实际评估 CLI 仍输出旧域名，核心规范没有不同任务引导。日志 `artifacts/t140/red-boundary.log`，08:42 UTC；第一次 Node 别名加载失败另存 `red.log`，不当作行为反证。
- 写作请求反例：暂时从核心规范移除页头/首屏不同任务引导，运行 `node --test --experimental-strip-types --test-name-pattern='the actual writer request' tests/t140-review-materials.test.ts`，实际发送的本地请求缺引导并导致断言失败；随后精确恢复原文件，单测通过。`artifacts/t140/writer-mutant.log`、`writer-green.log`，08:55 UTC。HTTP 响应是本地夹具，不连接真实模型。
- 图形反例：暂时将十四个登记项的几何改成同一个已有 ArrowRight，保留各自编号；运行 `tests/t140-code-icons.test.ts` 后真实提交成功，但渲染只有一种图形，独立断言 `1 !== 14` 失败。原文件已恢复，最新检查通过。`artifacts/t140/constant-icon-mutant.log`，09:04 UTC；失败版本与产物保留。
- `CHROME_PATH=<AGENTS 指定路径> node --test --experimental-strip-types tests/t140-code-icons.test.ts tests/t140-review-materials.test.ts tests/simulated-packs.test.ts tests/t137-materials.test.ts tests/block-email-breaks.test.ts tests/block-layouts.test.ts tests/published-facts.test.ts tests/icon-registry.test.ts tests/t130-eval-set.test.ts tests/t137-eval-images.test.ts`：64/64 通过（`artifacts/t140/related-final.log`，09:05 UTC）。包括实际三类提示文件、完整评估资料、真实写作请求，以及创建接口 → 提交入口 → 已保存版本 → 静态渲染。图标夹具的事实审核响应为本地数据，不能据此声称真实模型的事实审核通过。
- `npm run typecheck` 退出 0（`artifacts/t140/typecheck-delivery.log`，09:05 UTC）；`SITE_STORE=fs npm run build` 使用 Turbopack、退出 0（`artifacts/t140/build-delivery.log`，09:10 UTC）。失败的运行时 SSR 尝试保留在 `build-initial.log`，旧方案已删除。
- `SITE_STORE=fs SITECRAFT_BASE=http://127.0.0.1:3151 CHROME_PATH=<AGENTS 指定路径> npm test`：2641/2643 通过，未跳过测试（`artifacts/t140/full-test.log`，09:01 UTC）。T-090 原有几何场景依赖缺失的历史站点，未产出 scan.json；T-113 固定历史站点的图片 GET 返回 404。未换站点、跳过断言或用单测通过代替全套通过；这两项仍需主控安排可复建夹具，未在本票修测试基础设施。
- 真实提交的十四种 SVG 及待补充文字在 Chrome 三档查看：`artifacts/t140/icons-6c137d86-b2d5-4cd3-8894-a0f10286ab1f/` 的 commit.json、rendered.html、1440/768/375 PNG，三张均打开；没有横向溢出、重叠或对比度问题。未知图标全部拒收，版本数保持一个。
- `CHROME_PATH=<AGENTS 指定路径> node --experimental-strip-types artifacts/t140/public-preview-verified/check.ts`：3151 身份确认为本工作树，已存版本经真实 code-preview HTTP 接口读取；十四个图标、CSP 无脚本和 ISC 说明可观察，三档整页截图均打开。结果在 `artifacts/t140/public-preview-verified/report.json` 与 PNG。早期公共预览夹具遗漏站点创建记录，以及自写捕捉使用了 CSP 禁止的页面定时回调，两次失败均保留；修正创建入口并使用项目现有 captureEvalPage 后通过，没有改服务端安全策略。
- `git diff --check`、UTF-8/LF/无 BOM/无替换字符检查通过；project-map 无 Problems、无 stale living docs。

DeepSeek 真实调用 0 次。3151 检查服务的模型配置指向本机禁用端口，模型相关单测使用本地 HTTP 夹具；没有外部模型探测、邮箱发送或真实评估。执行者只做技术自查，不宣布独立审美或 Astra 审查通过；第三项验收保持未勾选，票保持 open。

### 合并验收（Claude，2026-10-09）

Astra（t140-astra，05:20 EDT）审 de6d763..2d5ed98：PASS（提示词只新增「待补充」说明、无答案泄露；邮箱均为 luckye.online；14 个 lucide-react 图标经提交入口、未知名称仍拒；CTA 与图标为引导非硬拦）。合并为 4cfbaf5；主工作区 3034：`npm run typecheck`、`npm test` 2643/2643、`npm run build` 通过（`artifacts/merge-4cfbaf5/`）。


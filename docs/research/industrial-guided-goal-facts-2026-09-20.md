# 工业引导建站 GOAL 事实表（2026-09-20）

状态：`INCOMPLETE`。这是 GOAL 的只读前门记录，不是页面质量通过证明。

## 目标切片

目标是把一份模糊或完整的忻州重载减速机 P3I 资料，经过可恢复的最小需求引导和生成前确认，落成一张能在工作台生成、修改、刷新后重新打开的工业询盘首页。

当前基线：`e6b2370`；工作树干净。上一轮未验收的 family-kit/admission 实验保存在 `pre-goal-family-kit-20260920` stash，不作为本轮实现输入。

## 已观察到的事实

### 资料

来源：`lib/simulated-packs.ts` 的 `simulatedPacks.industrial`，以及 `docs/project/plan.md` 的历史记录。

- 公司：忻州重载减速机P3I；资料明确标记为内部模拟资料。
- 行业：工业制造 / 重载减速机。
- 目标：获取批量规格询盘，不接零售散单。
- 产品：直角减速机、行星减速机；业务方式为按图加工。
- 首屏事实：按图加工重载减速机 P3I-NX7Q；不提供现场安装；仅接受批量规格询盘。
- MOQ：20 台；邮箱：`inquiry@p3i-sim.test`。
- 未提供：认证、产能数字、客户名单、电话、地址。
- 页面要求：首页、产品、联系作为当前模板上的区块，不要求额外独立 URL。
- 模拟包本身没有产品图片或规格文件字段；不能据此虚构下载或图文版资产。

### 现有需求对齐

来源：`lib/alignment.ts`、`app/api/sites/[siteId]/chat/route.ts`、`tests/alignment.test.ts`。

- 已有状态：`awaiting_style`、`awaiting_user`、`awaiting_confirmation`、`idle`、`cancelled`。
- 已有能力：会话内保存 `pendingRequest`、问题版本、答案、运行 ID、提案和结果；测试覆盖刷新恢复、过期问题、重复选择、确认和取消。
- 默认第一问是“请选择网站的样子”，选项来自五个 `visualBrief`，另有跳过、AI 推荐和其他。
- 已有 clarify 类型和最多三轮限制，但尚未证明它会先围绕业务目标与访客提出问题，也没有方案摘要字段承载交付范围、资料缺口和缺图处理。
- 需要确认：聊天直接提交是否在所有入口都被确认门拦截；工作台真实 UI 是否与服务端恢复状态一致。

### 草稿、操作和视觉字段

来源：`lib/site-document.ts`、`lib/site-operations.ts`、`lib/template-adapters/types.ts`、`lib/template-adapters/preview-bridge.ts`。

- 草稿包含 `visualBrief`、`goal`、`pagePlan`、内容区块、产品列表和 `hiddenSections`。
- `visualBrief` 当前只有方向、摘要、受众、主要行动和宿主模板，没有 palette 标识。
- kit token 当前是背景、文字、强调色、边框、字体、圆角六项；bridge 会把它们写入预览根节点的 data 属性。
- 已有受控草稿操作和共享预览 bridge；没有可确认方案的操作，也没有 palette 选择/持久化操作。
- 当前代码结构不能证明 token data 属性会改变页面的有效 CSS；需要浏览器和计算样式证据。

### 已有页面基线证据

来源：`artifacts/p3-workspace-journey/industrial-confirmed.png`、`industrial-09-mobile.png`。这是此前工作台旅程留下的历史截图，不是本次 fresh 浏览器复核；`evidence.json` 记录了当时浏览器上下文已关闭，因此只作为已观察的失败基线。

- P3I 标题、说明和主要按钮已经落点，但首屏仍显示 ScrewFast 字标、`Contact Sales Team`、包装演示图、`12.8k Reviews` 和客户 Logo 墙。
- 移动端仍显示同一套演示品牌和包装图，CTA 与次要按钮重复，首屏下方保留大块演示素材。
- 因此当前 assemble 的成品质量门为 `NO_GO`；“文字已写入”或“隐藏部分区块”不能作为通过条件。
- fresh 桌面/移动浏览器复核仍待 Cua 服务恢复后补做；HTTP 200 只能证明路由响应，不能证明视觉通过。

### 针对性机器检查

2026-09-20 在当前基线运行：

```text
node --test --experimental-strip-types \
  tests/template-preview-bridge.test.ts \
  tests/alignment.test.ts \
  tests/simulated-packs.test.ts
```

结果：36/36 通过。它证明 bridge 的声明落点、演示壳隐藏、对齐状态机和模拟资料隔离契约成立；不能证明页面比例、信息组织或整页审美成立。Cua 浏览器服务本轮启动失败，fresh 截图仍是 `UNVERIFIED`。

## 推断与边界

- 需求引导可以复用现有会话状态机，但不能把“选样子”改名后冒充业务需求形成；需要明确区分事实、偏好和已确认方案。
- 页面质量仍是前置门。问答和色板不能绕过当前 assemble、人工基准、自动生成三份整页对照。
- 本 GOAL 先验证一个真实可生成的默认色板；三套命名色卡和自由品牌色属于后续切片。
- 开发侧可以修改 CSS 和布局；运行时仍通过受控操作，不开放模型任意 HTML/CSS。

## 尚未验证的关键问题与最小探针

1. **当前页面基线**：用相同 P3I 资料在 1440、768、390 视口打开工作台/发布页，保存整页截图和草稿快照。若仍残留模板演示壳、空大图位或移动端溢出，则基线为 `NO_GO`，先修页面。
2. **引擎布局能力**：在现有工作台链路中手工指定首屏、产品类别、加工方式、询盘和缺图版布局；若明确结构仍无法在共享 bridge 呈现，则记录具体阻塞后再决定是否调整底层。
3. **确认门完整性**：从模糊描述和完整资料各走一次，验证资料完整时不重复问、模糊时只问会改变结果的问题；刷新、关闭面板和重新打开后仍停在正确状态；未确认不能生成。
4. **方案生效**：确认主要行动、交付范围、视觉方向、默认色板和缺图处理后生成，检查页面、草稿 revision 和发布页是否读取同一方案；改色不能改文案、布局或产品。

负责人：主负责人。证据位置：`artifacts/industrial-guided-goal-20260920/`（默认 gitignore）。

## 本轮人工基准页证据

2026-09-20 在 `SITE_STORE=fs` 开发服务上创建了 `goal-p3i-20260920`，通过 `PUT /api/sites/goal-p3i-20260920/draft` 的 `commitOperations` 写入工程工业样式、P3I 文案、两类已确认产品和询盘边界，revision 为 2。没有写入图片或未提供的企业事实。

- 预览宿主：`screwfast` 的本地工业 overlay，仍走 `/api/templates/screwfast/preview`、iframe 和共享 bridge。
- 桌面截图：`artifacts/industrial-guided-goal-2026-09-20/goal-p3i-desktop.png`，1440×1400。
- 移动截图：`artifacts/industrial-guided-goal-2026-09-20/goal-p3i-mobile-v2.png`，390×1400；第一版曾出现长标题/导航溢出，已通过最小宽度和断行规则修复。
- 路由结构检查：preview HTTP 200；可见 HTML 含工业 overlay 和产品 grid；脚本移除后的 body 不含 ScrewFast、Contact Sales Team、12.8k Reviews、客户 Logo 墙或 SaaS 定价。
- 产品集合：`P3I-RA1` 直角减速机、`P3I-PL1` 行星减速机；没有空产品卡。

这证明人工指定页面已经可成立，不证明自动生成、需求确认或刷新恢复已完成。完整结构化记录在 `artifacts/industrial-guided-goal-2026-09-20/page-evidence.json`。

## 需求引导与自动生成证据

2026-09-20 通过本地 API + `deepseek-flash` 跑通完整 P3I 资料路径，站点 `guided-p3i-full4-20260920`：

1. `start` 返回业务目标问题 `business-goal`，没有直接生成。
2. 选择「让采购看懂产品，并提交询价」后进入 `style-theme`。
3. 选择「工程工业」后进入 `build-plan`。
4. 选择「按工业询盘首页执行，先用无图版」后才调用 provider，返回确认提案。
5. 确认提案后 revision 变为 2；服务端把用户选择的 `engineering-industrial` 注入为受控 `set_visual_brief` operation，最终模板为 `screwfast`。
6. provider 使用 `replace_products`，最终商品只保留直角减速机和行星减速机；“按图加工”留在商品说明/加工方式中，没有生成第三张商品卡。

自动结果截图：

- `artifacts/industrial-guided-goal-2026-09-20/guided-full4-desktop.png`
- `artifacts/industrial-guided-goal-2026-09-20/guided-full4-mobile-v2.png`
- `artifacts/industrial-guided-goal-2026-09-20/guided-full4-mobile-cdp.png`（Cua 复核前用设备指标重采的 390px 视口）

当前、人工基准、自动结果的同条件索引在 `artifacts/industrial-guided-goal-2026-09-20/comparison.json`。这证明方案状态、样式绑定、产品清单和共享预览链路已贯通；刷新/重新打开回读、图片等待分支和完整页面人工盲评仍未完成。

## 自动生成后的持久化回读证据

在 `guided-p3i-full4-20260920` 完成确认后，通过现有 `commitOperations` 入口手工修改首页 CTA 为“索取 P3I-EDIT 交期”，以 revision 2 为基线提交。服务端返回 revision 3；随后重新读取草稿，确认 CTA 已更新，同时仍保留 `screwfast`、`engineering-industrial` 和两类 P3I 产品，没有重置页面方案。

- 提交记录：`artifacts/industrial-guided-goal-2026-09-20/auto-edit-commit.json`
- 回读记录：`artifacts/industrial-guided-goal-2026-09-20/auto-edit-readback.json`
- 回读后的发布截图：`artifacts/industrial-guided-goal-2026-09-20/guided-full4-edited.png`

这条探针证明修改仍经过受控操作并可在重新读取后恢复；当时的证据采集使用了 Chrome headless，后续 Cua 复核见下节。当前 GOAL 仍不把等待上传图片的后续恢复流程写成已完成能力。

## 最终机器门禁

2026-09-20 在最新代码上运行：

```text
npm test              # 177/177 通过
npm run typecheck     # 通过
npm run build         # 通过，Next.js 16.3.1
```

构建输出包含全部 App Router 路由，未产生未提交的 `next-env.d.ts` 变更。Node 的 `MODULE_TYPELESS_PACKAGE_JSON` 仅为现有测试运行警告，不影响结果。

## Cua 真实浏览器复核补充

随后在 Cua 的真实 Chromium 页面上复核 `guided-p3i-full4-20260920`：

- 桌面视口的无障碍树读到 P3I 标题、已编辑 CTA、两张产品卡、询盘表单和资料边界 FAQ；未出现模板演示品牌或价格内容。
- 设置 390×1400 移动视口后，外层文档和内嵌工业页的 `scrollWidth` 分别为 390 和 375，均等于各自可见宽度，没有横向溢出；产品卡数量为 2，标题保持为 `按图加工重载减速机 P3I-NX7Q`。
- 复核结束后清除了临时移动视口覆盖，恢复默认浏览器视口。

因此，桌面/移动的真实浏览器结构和溢出门禁已通过；图片等待分支、完整页面的独立人工盲评和多色板仍属于后续范围。

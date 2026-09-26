# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

# SiteCraft AI 项目规则

## 目标与优先级

内部技术 Demo：用模拟的工业、设备、零部件、外贸 B2B 资料，生成**看起来像那家公司自己建的**网站，并能在对话里修改、在预览里看到。

做任何事前先问：**这件事有没有让生成站更好看、更真、更好改？** 优先级固定为：

1. 生成页面的质量（由独立审核 agent 盲评判断）；
2. 主流程可用：资料/Prompt → 需求对齐 → 确认 → 生成 → 修改/撤销 → 刷新恢复；
3. 其他一切（部署、环境、基础设施、证据整理）。

排在 3 的事不能占用 1、2 的时间。当前该做什么只看 project-map 的 frontier（见「开工前」）。

## 开工前

- 运行 `python3 /Users/luckye/Documents/SKILLS/project-map-skill/project-map/scripts/project_map.py status --root .`（project-map skill 的脚本；Claude 端也可用 `~/.claude/skills/project-map/scripts/`），再读 `.project-map/MAP.md` 和术语表 `CONTEXT.md`。只从 frontier 领票：开工前在票的 `claimed_by` 写上自己的名字，一次只做一张 build 票，按票里的验收勾选项交付。
- 需要时再读 `docs/project/` 下的 `mainline.md`（主线与素材规则）、`intent.md`（已确认需求）、`spec.md`（规格）。`plan-history.md`、`review-*.md` 和 `.grilling/` 是历史记录，不是待办。
- 用户说「主线」「reality-first」或 `/grilling` 时，先用几句话对照 mainline 和 MAP：这次任务是否让站点更好看、更真、更好改；对不上就停下来说。
- 看 `git status` 和 diff。现有未提交代码是用户的工作，不覆盖、不回滚、不重排。

## 本阶段不做

以下事项不是当前目标，**不要主动开始、不要排进 Goal 队列、不要因为它们没验证就把任务标成未完成**：

- 公网部署、Cloudflare/任何临时公网隧道、iPhone/Android 实机测试。移动端用浏览器设备模式（375/768/1440）验收即可。
- 修本机网络或系统：VPN、DNS、路由表、`/etc/hosts`、代理、Docker Registry。需要 sudo 的操作一律不做。
- 外部邮箱送达、生产数据库运维、完整 Docker 镜像重建。
- 真实客户试点、整仓合并 `hlanan886/sitecraft-ai#4`、批量 cherry-pick 或搬运其 dist。

**环境问题只报告一次**：DeepSeek 连不上、Docker 没起、外置硬盘没插等，最多试一次，然后用一句话告诉负责人需要他做什么（例如「在 VPN 客户端给 `api.deepseek.com` 加 DIRECT 规则」），接着做不依赖它的工作。不写探针日志、不为此单独提交文档。

用户明确要求做上面某一项时照做，但只做那一次，做完回到 plan。

## 生成路径的硬约束

这些是用户多轮决定后的结论，改动前须负责人重新确认：

- **样子 → 同族模块素材 → 这家公司的完整页面**（细则见 `mainline.md`）。开源模板、区块、样式是素材；不得把整页快照挖空填词当成品，不得跨视觉族拼接区块。
- **一个预览引擎**：`lib/template-adapters/preview-bridge.ts` + 已准入的同族 overlay/kit。不另起渲染器，本阶段不做原生 React/shadcn 拼装。
- **运行时模型不输出 HTML/CSS**。模型理解需求、产生受控意图和白名单 operation；开发侧可以自由改 overlay 的 HTML/CSS、组件和布局。
- **所有草稿修改走 `commitOperations`**。Skill、模型、测试夹具不得旁路写草稿。
- **adapter 是可审查数据**（选择器、目标、属性、集合映射），不存每模板可执行 JS。写入须唯一命中声明节点；未命中报告 `missing`，不按标题正则、元素顺序或卡片形状猜写。`covered/applied` 只来自实际落点。
- **成品否决项**：事实只能来自用户资料或「待补充」；不得残留未选用的模板品牌、客户 Logo 墙、SaaS 定价、演示图、假评价/数字、空链接。`missing` 是落点失败，不是保留演示壳的理由。
- 页面规划：用户点名的页面 → 模型按业务规划 → 实在无法确定时首页/产品服务/联系。默认三页不是上限；做不到的页面要明确说明，不静默缩成首页。
- 需求对齐：选项通过结构化请求保存，同一会话继续，刷新可恢复；不要求用户复制输出或手打「继续」；不靠挂起的 HTTP 请求等用户。用户选的是样子/主题/行业方向，不是内部 Skill 名。
- 设计选择必须落到 `visualBrief`、kit/slot map 或白名单 operation；只改 prompt 文案而页面看不出变化不算完成。
- 删除只由用户明确选择；系统不自动清理对话、草稿、上传或站点，不做定时清理或清理开关。
- 前端改动遵循 `skills/frontend-less-ai-tone/`；生成或改 SiteCraft 站点文案/样子时叠加 `skills/sitecraft-frontend-less-ai-tone/`（运行时子集 `lib/frontend-tone.ts`）。
- 不为未来功能预置平行 API、兼容层、空 schema 或推测性抽象。

## 素材与许可

- 代码 MIT/Apache 不代表图片、字体、图标、商标可用，须分别核验；普通客户交付许可不能推导为生成器再分发许可。
- 调研不等于准入：新模板/仓库须核来源、版本、许可和实际渲染效果后才进 `vendor/` 或挂样子卡。SPA 空壳 `index.html` 不算静态快照。
- 没有授权图片时用无图/CSS 示意版，不冒充实拍。`resources/` 是研究资料，不是运行时自动加载的 Skill。

## 验收

一个功能算完成：

1. 相关测试 + `npm run typecheck` + `npm test` + `npm run build` 通过；
2. UI/预览改动在 Chrome 里打开看过（1440 / 768 / 375），截图放 gitignore 的 `artifacts/`。发布页用 `node scripts/check-published.mjs --out artifacts/published-check/<标签>`（需 3034 端口的 dev server）检查访客页规则并截图；新增访客页规则（包括英文开关）时把断言加进这个脚本。截图前确认预览已就绪、整页高度已稳定，每张都打开看过；载入态、空白或截断的截图不算证据；
3. 页面质量由独立审核 agent 盲评判定，审核者不能是做这项工作的 agent；负责人不做盲评和审核。做工作的 agent 自查能找问题，不能宣布审美通过；
4. 没实测过的外部依赖，在汇报里用一句话说明没测，不写成已完成，也不因此阻塞其他工作；
5. 对应票的验收勾选项都有证据，票已关闭；`project_map.py status` 里没有过时的 living doc。

不需要：实机证据、公网证据、每次探针的 JSON 归档、独立的「证据记录」提交、对同一候选反复审查。

## 文档

- 决定和待办只放在 `.project-map/`：决定写在决定票里，工作写成 build 票，下一步做什么由脚本算出来。不另写计划文件，不追加逐轮日志，不叠加「更正」段落；`MAP.md` 不超过 150 行。
- MAP 里登记的 living docs 只写当前真相：代码改了就同步，被取代的内容直接删掉。
- 需求或方向变化要开决定票，经负责人确认后写进 `intent.md` / `mainline.md`；不另建第二套规格。新定下的术语写进 `CONTEXT.md`。
- 中文内容保持 UTF-8，窄改优先，不做无关格式化或标点归一化。

## Git

- 以 fork `a1024053774/sitecraft-ai` 为主线（`origin`）；绝不推 `upstream`，不 force-push。
- 一个功能一个 commit，文档更新并入同一个 commit。只 add 本功能的显式路径，不 `git add -A` 混入用户工作。
- 推送后核对远端 SHA；推送失败保留本地 commit 并报告，不绕过认证。

## 密钥与环境

- 密钥只在 gitignore 的 `.env.local`，不进代码、文档、prompt、SSE、截图或提交。不建软链接，不复制 `env.md`。
- 模型：DeepSeek `deepseek-flash`（对话与看图同一条）。
- 开发机用 `SITE_STORE=fs` 即可；Docker（PostgreSQL/Mailpit）在外置硬盘，没插就跳过，不影响页面质量工作。

## 协作

分工（2026-09-26 负责人决定，见 `.project-map/tickets/T-013-roles-and-review.md`）：

- **负责人**：只定方向和需求，不做盲评和审核。
- **Claude（主负责人）**：所有视觉和界面工作（生成站 overlay、色板、工作台），整合、提交和推送。
- **Astra（Codex）**：不涉及界面的工程逻辑，例如需求对齐协议、生成与 operation、中英文生成、色板生成规则。功能需要界面配合时，只做让功能能用的最小界面，外观留给界面票。
- **两个 Grok 4.7 agent（Cursor）**：独立审核（盲评、代码审核、票的验收）和调研。审核者不能审自己参与过的工作。

规则：

- 多个代理不改同一文件，靠 `claimed_by` 避免撞票。委派时写清输入、可改范围、禁止范围和验收。
- 用 Goal/连续模式时，队列只能来自 frontier。需要负责人决定方向或需求时停下来等；盲评和审核交给审核 agent，不等负责人。队列做完就停，不自行把「本阶段不做」里的事或新方向加进队列。

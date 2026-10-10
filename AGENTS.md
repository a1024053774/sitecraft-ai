<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

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

2026-10-07 负责人决定换路线（T-127，取代 T-048 的拼页路线）。改动前须负责人重新确认：

- **模型直接写站点代码**：每页一份 HTML，加公共页头页脚和一份 CSS；版式、结构、文案由模型按资料和所选风格决定。引导靠 skill（核心规范每次加载 + 用户选的风格），不靠白名单 operation 和固定区块。流程固定、内容放开：读资料 → 页面大纲 → 写页面 → 检查修正 → 截图打磨 → 存版本。
- **所有修改走同一个提交入口**：生成、对话、批注、手改、恢复都经过它：清理（去掉脚本和外部资源）→ 底线检查 → 存成一个完整版本。撤销就是恢复到旧版本，恢复本身也是新版本；刷新从当前版本恢复。Skill、模型、测试夹具不得旁路写站点。
- **底线检查在提交入口做，不靠限制模型**：事实只能来自用户资料或「待补充」；不得有脚本、外部资源、未授权图片、空链接、客户 Logo 墙、假评价/数字；375 / 768 / 1440 不横向溢出、不重叠，正文对比度达标。不过就交回模型修（最多两轮），仍不过如实告诉用户，不静默放过、不静默回退。
- **功能部件由系统提供**：图片按编号引用、署名由系统汇总；询盘表单、图标由系统给。模型只负责摆放和样式。询盘表单、报价/样品入口、联系方式只在用户资料或要求里出现时才做，不默认加（T-141）。
- 页面规划：用户给什么资料就做什么网站——用户点名的页面 → 模型按资料能撑起的内容规划；不为凑结构硬套联系页、询盘或报价。资料少就做得少，用户补充后再继续丰富。做不到的页面要明确说明，不静默缩成首页（T-141）。
- 需求对齐：选项通过结构化请求保存，同一会话继续，刷新可恢复；不靠挂起的 HTTP 请求等用户。用户选的是风格（主风格单选 + 版式/密度两个滑杆 + 默认「帮我选」），不是内部 Skill 名。
- 英文版不和中文一起生成：用户对中文站满意后，再问是否生成英文版；英文版沿用同一结构，只翻译文字。
- 删除只由用户明确选择；系统不自动清理对话、版本、上传或站点，不做定时清理或清理开关。
- 前端改动遵循 `skills/frontend-less-ai-tone/`；它和 `skills/sitecraft-frontend-less-ai-tone/` 并入运行时核心规范。
- 不为未来功能预置平行 API、兼容层、空 schema 或推测性抽象。旧区块库、adapter、白名单 operation 和 vendor 已移除；运行时只有站点代码路线。T-145 的可信离线导入经同一提交入口清理、全部确定性检查后存首版，事实状态明确为旧站转换未做模型校对；不过只存可见失败元数据，不存版本。正式主数据写入和清理须主控核对精确路径，演示源 JSON、用户上传保护站和已有新路线数据保留。

## 素材与许可

- 代码 MIT/Apache 不代表图片、字体、图标、商标可用，须分别核验；普通客户交付许可不能推导为生成器再分发许可。
- 调研不等于准入：新模板/仓库须核来源、版本、许可和实际渲染效果后才作为运行素材使用。SPA 空壳 `index.html` 不算静态快照。
- 没有授权图片时用无图/CSS 示意版，不冒充实拍。`resources/` 是研究资料，不是运行时自动加载的 Skill。

## 验收

一个功能算完成：

1. 相关测试 + `npm run typecheck` + `npm test` + `npm run build` 通过；
2. UI/预览改动在 Chrome 里打开看过（1440 / 768 / 375），截图放 gitignore 的 `artifacts/`，每张都打开看过；载入态、空白或截断的截图不算证据。生成站的底线检查（结构、事实、外部资源、溢出、重叠、对比度、行长）由提交入口和评估集自动跑，验收引用它们本次的结果。发布与预览都读代码版本并用同一静态渲染器。
   正文行长与 T-147 的五项机械检查是版本检查和评估统计中的质量反馈，不拒收或触发修正轮；产品图反馈仅确认原图裁切，主体是否丢失须人工核对。
   浏览器测试先设 `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell`（负责人这台 Mac 的普通 Chrome 无头启动后会被自动更新带着退出）；换机器或版本更新后按实际路径改。
3. 页面质量由独立审核 agent 盲评判定，审核者不能是做这项工作的 agent；负责人不做盲评和审核。做工作的 agent 自查能找问题，不能宣布审美通过；
4. 没实测过的外部依赖，在汇报里用一句话说明没测，不写成已完成，也不因此阻塞其他工作；
   新路线评估命令为 `npm run eval:new-route`：把 `review/mixed/` 和 `review/company/` 分别交不同的新盲评实例，跨轮比较单独交 `comparison-review/`，各实例不得读取其他包；`private/` 的映射、来源、用量和跨轮身份由主控保管；技术运行通过不等于独立审美通过。
5. 对应票的验收勾选项都有证据，票已关闭；`project_map.py status` 里没有过时的 living doc。
6. 证据必须是本次改动之后重新跑出来的：Resolution 写明运行的命令、时间和对应提交，不能引用改动之前留下的产物。遇到失败时不能换一条路径绕过去（换一张内置卡片、跳过调用、用重试掩盖、把失败改成静默成功），要么在根因层修好，要么如实报 INCOMPLETE 并写清卡在哪里。（2026-09-27 起；同类问题已在 T-019 出现两次。）

不需要：实机证据、公网证据、每次探针的 JSON 归档、独立的「证据记录」提交、对同一候选反复审查。验收工具（截图、浏览器管理）本身的完善属于优先级 3：工具出问题时如实报告并开一张票，不顺着它连开多张基础设施票，不为它挡住页面质量工作；不做哈希、字节或像素比对，不复制源码 / 依赖 / 构建目录当证据（2026-10-07 负责人决定，见 T-120）。

## 文档

- 决定和待办只放在 `.project-map/`：决定写在决定票里，工作写成 build 票，下一步做什么由脚本算出来。不另写计划文件，不追加逐轮日志，不叠加「更正」段落；`MAP.md` 不超过 150 行。
- MAP 里登记的 living docs 只写当前真相：代码改了就同步，被取代的内容直接删掉。
- 需求或方向变化要开决定票，经负责人确认后写进 `intent.md` / `mainline.md`；不另建第二套规格。新定下的术语写进 `CONTEXT.md`。
- 中文内容保持 UTF-8，窄改优先，不做无关格式化或标点归一化。

## Git

- 以 fork `a1024053774/sitecraft-ai` 为主线（`origin`）；绝不推 `upstream`，不 force-push。
- 一个功能一个 commit，文档更新并入同一个 commit。只 add 本功能的显式路径，不 `git add -A` 混入用户工作。
- 推送后核对远端 SHA；推送失败保留本地 commit 并报告，不绕过认证。
- 不用的工作树和缓存及时清理（2026-10-10 负责人要求）：票合并、判为不合并或关闭后，主控在收尾时删掉它的工作树（`git worktree remove`，不加 `--force`），并停掉它的 dev server。删除前先看工作树里的 `.sitecraft-data/` 和 `artifacts/`：未关闭的票还要用的证据，先移到主工作区 gitignore 的 `artifacts/<票号>/` 再删。未合并的分支保留，作为记录。缓存（`.next`、工作树里的 `node_modules`、测试临时目录）随工作树一起删掉；主工作区的 `.next` 超过 1GB 就删。主工作区的 `.sitecraft-data/` 是用户数据，按 T-003 只由用户决定是否删除。每次开工看一眼 `git worktree list`，发现无主的工作树就按上面的规则清理。

## 密钥与环境

- 密钥只在 gitignore 的 `.env.local`，不进代码、文档、prompt、SSE、截图或提交。不建软链接，不复制 `env.md`。
- 模型：DeepSeek `deepseek-flash`（对话与看图同一条）。
- 开发机用 `SITE_STORE=fs` 即可；Docker（PostgreSQL/Mailpit）在外置硬盘，没插就跳过，不影响页面质量工作。

## 协作

分工（2026-09-29 负责人决定，见 `.project-map/tickets/T-049-roles-2026-09-29.md`，取代 T-033）：

- **负责人**：只定方向和需求，不做盲评和审核。
- **Claude（本地桌面会话）**：规划、拆票、验收、整合与推送；可以用 Sonnet 5.5 子 agent 写代码。
- **Sonnet 5.5 子 agent**：Claude 派的小编码票。
- **Codex**：额度宽裕，执行都交给它（Herdr 里的 `codex-build`，需要时 Claude 再开 Codex 窗格）；执行和审查必须是不同的 Codex 实例。Kiro 2026-10-01 起不再使用。
- **Codex GPT-6（Astra）**：代码与逻辑审查。
- **Codex gpt-6.1-sol**：页面盲评。
- **Cursor Grok**：杂活，只改派给它的文件。
- **云端会话**：负责人开的 Claude 云端会话，在 `cloud/*` 分支上做票并推送，Claude 审后合并。

执行的 agent 每张票在本地提交、不推送；Claude 验收、Astra 审核通过后由 Claude 推送。审核者不能审自己参与过的工作。Herdr 工作区里的 Codex、Cursor 由 Claude 直接派活。

规则：

- 多个代理不改同一文件，靠 `claimed_by` 避免撞票。委派时写清输入、可改范围、禁止范围和验收。
- 用 Goal/连续模式时，队列只能来自 frontier。需要负责人决定方向或需求时停下来等；盲评和审核交给审核 agent，不等负责人。队列做完就停，不自行把「本阶段不做」里的事或新方向加进队列。

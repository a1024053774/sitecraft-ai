# SiteCraft AI 执行计划

状态：v0.13 草案（2026-09-23），**待负责人确认**。需求以 [intent.md](./intent.md) 为准，主线以 [mainline.md](./mainline.md) 为准。v0.12 及之前的逐轮账、Jiro/开源素材配方表、P3–P5 证据、Docker/SMTP/DeepSeek/隧道探针记录已原文移到 [plan-history.md](./plan-history.md)，只供追溯。

## 要做成什么样

帮中小企业做出看起来像该行业自己建的网站：好看、不像套模板或套 AI 文案、事实不编造、改完能立刻在预览里看到。近期是**内部 Demo**，负责人扮演用户，资料用模拟工业/设备/外贸包。

判断一项工作值不值得做，只问一句：**它有没有让负责人看到的生成站更好看、更真、更好改？** 没有就不是当前工作。

## 现在到了哪里（2026-09-23）

能用的：

- 主链：资料/Prompt → 可选需求对齐（模型动态提问、点选、刷新可恢复）→ 方案确认 → `commitOperations` 写草稿 → 共享 `preview-bridge` 预览 → 对话修改/撤销 → 发布页同一草稿。
- 四个视觉族有 SiteCraft 自己的首页 overlay（`forge` 明亮产品、`screwfast` 工程工业、`landwind` 蓝白目录、`tailwind-landing` 灰底短路径），各 4 套命名色板，换色不动版式和内容。
- 工业 P3I 首页切片：无图/有图、长标题、两类产品、桌面/移动浏览器检查通过（代理自查 + Gemini/Antigravity 外部审计）。
- 询盘：落库 + 工作台收件箱；本地 Mailpit SMTP 可选转发。用户可见错误统一走 [error-catalog.md](./error-catalog.md)。
- `npm test` 198/198、`typecheck`、`build` 通过。

还不行的（按对成品的影响排序）：

1. **负责人还没重新盲评过**。2026-09-18 P4 盲评不过之后，所有“通过”都是代理或外部模型自评，没有负责人的眼睛。
2. **多页站的子页没有 overlay**。`lib/template-static.ts` 对所有 `index.html` 一律换成首页 overlay：`screwfast/products/`、`forge/About/` 这类子页会克隆首页，这和 Q18“不克隆首页”冲突；没被命中的快照页仍是 ScrewFast/Forge 演示壳。用户点名多页时这是否决项。
3. **`editorial-service`（深色产品 / `fresh`）仍挂在样子盘上，但没有 kit/overlay**。选它会落回原模板演示壳。
4. 其余 18 套模板只在目录里，不可生成。这是正常状态，不是缺陷。

## 下一步：系统功能收口（2026-09-23 负责人决定）

负责人盲评时遇到预览白屏，盲评先暂停，先把系统功能做稳。按顺序做：

### 1. 预览白屏和无限载入

已完成：真实浏览器回读确认当前 iframe 200、bridge 回执和 CSP/sandbox 均可用；根因是失败/未回执没有状态出口，另修正开发环境 `max-age=300` 缓存。
改动：所有 `OpenSourceTemplateFrame` 使用处现在有超时/加载失败中文提示、重试按钮和质量页状态回执；聚焦测试、桌面/375 宽浏览器检查通过。

### 2. `/quality` 生成失败（`POST /api/quality/cells` 422）

已完成：真实 POST 复测当前 DeepSeek 路径返回 200；按旧 422 的 `invalid_output / operations: Too big` 反例补上诊断码、中文映射和失败结果边界。
改动：失败格只加载 `result.ok` 的草稿，显示中文原因与“重试”，不再把旧预览当生成结果；200/200 全量测试、typecheck、build 通过。

### 3. 子页不再克隆首页

`lib/template-static.ts` 对任何 `index.html` 都换成首页 overlay，`screwfast/products/`、`forge/About/` 等子页因此是首页复制品；未命中的快照子页仍是模板演示壳。本轮做诚实降级：overlay 只作用于根 `index.html`；没有 SiteCraft overlay 的独立子页不再对外路由，`pagePlan` 改为同页区块或如实标 unsupported。补测试防回归。给子页做同族 overlay 留到下一轮。

### 4. 撤下没有 kit 的样子

`editorial-service`（深色产品 / `fresh`）没有 kit/overlay，选它会落回模板演示壳。先从用户可选的样子盘和需求对齐选项里撤下；`/quality` 专业服务包改用已有 kit 的视觉族。旧草稿里已存的 `editorial-service` 要能正常打开并提示换样子。

### 5. 发布页不对访客显示开发提示

`published-client.tsx` 在访客可见的发布页顶部显示「未支持：…」和 `pagePlanSourceLabel`。这些移到工作台，发布页只呈现站点本身。

### 之后

恢复负责人盲评（需要本机 DeepSeek 能连：在 VPN 客户端给 `api.deepseek.com` 加 DIRECT 规则，由负责人操作），再按盲评结果修页面；然后再议子页同族 overlay、`fresh` kit、对齐问题质量和更多视觉族准入。

## 本阶段不做

- 公网部署、临时公网隧道、iPhone/Android 实机测试。移动端用浏览器设备模式（375/768/1440）验收就够。
- 修本机网络：VPN、DNS、路由表、hosts、Docker Registry 超时。遇到了写一句需要负责人做什么，然后继续别的工作。
- 外部邮箱送达、生产 PostgreSQL 运维、完整 Docker 镜像重建。
- 真实客户试点、合并 PR #4、模型直接写 HTML/CSS、跨视觉族拼接区块、第二套渲染器、把未核许可的仓库推进 `vendor/`。
- 为了“证据完整”单独提交 `docs: record ...`。

## 怎么记进度

- 本文件只保留当前状态和下一步，每完成一项改 1–3 行，不追加逐轮日志。
- 截图、JSON 读数、探针输出放 gitignore 的 `artifacts/`，需要时在 commit message 里写路径。
- 被取代的内容删掉或移到 `plan-history.md`，不要在本文件里叠加“更正”。

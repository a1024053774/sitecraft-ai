# SiteCraft AI

内部技术 Demo：用标明为模拟的工业、设备、零部件、外贸 B2B 公司资料，生成**看起来像那家公司自己建的**网站，并能在对话里修改、在预览里看到。

- 工作台（`/workspace`）：资料或一句话需求 → 需求对齐 → 确认方案 → 生成 → 对话修改 / 撤销，预览随时可见。
- 新路线先提供精密工程和现场实拍两个风格。旧路线的四个视觉族仍由 SiteCraft 区块库（`lib/blocks/`）渲染。
- 发布页（`/published/<siteKey>`）与工作台预览用同一份草稿，访客可以提交询盘，询盘进入 `/leads` 收件箱。
- 新路线由 DeepSeek `deepseek-flash` 直接写每页 HTML、公共页头页脚和 CSS，经唯一提交入口检查后存完整版本；工作台支持对话修改、撤销和刷新恢复。旧的区块库/operation 路径仍在，待后续票删除。

项目方向、决定和待办见 [.project-map/MAP.md](./.project-map/MAP.md)，术语见 [CONTEXT.md](./CONTEXT.md)，协作规则见 [AGENTS.md](./AGENTS.md)。

## 本地运行

```bash
git clone --recurse-submodules https://github.com/a1024053774/sitecraft-ai.git
cd sitecraft-ai
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。查看生成站请用 Chrome：部分内置浏览器会拦截沙箱 iframe，预览会显示错误。

DeepSeek 配置写入 gitignore 的 `.env.local`：

```env
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_API_KEY=server-only-secret
DEEPSEEK_MODEL=deepseek-flash
```

开发时草稿存本地文件即可（不设 `SITE_STORE`，或设为 `fs`）。设 `SITE_STORE=postgres` 或生产构建时使用 PostgreSQL，需要 `DATABASE_URL`，参考 `.env.example`；`docker-compose.yml` 提供本地 PostgreSQL 和 Mailpit。把已有的文件草稿迁进数据库：

```bash
npm run migrate:drafts
```

## 检查

```bash
npm run typecheck
npm test
npm run build
```

`next-env.d.ts` 由 Next 的 dev、build 或 typegen 生成，不纳入 Git；首次只运行类型检查时，先执行 `npx next typegen`。

新路线评估集（四家模拟公司 × 两种风格，中文整站）在已配置 DeepSeek、`SITE_STORE=fs` 的本机服务上运行：

```bash
CHROME_PATH=/path/to/chrome-headless-shell SITECRAFT_BASE=http://127.0.0.1:3142 npm run eval:new-route
```

输出在 `artifacts/t130/round-<时间>/`：`command.sh` 是可重跑的命令，`private/` 保存底线检查、逐轮拒收率、耗时、用量和匿名映射，`review/mixed/` 与 `review/company/` 是两个互不引用的盲评包，分别交给不同的新评审实例；跨轮比较另在 `comparison-review/`，也单独评阅。每个包都有自己的提示词。不要把其他包、`private/` 或命令一起交给评审。默认和最近同资料轮次比较，亦可加 `-- --previous <上一轮目录>`。失败轮次保留；上游报错不重试，不用假模型替代。`-- --prepare-only` 只准备公开官网对照截图和提示词，不能用作生成验收。本地开发使用默认 Turbopack，例如 `npm run dev -- --hostname 127.0.0.1 --port 3142`。

旧路线的三个双语测试站点命令仍保留：

```bash
npm run test:three-sites
```

## 模板与素材

上游模板以 Git submodule 固定版本放在 `vendor/`，来源、许可和演示地址见 [OPEN_SOURCE_TEMPLATES.md](./OPEN_SOURCE_TEMPLATES.md)。代码许可不覆盖图片、字体、图标和商标，这些要逐项核验。本项目自身暂未声明开源许可证。

`deploy/` 里的 Kubernetes 清单是多实例部署示例；本阶段不做公网部署。

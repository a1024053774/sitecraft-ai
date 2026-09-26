# SiteCraft AI

内部技术 Demo：用标明为模拟的工业、设备、零部件、外贸 B2B 公司资料，生成**看起来像那家公司自己建的**网站，并能在对话里修改、在预览里看到。

- 工作台（`/workspace`）：资料或一句话需求 → 需求对齐 → 确认方案 → 生成 → 对话修改 / 撤销，预览随时可见。
- 四个视觉族（明亮产品、工程工业、蓝白目录、灰底短路径）各有 SiteCraft 自己写的首页 overlay 和色板，由同一个预览引擎渲染。
- 发布页（`/published/<siteKey>`）与工作台预览用同一份草稿，访客可以提交询盘，询盘进入 `/leads` 收件箱。
- 运行时模型是 DeepSeek `deepseek-flash`，只产出受控修改（白名单 operation），不写 HTML/CSS。

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

用真实 DeepSeek 生成并复核三个双语测试站点：

```bash
npm run test:three-sites
```

## 模板与素材

上游模板以 Git submodule 固定版本放在 `vendor/`，来源、许可和演示地址见 [OPEN_SOURCE_TEMPLATES.md](./OPEN_SOURCE_TEMPLATES.md)。代码许可不覆盖图片、字体、图标和商标，这些要逐项核验。本项目自身暂未声明开源许可证。

`deploy/` 里的 Kubernetes 清单是多实例部署示例；本阶段不做公网部署。

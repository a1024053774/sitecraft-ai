# SiteCraft AI

内部技术 Demo：用标明为模拟的工业、设备、零部件、外贸 B2B 公司资料，生成**看起来像那家公司自己建的**网站，并能在对话里修改、在预览里看到。

- 工作台（`/workspace`）：资料或一句话需求 → 需求对齐 → 确认方案 → 生成 → 对话修改 / 撤销，预览随时可见。
- 提供精密工程和现场实拍两个风格，默认可选「帮我选」。
- 发布页（`/published/<siteKey>`）与工作台预览渲染同一完整代码版本。用户明确要求的询盘表单由系统提供，留言进入 `/leads` 收件箱。
- DeepSeek `deepseek-flash` 直接写每页 HTML、公共页头页脚和 CSS，经唯一提交入口检查后存完整版本；工作台支持对话修改、撤销和刷新恢复。

项目方向、决定和待办见 [.project-map/MAP.md](./.project-map/MAP.md)，术语见 [CONTEXT.md](./CONTEXT.md)，协作规则见 [AGENTS.md](./AGENTS.md)。

## 本地运行

```bash
git clone https://github.com/a1024053774/sitecraft-ai.git
cd sitecraft-ai
npm ci
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。查看生成站请用 Chrome：部分内置浏览器会拦截沙箱 iframe，预览会显示错误。

DeepSeek 配置写入 gitignore 的 `.env.local`：

```env
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_API_KEY=server-only-secret
DEEPSEEK_MODEL=deepseek-flash
```

站点代码、版本和转换失败元数据存于 `.sitecraft-data/code-sites/`。开发机用 `SITE_STORE=fs`；会话、线索与批注仍支持 PostgreSQL，原生 PostgreSQL 站点版本存储不在当前交付范围。验证或离线导入进程可用 `SITECRAFT_DATA_ROOT` 指定数据根目录，默认 `.sitecraft-data`；HTTP 请求不能修改它。

显式新建入口为 `/workspace?new=1`，创建 API 只收 `name`。没有站点参数的工作台让用户选站点，不读取或新建共享的默认草稿。旧区块库、模板 API 和 vendor 已移除。

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

日常验证加 `-- --quick`：工业/精密工程、外贸/现场实拍、注塑/精密工程、纸包装/现场实拍四个组合，仅生成首页和产品页。整轮仍用于质量决策；快速档只和同档、同资料的轮次比较，不把页数变化带来的用量下降当作成对质量证据。可用 `node --experimental-strip-types scripts/analyze-code-usage.ts <轮次目录>` 只读拆分各阶段的输入、输出和已报告的推理用量，不调用模型。真实运行前先估算用量并取得主控放行。

输出在 `artifacts/t130/round-<时间>/`：`command.sh` 是可重跑的命令，`private/` 保存底线检查、逐轮拒收率、耗时、用量和匿名映射，`review/mixed/` 与 `review/company/` 是两个互不引用的盲评包，分别交给不同的新评审实例；跨轮比较另在 `comparison-review/`，也单独评阅。每个包都有自己的提示词。不要把其他包、`private/` 或命令一起交给评审。默认和最近同资料轮次比较，亦可加 `-- --previous <上一轮目录>`。失败轮次保留；上游报错不重试，不用假模型替代。`-- --prepare-only` 只准备公开官网对照截图和提示词，不能用作生成验收。本地开发使用默认 Turbopack，例如 `npm run dev -- --hostname 127.0.0.1 --port 3142`。

## 旧站导入与素材

批准的旧演示站通过离线导出的中文 home 进入第一个版本，保留原区块顺序；旧英文只归档。导入经 `commitSiteCode` 清理和全部确定性检查，作者显示「旧站转换」，事实状态显示「旧站转换未做模型校对」。检查失败只保存可见失败元数据，不存版本；已有记录不覆盖。

```bash
CHROME_PATH=/path/to/chrome-headless-shell SITE_STORE=fs SITECRAFT_BASE=http://127.0.0.1:3154 node --experimental-strip-types scripts/import-legacy-site-code.ts --input exported-candidates.json --out new-import-report.json
```

输入是已导出的候选数据，CLI 不读写旧 JSON，也不调用模型；批准范围与正式主数据写入/清理门见 [T-145](.project-map/tickets/T-145-remove-old-route.md)。系统不自动清理数据。含用户上传且未转换的旧站以明确状态保留。

图片、字体、图标、商标分别核验许可，无授权图片用无图版。模拟照片和系统图标的许可记录保留，代码许可不能替代素材许可。本项目自身暂未声明开源许可证。

`deploy/` 里的 Kubernetes 清单是多实例部署示例；本阶段不做公网部署。

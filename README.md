# SiteCraft AI

内部技术 Demo：用标明为模拟的工业、设备、零部件、外贸 B2B 公司资料，生成**看起来像那家公司自己建的**网站，并能在对话里修改、在预览里看到。

- 工作台（`/workspace`）：资料或一句话需求 → 需求对齐 → 确认方案 → 生成 → 对话修改 / 撤销，预览随时可见。
- 提供精密工程、现场实拍、品牌画册、邻里日常四个已验证风格与真实缩略图，默认「帮我选」按资料挑选。待验证候选仅在服务端评估进程准入，任务领取与提交的实际模型核对共用准入判定；无需模型的恢复、撤销和手改照常检查存版。
- 发布页（`/published/<siteKey>`）与工作台预览渲染同一完整代码版本；生成站只负责展示资料中的内容，不生成表单或提交入口。
- 工作台「下载网站」只读导出当前版本的静态 ZIP，解压后双击 `index.html` 浏览；包含中英文页面、实际引用素材和 `LICENSES.txt`，不打包资料、对话、批注或事实出处。
- DeepSeek `deepseek-flash` 直接写每页 HTML、公共页头页脚和 CSS，经唯一提交入口检查后存完整版本；工作台支持对话修改、撤销和刷新恢复。整站事实按带条件的核对段核查，资料与整组有序内容一致时沿用已完整通过的组；独立企业资料源或完整上下文变化都重新核对。恢复已核对版本且两份资料快照未变时沿用其事实结论，仍重跑确定性底线检查；资料变化或依据不明时重新核对。
- 中文预览可点选区块后写意见，或点更大胆、更克制、精简文字、换个版式。局部修改只改选中区块，资料保持原文，局部事实校对使用非思考模式；范围外改动（含旧 CSS 因区块 DOM 改动而影响外部）会被拒收；意见与结果可保存为批注线程。未点选的快捷按钮作用于当前页，提交入口保证其他页不变。精简文字保留事实与操作顺序，避免生硬缩句；未开点选时预览链接保留锚点与语言切换。
- 多条批注可从同一父版本冻结后按区块合组，一次生成一个完整版本；每条意见保留自己的元素提示和用户消息来源，补充事实核对通过后可引用原句；祖先/后代区块先确认同一范围，任一组失败不保存部分版本，结果分别回写到草稿。
- 中文版满意后主动点「生成英文版」，只翻译文字并沿用结构与 CSS。预览与版本历史可切中英文，英文发布路径为 `/published/<siteKey>/en`；中文修改后提示英文版落后，由用户选择重新翻译。
- 高风险声明的资料出处随版本保存，中文工作台的编号可悬停或点选查看来源类型和资料原句；上传资料保存来源标识、文件名和原文，对话按发送时文本与序号保存，要求中的事实按该条消息处理，系统提示、风格说明和模型输出不作出处。首条输入不按标签切分，每段事实核对显式返回 `noFacts` 或非空类别，引文只在独立用户原文集合内确定性验真。发布、独立预览与英文版不显示标记，旧站保留的资料原文可在首次需要时登记为「原始资料」后重新核对，只给新版本保存出处；旧版本缺来源原文仍显示「未提供可引用的原句」，不回写历史。空资料或原句缺失仍拒收。

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

站点代码、版本和转换失败元数据存于 `.sitecraft-data/code-sites/`。开发机用 `SITE_STORE=fs`；会话与批注仍支持 PostgreSQL，原生 PostgreSQL 站点版本存储不在当前交付范围。普通开发或离线导入可用 `SITECRAFT_DATA_ROOT` 指定数据根目录，默认 `.sitecraft-data`；测试存储须使用显式且经 health 核对的临时数据根或其子目录，否则在读写前拒绝。HTTP 请求不能修改数据根。

显式新建入口为 `/workspace?new=1`，创建 API 只收 `name`。没有站点参数的工作台让用户选站点，不读取或新建共享的默认草稿。旧区块库、模板 API 和 vendor 已移除。

## 检查

```bash
npm run typecheck
node --test --experimental-strip-types scripts/t167-runner-regressions.ts
CHROME_PATH=/path/to/chrome-headless-shell npm test
npm run build
```

`next-env.d.ts` 由 Next 的 dev、build 或 typegen 生成，不纳入 Git；首次只运行类型检查时，先执行 `npx next typegen`。

`npm test` 每轮创建独立的临时 `SITECRAFT_DATA_ROOT`，自启本工作树随机端口 dev server，把同一数据根与 `SITECRAFT_BASE` 传给测试进程，并在任何测试模块载入前核对 health、登记本轮存储许可。测试服务独用 `.next-test` 构建目录，可与同目录使用 `.next` 的普通 dev 服务共存，不改变普通服务的端口。它清除继承的 `NODE_TEST_CONTEXT`，按 Node 每文件统计记录实际执行数，零用例即失败；不沿用已有服务或数据根，不加载 `.env.local`，不配置真实模型。日志、身份、统计和数据根路径保存在 `artifacts/t167/test-run-*/`；其中 `checks/` 记录动态范围检查与 CDP 方法的起止、计数、分段耗时，不记录请求参数或页面正文。启动失败同时报告 Next 原因与日志路径，临时数据保留供核查。定向检查用 `npm test -- tests/<用例>.test.ts`；原始 `node --test` 没有已核对的数据根时，存储模块在读写前拒绝。上面的入口回归命令不开 Chrome，应与全量串行执行，其中普通 dev 共存用例自行启停自己的普通服务。

存储路径在各 store 保持可静态分析，`storageGuard` 只核验许可；测试身份的动态路径显式退出 Turbopack 部署追踪，避免未知目录被扩展追踪后撞上目录符号链接。构建回归使用实际项目的既有目录结构：`node --experimental-strip-types scripts/t167-build-trace-regression.ts --project <项目绝对路径>`；它运行 `SITE_STORE=fs npm run build`，在既有 `artifacts/` 结构下要求构建成功，不删除或移动该目录。

英文版的本地 HTTP 模型替身全链检查：`CHROME_PATH=/path/to/chrome-headless-shell node --experimental-strip-types scripts/check-english.mjs`。它独占 3161、使用独立的 artifacts 数据目录，运行后保留报告与截图，不调用真实模型。真实英文质量与独立审核的状态见 T-151。

新路线评估集（七家模拟公司 × 两种默认风格，中文整站；`--only` 可筛选已登记风格）在已配置 DeepSeek、`SITE_STORE=fs` 的本机服务上运行：

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

T-148 提供可选的系统抽象底图：`bd_` 编号只作背景，不能当产品或现场照片；提交入口核对登记、用途、加载与叠底对比度。72 张三档 WebP 与登记表已静态入库，预览和发布不加载 shader 库。`shaders@4.0.4` 只在 devDependencies，来源、参数、主控选用与排除理由见 [SOURCE.md](resources/shader-backdrops/SOURCE.md)。重新离线渲染用空闲的 3158 和一个新输出目录：

```bash
CHROME_PATH=/path/to/assigned/chrome-headless-shell node scripts/render-shader-backdrops.mjs artifacts/t148/new-render --install
```

仅主控已选定的配置可入库；脚本用硬件 WebGPU 定格导出，单张上限 200KB，失败不会换渲染路径，已有证据目录不会覆盖。`--install` 同时更新 `public/system-backdrops/` 静态素材和 `lib/code-site-backdrops.ts` 登记表。浏览器测试需指定 CHROME_PATH 与本工作区的 SITECRAFT_BASE，事实模型使用本地夹具的测试不代表真实模型能力。

`deploy/` 里的 Kubernetes 清单是多实例部署示例；本阶段不做公网部署。

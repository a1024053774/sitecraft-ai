---
id: T-073
title: 区块素材流水线 tracer：一个新布局从制作、AI 味审查到进库
type: build
status: open
blocked_by: [T-071]
claimed_by: sonnet-blocks
supersedes:
---

## What to build

先让**一个**新布局走完整条线，再批量做（T-074）。

布局：产品区块的「型号索引表」——一张表列出全部产品：名称、类别、2–3 项关键参数、询这款的入口。适合产品多的目录型公司（注塑资料有 5 个产品）。和现有「参数对比表」不同：对比表要 2–4 个产品共有 3 项参数，索引表不要求共有参数，每行取该产品自己的前几项有值参数。资料条件：至少 3 个产品。

流水线：

1. **制作**（sonnet-blocks，Sonnet 5.5，在 worktree / 分支 `blocks-pool` 上）：按 `lib/blocks/catalog.ts` 的约定写变体（槽位、markers、parts、`requires`）、`lib/blocks/fragments/` 里的 HTML/CSS（只用 `--site-*` token，不写死颜色和字体；不用图标、图片、外部资源）。结构可以参考 HyperUI / Meraki UI（MIT，T-051 记录的提交），按我们的类名和 token 手工重写，并在候选说明里写参考来源。遵循 `skills/frontend-less-ai-tone/` 和 `skills/sitecraft-frontend-less-ai-tone/`。
2. **候选渲染**：写一个可复用脚本 `artifacts/blocks-pool/render-block.mjs`，用 T-065 / T-066 的三家公司草稿（把需要的站点记录复制进 worktree 的数据目录），把候选布局挂上后截出**这个区块本身**的裁切图（1440 / 768 / 375 × 三家），再截同一区块默认布局的对照图和一张 1440 整页上下文图；同时跑横向溢出、文字重叠扫描。输出到 `artifacts/blocks-pool/<候选名>/`，附 `candidate.md`（读哪些字段、资料条件、参考来源、和已有布局的区别）。
3. **AI 味审查**（codex-taste，gpt-6.1-sol，只读候选目录）：先用两三句描述看到的结构（可核对），再按 T-071 的判断依据给 ACCEPT / REVISE / REJECT。REVISE 最多来回两轮；REJECT 的候选删掉代码、保留审查记录。
4. **进库**：ACCEPT 后在 `blocks-pool` 分支提交（测试先写：资料条件、槽位唯一命中、三档无溢出），跑 `npm run typecheck`、`npm test`、`npm run build`；Astra 代码审查通过后由 Claude 合回 `family-kit-assembly`，在主工作区跑三家的 `check-published`，并确认模型的布局清单里出现这个新布局、资料不够时会被拒绝。

## Acceptance

- [x] 「型号索引表」走完 1–4：候选目录、审查记录（含描述 + 结论）、提交、测试先失败的证据都在（见 Resolution）
- [x] 渲染脚本一条命令可重渲任意候选，裁切图逐张看过，没有载入态、空白、截断
- [ ] Astra 代码审查通过；合回主线后三家 `check-published` 中英文三档通过；Claude 验收
- [x] 流水线里卡住或返工的地方写进 Resolution，作为 T-074 批量做之前要改的地方

## Resolution

2026-10-02（纽约时间），sonnet-blocks。第 1–4 步做完，进库提交 `c248775`（分支 `blocks-pool`，本地，未推送、未合并）。**代码审查（Astra）、合回 `family-kit-assembly`、主工作区三家 `check-published`、Claude 验收没做，对应验收项留空。**

### 每一步的命令与证据（路径都在 `artifacts/blocks-pool/product-index-table/`，gitignore）
1. **制作**：新变体 `products:index`「型号索引表」，要至少 3 个可见产品；改动见提交 `c248775`。参考 HyperUI 的 table 列表结构思路（MIT），类名、token、响应式手写，没复制代码。
2. **候选渲染**：
   - 命令：`SITE_STORE=fs PORT=3035 npm run dev` 后 `CHROME_PATH=<chrome-headless-shell> SITECRAFT_BASE=http://127.0.0.1:3035 node scripts/render-block.mjs --block products --variant index --name product-index-table`（任意候选换 `--block/--variant/--name`；`--cases <json>` 换案例）。
   - 输出：`crops/`（7 案例 × 1440/768/375 × 候选/默认，共 42 张）、`context/`（1440 整页 7 张）、`scan.md`、`scan.json`、`candidate.md`。
   - 扫描（横向溢出、被裁文字、文字重叠）：21 行全部 0；候选裁切图每张逐张打开看过（两轮渲染都看了）。
3. **AI 味审查**（codex-taste）：`review-1.md` = REVISE（简介与规格重复；forge 样子无行边界），`review-2.md` = ACCEPT。返工：不显示简介（选 (a)，理由写在 `candidate.md`）、加 `--site-index-row` token。
4. **进库**：
   - 测试先写：`tests/block-product-index.test.ts`（7 个）+ `tests/ai-provider-layouts.test.ts` 一个提示词测试。
   - 先失败的证据：新测试拷到基于 `18a3538` 的临时 worktree（并在那个树上起 dev server :3036），7/7 失败，输出 `red-block-product-index.txt`；提示词测试在 `18a3538` 里没有那句话（`git show 18a3538:lib/ai-provider.ts | grep -c "目录型公司可以用 index"` = 0）。
   - 变异：条件改成 min 2、桥里把简介渲染出来并标成已应用，各被测试抓到（`red-mutants.txt`）。
   - `npm run typecheck`：通过。`npm run build`：通过（`build-pass.txt`）。
   - `npm test`（`SITECRAFT_BASE=http://127.0.0.1:3035`，带 CHROME_PATH）：559 个里 553 通过，6 个失败，**这 6 个在干净的 `18a3538` 上同样失败**（`npm-test-preexisting-failures.txt`），都是模板快照资源（`template-snapshot-assets`、`template-adapters`），与本改动无关；没有放宽检查、没有改超时。完整输出 `npm-test-full.txt`。
   - 文档：`CONTEXT.md`、`docs/project/mainline.md`、`docs/project/spec.md` 加入型号索引表，MAP 里这三份的 Verified 改为 `c248775`。

### 卡住或返工的地方（T-074 批量做之前要改）
- **worktree 的环境**：`node_modules` 软链指向主工作区会让 Turbopack 的 dev 和 build 都直接报 `Symlink [project]/node_modules is invalid`（`build-turbopack-symlink-failure.txt`）；用 `--webpack` 能跑 dev，但 `next build --webpack` 会在无关页面（leads/published/quality/预览 route）的生成类型上失败（`build-webpack-typegen-failure.txt`）。最后把软链换成 `cp -cR` 的 APFS 克隆（2 秒、不占额外空间）才让 `npm run build` 和 dev 都正常。**建议以后建 blocks-pool 类 worktree 时直接克隆 node_modules。**
- **`npm run typecheck` 会被 `next dev` 污染**：dev server 生成的 `.next/dev/types` 里 preview route 的 `prepareHtml` 导出让 `tsc` 报错；要在没有 dev server、删掉 `.next` 后跑 typecheck。`next dev` 还会改 `next-env.d.ts`，每次提交前要 `git checkout next-env.d.ts`。
- **渲染脚本在 gitignore 的 `artifacts/` 里**，合回主线时不会跟着走。T-074 要么挪到 `scripts/`，要么 `git add -f`；挪动前先让负责人定。（已在 T-074 开头挪到 `scripts/render-block.mjs`，随代码合并。）
- **浏览器测试的端口**：现有浏览器测试大多写死 `127.0.0.1:3034`（`short-path-variants-browser` 等），在 worktree 里要靠 `SITECRAFT_BASE` 才能指向自己的 dev server；新测试用共用的 `base`。建议 T-074 起新增测试都用它。
- **资料条件的设计**：只要求 ≥3 个产品，某产品参数不足 3 项时那行就是空格；工业、外贸两家真实草稿只有 2 个产品，所以这个布局对它们会被拒绝，验证它们的效果只能靠「借产品」的压力测试案例。批量做时每个新布局都要有「能看到它的真实资料」，否则审查看到的是借来的数据。
- **布局选用提示词和 `ai-provider.ts`**：只在「怎么选」那句话里加了一句（`ai-provider.ts` 两处小改），合并 T-070 时要留意这一行和 `requirementText` 的新分支。
- **简介不显示**的后果：该布局下改简介报「未命中」。批量做的新布局如果不显示某个字段，都要在 `candidate.md` 写明并有对应测试。
- **审查流程**：REVISE 一轮即过；审查人看的是 `crops/` 全部 42 张，所以每个候选要备齐候选/默认对照，脚本已自动出。

### Astra 代码审查：NO_GO（一条 P2）后的返工
- P2：bright（forge）样子没有有效的 `--site-index-top`（回落的 `--site-rule-strong` 在 bright 不存在，顶线声明无效）。修法：`lib/blocks/looks/bright.ts` 明确写 `--site-index-top: none`（forge 本来就是无线条的开放版式，外观不变；理由写在 `candidate.md`）；重渲 molding-forge 三档 `product-index-table-p2-forge/`，逐张看过。
- 新增测试（`tests/block-product-index.test.ts`）：①四个 block looks 生成的 `:root` 里，索引表 CSS 读的 `--site-index-top`、`--site-index-row`（含回落）都解析出值；先在 `c248775` 上失败（`red-p2-tokens.txt`，报 `industrial: var(--site-index-top, var(--site-rule-strong)) has no value`）。②Astra 建议的 `applySiteOperations` 级回归：工业/外贸 2 个产品选 index 被拒并带「型号索引表要至少 3 个产品；现在有 2 个」，注塑 5 个产品被记录；这条在 `c248775` 上本来就通过，是回归保护，不是红灯证据。
- 相关测试 124 个全过（`block-*`、`ai-provider-layouts`、`bright-*`、`template-preview-bridge`、`site-style-bridge`、`chat-route-block-layouts`，带 dev server），`npm run typecheck`（无 dev server、删 `.next` 后）通过。
- **给 T-074 的补充**：新布局读的每个 token（含回落）都要对四个 looks 解析出值，这条测试的解析器可复用；新布局的 CSS 里不要假设某个样子有 `--site-rule`/`--site-rule-strong`（bright 没有）。
- 合并后验证（713b5ee）：上面「简介不显示」的取舍违反访客页「资料事实必须能在页面上找到」，已在 T-074 的「合并后验证发现并修复的问题」里改为折叠展示（`98c15dc`），本票里「简介不显示」「summary 报未命中」的说法以那里为准。


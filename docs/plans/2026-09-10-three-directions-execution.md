# 三条新方向：可行方案与执行记录（2026-09-10）

> 负责人反馈的三个问题 + 两个方向，逐条落地。
> **状态标记**：✅ 已完成并验证 / ⏳ 未开始 / 🚫 明确不做

---

## 一、核心洞察：问题的根因是**范式**，不是三个独立缺陷

聊天记录里那句最准：「现在所有的编辑功能都是直接修改 html」。

现有范式是 **「HTML 先存在，契约后手工补」**：

```
开源模板 HTML  →  人读代码、写 200+ 行适配器、手打 data-sitecraft-slot  →  才能被 AI 编辑
```

**倒过来就通了**：

```
AI 生成 HTML  →  生成时**顺手写下** data-sitecraft-slot  →  立刻可编辑，零适配器
```

> 这一条决定了三条路线的可行性：方向 3 之所以能「沉淀成模板」而不是产出一堆一次性页面，
> 正是因为生成的 HTML 会自带槽位契约。

---

## 二、方向 1：图片/资源本地化 ✅ **已完成（2026-09-10）**

| 文件 | 改了什么 |
|---|---|
| `lib/template-asset-mirror.ts` | **重写**：前缀匹配 / 覆盖 `<img>/<source>/<video>` 的 `src`/`srcset`/`poster`/`data-background-image` / 剥离已镜像域名的 `preconnect` / **RSC payload 重写** / content-type 修对 |
| `lib/template-static.ts` | 导出 `contentTypeForPath` 复用 |
| `scripts/mirror-template-assets.mjs` | **新增**：扫描 → 下载 → 生成登记表；自动解析 7 处「目录名 ≠ catalog id」别名 |
| `vendor/template-assets/` | 新增 **25 个镜像文件**（16MB） |
| `tests/template-asset-mirror.test.ts` | **新增 10 条测试** |

**踩到的三个真坑（都修了）**：
1. **catalog id ≠ 目录名**：登记表用目录名 `astrowind`，运行时传 catalog id `lonestone`
   → **运行时静默不替换**（单元测试还通过）。共 7 处别名。
2. **RSC payload 漏网**：`<img>` 已本地化，但 RSC payload 里还是境外 URL
   → 客户端 hydration 会把境外图挂回 DOM。
3. **`preconnect` 残留**：国内会**挂起等待**，必须剥离。

**验收**：`npm test` 全绿；`coverage-scan` 22/22；逐模板预览境外依赖检查通过。

---

## 三、方向 2：粘贴文本 → AI 装配 ✅ **已完成（2026-09-10）**

### 3.1 改动

| 文件 | 改了什么 |
|---|---|
| `lib/site-store.ts` | `SiteRecord`/`SiteSnapshot` 加 `sourceMaterial`；`setSiteSourceMaterial()`；PG 加列迁移 |
| `lib/site-generator.ts` | `buildSourceMaterialBlock()`（8000 字预算 + 截断标注 + "不编造"约束）；`batchAHint`/`batchBHint` 加 `sourceMaterial` |
| `app/api/sites/[siteId]/generate/route.ts` | `extraContext` 上限 2000→20000；execute schema 新增 `sourceMaterial`；落库并传进生成 |
| `app/api/sites/[siteId]/draft/route.ts` | 新增 `PATCH` 更新素材——**不 bump revision** |
| `app/generate/page.tsx` | 粘贴框 2000→20000；execute 与补全请求体都带上素材 |
| `app/workspace/page.tsx` | 「素材」按钮 + 编辑弹窗（可回看/纠正 AI 依据的原文） |
| `lib/ai-provider.ts` | **对话路径也读素材**（此前只有初次生成读） |
| `tests/site-generator.test.ts` | 新增 4 条 |

### 3.2 ⚠️ 顺带抓到并修复的三个**事实比对缺陷**

这三个是「按素材写内容」跑通后才显形的——素材越真实，越暴露它们：

| 缺陷 | 症状 | 修复 |
|---|---|---|
| `checkDraftFacts` 用**原始** `claim.raw`（大写标签 "ISO 9001"）去比对参考，只归一化了参考文本 | 素材写 `iso9001`、草稿写 `ISO 9001` → 判「未确认事实」→ **发布门 422** | 两侧都归一化（去空白/大小写） |
| 数字类声明走**整句字符串包含** | 素材「服务**过** 120 家」vs 草稿「服务 120 家」→ 误报 | 按**数字**比对 + 整数字边界（`120` 不得命中 `1200`） |
| `YEARS_PATTERN` 是 `\d{1,3}` | `成立于2008年` 抽成 `008年`；`008` 在 `2008` 里**恰好包含**而"碰巧确认" | 放宽到 `\d{1,4}` |

**实测修复效果**（同一素材、同一草稿）：
```
修复前：unverifiedFacts=["ISO 9001","CE 认证","服务 120 家"]  score=70  publishable=false
修复后：unverifiedFacts=[]                                    score=100 publishable=true
```
> **这是方向 2 的立意被自己的质检器反噬**：用户越是用真实素材，越发不出去。
> 已补 5 条回归测试（含"放宽后仍不得漏报"的反向断言）。

### 3.3 断点取证（修复前的真实原因）

**断点 1**：`extraContext` **只随 `step:"analyze"` 发送**；`step:"execute"` 与补全请求体都不带它。
→ **粘贴的内容只影响「选哪个模板」，从不参与内容生成。**

**断点 2**：生成层 prompt 里没有原文。`buildEnhancedIntentPrompt` 只拼 5 个字段摘要。

---

## 四、方向 3：截图/网址 → 沉淀成新模板

### 4.1 阶段 A（运行时模板链路）✅ **已完成（2026-09-10）**

用现成的 `vendor/industry-templates/secttre/`（工业服务静态站，4.8MB）跑通全链路。

**改造的 5 处 + 2 处额外发现的**：

| # | 位置 | 改了什么 |
|---|---|---|
| 1 | `lib/template-runtime.ts` **新增** | 纯注册表 + 纯函数（**不碰 fs**，可进客户端 bundle） |
| 2 | `lib/template-runtime-loader.ts` **新增** | 唯一允许 import `node:fs` 的模板注册模块（仅服务端） |
| 3 | `lib/template-runtime-server.ts` **新增** | manifest + 忠实度门禁节注册展开 |
| 4 | `lib/site-model.ts` | `allTemplates()` 运行时入口 + `findTemplate()` 精确查找 + **装载钩子注入** |
| 5 | `lib/template-static.ts` | 静态根走统一的 `resolveWithinRepo`（含防穿越） |
| 6 | 四处白名单 | `preview/route.ts`、`site-store.ts`、`site-operations.ts`、`api/sites/route.ts` → 动态查询 |
| 7 | `instrumentation.ts` **新增** | 进程启动时装载（否则「首个请求打到哪个路由」决定注册表装没装） |
| 8 | `app/api/templates/runtime/route.ts` **新增** | 沉淀登记入口（POST 注册 / GET 诊断 / DELETE 测试清理） |
| 9 | `lib/template-slot-injection.ts` **新增** | 写入前的槽位补全 + 清点 |
| 10 | `scripts/precipitate-template.mjs` **新增** | 走**真实 HTTP** 的沉淀脚本 |

**阶段 A 踩到的三个真坑（都修了）**：

1. **`node:fs` 进客户端 bundle → 构建直接失败**
   `allTemplates()` 在 `site-model.ts`，而它在 client component 里。静态 import loader 会让
   Turbopack 报 `does not support external modules (request: node:fs)`。
   **也不能靠客户端 `require` 兜底**——打包器替换 `require`，运行期得到 `undefined`，
   被 try/catch 吞掉后表现为**服务器上也看不到沉淀模板**（静默失效）。
   → 改成**依赖倒置**：`site-model` 只持有函数引用，由 loader 在服务端加载时注入。

2. **loader 早退返回 `[]` → manifest 永远注册不上**
   `ensureRuntimeTemplateManifests()` 遍历的是 loader 的返回值，而「进程已扫过」时
   它返回空数组 → 循环体一次不执行。**模板能预览，但桥接脚本拿到空槽位表，
   所有字段都不可编辑**，且调用方从返回值看不出任何异常。

3. **模板白名单是模块级常量 → 沉淀模板在 execute 阶段被拒**
   `siteIntentSchema` 的 `recommendedTemplateId` refine 捕获了编译期的 22 个 id，
   报「模板不在白名单」——而同一模板刚在 analyze 阶段被推荐出来。
   试过但**不可行**的两条路（记下来免得重走）：
   - `z.lazy(() => ...)`：zod **记忆化** thunk 首次返回值，换白名单后仍按旧的判；
   - `[schema, def]` 三元组包装：zod 4 不再接受手工构造，`.safeParse` 直接不存在。
   → 最终方案：**refine 的闭包读活列表**（工厂参数支持数组或函数），schema 只构造一次。

**验收（真实 HTTP 往返）**：
```
1. GET  /api/templates/secttre/preview        → 404（注册前）
2. POST /api/templates/runtime                → 201，写入 21 个文件
3. GET  /api/templates/secttre/preview        → 200（95KB）
4. GET  /api/templates/secttre/assets/styles.css → 200 text/css
5. GET  /api/templates/secttre/assets/.../header.jpg → 200 image/jpeg
6. POST /api/sites {templateId:"secttre"}     → 201（白名单通过）
7. POST /api/sites/:id/generate (execute)     → appliedTemplateId="secttre"，内容生成
8. POST /api/sites/:id/publish                → published，release.templateId="secttre"
9. GET  /templates/secttre/preview            → 200
启动日志：[sitecraft] 已装载 1 个运行时模板：secttre
```

**阶段 A 的如实结论**：secttre 是**手工写的中文静态站**，只带一个 `hero.title` 槽位。
本模块**刻意不做结构推断**（猜错容器会让整块内容的编辑与覆盖统计落在错误节点上），
所以它「能预览、能建站、能发布，但只有首屏可编辑」。
→ **阶段 B 的产出必须是自带 `data-sitecraft-slot` 的 HTML**，这是硬要求，不是加分项。

### 4.2 阶段 B（截图/网址 → 模板）

> **正式设计见 [2026-09-10-screenshot-to-template-design.md](./2026-09-10-screenshot-to-template-design.md)**
>
> 本节原先只有一行标题，**不是方案**。2026-09-10 用风机截图手工做模板后，
> 把实测踩到的问题固化成设计输入，另起一份文档展开。

**B1 手工样本 ✅ 已完成（2026-09-10）**：人工做 `vendor/industry-templates/fengji/`，跑通全链路。
**它的价值不是"做出了一个模板",是"用真实素材验证了整套契约哪里不成立"**——实测暴露三个阻断缺陷：

| # | 缺陷 | 后果 |
|---|---|---|
| A1 | 模板自带的静态内容被系统整块隐藏 | 无商品 → `#products` 被 `display:none`，**按截图做的 8 个产品卡一起消失** |
| A2 | AI 越界改不存在的卡 | `features item 4 does not exist`，3 次失败 1 次 |
| A3 | `about.body` 硬卡 40 字 | 截图那段企业简介 60+ 字**根本写不进去** |

**B1.5 建约束 ⏳ 前置**：设计系统 + 槽位规范成文 + 静态区协议（**三样全无，需新建**）。
**B2 自助可用 ⏳ 下一步**：上传截图 → 输入把关 → 模型按规范产出 → 门禁自动判 → 重试 → 降级入库 + 告知。
**B3 提质 ⏳**。

**已定决策（全 12 条见设计文档 §三）**：
HTML 由**模型产出**／装不下的走**模板静态区**／图片**三级来源**（原图 → 从截图提取 → 占位）／
入库由**规则门禁自动判**／面向**客户自助上传**／**大致像就行**／多张**合成单页**／重试仍不合格**降级入库**／
**不沉淀全局模板库**／中途离开**当暂停**／未完成 **48 小时清理**／生成后截图**保留**。

> **原写"人审一道"已作废**——与决策「降级入库」冲突，人工审不在流程内。

### 4.3 阶段 C（沉淀模板入库质量门）✅ **已完成（2026-09-10）**

**为什么必须有**：模板库是**全局复用**的——一个进库的模板会被以后每个用它建站的客户引用。
阶段 B 的产物是 AI 生成的 HTML，未经验证就入库 = 把不可控产物变成系统基础设施，
而回滚一个已被 N 个站点引用的模板，成本远高于入库时拦住它。

**新增**：`lib/template-quality-gate.ts`（纯函数）+ 接进 `POST /api/templates/runtime`
（**在任何写盘之前**判——先写盘再判会留下"磁盘上有、注册表里没有"的目录，最难排查）。

**门禁查什么（如实划界）**：

| 维度 | 静态门（本次新增） | 需浏览器（coverage-scan） |
|---|---|---|
| 槽位是否声明 | ✅ | ✅ |
| L2 残留（lorem/作者名/英文看板） | ✅ | ✅ |
| 资产问题（境外图/无关主视觉） | ✅ 警告不阻断 | ✅ |
| L3 结构（原生 vs 兜底） | ❌ **不适用** | ✅ |
| 注入后槽位是否真可见 | ❌ | ✅ |

> **L3 对沉淀模板不适用**：L3 判的是"该用模板原生排版却走了通用兜底"，
> 而运行时模板**本来就没有原生排版**（全部由通用引擎渲染）。套上 L3，
> 每个沉淀模板都会"违规"，门就失去意义。
> **所以静态门是必要条件、不是充分条件；浏览器基线仍是终审。**

**门槛**（`REQUIRED_SLOT_RULES`，刻意只列两条）：
1. `hero.title` —— 没有首屏标题，站点连"是什么"都说不清；
2. **至少一个集合槽**（features/services/products 任一）—— 没有它，AI 没有任何可批量填充
   的内容位，**那是一个静态页、不是模板**（正是阶段 A 用 secttre 实测到的状态）。

刻意**不要求** about/contact/products 齐全：很多真实模板本就没有产品目录（律所、政府站）。

**`skipQualityGate` 不是后门**：跳过的模板在 manifest 里标 `recommendation: "isolated"`，
**排除在 AI 推荐之外**——能建站、能被显式选用，但不会被自动推给用户。
"我知道它有毛病先放着"与"它跟验证过的一样好"必须是两回事。

**实测（真实 HTTP）**：
```
POST 合格模板 jinggong（13 个槽位）      → 201，manifestRegistered:true
POST secttre 原样（只有 hero.title）     → 422 quality_gate_failed
     blockers: ["缺少必需槽位：features.items 或 services.items 或 products 之一。
                 该模板入库后 AI 无内容可填、用户无法就地编辑。"]
```

### 4.3.1 阶段 C 连带修掉的 5 个真 bug（都靠真实往返暴露）

| # | bug | 症状 |
|---|---|---|
| 1 | **`node:fs` 泄漏进客户端构建** | 补 cargo-cult 式 import 时踩到，Turbopack 直接构建失败 |
| 2 | **loader 早退返回空数组** | 进程已扫过时 manifest 永不注册，模板能预览但**所有字段不可编辑** |
| 3 | **Windows 路径分隔符** | `path.join` 返回反斜杠，前缀比对恒 false → **注册成功却列不出来**（静默） |
| 4 | **运行时模板槽位全标必填 + 缺解析器** | 少一个板块小标题就卡发布；且覆盖统计认不得新槽位 → **内容填了却判"缺失"**（34 分） |
| 5 | **`instrumentation.ts` 被编译进 Edge 运行时** | Edge 没有 `node:fs`，构建报「A Node.js API is used…not supported in the Edge Runtime」。**光把 import 写成动态的不够**——不判 `NEXT_RUNTIME` 就仍会被无条件求值 |

**第 4 个修完后的效果**：同一素材同一模板，质检 **34 分 → 82 分**，缺失槽位 **4 个 → 0 个**。

### 4.3.2 顺带修掉一个既有的可靠性缺陷

`hero.title` 是**所有模板都标必填**的槽位，但它由"批 A"顺带产出，而**模型偶尔漏写**。
实测同一输入两次调用：一次写了、一次没写。漏写时站点会**继续显示模板自带的演示标题**
（实测残留 "为下一代标准而造。"），且发布被拦——**"站点能不能发布"取决于一次模型的临时发挥**。

**修法**：`ensureHeroTitle` 确定性兜底——模型没写时用**企业名**（必然存在）补上。
只在完全没写时补，不覆盖模型产出。补了两个测试（漏写时补齐 / 写了时不重复下发）。

> 为什么不用 summary 兜底：首屏标题的版式约束是"≤15 汉字、一句话主张"，
> 而 summary 是 400 字上限的段落，塞进 h1 会溢出并被判超长。

`coverage-scan` 22/22 仍可作新模板入库前的**终审**基线。

---

## 五、收尾项 ✅ **已完成（2026-09-10）**

| 项 | 状态 |
|---|---|
| 对话路径也读站点素材 | ✅ `ai-provider.ts` + `chat/route.ts` |
| 「产品板块已隐藏」可见提示 + 一键开回 | ✅ `app/workspace/page.tsx` |
| `required` 由模板显式声明（`optionalTargets`） | ✅ 缺省仍全必填，22 基线零回归 |

> **关于「正道」的如实说明**：`optionalTargets` 给了**声明能力**，但 22 个基线模板
> **一个都没用**——因为「这些模板本身就不需要产品节」是**站点级**事实
> （同一模板既服务制造厂也服务律所），不是**模板级**事实。
> 做成站点级需要「允许 `set_section_visibility` 提前到初次生成之前」这类设计，
> 改动面大。当前用「自动隐藏 + 提示 + 一键开回」承载，已可用。

---

## 六、执行顺序与状态

| 序 | 做什么 | 状态 |
|---|---|---|
| 0 | 修商品为空的回归 | ✅ |
| 1 | 方向 1 图片本地化 | ✅ |
| 2 | 方向 2 粘贴文本 → 生成 | ✅ |
| 3 | **方向 3 阶段 A**（运行时模板链路） | ✅ |
| 3.5 | **A1/A2/A3 三个阻断缺陷**（设计文档 §2.1） | ⏳ **下一步** |
| 3.6 | **B1.5 建三样约束**（设计系统 / 槽位规范成文 / 静态区协议，**均需新建**） | ⏳ |
| 4 | 方向 2 第 2 步（草稿模型表达能力：规格表/资质） | ⏳ |
| 5 | 方向 3 阶段 B（截图/网址 → 模板） | 🟡 B1 手工样本完成；**B2 自助可用待做** |
| 6 | 方向 1 的 P4 行业模板接入 | ⏳ 等素材 |

**用户 2026-09-10 新增决策**（已并入设计文档 §三）：
截图转模板面向**客户自助上传** · 还原度**大致像即可** · 多张截图**合成一个单页** · 重试仍不合格**降级入库并告知**。

**实测确认**：项目配置的 AI（`deepseek-v4-flash`）**能读图**，一张截图 847 tokens —— 整条路可行。

**2026-09-10 补充实测（改写了生成侧设计）**：
- 🔴 **必须关推理**（`reasoning_effort:"none"`）：开→16000 tokens 打满、代码截断、**槽位 0 个**；关→**9.2 秒、2942 tokens、完整、槽位 23 个**
- ✅ **自检循环有效**：3.2 秒 / 315 tokens，列出 8 条差异且**人工核对准确**
- ✅ **能从截图抠图**：模型给坐标 + 缩放换算（系数 1.8）+ `sharp` 裁剪，**实测抠出照片**
- 💰 **成本重算**：≈**2 分钱/轮**（原估 5 分~2 毛作废）
- 已落地：`lib/ai-provider.ts` 的 `shouldDisableReasoning()`（按调用点 + 环境变量覆盖），3 条测试
- 详见 `docs/plans/2026-09-10-verification-live.md`

---

## 七、验证口径（最终）

| 层 | 命令 | 结果 |
|---|---|---|
| 机械 | `npx tsc --noEmit` | ✅ 0 错误 |
| 单元 | `npm test` | ✅ **497 / 497** |
| 构建 | `npm run build` | ✅ Compiled successfully，**0 警告** |
| 忠实度 | `coverage-scan`（22 模板） | ✅ **22 / 22** |
| 入库门禁 | 合格模板放行 / 不合格模板 422 | ✅ 实测双向 |
| 运行时模板 | 见 §4.1 的 9 步真实 HTTP 往返 | ✅ 全通 |
| 素材链路 | 端到端（PATCH → 持久化 → 生成引用） | ✅ |
| 事实比对 | 5 条回归（含反向断言） | ✅ |

---

## 八、遗留与风险（如实记录）

1. **阶段 A 的模板只有 `hero.title` 可编辑**——这是设计内的结果，不是 bug；
   价值在框架，价值兑现要等阶段 B 产出带槽位的 HTML。
2. **运行时模板只在「有磁盘的那个进程」可见**——多实例部署需文件共享卷。
   `GET /api/templates/runtime` 已提供诊断（`registered` / `errors` / `templates`）。
3. ~~沉淀模板未过门禁~~ ✅ **已补（阶段 C）**：静态门已在入库前生效；浏览器基线（`coverage-scan`）仍是终审，建议阶段 B 产出第一批模板时一并跑。
4. **开发态新增模板需重启**——loader 进程内只扫一次（与 Next.js 对 `.next/` 的处理一致）。
5. **`published` 页首次点击偶发 404**（`publish-rollback.spec.ts:162`）——已定位为原生联系
   路径的占位符擦除问题，与本轮改动无关，未修。
6. 🔴 **已发布站的正文不在 HTML 里（SEO 缺陷，2026-09-10 核实，未修）**
   `/published/<siteKey>` 返回的是**含 iframe 的空壳**，正文由客户端脚本 `postMessage` 注入。
   后果：**爬虫抓不到内容、分享无预览、禁 JS 即白页**。
   唯一逃逸口是导出下载（`/export/<siteId>` 走"克隆渲染后 DOM"）——**线下托管正常，我们托管的不正常**。
   **这条独立于多页，且严重度高于多页**，但用户 2026-09-10 决定先做截图转模板，故暂挂。
7. **多页方向结论（2026-09-10）**：不做。做法定为**模板可选属性**——模板声明 `pages` 才是多页，
   其余模板零改动。已确认 7 处硬障碍（发布子路由 / 覆盖统计 / 发布门禁 / 入库门禁 / 草稿无页维度 /
   预览无页概念 / 约 20 个适配器的锚点导航），但**不在本轮范围**。

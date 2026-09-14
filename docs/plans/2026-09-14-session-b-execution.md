# 体验反馈批（T-21~T-27）执行计划 · 会话 B

> **门禁纪律**：你要求「任何代码编辑前必须已获准的计划」。当前处于计划模式，
> 本文件是**唯一**被允许写入的文件。你批准本计划前，我不会动任何产品代码。
> 批准后我会把本文件复制到项目内 `docs/plans/`（符合全局规范：
> 计划一律放项目内，不留在 `~/.claude/plans/`）。

---

## Context · 为什么做这件事

用户在一句话建站 + 模板库 + 工作台预览的真实使用中逐条反馈了 7 条问题
（T-21~T-27），已落成 [docs/plans/2026-09-14-ux-feedback-batch.md](d:/sitecraft-ai/docs/plans/2026-09-14-ux-feedback-batch.md)。
本会话负责其中的 **A 类调研（T-21/T-22）+ B 类实施（T-23）+ C 类小文案（T-24~T-27）**。

调研完成后有**两处计划前提被实测证伪**，必须记录在案，否则会照着错方向改代码：

| 计划原假设 | 实测结论 |
|---|---|
| T-21「注入把 hero 图位/产品图位用草稿空值覆写」 | **不成立**。`applyAssets` 空值是「跳过并还原」，从不写空值，且运行时模板不在资产登记表里 → 连碰都不碰（fail-closed） |
| T-23「改动收在 `client-preview-frame.tsx` + globals.css」 | **不成立**。`client-preview-frame.tsx` 只有 90 行且不含缩放/1440/居中逻辑；真正机制在别处 |

---

## 一、A 类调研结论（已完成，只读取证）

### T-21 真实归因：三条同族缺陷，都在 `prepareTemplate`，不在通用注入

**① forge 适配器把 CTA 带整段清空 → `CTAbg.jpg` 背景大图被抹**
[lib/template-adapters/forge.ts:128-135](d:/sitecraft-ai/lib/template-adapters/forge.ts#L128-L135)：
`cta.innerHTML = ''` + `cta.removeAttribute('class')`，把 `bg-[url('/CTAbg.jpg')]` 抹掉，换成深色渐变。
**这正是用户看到的「只剩渐变底、背景图消失」**。素材本身在位：
`vendor/open-source-templates/small-bis/public/CTAbg.jpg`（1.33MB）。

**② forge 只为 hero 段打 scope → 通用注入叠出重复板块**
[forge.ts:80-118](d:/sitecraft-ai/lib/template-adapters/forge.ts#L80-L118) 里，`main > section` 的第一段打
`data-sitecraft-hero-cta`，features/about 段打 `dataset.sitecraftScope`，但
`.h-96` 服务卡带（`servicesSection`）**只设 id，不打 scope**。
而 [bridge:923-927](d:/sitecraft-ai/lib/template-preview-bridge.ts#L923-L927) 的判断是
`!hasVisibleSlotPrefix('services.items')` —— forge 的服务卡打的是 `services.items.<key>.title`（**含 `items`**
前缀，[bridge:227](d:/sitecraft-ai/lib/template-preview-bridge.ts#L227)），
所以 `hasVisibleSlotPrefix('services.items')` **为真、不该重复**；但 `applyNativeServiceCards`
在 `items` 为空时提前 return（[forge.ts:207](d:/sitecraft-ai/lib/template-adapters/forge.ts#L207)），
`ul.hidden = true` 分支同理 → **draft 无数据时兜底区照样生成，原生 demo 段又不隐藏 → 板块塌陷/重复**。
同类路径：`about`/`features` 由 [bridge:913-922](d:/sitecraft-ai/lib/template-preview-bridge.ts#L913-L922) 生成。

**③ 产品图：空值不生成 `<img>`，且色块回退未实现**
[bridge:395-421](d:/sitecraft-ai/lib/template-preview-bridge.ts#L395-L421) 注释承诺「无图退回 imageColor 色块」，
但实现里**没有色块分支**；生成器侧 [template-composer.ts:476-481](d:/sitecraft-ai/lib/template-composer.ts#L476-L481)
**实现了**色块 → **同一句注释声称两边一致，实际只有生成器实现**。

**④ 二次落棒（登记层，本轮不修，登记）**
截图链路的 `initialDraft`（含 `products[].image = "assets/product-N.jpg"`，
[template-from-screenshot.ts:323-332](d:/sitecraft-ai/lib/template-from-screenshot.ts#L323-L332)）
只在**建站那一次**用掉（[from-screenshot/route.ts:190-212](d:/sitecraft-ai/app/api/templates/from-screenshot/route.ts#L190-L212)）；
`POST /api/templates/runtime` **不落任何「模板默认草稿」**
（[runtime/route.ts:32-78](d:/sitecraft-ai/app/api/templates/runtime/route.ts#L32-L78) 的 schema 无该字段）。
→ **从同一模板再次建站，产品图必然为空**；而 [sites/route.ts:25-31](d:/sitecraft-ai/app/api/sites/route.ts#L25-L31)
的 `initialDraft ?? defaultDraft` 兜底里 `defaultDraft.products` 是空数组。

**⑤ 轮播：注入层零代码**
`carousel` 全仓只命中**生成页的模板选择器 UI**（`app/generate/page.tsx`、`globals.css:994-1028`）。
模板内容注入不识别轮播。用户描述的「轮播指示器空转」**未能在代码层复现**。

**⑥ V1 机制核实（供红样本设计）**
[bridge:165-167](d:/sitecraft-ai/lib/template-preview-bridge.ts#L165-L167) `sectionScopes()` 含 `body > section`。
它在 `prepareTemplate()` **之后**执行（[bridge:762-768](d:/sitecraft-ai/lib/template-preview-bridge.ts#L762-L768)），
所以 forge 已把 CTA 改成 `#contact` 并打上 `data-sitecraft-scope="contact"`，
`scopeBy('contact', …)` 直接命中 → **contact 兜底区不会重复生成**。
→ **红样本的断言必须落在 ①（CTAbg 背景图）与 ③（产品卡 `<img>`）上，不能落在 contact 上。**

### T-22 真实归因：适配器 nav 兜底词与 contact 标题同为「联系我们」

- 展示文案来源：[lib/template-ui-copy.ts:33](d:/sitecraft-ai/lib/template-ui-copy.ts#L33) `contact: "联系我们"`；
  生成侧兜底同为「联系我们」[site-vision.ts:637](d:/sitecraft-ai/lib/site-vision.ts#L637)，
  且 [site-vision.ts:339-341](d:/sitecraft-ai/lib/site-vision.ts#L339-L341) 会把模型读出的概念标签**换回同一个「联系我们」**。
- forge 的 nav 兜底 [forge.ts:49](d:/sitecraft-ai/lib/template-adapters/forge.ts#L49)：
  `{ about:'关于我们', …, contact:'联系我们' }`。
- kindred/nextjs-landing 更直接：nav 第 5 项兜底「联系我们」**且**右上角 header 按钮硬编码
  `headerBtn.textContent = '联系我们'`（[kindred.ts:57,71](d:/sitecraft-ai/lib/template-adapters/kindred.ts#L57-L71)）→ **同一 header 内两个同名中文标签**。
- ⚠️ forge 的 `prepareFn` 会 `document.querySelectorAll('header button').forEach(b => b.remove())`
  （[forge.ts:76](d:/sitecraft-ai/lib/template-adapters/forge.ts#L76)）→ **forge 自身不产生重复**。
- 已确认：**两处中文「联系我们」都不可能来自静态 HTML**（全仓模板 HTML 搜不到该中文串，原生文案是 `Contact`）。

### T-24~T-27 落点（全部核实）

| 项 | 落点 | 现状原文 |
|---|---|---|
| T-24 | [workspace/page.tsx:1013-1015](d:/sitecraft-ai/app/workspace/page.tsx#L1013-L1015) | `setEditHint("站点素材已保存，下次生成会以它为准")` |
| T-25 弹窗 | [components/asset-replace-dialog.tsx:54-63](d:/sitecraft-ai/components/asset-replace-dialog.tsx#L54-L63) | 标题实为「替换**首屏主视觉**」（非「首屏大图」） |
| T-25 变体 | [vendor/…/odyssey/src/components/theme-switcher/theme-switcher.ts:12-38](d:/sitecraft-ai/vendor/open-source-templates/odyssey/src/components/theme-switcher/theme-switcher.ts#L12-L38) | Classic/Dark/Earth/Ocean/Sand 是 **vendor 自带 Lit 组件硬编码**，非项目配置；kindred 适配器**未移除**它（对照 atlas.ts:74/moon.ts:85 都移除了） |
| T-26 弹窗 | [components/product-import-dialog.tsx:61-65](d:/sitecraft-ai/components/product-import-dialog.tsx#L61-L65) | 列名权威源：无别名表，为 `||` 内联链 [site-model.ts:125-147](d:/sitecraft-ai/lib/site-model.ts#L125-L147) |
| T-27 行 | [components/product-import-dialog.tsx:74](d:/sitecraft-ai/components/product-import-dialog.tsx#L74) | 缩略图**已存在**（`<span>` + `backgroundImage`），「无即时回显」需先复现确认 |
| T-27 URL | [app/api/product-images/route.ts:38-43](d:/sitecraft-ai/app/api/product-images/route.ts#L38-L43) | 返回 `{ ok, url, optimized, savedBytes }` |

---

## 二、执行顺序（每步先红后绿，军规 2 / 附则 3）

### 第 0 步 · 并发与 git 纪律（每次提交前）
1. `git status --porcelain` —— 若工作区有**不属于本清单**的改动，**停止提交**，只做只读/准备，等另一会话落盘。
2. `git add` **显式列本步自己的文件**；**永不** `git add -A`。
3. `next-env.d.ts` 漂移**不入任何 commit**。
4. 跑 e2e 前先查 3210/3000 占用（`netstat -ano | grep -E "3210|3000"`）；被占就等，
   **绝不并发跑两组 e2e**（附则 A3 / T-20 同源）。

> **2026-09-14 用户裁决补充（两会话共享，A/B 同此判据）**——本条由一次真实阻塞换来
    
5. **跑 `tsc` / 全套 e2e 之前**，必须先 `git status` 确认工作区**只含自己的文件**。
   混入对方在制品时：**只跑单元级**（`npm test` 能跑就跑），**全套 e2e 等对方落盘**再跑。
   理由：对方的类型错误会让 `serve.mjs` 构建失败，于是"我的改动红了"这个结论**是假的**——
   被测对象根本不是我的代码。
6. **任何会话不得为"让验证跑起来"去动别人的在制品**——不修、不回滚、不打补丁、不
   `git stash`（stash 会连对方的改动一起动）。正确动作是**停报**，把冲突列清楚交用户裁决。
7. 并发期间各自**只 commit 自己的显式文件清单**；push 前同样比对，避免把对方半成品带上。

### 第 1 步 · T-21 红样本取证（本会话核心，附则 A4）
**改动**：新增 [e2e/specs/](d:/sitecraft-ai/e2e/specs/) 下一个 forge 结构回归 spec（暂名 `forge-asset-persist.spec.ts`），
断言全部落**结构锚点**，不落文案：

```
A. forge 模板预览下，body > section 的 computed background-image 含 CTAbg
B. 建站后工作台预览中，同一节点仍在且 background-image 未被抹掉
C. 产品卡数据源：构造带 image 的 draft 时，产品区存在 <img>；无 image 时存在色块回退节点
```

**负向验证（军规 2）**：先构造坏样本（删掉被保护的那棵子树 / 或把 `prepareTemplate`
的 `removeAttribute('class')` 对应效果注入），**必须拍红**；原文贴进 commit。
现状对 A/C 应**红**（这就是本次要修的缺陷）。

⚠️ 若红样本**拍不红**，说明我的归因有误 → **停下汇报**，不硬改。

### 第 2 步 · T-21 止血修复（A 类实施，按你拍板：先红样本，再谈修法）
先交第 1 步的红样本 + 定位报告；若你认可，再动：
- **修 ①**：forge.ts CTA 改建时**保留 `CTAbg.jpg` 背景**（改为在保留背景图的前提下套深色遮罩/渐变），而不是 `innerHTML=''` 后纯渐变；
- **修 ③**：bridge `renderAdditionalProducts` 补上注释承诺的 `imageColor` 色块回退（与 [template-composer.ts:476-481](d:/sitecraft-ai/lib/template-composer.ts#L476-L481) 对齐）；
- **修 ②**：给 `servicesSection` 打 `data-sitecraft-scope`，或让 `applyNativeServiceCards` 在 `items` 为空时也标记 scope，避免兜底区叠加。
- 每次 touch 后确认 [preview/route.ts](d:/sitecraft-ai/app/api/templates/[templateId]/preview/route.ts)、
  [workspace/page.tsx](d:/sitecraft-ai/app/workspace/page.tsx)、[generate/page.tsx](d:/sitecraft-ai/app/generate/page.tsx)
  的**行数未增长**（军规 5：巨型文件拒收新代码）。

### 第 3 步 · T-22 修复（按你拍板：改 navLabel 兜底）
让 nav 兜底词**不再等于** contact 标题，最小改动、不新增同步机制（守红线 b）：
- forge.ts:49 的 `contact: '联系我们'` → 改为不撞车的中性词（如「联系」），
  或让适配器从 `draft.navigation` 实际取值优先（现状 `navCopy[key]` 已是优先，兜底才撞）。
- 同步核查 [template-ui-copy.ts:33](d:/sitecraft-ai/lib/template-ui-copy.ts#L33) 与
  [kindred.ts:71](d:/sitecraft-ai/lib/template-adapters/kindred.ts#L71) / [nextjs-landing.ts:76](d:/sitecraft-ai/lib/template-adapters/nextjs-landing.ts#L76)
  的 header 按钮硬编码——**按你拍板的「改 navLabel 兜底」口径**，两处 header 按钮一并改为不与 nav 项同文案。
- 红样本：断言同一 header 内**不存在两个可见的同文案锚点**（结构锚点 + 计数，非文案匹配）。

### 第 4 步 · T-23 预览加宽（B 类，已拍板 1160px）
只动 [app/globals.css](d:/sitecraft-ai/app/globals.css)，**不碰 workspace/page.tsx 本体**：
- `:273` `.preview-stage` 去居中：`place-items: start center` → 顶部对齐 + 左右撑满，`padding: 37px 25px 55px` → 收窄左右 padding；
- `:283` `.browser-frame` `min(100%, 1000px)` → `min(100%, 1160px)`；`:284/:285` 平板/手机档**不动**；
- `:530`（@media max-width:760px）padding 同步微调。
**验收**：改前/改后**同一站点真机截图对比**贴汇报（不靠逻辑推断）。
**验证**：`npm run typecheck` + `npm test` + 预览相关 e2e 子集全绿才 commit。

### 第 5 步 · C 类（T-24~T-27）
- **T-24**：`page.tsx:1014` 提示追加「已保存，去补全/重生成板块即可生效」；
- **T-25**：`asset-replace-dialog.tsx:63` 追加一行「这里换的是首屏大图；产品图请通过『上传商品表格』上传」；
  变体按钮旁加「这几个切换的是配色风格，不是图片」——落在 kindred 预览内，需确认落点合规（vendor 组件不可改，走适配器注入说明元素）；
- **T-26**：`product-import-dialog.tsx` 上传区旁加「下载样例表格」。
  ⚠️ **军规 1 禁手抄**：样例 CSV 表头必须**从 [site-model.ts:125-147](d:/sitecraft-ai/lib/site-model.ts#L125-L147) 派生**，
  并**加一条断言**——样例表头每一列都能被 `importProductsFromRows` 识别（防列名漂移把样例变成坏样本）。
  根现有样品 [样品-商品表格.csv](d:/sitecraft-ai/样品-商品表格.csv) 表头为 `SKU,产品名称,英文名称,产品简介,英文简介,分类`（**缺图片列**）；
  需决定：直接复用此文件，还是内置一份含图片列的样例。
- **T-27**：先**复现**「无即时回显」再动手——代码里缩略图已接 `product.image`。
  若确为父级状态未回灌，**改 `workspace/page.tsx` 会踩军规 5**；届时按红线停报，只给方案不动手。
  一并加去向说明「主图显示在工作台预览『产品』板块的对应商品卡片上」。

### 第 6 步 · 收口
- 把 T-21~T-25 状态同步进 [docs/glossary.md](d:/sitecraft-ai/docs/glossary.md) 待办区；
- 登记未修项：模板默认草稿缺失（④）、轮播注入缺失（⑤）、T-25 变体按钮归属；
- 本文件复制进 `docs/plans/`。

---

## 三、边界与红线（与主会话一致）

**只许改**：`components/client-preview-frame.tsx`（如需要）、`app/globals.css`、
`components/product-import-dialog.tsx`、素材/资产弹窗相关组件（`asset-replace-dialog.tsx`、`site-material-dialog.tsx`）
及其对应测试、`lib/template-adapters/forge.ts`（T-21/T-22 修复）、新增 e2e spec。

**禁碰**（另一会话）：`lib/template-preview-bridge.ts`、反引号门禁（`tests/no-backtick-in-injection.test.ts`）、
`e2e/specs/hydration-snapshot.spec.ts`、`lib/template-preview-bridge.ts` 相关任何改动。

> ⚠️ **冲突预警**：第 2 步修 ③ 需要动 `lib/template-preview-bridge.ts`
> `renderAdditionalProducts`——**该文件在禁碰清单里**。故第 2 步我会**只做定位 + 红样本**，
> 把 bridge 的改动方案交主会话排期，不自行修改。

**停报红线**（触 a/b 即停，不硬冲）：
- a. 需要改状态 owner / 加同步机制 / 改条件渲染；
- b. 修完红了但**定位不了**。

---

## 四、验证方式（端到端）

1. `npm run typecheck`（`tsc --noEmit`）——**全绿不算证据**（军规 4），只作入场券；
2. `npm test`（`node --test tests/*.test.ts`）；
3. e2e：先查 3210 未占用，再 `node e2e/scripts/serve.mjs` 起服务（**禁手起 `next start`**），
   跑预览/forge 相关子集；确认本轮触发 `Creating an optimized production build`（附则 A3）；
4. 视觉验收：改前/改后**同一站点真机截图对比**（T-23）、forge 建站前后截图对比（T-21）。

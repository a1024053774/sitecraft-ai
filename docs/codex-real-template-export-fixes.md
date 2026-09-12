# Codex 任务：真实模板导出单文件的问题清单与修复

更新日期：2026-09-02
交接人：Claude（发现问题者）
背景：为老大制作"SMALL BIS 真实模板 + 恒固精工内容"的单文件演示页，过程中暴露多个产品层问题。

---

## 问题总览

| # | 问题 | 严重度 | 状态 |
|---|---|---|---|
| P1 | 真实模板单文件导出机制缺失（导出页用了换肤 SiteRenderer） | 高 | 已绕过实现（见下） |
| P2 | 中英混排：真实模板静态英文 + 注入中文内容并存 | 高 | 未解决 |
| P3 | 生成链路超时预算过紧（多语言/复杂整站） | 中 | 已放宽（90-120s） |
| P4 | chat 改稿对长指令/多板块 token 截断 | 中 | 小步绕过，未根治 |
| P5 | 英文输入 schema 校验过紧（industry 60/summary 200） | 中 | 已放宽 |
| P6 | bridge 内容注入不覆盖模板硬编码区（导航/表单标签/footer） | 中 | 未解决 |
| P7 | 真实模板与 SiteDraft 5 板块模型映射缺口（features/about 无对应 DOM） | 低 | 了解即可 |
| P8 | 换肤模板被当作成品交付（认知/流程错误） | 高 | 已记录，需流程固化 |

---

## P1：真实模板单文件导出机制缺失【高】

### 现象
`app/export/[siteId]/page.tsx` 用 **SiteRenderer**（统一 DOM + per-template CSS 的"换肤"渲染）导出 HTML。用户明确要求"真实模板，换肤不能出现"。SiteRenderer 不是真实模板外观——真实模板在 `vendor/open-source-templates/<id>/dist`（构建产物），经 `/api/templates/[id]/preview` 返回原始 HTML + bridge 注入脚本。

### 已做的绕过（scripts/export-real-forge.mjs，可复用）
抓 preview API 真实 HTML → 全量内联 CSS/JS/图片为 data URI/内嵌 → 导航去绝对化 → FAQ island 静态化替换 → footer 占位替换 → 注入草稿（页面内 window.postMessage 触发 bridge applyContent）。产物 21.5MB（工作图占大头）。

### 遗留问题（Codex 建议做）
1. 应做成**通用导出器**（非 forge 硬编码）：遍历任意 templateId + siteId。
2. 内联脚本的 Astro chunk 处理脆弱（依赖模板 dist 结构），建议读取 vendor dist 目录而非从 API 抓。
3. 图片体积：work*.jpg 每张 3-5MB，建议压缩（sharp 或挑选小图）或分片，微信可传目标 < 10MB。
4. `getTemplateStaticRoot`（lib/template-static.ts）已支持 dist/、根 index.html、`.next/server/app`、`.next/server/pages` 四路查找，导出器应复用此函数定位本地文件（避免每次 HTTP 抓）。

---

## P2：中英混排【高】

### 现象
真实 SMALL BIS 是**英文设计模板**（导航 Home/About/Services/Reviews/Contact/FAQ、表单标签、CTA banner 全英文）。注入的恒固精工草稿内容为**中文**（hero"精工制造，稳定交付"等）。bridge 只替换它能映射的文本槽位 → 页面英文导航 + 中文正文混杂。

### 根因
1. 站点草稿是中文（siteLanguage=zh），模板是英文设计——语言方向没对齐。
2. bridge 注入（preview route 的 bridgeScript）只处理可映射目标，不覆盖模板硬编码文本（导航、表单 label、footer）。

### 建议修复方向（需产品决策）
- **方向 A（推荐，英文站）**：给海外/外贸场景建英文站时，草稿全英文 + 导航已是模板英文 → 整体一致。模板英文设计天然契合。做法：恒固精工草稿补全英文内容，locale 用 en 导出。
- **方向 B（中文站）**：选中文模板（或把导航/表单 label 也在注入时替换为中文——需扩展 bridge 的 target 映射）。
- 产品层面建议：**模板语言与草稿语言自动对齐**（forge 等英文模板 + zh 草稿 → 提示或自动切 en，反之亦然），生成前校验一致性。

---

## P3：生成链路超时预算过紧【已放宽】

### 现象
- 42s 总截止下 forge 双语整站生成 3 次全超时；英文整站更甚（首次 71s）。
- 单次 DeepSeek 请求 45s 硬限多次截断。

### 已做的改动（代码已改，测试需回归）
| 位置 | 旧值 | 新值 |
|---|---|---|
| `lib/site-generator.ts` DEFAULT_TASK_TIMEOUT_MS | 25s | 45s |
| DEFAULT_RECOVERY_TIMEOUT_MS | 8s | 15s |
| DEFAULT_SELF_EVAL_TIMEOUT_MS | 6s | 10s |
| `generate/route.ts` EXECUTE_DEADLINE_MS | 42s→90s | 120s |
| ANALYZE_DEADLINE_MS | 42s | 60s |
| `lib/ai-provider.ts` 单次 fetch 硬限（3 处） | 45s | 90s |

### Codex 待办
- 跑全量测试（node --test），确认放宽后无超时相关测试失败（测试可能注入短超时，需确认覆盖）。
- 检查是否有测试断言旧值（如"25 秒内完成"类），同步更新。

---

## P4：chat 改稿长指令/多板块 token 截断【中，未根治】

### 现象
一次 chat 要求同时改 6 个板块 + 替换 4 产品 → `finish_reason=length` 输出截断（"DeepSeek 结构化输出达到 token 上限"）。小步（一次 1 板块/1 产品）则成功。

### 根因
`requestStructuredOperations`（lib/ai-provider.ts）单次输出预算不足（max_tokens 6000 被草稿上下文+大指令挤占）。

### 建议
1. 产品层：chat 指令过大时服务端自动**拆分子任务**（借鉴"小步生成"），或提示用户一次改一个板块。
2. 或提高 max_tokens / 精简 buildDraftIndex 的草稿摘要（当前把全草稿塞 prompt，英文草稿更大）。

---

## P5：英文输入 schema 校验过紧【已放宽】

### 现象
英文长输入触发：`industry ≤60 字符`、`summary ≤200 字符`、`companyName ≤40` 校验失败（英文信息密度低，同义更长）。

### 已改（lib/site-intent.ts）
- companyName 40→60，industry 60→120，summary 200→400。
- prompt 同步语言化引导："industry 中文 ≤60 字、英文 ≤110 字符；summary 中文 ≤200 字、英文 ≤380 字符"。

### Codex 待办
- 确认 golden-intent / site-intent 测试仍过（放宽不应破坏短字段测试）。

---

## P6：bridge 注入不覆盖模板硬编码【中，未解决】

### 现象
真实模板的导航项（Home/About/Services...）、表单 label（Name/Email...）、footer 版权（Company@email.com）、FAQ 默认问题（模板自带英文 FAQ）不在 SiteDraft 可编辑目标内 → 注入后仍是模板原样。

### 建议
- 扩展 `app/api/templates/[templateId]/preview/route.ts` 的 bridgeScript：把导航项/表单 label/footer 纳入可注入 slot（新增 draft 字段或约定文本映射）。
- 或导出器侧做文案替换（当前 export-real-forge.mjs 已对 FAQ/footer 做了字符串替换，作为兜底模式）。

---

## P7：真实模板与 SiteDraft 板块模型映射缺口【低，了解即可】

真实 SMALL BIS 首页无独立 features/about 板块（结构=hero/产品卡/CTA banner/FAQ/联系）。bridge 按 5 板块（hero/about/features/services/products/contact）找目标，找不到就静默跳过。不是 bug，是模板结构差异——映射失败应**可见提示**（当前静默），避免用户以为内容丢了。

---

## P8：换肤模板被当成品交付【流程问题，已记忆】

### 教训
`SiteRenderer`（皮肤）≠ 真实模板。任何"给用户/老大看模板效果"的产出必须用真实模板渲染（preview API / vendor dist / OpenSourceTemplateFrame）。已写入长期记忆，后续交付前先自检渲染源。

---

## 当前可复现的现场

- dev server：http://localhost:3000（.env.local 有真实 DeepSeek Key）
- 恒固精工站（forge/中文草稿）：site id `80009412-ffb5-4a38-8a8d-931070973bdf`
- 导出脚本：`scripts/export-real-forge.mjs`（forge 硬编码，可参数化）
- 当前单文件产物：`成品展示/恒固精工-SMALLBIS真实模板.html`（21.5MB，中英混排待修）

## 验证清单（Codex 修完要跑）

1. `npm test`（165 项基线）全过。
2. `npx tsc --noEmit` 通过。
3. 中英混排修复后：打开单文件 HTML，导航与正文语言一致（全 en 或全 zh），无混杂。
4. 导出器参数化后：forge 与另一模板（如 screwfast）都能产出单文件、零 console 错误、图片全加载。
5. 文件体积压缩到 < 10MB（微信可传）。

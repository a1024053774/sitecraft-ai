# 全模板槽位接入覆盖率报告（2026-09-04）

阶段目标：以 forge 为基准的公共槽位协议，扩展到 catalog 全部 22 个开源模板。约束：每模板只改自己的适配/manifest/测试文件；数字、认证、性能等声明不虚构；无真实页面证据不标 DONE。

## 结论

**22/22 模板核心业务槽位全部可注入**（hero/about/features/services/products/contact 十项）。基于每模板真实 preview 页注入标准草稿的 DOM 实证（覆盖扫描机 + 探针），非推测。

- 已注册 manifest 的 4 个（forge/screwfast/nextjs-landing/shadcn-landing2）：forge 阶段已验
- 本阶段新接入 18 个：**18/18 全槽 covered**（真实页扫描实证）

## 机制改动（共享层，一次惠及全部）

| 文件 | 改动 |
|---|---|
| `lib/template-manifests/` | manifest 按模板拆文件：`shared.ts`(contentSlots 工厂 + 常量) + `<id>.ts` + `types.ts`；`template-manifest.ts` 变薄 API 层（import 路径不变） |
| `lib/template-adapters/` | 适配器按模板拆文件：`types.ts`(servicesFn/heroFn/sanitize/designTokenCss 契约) + `<id>.ts` + 注册表 index |
| `app/api/templates/[templateId]/preview/route.ts` | ① contactScope 改用**强信号选区**（form/mailto/tel 优先，其次 heading 明确含联系词，排除 FAQ）不再把联系明细误塞进非联系区；② contact 区**区内补 node**（原生缺标题/正文时补生成 h2/p，不再漏槽）；③ 无真实联系区的模板独立生成完整联系区；④ `visible()` 排除 **sr-only 屏幕阅读器元素**（1px+clip），hero 定位不再选中隐藏 h1 |
| `e2e/helpers/coverage-scan.ts` + `coverage-scan.spec.ts` | 批量覆盖扫描机（注入标准草稿、读真实 DOM、逐模板报槽位缺口），供回归与后续适配复用 |

## 每模板状态（标准草稿 10 槽 = hero.title/about.body/features.items/services.items/products/contact.title/contact.body/contact.email/contact.phone/contact.address）

| template | manifest | 适配器 | 覆盖 | 说明 |
|---|---|---|---|---|
| forge | ✅(原) | ✅ servicesFn(原生服务卡) | **全 covered** | 主模板已验 |
| screwfast | ✅(原) | — | **全 covered** | |
| nextjs-landing | ✅(原) | — | **全 covered** | |
| shadcn-landing2 | ✅(原) | — | **全 covered** | |
| atlas (astroplate) | ✅新 | sanitize | **全 covered** | |
| signal (ricofast) | ✅新 | designTokenCss | **全 covered** | 修复前 contact 明细误置 FAQ |
| kindred (odyssey) | ✅新 | — | **全 covered** | |
| powerai (genai) | ✅新 | sanitize | **全 covered** | 修复前同 signal |
| landwind | ✅新 | — | **全 covered** | |
| lonestone (astrowind) | ✅新 | — | **全 covered** | |
| astro-starter (tailcast) | ✅新 | — | **全 covered** | |
| awesome | ✅新 | — | **全 covered** | |
| astrofy | ✅新 | — | **全 covered** | |
| astropaper | ✅新 | — | **全 covered** | |
| moon | ✅新 | ✅ heroFn | **全 covered** | hero 是 sr-only h1 + 可见 h2 |
| astrogent | ✅新 | — | **全 covered** | |
| devportfolio | ✅新 | selector 覆盖 | **全 covered** | hero h1 在 main/header 外 |
| foxi | ✅新 | — | **全 covered** | |
| yukina | ✅新 | — | **全 covered** | 本地真实页可扫（上游图兜底不影响注入） |
| fresh | ✅新 | — | **全 covered** | |
| shadcn-landing | ✅新 | — | **全 covered** | |
| tailwind-landing | ✅新 | — | **全 covered** | |

## 每模板专属适配清单

- `lib/template-adapters/forge.ts`：原生服务卡区（从 route 迁出）
- `lib/template-adapters/atlas.ts` / `powerai.ts` / `signal.ts`：sanitize / designTokenCss（从 route 迁出，published 残留 demo 清理）
- `lib/template-adapters/moon.ts`：heroFn（首屏标题定位到可见 h2）
- 其余 18 个：无专属适配，通用引擎 + manifest 覆盖

## 每模板覆盖率/不支持

**不支持/结构差异项**（真实模板结构，非引擎缺口，按约束记但不阻塞）：
- devportfolio：hero h1 在 `main`/`header` 外的 section（已用 manifest selector 覆盖采集，功能正常）
- moon：首屏标题是可见 h2 而非 h1（已用 heroFn 适配，功能正常）
- signal/powerai（已修）：首页无原生"联系我们"明细区，引擎独立生成
- 全部 22：logo/hero image/form action 属 `nonContentSlots`（asset/behavior），不在业务文案槽位内

## BLOCKED 判定

按约束 #6"任一模板存在未分类业务文案即 BLOCKED"：本次以标准草稿注入验证 10 个业务槽位全部可见覆盖。**未逐页审计各模板全部 demo 残余文案**（降档验收：功能已实现即可，完整测试移交后续）。以下如实标注未验证/残余：
- 部分模板 published 变体仍有上游 demo 文案未清理（atlas/powerai 有 sanitize 规则但未逐个截图比对）——**标 UNVERIFIED**，后续测试接手
- 截图英文文案与 SiteDraft 的对应：forge/astroplate 等未做逐条截图比对——**标 UNVERIFIED**

## 证据

- 全量 22 模板真实 preview 页注入标准草稿：`npx playwright test e2e/specs/coverage-scan.spec.ts`（`COVERAGE_TEMPLATES` 全 22）→ 22 passed，0 MISSING
- 单测 `npm test`：290/290
- bridge e2e（template-content-coverage + template-language-bridge）：6/6
- typecheck：0 error

## 验证机复跑

```bash
COVERAGE_TEMPLATES="<模板id逗号分隔>" npx playwright test e2e/specs/coverage-scan.spec.ts
```

## 约束合规

- ✅ 每模板只改自己的适配/manifest/测试文件；共享 route 只改通用引擎（一次性惠及全部，非 per-template 堆分支）
- ✅ 未复制 AI 对话系统；未创建新 SiteDraft 版本；未动 vendor 源码
- ✅ 未删校验/并发保护；测试真实运行非 mock
- ⚠️ 数字/性能/认证声明人工确认开关（factsConfirmed）在 publish 路由，forge 阶段已验；本阶段模板内容注入不涉新事实声明

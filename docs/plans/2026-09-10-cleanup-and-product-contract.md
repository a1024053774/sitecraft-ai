# 2026-09-10 · 清理、修复与产物契约

> 真相源。上一步：[2026-09-10-three-directions-execution.md](2026-09-10-three-directions-execution.md)

---

## Context

产品定位（2026-09-10 确认）：**自助 SaaS** —— 用户付费自己做网站，你不接触。
首批用户：制造业/外贸中小企业 + 国内小微。楔子：①中文业务→地道英文站 ②一句话到底。

**判断标准**：自助 SaaS 下，第一次生成是用户唯一的产品演示，撞见烂内容就关页走人。

本轮的起点是一次系统排查：性能 / 代码质量 / 架构可靠性三个维度 + 真机实测。
结论是**项目不缺点子，缺的是"什么进去了不被拦下来"**——508 个单元测试全绿，
却抓不到真机上的三个问题。

---

## 一、清理技术债（已完成）

| 项 | 数量 | 判据 |
|---|---|---|
| 一次性脚本 | **删 95**（118→23） | 未被 `package.json`/文档/代码引用 |
| 孤儿模块 | `lib/structure-check.ts` + 测试 | 唯一 import 它的是它自己的测试 |
| 死导出 | 8 个函数 | 生产零调用 |
| 根目录临时文件 | 11 个 | `HANDOFF-*.md` / `PR-*.md` / `日报-*.md` / `test-rec2.mjs` 等 |

**备份**：`D:\sitecraft-scripts-backup-20260910-173415.tar.gz`（这些脚本 git 未跟踪，删了只能从这里恢复）

---

## 二、修复主流程阻断 bug（已完成，真机验证）

### 症状（真机实测，非推测）

一句话建站的真实流程稳定失败，**用户界面直接显示**：

```
ⓘ features item 4 does not exist     ← 红色英文技术错误
```
66 秒生成全部丢弃，停在确认页。

### 根因

```
prompt 告诉 AI：features.items 约6条(至多12条)   ← 来自模板 manifest (forge.ts:36)
草稿里实际：    features.items 只有 3 条         ← defaultDraft (site-document.ts:217-221)
                ↓
AI 按容量提示写 update_card index 4 → 越界
                ↓
validateGenerationOperations 只拦 add_card，update_card 完全不校验
                ↓
穿透到 applySiteOperations:290 抛错 → 整份 commitOperations 回滚
```

### 修法

`lib/site-operations.ts` 的 `validateGenerationOperations` 增加 `update_card` 越界防护：
**拒绝单条、保留其余**，而不是让它在应用层炸掉整批。

`capacity.baseCounts` 本来就已经传入草稿真实条数，只是没被这一步用上（见 `site-generator.ts:400-403`）。

### 效果（修复后同样流程实测）

```
模型响应较慢，仍在生成；已完成的内容会保留。
初稿已保存，部分板块待补全（服务、产品、联系）
```

**从"整份失败"变成"部分成功"。**

### 顺带修复

`lib/generation-error-message.ts`：错误翻译层。`features item 4 does not exist`
现在译成「优势板块内容与模板不匹配（第 5 条超出模板可容纳的条数）。可重试生成，或直接进入工作台手动调整。」

**未知错误保留原文**——翻译层吞掉未知错误会让排查失去线索。

---

## 三、产物契约（已完成，这是本轮最有价值的产出）

### 为什么需要

真机观察到的三个失败，**508 个单元测试一个都抓不到**：

| 真机现象 | 测试为何抓不到 |
|---|---|
| 首屏大标题 = `待补充` | 测试自造这个输入断言"检测器能识别"，全绿 |
| about 正文 = defaultDraft 原文 | 测试断言的是函数，不是产物 |
| products 板块被静默隐藏 | 3/3 实测站点都这样，无任何测试覆盖 |

### 设计原则（关键）

**断言"不变量"，不断言"内容"。** AI 每次输出都不同，断言具体字符串必然变成随机红灯，
三天后会被 skip。契约断言描述的是**产品承诺**：

```js
hero.title  ∉ {待补充, 空, defaultDraft 值}
about.body  ≠ defaultDraft.about.body          // AI 没干活
中文站首屏   不含英文 demo 指纹
products     被隐藏 → 软警告（设计内行为，不拦）
```

**分级**：`hard` = 用户必看到（红，必须修）；`soft` = 记录不拦。

### 文件

- `e2e/helpers/draft-contract.ts` —— 复用 `isPlaceholderValue`、`defaultDraft`，不重复实现判断
- `tests/draft-contract.test.ts` —— 16 条单测，用例直接取自真机失败
- `e2e/specs/smoke-real.spec.ts` —— 真 DeepSeek 全流程接入契约断言

### 已用它在真实产物上复现全部 3 个 bug

```
五金件站   → ❌ about.body 仍是系统默认文案
注塑模具站 → ❌ 首屏是「待补充」+ CTA 也是「待补充」
两个站     → ⚠️ products 板块被隐藏
```

---

## 验证（真实输出）

```bash
npx tsc --noEmit          # 干净
npm test                  # 508 项全绿（原 497 + 契约 9 + 错误翻译 7 − 死代码 8）
npm run test:e2e:real     # 1 passed (1.3m)，契约断言实际执行
```

真 AI e2e 的输出：
```
⚠️ 本次生成走 partial 降级路径（按钮="进入工作台继续补全"）
⚠️ [hidden-declared-section:products] products 板块被隐藏——若本次生成未提供商品数据则属设计内行为
1 passed (1.3m)
```

---

## 踩坑记录（避免重复）

1. **`.generate-progress-view` 同时用于生成中态和完成态**（`page.tsx:1206` / `:1293`）——
   用它当"生成完成"信号会误判。正确做法：等**完成态独有**的元素（「进入工作台」按钮或 URL 变化）。
2. **不能用 `Promise.race([waitForURL, waitForSelector])`** —— 超时分支产生未捕获 rejection，
   直接判失败。用一次 `waitForFunction` 同时等两种情况。
3. **不要用 `.catch(() => false)` 包 `isVisible()`** —— 会吞掉 Playwright strict mode 违规，
   把"匹配到多个元素"伪装成"元素不存在"。

---

## 后续（未做，待决定）

- **CI / pre-commit 关卡**：快通道 = tsc + 单测 + 模板资源扫描 + 模板页结构；
  真 AI 契约走慢通道（发版前）。
  **调研结论：不要把真 LLM 放进 CI 做 pass/fail 门禁**——同配置两次运行约 9% 结果不同，
  落在波动区间的阈值等于抛硬币（First Mate Technologies 实测）。
  替代方案：录制真实响应，在 CI 里回放。`lib/generation-trace.ts` 已具备录制能力。
- **`checkStructure` 归属**：`lib/template-fidelity-guard.ts:192` 是"写好但没接进门禁"的
  三层检测器（publish route 注释自承），需决定接进去还是删除。
- **两个已确认的安全问题**（排查发现，未处理）：
  - 全站无鉴权：`lib/request-context.ts:60` 默认 relaxed，缺头即 `demo` + `editor`。
    实测 `curl http://localhost:3000/api/sites` 不带任何头可列出全部站点。
  - 上传接口无鉴权且允许 SVG：`app/api/product-images/route.ts`（同源存储型 XSS）。
- **建站功能完善 F1/F2/F3**：见 git 历史中的上一版计划。
  F1（不泄漏 demo）与 F2（商品图链路：新站无建商品入口的死循环）是必修，
  F3（追问时机）是设计权衡且必须在 F1 之后。

---

## 环境事实

- 22 个**模板 id**（≠ 源目录名）：forge/atlas/signal/kindred/powerai/landwind/lonestone/
  astro-starter/awesome/astrofy/astropaper/moon/astrogent/devportfolio/foxi/yukina/fresh/
  shadcn-landing/screwfast/tailwind-landing/nextjs-landing/shadcn-landing2
- id ↔ 源目录：`atlas`→astroplate、`kindred`→odyssey、`signal`→ricofast、`lonestone`→astrowind、
  `forge`→small-bis、`astro-starter`→tailcast、`powerai`→genai
  （用源目录名会 404，**这是正确行为**）
- **17 个模板有 products 槽，5 个没有**（tailwind-landing/shadcn-landing/nextjs-landing/moon/kindred）
  —— 但所有声明了的都是 `nativeFallbackHost: "generated"`，即**都不走原生卡片、一律由通用产品区承载**
- `vendor/` 是 22 个 git submodule（不是仓库膨胀）
- 必须用 `http://localhost:3000`；e2e 用 `127.0.0.1:3210`（`e2e/scripts/serve.mjs` 起）

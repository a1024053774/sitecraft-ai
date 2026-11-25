---
id: T-227
title: 第一阶段（1/2）：核心规范解耦、四风格配方重写、滑杆保真与候选风格登记
type: build
status: open
blocked_by: [T-226]
claimed_by:
supersedes:
---

## What to build

落实 [T-226](T-226-style-diversity-direction.md) 第一阶段的提示架构与风格系统改造（0 真实模型调用、不放宽任何底线检查或硬约束、不引入字体或新依赖）：

1. **核心规范与局部合同解耦（`skills/site-code-core/SKILL.md`、`skills/site-code-core/LOCAL-EDIT.md`）**：
   - 将所有风格共用的窄屏语义断行与完整 `field-table` 规则统一沉淀在 `SKILL.md` 与 `LOCAL-EDIT.md` 中；
   - 移除 `skills/site-code-core/SKILL.md` 第 18、22 行对所有风格的造型硬锁（「首屏导航桌面一行，高度不超过 72px」「选择一个强调色和中性底色」「只设一个主要入口」），保留全部事实红线、对比度（>= 4.5:1）、三档溢出/重叠、`T-208` `::marker` 直角实色背景、无动效、外部资源禁令与系统图片/图标/底图协议。
2. **既有 4 个风格 `SKILL.md` 彻底去套话、改写为具体设计配方**：
   - 删除 `precision`、`documentary`、`editorial`、`neighborly` 各自第一段结尾复制粘贴的窄屏/表格/无功能套话（约 80% 冗余篇幅），让局部修改 `writeLocalEdit` 提取的风格首段 100% 承载视觉与版式差异；
   - 为每套风格明确：① 具体配色角色表与 2–3 套经对比度核算的行业/企业子色板；② 完整跨平台字体栈（含 `"Noto Serif CJK SC"`, `"Source Han Serif SC"`, `"Songti SC"`, `"SimSun"` 与 `ui-monospace` 等宽数字栈）；③ 专属页头布局（彼此错开，如左栏目录条／窄顶栏／双层刊头／不对称带标尺页头）；④ 专属首屏构图与区块分隔语法；⑤ 明确的**反雷同禁令**（禁止跨风格套用「左上 Kicker + H1 + 导语 + 单实心按钮 + 1px 横线」）。
3. **滑杆解耦与风格内子组合（`lib/code-site-styles.ts`、`lib/code-site-model.ts`）**：
   - 调整 `codeSliderRules()`（`lib/code-site-styles.ts`）：当 `layout` 落在中档（4–7）或与所选风格的默认倾向一致时，明确保持所选风格自身的栏比与构图，不再覆盖成统一的「主次栏约二比一」；当 `density` 落在中档（4–7）时保留风格自身节奏与区块留白，仅在 1–3（规整／疏朗）和 8–10（大胆／紧凑）档位施加明确调整规则；
   - 为同风格内部增加 2–3 套确定性子配方选择指引（或按主体名称散列／资料特征显式建议子色板与页头变体），防止同风格不同公司都输出同色同框。
4. **新增 3 个强对比 `pending` 候选风格并登记**：
   - 新增 `skills/site-code-darkroom/SKILL.md`（暗色展陈）、`skills/site-code-indexgrid/SKILL.md`（瑞士索引）、`skills/site-code-craftposter/SKILL.md`（风物招牌），各有独立 `SOURCE.md`（原创方法与代码许可声明）；
   - 在 `lib/code-site-styles.ts` 登记 `darkroom`、`indexgrid`、`craftposter`（`preview: { status: 'pending' }`），确保 `readyCodeStyleIds` 与普通进程 `codeStyleOptions` 仍只含原有 4 个 `ready` 风格，仅服务端 `SITECRAFT_EVAL_STYLES` 可在评估进程开启。
5. **契约与回归测试更新**：
   - 更新受影响的原四风格/滑杆字面契约测试（`tests/t153-style-preferences.test.ts`、`tests/t184-style-visual.test.ts`），新增测试验证：① 核心规范不再出现单一 72px 顶栏/单一浅底造型锁定；② 4 个原有风格首段长度与差异配方达标，不含复制长段套话；③ `layout=5, density=6` 不覆盖风格默认构图，极端档（2/2、9/9）仍正常给出区别且保留全部事实；④ 3 个新候选只在 `SITECRAFT_EVAL_STYLES` 下准入，普通进程 `auto` 与用户选项保持不变；⑤ 多接口格式测试 `tests/t221-provider-formats.test.ts` 通过。

## Acceptance

- [ ] `skills/site-code-core/SKILL.md` 与 `skills/site-code-core/LOCAL-EDIT.md` 已解耦造型同质化限制，同时完整保留事实红线、对比度、`T-208`、`T-198` 及资源/图片/图标/底图合同
- [ ] `precision`、`documentary`、`editorial`、`neighborly` 四个 `SKILL.md` 已去掉重复防御套话并改写为含子色板、跨平台字体栈、专属页头/首屏配方与反雷同禁令的完整规范
- [ ] `lib/code-site-styles.ts` 的 `codeSliderRules()` 不再在默认值 `(5, 6)` 覆写风格自身尺度，1–3 与 8–10 档仍按要求差异化排版且不增删事实
- [ ] `darkroom`、`indexgrid`、`craftposter` 三个 `SKILL.md` 与 `pending` 登记已完成；普通进程不设置 `SITECRAFT_EVAL_STYLES` 时无法选中且 `auto` 不包含它们
- [ ] 更新并新增的定向单测（含 `t153`、`t158`、`t159`、`t184`、`t221` 相关用例）与 `npm run typecheck` 全部通过（0 真实模型调用）

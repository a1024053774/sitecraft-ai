---
name: frontend-less-ai-tone
description: Makes frontend work look and read like a specific product, not a generic AI landing page or dashboard. Governs copy, visual direction, hierarchy, and AI-default vetoes for HTML, CSS, React, marketing sites, app UI, forms, and empty states. Use when building or restyling UI, writing interface copy, reviewing a page that looks templated, or when the user mentions 去 AI 味, AI slop, frontend-design, generic landing page, or frontend-less-ai-tone. In generators that forbid CSS, follow the project overlay instead of inventing styles.
---

# 前端去 AI 味

先定一个主行动和一个视觉记忆点，再写文案和样式。句子要像这个产品的人在说话；样子要像这家公司会选的，而不是「给谁都那一套」。

能写 CSS 就按已选方向写：样式服务方向，不能当默认皮肤；字体名不是授权，只用项目已有、系统栈或已核许可的字体。不能写 CSS 的受约束生成器（例如只许改槽位）先读项目叠加层，不要硬写样式凑数。

## 何时用

落地页、营销站、后台、表单、空状态、设置页、组件。用户说太像模板、太 AI、去 AI 味、好看一点、专业一点时也用。不要把本 Skill 名称写进用户可见选项。

## 开工前

1. 读者是谁，这一屏要他做什么。只留一个主行动。
2. 用一句话说出样子，且这句话不能只用形容词。例如「车间规格表，氧化红印在新闻纸上」，不是「现代、干净、高级」。
3. 只选一个记忆点：超大标题、一张真图、一条强调色或一块规格。周围克制。
4. 事实只来自给定材料。没有的数字、客户、认证、评价写成缺口，不编。

然后才写结构、文案、CSS。

## 文案

- 保留术语、规格、场景和限制。删「赋能、引领、全面、无缝、赋能未来」时，确认没有丢掉事实。
- Hero、能力、流程、CTA 各承担不同证据，不要复制同一组承诺。
- 按钮写接下来会发生什么：「获取规格表」「导出 CSV」「重试上传」。不要「立即体验」「Get Started」「Learn More」。
- 空状态和错误说明怎么补，不道歉、不空泛。
- 改已有文案时保留否定、范围、例外和不确定程度。

先问：换成另一家公司名是否仍然完全成立？行业最重要的信息是否被套话挤到后面？

## 样子

方向来自内容和读者，不是来自「AI 默认皮」。

判据一句话：换个不相关行业的公司名，这套选择是否原样成立——成立就是默认皮，不管在不在下面这张清单上。这张清单只是最常见的几种，只作否决、不是穷举：

- Inter / Roboto / Arial / `system-ui` 撑起全部个性
- 紫或靛蓝叠近黑底、光斑、玻璃拟态、网状渐变
- 三列等宽圆角卡片、无意义 01/02/03、全大写眉题
- 假数据：客户 Logo 墙、99.9%、N 万用户、无出处评价
- 每块都 fade-up、大阴影、一样的圆角和字重

做的时候：

- 字阶要有主次。颜色是角色：底、字、一条强调、一条边线。
- 动效最多一次进场，尊重 `prefers-reduced-motion`。
- 编号、眉题、分割线只在内容真是步骤或分组时用。
- 不为填版面加卡片、统计、评价、价格或博客。

可访问性（焦点、对比、表单错误、alt）是底线，不是审美方向。

## 写代码时

HTML/CSS/React 按上面的方向实现。不要先贴一套 Tailwind 营销模板再改文案。

检查：

- 主行动在窄屏仍明确
- 长中文标题不撑破
- 缺图时缺口可见，不用灰块假装产品照
- 焦点可见，表单错误看得见

## 不要做

- 不要用本规则或模型自评当美观通过证明
- 不要为了「更像真网站」补造事实或演示图
- 不要把未授权字体、图标、商标写进产物
- 不要平行再写一套审美规则

正反例见 [examples.md](examples.md)。来源见 [SOURCE.md](SOURCE.md)。

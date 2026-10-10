---
id: T-146
title: Shaders、good-css、Oil UI 怎么接进新路线
type: decide
status: closed
blocked_by: []
claimed_by:
supersedes:
---

## Question

负责人 2026-10-10 提出三份外部素材，希望接进系统：Shaders（shader-effects-inc/shaders，MIT，200 个左右的 WebGPU 组件）、good-css（https://good-css.com，MIT，T-132 用过）、Oil UI（github.com/oil-oil/oil-ui，MIT，一个界面设计 skill：先拉开几个真正不同的方向并排挑，再按截图打磨）。

三份素材都和现有约束有冲突或前车之鉴：Shaders 必须跑 JS，而提交入口会去掉脚本，核心规范也写了「无动效」（T-127、T-104）。good-css 在 T-132 里只写进规范文字，三种盲评都没有可测改善，所以没合并。Oil UI 的「多方向挑选」原本就在 MAP「Not yet specified」里。

## Resolution

负责人 2026-10-10 决定（均为推荐项）：

1. **Shaders 只用作系统渲染的静态底图**：系统离线把选定的 shader 渲染成 WebP 图片，作为系统素材按编号交给模型引用，用法和图片、图标一样。生成站仍然没有脚本，也没有动效；不放开 T-127 的硬约束。底图只做抽象背景（首屏、分隔区、页脚），不冒充实拍、产品图或现场图。只用开源 npm 包里的效果和参数，不用付费 Pro 预设。→ [T-148](T-148-shader-static-backgrounds.md)
2. **good-css 改成提交入口的机械检查**：不再往提示词里加规则文字。把能由机器判断的条目做成检查项。第一版只作质量反馈，不拦截，所以不增加修正轮和 token；数据显示误报低、而且确实对应盲评破绽后，再由主控决定哪些升为底线。→ [T-147](T-147-good-css-mechanical-checks.md)
3. **Oil UI 分两步接**：① 把它的方法提炼进「帮我选」的规划步骤：先找同行代表站，把形容词换成具体的字体、留白和配色选择，再给每个方向定一个具体出发点 → [T-149](T-149-oilui-method-in-planning.md)；② 做 oil-ui 式多方向挑选：先出 2–3 个首屏方向的缩略图让用户挑，再生成整站 → [T-150](T-150-multi-direction-pick.md)。T-150 等 T-149 的评估结果出来再开工。

共同约束：外部素材按 AGENTS.md「素材与许可」逐份核对来源、版本和许可，许可全文放在对应 skill 或素材目录的 SOURCE.md 里，不进每次加载的提示词。DeepSeek 预算偏紧：T-148 和 T-149 合用一轮评估，不各跑一轮。

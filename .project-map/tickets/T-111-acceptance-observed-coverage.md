---
id: T-111
title: 验收入口必须拒绝漏测和照片不可见
type: task
status: closed
blocked_by: [T-090, T-113]
claimed_by: codex-control
supersedes:
---

## Question

2026-10-06 的独立审查再次发现验收入口漏检：T-090 的区块进库脚本没有调用声明扫描器，手机页脚基线差 32.16px 仍退出成功；T-109 注塑站上传 6 张照片后，检测图已经加载却随空的加工能力区块隐藏，发布检查仍通过。原始反例分别保留在 `artifacts/t090/20261006-accept/` 和 `artifacts/t109/20261006-photos/run-ebc97b3-01/`。

由 T-090、T-109 的根因修复一并补齐机械检查，不再建立平行检查器：

- 真实 `render-block.mjs` CLI 必须调用共享声明扫描器，保存非空的适用测量，并对声明违规返回非零；回归测试必须能拒绝未接线的旧实现。
- 真实 `check-published.mjs` 必须核对预期发布的上传图片与实际可见、已加载的图片，发现父区块错误隐藏时失败；用户显式隐藏与资料不存在须明确区分，不能靠总数大于零掩盖某一类别漏图。
- 独立审核确认上述回归在正常测试入口运行；在负责验收的 living doc 留一行检查入口和对应失败类型。

## Resolution

**PASS，2026-10-06 关闭机械验收闭环。** 原依赖T-109整票包含图片审美和新的内容取舍，现将依赖收窄为已交付这些检查器修正的T-090/T-113；这不解除T-109/T-112的独立质量门。

- 区块真实CLI已接共享扫描器，必须给非空适用测量；缺/错/不可见声明目标即使在手机不适用范围也失败。原漏接、最小间距0、字体字形与uppercase反例均保留为可拒绝的回归。最终41变体246语言/视口组合通过，含4项真实基线、2项有依据的不适用；证据 `artifacts/t090/20261006-fix/admission-0ad88aa/`。
- 原版发布入口从GET上传清单逐imageId核实际URL、用途、可见与decode，显式隐藏单列且泄露失败；署名按同条文字和精确来源/许可链接联合核对。旧“6图只显示5图却绿”的证据在 `artifacts/t109/20261006-photos/run-ebc97b3-01/`，最终原注塑站及新工业/外贸站18视图/108逐图观察通过，见 `artifacts/t112/final-0ad88aa/`。没有换掉原注塑反例或把旧0图报告当通过。
- 目标唯一性改用实际DOM，正文测量覆盖按原fixture稳定slot与完整文本；CSS字符串及换行行数不充当覆盖。原849/851失败、新漏测负例和真实API/CLI绿分别在 `artifacts/integration/20261006-ce7df9d/`、`artifacts/t113/rework-ce7/`、`artifacts/t113/t103-coverage-fix/`。
- 冻结SHA `0ad88aa0cb232e5d439dadae0d062e527bd2302a` 的887/887全量、build、typecheck通过；独立Astra复审PASS于07:17:43Z，报告 `artifacts/t113/independent-0ad88aa/review-result.json`。AGENTS已记录真实入口、对应回归及不允许的替代计数方式。

本任务不处理素材自身清晰度、语义内容取舍、旧数据迁移或外部模型效果；这些未完成事项仍在原票中，不由本闭环PASS覆盖。

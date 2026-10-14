---
id: T-163
title: 圈选与多条批注草稿管理
type: build
status: open
blocked_by: [T-162]
claimed_by:
supersedes:
---

## Why

T-161 第 2 步。用户常常一次看出好几处问题，需要先全部记下再逐条处理；有些问题不是一个区块，而是一片区域。

## What to build

只取 BaoCut 的画板批注部分，把它做得好的地方融进我们的批注。可以参考 `artifacts/annotation-planning-20261012/reference/` 里的 `area-drawing.tsx`、`canvas-controller.tsx`、`annotations-token.tsx`、`design-annotations.ts`、草稿 store，剪辑等其余部分不碰。改写进来的代码在文件头标明来源，并在 `resources/baocut-annotation/SOURCE.md` 记录来源与许可（见 T-161 规划审查第 1 条）。

1. 批注模式下拖动画框：超过移动阈值才算圈选，可以按 Esc、pointercancel 或失焦取消；不做缩放手柄。系统算出框内覆盖的区块和具体元素：只覆盖一个区块时，等同点选并附带多个元素提示；跨多个区块时列出这些区块，请用户收窄到一个。框的坐标只用于显示，不发给模型。
2. 允许连续添加多条草稿；草稿列表可以编辑、逐条移除、回到预览定位。编号按列表顺序显示，预览上的编号和列表一一对应。
3. 从列表里选一条发送；发送期间新增的草稿保留，成功只归档发出去的那一条。版本变化后的处理同 T-162。
4. 同步 `spec.md`、`CONTEXT.md`。

## Acceptance

- [ ] 失效方式清单（滚动或缩放中拖动、反向拖、极小框、跨区块、IME、发送中新增、换版本）先写好，测试先在父版本上失败
- [ ] 真实 Chrome 真实指针操作，1440/768/375 截图逐张看过
- [ ] 改编自 BaoCut 的文件都有来源标注，SOURCE.md 已建；不调用 DeepSeek；局部修改沿用 T-162 已验证的路径
- [ ] 新审核实例按任务脚本试用多条草稿；Astra 审查通过；typecheck、test、build 通过

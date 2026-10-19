---
id: T-195
title: 重叠扫描把视觉隐藏的文字算作可见，修正两轮仍被拒
type: build
status: open
blocked_by: []
claimed_by:
supersedes:
---

## Why

T-190 新基线第一轮的 packaging/precision 两轮修正后仍被底线检查拒收，排查见 `artifacts/t190/r2-round1-failure-diagnosis.md` 第 2 节。

- **疑似原因**：重叠扫描（`scripts/visitor-layout-scan.js:160` 起）判断可见性时，没有排除 `clip: rect(0 0 0 0)` 这类视觉隐藏，把隐藏的表格 caption 当成可见文字算进了重叠。修正两轮拒因不变。
- **来源**：可见性逻辑来自 1b9ac7f（09-30）。
- **证据程度**：原扫描的矩形没有保存，目前只是高度疑似，还没有用浏览器独立证明。

## What to build

1. **复现**：用保存的候选在浏览器里重放扫描，不调用模型。确认被判重叠的元素是哪一个，以及它为什么被算作可见。没有复现，就如实写「未复现」，并找出真实拒因。
2. **在根因层修**：可见性判断按访客实际能看到的为准，排除常见的视觉隐藏写法：
   - clip 或 clip-path 为零区域；
   - 1px 尺寸加 overflow hidden；
   - opacity 为 0；
   - visibility hidden。
   屏幕阅读器可读、但视觉上隐藏的文字不参与重叠判断。同时要保证真正可见的重叠不被漏掉，不能用一刀切的排除来掩盖问题。
3. **影响面**：说明对比度、溢出等其他底线检查是否共用同一个可见性函数，共用的话一并核对。
4. **成对测试**：
   - 视觉隐藏的 caption：旧实现误判重叠，新实现通过；
   - 真实可见的重叠：仍然拒收；
   - 半隐藏的边界用例：例如 clip 非零但很小，要写明怎么判。

## Acceptance

- [ ] 复现结论写进 Resolution
- [ ] 成对测试先红后绿，真实重叠仍拒
- [ ] 合并后主线验证通过；独立 fast 审查通过

## Resolution

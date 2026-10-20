---
id: T-199
title: 对比度扫描对滤镜、遮罩、裁切、描边与首行首字母变色一律判为无法测量
type: build
status: open
blocked_by: [T-198]
claimed_by:
supersedes:
---

## Why

T-196 的 review5（`artifacts/t196/review5.txt`）三档实测找到四项漏判：文字满足 T-196 的收口条件，访客却看不见，检查仍然放行。这四项是主线对比度扫描原有的通用缺口，正文同样受影响，不是 T-196 引入的。T-190 的 14 个真实站点里一处都没出现。

1. **首行、首字母变色**：正文的 ::first-line 或 ::first-letter 改成浅色，扫描仍按宿主元素的颜色测量。
2. **滤镜与遮罩**：filter:opacity() 或透明 mask 让文字几乎看不见，甚至完全消失。主线的滤镜、遮罩检查只在有 url 背景时才触发。
3. **描边**：-webkit-text-stroke 的白色描边盖住了字形。
4. **裁切**：clip-path:inset(50%) 把文字完全裁掉。

T-196 已经审到第六轮，每轮用自造的新 CSS 都能找到新缺口，所以本票不逐种分析，用白名单收口。

## What to build

1. **白名单收口**：文字自身或任一祖先只要出现下列情况，就统一判为「无法测量」并拒收，不分析实际效果：
   - filter（none 除外）；
   - mask 或 mask-image；
   - clip-path，T-195 认定的标准「仅屏幕阅读器」写法除外；
   - -webkit-text-stroke，宽度为 0 的除外；
   - 改了 color、background 或 opacity 的 ::first-line 或 ::first-letter。
2. **误拒上限**：用 `scripts/check-code-quality-offline.ts` 离线重检 T-190 的 14 站，新增拒因不超过 3 站。超过就停下，报构思主控。
3. **成对测试**：review5 的四项反例在父版上放行，修后拒收；每项再配一个不带这些属性的正常对照，确认不拒收。
4. **复审**：窄复审只查两件事：白名单之外是否还有这四类写法被测量放行，以及误拒是否超出上限。复审挑出的新类别，另记为已知缺口，不在本票追加。

## Acceptance

- [ ] 成对测试先红后绿；14 站离线重检新增拒因不超过 3 站
- [ ] spec 与 AGENTS.md 对比度扫描的表述同步
- [ ] 合并后主线验证通过；独立审查通过

## Resolution

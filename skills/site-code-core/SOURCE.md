# good-css 来源

T-147 的浏览器质量反馈独立实现以下机制：规格文字裁剪、悬停能力门控、触摸点击区、固定页头与锚点、产品图保全。只记录诊断，不复制上游示例代码，不改规划或写页规范。

- 来源：[good-css](https://good-css.com/) / [PRACTICES.md](https://github.com/vojtaholik/good-css/blob/6d16d2fd27f4892e2aea4b5c5c2b016f45be7eef/PRACTICES.md)
- Revision：`6d16d2fd27f4892e2aea4b5c5c2b016f45be7eef`
- 编者：Vojta Holik；2026-10-08 调研见 T-132，采用范围见 T-147。
- 主题：Wrapping and truncation、Hover only where hover exists、A larger click target、Anchor targets that clear a sticky header、Images that keep their proportions。
- 图片检查只能确认原图几何裁切，不能判定主体；点击区采用浏览器命中抽样，不等于 WCAG 完整审核。

以下为该固定 revision 的 MIT 许可全文：

```text
MIT License

Copyright (c) 2026 Vojta Holik

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

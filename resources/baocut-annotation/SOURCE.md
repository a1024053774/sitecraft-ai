# 画板批注参考来源

本目录记录 T-163 内部 Demo 的改编来源；不包含 BaoCut 剪辑、时间线、导出或其他功能。

- 来源：BaoCut，JimLiu/baocut@7aa049e8。仅使用负责人提供的 `artifacts/annotation-planning-20261012/reference/` 离线参考。
- 参考文件：`packages/design-runtime/src/comments/area-drawing.tsx`、`canvas-controller.tsx`；`packages/ui/src/components/annotations-token.tsx`、`model/design-annotations.ts`、`state/draft-design-annotations-store.ts`。
- 改编范围：`components/code-preview-selection.tsx` 的移动阈值、矩形拖动与取消生命周期；`components/code-workspace.tsx` 的按顺序编号列表、逐条操作及发送后仅处理冻结条目的集合管理。均融入既有 T-162 UI，不带入原产品样式、名称、标识、依赖或其他编辑器能力。
- T-164 另借鉴「发送时冻结标注集合、只处理本次集合」的交互语义：SiteCraft 自行按 DOM 路径分组、组装候选并经唯一提交入口核对；没有复制 BaoCut 的实现代码或数据结构。
- 许可：BaoCut Community License 1.0（2026-10-07），原文如下。负责人已在 T-161 确认本项目内部 Demo 的参考改编范围。将来商用须重写这些改编部分或取得单独书面授权；本记录不授予额外权利。
- 改编文件头保留来源与许可说明；版权及许可原文保留在本文件。SiteCraft 新增的 DOM 锚点核对、多元素提示、单区块提交检查沿用自身合同。

## 许可全文

```text
BaoCut Community License
Version 1.0 — October 7, 2026

Copyright (c) 2026 Jim Liu and BaoCut contributors.

This is a source-available license. It permits commercial content creation and
internal business use, but requires a separate written license to commercialize
BaoCut itself or its code. The English text in this file is authoritative;
summaries and translations do not change its terms.

1. Scope and definitions

"Software" means the BaoCut code, binaries, documentation, templates, and other
original project materials supplied with this license, including any portion
of them and modifications based on them. Separately licensed components are
excluded as described in section 7.

"Licensor" means each copyright holder, or its authorized representative,
offering its Software under this license. "You" means the person or organization
exercising the permissions granted here.

"Content" means creative outputs made using the Software: videos, audio,
images, captions, documents, editable media projects, and code that represents
or renders those creative outputs. Content also includes original BaoCut
template elements incorporated into those outputs. Copies of the Software or
its implementation code used to build a software product, library, platform,
or service are not Content merely because they were exported or generated
using BaoCut.

"Internal use" means using or modifying the Software within your organization
for its own operations, with access limited to its personnel and contractors
acting on its behalf. Giving customers finished Content is internal use;
giving outside users access to the Software's functions as a commercial
service is not.

2. Community permissions

Provided you comply with this license, each Licensor permits you to run,
inspect, copy, and modify its Software worldwide without license fees for:

(a) personal activities, learning, research, experimentation, and other
    noncommercial purposes;
(b) internal use, including use by businesses and paid internal development;
(c) creating, editing, rendering, publishing, selling, and delivering Content
    for any purpose, including advertisements, monetized videos, commissioned
    work, and paid editing services.

You may share the original Software or a modified version for noncommercial
purposes, without charging for it or including it in a paid product or bundle,
subject to section 5. Recipients receive permission for the covered Software
directly from the applicable Licensors under this license. You cannot grant
them broader rights to that Software than you have received.

You may charge for consulting, installation, training, support, and development
on a customer's installation when that customer's use is permitted by this
license or a separate commercial license. This permission does not allow you
to sell Software copies, software licenses, or access to a hosted service, or
to deliver the Software as part of a commercial software product.

3. Commercialization requires a separate license

The following activities are outside the community permissions and require a
separate written commercial license from the applicable rights holders before
you undertake them:

(a) selling, renting, licensing for a fee, or otherwise commercially
    distributing the Software, copies of it, or modified versions, including
    installers, rebranded versions, paid bundles, and white-label products;
(b) operating the Software or a modified version for outside users as a
    commercial hosted service, platform, or API, whether access is charged
    directly or monetized through subscriptions, advertising, sponsorship,
    or inclusion in another commercial offering;
(c) incorporating any Software code, binaries, or engine into a commercial
    software product, library, SDK, appliance, or service supplied to others.

These restrictions apply whether you modify the Software or leave it unchanged,
and whether you disclose your source code or keep it private. Publishing a fork
or offering some features without charge does not waive these restrictions.

Selling or monetizing Content alone is not commercialization of the Software.
An independently written plugin, integration, or client that only uses BaoCut's
public interfaces and contains no Software code is not covered by this license
merely because it interoperates with BaoCut. Your use or distribution of BaoCut
alongside it, and any commercial hosting of BaoCut, remain subject to this
license.

For commercial licensing, contact the project maintainer, Jim Liu, at
junminliu@gmail.com. A request, payment, or publication of source code does not
itself grant a commercial license. Only a written agreement from a party
authorized to grant the relevant rights can do so.

4. Rights in Content

This license imposes no license fee, revenue share, BaoCut attribution,
watermark, or source-disclosure requirement on your Content. The Licensors
claim no ownership of your Content merely because you used the Software.

To the extent a Licensor's original templates or other creative elements
provided for incorporation into Content appear in your Content, that Licensor
permits you to reproduce, adapt, distribute, perform, display, and commercially
exploit those elements as part of the Content, and to authorize recipients to
do the same, without requiring them to license BaoCut. This permission does not
cover distributing the Software as a product or library.

Rights in third-party inputs, assets, fonts, models, voices, and generated
material depend on their own terms and applicable law. This license neither
changes those terms nor promises that all outputs are free of other rights.

5. Redistribution and identification

For any redistribution permitted by this license, include this complete license
with the Software and retain applicable copyright, attribution, and third-party
license notices. Mark modified versions as modified and identify them so that
recipients can distinguish them from official BaoCut releases.

You retain rights in your own modifications. Any terms you apply to them cannot
remove or replace this license's conditions on the covered Software.

This license grants no right to use BaoCut names, logos, or other trademarks
as your own branding or to suggest official approval or affiliation. Accurate
references to the Software's origin and legally permitted trademark uses are
unaffected.

6. Patents and reserved rights

Each Licensor also permits uses authorized by this license under patent claims
it controls that would necessarily be infringed by its Software as supplied.
This permission does not extend to claims infringed only by your changes or
combinations with other products.

No rights are granted beyond those expressly stated here. The Licensors may
offer their Software under separate licenses. Contributors retain their
copyrights; this license is not a copyright assignment and does not by itself
authorize the maintainer to grant broader commercial rights in contributions.
Any such rights must come from the relevant rights holders or a separate
contributor agreement.

7. Third-party components and earlier licenses

Dependencies, vendored code, adapted third-party code, assets, fonts, models,
and other materials identified as separately licensed remain governed by their
respective licenses. See THIRD_PARTY_NOTICES.md and the notices accompanying
those materials. This license cannot restrict rights independently granted
to you in those components under their original licenses.

This license applies to versions and materials offered under it. It does not
withdraw rights already granted for earlier versions or materials under
Apache-2.0 or another license. If you have an independently valid license for
particular materials, you may exercise those rights under that license.
Future revisions of this license do not automatically replace this version
for a copy you already received.

8. Compliance and termination

Permissions under this license last while you meet its conditions. A violation
terminates your permissions for the covered Software. For a first violation,
permissions are restored if you end the violation and remedy its effects to
the extent practicable within 30 days after receiving written notice from a
Licensor. A subsequent violation requires that Licensor's written consent for
reinstatement. Reinstatement does not excuse liability for the violation.

Nothing here limits statutory exceptions or other rights that do not require
the Licensors' permission, or revokes the Content permissions already validly
granted under section 4 for Content created while you complied with this
license.

9. Warranty and liability

To the maximum extent allowed by applicable law, the Software is supplied
without warranties, whether express, implied, or statutory, including
warranties of fitness for a particular purpose, merchantability, title, and
noninfringement. You bear the risk of using it.

To the maximum extent allowed by applicable law, no Licensor is liable for
losses arising from this license or the Software, including lost revenue,
lost data, business interruption, or other direct, indirect, incidental,
special, or consequential damages, regardless of the legal basis of the claim
and even if the possibility of such losses was known.

10. Interpretation

If a provision cannot be enforced, the remaining provisions continue to apply
to the extent permitted by law. Failure to enforce a condition is not a waiver.
Separate written licenses govern only the rights and uses they expressly grant.
```

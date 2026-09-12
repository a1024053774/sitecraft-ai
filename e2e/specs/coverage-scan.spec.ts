/**
 * 批量覆盖扫描：对一组模板逐个打开真实 preview、注入标准草稿、回收 applied 报告，
 * 汇总输出每个模板的 covered / missing / residue。
 *
 * 运行时用环境变量 COVERAGE_TEMPLATES 指定模板（逗号分隔）；默认扫有 dist 且已入 catalog 的集合。
 *
 * 断言口径（2026-09-09 修正，此前**零断言**——页面能打开就算过，缺槽位/残留 demo 照样绿，
 * 导致「过门禁」不可信）：
 *  - 必需槽位（manifest `slot.required`）必须全部可见 → 缺一个即失败
 *  - 不得残留 demo 槽位 → 有残留即失败
 * 未注册 manifest 的模板判失败（而非静默 return）——契约缺失本身就是缺口。
 */
import { expect, test } from "@playwright/test";

import { applyDraft, classifyCoverage, coverageDraft, evaluateTemplateFidelity, hasManifest, openPreview } from "../helpers/coverage-scan";
import { templateCatalog } from "../../lib/template-catalog";

const ALL_CATALOG_IDS = templateCatalog.map((item) => item.id);
const ENV = (process.env.COVERAGE_TEMPLATES || "").split(",").map((s) => s.trim()).filter(Boolean);
const targetIds = ENV.length > 0 ? ENV : ALL_CATALOG_IDS;

for (const templateId of targetIds) {
  test(`${templateId} 真实预览：标准草稿槽位覆盖扫描`, async ({ page }) => {
    expect(hasManifest(templateId), `${templateId} 未注册槽位契约（manifest），先注册再扫`).toBe(true);
    await openPreview(page, templateId);
    const draft = coverageDraft(templateId);
    const report = await applyDraft(page, templateId, draft);
    const result = classifyCoverage(templateId, report);
    const detail = `covered=${result.covered.join(",") || "(none)"} missing=${result.missing.join(",") || "-"} residue=${result.residue.join(",") || "-"}`;

    expect(result.missing, `${templateId} 必需槽位未覆盖：${result.missing.join(",")}｜${detail}`).toEqual([]);
    expect(result.residue, `${templateId} 残留 demo 槽位：${result.residue.join(",")}｜${detail}`).toEqual([]);

    /**
     * 忠实度门禁（2026-09-10 新增，P4 前置）：覆盖率「填了没有」之外，还要看
     * 「填得对不对」——L2 页面残留（lorem/人名）、L3 该原生却走兜底。
     *
     * 这是 `evaluateFidelity` 的**生产外基线**：发布链路已按同一份判定接线（publish/route.ts），
     * 此处对全部模板跑一遍，供 P4 新模板对照。
     */
    const fidelity = evaluateTemplateFidelity(templateId, report);
    expect(
      fidelity.blockers,
      `${templateId} 忠实度不通过：${fidelity.blockers.join("；")}`,
    ).toEqual([]);
  });
}


/**
 * D. 模板选择
 *
 * ## 这一页有**两个**模板网格（2026-09-13 修正）
 *
 * | 容器 | 内容 | 数量来源 |
 * |---|---|---|
 * | `.page-content > .template-grid`（首个子元素） | 编译期基线的开源模板 | `templates.length`（编译期常量） |
 * | `.template-mine .template-grid` | 用户自己做的（运行时注册） | 由接口返回，**数量不固定** |
 *
 * ⚠️ **踩过的坑（原文记录）**：此前两条断言都用 `.template-grid .template-card`
 * 这个 locator——它**跨两个容器一起数**，于是运行时模板一旦存在就变成
 * `Expected: 22 / Received: 35`（22 基线 + 13 个用户模板）。
 * 那**不是"断言过严"，是 locator 选错了容器**：一个"基线模板数"的断言
 * 本来就不该把用户模板数进来。
 *
 * 所以现在按容器分开断言，且每条各自说清在测什么：
 * - 基线那条：**编译期常量**精确断言（多一个少一个都是回归）；
 * - 用户模板那条：**不断言具体数字**（它随用户与运行次数变），
 *   只断言"接口说有几个、页面就渲染几张，且页头那句'共 N 个'一致"——
 *   这既是真实约束（不是永真），又不会因为跑第二遍就变红。
 *
 * ⚠️ 运行时模板由服务端**扫盘装载**（`.sitecraft-data/generated-templates/`，
 * 见 `lib/template-runtime-loader.ts`），所以本页卡片数在开发机上本来就可能 >22。
 * 那不是 bug，是本页 2026-09-10 起有意支持的能力。
 */
import { test, expect } from "../helpers/fixtures";
import { expectNoCrash } from "../helpers/ui";
import { templates } from "../../lib/site-model";

/** 基线网格：**只**数编译期那批，不含用户模板（用户模板在 `.template-mine` 里）。 */
const BASELINE_GRID = ".page-content > .template-grid";
const BASELINE_CARDS = `${BASELINE_GRID} .template-card`;
const MINE_CARDS = ".template-mine .template-card";

test.describe("D. 模板选择", () => {
  test("基线模板**按容器**精确计数，筛选切换不串状态", async ({ page }) => {
    await page.goto("/templates");

    // 先钉住基线总数——编译期常量，精确值断言（不是下界）
    await expect(page.locator(BASELINE_CARDS)).toHaveCount(templates.length);

    // 分类筛选：逐类核对**基线**数量（用户模板不参与这条）
    const categories = ["全部模板", "制造业", "外贸目录", "科技企业", "专业服务"];
    for (const label of categories) {
      const expected =
        label === "全部模板"
          ? templates.length
          : templates.filter((template) => template.category === label).length;
      await page.locator(".template-filters").getByText(label, { exact: true }).click();
      await expect(page.locator(BASELINE_CARDS)).toHaveCount(expected);
    }
    await expectNoCrash(page);
  });

  test("用户做的模板走**独立容器**：接口说几个就渲染几张（数量不写死）", async ({ page }) => {
    await page.goto("/templates");

    // 从服务端拿真实数量——派生，不手抄（军规 1）
    const response = await page.request.get("/api/templates/runtime");
    expect(response.ok()).toBeTruthy();
    const payload = (await response.json()) as { templates?: unknown[] };
    const mineCount = payload.templates?.length ?? 0;

    const mineSection = page.locator(".template-mine");
    if (mineCount === 0) {
      // 没有用户模板时整段不渲染——有意为之（空区块只是噪音）
      await expect(mineSection).toHaveCount(0);
      return;
    }
    await expect(page.locator(MINE_CARDS)).toHaveCount(mineCount);
    // 卡片数与页头那句"共 N 个"必须同源——两处对不上就是自相矛盾
    await expect(mineSection.locator(".template-mine-head")).toContainText(`共 ${mineCount} 个`);
  });

  test("基线卡片使用本地渲染且无空白", async ({ page }) => {
    await page.goto("/templates");
    await expect(page.locator(BASELINE_CARDS)).toHaveCount(templates.length);
    // iframe 封面是**基线模板独有**的渲染方式（运行时模板的卡在另一个容器里）
    await expect(page.locator(`${BASELINE_GRID} iframe.open-source-template-frame`)).toHaveCount(
      templates.length,
    );
    await expect(page.locator(".template-live-badge").first()).toContainText("本地模板预览");
  });
});

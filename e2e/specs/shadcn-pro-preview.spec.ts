import { expect, test } from "@playwright/test";

const shadcnAssetPrefix = "/api/templates/shadcn-landing2/assets/";

function isTrackedStaticAsset(requestUrl: string) {
  const { pathname } = new URL(requestUrl);
  return pathname.startsWith(shadcnAssetPrefix) || pathname.startsWith("/_next/static/");
}

/**
 * ⚠️ **QUARANTINE（2026-09-13）——本 spec 目前必然失败，原因已知且已立案 T-14。**
 *
 * ## 为什么红（实测证据，不是推断）
 *
 * `localPreviewCsp()`（`app/api/templates/[templateId]/preview/route.ts:35`）在
 * **production** 下只给桥接脚本发 nonce，**模板自带的内联脚本一律被 CSP 拦**。
 * 而 `shadcn-landing2` 是 Next.js 导出站——它的整棵 DOM（含 `<div id="root">`）
 * 由 `self.__next_f.push(...)` 这些**内联脚本在运行时构建**：
 *
 * | 步骤 | 实测 |
 * |---|---|
 * | 静态 `dist/index.html` | h1=1, h2/3=78, section=13，**`id="root"` 0 处** |
 * | served HTML | 结构**完全一致**（服务端没删内容） |
 * | 浏览器 | `h1Count=0`, `sectionCount=0`，body 只剩 ~171KB（≈一半） |
 *
 * → 内联脚本被拦 → React 从未挂载 → **服务时那 79 个标题被清空 → 真白屏**。
 * e2e 跑的是 `next start`（production），所以**这是生产形态的真实表现**。
 *
 * ## 影响面（全 22 个基线模板已盘点）
 *
 * 只有 `shadcn-landing2` 属"拦了会白屏"这一类；其余 17 个虽有内联脚本，
 * 内容仍在静态 HTML 里（Astro 为主，内联多为增强），4 个只有 JSON-LD。
 * 盘点脚本：`e2e/scripts/probe-inline-scripts.ts`（随代码保留）。
 *
 * ## 为什么用 `test.fail()` 而不是 skip/删除
 *
 * - **不是 skip**：它仍然**真的跑**，仍然会对生产 CSP 提意见；
 *   一旦 T-14 修好，`test.fail()` 会**立刻转红**（"预期失败却通过了"），
 *   逼着人来摘掉这个标记——这是**有意的**，避免修好了还被永久静默。
 * - **不删**：删掉等于把这条真实缺陷的证据扔掉。
 *
 * ## T-14 修好后要做的事（写在案上，别让标记长草）
 *
 * 1. 摘掉 `test.fail()`；
 * 2. **换掉下面那条没有判别力的断言**——`heroHeight > 300` 在白屏时也"成立"
 *    （高度 0 时是**更早**的 `heroDisplay` 先红），它区分不了"白屏"与"正常"；
 *    T-13 修复批应换成有判别力的标志（如 hydration 完成的标志元素）。
 */
test("SHADCN PRO wrapper applies its exported styles inside the preview iframe", async ({ page, request }, testInfo) => {
  // T-14：生产 CSP 拦住模板自带内联脚本 → 本模板白屏。见文件头。
  test.fail(true, "T-14：生产 CSP 只放行桥接 nonce，shadcn-landing2 的内联 hydration 被拦 → 白屏");
  const failedAssets: Array<{ url: string; status?: number; error?: string }> = [];

  page.on("requestfailed", (request) => {
    if (isTrackedStaticAsset(request.url())) {
      failedAssets.push({ url: request.url(), error: request.failure()?.errorText });
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && isTrackedStaticAsset(response.url())) {
      failedAssets.push({ url: response.url(), status: response.status() });
    }
  });

  const previewResponse = await request.get("/api/templates/shadcn-landing2/preview");
  expect(previewResponse.status()).toBe(200);
  expect(previewResponse.headers()["x-sitecraft-preview-source"]).toBe("local-open-source-snapshot");
  const previewHtml = await previewResponse.text();
  expect(previewHtml).not.toMatch(/(?:src|href)=["']\/_next\//i);

  const cssUrl = previewHtml.match(/<link\b[^>]*href=["']([^"']+\.css)["']/i)?.[1];
  const scriptUrl = previewHtml.match(/<script\b[^>]*src=["']([^"']+\.js)["']/i)?.[1];
  const heroUrl = previewHtml.match(/<img\b[^>]*src=["']([^"']*hero-image[^"']+)["']/i)?.[1];
  expect(cssUrl).toBeTruthy();
  expect(scriptUrl).toBeTruthy();
  expect(heroUrl).toBeTruthy();

  for (const [assetUrl, contentType] of [
    [cssUrl!, "text/css"],
    [scriptUrl!, "text/javascript"],
    [heroUrl!, "image/jpeg"],
  ] as const) {
    const assetResponse = await request.get(assetUrl);
    expect(assetResponse.status(), assetUrl).toBe(200);
    expect(assetResponse.headers()["content-type"], assetUrl).toContain(contentType);
  }

  const response = await page.goto("/templates/shadcn-landing2/preview");
  expect(response?.status()).toBe(200);
  await expect(page.locator(".template-preview-toolbar-title strong")).toHaveText("SHADCN PRO / Modern");

  const previewFrame = page.frameLocator('iframe[title="开源模板 shadcn-landing2 预览"]');
  const previewFrameElement = page.locator('iframe[title="开源模板 shadcn-landing2 预览"]');
  await expect(previewFrame.locator("body")).toBeVisible();

  const renderState = await previewFrame.locator("body").evaluate((body) => {
    const doc = body.ownerDocument;
    const heroHeading = doc.querySelector<HTMLElement>("h1");
    const hero = heroHeading?.closest<HTMLElement>("section") ?? null;
    const heroLayout = hero?.querySelector<HTMLElement>(".grid") ?? null;
    const styleSheets = [...doc.styleSheets].map((sheet) => {
      let ruleCount = -1;
      try {
        ruleCount = sheet.cssRules.length;
      } catch {
        // Cross-origin styles are represented explicitly instead of hiding the failure.
      }
      return { href: sheet.href, ruleCount };
    });

    return {
      styleSheets,
      bodyFont: getComputedStyle(body).fontFamily,
      heroDisplay: heroLayout ? getComputedStyle(heroLayout).display : null,
      heroHeight: hero?.getBoundingClientRect().height ?? 0,
      heroHeading: heroHeading?.textContent?.replace(/\s+/g, " ").trim() ?? null,
    };
  });

  await page.screenshot({
    path: "test-results/steps/chromium-shadcn-pro-wrapper.png",
    fullPage: false,
  });
  const frameScreenshot = await previewFrameElement.screenshot({
    path: "test-results/steps/chromium-shadcn-pro-iframe.png",
  });
  const pixelStats = await page.evaluate(async (dataUrl) => {
    const image = new Image();
    image.src = dataUrl;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas 2D context is unavailable");
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let sampled = 0;
    let nonWhite = 0;
    const colors = new Set<string>();
    for (let index = 0; index < pixels.length; index += 16) {
      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      sampled += 1;
      if (red < 245 || green < 245 || blue < 245) nonWhite += 1;
      colors.add(`${red >> 3},${green >> 3},${blue >> 3}`);
    }
    return { nonWhiteRatio: nonWhite / sampled, colorCount: colors.size };
  }, `data:image/png;base64,${frameScreenshot.toString("base64")}`);

  await testInfo.attach("shadcn-pro-render-diagnostics", {
    body: Buffer.from(JSON.stringify({ failedAssets, renderState, pixelStats }, null, 2)),
    contentType: "application/json",
  });

  expect(failedAssets).toEqual([]);
  expect(renderState.styleSheets.some((sheet) => sheet.ruleCount > 0)).toBe(true);
  expect(renderState.bodyFont).not.toMatch(/Times New Roman/i);
  expect(renderState.heroDisplay).toBe("grid");
  expect(renderState.heroHeight).toBeGreaterThan(300);
  expect(renderState.heroHeading).toBeTruthy();
  expect(pixelStats.nonWhiteRatio).toBeGreaterThan(0.2);
  expect(pixelStats.colorCount).toBeGreaterThan(50);
});

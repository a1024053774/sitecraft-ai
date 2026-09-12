import { test } from "../helpers/fixtures";
import { cloneDraft, defaultDraft } from "../../lib/site-document";

test("forge hero img click produces asset-select", async ({ page, demoSite }) => {
  await page.goto(`/workspace?siteId=${demoSite.id}`);
  await page.getByRole("button", { name: "直接编辑" }).click();
  await page.waitForTimeout(600);
  const frame = page.frameLocator("iframe");
  const img = frame.locator('img[src*="heroimg"]').first();
  await img.waitFor({ timeout: 20000 });
  const info = await frame.locator("body").evaluate(() => {
    const el = document.querySelector('img[src*="heroimg"]');
    if (!el) return { error: "no img" };
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width/2, cy = r.top + r.height/2;
    const hit = document.elementFromPoint(cx, cy);
    return { rect: {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}, hit: hit ? hit.tagName + "." + (typeof hit.className === "string" ? hit.className.split(" ").slice(0,2).join(".") : "") : null, isImg: hit === el, src: el.getAttribute("src") };
  });
  console.log("ASSET:", JSON.stringify(info));
  // 用鼠标真实点击
  const box = await img.boundingBox();
  if (box) await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
  await page.waitForTimeout(1200);
  console.log("dialog count:", await page.locator(".import-modal").count());
  console.log("dialog text:", (await page.locator(".import-modal").first().textContent().catch(() => ""))?.slice(0, 80));
});

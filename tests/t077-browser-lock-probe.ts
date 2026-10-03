import { openBrowser } from "./helpers/workspace-browser.ts";

try {
  const browser = await openBrowser();
  await browser.send("Browser.close", {}).catch(() => {});
  browser.ws.close();
  await new Promise((resolve) => setTimeout(resolve, 100));
  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}

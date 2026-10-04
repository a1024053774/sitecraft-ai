import { openBrowser, sleep } from "./helpers/workspace-browser.ts";

const mode = process.argv[2] ?? "normal";
const browser = await openBrowser();
const ownerPid = process.pid;
const port = 10_000 + (ownerPid % 50_000);
const dataDir = `/tmp/sitecraft-workspace-${ownerPid}`;
console.log(`READY ${JSON.stringify({ ownerPid, port, dataDir })}`);

if (mode === "normal") {
  browser.ws.close();
  await sleep(1_000);
  process.exit(0);
}
if (mode === "throw") throw new Error("T-094 intentional child failure");
if (mode === "term") {
  process.kill(process.pid, "SIGTERM");
  await sleep(10_000);
}
if (mode === "hold") await sleep(60_000);

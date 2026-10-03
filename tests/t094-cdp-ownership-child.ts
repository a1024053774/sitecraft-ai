import { readFileSync } from "node:fs";
import { openBrowser, sleep } from "./helpers/workspace-browser.ts";

const gate = process.env.T094_CDP_GATE!;
const infoFile = process.env.T094_CDP_INFO!;
console.log(`READY ${process.pid}`);
while (!readFileSync(gate, "utf8").trim()) await sleep(25);

const foreign = JSON.parse(readFileSync(infoFile, "utf8")) as { webSocketDebuggerUrl: string };
const browser = await openBrowser();
console.log(`RESULT ${JSON.stringify({ sameEndpoint: browser.url === foreign.webSocketDebuggerUrl, url: browser.url })}`);
browser.ws.close();
await sleep(1_000);

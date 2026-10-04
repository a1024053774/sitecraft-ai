import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const sourcePath = path.resolve("tests/workspace-interaction.test.ts");
const mutantPath = path.resolve("tests/.t099-short-window.test.ts");
const source = await readFile(sourcePath, "utf8");
const shortened = source
  .replaceAll("await sleep(350);", "await sleep(0);")
  .replaceAll("await sleep(300);", "await sleep(0);")
  .replaceAll("await sleep(400);", "await sleep(0);")
  .replaceAll("await sleep(900);", "await sleep(0);")
  .replaceAll("await sleep(600);", "await sleep(0);");
await writeFile(mutantPath, shortened, "utf8");

const child = spawn(process.execPath, ["--test", "--experimental-strip-types", "--test-name-pattern=workspace motion", mutantPath], {
  cwd: process.cwd(),
  env: process.env,
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
child.stdout.on("data", (chunk) => { output += String(chunk); });
child.stderr.on("data", (chunk) => { output += String(chunk); });
const result = await new Promise<{ code: number | null }>((resolve) => child.once("exit", (code) => resolve({ code })));
await rm(mutantPath, { force: true });
process.stdout.write(output);
process.exit(result.code ?? 1);

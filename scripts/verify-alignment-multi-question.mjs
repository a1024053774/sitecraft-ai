import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const result = await new Promise((resolve) => {
  const child = spawn(process.execPath, ["--test", "--experimental-strip-types", "tests/alignment-multi-question.e2e.test.ts"], { stdio: ["ignore", "pipe", "pipe"] });
  let stdout = ""; let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
});
const artifact = {
  ticket: "T-019",
  command: "node --test --experimental-strip-types tests/alignment-multi-question.e2e.test.ts",
  flow: ["资料", "需求对齐多题卡", "一次提交全部答案", "确认", "生成", "预览草稿"],
  result: result.code === 0 ? "PASS" : "FAIL",
  stdout: result.stdout,
  stderr: result.stderr,
  generatedAt: new Date().toISOString(),
};
await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/t019-alignment-multi-question.json", JSON.stringify(artifact, null, 2));
process.stdout.write(JSON.stringify({ result: artifact.result, artifact: "artifacts/t019-alignment-multi-question.json" }) + "\n");
process.exitCode = result.code;

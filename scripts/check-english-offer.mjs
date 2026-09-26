import { mkdir, readFile, writeFile } from "node:fs/promises";
import { draftOffersVisitorEnglish } from "../lib/draft-english.ts";

const raw = JSON.parse(await readFile(".sitecraft-data/sites/overlay-sparse-20260924.json", "utf8"));
const offersEnglish = draftOffersVisitorEnglish(raw.draft);
const artifact = {
  ticket: "T-024",
  siteKey: "overlay-sparse-20260924",
  expectedOffersEnglish: false,
  offersEnglish,
  result: offersEnglish === false ? "PASS" : "FAIL",
  command: "node scripts/check-english-offer.mjs",
  generatedAt: new Date().toISOString(),
};
await mkdir("artifacts/t024-published-sparse-check", { recursive: true });
await writeFile("artifacts/t024-published-sparse-check/english-offer.json", JSON.stringify(artifact, null, 2));
console.log(JSON.stringify({ result: artifact.result, artifact: "artifacts/t024-published-sparse-check/english-offer.json" }));
if (artifact.result !== "PASS") process.exitCode = 1;

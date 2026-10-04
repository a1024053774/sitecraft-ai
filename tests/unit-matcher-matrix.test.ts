import assert from "node:assert/strict";
import test from "node:test";
import { validateAIOperations } from "../lib/site-operations.ts";

const options = { templateIds: new Set(["forge", "screwfast", "landwind", "tailwind-landing"]) };
const check = (zh: string, en: string) => validateAIOperations(`MOQ：${zh}。`, [{
  op: "replace_commercial_terms",
  terms: [{ id: "matrix", kind: "moq", value: { zh, en } }],
} as never], options.templateIds).operations.length === 1;

const matrix = [
  ["ten-thousand-piece", "600 万件", "6 million parts", true],
  ["piece", "5000 件", "5000 pcs", true],
  ["day", "2 天", "2 days", true],
  ["hour", "2 小时", "2 hours", true],
  ["week", "2 周", "2 weeks", true],
  ["month", "2 月", "2 months", true],
  ["year", "2 年", "2 years", true],
  ["equipment", "2 台", "2 units", true],
  ["set", "2 套", "2 sets", true],
  ["ton", "800 t", "800 tons", true],
  ["kg", "2 kg", "2 kg", true],
  ["ten-thousand-piece per", "每万件", "per ten thousand pieces", true],
  ["piece per", "每件", "per piece", true],
  ["day per", "每天", "per day", true],
  ["hour per", "每小时", "per hour", true],
  ["week per", "每周", "per week", true],
  ["month per", "每月", "per month", true],
  ["year per", "每年", "per year", true],
  ["equipment per", "每台", "per machine", true],
  ["set per", "每套", "per set", true],
  ["ton per", "每吨", "per ton", true],
  ["kg per", "每千克", "per kg", true],
  ["piece lexical", "零件检查", "Part inspection", true],
  ["ten-thousand-piece lexical", "万件文件", "Ten-thousand-file review", true],
  ["day lexical", "天数说明", "specific number of days", true],
  ["week lexical", "周边检查", "Perimeter inspection", true],
  ["month lexical", "月度检验", "Monthly inspection", true],
  ["year lexical", "年份检查", "Year inspection", true],
  ["equipment lexical", "台账检查", "Ledger inspection", true],
  ["set lexical", "套管检查", "Tube inspection", true],
  ["ton lexical", "T型检查", "T-shaped inspection", true],
  ["kg lexical", "KG编号", "KG code", true],
  ["piece bare", "件", "pieces", false],
  ["ten-thousand-piece bare", "万件", "ten thousand pieces", false],
  ["day bare", "天", "days", false],
  ["hour bare", "小时", "hours", false],
  ["week bare", "周", "weeks", false],
  ["month bare", "月", "months", false],
  ["year bare", "年", "years", false],
  ["equipment bare", "台", "units", false],
  ["set bare", "套", "sets", false],
  ["ton bare", "吨", "tons", false],
  ["kg bare", "kg", "kg", false],
  ["piece shifted", "5000 件", "pieces: 5000", false],
  ["ten-thousand-piece shifted", "600 万件", "parts: 6 million", false],
  ["day shifted", "2 天", "days: 2", false],
  ["hour shifted", "2 小时", "hours: 2", false],
  ["week shifted", "2 周", "weeks: 2", false],
  ["month shifted", "2 月", "months: 2", false],
  ["year shifted", "2 年", "years: 2", false],
  ["equipment shifted", "2 台", "units: 2", false],
  ["set shifted", "2 套", "sets: 2", false],
  ["ton shifted", "800 t", "tons: 800", false],
  ["kg shifted", "2 kg", "kg: 2", false],
  ["business year", "模具年产约 180 套", "About 180 molds per year", true],
  ["business month", "月注塑能力约 600 万件", "About 6 million parts per month", true],
] as const;

test("shared unit matcher matrix keeps contextual units and rejects lexical or shifted units", () => {
  for (const [label, zh, en, expected] of matrix) {
    assert.equal(check(zh, en), expected, `${label}: ${zh} / ${en}`);
  }
});

test("simulated-pack business unit phrases all keep their source-backed unit mapping", () => {
  const business = [
    ["模具年产约 180 套", "About 180 molds per year"],
    ["月注塑能力约 600 万件", "About 6 million parts per month"],
    ["每 2 小时抽检", "Sample every 2 hours"],
    ["模具单套起接", "Molds from one set"],
    ["注塑件 5000 件起", "Molded parts from 5,000 pcs"],
    ["模具 25–55 天", "Molds 25–55 days"],
    ["注塑机 42 台", "42 injection machines"],
    ["注塑机 42 台（90–800 t）", "42 injection machines (90–800 t)"],
  ] as const;
  for (const [zh, en] of business) assert.equal(check(zh, en), true, `${zh} / ${en}`);
});

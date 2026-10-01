import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { defaultDraft, type SiteDraft } from "../lib/site-document.ts";
import { applySiteOperations, type SiteOperation } from "../lib/site-operations.ts";
import { simulatedPacks } from "../lib/simulated-packs.ts";
import { packDraft } from "./fixtures/pack-drafts.ts";

// T-053 step 3: on a look that is on the block library the model is told which layouts it may
// pick, what each needs, and that the system checks; its layout requests are checked against the
// draft after its other changes, and the reasons reach the user in the summary.

const envKeys = ["DEEPSEEK_API_KEY", "DEEPSEEK_MODEL", "DEEPSEEK_BASE_URL", "DEEPSEEK_MAX_TOKENS", "AI_API_KEY", "AI_MODEL", "AI_BASE_URL"] as const;
const previousEnv: Partial<Record<(typeof envKeys)[number], string | undefined>> = {};
for (const key of envKeys) previousEnv[key] = process.env[key];
function writeEnv(key: string, value: string | undefined) {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) delete env[key];
  else env[key] = value;
}
writeEnv("DEEPSEEK_API_KEY", "sk-test-layouts-not-real");
writeEnv("DEEPSEEK_MODEL", "test-layouts-model");
writeEnv("DEEPSEEK_BASE_URL", "https://layouts-stub.test.invalid");
writeEnv("AI_API_KEY", undefined);
writeEnv("AI_MODEL", undefined);
writeEnv("AI_BASE_URL", undefined);

const originalFetch = globalThis.fetch;
const stubBase = "https://layouts-stub.test.invalid/";
const requestBodies: string[] = [];
let payloads: Array<Record<string, unknown>> = [];
globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!url.startsWith(stubBase)) throw new Error(`refusing unexpected fetch ${url}`);
  requestBodies.push(typeof init?.body === "string" ? init.body : "");
  const payload = payloads.length > 1 ? payloads.shift()! : payloads[0];
  return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(payload) } }] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const abs = path.join(process.cwd(), specifier.slice(2));
    const file = existsSync(`${abs}.ts`) ? `${abs}.ts` : existsSync(path.join(abs, "index.ts")) ? path.join(abs, "index.ts") : abs;
    return nextResolve(pathToFileURL(file).href, context);
  },
});

const { requestStructuredOperations } = await import("../lib/ai-provider.ts");

test.after(() => {
  globalThis.fetch = originalFetch;
  for (const key of envKeys) writeEnv(key, previousEnv[key]);
});

function lastMessage(role: "system" | "user") {
  const parsed = JSON.parse(requestBodies.at(-1) ?? "{}") as { messages?: Array<{ role?: string; content?: string }> };
  return String(parsed.messages?.find((item) => item.role === role)?.content ?? "");
}

const options = { templateIds: new Set(["forge", "screwfast", "landwind", "tailwind-landing"]), lastChange: "layouts" };
const setLayout = (block: string, variant: string | null) => ({ op: "set_block_variant", block, variant });

async function ask(draft: SiteDraft, message: string, payload: Record<string, unknown> | Array<Record<string, unknown>>, allowSiteStyle = false) {
  payloads = Array.isArray(payload) ? [...payload] : [payload];
  return requestStructuredOperations({ message, draft, templateId: draft.templateId, allowSiteStyle });
}

test("on the engineering look the model gets the layouts it may pick, what each needs, and a 24-operation limit", async () => {
  const draft = applySiteOperations(packDraft("industrial"), [setLayout("products", "compare") as SiteOperation], options).draft;
  await ask(draft, "看看现在的页面", { type: "answer", text: "ok" });
  const system = lastMessage("system");
  assert.match(system, /set_block_variant/);
  for (const text of ["hero", "split", "左文右图", "statement", "大标题加参数条", "products", "cards", "产品卡片", "grouped", "按类别分组", "compare", "参数对比表", "contact", "band", "联系条"]) {
    assert.ok(system.includes(text), `the layout menu names ${text}`);
  }
  for (const rule of ["至少 3 项带数值的产品参数", "至少 2 个产品类别", "2–4 个产品", "至少 3 项", "邮箱、电话、地址至少 2 项"]) {
    assert.ok(system.includes(rule), `the menu says what a layout needs: ${rule}`);
  }
  assert.match(system, /系统会按资料检查/);
  assert.match(system, /按资料生成或重做整站时，为上面每一块各输出一条 set_block_variant（选默认布局也写出来/, "a full-site generation decides every switchable block");
  assert.match(system, /最多 24 条/);
  assert.equal(system.includes("最多 20 条"), false);
  assert.equal(system.includes("不得超过 20 条"), false);
  // Blocks with a single layout (navigation, footer, lists, steps, FAQ) are not offered.
  const menu = system.slice(system.indexOf("可选布局"));
  assert.ok(menu.length > 0 && system.includes("可选布局"));
  for (const variant of ["bar", "columns", "list", "steps", "badges", "accordion"]) assert.equal(menu.includes(`${variant}=`), false, `${variant} is not a choice`);
  const user = lastMessage("user");
  assert.match(user, /"blockVariants":\{"products":"compare"\}/, "the model sees the layouts the draft shows now");
});

test("the engineering prompt exposes style directions, the material recommendation, and the extra style operation", async () => {
  await ask(packDraft("molding"), "按加工能力、产能、工艺和检测来做一个工厂实力网站", { type: "answer", text: "ok" }, true);
  const system = lastMessage("system");
  assert.match(system, /set_site_style/);
  for (const direction of ["spec-led", "catalog-led", "capability-led", "规格为主", "目录为主", "工厂实力"]) assert.ok(system.includes(direction), direction);
  assert.doesNotMatch(system, /服务端建议/);
  assert.match(system, /样式这一条不占 24 条普通 operation/);
  assert.match(system, /可改部件/);
});

test("full-site generation omits style directions, recommendations, and set_site_style output", async () => {
  const result = await ask(packDraft("industrial"), "资料生成整站", {
    type: "edit",
    summary: "生成整站",
    operations: [{ op: "set_site_style", direction: "spec-led", rules: [] }],
  });
  const system = lastMessage("system");
  assert.doesNotMatch(system, /spec-led|catalog-led|capability-led|规格为主|目录为主|工厂实力|服务端建议/);
  assert.equal(result.ok, true);
  if (result.ok && result.type === "edit") assert.equal(result.operations.some((operation) => operation.op === "set_site_style"), false);
});

test("an appearance edit keeps the direction menu without a material recommendation", async () => {
  await ask(packDraft("industrial"), "首屏更有分量", { type: "answer", text: "ok" }, true);
  const system = lastMessage("system");
  assert.match(system, /set_site_style/);
  for (const direction of ["spec-led", "catalog-led", "capability-led", "规格为主", "目录为主", "工厂实力"]) assert.ok(system.includes(direction), direction);
  assert.doesNotMatch(system, /服务端建议/);
});

test("looks still on their own overlay get no layout menu", async () => {
  await ask(structuredClone(defaultDraft), "看看现在的页面", { type: "answer", text: "ok" });
  const system = lastMessage("system");
  assert.equal(system.includes("set_block_variant"), false);
  assert.equal(system.includes("参数对比表"), false);
  assert.match(system, /最多 24 条/);
});

test("a refused layout request changes nothing and its reason is the summary", async () => {
  const result = await ask(packDraft("export"), "产品改成参数对比表", {
    type: "edit",
    summary: "已把产品改成参数对比表",
    operations: [setLayout("products", "compare")],
  });
  assert.equal(result.ok, true);
  if (!result.ok || result.type !== "edit") throw new Error("expected an edit");
  assert.deepEqual(result.operations, []);
  assert.equal(result.summary, "参数对比表要 2–4 个产品共有至少 3 项都有数值的同名参数；现在只共有 2 项（额定压力、主体材质），产品仍按产品卡片显示。");
  assert.ok(result.rejected.includes(result.summary));
});

test("accepted layouts go through; a refusal next to other changes is added to the model's summary", async () => {
  const materials = simulatedPacks.industrial.body;
  const products = packDraft("industrial").products;
  const empty = applySiteOperations(structuredClone(defaultDraft), [{ op: "set_visual_brief", briefId: "engineering-industrial" }], options).draft;
  const result = await ask(empty, materials, {
    type: "edit",
    summary: "按资料生成首页，产品用参数对比表",
    operations: [
      setLayout("products", "compare"),
      { op: "replace_products", products },
      setLayout("contact", "band"),
      { op: "set_text", target: "contact.email", value: simulatedPacks.industrial.email },
    ],
  });
  assert.equal(result.ok, true);
  if (!result.ok || result.type !== "edit") throw new Error("expected an edit");
  assert.deepEqual(result.operations.map((operation) => operation.op), ["set_block_variant", "replace_products", "set_text"]);
  assert.equal(result.summary, "按资料生成首页，产品用参数对比表。联系条要邮箱、电话、地址至少 2 项；现在只有邮箱，询盘仍按左右布局显示。");
});

test("a change that leaves the chosen layout short keeps the model's summary and says the layout went back", async () => {
  const compared = applySiteOperations(packDraft("industrial"), [setLayout("products", "compare") as SiteOperation], options).draft;
  const fewer = structuredClone(compared.products);
  fewer[1].specs = fewer[1].specs!.slice(0, 2);
  const result = await ask(compared, simulatedPacks.industrial.body, { type: "edit", summary: "精简行星减速机参数", operations: [{ op: "replace_products", products: fewer }] });
  assert.equal(result.ok, true);
  if (!result.ok || result.type !== "edit") throw new Error("expected an edit");
  assert.equal(result.operations.length, 1);
  assert.equal(result.summary, "精简行星减速机参数。参数对比表要 2–4 个产品共有至少 3 项都有数值的同名参数；现在只共有 2 项（速比范围、额定输出扭矩），产品改回产品卡片。");
});

test("the summary with reasons stays within 400 characters and keeps the reasons whole", async () => {
  const result = await ask(packDraft("export"), "产品改成参数对比表，首屏换大标题", {
    type: "edit",
    summary: "改首屏".repeat(150),
    operations: [setLayout("products", "compare"), setLayout("hero", "statement")],
  });
  assert.equal(result.ok, true);
  if (!result.ok || result.type !== "edit") throw new Error("expected an edit");
  assert.ok(result.summary.length <= 400, `summary has ${result.summary.length} characters`);
  assert.ok(result.summary.endsWith("产品仍按产品卡片显示。"));
  assert.deepEqual(result.operations, [setLayout("hero", "statement")]);
});

test("when an answer has more than 24 operations the retry asks for 24 at most", async () => {
  const op = { op: "set_text", target: "hero.title", value: { zh: "标题", en: "Title" } };
  requestBodies.length = 0;
  const result = await ask(packDraft("industrial"), "改首屏", [
    { type: "edit", summary: "改首屏", operations: Array.from({ length: 25 }, () => op) },
    { type: "edit", summary: "改首屏", operations: [op] },
  ]);
  assert.equal(result.ok, true);
  assert.equal(requestBodies.length, 2);
  assert.match(lastMessage("user"), /删减到 24 条以内/);
});

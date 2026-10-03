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

const { buildDraftPromptContext, isSiteStyleRequest, requestStructuredOperations } = await import("../lib/ai-provider.ts");

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
  for (const variant of ["bar", "columns", "badges", "short", "line", "cards", "side"]) assert.ok(menu.includes(`${variant}=`), `${variant} is available to the migrated look`);
  const user = lastMessage("user");
  assert.match(user, /"blockVariants":\{"products":"compare"\}/, "the model sees the layouts the draft shows now");
});

test("the product spec prompt distinguishes shared strings from bilingual values", async () => {
  await ask(packDraft("industrial"), "看看现在的产品参数", { type: "answer", text: "ok" });
  const system = lastMessage("system");
  assert.match(system, /纯数字、单位和型号值两种语言相同，只写字符串/);
  assert.match(system, /带中文或中文全角标点的值写成 \{zh,en\}/);
  assert.match(system, /底脚\/法兰/);
  assert.match(system, /Foot \/ flange/);
});

test("an appearance edit prompt exposes style directions without a material recommendation", async () => {
  await ask(packDraft("molding"), "按加工能力、产能、工艺和检测来做一个工厂实力网站", { type: "answer", text: "ok" }, true);
  const system = lastMessage("system");
  assert.match(system, /set_site_style/);
  for (const direction of ["spec-led", "catalog-led", "capability-led", "规格为主", "目录为主", "工厂实力"]) assert.ok(system.includes(direction), direction);
  assert.doesNotMatch(system, /服务端建议/);
  assert.match(system, /样式这一条不占 24 条普通 operation/);
  assert.match(system, /可改部件/);
});

test("only explicit appearance wording opens the site-style path", () => {
  for (const message of [
    "把首屏标题改成按图加工",
    "修改参数表说明",
    "补充工厂实力条目",
  ]) assert.equal(isSiteStyleRequest(message), false, message);
  for (const message of [
    "首屏更有分量",
    "整体更紧凑一点",
    "换成目录为主的版式",
  ]) assert.equal(isSiteStyleRequest(message), true, message);
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

test("section order instructions name the movable blocks and only allow explicit user requests", async () => {
  await ask(packDraft("industrial"), "看看现在的页面", { type: "answer", text: "ok" });
  const system = lastMessage("system");
  assert.match(system, /reorder_sections/);
  assert.match(system, /认证.*产品.*应用行业.*加工能力.*合作方式.*常见问题.*询盘/);
  assert.match(system, /只有用户明确提出顺序/);
  const reorder = system.slice(system.indexOf("10. reorder_sections"), system.indexOf("11. set_page_plan"));
  assert.doesNotMatch(reorder, /必须包含全部五项/);
  assert.doesNotMatch(reorder, /about.*features.*services.*products.*contact/);
});

test("compact prompt context keeps the effective block order without losing content", () => {
  const draft = packDraft("industrial");
  draft.sectionOrder = ["certifications", "products"];
  draft.products = Array.from({ length: 90 }, (_, index) => ({ ...draft.products[0], sku: `sku-${index}`, name: { zh: `产品${index}-${"很长的产品名称".repeat(8)}`, en: `Product ${index} ${"long product name ".repeat(8)}` } }));
  const context = buildDraftPromptContext(draft);
  assert.match(context, /sectionOrder/);
  assert.match(context, /certifications.*products/);
  assert.match(context, /sections/);
});

test("model reorder output drops unknown blocks, fills the rest, and explains the drop", async () => {
  const result = await ask(packDraft("industrial"), "把认证放到产品前面", {
    type: "edit",
    summary: "调整区块顺序",
    operations: [{ op: "reorder_sections", order: ["certifications", "unknown", "products"] }],
  });
  assert.equal(result.ok, true);
  if (result.ok && result.type === "edit") {
    const operation = result.operations.find((item) => item.op === "reorder_sections");
    assert.ok(operation && operation.order !== null);
    if (operation && operation.order !== null) {
      assert.equal((operation.order as string[]).includes("unknown"), false);
      assert.equal(operation.order.length, 9);
    }
    assert.match(result.summary, /忽略未知项：unknown/);
  }
});

test("catalog look exposes the block layout menu", async () => {
  await ask({ ...structuredClone(defaultDraft), templateId: "landwind" }, "看看现在的页面", { type: "answer", text: "ok" });
  const system = lastMessage("system");
  assert.match(system, /set_block_variant/);
  assert.match(system, /目录行/);
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
  assert.equal(result.summary, "将修改：产品布局、产品、询盘邮箱。联系条要邮箱、电话、地址至少 2 项；现在只有邮箱，询盘仍按左右布局显示。");
});

test("a change that leaves the chosen layout short keeps the model's summary and says the layout went back", async () => {
  const compared = applySiteOperations(packDraft("industrial"), [setLayout("products", "compare") as SiteOperation], options).draft;
  const fewer = structuredClone(compared.products);
  fewer[1].specs = fewer[1].specs!.slice(0, 2);
  const result = await ask(compared, simulatedPacks.industrial.body, { type: "edit", summary: "精简行星减速机参数", operations: [{ op: "replace_products", products: fewer }] });
  assert.equal(result.ok, true);
  if (!result.ok || result.type !== "edit") throw new Error("expected an edit");
  assert.equal(result.operations.length, 1);
  assert.equal(result.summary, "将修改：产品。参数对比表要 2–4 个产品共有至少 3 项都有数值的同名参数；现在只共有 2 项（速比范围、额定输出扭矩），产品改回产品卡片。");
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

test("T-073: the layout menu offers 型号索引表 with its 3-product need and the rule for choosing it", async () => {
  await ask(packDraft("molding"), "看看现在的页面", { type: "answer", text: "ok" });
  const system = lastMessage("system");
  assert.ok(system.includes("index=型号索引表（要至少 3 个产品）"), "the menu names the layout and what it needs");
  assert.match(system, /产品 3 个以上、访客主要按型号对照选型的目录型公司可以用 index/);
});

test("T-074: the layout menu offers 纵向流程 and says when to choose it", async () => {
  await ask(packDraft("molding"), "看看现在的页面", { type: "answer", text: "ok" });
  const system = lastMessage("system");
  assert.ok(system.includes("vertical=纵向流程"), "the menu names the layout");
  assert.match(system, /合作方式：每步说明较长、带周期或交付物时用 vertical，否则 steps/);
});

test("T-074: the layout menu offers 目录封面 and says when to choose it", async () => {
  await ask(packDraft("molding"), "看看现在的页面", { type: "answer", text: "ok" });
  const system = lastMessage("system");
  assert.ok(system.includes("cover=目录封面（要至少 2 个产品）"), "the menu names the layout and what it needs");
  assert.match(system, /产品系列本身是卖点（2 个以上系列、没有照片、访客先要看有哪几个系列）的目录型公司可以用 cover/);
});

test("T-074: the layout menu offers 证书状态表 and says when to choose it", async () => {
  await ask(packDraft("molding"), "看看现在的页面", { type: "answer", text: "ok" });
  const system = lastMessage("system");
  assert.ok(system.includes("table=证书状态表"), "the menu names the layout");
  assert.match(system, /认证：几张证书状态不同（有的已有、有的认证中）、访客要对照状态时用 table，否则 badges/);
});

test("T-080: the layout menu offers 左右条款 and says when to choose it", async () => {
  await ask(packDraft("molding"), "看看现在的页面", { type: "answer", text: "ok" });
  const system = lastMessage("system");
  assert.ok(system.includes("side=左右条款"), "the menu names the layout");
  assert.match(system, /商业条款：条款值多为整句话（带范围、周期、数量）或只有一条时用 side；条款值短、有 2–4 条时用 strip；否则 rows/);
  assert.ok(system.includes("strip=条款带"), "the menu names the strip layout too");
});

test("T-095: the layout menu offers 数量带 for equipment and says when to choose it", async () => {
  await ask(packDraft("molding"), "看看现在的页面", { type: "answer", text: "ok" });
  const system = lastMessage("system");
  assert.ok(system.includes("band=数量带"), "the menu names the layout");
  assert.match(system, /设备：有几样带数量的主力设备、其余只有名称（检测设备等）时用 band；设备 4 条以上、名称短、想紧凑列出时用 compact；否则 rows/);
  assert.ok(system.includes("compact=双栏清单"), "the menu names the compact layout too");
});

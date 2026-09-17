export const WORKSPACE_SITE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,79}$/i;
export const DEFAULT_WORKSPACE_SITE_ID = "demo";
export const MATERIALS_CHAT_LIMIT = 4000;

export type SimulatedPackId = "industrial" | "export";

export type SimulatedPack = {
  id: SimulatedPackId;
  siteId: string;
  label: string;
  nonce: string;
  companyName: string;
  industry: string;
  goal: string;
  heroTitle: string;
  heroSubtitle: string;
  heroCta: string;
  email: string;
  missingFacts: string[];
  extraPagesNote: string;
  body: string;
};

const MATERIALS_INSTRUCTION = [
  "【公司资料】以下内容明确标记为模拟测试资料，仅供内部 Demo。",
  "请根据资料改写当前草稿的公司名、行业、目标、首屏、关于、产品或服务说明和联系方式。",
  "只使用资料中的事实；资料没有写明的认证、产能、客户、评价、电话、地址写成「待补充」。",
  "不要更换模板或样子。当前只能在同一模板上显隐已有区块，不能另开独立页面；若资料要求额外页面，请在 summary 说明未支持，不要把整站静默当成只有首页已完成。",
].join("\n");

export const simulatedPacks: Record<SimulatedPackId, SimulatedPack> = {
  industrial: {
    id: "industrial",
    siteId: "p3-industrial",
    label: "模拟工业包",
    nonce: "P3I-NX7Q",
    companyName: "忻州重载减速机P3I",
    industry: "工业制造 / 重载减速机",
    goal: "获取批量规格询盘，不接零售散单",
    heroTitle: "按图加工重载减速机 P3I-NX7Q",
    heroSubtitle: "不提供现场安装；仅接受批量规格询盘。",
    heroCta: "获取减速机规格表",
    email: "inquiry@p3i-sim.test",
    missingFacts: ["认证", "产能数字", "客户名单", "电话", "地址"],
    extraPagesNote: "页面按首页、产品、联系规划，作为当前模板上的区块，不要求额外独立 URL。",
    body: [
      "资料性质：模拟。不可当作真实企业。核验记号：P3I-NX7Q。",
      "公司名：忻州重载减速机P3I",
      "行业：工业制造 / 重载减速机",
      "目标：获取批量规格询盘，不接零售散单",
      "首屏可用事实：按图加工重载减速机 P3I-NX7Q。",
      "首屏说明：不提供现场安装；仅接受批量规格询盘。",
      "主按钮：获取减速机规格表",
      "产品：直角减速机、行星减速机；按图加工。",
      "MOQ：20台。邮箱：inquiry@p3i-sim.test",
      "电话、地址、认证、产能数字、客户名单：资料未提供。",
      "页面：首页、产品、联系作为当前模板区块。不要求额外独立 URL。",
    ].join("\n"),
  },
  export: {
    id: "export",
    siteId: "p3-export",
    label: "模拟外贸包",
    nonce: "P3E-MW4R",
    companyName: "外高桥流体接头P3E",
    industry: "外贸 B2B / 不锈钢流体接头目录",
    goal: "面向 OEM 装配线索取样品册",
    heroTitle: "不锈钢快换接头目录 P3E-MW4R",
    heroSubtitle: "面向OEM装配线的接头规格与交期说明。",
    heroCta: "索取接头样品册",
    email: "catalog@p3e-sim.test",
    missingFacts: ["认证", "案例", "评价", "电话", "地址", "具体交期天数"],
    extraPagesNote: "希望另有独立认证页与资料下载页。若系统无法支持，必须说明，不得假装已经开通。",
    body: [
      "资料性质：模拟。不可当作真实企业。核验记号：P3E-MW4R。",
      "公司名：外高桥流体接头P3E",
      "行业：外贸 B2B / 不锈钢流体接头目录",
      "目标：面向 OEM 装配线索取样品册",
      "首屏可用事实：不锈钢快换接头目录 P3E-MW4R。",
      "首屏说明：面向OEM装配线的接头规格与交期说明。",
      "主按钮：索取接头样品册",
      "产品：快换接头、卡套接头。交期：批量询盘后确认，资料未给具体天数。",
      "邮箱：catalog@p3e-sim.test",
      "电话、地址、认证、案例、评价：资料未提供。",
      "页面要求：希望另有独立认证页与资料下载页。若系统无法支持，必须说明，不得假装已经开通。",
    ].join("\n"),
  },
};

export const simulatedPackList: SimulatedPack[] = [simulatedPacks.industrial, simulatedPacks.export];

export function parseWorkspaceSiteId(value: string | null | undefined): string {
  const site = value?.trim() ?? "";
  return WORKSPACE_SITE_ID_PATTERN.test(site) ? site : DEFAULT_WORKSPACE_SITE_ID;
}

export function wrapCompanyMaterials(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "";
  const message = `${MATERIALS_INSTRUCTION}\n\n${trimmed}`;
  if (message.length <= MATERIALS_CHAT_LIMIT) return message;
  const overhead = MATERIALS_INSTRUCTION.length + 2;
  const keep = Math.max(0, MATERIALS_CHAT_LIMIT - overhead - "…[truncated]".length);
  return `${MATERIALS_INSTRUCTION}\n\n${trimmed.slice(0, keep)}…[truncated]`;
}

export function buildMaterialsChatMessage(pack: SimulatedPack): string {
  return wrapCompanyMaterials(pack.body);
}

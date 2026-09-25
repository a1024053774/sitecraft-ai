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
  "产品规格参数、应用行业、加工能力/主设备、认证状态写入对应字段；参数名用中英双语，参数值与行业/能力正文必须能在资料中找到，找不到写成「待补充」，禁止编造数字。",
  "产品类别与加工方式必须分开：只有资料明确列出的产品进入商品清单；“按图加工”等是加工方式，不是第三个商品。资料给出完整清单时用 replace_products 保留确认的产品，不要用默认商品或空卡补齐。",
  "不要更换模板或样子。额外独立 URL 只有当前模板快照里已有对应 HTML 才会开通；否则在同一模板上切换声明区块。若资料要求的页面无法支持，必须在结果里说明，不要把整站静默当成只有首页已完成。",
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
    missingFacts: ["CE 证书编号", "产能数字", "客户名单", "电话", "地址"],
    extraPagesNote: "页面按首页、产品、联系规划，作为当前模板上的区块，不要求额外独立 URL。",
    body: [
      "资料性质：模拟。不可当作真实企业。核验记号：P3I-NX7Q。",
      "以下参数为模拟设定，仅供内部 Demo；未写出的事实仍为待补充。",
      "公司名：忻州重载减速机P3I",
      "行业：工业制造 / 重载减速机",
      "目标：获取批量规格询盘，不接零售散单",
      "首屏可用事实：按图加工重载减速机 P3I-NX7Q。",
      "首屏说明：不提供现场安装；仅接受批量规格询盘。",
      "主按钮：获取减速机规格表",
      "产品：直角减速机、行星减速机；加工方式：按图加工（不是第三个商品）。",
      "直角减速机规格参数（模拟设定）：速比范围 i=25–100；额定输出扭矩 8500 N·m；中心距 200 mm；输入转速 ≤1500 r/min；安装方式 底脚/法兰。",
      "行星减速机规格参数（模拟设定）：速比范围 i=4–100；额定输出扭矩 3200 N·m；机座号 F280；输入转速 ≤3000 r/min；安装方式 法兰；防护等级 IP65。",
      "应用行业（模拟设定）：矿山输送；冶金辊道；港口起重；水泥窑传动。",
      "加工能力/主设备（模拟设定）：滚齿与磨齿；箱体数控镗铣；动平衡与跑合试验；装配与出厂检验。",
      "认证状态（模拟设定）：ISO 9001 认证中；特种设备相关许可 待补充；CE 待补充。",
      "MOQ：20台。邮箱：inquiry@p3i-sim.test",
      "电话、地址、产能数字、客户名单：资料未提供。",
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
    missingFacts: ["FDA 证书编号", "案例", "评价", "电话", "地址", "具体交期天数"],
    extraPagesNote: "希望另有独立认证页与资料下载页。若系统无法支持，必须说明，不得假装已经开通。",
    body: [
      "资料性质：模拟。不可当作真实企业。核验记号：P3E-MW4R。",
      "以下参数为模拟设定，仅供内部 Demo；未写出的事实仍为待补充。",
      "公司名：外高桥流体接头P3E",
      "行业：外贸 B2B / 不锈钢流体接头目录",
      "目标：面向 OEM 装配线索取样品册",
      "首屏可用事实：不锈钢快换接头目录 P3E-MW4R。",
      "首屏说明：面向OEM装配线的接头规格与交期说明。",
      "主按钮：索取接头样品册",
      "产品：快换接头、卡套接头。",
      "快换接头规格参数（模拟设定）：通径 DN8–DN25；额定压力 2.5 MPa；主体材质 316L；密封材料 FKM；接口螺纹 G1/4–G1。",
      "卡套接头规格参数（模拟设定）：管外径 6–22 mm；额定压力 16 MPa；主体材质 316；卡套硬度 HRC 20–24；工作温度 −20–180 ℃。",
      "应用行业（模拟设定）：食品饮料灌装；制药洁净流体；化工取样；半导体超纯水辅助回路。",
      "加工能力/主设备（模拟设定）：数控车削；自动攻丝；气密试验台；钝化与清洁包装。",
      "认证状态（模拟设定）：ISO 9001 已有；材料可追溯报告 认证中；FDA 待补充。",
      "交期：批量询盘后确认，资料未给具体天数。邮箱：catalog@p3e-sim.test",
      "电话、地址、案例、评价：资料未提供。",
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

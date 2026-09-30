export const WORKSPACE_SITE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,79}$/i;
export const DEFAULT_WORKSPACE_SITE_ID = "demo";
export const MATERIALS_CHAT_LIMIT = 4000;

export type SimulatedPackId = "industrial" | "export" | "molding";

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
  "资料性质、模拟说明和核验记号只说明这份资料本身，不写进页面；区块说明写这家公司做什么，不写「资料中」「仅列」「资料给出」这类描述资料的话。",
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
      "公司名：忻州重载减速机P3I",
      "行业：工业制造 / 重载减速机",
      "目标：获取批量规格询盘，不接零售散单",
      "首屏可用事实：按图加工重载减速机 P3I-NX7Q。",
      "首屏说明：不提供现场安装；仅接受批量规格询盘。",
      "主按钮：获取减速机规格表",
      "产品：直角减速机、行星减速机；加工方式：按图加工（不是第三个商品）。",
      "直角减速机规格参数：速比范围 i=25–100；额定输出扭矩 8500 N·m；中心距 200 mm；输入转速 ≤1500 r/min；安装方式 底脚/法兰。",
      "行星减速机规格参数：速比范围 i=4–100；额定输出扭矩 3200 N·m；机座号 F280；输入转速 ≤3000 r/min；安装方式 法兰；防护等级 IP65。",
      "应用行业：矿山输送；冶金辊道；港口起重；水泥窑传动。",
      "加工能力/主设备：滚齿与磨齿；箱体数控镗铣；动平衡与跑合试验；装配与出厂检验。",
      "认证状态：ISO 9001 认证中；特种设备相关许可 待补充；CE 待补充。",
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
      "公司名：外高桥流体接头P3E",
      "行业：外贸 B2B / 不锈钢流体接头目录",
      "目标：面向 OEM 装配线索取样品册",
      "首屏可用事实：不锈钢快换接头目录 P3E-MW4R。",
      "首屏说明：面向OEM装配线的接头规格与交期说明。",
      "主按钮：索取接头样品册",
      "产品：快换接头、卡套接头。",
      "快换接头规格参数：通径 DN8–DN25；额定压力 2.5 MPa；主体材质 316L；密封材料 FKM；接口螺纹 G1/4–G1。",
      "卡套接头规格参数：管外径 6–22 mm；额定压力 16 MPa；主体材质 316；卡套硬度 HRC 20–24；工作温度 −20–180 ℃。",
      "应用行业：食品饮料灌装；制药洁净流体；化工取样；半导体超纯水辅助回路。",
      "加工能力/主设备：数控车削；自动攻丝；气密试验台；钝化与清洁包装。",
      "认证状态：ISO 9001 已有；材料可追溯报告 认证中；FDA 待补充。",
      "交期：批量询盘后确认，资料未给具体天数。邮箱：catalog@p3e-sim.test",
      "电话、地址、案例、评价：资料未提供。",
      "页面要求：希望另有独立认证页与资料下载页。若系统无法支持，必须说明，不得假装已经开通。",
    ].join("\n"),
  },
  // Thick pack: shows the page ceiling; only customer list and reviews stay as gaps.
  molding: {
    id: "molding",
    siteId: "p3-molding",
    label: "模拟注塑厚资料包",
    nonce: "P3T-JD5K",
    companyName: "宁海精密注塑模具P3T",
    industry: "注塑模具与精密注塑件 / 内销与外贸",
    goal: "获取模具开发与批量注塑询盘，内销与出口并行",
    heroTitle: "精密注塑模具与注塑件 P3T-JD5K",
    heroSubtitle: "模具设计、试模到批量注塑在同一厂区完成，内销与出口订单并行。",
    heroCta: "提交图纸获取报价",
    email: "rfq@p3t-sim.test",
    missingFacts: ["客户名单", "评价"],
    extraPagesNote: "页面按首页、产品、生产与质检、常见问题、联系规划；当前模板不支持的独立页面须说明。",
    body: [
      "资料性质：模拟。不可当作真实企业。核验记号：P3T-JD5K。",
      "公司名：宁海精密注塑模具P3T",
      "行业：注塑模具与精密注塑件 / 内销与外贸",
      "目标：获取模具开发与批量注塑询盘，内销与出口并行",
      "首屏可用事实：精密注塑模具与注塑件 P3T-JD5K。",
      "首屏说明：模具设计、试模到批量注塑在同一厂区完成，内销与出口订单并行。",
      "主按钮：提交图纸获取报价",
      "公司简介：宁海精密注塑模具P3T 从事塑料注塑模具设计制造与精密注塑件生产。工厂有模具车间和注塑车间，按图纸或样品开模，并承接批量注塑。内销与出口订单并行，出口以欧洲和东南亚为主。",
      "沿革：2008 年 建厂，从模具维修和小型模具起步；2013 年 注塑车间投产；2017 年 开始承接出口订单；2021 年 新增恒温精密模具车间；2024 年 建成三坐标与影像测量室。",
      "产品：多腔热流道模具；双色注塑模具；精密结构注塑件；透明光学注塑件；金属嵌件注塑件。",
      "多腔热流道模具规格参数：型腔数 1–32 腔；模具尺寸 最大 900×1200 mm；模具钢材 S136/H13/NAK80；热流道 开放式/针阀式；成型周期 12–40 s；模具寿命 50–100 万模次；型腔公差 ±0.01 mm。",
      "双色注塑模具规格参数：成型方式 旋转式/机械手转移；适配机型 双色注塑机 120–650 t；材料组合 PC+TPU/PP+TPE/ABS+PC；包胶厚度 ≥0.8 mm；配合公差 ±0.02 mm；模具寿命 30–50 万模次。",
      "精密结构注塑件规格参数：适用材料 PA66+GF/POM/PBT/PC；单件重量 0.5–350 g；尺寸公差 ±0.02 mm；平面度 ≤0.05 mm；表面处理 咬花/喷砂/高光；成型机台 90–800 t。",
      "透明光学注塑件规格参数：适用材料 PMMA/PC/COC；透光率 ≥90%（PMMA 2 mm 厚）；壁厚 0.8–6 mm；表面粗糙度 Ra ≤0.02 μm；成型环境 十万级洁净车间；尺寸公差 ±0.03 mm。",
      "金属嵌件注塑件规格参数：嵌件类型 铜螺母/冲压端子/不锈钢轴；嵌件放置 机械手/人工；适用材料 PBT+GF/PA6/LCP；定位精度 ±0.05 mm；尺寸公差 ±0.03 mm；成型机台 立式 55–250 t。",
      "产能：模具年产约 180 套；注塑机 42 台（90–800 t），月注塑能力约 600 万件。",
      "加工能力/主设备：高速 CNC 加工中心 12 台；精密慢走丝线切割 6 台；镜面电火花 8 台；精密平面磨床 4 台；注塑机 42 台（90–800 t）；双色注塑机 3 台。",
      "检测设备：三坐标测量机；二次元影像测量仪；色差仪；拉力试验机；恒温恒湿箱。",
      "质检流程：来料检验（树脂批次与嵌件尺寸）；试模后首件全尺寸检测；过程巡检每 2 小时抽检；外观与功能全检；出货抽检并附检测报告。",
      "应用行业：家电外壳与结构件；汽车内饰件与连接器；医疗器械耗材外壳；照明透镜与灯罩；电动工具壳体。",
      "认证状态：ISO 9001 已有；ISO 14001 已有；IATF 16949 认证中。",
      "问：没有图纸只有样品能开模吗？答：可以，先做 3D 扫描和逆向建模，图纸确认后再开模。",
      "问：开模周期多久？答：单腔模具约 25–35 天，多腔热流道和双色模具约 40–55 天，从图纸确认开始计。",
      "问：试模样品怎么提供？答：T1 试模后 3 天内寄出样品和全尺寸检测报告，每套模具含 3 次试模。",
      "问：模具归谁所有？答：模具费付清后模具归买方所有，可存放在本厂用于批量生产。",
      "问：出口订单用什么贸易条款？答：常用 FOB 宁波和 EXW，也可按订单约定 CIF。",
      "MOQ：注塑件 5000 件起；模具单套起接。",
      "交期：模具 25–55 天；批量注塑件在模具确认后 15–20 天。",
      "邮箱：rfq@p3t-sim.test",
      "电话：0000-0000000",
      "地址：示例省示例市模具园区 0 号",
      "客户名单、评价：资料未提供。",
      "页面：首页、产品、生产与质检、常见问题、联系；当前模板不支持的独立页面须说明，不得假装已经开通。",
    ].join("\n"),
  },
};

export const simulatedPackList: SimulatedPack[] = [simulatedPacks.industrial, simulatedPacks.export, simulatedPacks.molding];

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

// The generation instruction wrapped around pasted materials is for the model only; the chat shows
// the user what they pasted.
export function stripMaterialsInstruction(message: string): string {
  const prefix = `${MATERIALS_INSTRUCTION}\n\n`;
  return message.startsWith(prefix) ? message.slice(prefix.length) : message;
}

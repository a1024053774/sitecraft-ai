// Test fixture: deterministic engineering-look drafts for the three simulated packs (P3I, P3E,
// molding), written the way the model writes them from the materials (categories, bilingual spec
// names, single-language spec values, gaps as 待补充). Runtime code must not import this file.
import { defaultDraft, type Product, type SiteDraft } from "../../lib/site-document.ts";
import { applySiteOperations, type SiteOperation } from "../../lib/site-operations.ts";
import { simulatedPacks } from "../../lib/simulated-packs.ts";

const gap = { zh: "待补充", en: "To be provided" };
const spec = (zh: string, en: string, value: string | [string, string]) => ({
  name: { zh, en },
  value: Array.isArray(value) ? { zh: value[0], en: value[1] } : value,
});
const product = (sku: string, name: [string, string], category: [string, string] | null, summary: [string, string], specs: Product["specs"]): Product => ({
  sku,
  name: { zh: name[0], en: name[1] },
  summary: { zh: summary[0], en: summary[1] },
  category: category ? { zh: category[0], en: category[1] } : "",
  status: "published",
  imageColor: "#e6e1cf",
  specs,
});

const items = (list: Array<[string, string, string, string, string]>) => list.map(([id, zh, en, bodyZh, bodyEn]) => ({ id, title: { zh, en }, body: { zh: bodyZh, en: bodyEn } }));
const certs = (list: Array<[string, string, string, "已有" | "认证中" | "待补充"]>) => list.map(([id, zh, en, status]) => ({ id, title: { zh, en }, body: gap, status }));

export type PackDraftId = "industrial" | "export" | "molding";

const packs: Record<PackDraftId, { operations: SiteOperation[] }> = {
  industrial: {
    operations: [
      { op: "set_text", target: "hero.title", value: { zh: "按图加工重载减速机", en: "Heavy-duty gearboxes machined to drawing" } },
      { op: "set_text", target: "hero.subtitle", value: { zh: "不提供现场安装；仅接受批量规格询盘。", en: "No on-site installation; bulk specification inquiries only." } },
      { op: "set_text", target: "hero.cta", value: { zh: "获取减速机规格表", en: "Get the gearbox spec sheet" } },
      { op: "set_text", target: "industry", value: { zh: "工业制造 / 重载减速机", en: "Industrial manufacturing / Heavy-duty gearboxes" } },
      { op: "set_text", target: "goal", value: "获取批量规格询盘，不接零售散单" },
      { op: "set_text", target: "contact.email", value: simulatedPacks.industrial.email },
      {
        op: "replace_products",
        products: [
          product("right-angle-gearbox", ["直角减速机", "Right-angle gearbox"], ["重载减速机", "Heavy-duty gearboxes"], ["按图加工的直角减速机，底脚或法兰安装。", "Right-angle gearbox machined to drawing, foot or flange mounted."], [
            spec("速比范围", "Ratio range", "i=25–100"),
            spec("额定输出扭矩", "Rated output torque", "8500 N·m"),
            spec("中心距", "Center distance", "200 mm"),
            spec("输入转速", "Input speed", "≤1500 r/min"),
            spec("安装方式", "Mounting", ["底脚/法兰", "Foot / flange"]),
          ]),
          product("planetary-gearbox", ["行星减速机", "Planetary gearbox"], ["重载减速机", "Heavy-duty gearboxes"], ["法兰安装的行星减速机，防护等级 IP65。", "Flange-mounted planetary gearbox, IP65."], [
            spec("速比范围", "Ratio range", "i=4–100"),
            spec("额定输出扭矩", "Rated output torque", "3200 N·m"),
            spec("机座号", "Frame size", "F280"),
            spec("输入转速", "Input speed", "≤3000 r/min"),
            spec("安装方式", "Mounting", ["法兰", "Flange"]),
            spec("防护等级", "Protection class", "IP65"),
          ]),
        ],
      },
      { op: "set_catalog_section", section: "industries", value: { title: { zh: "应用行业", en: "Industries" }, intro: gap, items: items([
        ["mining", "矿山输送", "Mining conveyors", "重载减速机用于矿山输送。", "Heavy-duty gearboxes for mining conveyors."],
        ["metallurgy", "冶金辊道", "Metallurgy rollers", "重载减速机用于冶金辊道。", "Heavy-duty gearboxes for metallurgy rollers."],
        ["port", "港口起重", "Port cranes", "重载减速机用于港口起重。", "Heavy-duty gearboxes for port cranes."],
        ["cement", "水泥窑传动", "Cement kiln drives", "重载减速机用于水泥窑传动。", "Heavy-duty gearboxes for cement kiln drives."],
      ]) } },
      { op: "set_catalog_section", section: "capabilities", value: { title: { zh: "加工能力", en: "Capabilities" }, intro: gap, items: items([
        ["hobbing", "滚齿与磨齿", "Hobbing and grinding", "滚齿与磨齿。", "Hobbing and grinding."],
        ["boring", "箱体数控镗铣", "CNC boring and milling", "箱体数控镗铣。", "CNC boring and milling."],
        ["run-in", "动平衡与跑合试验", "Balancing and run-in tests", "动平衡与跑合试验。", "Balancing and run-in tests."],
        ["inspection", "装配与出厂检验", "Assembly and final inspection", "装配与出厂检验。", "Assembly and final inspection."],
      ]) } },
      { op: "set_catalog_section", section: "certifications", value: { title: { zh: "认证状态", en: "Certifications" }, intro: gap, items: certs([
        ["iso-9001", "ISO 9001", "ISO 9001", "认证中"],
        ["special-equipment", "特种设备相关许可", "Special equipment permit", "待补充"],
        ["ce", "CE", "CE", "待补充"],
      ]) } },
    ],
  },
  export: {
    operations: [
      { op: "set_text", target: "hero.title", value: { zh: "不锈钢快换接头目录", en: "Stainless steel quick-connect fittings catalog" } },
      { op: "set_text", target: "hero.subtitle", value: { zh: "面向OEM装配线的接头规格与交期说明。", en: "Fitting specifications and lead times for OEM assembly lines." } },
      { op: "set_text", target: "hero.cta", value: { zh: "索取接头样品册", en: "Request the fittings catalog" } },
      { op: "set_text", target: "industry", value: { zh: "外贸 B2B / 不锈钢流体接头目录", en: "Export B2B / Stainless fluid fittings catalog" } },
      { op: "set_text", target: "goal", value: "面向 OEM 装配线索取样品册" },
      { op: "set_text", target: "contact.email", value: simulatedPacks.export.email },
      {
        op: "replace_products",
        products: [
          product("quick-coupling", ["快换接头", "Quick coupling"], ["流体接头", "Fluid fittings"], ["不锈钢快换接头，批量询盘后确认交期。", "Stainless quick coupling; lead time confirmed per bulk inquiry."], [
            spec("通径", "Nominal bore", "DN8–DN25"),
            spec("额定压力", "Rated pressure", "2.5 MPa"),
            spec("主体材质", "Body material", "316L"),
            spec("密封材料", "Seal material", "FKM"),
            spec("接口螺纹", "Port thread", "G1/4–G1"),
          ]),
          product("ferrule-fitting", ["卡套接头", "Ferrule fitting"], ["流体接头", "Fluid fittings"], ["不锈钢卡套接头。", "Stainless ferrule fitting."], [
            spec("管外径", "Tube OD", "6–22 mm"),
            spec("额定压力", "Rated pressure", "16 MPa"),
            spec("主体材质", "Body material", "316"),
            spec("卡套硬度", "Ferrule hardness", "HRC 20–24"),
            spec("工作温度", "Working temperature", "−20–180 ℃"),
          ]),
        ],
      },
      { op: "set_catalog_section", section: "industries", value: { title: { zh: "应用行业", en: "Industries" }, intro: gap, items: items([
        ["food", "食品饮料灌装", "Food and beverage filling", "洁净流体接头用于食品饮料灌装。", "Fluid fittings for food and beverage filling."],
        ["pharma", "制药洁净流体", "Pharmaceutical clean fluids", "洁净流体接头用于制药回路。", "Fluid fittings for pharmaceutical circuits."],
        ["chemical", "化工取样", "Chemical sampling", "流体接头用于化工取样。", "Fluid fittings for chemical sampling."],
        ["semiconductor", "半导体超纯水辅助回路", "Semiconductor ultrapure water", "流体接头用于半导体超纯水辅助回路。", "Fluid fittings for semiconductor ultrapure water."],
      ]) } },
      { op: "set_catalog_section", section: "capabilities", value: { title: { zh: "加工能力", en: "Capabilities" }, intro: gap, items: items([
        ["turning", "数控车削", "CNC turning", "数控车削。", "CNC turning."],
        ["tapping", "自动攻丝", "Automatic tapping", "自动攻丝。", "Automatic tapping."],
        ["leak", "气密试验台", "Leak test bench", "气密试验台。", "Leak test bench."],
        ["passivation", "钝化与清洁包装", "Passivation and clean packaging", "钝化与清洁包装。", "Passivation and clean packaging."],
      ]) } },
      { op: "set_catalog_section", section: "certifications", value: { title: { zh: "认证状态", en: "Certifications" }, intro: gap, items: certs([
        ["iso-9001", "ISO 9001", "ISO 9001", "已有"],
        ["traceability", "材料可追溯报告", "Material traceability report", "认证中"],
        ["fda", "FDA", "FDA", "待补充"],
      ]) } },
    ],
  },
  molding: {
    operations: [
      { op: "set_text", target: "hero.title", value: { zh: "精密注塑模具与注塑件", en: "Precision injection molds and molded parts" } },
      { op: "set_text", target: "hero.subtitle", value: { zh: "模具设计、试模到批量注塑在同一厂区完成，内销与出口订单并行。", en: "Mold design, trials and volume molding under one roof, for domestic and export orders." } },
      { op: "set_text", target: "hero.cta", value: { zh: "提交图纸获取报价", en: "Send drawings for a quote" } },
      { op: "set_text", target: "industry", value: { zh: "注塑模具与精密注塑件 / 内销与外贸", en: "Injection molds and precision molded parts / Domestic and export" } },
      { op: "set_text", target: "goal", value: "获取模具开发与批量注塑询盘，内销与出口并行" },
      { op: "set_text", target: "contact.email", value: simulatedPacks.molding.email },
      {
        op: "replace_products",
        products: [
          product("hot-runner-mold", ["多腔热流道模具", "Multi-cavity hot runner mold"], ["注塑模具", "Injection molds"], ["多腔热流道模具，开放式或针阀式热流道。", "Multi-cavity hot runner molds, open or valve gate."], [
            spec("型腔数", "Cavities", ["1–32 腔", "1–32 cavities"]),
            spec("模具尺寸", "Mold size", ["最大 900×1200 mm", "Up to 900×1200 mm"]),
            spec("模具钢材", "Mold steel", "S136/H13/NAK80"),
            spec("热流道", "Hot runner", ["开放式/针阀式", "Open / valve gate"]),
            spec("成型周期", "Cycle time", "12–40 s"),
            spec("模具寿命", "Mold life", ["50–100 万模次", "500,000–1,000,000 cycles"]),
            spec("型腔公差", "Cavity tolerance", "±0.01 mm"),
          ]),
          product("two-shot-mold", ["双色注塑模具", "Two-shot injection mold"], ["注塑模具", "Injection molds"], ["旋转式或机械手转移的双色模具。", "Rotary or robot-transfer two-shot molds."], [
            spec("成型方式", "Molding method", ["旋转式/机械手转移", "Rotary / robot transfer"]),
            spec("适配机型", "Machines", ["双色注塑机 120–650 t", "Two-shot injection machine 120–650 t"]),
            spec("材料组合", "Material pairs", "PC+TPU/PP+TPE/ABS+PC"),
            spec("包胶厚度", "Overmold thickness", "≥0.8 mm"),
            spec("配合公差", "Fit tolerance", "±0.02 mm"),
            spec("模具寿命", "Mold life", ["30–50 万模次", "300,000–500,000 cycles"]),
          ]),
          product("precision-structural-parts", ["精密结构注塑件", "Precision structural molded parts"], ["精密注塑件", "Precision molded parts"], ["结构件批量注塑。", "Structural parts in volume."], [
            spec("适用材料", "Materials", "PA66+GF/POM/PBT/PC"),
            spec("单件重量", "Part weight", "0.5–350 g"),
            spec("尺寸公差", "Tolerance", "±0.02 mm"),
            spec("平面度", "Flatness", "≤0.05 mm"),
            spec("表面处理", "Surface finish", ["咬花/喷砂/高光", "Texturing / blasting / high gloss"]),
            spec("成型机台", "Molding machines", "90–800 t"),
          ]),
          product("optical-parts", ["透明光学注塑件", "Transparent optical molded parts"], ["精密注塑件", "Precision molded parts"], ["洁净车间成型的透明件。", "Transparent parts molded in a clean room."], [
            spec("适用材料", "Materials", "PMMA/PC/COC"),
            spec("透光率", "Light transmission", ["≥90%（PMMA 2 mm 厚）", "≥90% (PMMA, 2 mm thick)"]),
            spec("壁厚", "Wall thickness", "0.8–6 mm"),
            spec("表面粗糙度", "Surface roughness", "Ra ≤0.02 μm"),
            spec("成型环境", "Molding environment", ["十万级洁净车间", "Class 100,000 clean room"]),
            spec("尺寸公差", "Tolerance", "±0.03 mm"),
          ]),
          product("insert-molded-parts", ["金属嵌件注塑件", "Metal insert molded parts"], ["精密注塑件", "Precision molded parts"], ["铜螺母、端子等嵌件注塑。", "Molding over brass nuts, terminals and shafts."], [
            spec("嵌件类型", "Insert types", ["铜螺母/冲压端子/不锈钢轴", "Brass nuts / stamped terminals / stainless steel shafts"]),
            spec("嵌件放置", "Insert placement", ["机械手/人工", "Robot / manual"]),
            spec("适用材料", "Materials", "PBT+GF/PA6/LCP"),
            spec("定位精度", "Positioning accuracy", "±0.05 mm"),
            spec("尺寸公差", "Tolerance", "±0.03 mm"),
            spec("成型机台", "Molding machines", ["立式 55–250 t", "Vertical 55–250 t"]),
          ]),
        ],
      },
      { op: "set_catalog_section", section: "industries", value: { title: { zh: "应用行业", en: "Industries" }, intro: gap, items: items([
        ["appliance", "家电外壳与结构件", "Appliance housings and structures", "家电外壳与结构件。", "Appliance housings and structures."],
        ["automotive", "汽车内饰件与连接器", "Automotive interiors and connectors", "汽车内饰件与连接器。", "Automotive interiors and connectors."],
        ["medical", "医疗器械耗材外壳", "Medical consumable housings", "医疗器械耗材外壳。", "Medical consumable housings."],
        ["lighting", "照明透镜与灯罩", "Lighting lenses and covers", "照明透镜与灯罩。", "Lighting lenses and covers."],
        ["tools", "电动工具壳体", "Power tool housings", "电动工具壳体。", "Power tool housings."],
      ]) } },
      { op: "set_catalog_section", section: "capabilities", value: { title: { zh: "加工能力", en: "Capabilities" }, intro: gap, items: items([
        ["cnc", "高速 CNC 加工中心", "High-speed CNC machining", "高速 CNC 加工中心 12 台。", "12 high-speed CNC machining centers."],
        ["wire", "精密慢走丝线切割", "Precision wire EDM", "精密慢走丝线切割 6 台。", "6 precision wire EDM machines."],
        ["edm", "镜面电火花", "Mirror EDM", "镜面电火花 8 台。", "8 mirror EDM machines."],
        ["grinding", "精密平面磨床", "Precision surface grinding", "精密平面磨床 4 台。", "4 precision surface grinders."],
        ["injection", "注塑机", "Injection machines", "注塑机 42 台（90–800 t）。", "42 injection machines (90–800 t)."],
        ["two-shot", "双色注塑机", "Two-shot injection machines", "双色注塑机 3 台。", "3 two-shot injection machines."],
      ]) } },
      { op: "set_catalog_section", section: "certifications", value: { title: { zh: "认证状态", en: "Certifications" }, intro: gap, items: certs([
        ["iso-9001", "ISO 9001", "ISO 9001", "已有"],
        ["iso-14001", "ISO 14001", "ISO 14001", "已有"],
        ["iatf", "IATF 16949", "IATF 16949", "认证中"],
      ]) } },
    ],
  },
};

/** The pack as an engineering-look draft. `companyName` defaults to the pack's (Chinese) name. */
export function packDraft(id: PackDraftId, options: { companyName?: string } = {}): SiteDraft {
  const operations: SiteOperation[] = [
    { op: "set_visual_brief", briefId: "engineering-industrial" },
    { op: "set_text", target: "companyName", value: options.companyName ?? simulatedPacks[id].companyName },
    ...packs[id].operations,
  ];
  const result = applySiteOperations(structuredClone(defaultDraft), operations, {
    templateIds: new Set(["forge", "screwfast", "landwind", "tailwind-landing"]),
    lastChange: `pack-draft-${id}`,
  });
  return result.draft;
}

/** A draft with one layout picked; `blockVariants` is read by the preview bridge. */
export function withLayouts(draft: SiteDraft, blockVariants: Record<string, string>) {
  return { ...structuredClone(draft), blockVariants: { ...blockVariants } } as SiteDraft & { blockVariants: Record<string, string> };
}

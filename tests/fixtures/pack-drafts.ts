// Test fixture: deterministic engineering-look drafts for the three simulated packs (P3I, P3E,
// molding), written the way the model writes them from the materials (categories, bilingual spec
// names, single-language spec values, gaps as 待补充). Runtime code must not import this file.
import { defaultDraft, type Product, type SiteDraft } from "../../lib/site-document.ts";
import { applySiteOperations, type SiteOperation } from "../../lib/site-operations.ts";
import { simulatedPacks } from "../../lib/simulated-packs.ts";

const gap = { zh: "待补充", en: "To be provided" };
const spec = (zh: string, en: string, value: string) => ({ name: { zh, en }, value });
const product = (sku: string, name: [string, string], category: [string, string] | null, summary: [string, string], specs: Product["specs"]): Product => ({
  sku,
  name: { zh: name[0], en: name[1] },
  summary: { zh: summary[0], en: summary[1] },
  category: category ? { zh: category[0], en: category[1] } : "",
  status: "published",
  imageColor: "#e6e1cf",
  specs,
});

const items = (list: Array<[string, string, string]>) => list.map(([id, zh, en]) => ({ id, title: { zh, en }, body: gap }));

export type PackDraftId = "industrial" | "export" | "molding";

const packs: Record<PackDraftId, { operations: SiteOperation[] }> = {
  industrial: {
    operations: [
      { op: "set_text", target: "hero.title", value: { zh: "按图加工重载减速机", en: "Heavy-duty gearboxes machined to drawing" } },
      { op: "set_text", target: "hero.subtitle", value: { zh: "不提供现场安装；仅接受批量规格询盘。", en: "No on-site installation; bulk specification inquiries only." } },
      { op: "set_text", target: "hero.cta", value: { zh: "获取减速机规格表", en: "Get the gearbox spec sheet" } },
      { op: "set_text", target: "industry", value: { zh: "工业制造 / 重载减速机", en: "Industrial manufacturing / Heavy-duty gearboxes" } },
      { op: "set_text", target: "contact.email", value: simulatedPacks.industrial.email },
      {
        op: "replace_products",
        products: [
          product("right-angle-gearbox", ["直角减速机", "Right-angle gearbox"], ["重载减速机", "Heavy-duty gearboxes"], ["按图加工的直角减速机，底脚或法兰安装。", "Right-angle gearbox machined to drawing, foot or flange mounted."], [
            spec("速比范围", "Ratio range", "i=25–100"),
            spec("额定输出扭矩", "Rated output torque", "8500 N·m"),
            spec("中心距", "Center distance", "200 mm"),
            spec("输入转速", "Input speed", "≤1500 r/min"),
            spec("安装方式", "Mounting", "底脚/法兰"),
          ]),
          product("planetary-gearbox", ["行星减速机", "Planetary gearbox"], ["重载减速机", "Heavy-duty gearboxes"], ["法兰安装的行星减速机，防护等级 IP65。", "Flange-mounted planetary gearbox, IP65."], [
            spec("速比范围", "Ratio range", "i=4–100"),
            spec("额定输出扭矩", "Rated output torque", "3200 N·m"),
            spec("机座号", "Frame size", "F280"),
            spec("输入转速", "Input speed", "≤3000 r/min"),
            spec("安装方式", "Mounting", "法兰"),
            spec("防护等级", "Protection class", "IP65"),
          ]),
        ],
      },
      { op: "set_catalog_section", section: "industries", value: { title: { zh: "应用行业", en: "Industries" }, intro: gap, items: items([["mining", "矿山输送", "Mining conveyors"], ["port", "港口起重", "Port cranes"]]) } },
    ],
  },
  export: {
    operations: [
      { op: "set_text", target: "hero.title", value: { zh: "不锈钢快换接头目录", en: "Stainless steel quick-connect fittings catalog" } },
      { op: "set_text", target: "hero.subtitle", value: { zh: "面向OEM装配线的接头规格与交期说明。", en: "Fitting specifications and lead times for OEM assembly lines." } },
      { op: "set_text", target: "hero.cta", value: { zh: "索取接头样品册", en: "Request the fittings catalog" } },
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
    ],
  },
  molding: {
    operations: [
      { op: "set_text", target: "hero.title", value: { zh: "精密注塑模具与注塑件", en: "Precision injection molds and molded parts" } },
      { op: "set_text", target: "hero.subtitle", value: { zh: "模具设计、试模到批量注塑在同一厂区完成，内销与出口订单并行。", en: "Mold design, trials and volume molding under one roof, for domestic and export orders." } },
      { op: "set_text", target: "hero.cta", value: { zh: "提交图纸获取报价", en: "Send drawings for a quote" } },
      { op: "set_text", target: "contact.email", value: simulatedPacks.molding.email },
      {
        op: "replace_products",
        products: [
          product("hot-runner-mold", ["多腔热流道模具", "Multi-cavity hot runner mold"], ["注塑模具", "Injection molds"], ["多腔热流道模具，开放式或针阀式热流道。", "Multi-cavity hot runner molds, open or valve gate."], [
            spec("型腔数", "Cavities", "1–32 腔"),
            spec("模具尺寸", "Mold size", "最大 900×1200 mm"),
            spec("模具钢材", "Mold steel", "S136/H13/NAK80"),
            spec("成型周期", "Cycle time", "12–40 s"),
          ]),
          product("two-shot-mold", ["双色注塑模具", "Two-shot injection mold"], ["注塑模具", "Injection molds"], ["旋转式或机械手转移的双色模具。", "Rotary or robot-transfer two-shot molds."], [
            spec("成型方式", "Molding method", "旋转式/机械手转移"),
            spec("适配机型", "Machines", "双色注塑机 120–650 t"),
            spec("材料组合", "Material pairs", "PC+TPU/PP+TPE/ABS+PC"),
            spec("包胶厚度", "Overmold thickness", "≥0.8 mm"),
          ]),
          product("precision-structural-parts", ["精密结构注塑件", "Precision structural molded parts"], ["精密注塑件", "Precision molded parts"], ["结构件批量注塑。", "Structural parts in volume."], [
            spec("适用材料", "Materials", "PA66+GF/POM/PBT/PC"),
            spec("单件重量", "Part weight", "0.5–350 g"),
            spec("尺寸公差", "Tolerance", "±0.02 mm"),
            spec("表面处理", "Surface finish", "待补充"),
          ]),
          product("optical-parts", ["透明光学注塑件", "Transparent optical molded parts"], ["精密注塑件", "Precision molded parts"], ["洁净车间成型的透明件。", "Transparent parts molded in a clean room."], [
            spec("适用材料", "Materials", "PMMA/PC/COC"),
            spec("透光率", "Light transmission", "≥90%（PMMA 2 mm 厚）"),
            spec("壁厚", "Wall thickness", "0.8–6 mm"),
            spec("成型环境", "Molding environment", "十万级洁净车间"),
          ]),
          product("insert-molded-parts", ["金属嵌件注塑件", "Metal insert molded parts"], ["精密注塑件", "Precision molded parts"], ["铜螺母、端子等嵌件注塑。", "Molding over brass nuts, terminals and shafts."], [
            spec("嵌件类型", "Insert types", "铜螺母/冲压端子/不锈钢轴"),
            spec("适用材料", "Materials", "PBT+GF/PA6/LCP"),
            spec("定位精度", "Positioning accuracy", "±0.05 mm"),
          ]),
        ],
      },
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

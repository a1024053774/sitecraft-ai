import { z } from 'zod';

type StylePreview = { status: 'pending' } | { status: 'ready'; src: string; siteId: string; versionId: string; revision: number; source: string; license: string };
export type CodeStyle = { label: string; description: string; skill: string; preview: StylePreview };
// The only registration point: UI, preference validation and model contracts
// derive their choices here. Provenance is kept out of model instructions.
export const codeStyles = {
  precision: { label: '精密工程', description: '浅底细线，参数与网格清楚对齐', skill: 'site-code-precision/SKILL.md',
    preview: { status: 'ready', src: '/style-previews/precision.webp', siteId: '7e07b43d-5476-4db7-9d8e-d38d3d723b86', versionId: 'dfdbcbfc-bce7-4006-a157-f13444b39543', revision: 1,
      source: 't130/round-2026-10-09T10-14-09-315Z/private/case-1/home-fold-1440.png', license: '/style-previews/SOURCE.md' } },
  documentary: { label: '现场实拍', description: '照片与大字，突出现场和加工能力', skill: 'site-code-documentary/SKILL.md',
    preview: { status: 'ready', src: '/style-previews/documentary.webp', siteId: '478da526-cf67-4c74-851b-8cd320bb1ef8', versionId: 'bef0d4df-2bfc-4740-890e-f5cd19496adc', revision: 1,
      source: 't130/round-2026-10-09T10-14-09-315Z/private/case-2/home-fold-1440.png', license: '/style-previews/SOURCE.md' } },
  editorial: { label: '品牌画册', description: '暖白纸色、衬线标题，像翻阅产品画册', skill: 'site-code-editorial/SKILL.md',
    preview: { status: 'ready', src: '/style-previews/editorial.webp', siteId: 'ed6bfbe4-8141-4edb-86f9-d65a91f67eff', versionId: 'fecaa36c-2aaf-44ee-bdc0-8e38102f84b0', revision: 1,
      source: 't153/approved/real-2026-10-11T03-58/private/default/home-fold-1440.png', license: '/style-previews/SOURCE.md' } },
  neighborly: { label: '邻里日常', description: '柔和色块、黑体招牌，像店内价目与告示', skill: 'site-code-neighborly/SKILL.md',
    preview: { status: 'ready', src: '/style-previews/neighborly.webp', siteId: '20d7d9ae-8272-4880-81cd-eb2aec872557', versionId: '7be34b12-ec78-4d75-bcd5-c12a4b7e210d', revision: 1,
      source: 't159/authorized-20261014T043816Z/eval/private/case-1/home-fold-1440.png', license: '/style-previews/SOURCE.md' } },
  darkroom: { label: '暗房陈列', description: '深炭底色与微光分区，突出展品、空间与作品细节', skill: 'site-code-darkroom/SKILL.md',
    preview: { status: 'ready', src: '/style-previews/darkroom.webp', siteId: 'd48fdf27-7913-4331-8f98-6854929007ae', versionId: 'f61cd84a-66d4-42c8-b05f-1b7e7a6b579f', revision: 1,
      source: 't240/eval-4sites-r2/eval/private/case-3/home-fold-1440.png', license: '/style-previews/SOURCE.md' } },
  indexgrid: { label: '瑞士索引', description: '外露细黑网格与等宽编号，像严谨的分类检索表', skill: 'site-code-indexgrid/SKILL.md',
    preview: { status: 'pending' } },
  craftposter: { label: '风物招牌', description: '牌匾框线、宋体大字与自然纸色，像老字号与手作工坊', skill: 'site-code-craftposter/SKILL.md',
    preview: { status: 'ready', src: '/style-previews/craftposter.webp', siteId: '8c3225b7-be4b-4840-8510-35bd956177bd', versionId: '3c0a3f25-ae61-40eb-9e17-5e98327ad46d', revision: 1,
      source: 't235/eval-3sites-r3/eval/private/case-2/home-fold-1440.png', license: '/style-previews/SOURCE.md' } },
} satisfies Record<string, CodeStyle>;
export type CodeStyleId = keyof typeof codeStyles;
export const codeStyleIds = Object.keys(codeStyles) as [CodeStyleId, ...CodeStyleId[]];
export const readyCodeStyleIds = codeStyleIds.filter(id => codeStyles[id].preview.status === 'ready') as [CodeStyleId, ...CodeStyleId[]];
export const codeStyleSchema = z.enum(codeStyleIds);
export const codePreferenceStyleSchema = z.enum(['auto', ...codeStyleIds]);
export const codePreferencesSchema = z.object({ style: codePreferenceStyleSchema, layout: z.number().int().min(1).max(10), density: z.number().int().min(1).max(10) });
export const codeStyleOptions = [{ id: 'auto', label: '帮我选', description: '由系统按公司资料挑选风格' },
  ...readyCodeStyleIds.map(id => ({ id, label: codeStyles[id].label, description: codeStyles[id].description }))];

const bands = {
  layout: [
    { label: '规整', hint: '各栏对齐，首屏比例均衡', rule: '共享对齐轴与等宽栅格；首屏标题、说明和参数按阅读顺序排列，多栏比例接近，不做错位或叠放。' },
    { label: '随风格', hint: '保留所选风格自身的构图与栏比', rule: '保持所选风格自身的栏比、页头形态与首屏构图，不强套统一的二比一分栏；按资料主次自然安排区块宽窄与对齐。' },
    { label: '大胆', hint: '不对称构图，拉开标题尺度', rule: '不对称主次栏约为三比一或跨栏标题；首屏拉开标题与正文尺度，在一处打破对齐轴或错位留白，文字和规格不叠压，手机按阅读顺序折叠。' },
  ],
  density: [
    { label: '疏朗', hint: '内容分组舒展，增加留白', rule: '每组只突出一个内容主题；桌面区块上下留白约 72–96px，手机约 32–48px。长段按语义拆成短段，规格分组展开，行距约 1.7–1.8；延长页面容纳全部内容，不藏到折叠区。' },
    { label: '随风格', hint: '保留所选风格自身的留白与分组节奏', rule: '保持所选风格自身的区块留白、行距与内容分组节奏，不套统一固定像素间距；说明与规格层次分明。' },
    { label: '紧凑', hint: '规格集中排列，减少空隙', rule: '紧凑表格或列表并列相关信息；桌面区块上下留白约 24–40px，手机约 16–24px，正文行距至少 1.5。缩小组间留白而不是缩小正文字号；所有参数可见、窄屏逐条展开。' },
  ],
};
export function codeSliderBand(kind: keyof typeof bands, value: number) {
  return bands[kind][value <= 3 ? 0 : value <= 7 ? 1 : 2];
}
export function codeSliderRules(preferences: z.infer<typeof codePreferencesSchema>) {
  codePreferencesSchema.parse(preferences);
  const middleLayout = preferences.layout >= 4 && preferences.layout <= 7;
  const middleDensity = preferences.density >= 4 && preferences.density <= 7;
  const scope = middleLayout && middleDensity
    ? '当前为默认/中档，保持所选风格自身的构图尺度与留白节奏；'
    : middleLayout || middleDensity
      ? '极端档位覆盖对应维度尺度，其余中档维度保持所选风格自身特征；'
      : '极端档位显式调整对齐尺度与信息疏密，仍保留风格核心视觉语言；';
  return `用户滑杆（${scope}只改变排版，不增删用户资料里的内容与事实）：\n版式 ${preferences.layout}/10：${codeSliderBand('layout', preferences.layout).rule}\n信息 ${preferences.density}/10：${codeSliderBand('density', preferences.density).rule}\n所有档位保留单位、条件、否定、数量、先后顺序、资料缺口和已有功能入口；留白与栏宽可按实际内容调整，不能靠删除、隐藏或新增事实凑版式。`;
}

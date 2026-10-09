import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { SiteCode } from '../../lib/code-site.ts';

// Independent user inputs shared by the UI run and the route regression check.
export const enrichmentCompany = '澄川传动';
export const enrichmentEmail = 'chengchuan-sales@luckye.online';
export const enrichmentSteps = [
  '模拟资料，仅用于内部 Demo。\n公司名：澄川传动\n业务：生产工业齿轮减速机。\n产品：R 系列斜齿轮减速机、K 系列锥齿轮减速机。\n先做中文首页和产品页（home、products），资料少就保持简短；参数缺口显示待补充。',
  '补充产品资料，请丰富已有首页和产品页，保留公司业务和两个产品，不增加联系、询盘、报价或样品入口。\nR 系列斜齿轮减速机：型号 R47，额定输出扭矩 244 N·m，减速比 3.83–54.00，输入功率 0.12–4 kW；用于输送设备。\nK 系列锥齿轮减速机：型号 K57，额定输出扭矩 400 N·m，减速比 10.43–59.82，输入功率 0.12–5.5 kW；用于包装设备。\n图片是已授权行业配图，只作对应类别的示意，不是本公司实拍，不代表具体型号或新增设备能力；图片旁标注行业配图。',
  '继续补充公司资料，请保留已有公司业务、两个产品及全部参数和配图。\n沿革：2016 年开始生产工业齿轮减速机；2021 年增加 K 系列锥齿轮减速机。\n供货案例：2024 年为华岭输送设备提供 R47 减速机，用于输送线驱动；数量与运行效果待补充，不添加客户 Logo 或评价。\n联系邮箱：chengchuan-sales@luckye.online。\n明确要求：加独立联系页（contact）和系统询盘表单，保留首页和产品页；不做报价、样品入口、响应时效或其他服务承诺。只做中文。',
] as const;
export const enrichmentPhotos = ['product-gearbox-reducer.jpg', 'equipment-gearbox-housing-machining.jpg'];

export function enrichmentFixtureCode(step: number, imageIds: string[] = []): SiteCode {
  const products = step === 1
    ? '<h2>R 系列斜齿轮减速机</h2><p>参数：待补充</p><h2>K 系列锥齿轮减速机</h2><p>参数：待补充</p>'
    : '<h2>R 系列斜齿轮减速机</h2><p>型号 R47，额定输出扭矩 244 N·m，减速比 3.83–54.00，输入功率 0.12–4 kW。用于输送设备。</p><h2>K 系列锥齿轮减速机</h2><p>型号 K57，额定输出扭矩 400 N·m，减速比 10.43–59.82，输入功率 0.12–5.5 kW。用于包装设备。</p>';
  const photos = imageIds.map(id => `<figure><img data-image-id="${id}" alt="行业配图"><figcaption>行业配图</figcaption></figure>`).join('');
  const history = step === 3 ? '<section><h2>沿革</h2><p>2016 年开始生产工业齿轮减速机；2021 年增加 K 系列锥齿轮减速机。</p><h2>供货案例</h2><p>2024 年为华岭输送设备提供 R47 减速机，用于输送线驱动；数量与运行效果待补充。</p></section>' : '';
  return {
    header: `<header>澄川传动<nav><a href="/home">首页</a><a href="/products">产品</a>${step === 3 ? '<a href="/contact">联系</a>' : ''}</nav></header>`,
    footer: '<footer>澄川传动</footer>',
    css: 'body{margin:0;background:#fff;color:#222;font:16px/1.6 sans-serif}header,main,footer{padding:24px}h1{font-size:32px}h2{font-size:24px}p{max-width:30em}nav{display:flex;gap:20px;flex-wrap:wrap}a{color:#222}figure{margin:24px 0;max-width:600px}img{width:100%;height:auto}section{margin-top:32px}',
    pages: [
      { id: 'home', title: '首页', html: `<main><h1>工业齿轮减速机</h1><p>澄川传动生产工业齿轮减速机。</p>${products}${step > 1 ? photos : ''}${history}</main>` },
      { id: 'products', title: '产品', html: `<main><h1>产品</h1>${products}${step > 1 ? photos : ''}</main>` },
      ...(step === 3 ? [{ id: 'contact', title: '联系', html: `<main><h1>联系澄川传动</h1><p><a href="mailto:${enrichmentEmail}">${enrichmentEmail}</a></p><div data-system-inquiry=""></div></main>` }] : []),
    ],
  };
}

export async function enrichmentProviderFixture() {
  const calls: Array<{ purpose: string; system: string; user: string }> = [];
  const failures: string[] = [];
  const server = createServer(async (req, res) => {
    try {
      let raw = ''; for await (const chunk of req) raw += chunk;
      const body = JSON.parse(raw), system: string = body.messages[0].content, user: string = body.messages[1].content;
      const purpose = body.tools ? 'plan' : system.includes('事实校对员') ? 'facts' : system.includes('版本参考选择') ? 'select' : 'write';
      calls.push({ purpose, system, user });
      let data: unknown;
      if (purpose === 'plan') data = { summary: '首页介绍业务，产品页列两类减速机，参数缺口保留待补充。', style: 'precision', styleReason: '以产品目录为主。', skeletonId: 'compact-profile', skeletonReason: '资料只有业务与产品，采用短目录；不选长篇工厂介绍。', pages: [{ id: 'home', title: '首页', outline: ['业务与产品名称'] }, { id: 'products', title: '产品', outline: ['两类产品与参数缺口'] }] };
      else if (purpose === 'select') data = { referenceRevisions: [] };
      else if (purpose === 'facts') data = { issues: [] }; // Semantic audit is controlled; Chrome and numeric checks are real.
      else {
        const materials = user.slice(user.indexOf('资料（唯一企业事实来源'), user.indexOf('已确认页面大纲'));
        const step = user.includes('明确要求：加独立联系页') ? 3 : user.includes('补充产品资料') ? 2 : 1;
        // A fixed reply cannot conceal lost historical user facts at the provider boundary.
        if (step === 3) assert.ok(materials.includes('额定输出扭矩 244 N·m') && materials.includes('额定输出扭矩 400 N·m'), '第三步写页丢失第二步的事实来源');
        const imageJson = user.match(/可用图片编号：(.*)\n本次要求/)?.[1];
        const images: Array<{ imageId: string }> = JSON.parse(imageJson ?? '[]');
        data = enrichmentFixtureCode(step, images.map(i => i.imageId));
      }
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 }, choices: [{ finish_reason: purpose === 'plan' ? 'tool_calls' : 'stop', message: purpose === 'plan'
        ? { content: null, tool_calls: [{ type: 'function', function: { name: 'submit_page_plan', arguments: JSON.stringify(data) } }] } : { content: JSON.stringify(data) } }] }));
    } catch (error) { failures.push(String(error)); res.writeHead(422); res.end(JSON.stringify({ error: { message: String(error) } })); }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${(server.address() as { port: number }).port}`, calls, failures,
    close: () => new Promise<void>(resolve => server.close(() => resolve())) };
}

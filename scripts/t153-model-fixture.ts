import { factAuditReply } from '../tests/fixtures/fact-audit-reply.ts';
import { localEndpoint } from './local-endpoint.ts';
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
localEndpoint('SITECRAFT_BASE');
const fixture = localEndpoint('SITECRAFT_FIXTURE_BASE');
const folder = `artifacts/t153/provider-${Date.now()}`;
await mkdir(folder, { recursive: true });
const requests: unknown[] = [];
const code = {
  header: '<header><strong>恒川传动</strong><nav><a href="/home">首页</a><a href="/products">产品</a></nav></header>',
  footer: '<footer>恒川传动 · 按图加工</footer>',
  css: '*{box-sizing:border-box}body{margin:0;background:#faf9f5;color:#252525;font:16px/1.7 sans-serif}header,footer,main{max-width:1100px;margin:auto;padding:24px}header{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap}nav{display:flex;gap:24px}a{color:#254c77}section{margin:24px 0 48px}h1{font-size:40px;line-height:1.2}h2{font-size:26px}p{max-width:36em}dl{display:grid;grid-template-columns:120px 1fr;gap:12px}dd{margin:0}@media(max-width:767px){h1{font-size:30px}dl{grid-template-columns:1fr;gap:8px}}',
  pages: [
    { id: 'home', title: '恒川传动', html: '<main><section><h1>齿轮与传动轴</h1><p>按图加工。不提供现场安装。</p><a href="/products">查看产品参数</a></section><section><h2>加工边界</h2><p>齿轮热处理由外协完成，入厂复检后再精加工。</p></section></main>' },
    { id: 'products', title: '产品参数', html: '<main><h1>产品参数</h1><section><h2>齿轮 G8</h2><dl><dt>材质</dt><dd>合金钢</dd><dt>直径</dt><dd>80 mm</dd><dt>适用边界</dt><dd>不适用腐蚀工况</dd></dl></section><section><h2>传动轴 S2</h2><p>按图加工，长度待补充。</p></section></main>' },
  ],
};
const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/requests') { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(requests)); return; }
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw), system = body.messages[0].content, user = body.messages[1].content;
  let answer: unknown, purpose: string;
  if (body.tools?.[0]?.function.name === 'submit_page_plan') {
    purpose = 'plan';
    const style = user.match(/style 必须填 ([a-z]+)/)?.[1] || 'editorial';
    answer = { summary: '展示齿轮与传动轴，保留加工边界。', style, styleReason: '依据现有加工资料。', skeletonId: 'custom', skeletonReason: '两项产品与加工边界适合先介绍再列参数。', pages: [{ id: 'home', title: '首页', outline: ['产品入口与加工边界'] }, { id: 'products', title: '产品参数', outline: ['齿轮与传动轴参数'] }] };
  } else if (system.includes('事实校对员')) { purpose = 'facts'; answer = { issues: [] }; }
  else if (system.includes('版本参考选择')) { purpose = 'select'; answer = { referenceRevisions: [] }; }
  else if (user.includes('已确认页面大纲（不能作为新增事实来源')) { purpose = 'write'; answer = code; }
  else { res.writeHead(422); res.end(JSON.stringify({ error: { message: 'Unexpected fixture request' } })); return; }
  requests.push({ purpose, body });
  await writeFile(`${folder}/requests.json`, JSON.stringify(requests, null, 2));
  const message = purpose === 'plan' ? { content: null, tool_calls: [{ id: 'local-plan', type: 'function', function: { name: 'submit_page_plan', arguments: JSON.stringify(factAuditReply(body, answer)) } }] } : { content: JSON.stringify(factAuditReply(body, answer)) };
  res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ choices: [{ finish_reason: purpose === 'plan' ? 'tool_calls' : 'stop', message }] }));
});
server.listen(fixture.port, fixture.hostname, () => console.log(`Local-only provider at ${fixture.origin}; ${folder}`));

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { localEndpoint } from './local-endpoint.ts';
import { factAuditReply } from '../tests/fixtures/fact-audit-reply.ts';

// A local transport fixture, not a generator-quality or semantic fact oracle.
// It derives the company, page IDs and visible text from the received request.
// It does not import the production packs or write the site store.
localEndpoint('SITECRAFT_BASE');
const endpoint = localEndpoint('SITECRAFT_FIXTURE_BASE');
const { values } = parseArgs({ options: { out: { type: 'string' }, 'hold-facts': { type: 'boolean', default: false } } });
assert.ok(values.out, 'Set --out to a new artifact directory');
const folder = path.resolve(values.out);
await mkdir(folder); // Preserve earlier runs, including failed ones.
type Input = { messages: Array<{ content: string }>; tools?: Array<{ function: { name: string } }> };
const requests: Array<{ purpose: string; company: string; body: Input }> = [];
let activeRequests = 0;
const heldFacts: Array<() => void> = [];
const escape = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/status') {
    res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ fixtureOnly: true, activeRequests, heldFacts: heldFacts.length, calls: requests.map(item => item.purpose) })); return;
  }
  if (req.method === 'POST' && req.url === '/release') {
    for (const release of heldFacts.splice(0)) release(); res.end('{}'); return;
  }
  if (req.method === 'GET' && req.url === '/requests') {
    res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(requests)); return;
  }
  activeRequests++;
  try {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body: Input = JSON.parse(raw), system = body.messages[0].content, user = body.messages[1].content;
    const company = user.match(/公司名：([^\n]+)/)?.[1] || '';
    let purpose: string, answer: unknown;
    if (body.tools?.[0]?.function.name === 'submit_page_plan') {
      purpose = 'plan';
      const pages = [...user.matchAll(/(首页|产品|菜单|课程|作品)（([a-z]+)）/g)].slice(0, 2).map(match => ({ id: match[2], title: match[1], outline: ['按所提供的资料安排内容并保留缺口'] }));
      assert.equal(pages.length, 2, 'The fixture requires an explicit two-page request');
      answer = { summary: `展示${company}的现有资料与服务边界。`, style: user.match(/style 必须填 ([a-z]+)/)?.[1], styleReason: '沿用用户已选择的风格。', skeletonId: 'custom', skeletonReason: '先介绍机构，再按资料整理业务内容。', pages };
    } else if (system.includes('事实校对员')) {
      purpose = 'facts'; answer = { issues: [] }; // Protocol only; no semantic audit claim.
    } else if (user.includes('已确认页面大纲（不能作为新增事实来源')) {
      purpose = 'write';
      const start = user.indexOf('资料性质：'), end = user.indexOf('\n页面要求：', start);
      assert.ok(start >= 0 && end > start, 'The fixture requires the complete material block');
      const lines = user.slice(start, end).split('\n').filter(line => line && !/^(资料性质|公司名|行业|首屏可用事实|首屏说明|图片使用)：/.test(line));
      const plan = JSON.parse(user.split('已确认页面大纲（不能作为新增事实来源，冲突时以资料为准）：')[1].split('\n')[0]);
      const section = (line: string) => {
        const colon = line.indexOf('：');
        return `<section><h2>${escape(line.slice(0, colon))}</h2><p>${escape(line.slice(colon + 1))}</p></section>`;
      };
      answer = {
        header: `<header><strong>${escape(company)}</strong><nav>${plan.pages.map((page: { id: string; title: string }) => `<a href="/${page.id}">${escape(page.title)}</a>`).join('')}</nav></header>`,
        footer: `<footer>${escape(company)}</footer>`,
        css: '*{box-sizing:border-box}body{margin:0;background:#f7f5f0;color:#222;font:17px/1.8 sans-serif}header,footer,main{max-width:960px;margin:auto;padding:24px}header{display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap}nav{display:flex;gap:24px;flex-wrap:wrap}a{color:#174d69}main{padding-block:40px}section{margin:0 0 36px}h1{font-size:36px;line-height:1.3;margin:0 0 32px}h2{font-size:22px;line-height:1.4;margin:0 0 12px}p{max-width:36em;margin:0;overflow-wrap:anywhere}footer{border-top:1px solid #777}@media(max-width:767px){header,footer,main{padding:20px}h1{font-size:28px}}',
        pages: plan.pages.map((page: { id: string; title: string }, index: number) => ({ ...page, html: `<main><h1>${escape(index === 0 ? company : page.title)}</h1>${(index === 0 ? lines.slice(0, 2) : lines.slice(2)).map(section).join('')}</main>` })),
      };
    } else throw new Error('The fixture received an unsupported request');
    requests.push({ purpose, company, body });
    await writeFile(path.join(folder, 'requests.json'), JSON.stringify(requests, null, 2), 'utf8');
    if (purpose === 'facts' && values['hold-facts']) await new Promise<void>(resolve => heldFacts.push(resolve));
    const message = purpose === 'plan' ? { content: null, tool_calls: [{ id: 'local-plan', type: 'function', function: { name: 'submit_page_plan', arguments: JSON.stringify(answer) } }] } : { content: JSON.stringify(factAuditReply(body, answer)) };
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ choices: [{ finish_reason: purpose === 'plan' ? 'tool_calls' : 'stop', message }] }));
  } catch (error) {
    res.writeHead(422, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: { message: error instanceof Error ? error.message : String(error) } }));
  } finally { activeRequests--; }
});
server.listen(endpoint.port, endpoint.hostname, () => console.log(`Local fixture: ${endpoint.origin}; requests: ${folder}`));

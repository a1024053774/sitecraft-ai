import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
// Development-only HTTP provider. The application still uses its actual chat,
// workflow, checker and version store. It never contacts a real model.
const requests: unknown[] = [];
const server = createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw);
  const prompt = body.messages[1].content;
  let answer: unknown;
  if (body.messages[0].content.includes('本次是局部修改')) {
    const input = JSON.parse(prompt.split('\n')[0]);
    let html = input.html as string;
    if (input.request.includes('精简文字')) html = html.replace('先给装载物尺寸、重量和运输方式，再确认 E楞或 B楞。', '按装载物尺寸、重量和运输方式确认 E楞或 B楞。');
    answer = { html, css: `.${input.scope} { border-top: 4px solid #6b321e; } .${input.scope} h1 { letter-spacing: .04em; }` };
    if (input.request.includes('[fixture-whole-page]')) answer = { html: '<main><section><h1>整页</h1></section></main>', css: '' };
    if (input.request.includes('[fixture-shared-css]')) answer = { html, css: '.hero { padding: 48px; }' };
  } else if (prompt.includes('当前完整站点：')) answer = JSON.parse(prompt.split('当前完整站点：')[1].split('\n保留')[0]);
  else if (body.messages[0].content.includes('事实校对员')) {
    if (prompt.includes('[fixture-fact-truncation]')) { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ choices: [{ finish_reason: 'length', message: { content: '' } }], usage: { prompt_tokens: 4763, completion_tokens: 4095, total_tokens: 8858 } })); return; }
    answer = { issues: [] };
  }
  else if (body.messages[0].content.includes('版本参考选择')) answer = { referenceRevisions: [] };
  else { res.writeHead(422); res.end(JSON.stringify({ error: { message: 'Fixture received unexpected model request' } })); return; }
  requests.push({ purpose: body.messages[0].content.includes('事实校对员') ? 'facts' : 'local-edit', input: prompt, answer });
  await mkdir('artifacts/t152', { recursive: true });
  await writeFile('artifacts/t152/fixture-requests.json', JSON.stringify(requests, null, 2));
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(answer) } }], usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 } }));
});
server.listen(3165, '127.0.0.1', () => console.log('T-152 local model fixture on 3165'));

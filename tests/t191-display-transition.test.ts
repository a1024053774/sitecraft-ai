import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import test from 'node:test';
import { checkSiteCode } from '../lib/code-site-check.ts';
import type { CodeModelCall, SiteCode } from '../lib/code-site.ts';

// 失败方式：预采集复用文档，桌面媒体查询触发 display 过渡，读到旧 inline；
// 正式扫描虽重新装载，事实输入仍沿用缺项的并集。期望来自任一档成块即分隔的合同。
for (const transition of [false, true]) test(`实际提交检查保留桌面标签边界：${transition ? 'display 过渡' : '无过渡对照'}`, async () => {
  const output = `artifacts/t191/display-transition-${Date.now()}-${process.pid}-${transition}`;
  await mkdir(output, { recursive: true });
  const inputs: NonNullable<CodeModelCall['factInput']>[] = [];
  const provider = createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const input = JSON.parse(JSON.parse(raw).messages[1].content.split('\n')[0]);
    inputs.push(input);
    res.setHeader('content-type', 'application/json');
    // 地址是普通事实；固定通过回复只用于捕获真实 HTTP 输入，不替边界断言作答。
    res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({
      results: input.segments.map((segment: { id: string }) => ({ id: segment.id, issues: [], noFacts: true, factCategories: [], citations: [] })),
    }) } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }));
  });
  await new Promise<void>(resolve => provider.listen(0, '127.0.0.1', resolve));
  const address = provider.address(); assert.ok(address && typeof address === 'object');
  const previous = { DEEPSEEK_BASE_URL: process.env.DEEPSEEK_BASE_URL, DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY, DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL };
  Object.assign(process.env, { DEEPSEEK_BASE_URL: `http://127.0.0.1:${address.port}`, DEEPSEEK_API_KEY: 't191-transition-fixture', DEEPSEEK_MODEL: 'fixture' });
  try {
    const code: SiteCode = { header: '', footer: '',
      css: 'body{margin:0;color:#222;background:#fff;font:18px/1.6 sans-serif}main{padding:24px}'
        + `.label{display:inline;${transition ? 'transition:display 1s allow-discrete' : ''}}`
        + '@media(min-width:1100px){.label{display:block}}',
      pages: [{ id: 'home', title: '到店须知', html: '<main><h1>青禾小馆</h1><section><h2>到店</h2><p><span class="label">门牌地址</span><span>青禾路七号</span></p></section></main>' }],
    };
    const result = await checkSiteCode({ siteId: 't191-transition', code, materials: '青禾小馆。门牌地址为青禾路七号。', images: [] });
    await writeFile(`${output}/capture.json`, JSON.stringify({ code, result, inputs }, null, 2), 'utf8');
    assert.equal(result.checks.passed, true, result.checks.issues.join('\n'));
    if (transition) assert.match(result.code.css, /transition:\s*display 1s allow-discrete/, '必须实际检查保留过渡的候选');
    assert.equal(inputs.length, 1, '必须捕获实际 facts HTTP 请求');
    const matching = inputs[0].segments.filter(segment => segment.text.includes('青禾路七号'));
    assert.equal(matching.length, 1, '三档共用同一个地址核对段');
    assert.match(matching[0].text, /门牌地址\s+青禾路七号/, '桌面独立标签必须进入三档分隔并集');
    assert.ok(matching[0].claimTexts!.some(text => text.includes('门牌地址 青禾路七号')));
  } finally {
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    await new Promise<void>(resolve => provider.close(() => resolve()));
  }
});

import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import test from 'node:test';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';
import { renderSiteCode } from '../lib/code-site.ts';
import { captureEvalPage } from '../scripts/eval-site-capture.ts';

// Failure modes: page timers never fire under the preview's script sandbox;
// full-page capture omits the lower page; disabling CSP masks the timer bug;
// broken authorized image bytes are silently accepted. The actual diagnostic
// candidate is served with the same preview CSP; no site/version is bypass-written.
const fixture = JSON.parse(await readFile('tests/fixtures/t133/capture-page.json', 'utf8'));
const photos = new Map<string, Buffer>(await Promise.all(fixture.images.map(async (image: { id: string; file: string }) => [image.id, await readFile(image.file)] as const)));
let broken = false;
const server = createServer((req, res) => {
  const id = req.url?.split('/').at(-1);
  if (id && photos.has(id)) {
    res.setHeader('content-type', 'image/jpeg'); res.setHeader('cache-control', 'no-store');
    if (broken) { res.statusCode = 404; res.end(); } else res.end(photos.get(id));
    return;
  }
  res.setHeader('content-type', 'text/html');
  res.setHeader('Content-Security-Policy', "sandbox allow-forms; default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src 'self'; form-action 'self'; base-uri 'none'");
  let html = renderSiteCode('t133-capture', fixture.code, 'home', '', fixture.credits).replace('</body>', '<script>globalThis.t133CandidateScriptRan=true</script></body>');
  if (req.url === '/animated-preview') html = html.replace('</head>', '<style>@keyframes intro{from{opacity:0}to{opacity:1}}h1{animation:intro 1800ms both}</style></head>');
  if (req.url === '/media-preview') html = html.replace('</head>', '<style>@media(min-width:1200px){@keyframes mediaIntro{from{opacity:0;transform:translateY(50px)}to{opacity:1;transform:translateY(0)}}h1{animation:mediaIntro 1s ease backwards}}</style></head>');
  if (req.url === '/late-preview') {
    // Real control websites have scripts. The generated-preview fixture above
    // retains its original sandbox while this control starts a delayed intro.
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self'");
    html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]+>/, '');
    html = html.replace('</body>', '<script>setTimeout(()=>document.querySelector("h1").animate([{opacity:0},{opacity:1}],{duration:1800,fill:"both"}),600)</script></body>');
  }
  res.end(html);
});
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address(); assert.ok(address && typeof address === 'object');
const url = `http://127.0.0.1:${address.port}/preview`;
test.after(() => new Promise<void>(resolve => server.close(() => resolve())));
test('T133 actual sandboxed candidate captures all three widths without enabling scripts', async () => {
  const browser = await codeCheckBrowser();
  const folder = path.join('artifacts/t133', `capture-${crypto.randomUUID()}`); await mkdir(folder, { recursive: true });
  try {
    for (const width of [1440, 768, 375]) {
      const png = Buffer.from(await captureEvalPage(browser, url, width, fixture.company), 'base64');
      await writeFile(path.join(folder, `${width}.png`), png);
      assert.equal(png.readUInt32BE(16), width);
      assert.ok(png.readUInt32BE(20) > 1000, 'must include the lower page, not only the fold');
      assert.equal(await browser.evaluate('globalThis.t133CandidateScriptRan === true'), false);
      assert.equal(await browser.evaluate('scrollY'), 0);
    }
    broken = true;
    await assert.rejects(captureEvalPage(browser, url, 1440, fixture.company), /未加载图片/);
  } finally { await browser.close(); }
});
test('T133 fold capture waits for visible finite intro motion within its existing load budget', async () => {
  broken = false;
  const browser = await codeCheckBrowser();
  try {
    await captureEvalPage(browser, url.replace('/preview', '/animated-preview'), 1440, fixture.company, false);
    assert.equal(await browser.evaluate('getComputedStyle(document.querySelector("h1")).opacity'), '1', 'the intro must be visible, not a loading or transition frame');
  } finally { await browser.close(); }
});
test('T133 checks motion at capture time, including a control intro that starts after document load', async () => {
  broken = false;
  const browser = await codeCheckBrowser();
  try {
    await captureEvalPage(browser, url.replace('/preview', '/late-preview'), 1440, fixture.company, false);
    assert.equal(await browser.evaluate('getComputedStyle(document.querySelector("h1")).opacity'), '1');
  } finally { await browser.close(); }
});
test('T133 a fold snapshot must not restart desktop media-query entrance animations', async () => {
  broken = false;
  const browser = await codeCheckBrowser();
  try {
    await captureEvalPage(browser, url.replace('/preview', '/media-preview'), 1440, fixture.company, false);
    assert.equal(await browser.evaluate('getComputedStyle(document.querySelector("h1")).opacity'), '1');
  } finally { await browser.close(); }
});

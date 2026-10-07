import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer as createTcpServer } from "node:net";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const out = path.resolve(process.env.T119_EVIDENCE_DIR || `artifacts/t119/browser-ownership/run-${Date.now()}-${process.pid}`);
mkdirSync(out, { recursive: true });
const chrome = process.env.CHROME_PATH;
assert.ok(chrome, "use the approved testing Chrome");
const utc = () => new Date().toISOString();
const save = (file: string, value: unknown) => writeFileSync(path.join(out, file), JSON.stringify(value, null, 2) + "\n", { flag: "wx" });

// Observes native Target events; never replaces a collector request or response.
class Observer {
  ws: WebSocket;
  next = 1;
  pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();
  events: any[] = [];
  constructor(endpoint: string) {
    this.ws = new WebSocket(endpoint);
    this.ws.addEventListener("message", event => {
      const message = JSON.parse(String(event.data));
      this.events.push({ UTC: utc(), message });
      const pending = this.pending.get(message.id);
      if (pending) {
        this.pending.delete(message.id);
        message.error ? pending.reject(new Error(JSON.stringify(message.error))) : pending.resolve(message.result);
      }
    });
  }
  send(method: string, params = {}) {
    return new Promise<any>((resolve, reject) => {
      const id = this.next++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

async function ownedSentinel(label: string) {
  const profile = mkdtempSync(path.join(out, `${label}-profile-`));
  const args = ["--remote-debugging-port=0", `--user-data-dir=${profile}`, "--headless=new", "--no-first-run", "--site-per-process", "--enable-features=IsolateSandboxedIframes", "about:blank"];
  const startedAt = utc();
  const child = spawn(chrome!, args, { cwd: root, stdio: ["ignore", "ignore", "pipe"] });
  const closed = once(child, "close");
  let stderr = "";
  const endpoint = await new Promise<string>((resolve, reject) => {
    child.stderr!.on("data", bytes => {
      stderr += bytes;
      const match = stderr.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) resolve(match[1]);
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => reject(new Error(`sentinel exited before readiness: ${code}/${signal}`)));
  });
  const port = Number(new URL(endpoint).port);
  const owner = spawnSync("lsof", ["-nP", "-a", "-p", String(child.pid), `-iTCP:${port}`, "-sTCP:LISTEN"], { encoding: "utf8" });
  save(`${label}-ownership.json`, { argv: [chrome, ...args], cwd: root, startedAt, readyAt: utc(), pid: child.pid, profile, port, endpoint, lsof: { status: owner.status, stdout: owner.stdout, stderr: owner.stderr } });
  assert.equal(owner.status, 0, "only observe the sentinel after its spawned PID owns the listener");
  const observer = new Observer(endpoint);
  await once(observer.ws, "open");
  await observer.send("Target.setDiscoverTargets", { discover: true });
  const before = await observer.send("Target.getTargets");
  assert.equal(before.targetInfos.filter((target: any) => target.type === "page").length, 1);
  const initial = before.targetInfos.find((target: any) => target.type === "page").targetId;
  observer.events.length = 0;
  return { child, observer, port, initial, async stop() {
    observer.ws.close();
    child.kill("SIGTERM");
    const [code, signal] = await closed;
    writeFileSync(path.join(out, `${label}-chrome.stderr.raw`), stderr, { flag: "wx" });
    save(`${label}-chrome-exit.json`, { pid: child.pid, code, signal, UTC: utc() });
  } };
}

async function runCollector(label: string, base: string, port?: number, extraArgs: string[] = [], sites = ["owned-input"]) {
  const directory = path.join(out, label);
  const env: NodeJS.ProcessEnv = { ...process.env, SITECRAFT_BASE: base, CHROME_PATH: chrome };
  delete env.CDP_PORT;
  if (port !== undefined) env.CDP_PORT = String(port);
  const args = [...extraArgs, "scripts/check-published.mjs", "--out", directory, ...sites];
  const startedAt = utc();
  const child = spawn(process.execPath, args, { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "", stderr = "";
  child.stdout!.on("data", bytes => { stdout += bytes; });
  child.stderr!.on("data", bytes => { stderr += bytes; });
  const [code, signal] = await once(child, "close");
  mkdirSync(directory, { recursive: true });
  writeFileSync(path.join(directory, "stdout.raw"), stdout, { flag: "wx" });
  writeFileSync(path.join(directory, "stderr.raw"), stderr, { flag: "wx" });
  save(`${label}-run.json`, { argv: [process.execPath, ...args], cwd: root, startedAt, finishedAt: utc(), code, signal, pid: child.pid, environmentOverrides: { SITECRAFT_BASE: base, CDP_PORT: env.CDP_PORT ?? null, CHROME_PATH: chrome } });
  return { directory, code, stdout, stderr };
}

test("T119 occupied explicit port never creates or closes a target in an external owned-by-test Chrome", { timeout: 15000 }, async () => {
  // Intentional navigation stop only bounds the bad implementation. The business
  // red is a native targetCreated event in a browser the CLI did not launch, not exit 1.
  const fixture = createServer((_request, response) => response.end('<!doctype html><div data-preview-state="error">Ownership boundary only</div>'));
  await new Promise<void>(resolve => fixture.listen(0, "127.0.0.1", resolve));
  const address = fixture.address(); assert.ok(address && typeof address !== "string");
  const sentinel = await ownedSentinel("occupied-sentinel");
  try {
    const result = await runCollector("occupied", `http://127.0.0.1:${address.port}`, sentinel.port);
    const after = await sentinel.observer.send("Target.getTargets");
    save("occupied-native-events.json", sentinel.observer.events);
    save("occupied-targets-after.json", after);
    const externalCreations = sentinel.observer.events.filter(event => event.message.method === "Target.targetCreated");
    const externalDestructions = sentinel.observer.events.filter(event => event.message.method === "Target.targetDestroyed");
    assert.deepEqual(externalCreations, [], "independent Chrome per run: occupied port must be rejected before any target creation in sentinel");
    assert.deepEqual(externalDestructions, [], "the collector cannot close another owner's targets");
    assert.ok(after.targetInfos.some((target: any) => target.targetId === sentinel.initial), "sentinel initial target survives");
    assert.equal(result.code, 1, "explicit port occupation is an error");
    assert.match(result.stderr + result.stdout, /port.*(?:occupied|in use)/i, "report the actual occupied-port cause");
    const rows = JSON.parse(readFileSync(path.join(result.directory, "report.json"), "utf8"));
    assert.equal(rows.length, 3);
    for (const row of rows) { assert.equal(row.status, "not_run"); assert.equal(row.measurement, undefined); }
  } finally {
    await sentinel.stop();
    await new Promise<void>((resolve, reject) => fixture.close(error => error ? reject(error) : resolve()));
  }
});

// Rebuildable public input: facts are supplied literals; all draft writes use commitOperations in an isolated cwd.
async function publishedInput() {
  const directory = mkdtempSync(path.join(out, "isolated-site-"));
  mkdirSync(path.join(directory, "scripts"));
  copyFileSync(path.join(root, "scripts/visitor-layout-scan.js"), path.join(directory, "scripts/visitor-layout-scan.js"));
  const script = path.join(directory, "published-fixture.ts");
  writeFileSync(script, `import {existsSync,readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';import {pathToFileURL} from 'node:url';import path from 'node:path';import {createServer} from 'node:http';
const repo=${JSON.stringify(root)};
registerHooks({resolve(specifier,context,next){if(!specifier.startsWith('@/'))return next(specifier,context);const p=path.join(repo,specifier.slice(2));return next(pathToFileURL(existsSync(p+'.ts')?p+'.ts':path.join(p,'index.ts')).href,context);}});
const {createSite,commitOperations}=await import(pathToFileURL(path.join(repo,'lib/site-store.ts')).href);
const {composedPageForTemplate}=await import(pathToFileURL(path.join(repo,'lib/blocks/compose.ts')).href);
const {prepareHtml}=await import(pathToFileURL(path.join(repo,'app/api/templates/[templateId]/preview/route.ts')).href);
const id='t119-isolated-published-input',before=await createSite(id);
const committed=await commitOperations({siteId:id,baseRevision:before.draft.revision,source:'manual',summary:'Independent T119 ownership input',operations:[
{op:'set_template',templateId:'forge'},
{op:'set_text',target:'companyName',value:'T119 Bore Works'},
{op:'set_text',target:'industry',value:{zh:'精密零件加工',en:'Precision parts machining'}},
{op:'set_text',target:'hero.title',value:{zh:'按图加工精密零件',en:'Precision parts machined to drawing'}},
{op:'set_text',target:'hero.subtitle',value:{zh:'提供CNC加工与尺寸检测。',en:'CNC machining and dimensional inspection.'}},
{op:'set_text',target:'contact.email',value:'bore@example.test'},
{op:'replace_products',products:[{id:'part-1',sku:'T119-04',name:{zh:'精密工件',en:'Precision part'},summary:{zh:'按图加工，公差0.02 mm。',en:'Machined to drawing, tolerance 0.02 mm.'},category:{zh:'工件',en:'Parts'},status:'published',imageColor:'#e6e1cf',specs:[]}]}]});
if(committed.status!=='applied')throw new Error('Temporary commitOperations input did not apply: '+committed.status);
let draft=committed.record.draft;
const images=[];
const preview=prepareHtml(composedPageForTemplate(draft.templateId),'',draft.templateId,true,false);
const host=\`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/visitor-host.css"><main class="published-template-shell"><div class="published-template-stage"><div class="open-source-template-frame-shell open-source-template-frame-shell-published" data-preview-state="loading"><iframe class="open-source-template-frame open-source-template-frame-published" sandbox="allow-scripts allow-forms" src="/api/templates/\${draft.templateId}/preview"></iframe></div></div></main><script>
const draft=\${JSON.stringify(draft)},images=\${JSON.stringify(images)},frame=document.querySelector('iframe');let locale='zh';
const send=()=>frame.contentWindow.postMessage({type:'sitecraft:content',typeVersion:1,sessionId:'t119-fixture-session',templateId:draft.templateId,draft,locale,variant:'published',images,offersVisitorEnglish:draft.englishReady},'*');
addEventListener('message',event=>{if(event.source!==frame.contentWindow)return;const data=event.data;if(data.type==='sitecraft:ready')send();if(data.type==='sitecraft:applied'){frame.dataset.previewHydrated='true';frame.parentElement.dataset.previewState='ready';}if(data.type==='sitecraft:locale'){locale=data.locale;send();}});frame.addEventListener('load',send);
</script>\`;
const server=createServer(async(request,response)=>{try{const url=new URL(request.url,'http://fixture');response.setHeader('content-type','text/html; charset=utf-8');response.setHeader('access-control-allow-origin','*');
if(url.pathname==='/api/sites/'+id+'/draft')response.end(JSON.stringify({draft}));
else if(url.pathname==='/api/sites/'+id+'/images')response.end(JSON.stringify({images}));
else if(url.pathname.startsWith('/published/'))response.end(host);
else if(url.pathname.endsWith('/preview'))response.end(preview);
else {const relative=url.pathname.replace(/^\\/api\\/templates\\/[^/]+\\/assets/,'');const file=path.join(repo,'public',relative);if(!file.startsWith(path.join(repo,'public')+path.sep))throw new Error('outside public');response.setHeader('content-type',file.endsWith('.woff2')?'font/woff2':'text/css');response.end(readFileSync(file));}
}catch(error){response.statusCode=500;response.end(String(error));}});
server.listen(0,'127.0.0.1',()=>console.log(JSON.stringify({base:'http://127.0.0.1:'+server.address().port,id,cwd:process.cwd()})));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
`, "utf8");
  const child = spawn(process.execPath, ["--experimental-strip-types", script], { cwd: directory, env: { ...process.env, SITE_STORE: "fs", NODE_ENV: "development" }, stdio: ["ignore", "pipe", "pipe"] });
  const startedAt = utc(), closed = once(child, "close");
  let output = "", stdout = "", stderr = "";
  const ready = await new Promise<{ base: string; id: string; cwd: string }>((resolve, reject) => {
    const timer = setTimeout(() => { child.kill();reject(new Error(`isolated fixture did not start: ${output}`)); }, 15000);
    child.stdout.on("data", data => { output += data; stdout += data; const line=output.split("\n").find(line=>line.startsWith('{"base"'));if(line){clearTimeout(timer);resolve(JSON.parse(line));} });
    child.stderr.on("data", data => { output += data; stderr += data; });
    child.on("exit", code => { clearTimeout(timer);reject(new Error(`isolated fixture exited ${code}: ${output}`)); });
  });
  assert.equal(ready.cwd, directory, "commitOperations writes only the isolated temporary cwd");
  writeFileSync(path.join(directory, "fixture-run.json"), JSON.stringify({ ...ready, argv: child.spawnargs, UTC: utc(), pid: child.pid }, null, 2), { flag: "wx" });
  return { ...ready, async stop() {
    child.kill("SIGTERM"); const [code, signal] = await closed;
    writeFileSync(path.join(directory, "fixture.stdout.raw"), stdout, { flag: "wx" });
    writeFileSync(path.join(directory, "fixture.stderr.raw"), stderr, { flag: "wx" });
    writeFileSync(path.join(directory, "fixture-exit.json"), JSON.stringify({ argv: child.spawnargs, cwd: directory, startedAt, finishedAt: utc(), code, signal }), { flag: "wx" });
  } };
}

async function unusedPort() {
  const reservation = createTcpServer();
  await new Promise<void>(resolve => reservation.listen(0, "127.0.0.1", resolve));
  const address = reservation.address(); assert.ok(address && typeof address !== "string");
  await new Promise<void>((resolve, reject) => reservation.close(error => error ? reject(error) : resolve()));
  return address.port;
}

function lifecycleEvents(directory: string): any[] {
  return readFileSync(path.join(directory, "browser-lifecycle.ndjson"), "utf8").trim().split("\n").map(line => JSON.parse(line));
}

function assertOwnedCleanup(directory: string, expectEndpoint = true) {
  const events = lifecycleEvents(directory);
  const starts = events.filter(event => event.event === "chrome-start");
  assert.equal(starts.length, 1, "one actual spawn, no restart or retry");
  const started = starts[0];
  const endpoints = events.filter(event => event.event === "chrome-endpoint");
  assert.equal(endpoints.length, expectEndpoint ? 1 : 0);
  for (const endpoint of endpoints) {
    assert.equal(endpoint.pid, started.pid);
    assert.equal(endpoint.profile, started.profile);
    assert.ok(endpoint.port > 0);
    assert.ok(endpoint.browserId && endpoint.endpoint.endsWith(endpoint.browserId));
    assert.ok(readFileSync(path.join(directory, "chrome.stderr.raw"), "utf8").includes(endpoint.endpoint), "actual child stderr supplied the endpoint");
  }
  assert.equal(events.filter(event => event.event === "chrome-exit").length, 1);
  assert.equal(events.filter(event => event.event === "chrome-close").length, 1);
  const ps = spawnSync("ps", ["-axo", "pid=,ppid=,command="], { encoding: "utf8" });
  assert.equal(ps.status, 0);
  const remaining = ps.stdout.split("\n").filter(line => line.includes(`--user-data-dir=${started.profile}`) || line.trim().split(/\s+/)[0] === String(started.pid));
  writeFileSync(path.join(directory, "cleanup-ps.raw"), ps.stdout, { flag: "wx" });
  assert.deepEqual(remaining, [], "no process with this run's exact PID/profile survives cleanup");
}

function assertMeasuredInput(directory: string) {
  const rows = JSON.parse(readFileSync(path.join(directory, "report.json"), "utf8"));
  assert.deepEqual(rows.map((row: any) => row.width), [1440, 768, 375]);
  for (const row of rows) for (const measured of [row, row.english]) {
    assert.ok(measured, "both supplied locales are actually measured");
    assert.deepEqual(measured.failures, []);
    assert.deepEqual(measured.captureFailures, []);
    assert.ok(measured.measurement.visibleBlocks.includes("hero") && measured.measurement.visibleBlocks.includes("footer"));
    assert.ok(measured.facts.expected > 0);
    assert.equal(measured.facts.missing, 0);
    assert.equal(measured.imageCredits.required, 0, "the supplied input has no images");
    assert.equal(measured.screenshotGeometry.pngWidth, row.width);
    assert.equal(measured.screenshotGeometry.pngHeight, measured.screenshotGeometry.pageHeight);
    assert.ok(measured.textContrast.some((entry: any) => entry.text === "T119 Bore Works"), "independently supplied company name reaches real DOM measurements");
  }
}

test("T119 default dynamic and available explicit ports measure the real isolated publish input and reap only their own Chrome", { timeout: 120000 }, async () => {
  const fixture = await publishedInput();
  const sentinel = await ownedSentinel("normal-sentinel");
  try {
    const dynamic = await runCollector("dynamic", fixture.base, undefined, [], [fixture.id]);
    assert.equal(dynamic.code, 0, dynamic.stdout + dynamic.stderr);
    assertMeasuredInput(dynamic.directory);
    assertOwnedCleanup(dynamic.directory);
    assert.equal(lifecycleEvents(dynamic.directory).find(event => event.event === "chrome-start").requestedPort, 0);
    const port = await unusedPort();
    const explicit = await runCollector("explicit", fixture.base, port, [], [fixture.id]);
    assert.equal(explicit.code, 0, explicit.stdout + explicit.stderr);
    assertMeasuredInput(explicit.directory);
    assertOwnedCleanup(explicit.directory);
    assert.equal(lifecycleEvents(explicit.directory).find(event => event.event === "chrome-endpoint").port, port);
    const after = await sentinel.observer.send("Target.getTargets");
    save("normal-sentinel-events.json", sentinel.observer.events);
    assert.deepEqual(sentinel.observer.events.filter(event => ["Target.targetCreated", "Target.targetDestroyed"].includes(event.message.method)), []);
    assert.ok(after.targetInfos.some((target: any) => target.targetId === sentinel.initial));
  } finally { await fixture.stop(); await sentinel.stop(); }
});

test("T119 actual owned Chrome exit interrupts pending work and preserves an independent sentinel", { timeout: 15000 }, async () => {
  const sentinel = await ownedSentinel("exit-sentinel");
  let killedAt = 0;
  const directory = path.join(out, "forced-chrome-exit");
  const fixture = createServer((request, response) => {
    if (request.url?.startsWith("/published/") && !killedAt) {
      const events = lifecycleEvents(directory);
      const started = events.find(event => event.event === "chrome-start");
      const endpoint = events.find(event => event.event === "chrome-endpoint");
      const argv = ["-p", String(started.pid), "-o", "pid=,command="];
      const ps = spawnSync("ps", argv, { encoding: "utf8" });
      save("forced-exit-owner.json", { argv: ["ps", ...argv], code: ps.status, stdout: ps.stdout, stderr: ps.stderr, started, endpoint, UTC: utc() });
      assert.equal(ps.status, 0);
      assert.ok(ps.stdout.includes(chrome!) && ps.stdout.includes(`--user-data-dir=${started.profile}`), "force exit only after confirming this CLI's recorded PID and unique profile");
      assert.equal(started.pid, endpoint.pid);
      assert.ok(started.profile.startsWith(directory + path.sep));
      killedAt = Date.now();
      process.kill(started.pid, "SIGTERM");
    }
    response.end('<!doctype html><div data-preview-state="loading">Transport exit boundary</div>');
  });
  await new Promise<void>(resolve => fixture.listen(0, "127.0.0.1", resolve));
  const address = fixture.address(); assert.ok(address && typeof address !== "string");
  try {
    const result = await runCollector("forced-chrome-exit", `http://127.0.0.1:${address.port}`, undefined, [], ["owned-input", "never-visited"]);
    assert.ok(killedAt > 0 && Date.now() - killedAt < 10000, "actual Chrome exit stops the CLI within 10s");
    assert.equal(result.code, 1);
    const rows = JSON.parse(readFileSync(path.join(directory, "report.json"), "utf8"));
    assert.equal(rows.length, 6);
    assert.equal(rows[0].status, "failed");
    assert.ok(rows.slice(1).every((row: any) => row.status === "not_run" && row.measurement === undefined));
    assert.ok(rows.every((row: any) => /DevTools connection|Owned Chrome exited/.test(row.failures.join("\n"))));
    assertOwnedCleanup(directory);
    const after = await sentinel.observer.send("Target.getTargets");
    save("forced-exit-sentinel-events.json", sentinel.observer.events);
    assert.deepEqual(sentinel.observer.events.filter(event => ["Target.targetCreated", "Target.targetDestroyed"].includes(event.message.method)), []);
    assert.ok(after.targetInfos.some((target: any) => target.targetId === sentinel.initial));
  } finally {
    await sentinel.stop();
    await new Promise<void>((resolve, reject) => fixture.close(error => error ? reject(error) : resolve()));
  }
});

for (const boundary of ["pending", "next-send"] as const) test(`T119 native socket close at ${boundary} rejects promptly and leaves later views explicitly unmeasured`, { timeout: 90000 }, async () => {
  const fixture = await publishedInput();
  const preload = path.join(out, `close-${boundary}.mjs`);
  // Only a real, owned socket is closed. All native CDP requests/responses and PNGs
  // remain untouched; this is fault input at the transport boundary, not a Cdp mock.
  writeFileSync(preload, `import fs from 'node:fs';
const Native=globalThis.WebSocket,records=[],boundary=${JSON.stringify(boundary)};let fired=false;
globalThis.WebSocket=class extends Native {
 constructor(...args){super(...args);this.closes=new Set();super.addEventListener('message',event=>{const message=JSON.parse(event.data);if(boundary==='next-send'&&this.closes.has(message.id)&&!fired){fired=true;records.push({at:Date.now(),kind:'forced-close'});this.close(1000,'T119 owned transport close');}});super.addEventListener('close',event=>records.push({at:Date.now(),kind:'native-close',code:event.code}));}
 send(raw){const request=JSON.parse(raw);records.push({at:Date.now(),kind:'send',method:request.method});if(request.method==='Target.closeTarget')this.closes.add(request.id);super.send(raw);if(boundary==='pending'&&request.method==='Target.createTarget'&&!fired){fired=true;records.push({at:Date.now(),kind:'forced-close'});this.close(1000,'T119 owned transport close');}}
};
process.on('exit',()=>fs.writeFileSync(${JSON.stringify(path.join(out, `close-${boundary}-native.json`))},JSON.stringify(records,null,2)));
`, { flag: "wx" });
  try {
    const result = await runCollector(`close-${boundary}`, fixture.base, undefined, ["--import", preload], [fixture.id, "unvisited-input"]);
    assert.equal(result.code, 1, result.stdout + result.stderr);
    const records = JSON.parse(readFileSync(path.join(out, `close-${boundary}-native.json`), "utf8"));
    const close = records.find((record: any) => record.kind === "forced-close");
    assert.ok(close && records.some((record: any) => record.kind === "native-close"));
    assert.ok(Date.now() - close.at < 10000, "the CLI terminates within 10s of the actual close, not another 60s per row");
    assert.equal(records.filter((record: any) => record.method === "Target.createTarget").length, 1, "no target requests after the forced closure");
    const rows = JSON.parse(readFileSync(path.join(result.directory, "report.json"), "utf8"));
    assert.equal(rows.length, 6, "all requested views are accounted for");
    assert.ok(rows.some((row: any) => row.status === "not_run"));
    for (const row of rows.filter((row: any) => row.status === "not_run" || row.status === "failed")) {
      assert.ok(row.failures.length && /DevTools connection|Owned Chrome exited/.test(row.failures.join("\n")));
      for (const key of ["measurement", "imageCredits", "english", "screenshot"]) assert.equal(row[key], undefined, "failed/unexecuted views cannot manufacture measurements");
    }
    assert.ok(lifecycleEvents(result.directory).some(event => event.event === "cdp-close"));
    assertOwnedCleanup(result.directory);
  } finally { await fixture.stop(); }
});

test("T119 an actual listener winning after port preflight cannot redirect the CLI into the sentinel browser", { timeout: 15000 }, async () => {
  const sentinel = await ownedSentinel("race-sentinel");
  const fixture = createServer((_request, response) => response.end('<!doctype html><div data-preview-state="error">Unvisited race fixture</div>'));
  await new Promise<void>(resolve => fixture.listen(0, "127.0.0.1", resolve));
  const address = fixture.address(); assert.ok(address && typeof address !== "string");
  const port = await unusedPort();
  const preload = path.join(out, "competing-listener.mjs");
  const evidence = path.join(out, "race-listener.json");
  const endpoint = sentinel.observer.ws.url;
  // Insert a real TCP listener in the preflight-to-spawn scheduling gap. It offers
  // a real sentinel endpoint if someone fetches /json/version. No CDP response is mocked.
  writeFileSync(preload, `import net from 'node:net';import http from 'node:http';import fs from 'node:fs';
const originalClose=net.Server.prototype.close,log=console.log.bind(console),events=[];let armed=true,competing;
net.Server.prototype.close=function(callback){const address=this.address();if(!armed||!address||address.port!==${port})return originalClose.call(this,callback);armed=false;
 return originalClose.call(this,error=>{if(error){callback(error);return;}competing=http.createServer((req,res)=>{events.push({kind:'request',url:req.url});res.setHeader('content-type','application/json');res.end(JSON.stringify({webSocketDebuggerUrl:${JSON.stringify(endpoint)}}));});
 competing.on('error',error=>{fs.writeFileSync(${JSON.stringify(evidence)},JSON.stringify({setupError:error.message}));process.exit(3);});
 competing.listen(${port},'127.0.0.1',()=>{events.push({kind:'listening',pid:process.pid,port:${port},at:Date.now()});fs.writeFileSync(${JSON.stringify(evidence)},JSON.stringify(events));callback();});});};
console.log=(...args)=>{log(...args);if(competing&&args.some(arg=>String(arg).startsWith('report: ')))competing.close(()=>{events.push({kind:'closed',at:Date.now()});fs.writeFileSync(${JSON.stringify(evidence)},JSON.stringify(events));});};
`, { flag: "wx" });
  try {
    const result = await runCollector("competition", `http://127.0.0.1:${address.port}`, port, ["--import", preload]);
    const events = JSON.parse(readFileSync(evidence, "utf8"));
    assert.ok(Array.isArray(events) && events.some(event => event.kind === "listening") && events.some(event => event.kind === "closed"), "a real competing listener actually occupied and released the explicit port");
    assert.deepEqual(events.filter(event => event.kind === "request"), [], "collector must never fetch a competitor's endpoint");
    const after = await sentinel.observer.send("Target.getTargets");
    save("competition-native-events.json", sentinel.observer.events);
    assert.deepEqual(sentinel.observer.events.filter(event => ["Target.targetCreated", "Target.targetDestroyed"].includes(event.message.method)), []);
    assert.ok(after.targetInfos.some((target: any) => target.targetId === sentinel.initial));
    assert.equal(result.code, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /could not bind port.*startup competition/);
    assert.match(readFileSync(path.join(result.directory, "chrome.stderr.raw"), "utf8"), /bind\(\) failed|Cannot start http server for devtools/i, "native Chrome, rather than setup, rejected the occupied port");
    const rows = JSON.parse(readFileSync(path.join(result.directory, "report.json"), "utf8"));
    for (const row of rows) { assert.equal(row.status, "not_run"); assert.equal(row.measurement, undefined); }
    assertOwnedCleanup(result.directory, false);
  } finally {
    await sentinel.stop();
    await new Promise<void>((resolve, reject) => fixture.close(error => error ? reject(error) : resolve()));
  }
});

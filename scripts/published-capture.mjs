import fs from "node:fs";
import { spawnSync } from "node:child_process";

// One boundary for a prepared full viewport, a single surface capture and bounded text-paint
// evidence. Existing screenshotInk discards coordinates by resizing to 48x48; retain Pillow
// (already used by check-published) and decode the actual PNG without adding a dependency.
// Geometry covers every visible text node, independently of the bounded paint samples.
// Range rectangles include inline text and wrapping; ancestor transforms affect them too.
const TEXT_GEOMETRY = `(() => {
  const regions=[],walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),range=document.createRange();
  while(walker.nextNode()){
    const node=walker.currentNode,el=node.parentElement;
    if(!node.textContent.trim()||!el||el.closest('script,style,noscript,template'))continue;
    let visible=true;
    for(let n=el;n;n=n.parentElement){const s=getComputedStyle(n);if(n.hidden||s.display==='none'||s.visibility!=='visible'||Number(s.opacity)===0){visible=false;break;}}
    if(!visible)continue;
    range.selectNodeContents(node);
    const rects=[...range.getClientRects()].filter(r=>r.width>0&&r.height>0).map(r=>({x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height}));
    if(rects.length)regions.push({block:el.closest('[data-sc-block]')?.getAttribute('data-sc-block')||null,slot:el.closest('[data-sitecraft-slot]')?.getAttribute('data-sitecraft-slot')||null,text:node.textContent,rects});
  }
  return regions;
})()`;
const STATE = `(() => {
  const rect = node => { if(!node)return null;const r=node.getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height}; };
  const visible = node => {
    if(!node)return false;
    for(let n=node;n;n=n.parentElement){const s=getComputedStyle(n);if(n.hidden||s.display==='none'||s.visibility!=='visible'||Number(s.opacity)===0)return false;}
    const r=node.getBoundingClientRect();return r.width>0&&r.height>0;
  };
  const rgba = value => {const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');ctx.fillStyle=value;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].map((v,i)=>i===3?v/255:v);};
  const over = (a,b) => {const alpha=a[3]+b[3]*(1-a[3]);return alpha?[0,1,2].map(i=>(a[i]*a[3]+b[i]*b[3]*(1-a[3]))/alpha).concat(alpha):[0,0,0,0];};
  const background = el => {
    const chain=[];for(let n=el;n;n=n.parentElement)chain.unshift(n);
    let colors=[[255,255,255,1]];
    for(const n of chain){
      const s=getComputedStyle(n);
      if(Number(s.opacity)!==1||s.mixBlendMode!=='normal'||s.filter!=='none')return null;
      let layers=[rgba(s.backgroundColor)];
      if(s.backgroundImage!=='none'){
        if(!/^(?:linear|radial|conic)-gradient\\(/.test(s.backgroundImage)||/url\\(|image-set\\(/.test(s.backgroundImage))return null;
        const tokens=s.backgroundImage.match(/rgba?\\([^)]*\\)|color\\([^)]*\\)|oklch\\([^)]*\\)|#[0-9a-f]{3,8}/gi);
        if(!tokens?.length)return null;
        layers=tokens.map(value=>over(rgba(value),layers[0]));
      }
      colors=layers.flatMap(layer=>colors.map(parent=>over(layer,parent)));
    }
    return colors.map(c=>c.slice(0,3));
  };
  const samples=[],blocks=[];
  for(const block of document.querySelectorAll('[data-sc-block]')){
    if(!visible(block))continue;
    const name=block.getAttribute('data-sc-block');blocks.push(name);
    const walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT);
    let selected=null;
    while(walker.nextNode()){
      const node=walker.currentNode,el=node.parentElement,slot=el?.closest('[data-sitecraft-slot]')?.getAttribute('data-sitecraft-slot')||null;
      const part=el?.closest('[data-sc-part="title"],[data-sc-part="body"]');
      if((!slot&&!part)||el?.closest('[data-sc-block]')!==block||!node.textContent.trim()||!visible(el)||el.closest('script,style,noscript,template'))continue;
      const backgrounds=background(el);if(!backgrounds)continue;
      const color=rgba(getComputedStyle(el).color),foreground=backgrounds.map(bg=>over(color,bg.concat(1)).slice(0,3));
      const glyphs=[],range=document.createRange();let offset=0;
      for(const character of node.textContent){
        const start=offset;offset+=character.length;
        if(/[\\s\\u200b\\u2060\\ufeff]/.test(character))continue;
        range.setStart(node,start);range.setEnd(node,offset);
        const r=range.getBoundingClientRect();if(r.width<=0||r.height<=0)continue;
        glyphs.push({character,rect:{x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height}});
        if(glyphs.length===16)break;
      }
      if(!glyphs.length)continue;
      selected={block:name,slot,boundary:slot?{kind:'slot',slot}:{kind:'declared-part',part:part.getAttribute('data-sc-part'),tag:part.tagName.toLowerCase()},text:glyphs.map(g=>g.character).join(''),foreground,backgrounds,glyphs};break;
    }
    samples.push(selected||{block:name,unmeasured:'no visible slot or declared title/body with a measurable CSS background'});
  }
  const frame=document.querySelector('iframe.open-source-template-frame');
  // The iframe's local text coordinates are projected by its host and ancestors.
  // Retain the actual viewport rectangles and computed transforms, including transforms
  // that change orientation while leaving an axis-aligned bounding rectangle unchanged.
  const projection=[];
  for(let n=frame;n;n=n.parentElement){
    const r=n.getBoundingClientRect(),s=getComputedStyle(n);
    projection.push({rect:{x:r.x,y:r.y,width:r.width,height:r.height},clientWidth:n.clientWidth,clientHeight:n.clientHeight,
      transform:s.transform,transformOrigin:s.transformOrigin,translate:s.translate,rotate:s.rotate,scale:s.scale,
      perspective:s.perspective,perspectiveOrigin:s.perspectiveOrigin,zoom:s.zoom});
  }
  const masks=[...document.querySelectorAll('.open-source-template-frame-loading,.open-source-template-frame-error')].filter(visible).map(n=>n.className);
  const slots=[...document.querySelectorAll('[data-sitecraft-slot],[data-sc-part="title"],[data-sc-part="body"]')].filter(visible).map(el=>{
    const range=document.createRange();range.selectNodeContents(el);
    return {block:el.closest('[data-sc-block]')?.getAttribute('data-sc-block')||null,slot:el.getAttribute('data-sitecraft-slot'),part:el.getAttribute('data-sc-part'),text:el.textContent,rect:rect(el),textRects:[...range.getClientRects()].map(r=>({x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height}))};
  });
  const covered=frame?[.01,.5,.99].some(f=>{const r=frame.getBoundingClientRect();const x=Math.max(0,Math.min(innerWidth-1,r.x+r.width/2)),y=Math.max(0,Math.min(innerHeight-1,r.y+r.height*f));return document.elementFromPoint(x,y)!==frame;}):false;
  const devIndicatorVisible=[...document.querySelectorAll('nextjs-portal')].some(portal=>[...(portal.shadowRoot?.querySelectorAll('button')||[])].some(button=>/dev tools/i.test(button.getAttribute('aria-label')||'')&&button.getBoundingClientRect().height>0));
  const dimensions=n=>n?{clientWidth:n.clientWidth,clientHeight:n.clientHeight,scrollWidth:n.scrollWidth,scrollHeight:n.scrollHeight}:null;
  return {url:location.href,locale:document.documentElement.lang,fonts:document.fonts.status,
    viewport:{width:innerWidth,height:innerHeight,scrollX,scrollY,visualWidth:visualViewport?.width,visualHeight:visualViewport?.height},
    html:dimensions(document.documentElement),body:dimensions(document.body),frame:frame?{rect:rect(frame),projection,hydrated:frame.dataset.previewHydrated,visible:visible(frame),covered}:null,
    ready:document.querySelector('[data-preview-state]')?.dataset.previewState,masks,devIndicatorVisible,footer:rect(document.querySelector('footer')),blocks,slots,textRegions:${TEXT_GEOMETRY},samples};
})()`;

// Passive capture-time observations are essential: the old screenshot path briefly changed
// width to 1 and restored it, so equal before/after readings alone accepted a different layout.
const WATCH = `(() => {
  const read=()=>(${STATE});
  const captureLayout=${layout.toString()};
  const before=read(),log={events:[],dropped:0,geometryFrames:0};
  const record=(kind,state=read())=>{if(log.events.length>=128){log.dropped++;return;}log.events.push({kind,at:performance.now(),state});};
  let previous=JSON.stringify(captureLayout(before)),animationFrame;
  const observeState=()=>{
    // WAAPI/CSS transforms need not emit a resize or DOM event. Use exactly the final
    // comparison's fields and save the same reading that detected a transient change.
    try {
      const state=read(),current=JSON.stringify(captureLayout(state));log.geometryFrames++;
      if(current!==previous){record('capture state frame',state);previous=current;}
    } catch(error) {log.dropped++;log.geometryError=String(error);return;}
    animationFrame=requestAnimationFrame(observeState);
  };
  animationFrame=requestAnimationFrame(observeState);
  const resized=()=>record('resize'),scrolled=()=>record('scroll');
  addEventListener('resize',resized,{passive:true});addEventListener('scroll',scrolled,{passive:true});
  const observer=new ResizeObserver(()=>record('ResizeObserver'));observer.observe(document.documentElement);
  if(document.body)observer.observe(document.body);
  const frame=document.querySelector('iframe.open-source-template-frame');if(frame)observer.observe(frame);
  const mutations=new MutationObserver(()=>record('DOM mutation'));
  mutations.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['style','class','hidden','open','data-preview-state','data-preview-hydrated','data-preview-refreshing']});
  window.__sitecraftCaptureWatch={finish:()=>{cancelAnimationFrame(animationFrame);observer.disconnect();mutations.disconnect();removeEventListener('resize',resized);removeEventListener('scroll',scrolled);if(!log.geometryFrames)log.dropped++;return log;}};
  return before;
})()`;
const FINISH = `(() => {const watch=window.__sitecraftCaptureWatch;delete window.__sitecraftCaptureWatch;return {state:${STATE},...(watch?watch.finish():{events:[],dropped:1})};})()`;

async function evaluate(browser, expression, sessionId) {
  const response = await browser.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId);
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
  return response.result.value;
}
async function states(browser, host, frame, expression = STATE) {
  const [page, document] = await Promise.all([evaluate(browser, expression, host), evaluate(browser, expression, frame)]);
  return { page, document };
}
function layout(state) {
  return { locale: state.locale, viewport: state.viewport, html: state.html, body: state.body, frame: state.frame, ready: state.ready, masks: state.masks, devIndicatorVisible: state.devIndicatorVisible, fonts: state.fonts, footer: state.footer, blocks: state.blocks, slots: state.slots, textRegions: state.textRegions, samples: state.samples };
}
function equalLayout(a, b) { return JSON.stringify(layout(a)) === JSON.stringify(layout(b)); }

const PAINT_PROBE = String.raw`from PIL import Image
import json,math,sys,itertools
image=Image.open(sys.argv[1]).convert('RGBA')
samples=json.load(sys.stdin)
rows=[]
def dot(a,b):return sum(x*y for x,y in zip(a,b))
def line_matches(p,a,b):
 d=[b[i]-a[i] for i in range(3)];length=dot(d,d)
 t=max(0,min(1,dot([p[i]-a[i] for i in range(3)],d)/length)) if length else 0
 return max(abs(p[i]-a[i]-t*d[i]) for i in range(3))<=1
def paint_mix(p,points):
 if any(max(abs(p[i]-a[i]) for i in range(3))<=1 for a in points):return True
 if any(line_matches(p,a,b) for a,b in itertools.combinations(points,2)):return True
 for a,b,c in itertools.combinations(points,3):
  u=[b[i]-a[i] for i in range(3)];v=[c[i]-a[i] for i in range(3)];q=[p[i]-a[i] for i in range(3)]
  uu=dot(u,u);vv=dot(v,v);uv=dot(u,v);det=uu*vv-uv*uv
  if abs(det)<1e-12:continue
  s=(dot(q,u)*vv-dot(q,v)*uv)/det;t=(dot(q,v)*uu-dot(q,u)*uv)/det
  if s>=0 and t>=0 and s+t<=1 and max(abs(q[i]-s*u[i]-t*v[i]) for i in range(3))<=1:return True
 return False
for sample in samples:
 if sample.get('unmeasured'):
  rows.append(dict(block=sample['block'],unmeasured=sample['unmeasured']));continue
 missing=[];cells=[]
 bg=sample['backgrounds'];fg=sample['foreground']
 low=[min(b[i] for b in bg) for i in range(3)];high=[max(b[i] for b in bg) for i in range(3)]
 points=list(dict.fromkeys(tuple(c) for c in bg+fg))
 for glyph in sample['glyphs']:
  r=glyph['rect'];box=(math.floor(r['x']),math.floor(r['y']),math.ceil(r['x']+r['width']),math.ceil(r['y']+r['height']))
  if box[0]<0 or box[1]<0 or box[2]>image.width or box[3]>image.height:
   missing.append(glyph['character']);cells.append(dict(character=glyph['character'],box=box,clipped=True));continue
  colors=image.crop(box).getcolors((box[2]-box[0])*(box[3]-box[1])) or []
  # Half a channel unit is PNG's 8-bit rounding boundary, not a tunable ink/variance limit.
  # Require nonuniform pixels AND foreground influence outside the CSS background envelope.
  # This proves sampled paint in glyph cells, not the identity/meaning of a character.
  ink=0;visibleColors=set()
  for count,p in colors:
   alpha=p[3]/255
   visible=[tuple(p[i]*alpha+b[i]*(1-alpha) for i in range(3)) for b in bg]
   visibleColors.update(visible)
   # A color envelope alone accepts unrelated colored noise. Require a mixture of the
   # measured CSS colors. One channel unit bounds rounding in the projected 8-bit mix.
   if any(any(v[i]<low[i]-.5 or v[i]>high[i]+.5 for i in range(3)) and paint_mix(v,points) for v in visible):ink+=count
  painted=len(visibleColors)>1 and ink>0
  if not painted:missing.append(glyph['character'])
  cells.append(dict(character=glyph['character'],box=box,foregroundPixels=ink,alphaRange=[min(p[3] for _,p in colors),max(p[3] for _,p in colors)],painted=painted))
 rows.append(dict(block=sample['block'],slot=sample['slot'],boundary=sample['boundary'],text=sample['text'],cells=cells,missing=missing))
print(json.dumps(dict(width=image.width,height=image.height,scope='sampled declared text glyph cells only; no OCR, image coverage or complete semantic proof',samples=rows)))
`;

function inspectPaint(file, samples) {
  const probe = spawnSync("python3", ["-c", PAINT_PROBE, file], { input: JSON.stringify(samples), encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
  if (probe.status !== 0) return { scope: "unmeasured", samples: [], failures: [`screenshot content unmeasured: PNG decode/paint probe failed (${probe.stderr.trim() || probe.error?.message || probe.status})`] };
  const report = JSON.parse(probe.stdout);
  report.failures = report.samples.flatMap(sample => sample.unmeasured
    ? [`screenshot content unmeasured: ${sample.block} (${sample.unmeasured})`]
    : sample.missing.length ? [`screenshot content missing: ${sample.block} ${sample.slot || `${sample.boundary.part}@${sample.boundary.tag}`} (${sample.missing.length}/${sample.cells.length} sampled glyph cells)`] : []);
  if (!report.samples.length) report.failures.push("screenshot content unmeasured: no visible declared text regions");
  return report;
}

/** Prepare once, inspect the final layout, capture once, and reject missing/changed evidence. */
export async function capturePublishedPage(browser, host, frame, { width, file, inspect, timeoutMs = 10000 }) {
  const initial = await states(browser, host, frame);
  const end = state => Math.ceil(Math.max(state.html.scrollHeight, state.body.scrollHeight, state.footer ? state.footer.y + state.footer.height : 0));
  // One extra CSS pixel prevents a rounded footer/document boundary from preserving a stale
  // scrollbar. Grow only if content exceeds the viewport; viewport-derived min-height alone
  // cannot trigger repeated growth. Width always remains the requested acceptance width.
  let height = end(initial.document) + 1;
  const deadline = Date.now() + timeoutMs;
  let previous = null, stable = 0;
  while (Date.now() < deadline) {
    await browser.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 500 }, host);
    await evaluate(browser, `(() => {for(const el of document.querySelectorAll('.published-template-shell,.published-template-stage,.open-source-template-frame-shell,iframe.open-source-template-frame')){el.style.height='${height}px';el.style.minHeight='${height}px';el.style.overflow='visible';}scrollTo({top:0,behavior:'instant'});})()`, host);
    await evaluate(browser, "scrollTo({top:0,behavior:'instant'})", frame);
    await evaluate(browser, "new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))", frame);
    const current = await states(browser, host, frame);
    if (current.document.viewport.width !== width || current.page.viewport.width !== width) throw new Error("screenshot preparation changed the requested page width");
    const needed = end(current.document);
    if (needed > height) { height = needed + 1; previous = null; stable = 0; continue; }
    stable = previous && equalLayout(previous.document, current.document) && equalLayout(previous.page, current.page) && current.document.fonts === "loaded" ? stable + 1 : 0;
    previous = current;
    if (stable >= 2) break;
  }
  if (stable < 2) throw new Error("screenshot preparation did not reach a stable full viewport, fonts and footer");
  const report = await inspect();
  await evaluate(browser, "new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))", frame);
  const before = await states(browser, host, frame, WATCH);
  const page = before.page, document = before.document;
  const pageHeight = Math.max(page.html.scrollHeight, page.body.scrollHeight);
  const footerBottom = document.footer ? document.footer.y + document.footer.height : null;
  if (page.viewport.width !== width || document.viewport.width !== width || page.viewport.scrollY || document.viewport.scrollY || page.masks.length || page.ready !== "ready" || !page.frame?.visible || page.frame.covered || page.frame.hydrated !== "true") throw new Error("screenshot final host/frame width, scroll, readiness or mask state is invalid");
  if (pageHeight > page.viewport.height || page.frame.rect.height < end(document) || page.frame.rect.y + footerBottom > pageHeight) throw new Error("screenshot clip lies outside prepared viewport or would truncate the iframe/footer");
  if (!equalLayout(previous.page, page) || !equalLayout(previous.document, document)) throw new Error("screenshot final inspection changed the prepared layout");
  const shot = await browser.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false, clip: { x: 0, y: 0, width, height: pageHeight, scale: 1 } }, host);
  const bitmap = Buffer.from(shot.data, "base64");fs.writeFileSync(file, bitmap);
  const after = await states(browser, host, frame, FINISH);
  const failures = [];
  for (const side of ["page", "document"]) {
    if (after[side].dropped) failures.push(`screenshot layout unmeasured: ${side} capture-time events were lost`);
    if (!equalLayout(before[side], after[side].state) || after[side].events.some(event => !equalLayout(before[side], event.state))) failures.push(`screenshot layout changed during capture: ${side} viewport, scroll, text regions or footer`);
  }
  const paint = inspectPaint(file, document.samples);
  failures.push(...paint.failures);
  const screenshotGeometry = { pageHeight, frameTop: page.frame.rect.y, frameHeight: page.frame.rect.height, width, frameDocumentHeight: end(document), footerBottom, devIndicatorVisible: page.devIndicatorVisible, pngWidth: paint.width ?? bitmap.readUInt32BE(16), pngHeight: paint.height ?? bitmap.readUInt32BE(20) };
  return { ...report, screenshot: file, screenshotGeometry, screenshotContent: paint, screenshotState: { before, after, captureBeyondViewport: false }, captureFailures: failures };
}

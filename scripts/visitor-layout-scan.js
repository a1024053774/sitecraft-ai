// Browser-only. Compare actual text-line rectangles, never the unused boxes of closed details.
const LAYOUT_DECLARATION_ATTRIBUTES = [
  "data-sc-layout-declaration",
  "data-sc-layout-declarations",
  "data-sc-variant-declaration",
  "data-sc-variant-declarations",
];
// T-090 consumes declarations exposed by the mounted block variant. A declaration contains
// selector data only; selectors are never inferred from classes, text, or element order. Until a
// variant exposes this payload, the rule is recorded as 未声明 and no visual check is run.
const LAYOUT_RULE_KEYS = ["baseline", "spacing", "buttons"];
const VAGUE_PRIMARY_COPY = new Set([
  "了解更多", "更多", "查看详情", "详情", "learn more", "view more", "read more", "get started",
]);

const own = (value, key) => Boolean(value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, key));

function parseLayoutDeclaration(value) {
  if (typeof value !== "string") return value && typeof value === "object" ? value : null;
  try { return JSON.parse(value); } catch { return null; }
}

function selectorsFromDeclaration(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(selectorsFromDeclaration);
  if (!value || typeof value !== "object") return [];
  if (typeof value.selector === "string") return [value.selector];
  if (Array.isArray(value.selectors)) return value.selectors.flatMap(selectorsFromDeclaration);
  if (Array.isArray(value.members)) return value.members.flatMap(selectorsFromDeclaration);
  if (Array.isArray(value.nodes)) return value.nodes.flatMap(selectorsFromDeclaration);
  return [];
}

function groupsFromDeclaration(value, prefix) {
  if (Array.isArray(value)) return value.map((entry, index) => ({
    id: String(entry?.id || entry?.name || `${prefix}-${index + 1}`),
    selectors: selectorsFromDeclaration(entry),
    ...(own(entry, "minViewportWidth") ? { minViewportWidth: entry.minViewportWidth } : {}),
  }));
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).map(([id, entry]) => ({ id, selectors: selectorsFromDeclaration(entry), ...(own(entry, "minViewportWidth") ? { minViewportWidth: entry.minViewportWidth } : {}) }));
}

function normalizeLayoutDeclaration(raw) {
  const parsed = parseLayoutDeclaration(raw);
  if (!parsed || typeof parsed !== "object") return null;
  const variant = parsed.variant && typeof parsed.variant === "object" ? parsed.variant : parsed;
  const nested = variant.declarations && typeof variant.declarations === "object" ? variant.declarations : variant;
  const baselineValue = own(nested, "baselineGroups") ? nested.baselineGroups : (own(nested, "baseline") ? (nested.baseline?.groups ?? nested.baseline) : undefined);
  const semanticValue = own(nested, "semanticGroups") ? nested.semanticGroups
    : (own(nested, "spacingGroups") ? nested.spacingGroups : (own(nested, "spacing") ? (nested.spacing?.groups ?? nested.spacing) : undefined));
  const buttonsValue = own(nested, "buttonRoles") ? nested.buttonRoles
    : (own(nested, "buttons") ? nested.buttons : (own(nested, "buttonRole") ? nested.buttonRole : undefined));
  const buttonRoles = { primary: [], secondary: [] };
  if (Array.isArray(buttonsValue)) {
    for (const entry of buttonsValue) {
      const role = entry?.role === "secondary" ? "secondary" : entry?.role === "primary" ? "primary" : null;
      if (role) buttonRoles[role].push(...selectorsFromDeclaration(entry));
    }
  } else if (buttonsValue && typeof buttonsValue === "object") {
    buttonRoles.primary = selectorsFromDeclaration(buttonsValue.primary);
    buttonRoles.secondary = selectorsFromDeclaration(buttonsValue.secondary);
  }
  const hasBaseline = baselineValue !== undefined;
  const hasSpacing = semanticValue !== undefined;
  const hasButtons = buttonsValue !== undefined;
  if (!hasBaseline && !hasSpacing && !hasButtons) return null;
  return {
    baselineGroups: groupsFromDeclaration(baselineValue, "baseline"),
    semanticGroups: groupsFromDeclaration(semanticValue, "semantic"),
    buttonRoles,
    declared: { baseline: hasBaseline, spacing: hasSpacing, buttons: hasButtons },
  };
}

function declarationForBlock(block, root) {
  let raw = null;
  for (const attribute of LAYOUT_DECLARATION_ATTRIBUTES) {
    if (block.hasAttribute(attribute)) { raw = block.getAttribute(attribute); break; }
  }
  const documentElement = root?.documentElement;
  const global = root?.defaultView?.__SITECRAFT_VARIANT_DECLARATIONS
    || documentElement?.__SITECRAFT_VARIANT_DECLARATIONS
    || parseLayoutDeclaration(documentElement?.getAttribute("data-sc-layout-declarations"));
  if (raw == null && global && typeof global === "object") {
    const blockId = block.getAttribute("data-sc-block") || "";
    const variantId = block.getAttribute("data-sc-variant") || "";
    raw = global[`${blockId}:${variantId}`] ?? global[blockId]?.[variantId] ?? global[blockId];
  }
  const parsed = parseLayoutDeclaration(raw);
  const variantId = block.getAttribute("data-sc-variant") || "";
  if (parsed && typeof parsed === "object" && parsed.variants && parsed.variants[variantId]) return normalizeLayoutDeclaration(parsed.variants[variantId]);
  if (parsed && typeof parsed === "object" && parsed[variantId] && !parsed.baselineGroups && !parsed.semanticGroups && !parsed.buttonRoles) return normalizeLayoutDeclaration(parsed[variantId]);
  return normalizeLayoutDeclaration(parsed);
}

const scanHeroTitle = (root) => {
  const title = root?.matches?.("h1") ? root : root?.querySelector?.("h1");
  const result = { heroOrphan: false, heroTitleWordBreak: false };
  if (!title || typeof Intl?.Segmenter !== "function") return result;
  const range = document.createRange();
  const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT);
  const chars = [];
  let offset = 0;
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const text = node.textContent || "";
    for (let index = 0; index < text.length; index += 1) {
      range.setStart(node, index); range.setEnd(node, index + 1);
      const rect = range.getClientRects()[0] || range.getBoundingClientRect();
      if (rect.width > 0.5 && rect.height > 0.5) chars.push({ offset: offset + index, char: text[index], parent: node.parentElement, rect });
    }
    offset += text.length;
  }
  const lines = new Map();
  for (const item of chars) {
    if (!item.char.trim()) continue;
    const top = Math.round(item.rect.top);
    lines.set(top, [...(lines.get(top) || []), item.char]);
  }
  const tops = [...lines.keys()].sort((a, b) => a - b);
  const lastLine = tops.length > 1 ? lines.get(tops[tops.length - 1]) || [] : [];
  const lastItems = chars.filter((item) => Math.round(item.rect.top) === tops[tops.length - 1] && item.char.trim());
  const shortWord = lastLine.length <= 2 && /^[\u3400-\u9fff]+$/.test(lastLine.join("")) && lastItems.every((item) => item.parent?.getAttribute("data-sitecraft-hero-word") === "true");
  result.heroOrphan = (lastLine.length === 1 && /[\u3400-\u9fff]/.test(lastLine[0])) || shortWord;
  const lineWidth = title.clientWidth || title.getBoundingClientRect().width;
  const segments = Array.from(new Intl.Segmenter("zh", { granularity: "word" }).segment(title.textContent || ""));
  const tail = segments[segments.length - 1];
  const previous = segments[segments.length - 2];
  if (tail && previous && tail.isWordLike && previous.isWordLike && tail.segment.length === 1 && /[\u3400-\u9fff]/.test(tail.segment) && /[\u3400-\u9fff]$/.test(previous.segment)) {
    previous.segment += tail.segment;
    segments.pop();
  }
  const naturalWidth = (word) => {
    const probe = document.createElement("span");
    const style = getComputedStyle(title);
    probe.textContent = word;
    probe.style.cssText = `position:absolute;left:-100000px;top:0;visibility:hidden;white-space:nowrap;font:${style.font};letter-spacing:${style.letterSpacing};font-weight:${style.fontWeight}`;
    document.body.appendChild(probe);
    const width = probe.getBoundingClientRect().width;
    probe.remove();
    return width;
  };
  for (const part of segments) {
    const word = String(part.segment || "");
    if (!part.isWordLike || word.length < 2 || /^\s+$/.test(word)) continue;
    const own = chars.filter((item) => item.offset >= part.index && item.offset < part.index + word.length);
    if (own.length < 2) continue;
    const left = Math.min(...own.map((item) => item.rect.left));
    const right = Math.max(...own.map((item) => item.rect.right));
    if (naturalWidth(word) > lineWidth + 1) continue;
    const top = own[0].rect.top;
    if (own.some((item) => Math.abs(item.rect.top - top) > 1)) result.heroTitleWordBreak = true;
  }
  return result;
};

export function scanVisitorLayout(root = document, systemBackdropColors = {}, generatedLayout = null) {
  const blockFor = el => el.closest('[data-sc-block]')?.getAttribute('data-sc-block') || '页面';
  // T-195：只认文字自身的计算 visibility 和有盒元素的完整 sr-only 写法。
  // opacity、content-visibility 及其他裁切不作排除；保留完整 Range，允许误拒。
  const hidden = new WeakMap();
  const fullyHidden = (el,pseudo=null) => {
    if(!el) return false;
    if(!pseudo&&hidden.has(el)) return hidden.get(el);
    // visibility 可继承，也可被后代覆盖，不能用祖先值代替文字自身的值。
    let result=getComputedStyle(el,pseudo).visibility!=='visible';
    for(let p=el;!result&&p;p=p.parentElement) {
      const s=getComputedStyle(p);
      // contents 没有盒子，普通 inline 的尺寸与 overflow 不构成 sr-only 裁切。
      if(!/^(block|inline-block|flow-root|flex|inline-flex|grid|inline-grid|table-caption)$/.test(s.display)||
        !/^(hidden|clip)$/.test(s.overflowX)||!/^(hidden|clip)$/.test(s.overflowY)) continue;
      // 旧 clip 只作用于 absolute/fixed；不靠未生效的声明证明隐藏。
      const zeroClip=/^(absolute|fixed)$/.test(s.position)&&/^rect\(0px[, ]+0px[, ]+0px[, ]+0px\)$/.test(s.clip);
      if(!zeroClip&&s.clipPath!=='inset(50%)') continue;
      const rects=p.getClientRects();
      if(rects.length&&[...rects].every(r=>r.width<=1&&r.height<=1)) result=true;
    }
    if(!pseudo) hidden.set(el,result);
    return result;
  };
  const measuredRect = (el,rect,pseudo=null) => {
    if(fullyHidden(el,pseudo)) return null;
    const {left,right,top,bottom}=rect;
    return right>left&&bottom>top?{left,right,top,bottom,width:right-left,height:bottom-top}:null;
  };
  const visible = el => !!el&&[...el.getClientRects()].some(rect=>measuredRect(el,rect));
  const keyFor = el => {
    const path=[];
    for(let p=el;p&&p!==document.body;p=p.parentElement) {
      if(!p.parentElement) {path.unshift(p.tagName);break;}
      path.unshift(`${p.tagName}:${[...p.parentElement.children].indexOf(p)}`);
    }
    return path.join('/');
  };
  const overflowElements=[];
  for(const el of root.querySelectorAll('body *')) {
    if(!visible(el)) continue;
    const r=measuredRect(el,el.getBoundingClientRect());
    if(!r) continue;
    const amount=Math.max(r.right-innerWidth,-r.left,0);
    if(amount>1) overflowElements.push({block:blockFor(el),key:keyFor(el),amount:Math.ceil(amount)});
  }
  const walker=document.createTreeWalker(root.body||root,NodeFilter.SHOW_TEXT);
  const range=document.createRange(), lines=[];
  while(walker.nextNode()) {
    const n=walker.currentNode, el=n.parentElement;
    if(!n.textContent.trim()||fullyHidden(el)) continue;
    range.selectNodeContents(n);
    const key=`${keyFor(el)}:${[...el.childNodes].indexOf(n)}:${n.textContent.trim()}`;
    const fontSize=parseFloat(getComputedStyle(el).fontSize);
    for(const rect of range.getClientRects()) {
      const textRect=measuredRect(el,rect);
      if(textRect) {
        const amount=Math.max(textRect.right-innerWidth,-textRect.left,0);
        if(amount>1&&!overflowElements.some(item=>item.key===keyFor(el))) overflowElements.push({block:blockFor(el),key:keyFor(el),amount:Math.ceil(amount)});
      }
      if(rect.width<=.5||rect.height<=.5) continue;
      // Use the same em box for every text fragment, including inline descendants.
      const height=Math.min(rect.height,fontSize),top=rect.top+(rect.height-height)/2;
      const painted=measuredRect(el,{left:rect.left,right:rect.right,top,bottom:top+height});
      if(painted) lines.push({el,rect:painted,key});
    }
  }
  // 每次核对非空 content 与快照的覆盖，空列表不代表已完整测量。
  generatedLayout=[...(generatedLayout||[])];
  for(const el of root.querySelectorAll('*')) for(const pseudo of ['::before','::after','::marker']) {
    const content=getComputedStyle(el,pseudo).content;
    // normal 在 marker 上仍会绘制原生编号／圆点，缺快照不能当成空文字。
    const nativeMarker=pseudo==='::marker'&&/\blist-item\b/.test(getComputedStyle(el).display)
      &&! /^(none|""|'')$/.test(getComputedStyle(el).listStyleType);
    if(!content||/^(none|""|'')$/.test(content)||content==='normal'&&!nativeMarker) continue;
    const path=[];for(let p=el;p.parentElement;p=p.parentElement)path.unshift([...p.parentElement.children].indexOf(p));
    // 无字绘制盒不能冒充非空 content 的文字覆盖证明。
    if(!generatedLayout.some(item=>item.text.trim()&&item.pseudo===pseudo&&item.path.length===path.length&&item.path.every((value,index)=>value===path[index])))
      generatedLayout.push({path,pseudo,text:content,rects:[]});
  }
  const layoutPseudos=generatedLayout.map(item=>{
    let el=document.documentElement;
    for(const index of item.path) el=el?.children[index];
    if(!el) throw new Error('CSS 生成文字无法定位当前元素，本次未保存版本。');
    return {...item,el,key:`${keyFor(el)}${item.pseudo}`};
  });
  // 空文字仍保留绘制盒用于叠层核对；只有非空文字进入文字扫描。
  // Chrome 已给出非空文字时，以实际文字为准，不用 computed content 再删快照行。
  const generated=layoutPseudos.filter(item=>item.text.trim()&&!fullyHidden(item.el,item.pseudo));
  for(const item of generated) {
    const fontSize=parseFloat(getComputedStyle(item.el,item.pseudo).fontSize);
    for(const rect of item.rects) {
      const amount=Math.max(rect.right-innerWidth,-rect.left,0);
      if(rect.width>0&&rect.height>0&&amount>1&&!overflowElements.some(entry=>entry.key===item.key)) overflowElements.push({block:blockFor(item.el),key:item.key,amount:Math.ceil(amount)});
      if(rect.width<=.5||rect.height<=.5) continue;
      const height=Math.min(rect.height,fontSize),top=rect.top+(rect.height-height)/2;
      const painted=measuredRect(item.el,{left:rect.left,right:rect.right,top,bottom:top+height},item.pseudo);
      if(painted) lines.push({el:item.el,rect:painted,key:item.key,target:item.key});
    }
  }
  const heroTitle = root.querySelector('[data-sc-block="hero"] h1');
  let heroTitleOrphan = false;
  if (heroTitle && visible(heroTitle)) {
    const characterLines = [];
    const titleWalker = document.createTreeWalker(heroTitle, NodeFilter.SHOW_TEXT);
    while (titleWalker.nextNode()) {
      const node = titleWalker.currentNode;
      for (let i = 0; i < node.textContent.length; i++) {
        range.setStart(node, i); range.setEnd(node, i + 1);
        const rect = range.getBoundingClientRect();
        if (rect.width > .5 && rect.height > .5) characterLines.push({ char: node.textContent[i], top: Math.round(rect.top) });
      }
    }
    const grouped = new Map();
    for (const item of characterLines) grouped.set(item.top, [...(grouped.get(item.top) || []), item.char]);
    const tops = [...grouped.keys()].sort((a, b) => a - b);
    const last = tops.length > 1 ? grouped.get(tops[tops.length - 1]) : [];
    heroTitleOrphan = Boolean(last?.length === 1 && /[\u3400-\u9fff]/.test(last[0]));
  }
  const heroTitleScan = scanHeroTitle(heroTitle);
  const heroTitleWordBreak = heroTitleScan.heroTitleWordBreak;
  heroTitleOrphan = heroTitleScan.heroOrphan;
  const textOverlaps=[];
  for(let i=0;i<lines.length;i++) for(let j=i+1;j<lines.length;j++) {
    const a=lines[i], b=lines[j];
    // Fragments on one line may repeat; distinct lines in the same element can overlap.
    if(a.el===b.el&&a.target===b.target&&Math.abs(a.rect.top-b.rect.top)<1&&Math.abs(a.rect.bottom-b.rect.bottom)<1) continue;
    const x=Math.min(a.rect.right,b.rect.right)-Math.max(a.rect.left,b.rect.left);
    const y=Math.min(a.rect.bottom,b.rect.bottom)-Math.max(a.rect.top,b.rect.top);
    if(x>2&&y>2) textOverlaps.push({block:blockFor(a.el),amount:Math.min(x,y),key:[a.key,b.key].sort().join('::'),targets:[a.target||keyFor(a.el),b.target||keyFor(b.el)]});
  }
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const rgba = color => {
    if (!ctx || typeof color !== 'string') return null;
    ctx.clearRect(0,0,1,1);
    ctx.fillStyle=color;
    ctx.fillRect(0,0,1,1);
    return [...ctx.getImageData(0,0,1,1).data].map((v,i)=>i===3?v/255:v);
  };
  const withAlpha=(color,alpha)=>[color[0],color[1],color[2],color[3]*Math.max(0,Math.min(1,alpha))];
  const over=(fg,bg)=>{
    const alpha=fg[3]+bg[3]*(1-fg[3]);
    if(alpha<=0) return [0,0,0,0];
    return [0,1,2].map(i=>(fg[i]*fg[3]+bg[i]*bg[3]*(1-fg[3]))/alpha).concat(alpha);
  };
  const luminance=c=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((v,c,i)=>v+c*[.2126,.7152,.0722][i],0);
  const ratioFor = (fg,bg) => {
    const a=luminance(fg),b=luminance(bg);
    return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  };
  const splitTopLevel = value => {
    const parts=[];let start=0;let depth=0;
    for(let index=0;index<value.length;index++){
      const char=value[index];
      if(char==='(') depth+=1;
      else if(char===')') depth=Math.max(0,depth-1);
      else if(char===','&&depth===0){parts.push(value.slice(start,index).trim());start=index+1;}
    }
    parts.push(value.slice(start).trim());
    return parts.filter(Boolean);
  };
  const gradientColors = (image,layerIndex) => {
    const match=/^(?:linear|radial|conic)-gradient\((.*)\)$/i.exec(image.trim());
    if(!match) return {error:`背景第${layerIndex+1}层无法解析`};
    const colors=[];
    const stops=splitTopLevel(match[1]);
    for(let stopIndex=0;stopIndex<stops.length;stopIndex++){
      const stop=stops[stopIndex];
      const token=/(rgba?\([^)]*\)|#[0-9a-f]{3,8}|transparent)$/i.exec(stop.trim())?.[1]
        || /(rgba?\([^)]*\)|#[0-9a-f]{3,8}|transparent)/i.exec(stop.trim())?.[1];
      const prelude=stopIndex===0&&/^(?:to\s+|from\s+|(?:[-+]?\d*\.?\d+)(?:deg|grad|rad|turn)|(?:ellipse|circle)(?:\s+at\s+)?)/i.test(stop.trim());
      if(!token){
        if(prelude) continue;
        return {error:`渐变第${layerIndex+1}层第${stopIndex+1}个色标无法解析`};
      }
      const color=rgba(token);
      if(!color) return {error:`渐变第${layerIndex+1}层第${stopIndex+1}个色标无法解析`};
      colors.push(color);
    }
    return colors.length ? {colors} : {error:`渐变第${layerIndex+1}层没有可解析色标`};
  };
  const backgroundLayers = image => {
    if(!image||image==='none') return {known:true,layers:[]};
    const layers=[];
    for(const [index,layer] of splitTopLevel(image).entries()){
      const url=/^url\("([^"]+)"\)$/.exec(layer)?.[1];
      if(url){
        const colors=systemBackdropColors[url];
        if(!colors) return {known:false,reason:'图片背景无法核对'};
        layers.push(colors);continue;
      }
      const parsed=gradientColors(layer,index);
      if(parsed.error) return {known:false,reason:parsed.error};
      layers.push(parsed.colors);
    }
    return {known:true,layers};
  };
  const hasBackground = style => style.backgroundImage!=='none'||rgba(style.backgroundColor)?.[3]!==0;
  const hasPseudoPaint = paint => {
    if(paint.content==='none'||paint.display==='none'||paint.visibility!=='visible') return false;
    const borderPaint=['Top','Right','Bottom','Left'].some(side=>parseFloat(paint[`border${side}Width`])>0&&rgba(paint[`border${side}Color`])?.[3]>0);
    return paint.backgroundImage!=='none'||rgba(paint.backgroundColor)?.[3]>0||paint.boxShadow!=='none'||paint.backdropFilter!=='none'||borderPaint;
  };
  const pseudoPaints=layoutPseudos.filter(item=>item.paintRects?.length&&hasPseudoPaint(getComputedStyle(item.el,item.pseudo)));
  // 构思主控 2026-10-20：只测最简单的绘制条件，不推断堆叠顺序。
  const generatedPaintReason = (el,pseudo) => {
    const host=getComputedStyle(el),paint=getComputedStyle(el,pseudo);
    if(host.zIndex!=='auto'||paint.zIndex!=='auto') return '伪元素叠层无法核对实际底图';
    if(pseudo==='::marker'&&host.listStylePosition!=='outside'&&hasBackground(host)) return '伪元素叠层无法核对实际底图';
    return '';
  };
  const backgroundFor = (el,sampleRects=null,pseudo=null) => {
    const chain=[];for(let p=el;p;p=p.parentElement)chain.unshift(p);
    const paints=chain.map(p=>getComputedStyle(p));
    if(pseudo) paints.push(getComputedStyle(el,pseudo));
    // T-199：正文与生成文字共用白名单，不按效果强弱或是否有 URL 背景推断。
    const refuseEffect=(node,fragment,property)=>({known:false,
      reason:`${pseudo?'CSS 生成文字的':''}视觉效果 ${property} 位于 ${node.id?'#'+node.id+' ':''}${keyFor(node)||'body'}${fragment}，对比度无法测量`,
      effect:{key:keyFor(node),pseudo:fragment,property}});
    for(const [index,style] of paints.entries()){
      const node=chain[index]||el,fragment=index===chain.length?pseudo:'';
      if(style.filter!=='none') return refuseEffect(node,fragment,'filter');
      // 参数不创建遮罩图像；标准属性与前缀别名的每个图层均为 none 才放行。
      if([style.maskImage,style.getPropertyValue('-webkit-mask-image')].some(image=>splitTopLevel(image).some(layer=>layer!=='none')))
        return refuseEffect(node,fragment,'mask / mask-image');
      if(style.clipPath!=='none') return refuseEffect(node,fragment,'clip-path');
      if(parseFloat(style.webkitTextStrokeWidth)!==0) return refuseEffect(node,fragment,'-webkit-text-stroke');
      if(fragment) continue;
      for(const textFragment of ['::first-line','::first-letter']){
        const paint=getComputedStyle(node,textFragment);
        const changed=paint.color!==style.color?'color':hasBackground(paint)?'background':paint.opacity!=='1'?'opacity':'';
        if(changed) return refuseEffect(node,textFragment,`${textFragment} ${changed}`);
      }
    }
    if(pseudo){
      const reason=generatedPaintReason(el,pseudo);
      if(reason) return {known:false,reason};
    }
    const hasBackdrop=paints.some(paint=>/url\(/i.test(paint.backgroundImage));
    let backgrounds=[[255,255,255,1]], foregroundOpacity=1;
    for(const [index,style] of paints.entries()){
      const p=chain[index];
      if(style.mixBlendMode&&style.mixBlendMode!=='normal') return {known:false,reason:'混合图层'};
      if(hasBackdrop&&/\binset\b/.test(style.boxShadow)) return {known:false,reason:'内阴影无法核对实际底图'};
      if(hasBackdrop&&style.backgroundBlendMode.split(',').some(mode=>mode.trim()!=='normal')) return {known:false,reason:'背景混合无法核对实际叠底'};
      const color=rgba(style.backgroundColor);
      if(!color) return {known:false,reason:'背景颜色无法解析'};
      if((hasBackdrop||pseudo)&&p){
        // 其他伪元素即使没有文字也可能绘制背景，不能凭 content 为空跳过。
        for(const layerPseudo of ['::before','::after']){
          if(p===el&&layerPseudo===pseudo) continue;
          const paint=getComputedStyle(p,layerPseudo);
          if(!hasPseudoPaint(paint)) continue;
          // 同底色仍可能从文字上方遮挡前景；无法证明绘制顺序与实际叠底时拒收。
          return {known:false,reason:'伪元素叠层无法核对实际底图'};
        }
      }
      const parsedBackground=backgroundLayers(style.backgroundImage);
      if(!parsedBackground.known) return {known:false,reason:parsedBackground.reason};
      const layers=parsedBackground.layers;
      let paintsText=true;
      // 已通过绘制门禁；这里只核实底色覆盖，不能据此证明文字未被遮挡。
      const sameSolidBackdrop=!layers.length&&backgrounds.every(bg=>color.every((value,index)=>value===bg[index]));
      if(pseudo&&sampleRects?.length&&(color[3]>0||layers.length)&&!sameSolidBackdrop) {
        // 只在背景盒完整覆盖文字行时叠加；完全不相交的宿主不提供底色。
        // 部分覆盖、特殊背景形状或伪元素自身无可核实盒子时保守拒收。
        if(!p||style.backgroundClip!=='border-box'||style.borderRadius!=='0px'
          ||chain.slice(0,index+1).some(node=>{
            const s=getComputedStyle(node);
            return s.transform!=='none'||s.rotate!=='none'||s.scale!=='none'||s.perspective!=='none'||s.clipPath!=='none'||s.clip!=='auto';
          })) return {known:false,reason:'CSS 生成文字无法核实实际背景覆盖'};
        const boxes=[...p.getClientRects()];
        const covers=sampleRects.every(rect=>boxes.some(box=>box.left<=rect.left&&box.right>=rect.right&&box.top<=rect.top&&box.bottom>=rect.bottom));
        const disjoint=sampleRects.every(rect=>boxes.every(box=>box.right<=rect.left||box.left>=rect.right||box.bottom<=rect.top||box.top>=rect.bottom));
        // html/body 的背景可能铺到画布，不能以盒子不相交断言它未绘制。
        if(!covers&&(!disjoint||p===document.body||p===document.documentElement)) return {known:false,reason:'CSS 生成文字无法核实跨背景文字行的实际叠底'};
        paintsText=covers;
      }
      let local=[paintsText?color:[0,0,0,0]];
      for(let layerIndex=layers.length-1;layerIndex>=0;layerIndex-=1){
        if(paintsText) local=local.flatMap(base=>layers[layerIndex].map(layer=>over(layer,base)));
      }
      const opacity=Number.parseFloat(style.opacity);
      if(!Number.isFinite(opacity)) return {known:false,reason:'透明度无法解析'};
      backgrounds=local.flatMap(layer=>backgrounds.map(parent=>over(withAlpha(layer,opacity),parent)));
      foregroundOpacity*=Math.max(0,Math.min(1,opacity));
    }
    const rects=sampleRects?.length?sampleRects:[el.getBoundingClientRect()];
    if(pseudo) for(const layer of pseudoPaints){
      if(layer.el===el||layer.el.contains(el)) continue; // 同宿主与祖先已按更保守的规则核对。
      // 独立伪元素可能溢出透明宿主，必须读取同次快照中的实际盒。
      // 阴影可能伸出盒外，不能以盒不相交证明它不遮挡文字。
      if(getComputedStyle(layer.el,layer.pseudo).boxShadow!=='none'||layer.paintRects.some(box=>rects.some(rect=>
        Math.min(box.right,rect.right)>Math.max(box.left,rect.left)&&Math.min(box.bottom,rect.bottom)>Math.max(box.top,rect.top))))
        return {known:false,reason:'伪元素叠层无法核对实际底图'};
    }
    if(hasBackdrop||pseudo) for(const node of root.querySelectorAll('*')){
      if(node===el||node.contains(el)||!visible(node)) continue;
      const r=node.getBoundingClientRect();
      if(!rects.some(rect=>Math.min(r.right,rect.right)-Math.max(r.left,rect.left)>.5
        && Math.min(r.bottom,rect.bottom)-Math.max(r.top,rect.top)>.5)) continue;
      const paint=getComputedStyle(node);
      if(node.tagName==='IMG'||paint.backgroundImage!=='none'||rgba(paint.backgroundColor)?.[3]>0||paint.boxShadow!=='none')
        return {known:false,reason:'独立叠层无法核对实际底图'};
    }
    const rect=rects[0];
    if(rect.width>0&&rect.height>0&&typeof document.elementsFromPoint==='function'){
      const points=[[rect.left+rect.width/2,rect.top+rect.height/2],[rect.left+1,rect.top+1],[rect.right-1,rect.bottom-1]];
      for(const [x,y] of points){
        if(x<0||y<0||x>innerWidth||y>innerHeight) continue;
        const image=document.elementsFromPoint(x,y).find(node=>node.tagName==='IMG'&&!el.contains(node));
        if(image) return {known:false,reason:'图片背景'};
      }
    }
    return {known:true,colors:backgrounds,foregroundOpacity};
  };
  const slotFor = el => el.closest('[data-sitecraft-slot]')?.getAttribute('data-sitecraft-slot') || '';
  const isParameter = el => {
    const slot=slotFor(el);
    return Boolean(el.closest('table') || /(?:spec|sku|model|email|phone|quantity|status)/i.test(slot));
  };
  const lineLengthExemption = el => {
    const slot=slotFor(el);
    if(el.closest('h1,h2,h3,h4,h5,h6')) return '标题';
    if(el.closest('[data-sitecraft-image-credits],[data-sitecraft-hero-credit],.sitecraft-product-image-credit,.sc-image-credits')) return '图片署名与许可';
    if(el.closest('table')) return '参数表';
    if(el.closest('button,input,select,textarea,summary,[role=button]')) return '按钮或控件';
    if(el.closest('nav')) return '导航';
    if(el.closest('a[href^="mailto:"],a[href^="tel:"]')) return '邮箱或电话';
    if(/(?:spec|sku|model|email|phone|quantity|status)/i.test(slot)) return /email|phone/i.test(slot) ? '邮箱或电话' : '型号或参数';
    return '';
  };
  const bodyBlockFor = el => {
    for(let block=el;block;block=block.parentElement) {
      const display=getComputedStyle(block).display,parentDisplay=block.parentElement?getComputedStyle(block.parentElement).display:'';
      if(/^(block|flow-root|list-item|inline-block|inline-flex|inline-grid|flex|grid|table-cell|table-caption)$/.test(display)
        || /^(inline-)?(flex|grid)$/.test(parentDisplay)) return block;
    }
    return root.body||root;
  };
  const textContrast=[];
  const contrastNodes=[];
  const bodyLineLength=[];
  const lineLengthExemptions=[];
  const measureLines = block => {
    const walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT);
    const chars=[];
    while(walker.nextNode()){
      const node=walker.currentNode;
      if(!node.textContent.trim()||fullyHidden(node.parentElement)||bodyBlockFor(node.parentElement)!==block||lineLengthExemption(node.parentElement)) continue;
      for(let index=0;index<node.textContent.length;index++){
        range.setStart(node,index);range.setEnd(node,index+1);
        const rect=[...range.getClientRects()].map(rect=>measuredRect(node.parentElement,rect)).find(rect=>rect&&rect.width>.5&&rect.height>.5);
        if(rect) chars.push({char:node.textContent[index],top:Math.round(rect.top),left:rect.left,right:rect.right});
      }
    }
    const grouped=new Map();
    for(const item of chars) grouped.set(item.top,[...(grouped.get(item.top)||[]),item]);
    return [...grouped.entries()].sort((a,b)=>a[0]-b[0]).map(([top,parts])=>{
      const text=parts.map(part=>part.char).join('').trim();
      const count=Array.from(text.replace(/\s/g,'')).length;
      const language=/[\u3400-\u9fff]/.test(text)?'zh':'en';
      const max=language==='zh'?40:75;
      return {top,width:Math.max(...parts.map(part=>part.right))-Math.min(...parts.map(part=>part.left)),text,count,language,max,tooLong:count>max};
    }).filter(item=>item.text);
  };
  const textWalker=document.createTreeWalker(root.body||root,NodeFilter.SHOW_TEXT);
  const measuredBodyBlocks=new Set();
  const reportedExemptions=new Set();
  // first-line／first-letter 包装真实 DOM 文字时也须满足同一门禁。
  const textFragmentSelectors=[];
  const collectTextFragments=(rules,parent='')=>{for(const rule of rules){
    const text=rule.selectorText;
    const resolved=text?(parent?(text.includes('&')?text.replace(/&/g,`:is(${parent})`):`:is(${parent}) ${text}`):text):parent;
    for(const selector of splitTopLevel(text?resolved:'')){
      const match=/::?(first-line|first-letter)\b/i.exec(selector);
      if(match) textFragmentSelectors.push({selector:selector.replace(match[0],'').trim(),pseudo:`::${match[1].toLowerCase()}`});
    }
    if(rule.cssRules) collectTextFragments(rule.cssRules,resolved);
  }};
  for(const sheet of document.styleSheets) collectTextFragments(sheet.cssRules);
  while(textWalker.nextNode()){
    const node=textWalker.currentNode,el=node.parentElement;
    if(!node.textContent.trim()||fullyHidden(el)) continue;
    const style=getComputedStyle(el),slot=slotFor(el),parameter=isParameter(el),exemption=lineLengthExemption(el);
    const size=parseFloat(style.fontSize)||16,weight=parseInt(style.fontWeight,10)||((style.fontWeight==='bold')?700:400);
    const large=size>=24||(size>=18.66&&weight>=700);
    range.selectNodeContents(node);
    const textRects=[...range.getClientRects()].map(rect=>measuredRect(el,rect)).filter(Boolean);
    if(!textRects.length) continue;
    const background=backgroundFor(el,textRects),foreground=rgba(style.webkitTextFillColor||style.color);
    let paintReason=foreground?.[3]===0?'透明文字填充无法测量':'';
    for(let ancestor=el;ancestor;ancestor=ancestor.parentElement){
      const paint=getComputedStyle(ancestor);
      if(/\btext\b/.test(paint.backgroundClip||paint.webkitBackgroundClip||'')) paintReason='背景裁切文字无法测量';
      for(const {selector,pseudo} of textFragmentSelectors){
        try{if(ancestor.matches(selector)) paintReason=paintReason||generatedPaintReason(ancestor,pseudo);}
        catch{paintReason='伪元素叠层无法核对实际底图';}
      }
    }
    const measured=background.known&&foreground&&!paintReason ? {status:'measured',ratio:Math.min(...background.colors.map(bg=>ratioFor(over(withAlpha(foreground,background.foregroundOpacity),bg),bg)))} : {status:'unmeasured',ratio:null,reason:background.effect?background.reason:paintReason||background.reason||'前景色无法解析',...(background.effect?{effect:background.effect}:{})};
    const role=el.closest('h1,h2,h3,h4,h5,h6')?'heading':parameter?'parameter':(slot.startsWith('navigation.')||el.closest('nav'))?'navigation':(!el.closest('p')&&el.closest('button,input,select,textarea,a,summary,[role=button]'))?'control':'body';
    const entry={key:keyFor(el),element:el.id||el.tagName.toLowerCase(),tag:el.tagName.toLowerCase(),text:node.textContent.trim().slice(0,160),slot,block:blockFor(el),role,checkable:role==='body'||role==='heading',large,threshold:large?3:4.5,fontSize:size,fontWeight:weight,...measured};
    textContrast.push(entry);
    contrastNodes.push({el,entry});
    const block=bodyBlockFor(el),blockExemption=lineLengthExemption(block);
    const exempt=blockExemption?block:el;
    if(exemption&&!reportedExemptions.has(exempt)){
      reportedExemptions.add(exempt);
      lineLengthExemptions.push({element:exempt.id||exempt.tagName.toLowerCase(),id:exempt.id||'',slot:slotFor(exempt),reason:exemption,text:exempt.textContent.trim().slice(0,160)});
    }
    if(!measuredBodyBlocks.has(block)){
      measuredBodyBlocks.add(block);
      for(const line of measureLines(block)) bodyLineLength.push({element:block.id||block.tagName.toLowerCase(),id:block.id||'',slot:slotFor(block),block:blockFor(block),...line});
    }
  }
  // DOMSnapshot 可能不暴露 first-line 的实际文字样式，不能用普通伪元素样式代替。
  // 只在生成文字路径使用；真实 DOM 的安全首行／首字母继续走原 Range 路径。
  const firstLineSelectors=textFragmentSelectors.filter(item=>item.pseudo==='::first-line').map(item=>item.selector);
  const uncertainFirstLine=el=>{
    for(let p=el;p;p=p.parentElement) for(const selector of firstLineSelectors){
      try{if(p.matches(selector)) return true;}catch{return true;}
    }
    return false;
  };
  for(const item of generated) {
    const {el,pseudo,text,rects,key}=item,style=getComputedStyle(el,pseudo);
    const size=parseFloat(style.fontSize)||16,weight=parseInt(style.fontWeight,10)||400;
    const large=size>=24||(size>=18.66&&weight>=700);
    const background=backgroundFor(el,rects,pseudo),foreground=rgba(style.webkitTextFillColor||style.color);
    const textClip=[style,...(()=>{const styles=[];for(let p=el;p;p=p.parentElement)styles.push(getComputedStyle(p));return styles;})()].some(p=>/\btext\b/.test(p.backgroundClip||p.webkitBackgroundClip||''));
    const reason=background.effect?background.reason:!rects.length?'CSS 生成文字无法测量实际文字行':item.pseudo!=='::marker'&&uncertainFirstLine(el)?'CSS 生成文字无法测量 first-line 的实际分片样式':foreground?.[3]===0?'透明文字填充无法测量':textClip?'背景裁切文字无法测量':background.reason;
    const measured=background.known&&foreground&&!reason?{status:'measured',ratio:Math.min(...background.colors.map(bg=>ratioFor(over(withAlpha(foreground,background.foregroundOpacity),bg),bg)))}:{status:'unmeasured',ratio:null,reason:reason||'CSS 生成文字前景色无法解析',...(background.effect?{effect:background.effect}:{})};
    const entry={key,element:el.id||el.tagName.toLowerCase(),tag:el.tagName.toLowerCase(),text:text.trim().slice(0,160),slot:slotFor(el),block:blockFor(el),role:el.closest('h1,h2,h3,h4,h5,h6')?'heading':'body',checkable:true,large,threshold:large?3:4.5,fontSize:size,fontWeight:weight,...measured};
    textContrast.push(entry);contrastNodes.push({el,entry});
  }
  const slots=[...root.querySelectorAll('[data-sitecraft-slot]')].map(el=>{
    const r=el.getBoundingClientRect();
    const painted=visible(el)&&r.width>0&&r.height>0&&r.right>0&&r.left<innerWidth;
    const textEntries=contrastNodes.filter(item=>el.contains(item.el)).map(item=>item.entry);
    const known=textEntries.filter(entry=>entry.status==='measured');
    const ratio=painted&&textEntries.length?(known.length?Math.min(...known.map(entry=>entry.ratio)):null):21;
    return {key:keyFor(el),slot:el.getAttribute('data-sitecraft-slot'),block:blockFor(el),visible:painted,contrast:ratio,contrastStatus:painted&&textEntries.length&&!known.length?'unmeasured':'measured'};
  });
  const visibleBlocks=[...root.querySelectorAll('[data-sc-block]')].filter(visible).map(el=>el.getAttribute('data-sc-block')||'未知');
  const measuredBlocks=new Set(textContrast.map(entry=>entry.block).filter(Boolean));
  for(const slot of slots.filter(entry=>entry.visible&&entry.block)) measuredBlocks.add(slot.block);
  const baselineAlignments=[];
  const semanticSpacing=[];
  const undeclaredVariants=[];
  const primaryItems=[];
  const primaryMissing=[];
  const vaguePrimary=[];
  const declarationTargets = (block, selectors) => {
    const nodes=[];
    const missing=[];
    const invisible=[];
    const seen=new Set();
    for(const selector of selectors||[]) {
      let matches=[];
      try { matches=[...block.querySelectorAll(selector)]; } catch { matches=[]; }
      if(!matches.length) missing.push(selector);
      else if(!matches.some(visible)) invisible.push(selector);
      for(const node of matches) if(!seen.has(node)) { seen.add(node); nodes.push(node); }
    }
    return {nodes,missing,invisible};
  };
  const textRect = node => {
    try {
      const textNodes=[];
      const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);
      while(walker.nextNode()) if((walker.currentNode.textContent||'').trim()) textNodes.push(walker.currentNode);
      for(const textNode of textNodes) {
        const range=document.createRange();
        range.selectNodeContents(textNode);
        const rect=[...range.getClientRects()].find(item=>item.width>.5&&item.height>.5);
        if(rect) return rect;
      }
    } catch {}
    return node.getBoundingClientRect();
  };
  const baselineCanvas = document.createElement('canvas');
  const baselineContext = baselineCanvas.getContext('2d');
  const baselineFor = node => {
    const rect=textRect(node);
    if(!baselineContext) return rect.bottom;
    const style=getComputedStyle(node);
    baselineContext.font=style.font || `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    // Measure a common ascender/descender pair so different copy (especially CJK glyphs)
    // does not change the inferred font baseline.
    const metrics=baselineContext.measureText('Hg');
    const descent=Number.isFinite(metrics.actualBoundingBoxDescent) ? metrics.actualBoundingBoxDescent : (parseFloat(style.fontSize)||16)*.2;
    return rect.bottom-descent;
  };
  const boundsFor = nodes => {
    const rects=nodes.map(node=>node.getBoundingClientRect());
    if(!rects.length) return null;
    return {
      left:Math.min(...rects.map(rect=>rect.left)), top:Math.min(...rects.map(rect=>rect.top)),
      right:Math.max(...rects.map(rect=>rect.right)), bottom:Math.max(...rects.map(rect=>rect.bottom)),
    };
  };
  const gapOn = (first, second, axis) => {
    if(axis==='x') return Math.max(0, Math.max(second.left-first.right, first.left-second.right));
    return Math.max(0, Math.max(second.top-first.bottom, first.top-second.bottom));
  };
  const ruleLabels = { baseline:'基线组', spacing:'语义组间距', buttons:'按钮角色' };
  for(const block of [...root.querySelectorAll('[data-sc-block]')].filter(visible)) {
    const blockId=block.getAttribute('data-sc-block')||'未知';
    const variantId=block.getAttribute('data-sc-variant')||'未知';
    const declaration=declarationForBlock(block,root);
    if(!declaration) {
      undeclaredVariants.push({block:blockId,variant:variantId,rules:[...LAYOUT_RULE_KEYS],message:`${blockId}:${variantId} 未声明`});
      continue;
    }
    const missingRules=LAYOUT_RULE_KEYS.filter(rule=>!declaration.declared[rule]);
    if(missingRules.length) undeclaredVariants.push({block:blockId,variant:variantId,rules:missingRules,message:`${blockId}:${variantId} ${missingRules.map(rule=>ruleLabels[rule]).join('、')}未声明`});
    if(declaration.declared.baseline) {
      for(const group of declaration.baselineGroups) {
        const targets=declarationTargets(block,group.selectors);
        const visibleNodes=targets.nodes.filter(visible);
        if(targets.missing.length || targets.invisible.length || visibleNodes.length<2) {
          baselineAlignments.push({block:blockId,variant:variantId,id:group.id,delta:null,threshold:2,pass:false,status:'missing',missing:targets.missing,invisible:targets.invisible});
          continue;
        }
        if(own(group,'minViewportWidth')) {
          if(!Number.isInteger(group.minViewportWidth)||group.minViewportWidth<=0) {
            baselineAlignments.push({block:blockId,variant:variantId,id:group.id,delta:null,threshold:2,pass:false,status:'invalid',reason:'minViewportWidth must be a positive integer'});
            continue;
          }
          if(innerWidth<group.minViewportWidth) {
            baselineAlignments.push({block:blockId,variant:variantId,id:group.id,delta:null,threshold:2,pass:null,status:'not-applicable',applicability:{minViewportWidth:group.minViewportWidth,viewportWidth:innerWidth},reason:`Viewport ${innerWidth}px is below declared minViewportWidth ${group.minViewportWidth}px.`});
            continue;
          }
        }
        const values=visibleNodes.map(baselineFor);
        const delta=Number((Math.max(...values)-Math.min(...values)).toFixed(2));
        baselineAlignments.push({block:blockId,variant:variantId,id:group.id,delta,threshold:2,pass:delta<=2,status:'measured',targets:visibleNodes.length});
      }
    }
    if(declaration.declared.spacing) {
      const groups=declaration.semanticGroups.map(group=>({ ...group, targets:declarationTargets(block,group.selectors) }));
      const usable=groups.filter(group=>group.targets.nodes.some(visible));
      let between=null;
      for(let first=0;first<usable.length;first++) for(let second=first+1;second<usable.length;second++) {
        const a=boundsFor(usable[first].targets.nodes.filter(visible));
        const b=boundsFor(usable[second].targets.nodes.filter(visible));
        if(!a||!b) continue;
        const gap=Math.max(gapOn(a,b,'x'),gapOn(a,b,'y'));
        between=between===null?gap:Math.min(between,gap);
      }
      for(const group of groups) {
        const nodes=group.targets.nodes.filter(visible);
        const points=nodes.map(node=>node.getBoundingClientRect());
        const spreadX=points.length>1?Math.max(...points.map(point=>point.left))-Math.min(...points.map(point=>point.left)):0;
        const spreadY=points.length>1?Math.max(...points.map(point=>point.top))-Math.min(...points.map(point=>point.top)):0;
        const axis=spreadX>=spreadY?'x':'y';
        const ordered=[...points].sort((a,b)=>axis==='x'?a.left-b.left:a.top-b.top);
        let within=0;
        for(let index=1;index<ordered.length;index++) within=Math.max(within,gapOn(ordered[index-1],ordered[index],axis));
        const missing=group.targets.missing;
        semanticSpacing.push({block:blockId,variant:variantId,id:group.id,axis,within:Number(within.toFixed(2)),between:Number((between??0).toFixed(2)),pass:!missing.length&&between!==null&&within<between,status:missing.length?'missing':'measured',missing});
      }
    }
    if(declaration.declared.buttons) {
      const targets=declarationTargets(block,declaration.buttonRoles.primary);
      primaryMissing.push(...targets.missing.map(selector=>({block:blockId,variant:variantId,selector})));
      for(const node of targets.nodes.filter(visible)) {
        const text=(node.innerText||node.textContent||'').replace(/\s+/g,' ').trim();
        const item={block:blockId,variant:variantId,text};
        primaryItems.push(item);
        if(VAGUE_PRIMARY_COPY.has(text.toLocaleLowerCase())) vaguePrimary.push(item);
      }
    }
  }
  const primaryButtons={visibleCount:primaryItems.length,max:1,pass:primaryItems.length<=1,vague:vaguePrimary,items:primaryItems,missing:primaryMissing};
  const layoutDeclarations={baselineAlignments,semanticSpacing,primaryButtons,undeclaredVariants};
  return {horizontalScroll:document.documentElement.scrollWidth>innerWidth+1,overflowElements,textOverlaps,heroTitleOrphan,heroTitleWordBreak,slots,textContrast,bodyLineLength,lineLengthExemptions,...layoutDeclarations,baseline:baselineAlignments,spacing:semanticSpacing,buttonRoles:primaryButtons,variantDeclarations:undeclaredVariants,measurement:{visibleBlocks,measuredBlocks:[...measuredBlocks],textContrastEntries:textContrast.length,bodyParagraphs:measuredBodyBlocks.size,bodyLineEntries:bodyLineLength.length},height:Math.max(document.documentElement.scrollHeight,document.body.scrollHeight)};
}
export default scanVisitorLayout;

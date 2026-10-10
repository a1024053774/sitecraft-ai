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

export function scanVisitorLayout(root = document) {
  const blockFor = el => el.closest('[data-sc-block]')?.getAttribute('data-sc-block') || '页面';
  const visible = el => {
    if (!el || el.closest('script,style,template,noscript,[aria-hidden="true"]')) return false;
    for (let p=el;p;p=p.parentElement) {
      const s=getComputedStyle(p);
      if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0) return false;
      if(p.tagName==='DETAILS'&&!p.open) {
        const summary=[...p.children].find(c=>c.tagName==='SUMMARY');
        if(!summary?.contains(el)) return false;
      }
    }
    return el.getClientRects().length>0;
  };
  const keyFor = el => {
    const path=[];
    for(let p=el;p&&p!==document.body;p=p.parentElement) {
      path.unshift(`${p.tagName}:${[...p.parentElement.children].indexOf(p)}`);
    }
    return path.join('/');
  };
  const overflowElements=[];
  for(const el of root.querySelectorAll('body *')) {
    if(!visible(el)) continue;
    const r=el.getBoundingClientRect();
    if(r.width<1||r.height<1) continue;
    const amount=Math.max(r.right-innerWidth,-r.left,0);
    if(amount>1) overflowElements.push({block:blockFor(el),key:keyFor(el),amount:Math.ceil(amount)});
  }
  const walker=document.createTreeWalker(root.body||root,NodeFilter.SHOW_TEXT);
  const range=document.createRange(), lines=[];
  while(walker.nextNode()) {
    const n=walker.currentNode, el=n.parentElement;
    if(!n.textContent.trim()||!visible(el)) continue;
    range.selectNodeContents(n);
    const key=`${keyFor(el)}:${[...el.childNodes].indexOf(n)}:${n.textContent.trim()}`;
    const fontSize=parseFloat(getComputedStyle(el).fontSize);
    for(const rect of range.getClientRects()) if(rect.width>.5&&rect.height>.5) {
      // Use the same em box for every text fragment, including inline descendants.
      const height=Math.min(rect.height,fontSize),top=rect.top+(rect.height-height)/2;
      lines.push({el,rect:{left:rect.left,right:rect.right,top,bottom:top+height},key});
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
    if(a.el===b.el&&Math.abs(a.rect.top-b.rect.top)<1&&Math.abs(a.rect.bottom-b.rect.bottom)<1) continue;
    const x=Math.min(a.rect.right,b.rect.right)-Math.max(a.rect.left,b.rect.left);
    const y=Math.min(a.rect.bottom,b.rect.bottom)-Math.max(a.rect.top,b.rect.top);
    if(x>2&&y>2) textOverlaps.push({block:blockFor(a.el),amount:Math.min(x,y),key:[a.key,b.key].sort().join('::')});
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
    if(/(?:url\(|image-set\(|cross-fade\()/i.test(image)) return {known:false,reason:'图片背景'};
    const layers=[];
    for(const [index,layer] of splitTopLevel(image).entries()){
      const parsed=gradientColors(layer,index);
      if(parsed.error) return {known:false,reason:parsed.error};
      layers.push(parsed.colors);
    }
    return {known:true,layers};
  };
  const backgroundFor = (el,sampleRect=null) => {
    const chain=[];for(let p=el;p;p=p.parentElement)chain.unshift(p);
    let backgrounds=[[255,255,255,1]], foregroundOpacity=1;
    for(const p of chain){
      const style=getComputedStyle(p);
      if(style.mixBlendMode&&style.mixBlendMode!=='normal') return {known:false,reason:'混合图层'};
      const parsedBackground=backgroundLayers(style.backgroundImage);
      if(!parsedBackground.known) return {known:false,reason:parsedBackground.reason};
      const layers=parsedBackground.layers;
      const color=rgba(style.backgroundColor);
      if(!color) return {known:false,reason:'背景颜色无法解析'};
      let local=[color];
      for(let layerIndex=layers.length-1;layerIndex>=0;layerIndex-=1){
        local=local.flatMap(base=>layers[layerIndex].map(layer=>over(layer,base)));
      }
      const opacity=Number.parseFloat(style.opacity);
      if(!Number.isFinite(opacity)) return {known:false,reason:'透明度无法解析'};
      backgrounds=local.flatMap(layer=>backgrounds.map(parent=>over(withAlpha(layer,opacity),parent)));
      foregroundOpacity*=Math.max(0,Math.min(1,opacity));
    }
    const rect=sampleRect||el.getBoundingClientRect();
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
      if(!node.textContent.trim()||!visible(node.parentElement)||bodyBlockFor(node.parentElement)!==block||lineLengthExemption(node.parentElement)) continue;
      for(let index=0;index<node.textContent.length;index++){
        range.setStart(node,index);range.setEnd(node,index+1);
        const rect=[...range.getClientRects()].find(rect=>rect.width>.5&&rect.height>.5);
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
  while(textWalker.nextNode()){
    const node=textWalker.currentNode,el=node.parentElement;
    if(!node.textContent.trim()||!visible(el)) continue;
    const style=getComputedStyle(el),slot=slotFor(el),parameter=isParameter(el),exemption=lineLengthExemption(el);
    const size=parseFloat(style.fontSize)||16,weight=parseInt(style.fontWeight,10)||((style.fontWeight==='bold')?700:400);
    const large=size>=24||(size>=18.66&&weight>=700);
    range.selectNodeContents(node);
    const textRects=[...range.getClientRects()];
    const background=backgroundFor(el,textRects[0]||null),foreground=rgba(style.webkitTextFillColor||style.color);
    let paintReason=foreground?.[3]===0?'透明文字填充无法测量':'';
    for(let ancestor=el;ancestor;ancestor=ancestor.parentElement){
      const paint=getComputedStyle(ancestor);
      if(/\btext\b/.test(paint.backgroundClip||paint.webkitBackgroundClip||'')) paintReason='背景裁切文字无法测量';
    }
    const measured=background.known&&foreground&&!paintReason ? {status:'measured',ratio:Math.min(...background.colors.map(bg=>ratioFor(over(withAlpha(foreground,background.foregroundOpacity),bg),bg)))} : {status:'unmeasured',ratio:null,reason:paintReason||background.reason||'前景色无法解析'};
    const role=el.closest('h1,h2,h3,h4,h5,h6')?'heading':parameter?'parameter':(slot.startsWith('navigation.')||el.closest('nav'))?'navigation':(!el.closest('p')&&el.closest('button,input,select,textarea,a,summary,[role=button]'))?'control':'body';
    const entry={element:el.id||el.tagName.toLowerCase(),tag:el.tagName.toLowerCase(),text:node.textContent.trim().slice(0,160),slot,block:blockFor(el),role,checkable:role==='body'||role==='heading',large,threshold:large?3:4.5,fontSize:size,fontWeight:weight,...measured};
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

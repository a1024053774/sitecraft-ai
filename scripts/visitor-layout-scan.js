// Browser-only. Compare actual text-line rectangles, never the unused boxes of closed details.
// Keep this expression in lockstep with scripts/hero-word-break-scan.js and check-published.
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
    for(const rect of range.getClientRects()) if(rect.width>.5&&rect.height>.5) lines.push({el,rect,key});
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
    if(a.el===b.el) continue;
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
  const gradientColors = image => {
    const match=/^(?:linear|radial|conic)-gradient\((.*)\)$/i.exec(image.trim());
    if(!match) return null;
    const colors=[];
    for(const stop of splitTopLevel(match[1])){
      const token=/(rgba?\([^)]*\)|#[0-9a-f]{3,8}|transparent)$/i.exec(stop.trim())?.[1]
        || /(rgba?\([^)]*\)|#[0-9a-f]{3,8}|transparent)/i.exec(stop.trim())?.[1];
      if(!token) continue;
      const color=rgba(token);
      if(!color) return null;
      colors.push(color);
    }
    return colors.length ? colors : null;
  };
  const backgroundLayers = image => {
    if(!image||image==='none') return [];
    if(/(?:url\(|image-set\(|cross-fade\()/i.test(image)) return null;
    const layers=splitTopLevel(image).map(gradientColors);
    return layers.every(Boolean) ? layers : null;
  };
  const backgroundFor = (el,sampleRect=null) => {
    const chain=[];for(let p=el;p;p=p.parentElement)chain.unshift(p);
    let backgrounds=[[255,255,255,1]], foregroundOpacity=1;
    for(const p of chain){
      const style=getComputedStyle(p);
      if(style.mixBlendMode&&style.mixBlendMode!=='normal') return {known:false,reason:'混合图层'};
      const layers=backgroundLayers(style.backgroundImage);
      if(layers===null) return {known:false,reason:'图片背景'};
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
    if(el.closest('table')) return '参数表';
    if(el.closest('button,input,select,textarea,summary,[role=button]')) return '按钮或控件';
    if(el.closest('nav')) return '导航';
    if(/(?:spec|sku|model|email|phone|quantity|status)/i.test(slot)) return /email|phone/i.test(slot) ? '邮箱或电话' : '型号或参数';
    return '';
  };
  const paragraphFor = el => el.closest('p');
  const textContrast=[];
  const contrastNodes=[];
  const bodyLineLength=[];
  const lineLengthExemptions=[];
  const measureLines = paragraph => {
    const walker=document.createTreeWalker(paragraph,NodeFilter.SHOW_TEXT);
    const chars=[];
    while(walker.nextNode()){
      const node=walker.currentNode;
      if(!node.textContent.trim()||!visible(node.parentElement)) continue;
      for(let index=0;index<node.textContent.length;index++){
        range.setStart(node,index);range.setEnd(node,index+1);
        const rect=range.getBoundingClientRect();
        if(rect.width>.5&&rect.height>.5) chars.push({char:node.textContent[index],top:Math.round(rect.top)});
      }
    }
    const grouped=new Map();
    for(const item of chars) grouped.set(item.top,[...(grouped.get(item.top)||[]),item.char]);
    return [...grouped.entries()].sort((a,b)=>a[0]-b[0]).map(([top,parts])=>{
      const text=parts.join('').trim();
      const count=Array.from(text.replace(/\s/g,'')).length;
      const language=/[\u3400-\u9fff]/.test(text)?'zh':'en';
      const max=language==='zh'?40:75;
      return {top,text,count,language,max,tooLong:count>max};
    }).filter(item=>item.text);
  };
  const textWalker=document.createTreeWalker(root.body||root,NodeFilter.SHOW_TEXT);
  const measuredParagraphs=new Set();
  const reportedExemptions=new Set();
  while(textWalker.nextNode()){
    const node=textWalker.currentNode,el=node.parentElement;
    if(!node.textContent.trim()||!visible(el)) continue;
    const style=getComputedStyle(el),slot=slotFor(el),parameter=isParameter(el),exemption=lineLengthExemption(el);
    const size=parseFloat(style.fontSize)||16,weight=parseInt(style.fontWeight,10)||((style.fontWeight==='bold')?700:400);
    const large=size>=24||(size>=18.66&&weight>=700);
    range.selectNodeContents(node);
    const textRects=[...range.getClientRects()];
    const background=backgroundFor(el,textRects[0]||null),foreground=rgba(style.color);
    const measured=background.known&&foreground ? {status:'measured',ratio:Math.min(...background.colors.map(bg=>ratioFor(over(withAlpha(foreground,background.foregroundOpacity),bg),bg)))} : {status:'unmeasured',ratio:null,reason:background.reason||'前景色无法解析'};
    const paragraph=paragraphFor(el);
    const role=el.matches('h1,h2,h3,h4,h5,h6')?'heading':parameter?'parameter':(slot.startsWith('navigation.')||el.closest('nav'))?'navigation':(!paragraph&&el.closest('button,input,select,textarea,a,summary,[role=button]'))?'control':'body';
    const entry={element:el.id||el.tagName.toLowerCase(),tag:el.tagName.toLowerCase(),text:node.textContent.trim().slice(0,160),slot,block:blockFor(el),role,checkable:role==='body'||role==='heading',large,threshold:large?3:4.5,fontSize:size,fontWeight:weight,...measured};
    textContrast.push(entry);
    contrastNodes.push({el,entry});
    if(paragraph){
      const paragraphExemption=lineLengthExemption(paragraph);
      if(!measuredParagraphs.has(paragraph)){
        measuredParagraphs.add(paragraph);
        if(paragraphExemption){
          lineLengthExemptions.push({element:paragraph.id||paragraph.tagName.toLowerCase(),id:paragraph.id||'',slot:slotFor(paragraph),reason:paragraphExemption,text:paragraph.textContent.trim().slice(0,160)});
        } else {
          for(const line of measureLines(paragraph)) bodyLineLength.push({element:paragraph.id||paragraph.tagName.toLowerCase(),id:paragraph.id||'',slot:slotFor(paragraph),block:blockFor(paragraph),...line});
        }
      }
    } else if(exemption&&!reportedExemptions.has(el)){
      reportedExemptions.add(el);
      lineLengthExemptions.push({element:el.id||el.tagName.toLowerCase(),id:el.id||'',slot,reason:exemption,text:node.textContent.trim().slice(0,160)});
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
  return {horizontalScroll:document.documentElement.scrollWidth>innerWidth+1,overflowElements,textOverlaps,heroTitleOrphan,heroTitleWordBreak,slots,textContrast,bodyLineLength,lineLengthExemptions,height:Math.max(document.documentElement.scrollHeight,document.body.scrollHeight)};
}
export default scanVisitorLayout;

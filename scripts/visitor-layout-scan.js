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
  const over=(fg,bg)=>[0,1,2].map(i=>fg[i]*fg[3]+bg[i]*(1-fg[3]));
  const luminance=c=>c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((v,c,i)=>v+c*[.2126,.7152,.0722][i],0);
  const ratioFor = (fg,bg) => {
    const a=luminance(fg),b=luminance(bg);
    return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  };
  const backgroundFor = (el,sampleRect=null) => {
    const chain=[];for(let p=el;p;p=p.parentElement)chain.unshift(p);
    let bg=[255,255,255];
    for(const p of chain){
      const style=getComputedStyle(p);
      if(style.backgroundImage && style.backgroundImage!=='none') return {known:false,reason:'图片背景'};
      if(style.mixBlendMode && style.mixBlendMode!=='normal') return {known:false,reason:'混合图层'};
      const color=rgba(style.backgroundColor);
      if(!color) return {known:false,reason:'背景颜色无法解析'};
      bg=over(color,bg);
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
    return {known:true,color:bg};
  };
  const slotFor = el => el.closest('[data-sitecraft-slot]')?.getAttribute('data-sitecraft-slot') || '';
  const isParameter = el => {
    const slot=slotFor(el);
    return Boolean(el.closest('table,dl') || /(?:spec|sku|model|email|phone|quantity|status)/i.test(slot));
  };
  const lineLengthExemption = el => {
    const slot=slotFor(el);
    if(el.closest('table,dl')) return '参数表';
    if(el.closest('button,input,select,textarea,a,nav,header,summary')) return '按钮或导航';
    if(/(?:spec|sku|model|email|phone|quantity|status)/i.test(slot)) return /email|phone/i.test(slot) ? '邮箱或电话' : '型号或参数';
    return '';
  };
  const isBodyParagraph = el => el.tagName==='P' && !lineLengthExemption(el);
  const textContrast=[];
  const contrastNodes=[];
  const bodyLineLength=[];
  const lineLengthExemptions=[];
  const measureLines = (el,node) => {
    const value=node.textContent||'';
    const chars=[];
    for(let index=0;index<value.length;index++){
      range.setStart(node,index);range.setEnd(node,index+1);
      const rect=range.getBoundingClientRect();
      if(rect.width>.5&&rect.height>.5) chars.push({char:value[index],top:Math.round(rect.top)});
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
  while(textWalker.nextNode()){
    const node=textWalker.currentNode,el=node.parentElement;
    if(!node.textContent.trim()||!visible(el)) continue;
    const style=getComputedStyle(el),slot=slotFor(el),parameter=isParameter(el),exemption=lineLengthExemption(el);
    const size=parseFloat(style.fontSize)||16,weight=parseInt(style.fontWeight,10)||((style.fontWeight==='bold')?700:400);
    const large=size>=24||(size>=18.66&&weight>=700);
    range.selectNodeContents(node);
    const textRects=[...range.getClientRects()];
    const background=backgroundFor(el,textRects[0]||null),foreground=rgba(style.color);
    const measured=background.known&&foreground ? {status:'measured',ratio:ratioFor(over(foreground,background.color),background.color)} : {status:'unmeasured',ratio:null,reason:background.reason||'前景色无法解析'};
    const role=el.matches('h1,h2,h3,h4,h5,h6')?'heading':parameter?'parameter':el.closest('nav,header')?'navigation':el.closest('button,a,summary')?'control':'body';
    const entry={element:el.id||el.tagName.toLowerCase(),tag:el.tagName.toLowerCase(),text:node.textContent.trim().slice(0,160),slot,block:blockFor(el),role,checkable:role==='body'||role==='heading',large,threshold:large?3:4.5,fontSize:size,fontWeight:weight,...measured};
    textContrast.push(entry);
    contrastNodes.push({el,entry});
    if(isBodyParagraph(el)){
      for(const line of measureLines(el,node)) bodyLineLength.push({element:el.id||el.tagName.toLowerCase(),id:el.id||'',slot,block:blockFor(el),...line});
    } else if(exemption){
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

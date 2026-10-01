// Browser-only. Compare actual text-line rectangles, never the unused boxes of closed details.
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
  let heroTitleWordBreak = false;
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
    const words = ["模具", "减速机", "注塑件", "结构件", "快换接头", "卡套接头"];
    for (const word of words) {
      for (let i = 1; i < word.length && !heroTitleWordBreak; i++) {
        const left = characterLines.find((item) => item.char === word[i - 1]);
        const right = characterLines.find((item) => item.char === word[i]);
        if (left && right && Math.abs(left.top - right.top) > 1 && heroTitle.textContent.includes(word)) heroTitleWordBreak = true;
      }
    }
  }
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
  const rgba = color => { ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].map((v,i)=>i===3?v/255:v); };
  const over=(fg,bg)=>[0,1,2].map(i=>fg[i]*fg[3]+bg[i]*(1-fg[3]));
  const luminance=c=>c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((v,c,i)=>v+c*[.2126,.7152,.0722][i],0);
  const contrast = el => {
    const chain=[];for(let p=el;p;p=p.parentElement)chain.unshift(p);
    let bg=[255,255,255];for(const p of chain)bg=over(rgba(getComputedStyle(p).backgroundColor),bg);
    const fg=over(rgba(getComputedStyle(el).color),bg),a=luminance(fg),b=luminance(bg);
    return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  };
  const slots=[...root.querySelectorAll('[data-sitecraft-slot]')].map(el=>{
    const r=el.getBoundingClientRect();
    const painted=visible(el)&&r.width>0&&r.height>0&&r.right>0&&r.left<innerWidth;
    const textLines=lines.filter(l=>el.contains(l.el));
    const ratio=painted&&textLines.length?Math.min(...textLines.map(l=>contrast(l.el))):21;
    return {key:keyFor(el),slot:el.getAttribute('data-sitecraft-slot'),block:blockFor(el),visible:painted,contrast:ratio};
  });
  return {horizontalScroll:document.documentElement.scrollWidth>innerWidth+1,overflowElements,textOverlaps,heroTitleOrphan,heroTitleWordBreak,slots,height:Math.max(document.documentElement.scrollHeight,document.body.scrollHeight)};
}
export default scanVisitorLayout;

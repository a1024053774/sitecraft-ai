import { codeCheckBrowser } from './code-site-browser.ts';
import { applyCodeRepair } from './code-site-repair.ts';
import { renderSiteCode, type SiteCode } from './code-site.ts';
import type { AnnotationBatchItem, AnnotationTarget } from './annotations.ts';
import { gunzipSync } from 'node:zlib';
import { recordCheckDiagnostic } from './code-check-diagnostics.ts';
import { localDynamicPageBudgetMs, localDynamicViewportBudgetMs } from './code-site-check-budget.ts';

// T-164 adapts BaoCut's frozen annotation-set idea (see
// resources/baocut-annotation/SOURCE.md) to SiteCraft's DOM-path contract;
// no BaoCut implementation or dependency is imported.

export type LocalEditGroup = {
  target: AnnotationTarget;
  items: AnnotationBatchItem[];
  draftIds: string[];
  request: string;
};

function samePath(a: number[], b: number[]) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
function containsPath(ancestor: number[], descendant: number[]) {
  return ancestor.length < descendant.length && ancestor.every((value, index) => value === descendant[index]);
}

// Merge browser-frozen drafts before any model call. Exact targets form one
// ordered group; overlapping ancestor/descendant targets need an explicit
// user confirmation, then share the ancestor's write-back range.
export function mergeAnnotationEdits(items: AnnotationBatchItem[], options: { overlapConfirmed?: boolean } = {}): LocalEditGroup[] {
  const order = new Map(items.map((item, index) => [item.draftId, index]));
  const groups: LocalEditGroup[] = [];
  for (const item of items) {
    const existing = groups.find(group => group.target.versionId === item.target.versionId
      && group.target.pageId === item.target.pageId && samePath(group.target.path, item.target.path));
    if (existing) { existing.items.push(item); existing.draftIds.push(item.draftId); continue; }
    groups.push({ target: item.target, items: [item], draftIds: [item.draftId], request: '' });
  }
  for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) {
    const a = groups[i].target, b = groups[j].target;
    const overlap = a.versionId === b.versionId && a.pageId === b.pageId
      && (containsPath(a.path, b.path) || containsPath(b.path, a.path));
    if (!overlap) continue;
    if (!options.overlapConfirmed) throw new Error('祖先与后代区块重叠，请确认使用同一个范围后再发送。');
    const ancestor = a.path.length <= b.path.length ? a : b;
    const merged: LocalEditGroup = {
      target: ancestor,
      items: [...groups[i].items, ...groups[j].items].sort((left, right) => order.get(left.draftId)! - order.get(right.draftId)!),
      draftIds: [], request: '',
    };
    merged.draftIds = merged.items.map(item => item.draftId);
    groups.splice(j, 1); groups[i] = merged; i--; break;
  }
  for (const group of groups) group.request = group.items.map((item, index) => `${index + 1}. ${item.body}`).join('\n');
  return groups;
}

export function attributeLocalIssues(issues: string[], groups: LocalEditGroup[], source?: SiteCode, candidate?: SiteCode) {
  const groupIssues = groups.map(() => [] as string[]), overall: string[] = [];
  const changedCssGroups = source && candidate ? groups.filter(group => {
    const scope = `.${localScopeClass(group.target)}`;
    return candidate.css.includes(scope) && !source.css.includes(scope);
  }) : [];
  for (const issue of issues) {
    const factOwner = groups.findIndex(group => issue.startsWith(`${group.target.pageId}/${JSON.stringify(group.target.path)} `));
    if (factOwner >= 0) { groupIssues[factOwner].push(issue); continue; }
    const pageGroups = groups.filter(group => issue.startsWith(`${group.target.pageId}/`) || issue.includes(`：${group.target.pageId} `));
    const dynamicOrCss = /CSS|动态伪类|焦点|交互|范围外元素的 CSS/.test(issue);
    const owner = dynamicOrCss && changedCssGroups.length === 1 ? groups.indexOf(changedCssGroups[0])
      : !dynamicOrCss && pageGroups.length === 1 ? groups.indexOf(pageGroups[0]) : -1;
    if (owner >= 0) groupIssues[owner].push(issue); else overall.push(issue);
  }
  return { groupIssues, overall };
}

export function localScopeClass(target: AnnotationTarget) {
  return `sc-local-${target.versionId.replace(/[^a-zA-Z0-9-]/g, '-')}-${target.pageId}-${target.path.join('-')}`;
}

// Runs in Chrome: paths never depend on IDs, responsive geometry or text search.
export function localEditDom(code: SiteCode, target: AnnotationTarget, scope: string, candidate?: SiteCode, allowedTargets: AnnotationTarget[] = [], allowedScopes: string[] = []) {
  const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');
  const page = code.pages.find(page => page.id === target.pageId);
  if (!page) throw new Error('锚点页面不存在，请重新点选。');
  const doc = parse(page.html), mains = doc.querySelectorAll('main');
  if (mains.length !== 1) throw new Error('页面无法唯一定位正文，请改整页。');
  let node: Element = mains[0];
  for (const index of target.path) {
    if (!node.children[index]) throw new Error('锚点已经失效，请重新点选。');
    node = node.children[index];
  }
  if (!/^(SECTION|ARTICLE|DIV|HEADER|ASIDE|FOOTER)$/.test(node.tagName) || node.closest('[data-system-icon],.sc-image-credits')) throw new Error('请选择正文区块，系统部件不能单独修改。');
  const text = (node.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 1000);
  if (text !== target.text) throw new Error('锚点文字已改变，请重新点选。');
  for (const hint of [...(target.element ? [target.element] : []), ...(target.elements ?? [])]) {
    let pointed: Element | undefined = node;
    for (const index of hint.path) pointed = pointed?.children[index];
    const snapshot = pointed?.tagName === 'IMG' ? pointed.getAttribute('alt') || '' : pointed?.textContent || '';
    if (!pointed || pointed.tagName.toLowerCase() !== hint.tag
      || snapshot.replace(/\s+/g, ' ').trim().slice(0, 1000) !== hint.text)
      throw new Error('点中元素已改变，请重新点选。');
  }
  const path: number[] = []; let child: Node = node;
  while (child !== doc.body) {
    const parent = child.parentNode; if (!parent) throw new Error('锚点不在页面正文中。');
    path.unshift([...parent.childNodes].indexOf(child as ChildNode)); child = parent;
  }
  const before = node.outerHTML;
  const fragment = { id: 0, field: `pages/${target.pageId}/html`, kind: 'element' as const, path, before };
  const issues: string[] = [];
  const rules = (css: string) => { const sheet = new CSSStyleSheet(); sheet.replaceSync(css); return [...sheet.cssRules]; };
  if (!candidate) {
    // Match rules against the actual document, including inherited ancestor rules.
    let live: Element | undefined = document.querySelector('main') ?? undefined;
    for (const index of target.path) live = live?.children[index];
    if (!live) throw new Error('预览区块无法定位，请重新点选。');
    const related = (items: CSSRule[]): string => items.map(rule => {
      if (rule instanceof CSSStyleRule) {
        // Dynamic selectors and generated boxes cannot be ruled out by a
        // baseline match. Keep their parsed rule intact, including :has().
        if (rule.selectorText.includes(':')) return rule.cssText;
        const nodes = [...document.querySelectorAll(rule.selectorText)];
        return nodes.some(el => live!.contains(el) || el.contains(live!)) ? rule.cssText : '';
      }
      if (rule instanceof CSSMediaRule || rule instanceof CSSSupportsRule || rule instanceof CSSContainerRule) {
        const inside = related([...rule.cssRules]);
        return inside ? `${rule.cssText.slice(0, rule.cssText.indexOf('{'))}{${inside}}` : '';
      }
      return '';
    }).filter(Boolean).join('\n');
    node.classList.add(scope);
    return { fragment, html: node.outerHTML, css: related(rules(code.css)), issues, selectors: [] as string[] };
  }
  if (code.header !== candidate.header || code.footer !== candidate.footer) issues.push('局部修改越界：公共页头或页脚改变');
  const allowedPageIds = new Set([target, ...allowedTargets].map(item => item.pageId));
  if (code.pages.length !== candidate.pages.length || code.pages.some((p, i) => candidate.pages[i]?.id !== p.id || candidate.pages[i]?.title !== p.title || (!allowedPageIds.has(p.id) && candidate.pages[i]?.html !== p.html))) issues.push('局部修改越界：其他页面或页面标题改变');
  const nextPage = candidate.pages.find(p => p.id === target.pageId);
  const next = parse(nextPage?.html || '');
  let replacement: Element | undefined = next.querySelector('main') ?? undefined;
  for (const index of target.path) replacement = replacement?.children[index];
  if (!replacement || /^(MAIN|BODY|HTML)$/.test(replacement.tagName) || replacement.querySelector('main')) issues.push('局部修改必须返回一个区块，不能返回整页');
  else {
    const counters = (root: Element) => [root, ...root.querySelectorAll('[style]')].flatMap(el => {
      const style = (el as HTMLElement).style;
      return ['counter-reset', 'counter-set', 'counter-increment'].flatMap(name => style.getPropertyValue(name) ? [[name, style.getPropertyValue(name)]] : []);
    });
    const resolve = (root: Document, item: AnnotationTarget) => {
      let value: Element | undefined = root.querySelector('main') ?? undefined;
      if (item.pageId !== target.pageId) return undefined;
      for (const index of item.path) value = value?.children[index];
      return value;
    };
    const allowed = [target, ...allowedTargets].filter((item, index, all) => all.findIndex(other => other.pageId === item.pageId
      && item.path.length === other.path.length && item.path.every((value, pathIndex) => value === other.path[pathIndex])) === index);
    for (const item of allowed) {
      const beforeNode = resolve(doc, item), afterNode = resolve(next, item);
      if (beforeNode && afterNode && JSON.stringify(counters(beforeNode)) !== JSON.stringify(counters(afterNode))) issues.push('局部修改不能改变跨区块计数器');
    }
    // isEqualNode checks node types, attributes, text and sibling positions;
    // comments replace every allowed subtree in two independent parses. This
    // permits one atomic batch to change several disjoint blocks while still
    // comparing all DOM between them byte-for-byte.
    const permittedNodes = allowed.map(item => ({ beforeNode: resolve(doc, item), afterNode: resolve(next, item) }));
    for (const { beforeNode, afterNode } of permittedNodes) {
      beforeNode?.replaceWith(doc.createComment('selected-block'));
      afterNode?.replaceWith(next.createComment('selected-block'));
    }
    if (!doc.isEqualNode(next)) issues.push('局部修改越界：选中区块外的 DOM 改变');
  }
  const oldRules = rules(code.css), newRules = rules(candidate.css);
  if (newRules.length < oldRules.length || oldRules.some((rule, i) => rule.cssText !== newRules[i]?.cssText)) issues.push('局部修改越界：共享 CSS 被改写；请追加区块专属规则');
  const selectors: string[] = [];
  const inspect = (items: CSSRule[]) => { for (const rule of items) {
    if (rule instanceof CSSStyleRule) {
      // An anchored descendant-only selector also contains its interactive states.
      // Reject sibling escapes, nesting and relational selectors before matching.
      // CSSOM has already parsed the rule. Only commas outside functions,
      // attribute selectors and strings separate selector-list entries.
      const parts: string[] = []; let start = 0, depth = 0, quote = '', escaped = false;
      for (let i = 0; i < rule.selectorText.length; i++) {
        const char = rule.selectorText[i];
        if (escaped) { escaped = false; continue; }
        if (char === '\\') { escaped = true; continue; }
        if (quote) { if (char === quote) quote = ''; continue; }
        if (char === '"' || char === "'") quote = char;
        else if (char === '(' || char === '[') depth++;
        else if (char === ')' || char === ']') depth--;
        else if (char === ',' && depth === 0) { parts.push(rule.selectorText.slice(start, i)); start = i + 1; }
      }
      parts.push(rule.selectorText.slice(start));
      for (const selector of parts) {
        const value = selector.trim();
        const scoped = [scope, ...allowedScopes].some(prefix => value.startsWith(`.${prefix}`) && /^[\s.#[:>]|^$/.test(value.slice(prefix.length + 1)));
        if (!scoped || /[+~&]|:has\(/.test(value) || rule.cssRules.length) issues.push('局部修改越界：CSS 必须以区块专属类名为作用域，不能影响区块外');
        selectors.push(value.replace(/::[\w-]+(?:\([^)]*\))?/g, '').replace(/:(hover|active|focus(?:-visible|-within)?|visited)(?![\w-])/gi, ''));
      }
      for (const property of [...rule.style]) if (/^counter-(reset|set|increment)$/.test(property)) issues.push('局部修改不能改变跨区块计数器');
    } else if (rule instanceof CSSMediaRule || rule instanceof CSSSupportsRule || rule instanceof CSSContainerRule) inspect([...rule.cssRules]);
    else issues.push('局部修改 CSS 含无法限定范围的规则');
  } };
  inspect(newRules.slice(oldRules.length));
  return { fragment, html: before, css: '', issues, selectors };
}

type ProbeBrowser = { send<T = Record<string, unknown>>(method: string, params?: Record<string, unknown>): Promise<T>; evaluate<T>(expression: string): Promise<T> };
type ProbeEntry = { path: number[]; pseudo: string; present: boolean; styles: Array<[string, string]> };
type ProbeState = { trigger: number[] | null; state: string; entries: ProbeEntry[] };

// Runs inside the browser. Inspect parsed selector tokens, including nested
// conditional rules even when inactive. Strings and attribute values are not
// pseudo classes; CSS escapes in pseudo names still denote the same state.
export function authorStylesHaveDynamicStates(rules?: Iterable<CSSRule>) {
  const dynamic = new Set(['hover', 'focus', 'focus-visible', 'focus-within', 'active']);
  const hasState = (selector: string) => {
    let quote = '', brackets = 0;
    for (let i = 0; i < selector.length; i++) {
      const char = selector[i];
      if (char === '\\') { i++; continue; }
      if (quote) { if (char === quote) quote = ''; continue; }
      if (char === '"' || char === "'") { quote = char; continue; }
      if (char === '[') { brackets++; continue; }
      if (char === ']') { brackets--; continue; }
      if (brackets || char !== ':') continue;
      let name = '', j = i + 1;
      while (j < selector.length) {
        if (selector[j] === '\\') {
          const escape = selector.slice(j + 1).match(/^[0-9a-f]{1,6}[\t\n\f\r ]?/i);
          if (escape) { name += String.fromCodePoint(parseInt(escape[0], 16)); j += escape[0].length + 1; }
          else { name += selector[j + 1] ?? ''; j += 2; }
        } else if (/[\w-]/.test(selector[j])) name += selector[j++];
        else break;
      }
      if (dynamic.has(name.toLowerCase())) return true;
    }
    return false;
  };
  const inspect = (rules: Iterable<CSSRule>): boolean => [...rules].some(rule =>
    ('selectorText' in rule && hasState(String(rule.selectorText))) ||
    ('cssRules' in rule && inspect((rule as CSSGroupingRule).cssRules)));
  return rules ? inspect(rules) : [...document.styleSheets].some(sheet => inspect(sheet.cssRules));
}
export type DynamicStateProbe = {
  states: ProbeState[];
  interactiveElements: number | null;
  forceCalls: number;
  statesChecked: number;
  durationMs: number;
  cdpRoundTrips: number;
  stageMs: { focus: number; force: number; styleRead: number };
};

// One CDP probe for both single- and multi-block edits. The browser owns state
// truth: no selector stripping, :has parsing, owner inference, or short style
// fingerprint is used here. The returned collection is keyed only by outside
// DOM path and complete computed style.
export async function prepareOutsideCssApplications(browser: ProbeBrowser, frameId: string, html: string, scope: { paths?: number[][] } | undefined, deadlineAt: number, options: { states?: boolean; diagnostic?: Record<string, unknown> } = {}) {
  const probeStates = options.states ?? true;
  const startedAt = performance.now();
  const wallStartedAt = Date.now();
  let cdpRoundTrips = 0;
  let interactiveElements: number | null = null, forceCalls = 0, completed = false;
  const stageMs = { focus: 0, force: 0, styleRead: 0 };
  const styleReadParts = { read: 0, serialize: 0, compress: 0, decode: 0 };
  const send = async <T = Record<string, unknown>>(method: string, params: Record<string, unknown> = {}) => { cdpRoundTrips++; return browser.send<T>(method, params); };
  const evaluate = async <T>(expression: string) => { cdpRoundTrips++; return browser.evaluate<T>(expression); };
  const checkTime = () => { if (Date.now() > deadlineAt) throw new Error('局部动态状态检查超时，本次未保存版本。'); };
  try {
  checkTime(); if (probeStates) await send('DOM.enable');
  await send('Page.setDocumentContent', { frameId, html });
  const focusStarted = performance.now();
  const probe = await evaluate<{ all: string[]; roots: string[]; interactive: Array<{ id: string; path: number[]; ancestors: string[] }> }>(`(() => {
    const paths=${JSON.stringify(scope?.paths ?? [])};
    const pathOf=(el)=>{const path=[];for(let child=el;child?.parentElement;child=child.parentElement)path.unshift([...child.parentElement.children].indexOf(child));return path};
    const rootFor=(path)=>{let el=document.querySelector('main');for(const index of path)el=el?.children[index];return el};
    const roots=paths.map(rootFor).filter(Boolean), all=[...document.querySelectorAll('*')];
    const ids=new Map(all.map((el,index)=>[el,String(index)]));
    const hidden=(el)=>{if(el.matches(':disabled,[inert],[hidden]'))return true;for(let p=el.parentElement;p;p=p.parentElement)if(p.matches('[inert],[hidden]'))return true;const r=el.getBoundingClientRect();return !(r.width>0&&r.height>0&&el.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}))};
    const interactive=${probeStates}?all.filter(el=>el!==document.documentElement&&el!==document.head&&el!==document.body&&!hidden(el)).filter(el=>{try{el.focus({preventScroll:true});const ok=document.activeElement===el;el.blur();return ok}catch{return false}}).map(el=>({id:ids.get(el),path:pathOf(el),ancestors:[...(()=>{const a=[];for(let p=el.parentElement;p;p=p.parentElement)a.push(ids.get(p));return a})()]})):[];
    const outside=all.filter(el=>!roots.some(root=>root===el||root.contains(el))).map(el=>({node:el,path:pathOf(el),ancestor:roots.some(root=>el.contains(root)),baselines:new Map()}));
    for(const el of all)el.setAttribute('data-cdp-probe',ids.get(el));
    const style=getComputedStyle(document.documentElement);
    const properties=[...style].filter(name=>!name.startsWith('--')).sort((a,b)=>a.localeCompare(b));
    window.__sitecraftCdpProbeOutside = {items:outside,properties};
    return {all:all.map(el=>ids.get(el)),roots:roots.map(el=>ids.get(el)),interactive};
  })()`);
  stageMs.focus += probeStates ? performance.now() - focusStarted : 0;
  interactiveElements = probeStates ? probe.interactive.length : null;
  const stateNames = ['focus', 'focus-visible', 'hover', 'active'] as const;
  const nodeIds = new Map<string, number>();
  if (probeStates) {
    const root = await send<{ root: { nodeId: number } }>('DOM.getDocument', { depth: 1, pierce: true });
    const allNodeIds = await send<{ nodeIds: number[] }>('DOM.querySelectorAll', { nodeId: root.root.nodeId, selector: '[data-cdp-probe]' });
    probe.all.forEach((id, index) => { if (allNodeIds.nodeIds[index]) nodeIds.set(id, allNodeIds.nodeIds[index]); });
  }
  return { interactiveElements, fullReads: 1 + (probeStates ? probe.interactive.length * 4 : 0),
    async read(readDeadlineAt: number): Promise<DynamicStateProbe> {
    deadlineAt = readDeadlineAt;
    try {
  const nodeId = async (id: string) => { checkTime(); const found = nodeIds.get(id); if (!found) throw new Error('局部动态状态检查无法定位 DOM 节点。'); return found; };
  const states: ProbeState[] = [];
  const forced = new Set<number>();
  const clear = async () => {
    checkTime();
    // CSS.disable resets every forced pseudo state in one CDP round trip pair;
    // clearing each ancestor separately made a medium page exceed its budget.
    const forceStarted = performance.now();
    await send('CSS.disable');
    await send('CSS.enable');
    stageMs.force += performance.now() - forceStarted;
    checkTime(); forced.clear();
  };
  const transition = async (active: Set<number>, ids: string[], state: string, path: number[]) => {
    const desired = new Set(await Promise.all(ids.map(id => nodeId(id))));
    const release = [...active].filter(id => !desired.has(id));
    const add = [...desired].filter(id => !active.has(id));
    try {
      const forceStarted = performance.now();
      forceCalls += add.length;
      await Promise.all([
        ...release.map(id => send('CSS.forcePseudoState', { nodeId: id, forcedPseudoClasses: [] })),
        ...add.map(id => send('CSS.forcePseudoState', { nodeId: id, forcedPseudoClasses: [state] })),
      ]);
      stageMs.force += performance.now() - forceStarted;
    } catch { throw new Error(`局部动态状态检查无法强制 ${state}（触发路径 ${JSON.stringify(path)}）。`); }
    checkTime();
    active.clear(); desired.forEach(id => active.add(id));
    forced.clear(); desired.forEach(id => forced.add(id));
  };
  const capture = async (trigger: number[] | null, state: string) => {
    checkTime(); const styleStarted = performance.now();
    const payload = await evaluate<{ encoded: string; read: number; serialize: number; compress: number }>(`(async()=>{
      const readStarted=performance.now();
      const entries=[];
      const snapshot=window.__sitecraftCdpProbeOutside;
      for(const item of snapshot.items)for(const pseudo of ['', '::before', '::after', '::marker', '::first-line', '::first-letter']){
        const style=getComputedStyle(item.node,pseudo||null),baseline=item.baselines.get(pseudo);
        const present=!pseudo||(pseudo==='::before'||pseudo==='::after'
          ?style.content!=='none'&&style.content!=='normal'&&style.display!=='none'
          :pseudo==='::marker'?getComputedStyle(item.node).display.includes('list-item'):true);
        // Check generated-box presence in every state; existing boxes retain
        // their complete style. First-line/letter fragments are always read:
        // generated text can create them without a DOM text node.
        if(!present){
          if(!baseline||baseline.present)entries.push({path:item.path,pseudo,present:false,styles:[]});
          if(!baseline)item.baselines.set(pseudo,{present:false,custom:[],names:[],values:[]});
          continue;
        }
        // CSSOM lists the fixed supported longhands first, then live custom
        // properties. Cache only the browser's standard names; read the whole
        // custom-property suffix on every state, including same-count changes.
        const length=style.length;
        if(length<snapshot.properties.length)throw new Error('完整计算样式属性集合不完整，本次未保存版本。');
        const custom=[];for(let i=snapshot.properties.length;i<length;i++)custom.push(style[i]);
        // Reuse only name ordering, after rereading the live custom suffix.
        // Same-count name replacement must invalidate this ordering too.
        const sameNames=baseline?.present&&custom.length===baseline.custom.length&&custom.every((name,i)=>name===baseline.custom[i]);
        const names=sameNames?baseline.names:custom.length?snapshot.properties.concat(custom).sort((a,b)=>a.localeCompare(b)):snapshot.properties;
        const values=[];
        let changed=!baseline?.present||names.length!==baseline.values.length;
        // Ancestors retain every computed property, including auto sizes and
        // percentages. Resolved layout pixels would instead reject normal
        // content growth inside the allowed block. No property is excluded.
        const computed=!pseudo&&item.ancestor?item.node.computedStyleMap():null;
        // Read every current property, including custom properties that exist
        // only in this state. Only duplicate baseline entries are omitted from
        // transport; the reachable collection still contains that baseline.
        for(let i=0;i<names.length;i++){
          const name=names[i],value=computed?computed.getAll(name).map(value=>value.toString()).join(', '):style.getPropertyValue(name);
          values.push(value);
          if(!changed&&(baseline.names[i]!==name||baseline.values[i]!==value))changed=true;
        }
        if(changed){
          const styles=names.map((name,i)=>[name,values[i]]);
          if(!baseline)item.baselines.set(pseudo,{present:true,custom,names,values});
          entries.push({path:item.path,pseudo,present:true,styles});
        }
      }
      const serializeStarted=performance.now(),read=serializeStarted-readStarted;
      const text=JSON.stringify(entries);
      const compressStarted=performance.now(),serialize=compressStarted-serializeStarted;
      const compressed=await new Response(new Blob([new TextEncoder().encode(text)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
      const bytes=new Uint8Array(compressed);let binary='';for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return{encoded:btoa(binary),read,serialize,compress:performance.now()-compressStarted}
    })()`);
    const decodeStarted = performance.now();
    const entries = JSON.parse(gunzipSync(Buffer.from(payload.encoded, 'base64')).toString('utf8')) as ProbeEntry[];
    styleReadParts.read += payload.read; styleReadParts.serialize += payload.serialize; styleReadParts.compress += payload.compress;
    styleReadParts.decode += performance.now() - decodeStarted;
    stageMs.styleRead += performance.now() - styleStarted;
    states.push({ trigger, state, entries });
  };
  if (probeStates) await clear();
  await evaluate('document.activeElement?.blur()'); await capture(null, 'baseline');
  for (const state of probeStates ? stateNames : []) {
    const active = new Set<number>();
    if (state === 'hover' || state === 'active') await evaluate('document.activeElement?.blur()');
    for (const item of probe.interactive) {
      checkTime();
      if (state === 'focus' || state === 'focus-visible') {
        try { await send('DOM.focus', { nodeId: await nodeId(item.id) }); }
        catch { throw new Error(`局部动态状态检查无法聚焦触发路径 ${JSON.stringify(item.path)}。`); }
        // Discovery already admitted this element only after focus() made it
        // document.activeElement; a failed DOM.focus call is still rejected.
      }
      // Keep shared ancestors forced while moving between sibling triggers;
      // each trigger still gets its own state and no prior branch remains active.
      await transition(active, state === 'focus' || state === 'focus-visible' ? [item.id] : [item.id, ...item.ancestors], state, item.path);
      await capture(item.path, state);
    }
    await clear();
  }
  await evaluate('document.activeElement?.blur()');
  await evaluate(`document.querySelectorAll('[data-cdp-probe]').forEach(el=>el.removeAttribute('data-cdp-probe')); delete window.__sitecraftCdpProbeOutside`);
  checkTime();
  completed = true;
  return { states, interactiveElements, forceCalls, statesChecked: probeStates ? stateNames.length : 0, durationMs: performance.now() - startedAt, cdpRoundTrips, stageMs };
    } finally { record(); }
  } };
  } catch (error) { record(); throw error; }
  function record() {
    recordCheckDiagnostic({ kind: 'dynamic-probe', mode: probeStates ? 'states' : 'static', ...options.diagnostic, startedAt: wallStartedAt, endedAt: Date.now(),
      durationMs: performance.now() - startedAt, interactiveElements, forceCalls, cdpRoundTrips, stageMs, styleReadParts, completed });
  }
}

// Direct probes and the submission boundary share the same complete reader.
export async function outsideCssApplications(browser: ProbeBrowser, frameId: string, html: string, scope?: { paths?: number[][] }, deadlineAt?: number,
  options: { states?: boolean; diagnostic?: Record<string, unknown> } = {}) {
  const startedAt = Date.now();
  const prepared = await prepareOutsideCssApplications(browser, frameId, html, scope, deadlineAt ?? startedAt + localDynamicPageBudgetMs, options);
  return prepared.read(deadlineAt ?? startedAt + Math.min(localDynamicPageBudgetMs, localDynamicViewportBudgetMs(prepared.fullReads)));
}

// Invoked on every rendered page by the submission boundary. Media conditions
// are deliberately ignored: each selector is checked even when currently inactive.
export function checkLocalSelectors(target: AnnotationTarget | AnnotationTarget[], pageId: string, selectors: string[]) {
  const selected: Element[] = [];
  for (const item of (Array.isArray(target) ? target : [target])) {
    if (pageId !== item.pageId) continue;
    let node: Element | undefined = document.querySelector('main') ?? undefined;
    for (const index of item.path) node = node?.children[index];
    if (node) selected.push(node);
  }
  const issues: string[] = [];
  for (const selector of selectors) {
    try {
      if ([...document.querySelectorAll(selector)].some(node => !selected.some(root => root.contains(node)))) issues.push(`局部修改越界：${selector} 命中区块外元素`);
    } catch { issues.push(`局部修改 CSS 选择器无法核对：${selector}`); }
  }
  return issues;
}

export async function localEditContext(code: SiteCode, target: AnnotationTarget) {
  const browser = await codeCheckBrowser();
  try {
    await browser.send('Network.enable'); await browser.send('Network.setBlockedURLs', { urls: ['*'] });
    const { frameTree } = await browser.send<{ frameTree: { frame: { id: string } } }>('Page.getFrameTree');
    await browser.send('Page.setDocumentContent', { frameId: frameTree.frame.id, html: renderSiteCode('local-context', code, target.pageId) });
    const scope = localScopeClass(target);
    return { ...await browser.evaluate<ReturnType<typeof localEditDom>>(`(${localEditDom.toString()})(${JSON.stringify(code)},${JSON.stringify(target)},${JSON.stringify(scope)})`), scope };
  } finally { await browser.close(); }
}
export async function applyLocalEdit(code: SiteCode, target: AnnotationTarget, html: string, css: string) {
  if (/<\/?(?:html|body|head|main)\b/i.test(html)) throw new Error('局部修改必须返回一个区块，不能返回整页。');
  const context = await localEditContext(code, target);
  const candidate = await applyCodeRepair(code, [context.fragment], { replacements: [{ fragmentId: 0, after: html.trim() }] });
  candidate.css = code.css + (css.trim() ? `\n${css}` : '');
  return candidate;
}

// Every fragment is captured from the same parent code before any replacement
// is applied. This prevents an earlier sibling rewrite from moving a later
// target and makes the final candidate a single atomic DOM patch.
export async function applyLocalEdits(code: SiteCode, groups: LocalEditGroup[], candidates: Array<{ html: string; css: string }>) {
  if (groups.length !== candidates.length || !groups.length) throw new Error('多区块修改的组与候选数量不一致。');
  const contexts = await Promise.all(groups.map(group => localEditContext(code, group.target)));
  const fragments = contexts.map((context, id) => ({ ...context.fragment, id }));
  const replacements = candidates.map((candidate, fragmentId) => {
    if (/<\/?(?:html|body|head|main)\b/i.test(candidate.html)) throw new Error('局部修改必须返回一个区块，不能返回整页。');
    return { fragmentId, after: candidate.html.trim() };
  });
  const result = await applyCodeRepair(code, fragments, { replacements });
  const css = candidates.map(candidate => candidate.css.trim()).filter(Boolean).join('\n');
  result.css = code.css + (css ? `\n${css}` : '');
  return result;
}

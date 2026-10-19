import { registerHooks } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

// Failure modes: an unconditional gate blocks reused facts; removing it lets
// changed/unknown facts call the model; a fake checker hides both mistakes.
// Only CDP observations are supplied. The real checker, reuse decision, model
// audit function and HTTP submission handlers run; no Chrome/visual claim.
const state = globalThis as any;
state.__t159CheckCalls = 0;
state.__t159ClosedChecks = 0;
const checker = pathToFileURL(path.resolve('lib/code-site-check.ts')).href;
const browser = pathToFileURL(path.resolve('lib/code-site-browser.ts')).href;
const revision = process.env.T159_SOURCE_REVISION;
if (revision && !['86fdb23', '672e7d4'].includes(revision)) throw new Error('未登记的准入反事实版本');
const revisionFiles = new Set(['lib/code-site-store.ts', 'lib/code-site-check.ts', 'lib/code-site-model.ts', 'lib/code-site-workflow.ts', 'lib/code-site-eval-styles.ts']);
state.__t159Browser = () => {
  state.__t159CheckCalls++;
  const args = state.__t159CheckInput;
  let width = 375;
  const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return {
    async send(method: string, params?: { width: number }) {
      if (method === 'Emulation.setDeviceMetricsOverride') width = params!.width;
      if (method === 'Page.getFrameTree') return { frameTree: { frame: { id: 'fixture-document' } } };
      if (['Network.enable', 'Network.setBlockedURLs', 'Page.navigate', 'Page.setDocumentContent', 'Emulation.setDeviceMetricsOverride'].includes(method)) return {};
      throw new Error(`未覆盖的 CDP 请求：${method}`);
    },
    async evaluate(expression: string) {
      if (expression.includes('function cleanCandidate(')) return { code: args.code, text: text(args.code.header + args.code.pages.map((p: any) => p.html).join('') + args.code.footer), issues: [], cleaned: [], contacts: [] };
      if (expression.includes('function prepareSystemBackdrops(')) return { colors: [], issues: [] };
      if (expression.includes('function readCodeQuality(')) return { truncatedText: 0, ungatedHover: 0, smallTargets: 0, coveredAnchors: 0, croppedProductImages: 0, narrowColumns: 0, details: [] };
      if (expression.includes('scanVisitorLayout(document,')) {
        const horizontalScroll = process.env.T159_RESTYLE_MODE === 'act' && process.env.T159_RESTYLE_ACTION === 'manual-invalid';
        return { horizontalScroll, overflowElements: [], textOverlaps: [], textContrast: [], bodyLineLength: [], generatedText: [], measurement: { textContrastEntries: 1 },
          repairs: horizontalScroll ? [{ issue: `${args.code.pages[0].id}/${width} 横向溢出`, elements: [], declarations: [], reason: '实际失败元素不属于可核实的站点代码节点' }] : [] };
      }
      if (expression.includes('function readCodeFactSeparators(')) return [];
      if (expression.includes('function readCodeFactSegments(')) return args.code.pages.map((p: any) => ({ text: text(p.html), group: p.id, context: { pageId: p.id, outline: [], headings: [] } }));
      if (expression.includes('hasMainHeading:')) return { contentType: 'text/html', hasMainHeading: true };
      if (expression.includes('document.images')) return [];
      if (expression.includes('document.fonts.ready') || expression.includes('location.origin===') || expression.includes('responseStatus')) return true;
      throw new Error(`未覆盖的 CDP 观察：${expression.slice(0, 100)}`);
    },
    async close() { state.__t159ClosedChecks++; },
  };
};
registerHooks({ resolve(specifier, context, next) {
  const resolved = next(specifier, context);
  return resolved.url === browser ? { shortCircuit: true, url: 'data:text/javascript,export async function codeCheckBrowser(){return globalThis.__t159Browser()}' } : resolved;
}, load(url, context, next) {
  const loaded = next(url, context);
  if (!url.startsWith('file:')) return loaded;
  const relative = path.relative(process.cwd(), fileURLToPath(url));
  if (!revisionFiles.has(relative)) return loaded;
  let source = revision ? execFileSync('git', ['show', `${revision}:${relative}`], { encoding: 'utf8' })
    : typeof loaded.source === 'string' ? loaded.source : new TextDecoder().decode(loaded.source as AllowSharedBufferSource);
  if (url === checker) {
    const entry = '  const code = codeSiteSchema.parse(args.code);';
    if (!source.includes(entry)) throw new Error('检查器参数观察点未命中');
    source = source.replace(entry, '  globalThis.__t159CheckInput = args;\n' + entry);
  }
  return { ...loaded, source };
} });

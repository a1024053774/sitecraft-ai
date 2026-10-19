import type { codeCheckBrowser } from './code-site-browser.ts';

export type GeneratedLayoutText = {
  // 与 T-173 的 CodeFactCssPosition 共用 documentElement 下的元素路径及伪元素名。
  path: number[]; pseudo: string; text: string;
  rects: Array<{ left: number; right: number; top: number; bottom: number; width: number; height: number }>;
};
type Snapshot = {
  strings: string[];
  documents: Array<{
    scrollOffsetX: number; scrollOffsetY: number;
    nodes: { parentIndex: number[]; nodeType: number[]; nodeName: number[]; pseudoType: { index: number[]; value: number[] } };
    layout: { nodeIndex: number[]; text: number[] };
    textBoxes: { layoutIndex: number[]; bounds: number[][]; start: number[]; length: number[] };
  }>;
};

// DOM Range 无法选中伪元素。使用 Chrome 同次布局快照中的实际文字行，
// 不克隆内容、不插入测量节点，也不把宿主盒子冒充生成文字范围。
// 协议依据：https://chromedevtools.github.io/devtools-protocol/tot/DOMSnapshot/#method-captureSnapshot
export async function readGeneratedLayout(browser: Awaited<ReturnType<typeof codeCheckBrowser>>): Promise<GeneratedLayoutText[]> {
  const snapshot = await browser.send<Snapshot>('DOMSnapshot.captureSnapshot', { computedStyles: [], includeDOMRects: true });
  if (snapshot.documents.length !== 1) throw new Error('CSS 生成文字无法核实检查文档的布局快照，本次未保存版本。');
  const { nodes, layout, textBoxes, scrollOffsetX, scrollOffsetY } = snapshot.documents[0];
  const pseudos = new Map(nodes.pseudoType.index.map((node, index) => [node, `::${snapshot.strings[nodes.pseudoType.value[index]]}`]));
  const children = new Map<number, number[]>();
  nodes.parentIndex.forEach((parent, node) => {
    if (nodes.nodeType[node] === 1 && !pseudos.has(node)) children.set(parent, [...(children.get(parent) ?? []), node]);
  });
  const texts = new Map<number, GeneratedLayoutText>();
  for (let index = 0; index < layout.nodeIndex.length; index++) {
    const text = snapshot.strings[layout.text[index]];
    if (!text?.trim()) continue;
    let pseudoNode = layout.nodeIndex[index];
    while (pseudoNode >= 0 && !pseudos.has(pseudoNode)) pseudoNode = nodes.parentIndex[pseudoNode];
    if (pseudoNode < 0) continue;
    const pseudo = pseudos.get(pseudoNode)!;
    if (!['::before', '::after', '::marker'].includes(pseudo)) throw new Error(`CSS 生成文字 ${pseudo} 无法测量，本次未保存版本。`);
    let host = nodes.parentIndex[pseudoNode];
    const path: number[] = [];
    while (snapshot.strings[nodes.nodeName[host]] !== 'HTML') {
      const parent = nodes.parentIndex[host], child = children.get(parent)?.indexOf(host);
      if (parent < 0 || child === undefined || child < 0) throw new Error('CSS 生成文字无法定位原页面元素路径，本次未保存版本。');
      path.unshift(child); host = parent;
    }
    const rects = textBoxes.layoutIndex.flatMap((layoutIndex, box) => {
      if (layoutIndex !== index) return [];
      const [x, y, width, height] = textBoxes.bounds[box];
      if (![x, y, width, height].every(Number.isFinite)) throw new Error('CSS 生成文字无法读取完整文字范围，本次未保存版本。');
      return [{ left: x - scrollOffsetX, right: x + width - scrollOffsetX, top: y - scrollOffsetY, bottom: y + height - scrollOffsetY, width, height }];
    });
    if (!rects.length) throw new Error(`CSS 生成文字 ${pseudo} 无法测量实际文字行，本次未保存版本。`);
    const previous = texts.get(pseudoNode);
    texts.set(pseudoNode, { path, pseudo, text: (previous?.text ?? '') + text, rects: [...(previous?.rects ?? []), ...rects] });
  }
  return [...texts.values()];
}

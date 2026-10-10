import type { SiteCode } from './code-site.ts';
import { codeCheckBrowser } from './code-site-browser.ts';

export type EnglishSlot = { id: string; text: string; pageId: string | null; path: string; currentText?: string };
export type EnglishTranslation = { id: string; text: string };

// Runs with inert DOMParser documents. The model sees strings only; it never supplies HTML.
export function englishDom(source: SiteCode, translations?: EnglishTranslation[], current?: SiteCode, protectedNames: string[] = []) {
  const code = structuredClone(source), slots: EnglishSlot[] = [];
  const supplied = translations ? new Map(translations.map(item => [item.id, item.text])) : null;
  if (supplied && supplied.size !== translations!.length) throw new Error('英文译文编号重复。');
  const names = [...new Set(protectedNames.filter(Boolean))].sort((a, b) => b.length - a.length);
  const protectedPattern = names.length ? new RegExp(`(${names.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g') : null;
  const punctuation = (text: string) => text.replace(/[\uff01-\uff0f\uff1a-\uff20\uff3b-\uff40\uff5b-\uff5e]/g, char => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replaceAll('。', '.').replaceAll('、', ',');
  const copy = (text: string, id: string, pageId: string | null, path: string, currentText?: string) => {
    if (!/[\p{Script=Han}]/u.test(text)) return text;
    slots.push({ id, text, pageId, path, ...(current ? { currentText } : {}) });
    if (!supplied) return text;
    const after = supplied.get(id);
    if (after === undefined || !after.trim()) throw new Error(`英文译文遗漏：${id}`);
    // Company identities come only from metadata. Keep every exact name
    // substring unchanged while normalizing punctuation in surrounding copy.
    return protectedPattern ? after.split(protectedPattern).map((part, index) => index % 2 ? part : punctuation(part)).join('') : punctuation(after);
  };
  const html = (before: string, field: string, pageId: string | null, currentHtml?: string) => {
    const doc = new DOMParser().parseFromString(`<body>${before}</body>`, 'text/html');
    const candidate = currentHtml === undefined ? undefined : new DOMParser().parseFromString(`<body>${currentHtml}</body>`, 'text/html').body;
    let index = 0;
    const walk = (node: Node, path: string, right?: Node) => {
      if (current && (!right || node.nodeType !== right.nodeType || node.nodeName !== right.nodeName || node.childNodes.length !== right.childNodes.length)) throw new Error('当前英文结构不同，无法定位修正段落。');
      const at = index++;
      if (node.nodeType === Node.TEXT_NODE) node.textContent = copy(node.textContent || '', `${field}:${at}:text`, pageId, path, right?.textContent || '');
      if (node instanceof Element) for (const name of ['alt', 'title', 'aria-label', 'aria-description', 'placeholder', 'data-label']) {
        if (node.hasAttribute(name)) node.setAttribute(name, copy(node.getAttribute(name)!, `${field}:${at}:${name}`, pageId, `${path}[${name}]`, right instanceof Element ? right.getAttribute(name) ?? '' : ''));
      }
      for (let i = 0; i < node.childNodes.length; i++) walk(node.childNodes[i], `${path}/${i}`, right?.childNodes[i]);
    };
    walk(doc.body, pageId ?? field, candidate); return doc.body.innerHTML;
  };
  code.header = html(source.header, 'header', null, current?.header); code.footer = html(source.footer, 'footer', null, current?.footer);
  code.pages = source.pages.map(page => { const right = current?.pages.find(item => item.id === page.id); return { ...page, title: copy(page.title, `page:${page.id}:title`, page.id, `${page.id}:title`, right?.title), html: html(page.html, `page:${page.id}`, page.id, right?.html) }; });
  if (supplied && (supplied.size !== slots.length || slots.some(slot => !supplied.has(slot.id)))) throw new Error('英文译文编号越界或遗漏。');
  return { code, slots };
}
export async function englishText(source: SiteCode, translations?: EnglishTranslation[], current?: SiteCode, protectedNames: string[] = []) {
  const browser = await codeCheckBrowser();
  try { return await browser.evaluate<ReturnType<typeof englishDom>>(`(${englishDom.toString()})(${JSON.stringify(source)},${JSON.stringify(translations)},${JSON.stringify(current)},${JSON.stringify(protectedNames)})`); }
  finally { await browser.close(); }
}

// All source/output pairs are compared at the commit boundary, including restores.
// Semantic equivalence of places and other proper nouns remains T-082's known limitation.
export function englishFidelity(source: SiteCode, candidate: SiteCode, companyName: string, materials = '', generated: Array<{ field: string; before: string; after: string }> = []) {
  const issues: string[] = [];
  const attrs = new Set(['alt', 'title', 'aria-label', 'aria-description', 'placeholder', 'data-label']);
  const same = (before: unknown, after: unknown) => JSON.stringify(before) === JSON.stringify(after);
  const tokens = (text: string, sourceTokens?: string[]) => {
    const found: string[] = [];
    const units: Record<string, string> = { '毫米': 'mm', '厘米': 'cm', '千米': 'km', '平方米': 'm2', '立方米': 'm3', '米': 'm', '微米': 'μm',
      '千克': 'kg', '公斤': 'kg', '毫克': 'mg', '克': 'g', '吨': 't', '千瓦': 'kW', '瓦': 'W', '毫升': 'mL', '升': 'L',
      '分钟': 'min', '小时': 'h', '秒': 's', '天': 'days', '月': 'months', '年': 'years', '次': 'times', '腔': 'cavities', '模次': 'cycles', '级': 'grade', class: 'grade', grade: 'grade',
      hour: 'h', hours: 'h', minute: 'min', minutes: 'min', second: 's', seconds: 's',
      day: 'days', year: 'years', month: 'months', months: 'months', time: 'times', run: 'times', runs: 'times', occurrence: 'times', occurrences: 'times', cavity: 'cavities', ml: 'mL', 'molding cycles': 'cycles', 'mold cycles': 'cycles' };
    // Explicit unit vocabulary: these words cannot be ordinary count nouns or
    // modifiers of an occurrence count. No physical unit conversion is allowed.
    const englishUnits: Record<string, string> = {
      rpm: 'rpm', 'revolutions per minute': 'rpm', rps: 'rps', 'revolutions per second': 'rps',
      psi: 'psi', 'pounds per square inch': 'psi', bar: 'bar', bars: 'bar',
      Hz: 'Hz', hz: 'Hz', hertz: 'Hz', kHz: 'kHz', kilohertz: 'kHz', MHz: 'MHz', megahertz: 'MHz',
      min: 'min', mins: 'min', minute: 'min', minutes: 'min', h: 'h', hr: 'h', hrs: 'h', hour: 'h', hours: 'h',
      s: 's', sec: 's', secs: 's', second: 's', seconds: 's', ms: 'ms', millisecond: 'ms', milliseconds: 'ms',
      mm: 'mm', millimeter: 'mm', millimeters: 'mm', millimetre: 'mm', millimetres: 'mm',
      cm: 'cm', centimeter: 'cm', centimeters: 'cm', centimetre: 'cm', centimetres: 'cm',
      m: 'm', meter: 'm', meters: 'm', metre: 'm', metres: 'm', km: 'km', kilometer: 'km', kilometers: 'km', kilometre: 'km', kilometres: 'km',
      kg: 'kg', kilogram: 'kg', kilograms: 'kg', g: 'g', gram: 'g', grams: 'g', mg: 'mg', milligram: 'mg', milligrams: 'mg',
      t: 't', ton: 't', tons: 't', tonne: 't', tonnes: 't',
      L: 'L', liter: 'L', liters: 'L', litre: 'L', litres: 'L', mL: 'mL', ml: 'mL', milliliter: 'mL', milliliters: 'mL', millilitre: 'mL', millilitres: 'mL',
      W: 'W', watt: 'W', watts: 'W', kW: 'kW', kilowatt: 'kW', kilowatts: 'kW',
      V: 'V', volt: 'V', volts: 'V', kV: 'kV', kilovolt: 'kV', kilovolts: 'kV', A: 'A', ampere: 'A', amperes: 'A', mA: 'mA', milliampere: 'mA', milliamperes: 'mA',
      Pa: 'Pa', pascal: 'Pa', pascals: 'Pa', kPa: 'kPa', kilopascal: 'kPa', kilopascals: 'kPa', MPa: 'MPa', megapascal: 'MPa', megapascals: 'MPa',
      inch: 'inch', inches: 'inch', ft: 'ft', foot: 'ft', feet: 'ft', yd: 'yd', yard: 'yd', yards: 'yd',
      lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb', oz: 'oz', ounce: 'oz', ounces: 'oz',
    };
    Object.assign(units, englishUnits);
    for (const unit of ['mm', 'cm', 'km', 'm2', 'm3', 'm', 'μm', 'kg', 'mg', 'g', 't', 'kW', 'W', 'kV', 'V', 'mA', 'A', 'MHz', 'kHz', 'Hz', 'MPa', 'kPa', 'Pa', 'mL', 'L', 'min', 'ms', 's', 'h', 'days', 'years', 'times', 'cavities', 'cycles', 'bar', 'psi', '°C', '%', 'D']) units[unit] = unit;
    const unitWords = new Set(Object.keys(units).filter(unit => /^[A-Za-z]+$/.test(unit)).map(unit => unit.toLowerCase()));
    for (const phrase of Object.keys(englishUnits)) for (const word of phrase.split(' ')) unitWords.add(word.toLowerCase());
    // Pure classifiers carry no physical or time unit. 次 and 年 are excluded.
    const counts: Record<string, string> = { 台: '', 套: '', 个: '', 件: '', 条: '', 家: '', 名: '', 位: '', 种: '', 款: '', 项: '', 座: '', 只: '', 张: '', 批: '' };
    Object.assign(units, counts, { piece: '', pieces: '', pcs: '', set: '', sets: '', unit: '', units: '' });
    const chineseNumber = (value: string) => {
      const digits: Record<string, number> = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
      const powers: Record<string, number> = { 十: 10, 百: 100, 千: 1000, 万: 10000, 亿: 100000000 };
      if (!/[十百千万亿]/.test(value)) return [...value].map(char => digits[char]).join('');
      let total = 0, section = 0, digit = 0;
      for (const char of value) {
        if (char in digits) digit = digits[char];
        else if (powers[char] < 10000) { section += (digit || 1) * powers[char]; digit = 0; }
        else { section += digit; total = powers[char] === 100000000 ? (total + (section || 1)) * powers[char] : total + (section || 1) * powers[char]; section = 0; digit = 0; }
      }
      return String(total + section + digit);
    };
    // Decimal-place shifts are exact spelling equivalences, never a unit conversion.
    const decimal = (value: string, power: number) => {
      const negative = value.startsWith('-'), [whole, fraction = ''] = value.replace(/^[+-]/, '').replace(/^\./, '0.').replaceAll(',', '').split('.');
      const digits = whole + fraction, point = whole.length + power;
      const shifted = point >= digits.length ? digits + '0'.repeat(point - digits.length) : digits.slice(0, point) + '.' + digits.slice(point);
      const canonical = shifted.replace(/^0+(?=\d)/, '').replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
      return (negative && canonical !== '0' ? '-' : '') + canonical;
    };
    text = text.normalize('NFKC').replace(/[\u200b-\u200d\ufeff]/g, '').replace(/[–—−]/g, '-');
    text = text.replace(/([零〇一二两三四五六七八九十百\d]+)次元/g, (_all, number: string) => `${/\d/.test(number) ? number : chineseNumber(number)}D`);
    const chineseUnits = Object.keys(units).filter(unit => /\p{Script=Han}/u.test(unit)).sort((a, b) => b.length - a.length).join('|');
    // 万/亿 after an Arabic value are magnitudes, not a second integer.
    text = text.replace(/(\d)\s+(?=[万亿])/g, '$1');
    text = text.replace(new RegExp(`(?<![\\d零〇一二两三四五六七八九十百千万亿])([零〇一二两三四五六七八九十百千万亿]+)(?=\\s*(?:${chineseUnits}))`, 'g'), (number, _capture, offset) =>
      /\d\s*$/.test(text.slice(0, offset)) || Object.keys(units).some(unit => /\p{Script=Han}/u.test(unit) && text.startsWith(unit, offset)) ? number : chineseNumber(number));
    text = text.replace(/[零〇一二两三四五六七八九十百千万亿]+/g, number => number.length > 1 && /[十百千万亿]/.test(number) ? chineseNumber(number) : number);
    const mask = (kind: string, value: string) => { found.push(`${kind}:${value}`); return ' '.repeat(value.length); };
    text = text.replace(/(?:https?:\/\/|www\.)[^\s<>"，。；、)\]}]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, value => mask('contact', value));
    text = text.replace(/\+\d[\d ()-]{6,}\d/g, value => /[ ()-]/.test(value) && value.replace(/\D/g, '').length >= 7 ? mask('phone', value.replace(/[^\d+]/g, '')) : value);
    text = text.replace(/\b\d+(?:[-/]\d+){2,}\b/g, value => mask('marker', value));
    const number = '[+-]?(?:\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?|\\.\\d+)';
    // The grade label moves before the value in English; its value and role stay.
    text = text.replace(new RegExp(`\\b(?:Class|Grade)\\s+(${number})(?![A-Za-z0-9.])`, 'gi'), '$1级');
    // Protect markers before a quantity parser can consume them as count nouns.
    // Pure numeric values and explicitly mapped digit-bearing units are handled
    // by quantities; mixed identifiers retain their complete independent token.
    const letter = '(?!\\p{Script=Han})\\p{L}';
    const marker = new RegExp(`(?:${letter}|\\p{N})+(?:[._/-](?:${letter}|\\p{N})+)*`, 'gu');
    for (const value of text.match(marker) ?? []) {
      const measurement = value.match(/^(?:\d+(?:\.\d+)?|\.\d+)(.+)$/);
      const mappedMeasurement = measurement && measurement[1].split(/[/·*]/).every(part => part in units);
      if (/\d/.test(value) && /[^\d.,/+-]/.test(value) && !(value in units) && !mappedMeasurement) found.push(`marker:${value}`);
    }
    // Registered multiword units are whole atoms. Resolve the longest alias
    // before a / or per inside it can be mistaken for a separate time ratio.
    // Single-word aliases are already read whole by the quantity parser.
    const completeAliases = Object.keys(units).filter(alias => /\s/.test(alias)).sort((a, b) => b.length - a.length);
    const aliasPattern = new RegExp(`(?<![\\p{L}\\p{N}_])(?:${completeAliases.map(alias => alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')).join('|')})(?![\\p{L}\\p{N}_-])`, 'giu');
    text = text.replace(aliasPattern, alias => units[alias.replace(/\s+/g, ' ').toLowerCase()]);
    // Rates are exact aliases of five distinct periods. Keep their positions
    // while masking their spelling, then bind each rate to its own quantity.
    const periods: Record<string, string> = { 年: 'year', year: 'year', annually: 'year', 月: 'month', month: 'month', monthly: 'month', 天: 'day', 日: 'day', day: 'day', daily: 'day', 小时: 'hour', h: 'hour', hour: 'hour', hourly: 'hour', 分钟: 'minute', min: 'minute', minute: 'minute' };
    const rates: Array<{ kind: string; start: number; end: number; direction: 'before' | 'after' | 'either'; head?: string }> = [];
    const readRates = (pattern: RegExp, direction: 'before' | 'after' | 'either') => {
      text = text.replace(pattern, (all, period: string, start: number) => {
        const head = direction === 'after' ? text.slice(0, start).trimEnd().match(/(?:(?!\p{Script=Han})[\p{L}\p{N}°%^_-]|\.(?=\p{L}))+$/u)?.[0] : undefined;
        rates.push({ kind: periods[period.toLowerCase()], start, end: start + all.length, direction, head });
        return ' '.repeat(all.length);
      });
    };
    readRates(/每(小时|分钟|年|月|天|日)/g, 'before');
    // A production period can precede the production noun and its modifiers:
    // 年产, 月产能 and 月注塑能力 all have the same grammatical period prefix.
    readRates(/(?<!\d)(年|月|日)(?=产|\p{Script=Han}*能力)/gu, 'before');
    readRates(/(?:\bper\s+|-per-)(year|month|day|hour|minute)(?![\p{L}\p{N}_])/giu, 'after');
    readRates(/\ba\s+(year|month|day)(?![\p{L}\p{N}_])/giu, 'after');
    readRates(/\/\s*(小时|分钟|year|month|day|min|年|月|天|日|h)(?![\p{L}\p{N}_])/gu, 'after');
    readRates(/\b(annually|monthly|daily|hourly)\b/gi, 'either');
    // Consume the entire unit atom, including unknown Latin symbols, and all
    // compound components. A prefix such as L in L/min is never a whole unit.
    const symbol = `(?!\\p{Script=Han})[\\p{L}°%‰‱](?:(?!\\p{Script=Han})[\\p{L}\\p{N}°%^_-]|\\.(?=\\p{L}))*`;
    const occurrences = '(?:[A-Za-z]+\\s+)+(?:runs|occurrences)';
    const knownPhrases = Object.keys(englishUnits).filter(unit => unit.includes(' ')).map(unit => unit.replaceAll(' ', '\\s+')).join('|');
    const atom = `(?:${knownPhrases}|molding\\s+cycles|mold\\s+cycles|${chineseUnits}|${occurrences}|${symbol}|\\p{Script=Han}+)`;
    const separator = '(?:[/·*]|-per-|\\s+per\\s+)';
    const unit = `${atom}(?:\\s*${separator}\\s*${atom})*`;
    const operatorAtom = `(?:${chineseUnits}|(?:(?!-per-)(?!\\p{Script=Han})[\\p{L}\\p{N}°%^_-]|\\.(?=\\p{L}))+)`;
    const compound = new RegExp(`${operatorAtom}(?:\\s*${separator}\\s*${operatorAtom})+`, 'gu');
    // Operator-bearing tokens are independent facts even without a preceding
    // number. Known components use exact aliases; unknown components stay exact.
    for (const value of text.match(compound) ?? []) {
      const parts = value.split(/\s*([/·*]|-per-|\s+per\s+)\s*/);
      // A slash between ordinary words is also prose punctuation. Unit
      // operators have a unit component; unknown components are kept whole.
      // Unknown quantities still retain their entire compound below.
      const unitPart = (part: string) => {
        const measurement = part.match(/^(?:\d+(?:\.\d+)?|\.\d+)(.+)$/);
        return units[part] ?? (measurement && measurement[1] in units ? units[measurement[1]] : part);
      };
      if (parts.some((part, index) => index % 2 === 0 && units[part] !== undefined && units[part] !== '')) found.push('unit:' + parts.map((part, index) => index % 2 === 0 ? unitPart(part) : /per/.test(part) ? '/' : part).join(''));
    }
    const quantity = new RegExp(`(?<![\\p{N}._/+-])(?<!(?!\\p{Script=Han})\\p{L})([±≥≤<>]=?)?\\s*(${number})(?:\\s*[-×x]\\s*(${number}))?\\s*(万|亿|thousand|million|billion)?\\s*(${unit})?(?![A-Za-z0-9/·*])`, 'gu');
    const quantities = [...text.matchAll(quantity)].map(match => {
      const start = match.index + match[0].indexOf(match[2]);
      const end = match[3] === undefined ? start + match[2].length : match.index + match[0].indexOf(match[3], start - match.index + match[2].length) + match[3].length;
      return { at: match.index, start, end };
    });
    const boundRates = new Map<number, string[]>();
    for (const rate of rates) {
      const candidates = quantities.flatMap(value => {
        const before = value.end <= rate.start, after = value.start >= rate.end;
        if ((!before && !after) || (rate.direction === 'before' && !after) || (rate.direction === 'after' && !before)) return [];
        const between = before ? text.slice(value.end, rate.start) : text.slice(rate.end, value.start);
        if (/[,;!?()。；，\n]|\.(?=\s|$)/.test(between)) return [];
        return [{ ...value, distance: between.length }];
      }).sort((a, b) => a.distance - b.distance);
      if (candidates.length) {
        const at = candidates[0].at;
        boundRates.set(at, [...boundRates.get(at) ?? [], rate.kind]);
      } else {
        found.push(`rate:${rate.kind}`);
        // An unbound compound still protects its full numerator. It cannot
        // turn an unknown unit into an ordinary word by removing /min, etc.
        if (rate.head && units[rate.head] !== '') found.push(`unit:${units[rate.head] ?? rate.head}`);
      }
    }
    const scales: Record<string, number> = { 万: 4, 亿: 8, thousand: 3, million: 6, billion: 9 };
    const bare = new Map<string, number>();
    for (const token of sourceTokens ?? []) if (/^quantity:.*@(?:#rate:[a-z,]+)?$/.test(token)) bare.set(token, (bare.get(token) ?? 0) + 1);
    text = text.replace(quantity, (all, operator: string | undefined, first: string, last: string | undefined, scale: string | undefined, unit: string | undefined, offset: number) => {
      const values = [first, ...(last === undefined ? [] : [last])].map(value => decimal(value, scales[scale ?? ''] ?? 0));
      const comparison = operator === '≥' ? '>=' : operator === '≤' ? '<=' : operator ?? '';
      const atoms = (unit ?? '').split(/\s*([/·*]|-per-|\s+per\s+)\s*/);
      const canonical = (part: string) => units[part] ?? (/\s(?:runs|occurrences)$/.test(part) && part.split(/\s+/).slice(0, -1).every(word => /^[A-Za-z]+$/.test(word) && !unitWords.has(word.toLowerCase())) ? 'times' : undefined);
      const unknown = atoms.some((part, index) => index % 2 === 0 && part && canonical(part) === undefined);
      const canonicalUnit = atoms.map((part, index) => index % 2 === 0 ? canonical(part) ?? part : /per/.test(part) ? '/' : part).join('');
      const rateKinds = boundRates.get(offset);
      const rateUnit = rateKinds ? `#rate:${rateKinds.sort().join(',')}` : '';
      const tail = text.slice(offset + all.length - (unit?.length ?? 0)).match(/^[^.,;:!?()[\]。；，\n]*/)?.[0].trim() ?? '';
      const countNoun = /^[A-Za-z]+(?:\s+[A-Za-z]+)*$/.test(tail) && tail.split(/\s+/).every(word => !unitWords.has(word.toLowerCase()) && word.toLowerCase() !== 'per');
      for (const value of values) {
        const prefix = `quantity:${comparison}${value}@`, bareKey = prefix + rateUnit, exact = prefix + canonicalUnit + rateUnit;
        // Only source quantities with no physical/time unit can accept a new
        // ordinary English count noun. Source unknown units remain exact facts.
        if (unknown && countNoun && sourceTokens && !sourceTokens.includes(exact) && (bare.get(bareKey) ?? 0) > 0) {
          found.push(bareKey); bare.set(bareKey, bare.get(bareKey)! - 1);
        } else found.push(exact);
      }
      return ' '.repeat(all.length);
    });
    // An unconsumed numeric token is still a fact, never silently dropped.
    for (const value of text.match(marker) ?? []) if (/\d/.test(value) && /^[\d.,/+-]+$/.test(value)) found.push(`marker:${value}`);
    return found.sort();
  };
  const text = (before: string, after: string, field: string) => {
    if (!before.trim() && !after.trim()) return;
    if (!after.trim()) issues.push(`${field} 漏译：译文为空`);
    const names = [...new Set([companyName, ...[...materials.matchAll(/^[ \t]*(?:英文公司名|公司英文名|英文名)[：:][ \t]*(.+)$/gm)].map(match => match[1].trim())].filter(Boolean))];
    const nameCount = (value: string) => names.reduce((count, name) => count + value.split(name).length - 1, 0);
    if (nameCount(before) !== nameCount(after)) issues.push(`${field} 保真：公司名须使用记录名称或资料明确的英文名`);
    // Names are whole identifiers with explicit metadata equivalence, already
    // checked above. Do not reinterpret their characters as measurement units.
    const withoutNames = (value: string) => names.reduce((text, name) => text.replaceAll(name, ''), value);
    const remaining = withoutNames(after);
    if (/[\p{Script=Han}]/u.test(remaining)) issues.push(`${field} 漏译：仍含中文文字`);
    if ((before.match(/待补充/g) ?? []).length !== (after.match(/To be provided/g) ?? []).length) issues.push(`${field} 待补充须译为 To be provided`);
    const originalTokens = tokens(withoutNames(before));
    if (!same(originalTokens, tokens(remaining, originalTokens))) issues.push(`${field} 保真：含数字记号、数值与单位、邮箱或网址不一致`);
    if (/<\/?[A-Za-z][^>]*>/.test(after)) issues.push(`${field} 译文须为纯文字，不能包含 HTML`);
  };
  const markup = (before: string, after: string, field: string) => {
    const parse = (html: string) => new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body;
    const compare = (left: Node, right: Node, at: string) => {
      if (left.nodeType !== right.nodeType || left.nodeName !== right.nodeName || left.childNodes.length !== right.childNodes.length) { issues.push(`${at} 结构与中文版不同`); return; }
      if (left.nodeType === Node.TEXT_NODE) text(left.textContent || '', right.textContent || '', at);
      else if (left instanceof Element && right instanceof Element) {
        if (left.attributes.length !== right.attributes.length) { issues.push(`${at} 结构属性与中文版不同`); return; }
        for (const attr of left.attributes) {
          if (!right.hasAttribute(attr.name)) { issues.push(`${at} 结构属性与中文版不同`); continue; }
          const value = right.getAttribute(attr.name)!;
          if (attrs.has(attr.name)) text(attr.value, value, `${at}[${attr.name}]`);
          else if (value !== attr.value) issues.push(`${at}[${attr.name}] 结构属性与中文版不同`);
        }
      } else if (left.nodeType !== Node.TEXT_NODE && left.nodeType !== Node.ELEMENT_NODE && left.nodeValue !== right.nodeValue) issues.push(`${at} 结构注释与中文版不同`);
      for (let i = 0; i < left.childNodes.length; i++) compare(left.childNodes[i], right.childNodes[i], `${at}/${i}`);
    };
    compare(parse(before), parse(after), field);
  };
  if (source.css !== candidate.css) issues.push('英文版 CSS 必须与中文版一致');
  markup(source.header, candidate.header, 'header'); markup(source.footer, candidate.footer, 'footer');
  if (!same(source.pages.map(page => page.id), candidate.pages.map(page => page.id))) issues.push('英文版页面结构与中文版不同');
  else source.pages.forEach((page, index) => { text(page.title, candidate.pages[index].title, `${page.id}:title`); markup(page.html, candidate.pages[index].html, page.id); });
  for (const pair of generated) {
    if (!!pair.before.trim() !== !!pair.after.trim()) issues.push(`${pair.field} CSS 生成文字新增或遗漏`);
    text(pair.before, pair.after, pair.field);
  }
  return [...new Set(issues)];
}

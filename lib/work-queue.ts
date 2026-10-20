// T-202: on the small public server every generation and check shares one queue
// with concurrency 1. Each workspace token may hold one task, and the waiting line
// is short; past that the visitor is told the server is busy. Other storage modes
// (development, tests, evaluations) keep their existing unlimited behaviour.
export class ServerBusyError extends Error {
  constructor(message = '服务器忙，请稍后再试。') { super(message); this.name = 'ServerBusyError'; }
}
export type WorkTicket = { granted(): boolean; acquire(): Promise<{ waited: boolean }>; release(): void };

type Entry = { granted: boolean; wake: (() => void) | null };
type QueueState = { holder: Entry | null; line: Entry[]; tokens: Map<string, number>; sites: Map<string, number> };
const shared = globalThis as typeof globalThis & { __sitecraftWorkQueue?: QueueState };
const state: QueueState = shared.__sitecraftWorkQueue ??= { holder: null, line: [], tokens: new Map(), sites: new Map() };

function limited() { return process.env.SITE_STORE === 'browser'; }
function maxWaiting() {
  const value = Number(process.env.SITECRAFT_QUEUE_WAITING ?? 3);
  return Number.isInteger(value) && value >= 0 ? value : 3;
}
const bump = (map: Map<string, number>, key: string, by: number) => {
  const next = (map.get(key) ?? 0) + by;
  if (next > 0) map.set(key, next); else map.delete(key);
};
function promote() {
  if (state.holder || !state.line.length) return;
  const next = state.line.shift()!;
  state.holder = next; next.granted = true; next.wake?.();
}

export function siteHasWork(siteId: string) { return state.sites.has(siteId); }

// Reserve before any state changes; throws ServerBusyError when the line is full.
// The reservation joins the line at once, so the line cannot overfill before acquire.
export function reserveWork(token: string | null, siteId: string): WorkTicket {
  if (limited()) {
    if (token && state.tokens.has(token)) throw new ServerBusyError('你已有一个任务在处理或排队，请等它完成后再提交。');
    if ((state.holder ? 1 : 0) + state.line.length >= 1 + maxWaiting()) throw new ServerBusyError();
  }
  if (token) bump(state.tokens, token, 1);
  bump(state.sites, siteId, 1);
  const entry: Entry = { granted: !limited(), wake: null };
  if (limited()) { state.line.push(entry); promote(); }
  let released = false;
  return {
    granted: () => entry.granted,
    async acquire() {
      if (entry.granted) return { waited: false };
      await new Promise<void>(resolve => { entry.wake = resolve; if (entry.granted) resolve(); });
      return { waited: true };
    },
    release() {
      if (released) return; released = true;
      if (token) bump(state.tokens, token, -1);
      bump(state.sites, siteId, -1);
      if (!limited()) return;
      if (state.holder === entry) state.holder = null;
      else { const index = state.line.indexOf(entry); if (index >= 0) state.line.splice(index, 1); }
      promote();
    },
  };
}

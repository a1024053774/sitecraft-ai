import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { recordCheckDiagnostic } from './code-check-diagnostics.ts';

// A commit owns one isolated Chrome profile and process. It never attaches to or kills another browser.
export async function codeCheckBrowser() {
  const startedAt = Date.now();
  const calls: Array<{ method: string; startedAt: number; durationMs: number; status: string; pathname?: string }> = [];
  const binary = process.env.CHROME_PATH;
  if (!binary) throw new Error('底线检查需要 CHROME_PATH；本次未保存版本。');
  const profile = await mkdtemp(path.join(os.tmpdir(), 'sitecraft-code-check-'));
  const child = spawn(binary, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
  let launchError: Error | null = null; child.on('error', error => { launchError = error; });
  // A Chrome killed by a signal (e.g. SIGTRAP when no sandbox is usable) keeps exitCode null, so
  // the exit event is the only reliable sign that the process is gone.
  let exited = false; const exit = new Promise<void>(resolve => child.once('exit', () => { exited = true; resolve(); }));
  let socket: WebSocket | null = null;
  const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  const pageLoads = new Set<{ sessionId: string; resolve: () => void; reject: (error: Error) => void }>();
  const close = async () => {
    socket?.close();
    if (!exited && child.pid) {
      child.kill('SIGTERM');
      const timer = setTimeout(() => child.kill('SIGKILL'), 2000);
      await exit; clearTimeout(timer);
    }
    await rm(profile, { recursive: true, force: true });
    recordCheckDiagnostic({ kind: 'browser', startedAt, endedAt: Date.now(), calls });
  };
  try {
    let address = '';
    for (let i = 0; i < 80 && !address; i++) {
      if (launchError) throw launchError;
      if (exited) throw new Error('Chrome 在检查开始前退出');
      try {
        const [portText, browserPath] = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).trim().split(/\r?\n/);
        const port = Number(portText);
        if (/^\d+$/.test(portText) && Number.isInteger(port) && port > 0 && port <= 65535 && /^\/devtools\/browser\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(browserPath ?? ''))
          address = `ws://127.0.0.1:${port}${browserPath}`;
      }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      if (!address) await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!address) throw new Error('Chrome 底线检查启动超时');
    socket = new WebSocket(address);
    await new Promise<void>((resolve, reject) => { socket!.addEventListener('open', () => resolve(), { once: true }); socket!.addEventListener('error', () => reject(new Error('Chrome 检查连接失败')), { once: true }); });
    socket.addEventListener('message', event => {
      const data = JSON.parse(String(event.data)); const task = pending.get(data.id);
      if (task) { pending.delete(data.id); data.error ? task.reject(new Error(data.error.message)) : task.resolve(data.result); }
      if (data.method === 'Page.loadEventFired') for (const load of pageLoads) if (load.sessionId === data.sessionId) load.resolve();
      if (process.env.SITECRAFT_CHECK_DIAGNOSTICS_DIR && ['Page.frameNavigated', 'Page.loadEventFired', 'Page.domContentEventFired'].includes(data.method)) {
        calls.push({ method: data.method, startedAt: Date.now(), durationMs: 0, status: 'event',
          ...(data.params?.frame?.url ? { pathname: new URL(data.params.frame.url).pathname } : {}) });
      }
    });
    socket.addEventListener('close', () => {
      const error = new Error('Chrome 检查连接关闭');
      for (const task of pending.values()) task.reject(error); pending.clear();
      for (const load of pageLoads) load.reject(error); pageLoads.clear();
    });
    let sequence = 0;
    const send = <T = Record<string, unknown>>(method: string, params: Record<string, unknown> = {}, sessionId?: string, timeoutMs = 30000): Promise<T> => new Promise((resolve, reject) => {
      const id = ++sequence;
      const startedAt = Date.now();
      const record = (status: string) => {
        if (process.env.SITECRAFT_CHECK_DIAGNOSTICS_DIR) calls.push({ method, startedAt, durationMs: Date.now() - startedAt, status,
          ...(method === 'Page.navigate' ? { pathname: new URL(String(params.url)).pathname } : {}) });
      };
      const timer = setTimeout(() => { pending.delete(id); record('timeout'); reject(new Error(`Chrome 检查 ${method} 超时`)); }, timeoutMs);
      pending.set(id, { resolve: value => { clearTimeout(timer); record('complete'); resolve(value as T); }, reject: error => { clearTimeout(timer); record('error'); reject(error); } });
      socket!.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
    const { targetId } = await send<{ targetId: string }>('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send<{ sessionId: string }>('Target.attachToTarget', { targetId, flatten: true });
    await send('Page.enable', {}, sessionId);
    const evaluate = async <T>(expression: string, timeoutMs?: number): Promise<T> => {
      const value = await send<{ result: { value: T }; exceptionDetails?: { text: string; exception?: { description: string } } }>('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId, timeoutMs);
      if (value.exceptionDetails) throw new Error(`Chrome 检查失败：${value.exceptionDetails.exception?.description || value.exceptionDetails.text}`);
      return value.result.value;
    };
    const loadPage = async (method: 'Page.navigate' | 'Page.reload', params: Record<string, unknown> = {}) => {
      let listener!: { sessionId: string; resolve: () => void; reject: (error: Error) => void };
      const loaded = new Promise<void>((resolve, reject) => { listener = { sessionId, resolve, reject }; pageLoads.add(listener); });
      const timer = setTimeout(() => listener.reject(new Error('Chrome 页面载入超时')), 30000);
      try {
        // Subscribe before issuing navigation. Its CDP response only confirms
        // commitment; reading an old/loading document can lose a DOM waiter.
        const [result] = await Promise.all([send(method, params, sessionId), loaded]);
        return result;
      } finally { clearTimeout(timer); pageLoads.delete(listener); }
    };
    return { send: <T = Record<string, unknown>>(method: string, params: Record<string, unknown> = {}) => send<T>(method, params, sessionId),
      loadPage, evaluate, close };
  } catch (error) { await close(); throw error; }
}

import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// A commit owns one isolated Chrome profile and process. It never attaches to or kills another browser.
export async function codeCheckBrowser() {
  const binary = process.env.CHROME_PATH;
  if (!binary) throw new Error('底线检查需要 CHROME_PATH；本次未保存版本。');
  const profile = await mkdtemp(path.join(os.tmpdir(), 'sitecraft-code-check-'));
  const child = spawn(binary, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
  let launchError: Error | null = null; child.on('error', error => { launchError = error; });
  let socket: WebSocket | null = null;
  const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  const close = async () => {
    socket?.close();
    if (child.exitCode === null && child.pid) {
      const exited = new Promise<void>(resolve => child.once('exit', () => resolve()));
      child.kill('SIGTERM');
      const timer = setTimeout(() => child.kill('SIGKILL'), 2000);
      await exited; clearTimeout(timer);
    }
    await rm(profile, { recursive: true, force: true });
  };
  try {
    let address = '';
    for (let i = 0; i < 80 && !address; i++) {
      if (launchError) throw launchError;
      if (child.exitCode !== null) throw new Error('Chrome 在检查开始前退出');
      try { const lines = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).trim().split('\n'); address = `ws://127.0.0.1:${lines[0]}${lines[1]}`; }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      if (!address) await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!address) throw new Error('Chrome 底线检查启动超时');
    socket = new WebSocket(address);
    await new Promise<void>((resolve, reject) => { socket!.addEventListener('open', () => resolve(), { once: true }); socket!.addEventListener('error', () => reject(new Error('Chrome 检查连接失败')), { once: true }); });
    socket.addEventListener('message', event => {
      const data = JSON.parse(String(event.data)); const task = pending.get(data.id);
      if (task) { pending.delete(data.id); data.error ? task.reject(new Error(data.error.message)) : task.resolve(data.result); }
    });
    socket.addEventListener('close', () => { for (const task of pending.values()) task.reject(new Error('Chrome 检查连接关闭')); pending.clear(); });
    let sequence = 0;
    const send = <T = Record<string, unknown>>(method: string, params: Record<string, unknown> = {}, sessionId?: string): Promise<T> => new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Chrome 检查 ${method} 超时`)); }, 30000);
      pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value as T); }, reject: error => { clearTimeout(timer); reject(error); } });
      socket!.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
    const { targetId } = await send<{ targetId: string }>('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send<{ sessionId: string }>('Target.attachToTarget', { targetId, flatten: true });
    await send('Page.enable', {}, sessionId);
    const evaluate = async <T>(expression: string): Promise<T> => {
      const value = await send<{ result: { value: T }; exceptionDetails?: { text: string; exception?: { description: string } } }>('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
      if (value.exceptionDetails) throw new Error(`Chrome 检查失败：${value.exceptionDetails.exception?.description || value.exceptionDetails.text}`);
      return value.result.value;
    };
    return { send: <T = Record<string, unknown>>(method: string, params: Record<string, unknown> = {}) => send<T>(method, params, sessionId), evaluate, close };
  } catch (error) { await close(); throw error; }
}

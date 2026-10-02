// Persistent Vite entry: npm run web [-- --port 5336 --skip-compile].
// Restore research workspaces with --skip-compile; do not keep Vite in a chat PTY.
import { spawn, execFileSync } from 'node:child_process';
import { openSync, closeSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PNG = Buffer.from('89504e470d0a1a0a', 'hex');

export function parseOptions(args) {
  const options = { port: 5200, compile: true }, seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (!['--port', '--skip-compile'].includes(key) || seen.has(key)) throw new Error(`无效或重复参数：${key}`);
    seen.add(key);
    if (key === '--skip-compile') { options.compile = false; continue; }
    const value = args[++i];
    if (!/^\d+$/.test(value || '') || +value < 1 || +value > 65535) throw new Error('--port 必须为 1–65535 的整数');
    options.port = +value;
  }
  return options;
}

export async function probeServer(base, { fetchImpl = fetch, timeoutMs = 2000 } = {}) {
  const checks = [];
  async function request(resource) {
    const response = await fetchImpl(new URL(resource, base).href, { redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
    const body = Buffer.from(await response.arrayBuffer());
    const check = { path: resource, status: response.status, type: response.headers.get('content-type') || '', ok: false };
    checks.push(check);
    return { body, check };
  }
  try {
    const { body, check } = await request('/');
    const html = body.toString('utf8');
    check.ok = check.status === 200 && check.type.includes('text/html') && html.includes('冬日猜想') && html.includes('src/main.js');
    if (!check.ok) return { state: 'foreign', checks, reason: '端口已有响应但非本项目，不接管、不另起服务。' };
  } catch (error) { return { state: 'offline', checks, reason: error.message }; }
  const assets = [
    { path: '/assets/ui/icons/dice.png', type: 'image/png', valid: b => b.subarray(0, 8).equals(PNG) },
    { path: '/assets/portraits/battle/wu.webp', type: 'image/webp', valid: b => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' },
  ];
  for (const asset of assets) {
    try {
      const { body, check } = await request(asset.path);
      check.ok = check.status === 200 && check.type.includes(asset.type) && asset.valid(body);
      if (!check.ok) return { state: 'unhealthy', checks, reason: `图片响应无效：${asset.path}` };
    } catch (error) {
      checks.push({ path: asset.path, ok: false, error: error.message });
      return { state: 'unhealthy', checks, reason: `图片请求失败：${asset.path}` };
    }
  }
  return { state: 'ready', checks };
}

export async function launchVite({ port, root = ROOT }, {
  spawnImpl = spawn, openLog = openSync, closeLog = closeSync, mkdir = mkdirSync,
} = {}) {
  const logPath = path.join(root, 'node_modules', '.cache', `web-up-${port}.log`);
  mkdir(path.dirname(logPath), { recursive: true });
  const fd = openLog(logPath, 'a');
  try {
    const child = spawnImpl(process.execPath,
      [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
      { cwd: root, detached: true, windowsHide: true, stdio: ['ignore', fd, fd] });
    await new Promise((resolve, reject) => { child.once('error', reject); child.once('spawn', resolve); });
    child.unref();
    return { child, logPath };
  } finally { closeLog(fd); }
}

export async function ensureServer(options, deps = {}) {
  const base = `http://127.0.0.1:${options.port}/`;
  const probe = deps.probe || (() => probeServer(base));
  const compile = deps.compile || (() => execFileSync(process.execPath, ['scripts/compile-narrative.mjs'], { cwd: ROOT, stdio: 'inherit' }));
  const launch = deps.launch || (() => launchVite(options));
  const sleep = deps.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const now = deps.now || Date.now;
  const first = await probe();
  if (first.state === 'ready') return { ok: true, reused: true, base, checks: first.checks };
  if (first.state !== 'offline') return { ok: false, base, ...first };
  if (options.compile) await compile();
  const { child, logPath } = await launch();
  const deadline = now() + (deps.timeoutMs ?? 30000);
  let last = first;
  while (now() < deadline) {
    await sleep(400);
    if (child.exitCode !== null && child.exitCode !== undefined) break;
    last = await probe();
    if (last.state === 'ready') return { ok: true, reused: false, base, pid: child.pid, logPath, checks: last.checks };
    if (last.state === 'foreign') break;
  }
  return { ok: false, base, pid: child.pid, logPath, state: last.state, reason: last.reason || 'Vite 未在期限内就绪', checks: last.checks };
}

async function main() {
  const options = parseOptions(process.argv.slice(2)), result = await ensureServer(options);
  if (result.ok) {
    if (!result.reused) writeFileSync(path.join(path.dirname(result.logPath), `web-up-${options.port}.json`), JSON.stringify({
      root: ROOT, url: result.base, pid: result.pid, startedAt: new Date().toISOString(), launch: 'detached-windowsHide', log: result.logPath, checks: result.checks,
    }, null, 2) + '\n');
    console.log(`[web-up] ${result.reused ? '已在线，复用' : `已独立后台启动（PID ${result.pid}）`}：${result.base}`);
    console.log('[web-up] 项目入口、PNG 图标及 WebP 立绘响应均有效。');
    if (result.logPath) console.log(`[web-up] 日志：${result.logPath}`);
    return;
  }
  console.error(`[web-up] ${result.base} ${result.reason}`);
  if (result.logPath) {
    try { console.error(readFileSync(result.logPath, 'utf8').trim().split(/\r?\n/).slice(-15).join('\n')); }
    catch { /* Useful diagnostic already printed. */ }
  }
  process.exitCode = 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(`[web-up] ${error.message}`); process.exitCode = 1; });
}

// web-up.mjs — 「拉起网页版」固定入口（幂等）：主线 5200 已在线则直接复用，
// 未在线则先编译 narrative 再以后台进程起 Vite（--strictPort 防端口漂移）。
// 用法：npm run web [-- --port 5399]（--port 仅隔离测试用，主线约定 5200）
import http from 'node:http';
import { spawn, execSync } from 'node:child_process';
import { openSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const portIdx = args.indexOf('--port');
const portArg = portIdx >= 0 ? Number(args[portIdx + 1]) : NaN;
const PORT = Number.isFinite(portArg) && portArg > 0 ? portArg : 5200;
const BASE = `http://localhost:${PORT}/`;
const LOG_PATH = path.join(ROOT, 'node_modules', '.cache', 'web-up.log');

function probe() {
  return new Promise((resolve) => {
    const req = http.get(BASE, { timeout: 2000 }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.on('error', () => resolve(false));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (await probe()) {
  console.log(`[web-up] 已在线，直接复用：${BASE}`);
  process.exit(0);
}

// 等价 predev：narrative 先编译，起服即可玩
execSync('node scripts/compile-narrative.mjs', { cwd: ROOT, stdio: 'inherit' });

mkdirSync(path.dirname(LOG_PATH), { recursive: true });
const logFd = openSync(LOG_PATH, 'a');
const child = spawn(
  process.execPath,
  [path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(PORT), '--strictPort'],
  { cwd: ROOT, detached: true, stdio: ['ignore', logFd, logFd] },
);
child.unref();

const deadline = Date.now() + 30000;
while (Date.now() < deadline) {
  await sleep(800);
  if (await probe()) {
    console.log(`[web-up] 已启动：${BASE}（PID ${child.pid}，日志 ${path.relative(ROOT, LOG_PATH)}）`);
    process.exit(0);
  }
  if (child.exitCode !== null) break; // vite 提前退出（如端口被占/编译失败）
}

console.error(`[web-up] 启动失败：${BASE} 未就绪（PID ${child.pid}），日志尾部：`);
try {
  const tail = readFileSync(LOG_PATH, 'utf8').split(/\r?\n/).filter(Boolean).slice(-20).join('\n');
  console.error(tail);
} catch { /* 日志缺失则忽略 */ }
process.exit(1);

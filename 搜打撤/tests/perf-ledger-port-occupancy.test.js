/* INFRA-06 回归：perf-ledger-capture.mjs 在 CDP 端口被外部占用时必须报错退出，
 * 绝不自动杀进程（旧实现按端口 netstat 挑 PID 直接 taskkill /T /F）。
 * 用真实监听器占住端口跑脚本本体：断言明确报错 + 占用进程毫发无损。 */
import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync, spawn } from 'node:child_process';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';

const listeners = [];
const procs = [];
const outDirs = [];
afterEach(() => {
  for (const p of procs) { try { p.kill(); } catch { /* 已退出 */ } }
  procs.length = 0;
  for (const s of listeners) { try { s.close(); } catch { /* 已关闭 */ } }
  listeners.length = 0;
  for (const directory of outDirs.splice(0)) {
    const relative = path.relative(os.tmpdir(), directory);
    if (!relative.startsWith('perf-ledger-test-') || relative.includes(path.sep)) throw new Error('拒绝清理非自有 fixture');
    rmSync(directory, { recursive: true, force: true });
  }
});

const listen = (port, host = '127.0.0.1') => new Promise((res, rej) => {
  const srv = http.createServer((req, rsp) => { rsp.writeHead(200); rsp.end('ok'); });
  srv.on('error', rej);
  srv.listen(port, host, () => { listeners.push(srv); res(srv); });
});
const freePort = () => new Promise((res, rej) => {
  const srv = http.createServer();
  srv.on('error', rej);
  srv.listen(0, '127.0.0.1', () => { const p = srv.address().port; srv.close(() => res(p)); });
});
const httpAlive = (url) => new Promise((resolve) => {
  const agent = new http.Agent({ keepAlive: false, proxyEnv: {} });
  const finish = result => { agent.destroy(); resolve(result); };
  const request = http.get(url, { agent }, response => {
    response.once('end', () => finish({ alive: response.statusCode === 200 }));
    response.resume();
  });
  request.on('error', error => finish({ alive: false, code: error.code }));
  request.setTimeout(2000, () => request.destroy());
});

function ownedIpv6ListenerAlive(url) {
  const target = new URL(url);
  if (target.hostname !== '[::1]' || !process.env.SystemRoot) return false;
  const endpoint = `${target.hostname}:${target.port}`;
  const rows = execFileSync(path.join(process.env.SystemRoot, 'System32', 'netstat.exe'),
    ['-ano', '-p', 'tcpv6'], { encoding: 'utf8', windowsHide: true, timeout: 3000 })
    .split(/\r?\n/).map(line => line.trim().split(/\s+/));
  return rows.some(row => row[0] === 'TCP' && row[1] === endpoint
    && row[3] === 'LISTENING' && Number(row[4]) === process.pid);
}

async function livenessWitness(url) {
  const before = await httpAlive(url);
  // 先确定环境能力，再执行脚本。HTTP 原本可达时，事后不可达必须失败，不能换证据。
  if (before.alive) return async () => (await httpAlive(url)).alive;
  // 受限 Windows 可允许 IPv6 bind 却拒绝 ::1 connect。保持真实占用测试，并独立核对
  // 内核中的同一地址、端口、Listen 状态和自有 PID；不声称此路径证明 HTTP 可达。
  if (process.platform === 'win32' && new URL(url).hostname === '[::1]' && before.code === 'EACCES') {
    expect(ownedIpv6ListenerAlive(url), '脚本执行前必须独立确认自有 IPv6 监听器').toBe(true);
    return async () => ownedIpv6ListenerAlive(url);
  }
  throw new Error(`自有监听器在脚本执行前已不可达（${before.code || 'HTTP status'}）`);
}

function runCapture(cdpPort, baseUrl) {
  const outDir = mkdtempSync(path.join(os.tmpdir(), 'perf-ledger-test-'));
  outDirs.push(outDir);
  // 仅在子进程屏蔽 Edge 发现：即使 Windows 已装 Edge，回归失败也不会真起浏览器。
  // 端口检查和脚本 main/cleanup 仍执行本体，明确证明预检先于浏览器发现。
  const captureUrl = new URL('../scripts/perf-ledger-capture.mjs', import.meta.url).href;
  const loader = 'import fs from "node:fs"; fs.existsSync = () => false; '
    + 'process.argv = [process.execPath, "perf-ledger-capture.mjs", ...process.argv.slice(1)]; '
    + `await import(${JSON.stringify(captureUrl)});`;
  const child = spawn(process.execPath, ['--input-type=module', '--eval', loader, '--',
    '--base-url', baseUrl, '--cdp-port', String(cdpPort), '--out', outDir], { cwd: process.cwd() });
  procs.push(child);
  return new Promise((res, rej) => {
    let buf = '';
    child.stdout.on('data', d => { buf += d; });
    child.stderr.on('data', d => { buf += d; });
    child.on('error', rej);
    child.on('close', (code) => res({ code, buf }));
  });
}

describe('INFRA-06 CDP 端口被占：报错退出、不杀进程', () => {
  it.each(['127.0.0.1', '0.0.0.0', '::1'])('%s 上端口被外部占用时脚本不杀任何进程、以明确报错退出', async (host, context) => {
    // 同一监听器兼作「可复用的 dev server」与「占用 CDP 端口的进程」：
    // startEdge 内先 await ensureCdpPortFree，无需真起 vite/Edge。
    let srv;
    try { srv = await listen(0, host); } catch (error) {
      if (host === '::1' && ['EADDRNOTAVAIL', 'EAFNOSUPPORT', 'EPROTONOSUPPORT'].includes(error.code)) {
        context.skip(); return;
      }
      throw error;
    }
    const cdpPort = srv.address().port;
    const listenerUrl = `http://${host === '::1' ? '[::1]' : '127.0.0.1'}:${cdpPort}/`;
    const alive = await livenessWitness(listenerUrl);
    // dev server 走 IPv4，避免环境 HTTP 代理把 ::1 的 fetch 错当成外网请求。
    const devServer = host === '::1' ? await listen(0) : srv;
    const baseUrl = `http://127.0.0.1:${devServer.address().port}/`;
    const stdout = await runCapture(cdpPort, baseUrl);
    expect(stdout.code, `应以非零退出：\n${stdout.buf}`).not.toBe(0);
    expect(stdout.buf).toMatch(/CDP 端口 \d+ 已被.*占用/);
    expect(stdout.buf).toMatch(/不自动杀进程/);
    expect(stdout.buf).not.toMatch(/清理占用/);   // 旧自动清场日志不得再出现
    expect(stdout.buf).not.toMatch(/找不到 Edge|跳过端口预检/);
    expect(await alive(), '占用端口的监听器被杀了！').toBe(true);
    await new Promise(resolve => srv.close(resolve));
    expect(await alive(), '关闭自有监听器后存活证据必须消失').toBe(false);
  }, 60000);

  it('空闲端口通过预检后才发现 Edge 缺失，并释放自己的探测 socket', async () => {
    const srv = await listen(0);
    const cdpPort = await freePort();
    const stdout = await runCapture(cdpPort, `http://127.0.0.1:${srv.address().port}/`);
    expect(stdout.code).not.toBe(0);
    expect(stdout.buf).toMatch(/找不到 Edge/);
    expect(stdout.buf).not.toMatch(/已被.*占用|预检失败/);
    const reused = await listen(cdpPort);
    expect(reused.address().port).toBe(cdpPort);
  });

  it.each(['not-a-port', '0', '65536'])('无效 CDP 端口 %s 在浏览器发现前拒绝', async (cdpPort) => {
    const srv = await listen(0);
    const stdout = await runCapture(cdpPort, `http://127.0.0.1:${srv.address().port}/`);
    expect(stdout.code).not.toBe(0);
    expect(stdout.buf).toMatch(/CDP 端口 .* 无效/);
    expect(stdout.buf).not.toMatch(/找不到 Edge/);
  });
});

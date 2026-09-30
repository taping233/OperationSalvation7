/* INFRA-06 回归：perf-ledger-capture.mjs 在 CDP 端口被外部占用时必须报错退出，
 * 绝不自动杀进程（旧实现按端口 netstat 挑 PID 直接 taskkill /T /F）。
 * 用真实监听器占住端口跑脚本本体：断言明确报错 + 占用进程毫发无损。 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawn } from 'node:child_process';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';

const listeners = [];
const procs = [];
afterEach(() => {
  for (const p of procs) { try { p.kill(); } catch { /* 已退出 */ } }
  procs.length = 0;
  for (const s of listeners) { try { s.close(); } catch { /* 已关闭 */ } }
  listeners.length = 0;
});

const listen = (port) => new Promise((res, rej) => {
  const srv = http.createServer((req, rsp) => { rsp.writeHead(200); rsp.end('ok'); });
  srv.on('error', rej);
  srv.listen(port, '127.0.0.1', () => { listeners.push(srv); res(srv); });
});
const freePort = () => new Promise((res) => {
  const srv = http.createServer();
  srv.listen(0, '127.0.0.1', () => { const p = srv.address().port; srv.close(() => res(p)); });
});
const alive = (port) => fetch(`http://127.0.0.1:${port}/`).then(r => r.ok).catch(() => false);

describe('INFRA-06 CDP 端口被占：报错退出、不杀进程', () => {
  it('端口被外部占用时脚本不杀任何进程、以明确报错退出', async () => {
    const cdpPort = await freePort();
    // 同一监听器兼作「可复用的 dev server」与「占用 CDP 端口的进程」：
    // 脚本在 startEdge 前的 ensureCdpPortFree 处报错，无需真起 vite/Edge。
    const srv = await listen(cdpPort);
    const outDir = mkdtempSync(path.join(os.tmpdir(), 'perf-ledger-test-'));
    const child = spawn(process.execPath, ['scripts/perf-ledger-capture.mjs',
      '--base-url', `http://127.0.0.1:${cdpPort}/`, '--cdp-port', String(cdpPort),
      '--out', outDir], { cwd: process.cwd(), encoding: 'utf8' });
    procs.push(child);
    const stdout = await new Promise((res) => {
      let buf = '';
      child.stdout.on('data', d => { buf += d; });
      child.stderr.on('data', d => { buf += d; });
      child.on('close', (code) => res({ code, buf }));
    });
    expect(stdout.code, `应以非零退出：\n${stdout.buf}`).not.toBe(0);
    expect(stdout.buf).toMatch(/CDP 端口 \d+ 已被.*占用/);
    expect(stdout.buf).toMatch(/不自动杀进程/);
    expect(stdout.buf).not.toMatch(/清理占用/);   // 旧自动清场日志不得再出现
    expect(await alive(cdpPort), '占用端口的监听器被杀了！').toBe(true);
    srv.close();
  }, 60000);
});

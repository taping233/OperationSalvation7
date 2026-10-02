// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import http from 'node:http';
import { EventEmitter } from 'node:events';
import path from 'node:path';
import { ensureServer, launchVite, parseOptions, probeServer } from '../scripts/web-up.mjs';

const listeners = [];
const page = '<!doctype html><title>升格会的冬日猜想</title><script type="module" src="./src/main.js"></script>';
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const webp = Buffer.from('RIFF\x04\x00\x00\x00WEBP', 'binary');
const healthyRoutes = {
  '/': { type: 'text/html; charset=utf-8', body: page },
  '/assets/ui/icons/dice.png': { type: 'image/png', body: png },
  '/assets/portraits/battle/wu.webp': { type: 'image/webp', body: webp },
};

async function server(overrides = {}) {
  const routes = { ...healthyRoutes, ...overrides };
  const listener = http.createServer((req, res) => {
    const route = routes[req.url];
    res.writeHead(route?.status ?? (route ? 200 : 404), { 'Content-Type': route?.type ?? 'text/plain' });
    res.end(route?.body ?? 'missing');
  });
  await new Promise((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', resolve);
  });
  listeners.push(listener);
  return `http://127.0.0.1:${listener.address().port}/`;
}

afterEach(async () => {
  await Promise.all(listeners.splice(0).map(listener => new Promise((resolve, reject) => {
    listener.close(error => error ? reject(error) : resolve());
    listener.closeAllConnections();
  })));
});

function processFixture() {
  const child = new EventEmitter();
  Object.assign(child, { pid: 12345, exitCode: null, unref: vi.fn() });
  return child;
}

function dependencies(states) {
  const child = processFixture();
  const probe = vi.fn();
  for (const state of states) probe.mockResolvedValueOnce({ state, checks: [] });
  const deps = {
    probe,
    compile: vi.fn(),
    launch: vi.fn().mockResolvedValue({ child, logPath: 'test-log' }),
    sleep: vi.fn().mockResolvedValue(undefined),
    now: vi.fn().mockReturnValue(0),
    timeoutMs: 100,
  };
  return { child, deps };
}

describe('web-up 参数', () => {
  it('默认主线端口，允许明确端口及跳过编译', () => {
    expect(parseOptions([])).toEqual({ port: 5200, compile: true });
    expect(parseOptions(['--port', '5336', '--skip-compile'])).toEqual({ port: 5336, compile: false });
    expect(parseOptions(['--port', '1']).port).toBe(1);
    expect(parseOptions(['--port', '65535']).port).toBe(65535);
  });

  it.each([
    ['--port'], ['--port', ''], ['--port', '0'], ['--port', '-1'], ['--port', '65536'],
    ['--port', '5336.5'], ['--port', '5336junk'], ['--port', 'NaN'], ['--port', 'Infinity'],
    ['--port', '5e3'], ['--port', '0x14b0'], ['--port', '--skip-compile'], ['--unknown'],
    ['--port', '5336', '--port', '5337'], ['--skip-compile', '--skip-compile'],
  ])('拒绝不明确或重复的参数 %j', (...args) => {
    expect(() => parseOptions(args)).toThrow();
  });
});

describe('web-up HTTP 就绪判断', () => {
  it('同时验证项目页面和两种关键图片才判定 ready', async () => {
    const result = await probeServer(await server());
    expect(result.state).toBe('ready');
    expect(result.checks.map(check => check.path)).toEqual(Object.keys(healthyRoutes));
    expect(result.checks.every(check => check.ok)).toBe(true);
  });

  it.each([
    { type: 'text/html', body: '<!doctype html><title>别的项目</title>' },
    { type: 'text/html', body: '<title>冬日猜想</title>' },
    { type: 'text/plain', body: page },
  ])('HTTP 200 不能单独证明这是本项目：%j', async root => {
    expect((await probeServer(await server({ '/': root }))).state).toBe('foreign');
  });

  it.each([
    ['/assets/ui/icons/dice.png', { type: 'text/html', body: page }],
    ['/assets/ui/icons/dice.png', { type: 'image/png', body: page }],
    ['/assets/ui/icons/dice.png', { type: 'application/octet-stream', body: png }],
    ['/assets/portraits/battle/wu.webp', { type: 'text/html', body: page }],
    ['/assets/portraits/battle/wu.webp', { type: 'image/webp', body: page }],
    ['/assets/portraits/battle/wu.webp', { type: 'image/webp', body: Buffer.from('RIFFxxxxJPEG') }],
    ['/assets/portraits/battle/wu.webp', { status: 404, type: 'image/webp', body: webp }],
  ])('图片类型、签名或状态错误时不能 ready：%s', async (asset, response) => {
    const result = await probeServer(await server({ [asset]: response }));
    expect(result.state).toBe('unhealthy');
    expect(result.checks.find(check => check.path === asset)?.ok).toBe(false);
  });

  it('首页连接失败视为 offline，图片请求失败视为 unhealthy', async () => {
    expect((await probeServer('http://unused/', {
      fetchImpl: vi.fn().mockRejectedValue(new Error('connection refused')),
    })).state).toBe('offline');
    const fetchImpl = vi.fn().mockResolvedValueOnce(new Response(page, { headers: { 'content-type': 'text/html' } }))
      .mockRejectedValue(new Error('asset connection closed'));
    expect((await probeServer('http://unused/', { fetchImpl })).state).toBe('unhealthy');
  });
});

describe('web-up 幂等启动', () => {
  it('健康服务直接复用，不重复编译或启动', async () => {
    const { deps } = dependencies(['ready']);
    const result = await ensureServer({ port: 5336, compile: true }, deps);
    expect(result).toMatchObject({ ok: true, reused: true });
    expect(deps.compile).not.toHaveBeenCalled();
    expect(deps.launch).not.toHaveBeenCalled();
  });

  it.each(['foreign', 'unhealthy'])('已占用但 %s 时拒绝复用或另起进程', async state => {
    const { deps } = dependencies([state]);
    expect(await ensureServer({ port: 5336, compile: true }, deps)).toMatchObject({ ok: false, state });
    expect(deps.compile).not.toHaveBeenCalled();
    expect(deps.launch).not.toHaveBeenCalled();
  });

  it.each([true, false])('offline 才启动，按 compile=%s 执行编译，再等图片就绪', async compile => {
    const { deps } = dependencies(['offline', 'offline', 'ready']);
    expect(await ensureServer({ port: 5336, compile }, deps)).toMatchObject({ ok: true, reused: false, pid: 12345 });
    expect(deps.compile).toHaveBeenCalledTimes(compile ? 1 : 0);
    expect(deps.launch).toHaveBeenCalledTimes(1);
    expect(deps.probe).toHaveBeenCalledTimes(3);
  });

  it('子进程提前退出或超过期限时失败，不能报告启动成功', async () => {
    const exited = dependencies(['offline', 'offline']);
    exited.child.exitCode = 1;
    expect((await ensureServer({ port: 5336, compile: false }, exited.deps)).ok).toBe(false);
    const expired = dependencies(['offline', 'offline']);
    expired.deps.now.mockReturnValueOnce(0).mockReturnValue(101);
    expect((await ensureServer({ port: 5336, compile: false }, expired.deps)).ok).toBe(false);
  });

  it('新服务首页已起但图片未就绪时继续等待，不能过早成功', async () => {
    const { deps } = dependencies(['offline', 'unhealthy', 'ready']);
    expect(await ensureServer({ port: 5336, compile: false }, deps)).toMatchObject({ ok: true, reused: false });
    expect(deps.probe).toHaveBeenCalledTimes(3);
  });
});

describe('web-up 后台进程与日志', () => {
  it('独立后台启动、隐藏窗口，按端口落日志并释放父进程句柄', async () => {
    const child = processFixture();
    const root = path.resolve('test-project');
    const spawnImpl = vi.fn(() => { queueMicrotask(() => child.emit('spawn')); return child; });
    const openLog = vi.fn().mockReturnValue(81);
    const closeLog = vi.fn();
    const mkdir = vi.fn();
    const result = await launchVite({ port: 5336, root }, { spawnImpl, openLog, closeLog, mkdir });
    const logPath = path.join(root, 'node_modules', '.cache', 'web-up-5336.log');
    expect(result).toEqual({ child, logPath });
    expect(mkdir).toHaveBeenCalledWith(path.dirname(logPath), { recursive: true });
    expect(openLog).toHaveBeenCalledWith(logPath, 'a');
    expect(spawnImpl).toHaveBeenCalledWith(process.execPath, [
      path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'),
      '--host', '127.0.0.1', '--port', '5336', '--strictPort',
    ], { cwd: root, detached: true, windowsHide: true, stdio: ['ignore', 81, 81] });
    expect(child.unref).toHaveBeenCalledOnce();
    expect(closeLog).toHaveBeenCalledWith(81);
  });

  it('spawn 错误也释放日志句柄，并将失败交给调用方', async () => {
    const child = processFixture();
    const spawnImpl = vi.fn(() => { queueMicrotask(() => child.emit('error', new Error('spawn failed'))); return child; });
    const closeLog = vi.fn();
    await expect(launchVite({ port: 5336, root: path.resolve('test-project') }, {
      spawnImpl, openLog: vi.fn().mockReturnValue(82), closeLog, mkdir: vi.fn(),
    })).rejects.toThrow('spawn failed');
    expect(closeLog).toHaveBeenCalledWith(82);
    expect(child.unref).not.toHaveBeenCalled();
  });
});

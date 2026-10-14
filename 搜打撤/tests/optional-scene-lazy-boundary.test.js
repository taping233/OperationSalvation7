import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'acorn';

const courtyardRuntime = '../game/src/hub/hub.courtyard-runtime.js';
const visualsPath = '../game/src/home/home.visuals.js';
const homePath = '../game/src/home/home.scene.js';
const deferred = () => {
  let resolve;
  const promise = new Promise(accept => { resolve = accept; });
  return { promise, resolve };
};
const courtyard = () => import('../game/src/hub/hub.courtyard-v3.js');
const renderCourtyard = module => {
  document.body.innerHTML = module.courtyardV3HTML();
  return document.querySelector('[data-courtyard]');
};

beforeEach(() => {
  vi.resetModules();
  vi.doUnmock(courtyardRuntime);
  vi.doUnmock(visualsPath);
  vi.doUnmock(homePath);
});
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.doUnmock(courtyardRuntime);
  vi.doUnmock(visualsPath);
  vi.doUnmock(homePath);
});

it('标题启动静态图不解析庭院控制器/引擎及 Home 视觉包', () => {
  const pending = [path.resolve('game/src/main.js')];
  const seen = new Set();
  while (pending.length) {
    const file = pending.pop();
    if (seen.has(file) || !file.endsWith('.js')) continue;
    seen.add(file);
    const ast = parse(readFileSync(file, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' });
    for (const node of ast.body) {
      if (!['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type)) continue;
      const relative = node.source?.value;
      if (relative?.startsWith('.')) pending.push(path.resolve(path.dirname(file), relative));
    }
  }
  for (const file of [
    'hub/hub.courtyard-runtime.js', 'hub/courtyard.rain-tableau.js', 'hub/courtyard-vendor/KoiPond.js', 'home/home.visuals.js',
  ]) expect(seen.has(path.resolve('game/src', file)), file).toBe(false);
  expect(seen.has(path.resolve('game/src/hub/hub.courtyard-v3.js'))).toBe(true);
});

describe('庭院首次装载生命周期', () => {
  it('HTML 与清理函数同步可用，装载期间停用输入，加载完只初始化一次', async () => {
    const loading = deferred();
    const release = vi.fn();
    const mount = vi.fn(() => release);
    const load = vi.fn(async () => { await loading.promise; return { mountCourtyardV3: mount }; });
    vi.doMock(courtyardRuntime, load);
    const module = await courtyard();
    const host = renderCourtyard(module);
    expect(load).not.toHaveBeenCalled();
    const dispose = module.mountCourtyardV3(host);
    expect(typeof dispose).toBe('function');
    expect(host.getAttribute('aria-busy')).toBe('true');
    expect(host.querySelector('.courtyard-v3-canvas').getAttribute('aria-disabled')).toBe('true');
    expect([...host.querySelectorAll('button')].every(button => button.disabled)).toBe(true);
    await vi.waitFor(() => expect(load).toHaveBeenCalledOnce());
    loading.resolve();
    await vi.dynamicImportSettled();
    expect(mount).toHaveBeenCalledOnce();
    expect(mount).toHaveBeenCalledWith(host);
    expect(host.hasAttribute('aria-busy')).toBe(false);
    expect(host.querySelector('.courtyard-v3-status').textContent).toBe('');
    expect([...host.querySelectorAll('button')].every(button => !button.disabled)).toBe(true);
    dispose(); dispose();
    expect(release).toHaveBeenCalledOnce();
  });

  it.each(['dispose', 'detach'])('等待期间 %s 不会在模块到达后复活画布或监听', async operation => {
    const loading = deferred();
    const mount = vi.fn(() => vi.fn());
    vi.doMock(courtyardRuntime, async () => { await loading.promise; return { mountCourtyardV3: mount }; });
    const module = await courtyard();
    const host = renderCourtyard(module);
    const dispose = module.mountCourtyardV3(host);
    if (operation === 'dispose') { dispose(); dispose(); }
    else host.remove();
    loading.resolve();
    await vi.dynamicImportSettled();
    expect(mount).not.toHaveBeenCalled();
    expect(host.hasAttribute('aria-busy')).toBe(false);
  });

  it('加载失败可见且没有未绑定输入，重新进入可重试；已加载入口继续同步挂载', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.doMock(courtyardRuntime, () => { throw new Error('temporary load failure'); });
    const module = await courtyard();
    const failedHost = renderCourtyard(module);
    const disposeFailed = module.mountCourtyardV3(failedHost);
    await vi.dynamicImportSettled();
    expect(failedHost.querySelector('.courtyard-v3-status').textContent).toContain('加载失败');
    expect(failedHost.hasAttribute('aria-busy')).toBe(false);
    expect([...failedHost.querySelectorAll('button')].every(button => button.disabled)).toBe(true);
    expect(warn).toHaveBeenCalledOnce();
    disposeFailed();
    const release = vi.fn();
    const mount = vi.fn(() => release);
    vi.doMock(courtyardRuntime, () => ({ mountCourtyardV3: mount }));
    const retryHost = renderCourtyard(module);
    const disposeRetry = module.mountCourtyardV3(retryHost);
    await vi.dynamicImportSettled();
    expect(mount).toHaveBeenCalledWith(retryHost);
    disposeRetry();
    const warmHost = renderCourtyard(module);
    expect(module.mountCourtyardV3(warmHost)).toBe(release);
    expect(mount).toHaveBeenCalledWith(warmHost);
    release();
  });
});

async function createHome(visualLoader) {
  vi.doMock('../game/src/core/characters.js', () => ({ characterFor: id => ({ rulesetId: id }), characterName: id => id }));
  vi.doMock('../game/src/hub/base.commands.js', () => ({ readBase: () => ({ ok: true, value: {}, revision: 1 }), readBaseReceipt: vi.fn(), commitBase: vi.fn() }));
  vi.doMock('../game/src/hub/collection.commands.js', () => ({ getCollection: vi.fn() }));
  vi.doMock('../game/src/home/home.commands.js', () => ({ createHomeCommands: () => ({}) }));
  vi.doMock('../game/src/home/home.presenter.js', () => ({ presentHome: value => value, homeErrorMessage: () => 'error' }));
  vi.doMock('../game/src/hub/game.hub.bridge.js', () => ({ homeRequestId: () => 'request' }));
  vi.doMock(visualsPath, visualLoader);
  const mountHome = vi.fn(() => ({ update: vi.fn(), dispose: vi.fn() }));
  vi.doMock(homePath, () => ({ mountHome }));
  window.SDT = { Base: { slot: 1 }, Cards: { all: () => [] }, Art: { classArt: vi.fn() } };
  const UI = { showOverlay(_title, html) { document.body.innerHTML = html; }, log: vi.fn() };
  const renderHub = vi.fn();
  const { createHubHomeScene } = await import('../game/src/hub/game.hub.home-scene.js');
  return { home: createHubHomeScene({ UI, renderHub, disposePreparation: vi.fn(), closeBase: vi.fn(), openPanel: vi.fn() }), mountHome, UI, renderHub };
}

describe('Home 视觉包跟随既有场景边界', () => {
  it('创建门面时不加载视觉包，实际场景就绪后才用视觉包挂载', async () => {
    const loading = deferred();
    const getM04VisualPack = vi.fn(() => ({ marker: 'visual-pack' }));
    const load = vi.fn(async () => { await loading.promise; return { getM04VisualPack }; });
    const { home, mountHome } = await createHome(load);
    expect(load).not.toHaveBeenCalled();
    home.render();
    const host = document.getElementById('homeSceneHost');
    await vi.waitFor(() => expect(load).toHaveBeenCalledOnce());
    expect(mountHome).not.toHaveBeenCalled();
    loading.resolve();
    await vi.dynamicImportSettled();
    expect(mountHome).toHaveBeenCalledWith(expect.objectContaining({ host, assets: expect.objectContaining({ marker: 'visual-pack' }) }));
    home.leave();
  });

  it('视觉包等待期间离开，不读取或挂载已过期的场景', async () => {
    const loading = deferred();
    const getM04VisualPack = vi.fn(() => ({}));
    const { home, mountHome } = await createHome(async () => { await loading.promise; return { getM04VisualPack }; });
    home.render(); home.leave();
    loading.resolve();
    await vi.dynamicImportSettled();
    expect(getM04VisualPack).not.toHaveBeenCalled();
    expect(mountHome).not.toHaveBeenCalled();
  });

  it('视觉包失败沿原有当前请求错误路径回到普通基地', async () => {
    const { home, mountHome, UI, renderHub } = await createHome(() => { throw new Error('visual chunk failed'); });
    home.render();
    await vi.dynamicImportSettled();
    expect(mountHome).not.toHaveBeenCalled();
    expect(UI.log).toHaveBeenCalledWith(expect.stringContaining('基地场景加载失败'), 'warn');
    expect(renderHub).toHaveBeenCalledOnce();
    home.leave();
  });
});

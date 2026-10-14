import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const ports = vi.hoisted(() => ({ read: vi.fn(), buy: vi.fn(), mount: vi.fn(), update: vi.fn(), dispose: vi.fn(), configs: [] }));
vi.mock('../game/src/hub/base.commands.js', () => ({ readBase: ports.read, readBaseReceipt: vi.fn(), commitBase: vi.fn() }));
vi.mock('../game/src/hub/collection.commands.js', () => ({ getCollection: vi.fn() }));
vi.mock('../game/src/home/home.commands.js', () => ({ createHomeCommands: () => ({ buyFurniture: ports.buy }) }));
vi.mock('../game/src/home/home.presenter.js', () => ({ presentHome: value => value, homeErrorMessage: value => value.message }));
vi.mock('../game/src/home/home.scene.js', () => ({ mountHome: ports.mount }));
vi.mock('../game/src/home/home.visuals.js', () => ({ getM04VisualPack: () => ({}) }));
import { createHubHomeScene } from '../game/src/hub/game.hub.home-scene.js';
let home, ui, renderHub, closeBase;
beforeEach(() => {
  Object.values(ports).filter(value => typeof value.mockReset === 'function').forEach(mock => mock.mockReset()); ports.configs.length = 0;
  ports.read.mockReturnValue({ ok: true, value: { revision: 1 }, revision: 1 });
  ports.buy.mockResolvedValue({ ok: true });
  ports.mount.mockImplementation(config => { ports.configs.push(config); return { update: ports.update, dispose: ports.dispose }; });
  ui = { showOverlay: (_title, html) => { document.body.innerHTML = `<div id="overlay">${html}</div>`; }, log: vi.fn() };
  window.SDT = { Base: { slot: 1 }, Cards: { all: () => [] }, Art: {} };
  renderHub = vi.fn(); closeBase = vi.fn();
  home = createHubHomeScene({ UI: ui, disposePreparation: vi.fn(), renderHub, closeBase, openPanel: vi.fn() });
});
afterEach(() => { home.leave(); document.body.replaceChildren(); });
async function open() { home.render(); await vi.dynamicImportSettled(); return ports.configs[0].onIntent; }
describe('Home场景slot与宿主生命周期', () => {
  it('换slot后旧宿主命令不能提交新档', async () => { const intent = await open(); window.SDT.Base.slot = 2; await intent({ type: 'buyFurniture', expectedRevision: 1 }); expect(ports.buy).not.toHaveBeenCalled(); });
  it('已提交原slot命令晚到仍返原收据，不读新档或回绘', async () => {
    let resolve; ports.buy.mockReturnValue(new Promise(r => { resolve = r; })); const intent = await open();
    const pending = intent({ type: 'buyFurniture', expectedRevision: 1 }); const reads = ports.read.mock.calls.length;
    window.SDT.Base.slot = 2; resolve({ ok: true, value: { costCoins: 3 } });
    await expect(pending).resolves.toEqual({ ok: true, value: { costCoins: 3 } });
    expect(ports.read.mock.calls.length).toBe(reads); expect(ports.update).not.toHaveBeenCalled();
  });
  it('懒加载晚到不能挂到已换slot的宿主', async () => { home.render(); window.SDT.Base.slot = 2; await vi.dynamicImportSettled(); expect(ports.mount).not.toHaveBeenCalled(); });
  it('dispose后即使宿主仍连接也不能接受旧intent', async () => { const intent = await open(); home.dispose(); await intent({ type: 'buyFurniture', expectedRevision: 1 }); expect(ports.buy).not.toHaveBeenCalled(); });
  it('宿主离开或overlay开始关闭时旧命令和close不执行', async () => {
    const intent = await open(); document.getElementById('overlay').classList.add('closing');
    await intent({ type: 'buyFurniture', expectedRevision: 1 }); await intent({ type: 'close' });
    expect(ports.buy).not.toHaveBeenCalled(); expect(closeBase).not.toHaveBeenCalled();
  });
  it('正常当前页面成功仍用原slot刷新，重复dispose安全', async () => {
    ports.buy.mockResolvedValue({ ok: true }); const intent = await open(); await intent({ type: 'buyFurniture', expectedRevision: 1 });
    expect(ports.buy.mock.lastCall[0].slotId).toBe(1); expect(ports.update).toHaveBeenCalledOnce(); expect(ports.read.mock.lastCall[0]).toBe(1);
    home.dispose(); home.dispose(); expect(ports.dispose).toHaveBeenCalledOnce();
  });
});

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const ctx = new Proxy({}, { get: () => () => ctx, set: () => true });
window.HTMLCanvasElement.prototype.getContext = () => ctx;
document.body.innerHTML = '<canvas id="game"></canvas><div id="title"></div><div id="exitScr"></div><div id="ovBody"></div>';
window.SDT = {
  Icons: { img: () => '', TYPE_ART: {} }, Sound: { music() {}, sfx() {}, setDucked() {} }, FX: { feedback() {} },
  MAP: { rules: { playerMaxHp: 50, playerAtk: 4, fireHeal: 5, battleEnergy: 2, battleHandMax: 10, bossDeckSize: 10, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6 }, items: { rations: { name: '口粮' }, wood: { name: '木材' } } },
};
await import('../game/src/cards/cards.js');
await import('../game/src/ui/ui.js');
await import('../game/src/hub/base.js');
const session = await import('../game/src/run/game.session.js');
const { RunStorage } = await import('../game/src/hub/game.storage.js');
const { Base, UI } = window.SDT;
const handlers = {};
Object.assign(UI, {
  log: vi.fn(), refresh() {}, clearLog() {}, hideOverlay() {}, hideScreen() {}, showScreen() {},
  showOverlay(_title, html) { document.getElementById('ovBody').innerHTML = html; },
  act(name, fn) { handlers[name] = fn; }, registerHelp() {}, helpBtn() { return ''; },
});
window.SDT.Meta = { setXpMul() {}, track() {}, ACHIEVEMENTS: [], isUnlocked: () => false };
window.SDT.Nest = { renderNestMap() { session.game.state = 'idle'; } };
window.SDT.Battle = { restore: vi.fn(() => true) };

beforeEach(() => {
  localStorage.clear();
  for (let slot = 1; slot <= 5; slot++) RunStorage.remove(slot);
  session._set_active_slot(1);
  Base.use(1);
  Object.assign(session.game, { pendingExtraction: null, extractionPending: null, terminalPending: null,
    battleActive: false, runActive: false, nestActive: false, state: 'title', elapsed: 0, elapsedSynced: 0 });
  session.configureGameRuntime({ openClassChoice: vi.fn() });
  UI.el.ovBody = document.getElementById('ovBody');
  UI.log.mockClear();
  window.SDT.Battle.restore.mockReset().mockReturnValue(true);
});
afterEach(() => vi.restoreAllMocks());

function prepareSlot(slot = 1) {
  const run = JSON.stringify({ version: 2, seed: `delete-fixture-${slot}`, nestActive: true,
    _r2: { runId: `delete-run-${slot}`, revision: 3 } });
  const base = JSON.stringify({ version: Base.BASE_VERSION, coins: slot * 42, stash: [], pocket: [] });
  localStorage.setItem(RunStorage.key(slot), run);
  localStorage.setItem(Base.SLOT_KEY(slot), base);
  return { run, base };
}

function failRemove(name) {
  const original = Storage.prototype.removeItem;
  return vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (key) {
    if (key === name) throw new Error('fixture deletion failed');
    return original.call(this, key);
  });
}

function confirmed(action, fields) {
  handlers[action](fields);
  return handlers[action](fields);
}

describe('整档删除结果与菜单消费', () => {
  it.each(['run', 'corrupt'])('%s删除失败不继续删基地，也不宣称整档成功', async target => {
    const before = prepareSlot();
    localStorage.setItem(RunStorage.corruptKey(1), '{fixture corrupt backup');
    failRemove(target === 'run' ? RunStorage.key(1) : RunStorage.corruptKey(1));
    await session.startNewGame();
    expect(confirmed('delSlot', { slot: 1 })).toBe(false);
    expect(localStorage.getItem(Base.SLOT_KEY(1))).toBe(before.base);
    expect(localStorage.getItem(RunStorage.key(1))).toBe(target === 'run' ? before.run : null);
    expect(UI.log.mock.calls.flat().join(' ')).not.toContain('已删除【档位 1】');
    expect(document.getElementById('slotRestoreError').textContent).toContain('基地数据未删除');
  });

  it('待恢复事务阻止整档删除，Run/Base/journal均保留且不误报', async () => {
    const before = prepareSlot();
    const journal = '{fixture pending transaction';
    localStorage.setItem('sdt-tx-v1-slot1', journal);
    await session.startNewGame();
    expect(confirmed('delSlot', { slot: 1 })).toBe(false);
    expect(localStorage.getItem(RunStorage.key(1))).toBe(before.run);
    expect(localStorage.getItem(Base.SLOT_KEY(1))).toBe(before.base);
    expect(localStorage.getItem('sdt-tx-v1-slot1')).toBe(journal);
    expect(UI.log.mock.calls.flat().join(' ')).not.toContain('已删除【档位 1】');
  });

  it('Base删除失败时不回填旧串或覆盖同时出现的外部新值', async () => {
    prepareSlot();
    const latest = JSON.stringify({ version: Base.BASE_VERSION, coins: 900, stash: [], pocket: [] });
    const remove = Storage.prototype.removeItem;
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (key) {
      if (key === Base.SLOT_KEY(1)) {
        localStorage.setItem(key, latest);
        throw new Error('fixture external base change');
      }
      return remove.call(this, key);
    });
    await session.startNewGame();
    expect(confirmed('delSlot', { slot: 1 })).toBe(false);
    expect(localStorage.getItem(RunStorage.key(1))).toBeNull();
    expect(localStorage.getItem(Base.SLOT_KEY(1))).toBe(latest);
  });

  it('Run已删但Base删除失败明确报告部分结果，重试成功后才宣称完成', async () => {
    const before = prepareSlot();
    const blocked = failRemove(Base.SLOT_KEY(1));
    await session.startNewGame();
    expect(confirmed('delSlot', { slot: 1 })).toBe(false);
    expect(localStorage.getItem(RunStorage.key(1))).toBeNull();
    expect(localStorage.getItem(Base.SLOT_KEY(1))).toBe(before.base);
    expect(document.getElementById('slotRestoreError').textContent).toContain('对局已删除，基地数据未能删除');
    expect(UI.log.mock.calls.flat().join(' ')).not.toContain('已删除【档位 1】');
    blocked.mockRestore();
    handlers.delSlot({ slot: 1 });
    expect(localStorage.getItem(Base.SLOT_KEY(1))).toBeNull();
    expect(UI.log.mock.calls.flat().join(' ')).toContain('已删除【档位 1】');
  });

  it.each(['run', 'base'])('覆盖重开在%s删除失败时不初始化或进入基地', async target => {
    const before = prepareSlot();
    failRemove(target === 'run' ? RunStorage.key(1) : Base.SLOT_KEY(1));
    const reset = vi.spyOn(Base, 'reset');
    const openBaseHub = vi.fn();
    session.configureGameRuntime({ openBaseHub });
    await session.startNewGame();
    expect(await confirmed('overwriteSlot', { slot: 1 })).toBe(false);
    expect(reset).not.toHaveBeenCalled();
    expect(openBaseHub).not.toHaveBeenCalled();
    expect(localStorage.getItem(Base.SLOT_KEY(1))).toBe(before.base);
    expect(UI.log.mock.calls.flat().join(' ')).not.toContain('已进入');
  });

  it('全部清空逐档报告失败，其他档位照常完成，重试后才报告全成功', async () => {
    const before1 = prepareSlot(1), before2 = prepareSlot(2);
    prepareSlot(3);
    const original = Storage.prototype.removeItem;
    const block = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (key) {
      if (key === RunStorage.key(1) || key === Base.SLOT_KEY(2)) throw new Error('fixture partial clear');
      return original.call(this, key);
    });
    await session.openSettings();
    const activeBase = Base.data, activeRunToken = session.game.discoveredPairs;
    expect(confirmed('wipeSave', {})).toBe(false);
    expect(Base.slot).toBe(1);
    expect(session.getActiveSlot()).toBe(1);
    expect(Base.data).toBe(activeBase);
    expect(session.game.discoveredPairs).toBe(activeRunToken);
    expect(localStorage.getItem(RunStorage.key(1))).toBe(before1.run);
    expect(localStorage.getItem(Base.SLOT_KEY(1))).toBe(before1.base);
    expect(localStorage.getItem(RunStorage.key(2))).toBeNull();
    expect(localStorage.getItem(Base.SLOT_KEY(2))).toBe(before2.base);
    expect(localStorage.getItem(RunStorage.key(3))).toBeNull();
    expect(localStorage.getItem(Base.SLOT_KEY(3))).toBeNull();
    const logs = UI.log.mock.calls.flat().join(' ');
    expect(logs).toContain('档位 1');
    expect(logs).toContain('档位 2');
    expect(logs).not.toContain('已清空全部五个档位的存档');
    block.mockRestore();
    handlers.wipeSave({});
    expect(localStorage.getItem(RunStorage.key(1))).toBeNull();
    expect(localStorage.getItem(Base.SLOT_KEY(2))).toBeNull();
    expect(UI.log.mock.calls.flat().join(' ')).toContain('已清空全部五个档位的存档');
  });
});

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

function writeRun(changes = {}) {
  const value = { version: 2, seed: 'e5-session', nestActive: true, ...changes };
  const raw = JSON.stringify(value);
  localStorage.setItem(RunStorage.key(1), raw);
  return raw;
}

function ordinary(changes = {}) {
  return writeRun({ nestActive: false, mapSeed: 'e5-session', generatorVersion: 3, layoutVersion: 9,
    layerIdx: 0, trackPos: 0, myClass: 'warrior', ...changes });
}

function blockKey(key) {
  const set = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (k, value) {
    if (k === key) throw new DOMException('test quota', 'QuotaExceededError');
    return set.call(this, k, value);
  });
}

beforeEach(() => {
  localStorage.clear();
  for (let slot = 1; slot <= 5; slot++) RunStorage.remove(slot);
  session._set_active_slot(1);
  Base.use(1);
  Object.assign(session.game, { pendingExtraction: null, extractionPending: null, terminalPending: null,
    battleActive: false, runActive: false, nestActive: false, state: 'title', elapsed: 0, elapsedSynced: 0 });
  session.configureGameRuntime({ openClassChoice: vi.fn() });
  UI.log.mockClear();
  window.SDT.Battle.restore.mockReset().mockReturnValue(true);
});
afterEach(() => vi.restoreAllMocks());

describe('备份写失败的实际装载反馈', () => {
  it('同步拒绝并明确两串保留和可重试，恢复可写后成功进入同一探索', () => {
    const previous = ordinary({ _r2: { runId: 'ui-fallback-retry', revision: 3 } });
    const broken = '{ui fallback malformed';
    localStorage.setItem('sdt-run-1-prev', previous);
    localStorage.setItem(RunStorage.key(1), broken);
    blockKey(RunStorage.corruptKey(1));
    const loaded = session.loadGame(1);
    expect(loaded).not.toBeInstanceOf(Promise);
    expect(loaded).toMatchObject({ ok: false, code: 'RUN_UNREADABLE', preserveRun: true,
      persistence: { status: 'not_attempted', attempts: [] } });
    expect(loaded.message).toContain('原档和已有备份未被覆盖');
    expect(loaded.message).toContain('重试进入');
    expect(RunStorage.loadIssueMessage(1)).toBe(loaded.message);
    expect(UI.log.mock.calls.flat().join(' ')).toContain('损坏原串未能备份');
    expect(localStorage.getItem(RunStorage.key(1))).toBe(broken);
    expect(localStorage.getItem('sdt-run-1-prev')).toBe(previous);
    vi.restoreAllMocks();
    expect(session.loadGame(1).ok).toBe(true);
    expect(RunStorage.loadIssueMessage(1)).toBeNull();
    expect(RunStorage.readIdentity(1).value.runId).toBe('ui-fallback-retry');
  });
});

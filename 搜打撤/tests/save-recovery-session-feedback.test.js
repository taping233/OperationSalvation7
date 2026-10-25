import { battleRules } from './helpers/environment-fixtures.js';
import { installImmediateWebLocks } from './helpers/web-locks.js';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const ctx = new Proxy({}, { get: () => () => ctx, set: () => true });
window.HTMLCanvasElement.prototype.getContext = () => ctx;
document.body.innerHTML = '<canvas id="game"></canvas><div id="title"></div><div id="exitScr"></div><div id="ovBody"></div>';
window.SDT = {
  Icons: { img: () => '', TYPE_ART: {} }, Sound: { music() {}, sfx() {}, setDucked() {} }, FX: { feedback() {} },
  MAP: { rules: { playerMaxHp: 50, playerAtk: 4, fireHeal: 5, ...battleRules(2, 10, 10, 0, 5, 1) }, items: { rations: { name: '口粮' }, wood: { name: '木材' } } },
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

beforeEach(async () => {
  installImmediateWebLocks();
  await RunStorage.flushWrites();
  localStorage.clear();
  for (let slot = 1; slot <= 5; slot++) await RunStorage.remove(slot);
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
  it('拒绝自动覆盖主串，明确确认完整备档后成功进入同一探索', async () => {
    const previous = ordinary({ _r2: { runId: 'ui-fallback-retry', revision: 3 } });
    const broken = '{ui fallback malformed';
    localStorage.setItem('sdt-run-1-prev', previous);
    localStorage.setItem(RunStorage.key(1), broken);
    blockKey(RunStorage.corruptKey(1));
    const loaded = session.loadGame(1);
    expect(loaded).not.toBeInstanceOf(Promise);
    expect(loaded).toMatchObject({ ok: false, code: 'RUN_UNREADABLE', preserveRun: true,
      persistence: { status: 'not_attempted', attempts: [] } });
    expect(loaded.message).toContain('对局存档无法读取');
    expect(localStorage.getItem(RunStorage.key(1))).toBe(broken);
    expect(localStorage.getItem('sdt-run-1-prev')).toBe(previous);
    await RunStorage.flushWrites();
    vi.restoreAllMocks();
    const preview = session.previewRunBackup(1);
    expect(preview.ok).toBe(true);
    expect(await session.restoreRunBackup(1, preview.value)).toBe(true);
    expect(session.loadGame(1).ok).toBe(true);
    expect(RunStorage.loadIssueMessage(1)).toBeNull();
    expect(RunStorage.readIdentity(1).value.runId).toBe('ui-fallback-retry');
  });
});

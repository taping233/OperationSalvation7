import { beforeEach, describe, expect, it, vi } from 'vitest';

const ctx = new Proxy({}, { get: () => () => ctx, set: () => true });
window.HTMLCanvasElement.prototype.getContext = () => ctx;
document.body.innerHTML = '<canvas id="game"></canvas><div id="title"></div><div id="exitScr"></div>';
window.SDT = {
  Icons: { img: () => '', TYPE_ART: {} }, Sound: { music() {}, sfx() {}, setDucked() {} }, FX: { feedback() {} },
  MAP: { rules: { playerMaxHp: 50, playerAtk: 4, fireHeal: 5, battleEnergy: 2, battleHandMax: 10, bossDeckSize: 10, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6 }, items: { rations: { name: '口粮' }, wood: { name: '木材' } } },
};
await import('../game/src/cards.js');
await import('../game/src/ui.js');
await import('../game/src/base.js');
const session = await import('../game/src/game.session.js');
const { RunStorage } = await import('../game/src/game.storage.js');
const Base = window.SDT.Base;

const resumeHook = vi.fn(() => ({ ok: true }));
const uiLogs = [];
Object.assign(window.SDT.UI, {
  log: message => uiLogs.push(String(message)), refresh: vi.fn(), clearLog() {}, hideOverlay() {}, hideScreen() {}, showScreen() {}, showOverlay() {},
  act() {}, registerHelp() {}, helpBtn() { return ''; },
});
window.SDT.Meta = { setXpMul() {}, track() {} };
window.SDT.Nest = { renderNestMap: vi.fn() };
window.SDT.Battle = { restore: vi.fn() };

const copy = value => JSON.parse(JSON.stringify(value));
const pendingFor = runId => ({
  version: 1, runId, phase: 'organizing', requestSeq: 0,
  remainingCards: [{ card: { id: 'card-a', name: '整理奖励卡' }, count: 2 }],
  keptPocket: [{ card: { id: 'card-b', name: '保留口袋卡' }, count: 1 }],
  totalPocketCount: 2, lostPocketCount: 1, resources: { wood: 1, rations: 2 },
});

function seedRun(slot) {
  localStorage.removeItem(RunStorage.key(slot));
  Base.use(slot);
  session._set_active_slot(slot);
  session.buildDerived(`extraction-resume-${slot}`);
  session.game.runActive = true;
  session.game.nestActive = false;
  session.game.state = 'idle';
  session.game.layerIdx = 1;
  session.game.trackPos = session.game.layerData[1].entrances[0];
  expect(session.saveGame()).toBe(true);
  const raw = JSON.parse(localStorage.getItem(RunStorage.key(slot)));
  return { raw, runId: raw._r2.runId };
}

function storePending(slot, pending) {
  const raw = JSON.parse(localStorage.getItem(RunStorage.key(slot)));
  raw.pendingExtraction = pending;
  localStorage.setItem(RunStorage.key(slot), JSON.stringify(raw));
  return localStorage.getItem(RunStorage.key(slot));
}

beforeEach(() => {
  localStorage.clear();
  for (let slot = 1; slot <= 5; slot++) RunStorage.remove(slot);
  session._set_active_slot(null);
  session.game.pendingExtraction = null;
  session.game.extractionPending = null;
  session.game.terminalPending = null;
  session.game.runActive = false;
  session.game.battleActive = false;
  session.game.state = 'title';
  uiLogs.length = 0;
  resumeHook.mockClear();
  window.SDT.UI.refresh.mockClear();
  window.SDT.Battle.restore.mockClear();
  session.configureGameRuntime({ resumeExtraction: resumeHook, openClassChoice: vi.fn() });
});

describe('撤离整理会话恢复', () => {
  it('合法地图与待整理记录只调用恢复 hook，不重进节点或恢复战斗；自动保存保留原串', () => {
    const slot = 2;
    const { runId } = seedRun(slot);
    const pending = pendingFor(runId);
    const originalRaw = storePending(slot, pending);

    const restored = session.loadGame(slot);
    expect(restored).toMatchObject({ ok: true, value: true });
    expect(resumeHook).toHaveBeenCalledTimes(1);
    expect(resumeHook).toHaveBeenCalledWith(pending);
    expect(session.game.pendingExtraction).toEqual(pending);
    expect(session.game.state).toBe('modal');
    expect(uiLogs.some(message => message.startsWith('—— 置身'))).toBe(false);
    expect(window.SDT.Battle.restore).not.toHaveBeenCalled();

    expect(session.saveGame()).toBe(false);
    expect(localStorage.getItem(RunStorage.key(slot))).toBe(originalRaw);
    session.game.pendingExtraction = null;
    session.game.extractionPending = true;
    expect(session.saveGame()).toBe(false);
    expect(localStorage.getItem(RunStorage.key(slot))).toBe(originalRaw);
  });

  it('非法整理记录与其他 runId 均在恢复前拒绝，保留对局原串', () => {
    const slot = 3;
    const { runId } = seedRun(slot);
    const invalid = pendingFor(runId);
    invalid.phase = 'completed';
    const invalidRaw = storePending(slot, invalid);
    expect(session.loadGame(slot)).toMatchObject({ ok: false, code: 'INVALID_EXTRACTION', preserveRun: true });
    expect(localStorage.getItem(RunStorage.key(slot))).toBe(invalidRaw);
    expect(resumeHook).not.toHaveBeenCalled();

    const mismatch = pendingFor('different-run');
    const mismatchRaw = storePending(slot, mismatch);
    expect(session.loadGame(slot)).toMatchObject({ ok: false, code: 'INVALID_EXTRACTION_IDENTITY', preserveRun: true });
    expect(localStorage.getItem(RunStorage.key(slot))).toBe(mismatchRaw);
    expect(resumeHook).not.toHaveBeenCalled();
  });

  it('有效待整理 run 遇到 pending journal 时直接读档阻断并保留两份原串', () => {
    const slot = 5;
    const { runId } = seedRun(slot);
    const runRaw = storePending(slot, pendingFor(runId));
    const journalKey = `sdt-tx-v1-slot${slot}`;
    localStorage.setItem(journalKey, '{}');

    expect(session.loadGame(slot)).toMatchObject({ ok: false, code: 'RECOVERY_REQUIRED', preserveRun: true });
    expect(localStorage.getItem(RunStorage.key(slot))).toBe(runRaw);
    expect(localStorage.getItem(journalKey)).toBe('{}');
    expect(resumeHook).not.toHaveBeenCalled();
  });

  it('开始新 run 会清除运行态中的 pending extraction', () => {
    const slot = 4;
    seedRun(slot);
    session.game.pendingExtraction = pendingFor('old-run');
    session.game.extractionPending = true;
    session.newRun('standard', [], { skipClassChoice: true });
    expect(session.game.pendingExtraction).toBeNull();
    expect(session.game.extractionPending).toBeNull();
  });
});

import { quietUiMocks } from './helpers/environment-fixtures.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installImmediateWebLocks } from './helpers/web-locks.js';

const ctx = new Proxy({}, { get: () => () => ctx, set: () => true });
window.HTMLCanvasElement.prototype.getContext = () => ctx;
document.body.innerHTML = '<canvas id="game"></canvas><div id="title"></div><div id="exitScr"></div>';
window.SDT = { Icons: { img: () => '', TYPE_ART: {} }, Sound: { music() {}, sfx() {}, setDucked() {} }, FX: { feedback() {} } };
await import('../game/src/cards/cards.js');
await import('../game/src/ui/ui.js');
await import('../game/src/hub/base.js');
const session = await import('../game/src/run/game.session.js');
const { RunStorage } = await import('../game/src/hub/game.storage.js');
const { Base, UI } = window.SDT;
Object.assign(UI, { log: vi.fn(), refresh() {}, ...quietUiMocks() });
window.SDT.Meta = { setXpMul() {}, track() {} };
session.configureGameRuntime({ openClassChoice: () => Promise.resolve(true) });

beforeEach(async () => {
  await Promise.all([Base.flushWrites(), RunStorage.flushWrites()]);
  vi.restoreAllMocks(); installImmediateWebLocks();
  localStorage.clear(); Base.use(1); session._set_active_slot(1);
  expect(await Base.save()).toBe(true);
  expect(await session.newRun('standard', {}, { skipClassChoice: true })).toBeUndefined();
  Object.assign(session.game, { myClass: '战士', characterId: 'heixiang', elapsed: 0, elapsedSynced: 0 });
});
afterEach(async () => { await Promise.all([Base.flushWrites(), RunStorage.flushWrites()]); vi.restoreAllMocks(); });

function failBase() {
  const original = Storage.prototype.setItem;
  return vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
    if (key === Base.SLOT_KEY(1)) throw new Error('quota');
    return original.call(this, key, value);
  });
}
async function seedElapsedMigration() {
  session.game.elapsed = 30;
  expect(await session.saveGame()).toBe(true);
  await Base.flushWrites();
  Base.data.stats.playSeconds = 0;
  delete Base.data.stats.playTimeCheckpoint;
  expect(await Base.save()).toBe(true);
  const legacyRun = JSON.parse(localStorage.getItem(RunStorage.key(1)));
  delete legacyRun.elapsedTimeBaseline;
  localStorage.setItem(RunStorage.key(1), JSON.stringify(legacyRun));
}

describe('异步Run检查点与完整Base保存回执', () => {
  it('saveGame等待Run落盘，saveSession等待Base失败并明确返回失败', async () => {
    session.game.elapsed = 10;
    const failure = failBase();
    const runOnly = session.saveGame();
    expect(runOnly).toBeInstanceOf(Promise);
    expect(await runOnly).toBe(true);
    expect(JSON.parse(localStorage.getItem(RunStorage.key(1))).elapsed).toBe(10);
    const full = await session.saveSession();
    expect(full).toMatchObject({ ok: false, code: 'BASE_SAVE_FAILED' });
    expect(Base.data.stats.playSeconds).toBe(10);
    failure.mockRestore();
    expect(await session.saveSession()).toEqual({ ok: true });
    expect(JSON.parse(localStorage.getItem(Base.SLOT_KEY(1))).stats.playSeconds).toBe(10);
  });

  it('完整保存等待锁完成，Promise与排队状态均不进入Run存档', async () => {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: async (_n, _o, callback) => { await gate; return callback(); } } });
    session.game.elapsed = 9;
    let finished = false;
    const saving = session.saveSession().then(result => { finished = true; return result; });
    await Promise.resolve();
    expect(finished).toBe(false);
    const run = JSON.parse(localStorage.getItem(RunStorage.key(1)));
    expect(run.pendingPersistence).toBeUndefined(); expect(run.departureInFlight).toBeUndefined();
    release();
    expect(await saving).toEqual({ ok: true });
    expect(JSON.parse(localStorage.getItem(Base.SLOT_KEY(1))).stats.playSeconds).toBe(9);
  });

  it('同步loadGame附带pendingPersistence，失败回执在Base任务结束后才落定', async () => {
    await seedElapsedMigration();
    failBase();
    const loaded = session.loadGame(1);
    expect(loaded.ok).toBe(true);
    expect(loaded.persistence.status).toBe('pending');
    expect(loaded.pendingPersistence).toBeInstanceOf(Promise);
    expect(await loaded.pendingPersistence).toEqual({ ok: false, code: 'BASE_SAVE_FAILED' });
    expect(loaded.persistence.status).toBe('failed');
    expect(loaded.persistence.attempts.some(attempt => attempt.target === 'base' && attempt.ok === false)).toBe(true);
    expect(Base.data.stats.playSeconds).toBe(30);
    expect(JSON.parse(localStorage.getItem(Base.SLOT_KEY(1))).stats.playSeconds).toBe(0);
  });

  it('loadGame的成功回写等待锁且只计一次elapsed', async () => {
    await seedElapsedMigration();
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: async (_n, _o, callback) => { await gate; return callback(); } } });
    const loaded = session.loadGame(1);
    expect(loaded.persistence.status).toBe('pending');
    expect(Base.data.stats.playSeconds).toBe(30);
    release();
    expect(await loaded.pendingPersistence).toEqual({ ok: true });
    expect(loaded.persistence.status).toBe('succeeded');
    expect(await session.saveSession()).toEqual({ ok: true });
    expect(Base.data.stats.playSeconds).toBe(30);
  });
});

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { installImmediateWebLocks } from './helpers/web-locks.js';

const ctx = new Proxy({}, { get: () => () => ctx, set: () => true });
window.HTMLCanvasElement.prototype.getContext = () => ctx;
document.body.innerHTML = '<canvas id="game"></canvas><div id="title"></div><div id="exitScr"></div>';
window.SDT = { Icons: { img: () => '', TYPE_ART: {} }, Sound: { music: vi.fn(), sfx() {}, setDucked() {} }, FX: { feedback() {} } };
await import('../game/src/cards/cards.js');
await import('../game/src/ui/ui.js');
await import('../game/src/hub/base.js');
const session = await import('../game/src/run/game.session.js');
const { Random } = await import('../game/src/core/random.js');
const { RunStorage, TX_KEY } = await import('../game/src/hub/game.storage.js');
const { createRecoveryCommands } = await import('../game/src/hub/recovery.commands.js');
const { createDeparturePersistence } = await import('../game/src/hub/departure-persistence.js');
const { Base, UI } = window.SDT;
const slot = 1;
const picks = { 'card:departure-card': 1 };
const options = { skipClassChoice: true };
const originalSetItem = Storage.prototype.setItem;

beforeAll(() => {
  Object.assign(UI, { log: vi.fn(), refresh: vi.fn(), clearLog: vi.fn(), hideOverlay() {}, hideScreen() {}, showScreen() {}, showOverlay() {}, act() {}, registerHelp() {}, helpBtn() { return ''; } });
  window.SDT.Meta = { setXpMul() {}, track() {} };
  session.configureGameRuntime({ openClassChoice: () => Promise.resolve(true) });
});
beforeEach(async () => {
  vi.restoreAllMocks();
  installImmediateWebLocks();
  localStorage.clear();
  Base.use(slot);
  session._set_active_slot(slot);
  Base.data.stash = [{ card: { id: 'departure-card', name: '携带牌', rarity: '稀有' }, count: 2 }];
  Base.data.pocket = [{ card: { id: 'spent', name: '待复原牌' }, count: 1 }];
  expect((await Base.save())).toBe(true);
  Object.assign(session.game, { seed: 'before-departure', runActive: false, nestActive: false, state: 'modal', battleActive: false });
  UI.log.mockClear(); UI.refresh.mockClear(); UI.clearLog.mockClear(); window.SDT.Sound.music.mockClear();
});
afterEach(() => vi.restoreAllMocks());

function failWrites(key, once = false) {
  let failures = 0;
  return vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (name, value) {
    if (name === key && (!once || failures++ === 0)) throw new Error('injected write failure');
    return originalSetItem.call(this, name, value);
  });
}
function storedBase() { return JSON.parse(localStorage.getItem(Base.SLOT_KEY(slot))); }
function storedRun() { return JSON.parse(localStorage.getItem(RunStorage.key(slot))); }
function recovery() {
  return createRecoveryCommands({ lockManager: navigator.locks });
}

describe('出征的真实 Base/Run 可恢复提交', () => {
  it('正常出征一次提交扣仓、清消耗区和完整入场存档，再发布界面', async () => {
    expect(await session.newRun('standard', picks, options)).toBeUndefined();
    expect(storedBase().stash[0].count).toBe(1);
    expect(storedBase().pocket).toEqual([]);
    expect(storedRun().ownedCards.filter(item => item.card.id === 'departure-card')).toHaveLength(1);
    expect(storedRun().seed).toBe(session.game.seed);
    expect(storedRun()._r2.revision).toBe(0);
    expect(localStorage.getItem(TX_KEY(slot))).toBeNull();
    expect(UI.clearLog).toHaveBeenCalledOnce();
    expect(window.SDT.Sound.music).toHaveBeenCalledOnce();
    const raw = localStorage.getItem(Base.SLOT_KEY(slot));
    expect((await recovery().recoverSlot(slot)).ok).toBe(true);
    expect(localStorage.getItem(Base.SLOT_KEY(slot))).toBe(raw);
    expect(await session.newRun('standard', picks, options)).toBe(false);
    expect(storedBase().stash[0].count).toBe(1);
  });

  it.each(['journal', 'base'])('%s 写失败不发布新局、不改变旧内存与随机流，允许原尝试重试', async kind => {
    const before = { ...session.game }, random = Random.snapshot(), baseRaw = localStorage.getItem(Base.SLOT_KEY(slot));
    const failure = failWrites(kind === 'journal' ? TX_KEY(slot) : Base.SLOT_KEY(slot));
    expect(await session.newRun('standard', picks, options)).toBe(false);
    expect(session.game.seed).toBe(before.seed);
    expect(session.game.ownedCards).toBe(before.ownedCards);
    expect(Random.snapshot()).toEqual(random);
    expect(localStorage.getItem(Base.SLOT_KEY(slot))).toBe(baseRaw);
    expect(storedRun()).toBeNull();
    expect(UI.refresh).not.toHaveBeenCalled();
    expect(UI.clearLog).not.toHaveBeenCalled();
    expect(window.SDT.Sound.music).not.toHaveBeenCalled();
    failure.mockRestore();
    expect(await session.newRun('standard', picks, options)).toBeUndefined();
    expect(storedBase().stash[0].count).toBe(1);
    expect(localStorage.getItem(TX_KEY(slot))).toBeNull();
  });

  it('首个 Run 写失败返回 false，重试恢复原 seed/UID，不再次扣卡', async () => {
    const failure = failWrites(RunStorage.key(slot));
    expect(await session.newRun('standard', picks, options)).toBe(false);
    expect(storedBase().stash[0].count).toBe(1);
    expect(storedRun()).toBeNull();
    expect(session.game.seed).toBe('before-departure');
    const journal = JSON.parse(localStorage.getItem(TX_KEY(slot)));
    const plannedRun = JSON.parse(journal.after.runRaw);
    failure.mockRestore();
    expect(await session.newRun('standard', picks, options)).toBeUndefined();
    expect(storedRun()).toEqual(plannedRun);
    expect(session.game.ownedCards).toEqual(plannedRun.ownedCards);
    expect(session.game.seed).toBe(plannedRun.seed);
    expect(storedBase().stash[0].count).toBe(1);
    expect(Base.data.stash[0].count).toBe(1);
  });

  it('中断后由新恢复器处理同一 journal，正常装载保留已扣卡和原入场', async () => {
    const failure = failWrites(RunStorage.key(slot));
    expect(await session.newRun('standard', picks, options)).toBe(false);
    const planned = JSON.parse(JSON.parse(localStorage.getItem(TX_KEY(slot))).after.runRaw);
    failure.mockRestore();
    Base.use(slot);
    const reloadedRecovery = recovery();
    expect((await reloadedRecovery.recoverSlot(slot)).ok).toBe(true);
    expect((await reloadedRecovery.recoverSlot(slot)).value).toBeNull();
    expect(session.loadGame(slot).ok).toBe(true);
    expect(session.game.seed).toBe(planned.seed);
    expect(session.game.ownedCards).toEqual(planned.ownedCards);
    expect(Base.data.stash[0].count).toBe(1);
  });

  it('检测第三方原串变化并保留现场，不把旧出征套到新存档', async () => {
    const failure = failWrites(RunStorage.key(slot));
    expect(await session.newRun('standard', picks, options)).toBe(false);
    failure.mockRestore();
    const changed = { ...storedBase(), coins: 987 };
    originalSetItem.call(localStorage, Base.SLOT_KEY(slot), JSON.stringify(changed));
    const journal = localStorage.getItem(TX_KEY(slot));
    expect((await recovery().recoverSlot(slot)).code).toBe('RECOVERY_BLOCKED');
    expect(storedBase().coins).toBe(987);
    expect(storedRun()).toBeNull();
    expect(localStorage.getItem(TX_KEY(slot))).toBe(journal);
  });

  it('没有 Web Locks 时拒绝出征并保持两个原档', async () => {
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
    const raw = localStorage.getItem(Base.SLOT_KEY(slot));
    expect(await session.newRun('standard', picks, options)).toBe(false);
    expect(localStorage.getItem(Base.SLOT_KEY(slot))).toBe(raw);
    expect(storedRun()).toBeNull();
    expect(localStorage.getItem(TX_KEY(slot))).toBeNull();
  });

  it('规划后原串变化在写 journal 前拒绝，不为旧计划挂起新的恢复日志', async () => {
    const command = createDeparturePersistence({ storage: localStorage, baseApi: Base, runStore: RunStorage, txKey: TX_KEY });
    const prepared = command.prepare(slot, picks);
    expect(prepared.ok).toBe(true);
    const changed = { ...storedBase(), coins: 765 };
    originalSetItem.call(localStorage, Base.SLOT_KEY(slot), JSON.stringify(changed));
    const committed = command.commit(slot, prepared.value, { seed: 'unused' });
    expect(committed.result.code).toBe('STALE_REVISION');
    expect(localStorage.getItem(TX_KEY(slot))).toBeNull();
    expect(storedBase().coins).toBe(765);
    expect(storedRun()).toBeNull();
  });

  it('无slot测试局不会扣除仍加载的其他持久档库存或清理其消耗区', async () => {
    const base = Base.data, raw = localStorage.getItem(Base.SLOT_KEY(slot));
    session._set_active_slot(null);
    expect(await session.newRun('standard', picks, options)).toBeUndefined();
    expect(Base.data).toBe(base);
    expect(Base.data.stash[0].count).toBe(2);
    expect(Base.data.pocket).toHaveLength(1);
    expect(localStorage.getItem(Base.SLOT_KEY(slot))).toBe(raw);
    expect(localStorage.getItem(TX_KEY(slot))).toBeNull();
    expect(storedRun()).toBeNull();
  });

  it.each(['cancel', 'switch'])('等待锁时%s取消原请求，不写入也不发布旧页面', async reason => {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: async (_name, _opts, callback) => { await gate; return callback(); } } });
    let visible = true;
    const raw = localStorage.getItem(Base.SLOT_KEY(slot));
    const opening = session.newRun('standard', picks, { ...options, isCurrent: () => visible });
    if (reason === 'cancel') visible = false;
    else { Base.use(2); session._set_active_slot(2); }
    release();
    expect(await opening).toBe(false);
    expect(localStorage.getItem(Base.SLOT_KEY(slot))).toBe(raw);
    expect(storedRun()).toBeNull();
    expect(UI.clearLog).not.toHaveBeenCalled();
  });

  it('等待锁时双击复用同一个 Promise，只扣一次库存', async () => {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const request = vi.fn(async (_name, _opts, callback) => { await gate; return callback(); });
    Object.defineProperty(navigator, 'locks', { configurable: true, value: { request } });
    const first = session.newRun('standard', picks, options);
    const second = session.newRun('standard', picks, options);
    expect(second).toBe(first);
    release();
    expect(await first).toBeUndefined();
    expect(request).toHaveBeenCalledOnce();
    expect(storedBase().stash[0].count).toBe(1);
    expect(UI.clearLog).toHaveBeenCalledOnce();
  });
});

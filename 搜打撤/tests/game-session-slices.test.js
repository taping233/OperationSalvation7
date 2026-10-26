// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createSessionPersistence } from '../game/src/run/game-session-persistence.js';
import { createSessionRestoration } from '../game/src/run/game-session-restoration.js';
import { createSessionDeparture } from '../game/src/run/game-session-departure.js';

function setup() {
  let state = { activeSlot: 1, game: { seed: 'old', state: 'idle', hp: 10, runActive: true,
    discoveredPairs: new Set(), elapsed: 0, ownedCards: [] }, runtime: { openClassChoice: vi.fn() } };
  let services = { Base: { slot: 1, save: vi.fn(async () => true), flushWrites: vi.fn(async () => ({ ok: true })),
    syncPlayTime: vi.fn(async () => ({ changed: false, persisted: true })), data: {}, carriedPet: () => null },
    Cards: { all: () => [], SHA: { id: 'starter-attack' } }, Sound: { music: vi.fn() } };
  const ports = { readState: () => state, readServices: () => services,
    readUI: () => ({ log: vi.fn(), clearLog: vi.fn() }), readStorage: () => ({}),
    Random: { seed: 'old', snapshot: () => ({ seed: state.game.seed }), restore: value => value?.seed || value,
      reseed: () => 'new', random: () => 0 },
    RunStorage: { readIdentity: () => ({ ok: true, value: { runId: 'run-1' } }),
      write: vi.fn(async () => true), lastWriteIssue: () => null },
    SLOT_COUNT: 5, TX_KEY: slot => `tx-${slot}`, createMapSnapshot: () => ({ ok: true, value: {} }),
    GENERATOR_VERSION: 1, LAYOUT_VERSION: 1, snapshotRunBattles: () => ({}), assertZones: vi.fn(),
    publishSaveState: vi.fn(), withSlotWriteLock: vi.fn() };
  const persistence = createSessionPersistence(ports);
  return { ports, persistence, get state() { return state; }, get services() { return services; },
    replaceState: next => { state = next; }, replaceServices: next => { services = next; } };
}

describe('session controller receipts and live state', () => {
  it('keeps a run checkpoint success distinct from a failed full session save', async () => {
    const h = setup();
    expect(await h.persistence.saveGame()).toBe(true);
    h.services.Base.save.mockResolvedValue(false);
    expect(await h.persistence.saveSession()).toMatchObject({ ok: false, code: 'BASE_SAVE_FAILED' });
    expect(h.ports.RunStorage.write).toHaveBeenCalledTimes(2);
  });

  it('observes slot replacement after a write without saving the replacement base', async () => {
    const h = setup(); let complete;
    h.ports.RunStorage.write.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    const pending = h.persistence.saveSession();
    h.replaceState({ ...h.state, activeSlot: 2, game: { ...h.state.game, seed: 'other' } });
    const nextBase = { ...h.services.Base, slot: 2, save: vi.fn(async () => true) };
    h.replaceServices({ ...h.services, Base: nextBase });
    complete(true);
    expect(await pending).toMatchObject({ ok: false, code: 'STALE_SLOT' });
    expect(nextBase.save).not.toHaveBeenCalled();
    expect(h.ports.RunStorage.write.mock.calls[0][0]).toBe(1);
  });

  it.each(['run-token','game-object','seed'])('old saveGame completion preserves its result without publishing into changed %s', async changed => {
    const h=setup(); let complete;
    h.ports.RunStorage.write.mockImplementationOnce(()=>new Promise(resolve=>{complete=resolve;}));
    const pending=h.persistence.saveGame(); h.ports.publishSaveState.mockClear();
    if(changed==='run-token') h.state.game.discoveredPairs=new Set();
    if(changed==='seed') h.state.game.seed='another';
    if(changed==='game-object') h.replaceState({...h.state,game:{...h.state.game}});
    complete(false); expect(await pending).toBe(false); expect(h.ports.publishSaveState).not.toHaveBeenCalled();
  });

  it('same-slot same-seed replacement run cannot receive old session failure or save its base', async () => {
    const h=setup(); let complete;
    h.ports.RunStorage.write.mockImplementationOnce(()=>new Promise(resolve=>{complete=resolve;}));
    const pending=h.persistence.saveSession(); h.ports.publishSaveState.mockClear();
    h.state.game.discoveredPairs=new Set(); complete(true);
    expect(await pending).toMatchObject({ok:false,code:'STALE_SLOT'});
    expect(h.services.Base.flushWrites).not.toHaveBeenCalled(); expect(h.services.Base.save).not.toHaveBeenCalled();
    expect(h.ports.publishSaveState).not.toHaveBeenCalled();
  });

  it('stops before saving base when ownership changes during its queued-write flush', async () => {
    const h=setup(); let complete;
    h.services.Base.flushWrites.mockImplementationOnce(()=>new Promise(resolve=>{complete=resolve;}));
    const pending=h.persistence.saveSession(); await Promise.resolve(); await Promise.resolve();
    h.ports.publishSaveState.mockClear(); h.state.game.discoveredPairs=new Set(); complete({ok:true});
    expect(await pending).toMatchObject({ok:false,code:'STALE_SLOT'});
    expect(h.services.Base.save).not.toHaveBeenCalled(); expect(h.ports.publishSaveState).not.toHaveBeenCalled();
  });

  it('retains restoration receipts until an asynchronous base write settles', async () => {
    const h = setup(); let complete;
    const result = h.persistence.trackRestoration(() => {
      h.persistence.recordBaseSaveForLoad('rename', new Promise(resolve => { complete = resolve; }));
      return { ok: true, value: true };
    }, 1);
    expect(result.ok).toBe(true);
    expect(result.persistence.status).toBe('pending');
    complete(false);
    expect(await result.pendingPersistence).toEqual({ ok: false, code: 'BASE_SAVE_FAILED' });
    expect(result.persistence.status).toBe('failed');
    expect(result.persistence.attempts[0]).toMatchObject({ target: 'base', reason: 'rename', ok: false });
  });

  it('reserves elapsed seconds synchronously so overlapping saves do not count twice', async () => {
    const h = setup(); h.state.game.elapsed = 8;
    const first = h.persistence.syncPlayTime();
    const second = h.persistence.syncPlayTime();
    expect(h.services.Base.syncPlayTime).toHaveBeenCalledExactlyOnceWith(8, 0, 'run-1');
    expect(await first).toEqual({ changed: false, persisted: true });
    expect(await second).toEqual({ changed: false, persisted: true });
  });

  it('keeps restoration synchronous and does not mutate state when acceptLoad rejects', async () => {
    const h = setup();
    const before = h.state.game;
    const run = { seed: 'saved' };
    const rejected = { ok: false, code: 'STALE_SLOT', message: 'stale' };
    const restore = createSessionRestoration({ ...h.ports, development: false,
      RunStorage: { ...h.ports.RunStorage, readForPreflight: () => run, acceptLoad: () => rejected },
      validateRunSave: () => ({ ok: true }), planMapRestore: () => ({ ok: true, value: {} }),
      trackRestoration: (...args) => h.persistence.trackRestoration(...args) });
    const result = restore.loadGame(1);
    expect(result).not.toBeInstanceOf(Promise);
    expect(result).toMatchObject(rejected);
    expect(h.state.game).toBe(before);
    expect(h.state.game.seed).toBe('old');
    expect(await result.pendingPersistence).toEqual({ ok: true });
  });

  it('coalesces matching departure promises and rejects a request invalidated before its lease', async () => {
    const h = setup(); let release;
    const work = vi.fn();
    const departure = createSessionDeparture({ ...h.ports,
      createDeparturePersistence: () => ({ withLock: (_slot, current, prepare) => new Promise(resolve => {
        release = () => { work(); resolve(current() ? prepare() : false); };
      }) }) });
    const first = departure.newRun('standard', [], { skipClassChoice: true });
    expect(departure.newRun('standard', [], { skipClassChoice: true })).toBe(first);
    expect(await departure.newRun('other', [], { skipClassChoice: true })).toBe(false);
    h.replaceState({ ...h.state, activeSlot: 2 }); release();
    expect(await first).toBe(false);
    expect(work).toHaveBeenCalledOnce();
    expect(h.state.game.seed).toBe('old');
  });

  it('publishes a committed candidate once and preserves the skipped-class return value', async () => {
    const h = setup(); const committed = vi.fn(() => ({ result: { ok: true } }));
    const departureData = { ok: true, cards: [], rejectedClassNames: [] };
    const reset = vi.fn(); const enter = vi.fn((layer, index) => {
      h.state.game.layerIdx = layer; h.state.game.trackPos = index; h.state.game.state = 'idle';
    });
    const departure = createSessionDeparture({ ...h.ports, MAP: { rules: { starterSha: 0, playerMaxHp: 20, playerAtk: 2 } },
      MODES: { standard: {} }, modeCfg: () => ({ startCoins: 0 }),
      buildNewRunDerived: () => { h.state.game.layerData = [{ entrances: [0] }]; },
      newUid: () => 'uid', createRunSavePayload: () => ({ checkpoint: true }),
      createDeparturePersistence: () => ({ withLock: (_slot, current, prepare) => Promise.resolve(current() ? prepare() : false),
        pending: () => ({ ok: true, value: null }), prepare: () => ({ ok: true, value: { departure: departureData } }), commit: committed }),
      resetRunCounters: reset, applyModeRules: vi.fn(), setLobby: vi.fn(), enterLayer: enter,
      nextTerminalGeneration: vi.fn(), esc: String });
    expect(await departure.newRun('standard', [], { skipClassChoice: true })).toBeUndefined();
    expect(committed).toHaveBeenCalledExactlyOnceWith(1, { departure: departureData }, { checkpoint: true });
    expect(reset).toHaveBeenCalledOnce();
    expect(h.state.game.seed).toBe('new');
    expect(h.state.runtime.openClassChoice).not.toHaveBeenCalled();
  });
});

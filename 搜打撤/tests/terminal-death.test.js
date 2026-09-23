import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const canvasCtx = new Proxy({}, { get: () => () => canvasCtx, set: () => true });
window.HTMLCanvasElement.prototype.getContext = () => canvasCtx;
document.body.innerHTML = '<canvas id="game"></canvas><div id="title"></div><div id="exitScr"></div>';
window.SDT = {
  Icons: { img: () => '', TYPE_ART: {} },
  Sound: { music: vi.fn(), sfx: vi.fn(), setDucked: vi.fn() },
  FX: { feedback: vi.fn() },
  MAP: { rules: { playerMaxHp: 50, playerAtk: 4, fireHeal: 5, battleEnergy: 2,
    battleHandMax: 10, bossDeckSize: 10, starterSha: 0, battleStartDraw: 5,
    battleTurnDraw: 1, diceSides: 6 } },
};
await import('../game/src/cards/cards.js');
await import('../game/src/ui/ui.js');
await import('../game/src/hub/base.js');
await import('../game/src/hub/meta.js');
Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: (_name, _options, callback) => callback() } });
const { RunStorage } = await import('../game/src/hub/game.storage.js');
const session = await import('../game/src/run/game.session.js');
const { game, doDeath } = session;
const actions = new Map();

beforeAll(() => {
  Object.assign(window.SDT.UI, {
    log: vi.fn(), refresh: vi.fn(), clearLog: vi.fn(), hideOverlay: vi.fn(),
    hideScreen: vi.fn(), showScreen: vi.fn(), showOverlay: vi.fn(), act: vi.fn(),
    registerHelp: vi.fn(), helpBtn: () => '',
  });
  window.SDT.UI.act = vi.fn((name, fn) => actions.set(name, fn));
  window.SDT.Nest = { renderNestMap: vi.fn() };
});

describe('死亡终局幂等', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.SDT.Base.use(2);
    window.SDT.Base.reset(2);
    window.SDT.Base.data.characters = { wu: { lv: 1, xp: 47 } };
    window.SDT.Base.save();
    session._set_active_slot(2);
    RunStorage.write(2, { seed: 'terminal-death', hp: 0, maxHp: 30, inventory: [], ownedCards: [], myClass: '侠客' });
    game.runActive = true;
    game.state = 'idle';
    game.myClass = '侠客';
    game.surrenderedRun = false;
    game.inventory = [{ name: '木材', count: 2, value: 1 }];
    game.ownedCards = [];
    game.hp = 0;
    game.elapsed = 0;
    game.elapsedSynced = 0;
    game.terminalPending = null;
    actions.clear();
    window.SDT.UI.log.mockClear();
    window.SDT.UI.showOverlay.mockClear();
    vi.spyOn(window.SDT.Meta, 'checkUnlocks').mockClear();
    vi.spyOn(window.SDT.Base, 'depositCards').mockClear();
  });

  it('存储首次失败时保留运行档/卡牌，重试配对提交后死亡统计和升级只落一次', async () => {
    const card = { id: 'qa-terminal-safe', name: '测试安全卡', type: '法术', rarity: '古朴' };
    game.ownedCards = [{ uid: 'safe-death-card', card, safe: true }];
    const baseKey = window.SDT.Base.SLOT_KEY(2);
    const runKey = RunStorage.key(2);
    const baseRaw = window.localStorage.getItem(baseKey);
    const runRaw = window.localStorage.getItem(runKey);
    let failJournal = true;
    const storagePrototype = Object.getPrototypeOf(window.localStorage);
    const nativeSetItem = storagePrototype.setItem;
    const setSpy = vi.spyOn(storagePrototype, 'setItem').mockImplementation(function (key, value) {
      if (key === `sdt-tx-v1-slot2` && failJournal) { failJournal = false; throw new Error('journal failure'); }
      return nativeSetItem.call(this, key, value);
    });

    expect(await doDeath()).toBe(false);
    expect(game.runActive).toBe(true);
    expect(game.ownedCards).toHaveLength(1);
    expect(game.terminalPending).toBeTruthy();
    expect(window.localStorage.getItem(baseKey)).toBe(baseRaw);
    expect(window.localStorage.getItem(runKey)).toBe(runRaw);
    expect(window.SDT.UI.showOverlay).toHaveBeenCalledWith(expect.stringContaining('终局结算未保存'), expect.any(String));
    setSpy.mockRestore();

    expect(await actions.get('retryTerminalDeath')()).toBe(true);
    expect(doDeath()).toBe(false);

    expect(game.runActive).toBe(false);
    expect(game.terminalPending).toBeNull();
    expect(window.SDT.Base.depositCards).not.toHaveBeenCalled();
    expect(window.SDT.Base.data.stash.find(x => x.card.id === card.id)?.count).toBe(1);
    expect(window.localStorage.getItem(runKey)).toBeNull();
    expect(JSON.parse(window.localStorage.getItem(baseKey)).stats.deaths).toBe(1);
    expect(window.SDT.Base.data.characters.wu).toMatchObject({ lv: 2, xp: 2 });
    expect(window.SDT.Meta.checkUnlocks).toHaveBeenCalledOnce();
    expect(window.SDT.UI.log).toHaveBeenCalledWith(expect.stringContaining('熟练度提升'), 'ok');
    expect(window.SDT.UI.showOverlay).toHaveBeenCalledTimes(2);
  });

  it('同局迟到回调不重复结算，新开局可用新runId再次结算', async () => {
    const card = { id: 'qa-terminal-safe', name: '测试安全卡', type: '法术', rarity: '古朴' };
    game.ownedCards = [{ uid: 'safe-first', card, safe: true }];
    const deathResult = await doDeath();
    expect(deathResult, JSON.stringify(window.SDT.UI.showOverlay.mock.calls)).toBe(true);
    expect(doDeath()).toBe(false);
    expect(window.SDT.Base.data.stash.find(x => x.card.id === card.id)?.count).toBe(1);

    session.newRun('standard', [], { skipClassChoice: true });
    const identity = RunStorage.readIdentity(2);
    expect(identity.ok).toBe(true);
    game.myClass = '侠客';
    game.hp = 0;
    game.ownedCards.push({ uid: 'safe-next', card: { ...card }, safe: true });
    expect(await doDeath()).toBe(true);

    expect(window.SDT.Base.depositCards).not.toHaveBeenCalled();
    expect(window.SDT.Base.data.stash.find(x => x.card.id === card.id)?.count).toBe(2);
    expect(JSON.parse(localStorage.getItem(window.SDT.Base.SLOT_KEY(2))).stats.deaths).toBe(2);
  });

  it('slot=null但Base仍加载旧档时只做内存测试投影，不写基地或运行档', async () => {
    const card = { id: 'qa-terminal-ephemeral', name: '临时安全卡', type: '法术', rarity: '古朴' };
    const baseKey = window.SDT.Base.SLOT_KEY(2);
    const runKey = RunStorage.key(2);
    const baseRaw = window.localStorage.getItem(baseKey);
    const runRaw = window.localStorage.getItem(runKey);
    session._set_active_slot(null);
    game.runActive = true;
    game.state = 'idle';
    game.ownedCards = [{ uid: 'ephemeral-safe', card, safe: true }];

    expect(await doDeath()).toBe(true);

    expect(window.SDT.Base.data.stash.find(x => x.card.id === card.id)?.count).toBe(1);
    expect(window.localStorage.getItem(baseKey)).toBe(baseRaw);
    expect(window.localStorage.getItem(runKey)).toBe(runRaw);
    expect(window.SDT.Base.depositCards).not.toHaveBeenCalled();
    expect(window.SDT.Meta.checkUnlocks).not.toHaveBeenCalled();
  });
});

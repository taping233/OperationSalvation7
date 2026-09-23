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
await import('../game/src/cards.js');
await import('../game/src/ui.js');
await import('../game/src/base.js');
const { game, doDeath } = await import('../game/src/game.session.js');

beforeAll(() => {
  Object.assign(window.SDT.UI, {
    log: vi.fn(), refresh: vi.fn(), clearLog: vi.fn(), hideOverlay: vi.fn(),
    hideScreen: vi.fn(), showScreen: vi.fn(), showOverlay: vi.fn(), act: vi.fn(),
    registerHelp: vi.fn(), helpBtn: () => '',
  });
  window.SDT.Meta = { setXpMul: vi.fn(), track: vi.fn() };
  window.SDT.Nest = { renderNestMap: vi.fn() };
});

describe('死亡终局幂等', () => {
  beforeEach(() => {
    localStorage.clear();
    window.SDT.Base.use(8);
    window.SDT.Base.reset(8);
    game.runActive = true;
    game.state = 'idle';
    game.myClass = '侠客';
    game.surrenderedRun = false;
    game.inventory = [{ name: '木材', count: 2, value: 1 }];
    game.ownedCards = [];
    game.hp = 0;
    window.SDT.UI.log.mockClear();
    window.SDT.UI.showOverlay.mockClear();
    window.SDT.Meta.track.mockClear();
    vi.spyOn(window.SDT.Base, 'depositCards').mockClear();
  });

  it('死亡后的迟到重复回调只记录一次死亡并搬运一次安全格', () => {
    const card = { id: 'qa-terminal-safe', name: '测试安全卡', type: '法术', rarity: '古朴' };
    game.ownedCards = [{ uid: 'safe-death-card', card, safe: true }];

    expect(doDeath()).toBe(true);
    expect(doDeath()).toBe(false);

    expect(game.runActive).toBe(false);
    expect(window.SDT.Meta.track).toHaveBeenCalledTimes(1);
    expect(window.SDT.Base.depositCards).toHaveBeenCalledOnce();
    expect(window.SDT.Base.depositCards).toHaveBeenCalledWith([{ card, count: 1 }]);
    expect(window.SDT.Base.data.stash.find(x => x.card.id === card.id)?.count).toBe(1);
    expect(window.SDT.UI.showOverlay).toHaveBeenCalledOnce();
  });

  it('开启新局后死亡结算闩复位，同一卡可再次入库', () => {
    const card = { id: 'qa-terminal-safe', name: '测试安全卡', type: '法术', rarity: '古朴' };
    game.ownedCards = [{ uid: 'safe-first', card, safe: true }];
    expect(doDeath()).toBe(true);
    expect(doDeath()).toBe(false);
    expect(window.SDT.Base.data.stash.find(x => x.card.id === card.id)?.count).toBe(1);

    game.runActive = true;
    game.state = 'idle';
    game.ownedCards = [{ uid: 'safe-next', card: { ...card }, safe: true }];
    expect(doDeath()).toBe(true);

    expect(window.SDT.Meta.track).toHaveBeenCalledTimes(2);
    expect(window.SDT.Base.depositCards).toHaveBeenCalledTimes(2);
    expect(window.SDT.Base.data.stash.find(x => x.card.id === card.id)?.count).toBe(2);
  });
});

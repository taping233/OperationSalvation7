// 四线试玩修复：复用 WORLD 组会话桩，使用真实UI壳、动效包装器和返回钩子。
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const H = globalThis.__worldRegress = { game: {}, saves: [], cards: [], uid: 0 };
vi.mock('../game/src/run/game.session.js', () => ({
  game: H.game, MAP: { rules: { fireHeal: 10, fireClassCardChance: 1 }, monsters: {}, altar: { bosses: [] } }, MODES: {},
  bagCap: () => 9, usedSlots: () => 0, newUid: () => `u${++H.uid}`, pick: a => a[0],
  saveGame: () => { H.saves.push(JSON.parse(JSON.stringify(H.game))); return true; },
  scaledEnemy: a => a, getActiveSlot: () => null, curLayer: () => H.game.layerData[H.game.layerIdx],
  cellCenter: () => ({}), markSeen() {}, modeCfg: () => ({}), gainCoins: n => H.game.coins += n,
  weighted: a => a[0], enterLayer() {}, exitToTitle() {},
}));
vi.mock('../game/src/hub/game.cardslib.js', () => ({ Sfx: { tick() {}, ding() {} }, _set_cardPageOpen() {}, cardHTML: c => `<span>${c.name}</span>` }));
vi.mock('../game/src/hub/game.hub.js', () => ({ openBaseHub() {} }));
vi.mock('../game/src/battle/battle-loader.js', () => ({ startBattle() {}, ensureBattleReady: async () => {}, captureBattleContext: () => () => true }));
vi.mock('../game/src/hub/extraction.commands.js', () => ({ createExtractionCommands: () => ({}), validatePendingExtraction: () => ({ ok: true }) }));
vi.mock('../game/src/hub/recovery.commands.js', () => ({ commitBaseAndRun() {}, readSettlementReceipt() {}, recoverSlot() {} }));
vi.mock('../game/src/home/story.commands.js', () => ({ storyCommands: {} }));
vi.mock('../game/src/home/narrative.js', () => ({ eventNarrative: async () => null, lastLampNarrative: async () => null }));

let scenes, flow, UI, takeBagReturnHook, setBagReturnHook;
beforeAll(async () => {
  window.SDT = { Icons: { rich: x => x }, Sound: { sfx() {} }, Meta: { track() {}, addXpToProgress() {} }, Base: { bagCap:() => 9 },
    Cards: { all: () => H.cards, isRandomObtainable: () => true, randomClassCard: () => H.cards[0], cardHTML: c => `<span>${c.name}</span>` } };
  const { overlayMethods } = await import('../game/src/ui/overlay.js');
  UI = window.SDT.UI = { ...overlayMethods, _acts: {}, _baseActs: {}, _roomActive: true, el: {},
    act: (name, fn) => UI._acts[name] = fn, refresh() {}, log() {}, showCardReward() {}, _checkPageBg() {},
  };
  ({ takeBagReturnHook, setBagReturnHook } = await import('../game/src/hub/bag-return-hook.js'));
  scenes = await import('../game/src/run/game.run.scenes.js');
  flow = await import('../game/src/run/game.run.flow.js');
});
beforeEach(() => {
  document.body.innerHTML = '<div id="overlay" hidden><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div>';
  UI.el = { overlay: document.getElementById('overlay'), ovBody: document.getElementById('ovBody'), ovTitle: document.getElementById('ovTitle') };
  UI._acts = {}; UI._overlayInerted = []; UI._lastMode = null; UI._hideTimer = null; UI._roomActive = true; setBagReturnHook(null);
  H.cards = [{ id: 'reward', name: '奖励牌', rarity: '职业', type: '武术' }]; H.saves = []; H.uid = 0;
  Object.assign(H.game, { state: 'idle', layerIdx: 0, trackPos: 1, hp: 1, maxHp: 35, visited: {}, nodeRewards:{}, ownedCards: [], usedPocket: [], myClass: '武', runActive: true, coins: 9,
    layerData: [{ logical: [{ def: { type: 'entrance' } }, { def: { type: 'fire' } }] }],
    bagCap:() => 9, usedSlots:() => H.game.ownedCards.length,
    canReceiveCard: () => true, heal: n => H.game.hp = Math.min(H.game.maxHp, H.game.hp + n),
  });
});
// 镜像 game.bag.js closeBackpack 的非宝箱分支：真实 hideOverlay + 真实返回钩子
function closeCoveredBag() {
  UI.hideOverlay(); const hook = takeBagReturnHook(); if (hook) hook(); else H.game.state = 'idle';
}
beforeEach(async () => {
  vi.useFakeTimers();
  vi.resetModules();
  await import('../game/src/ui/interface-motion.js');
});
afterEach(() => { UI.hideOverlay({ immediate: true }); vi.clearAllTimers(); vi.useRealTimers(); });

describe('四线试玩 P1 事件生命周期', () => {
  it('过场被新页面替换后，旧超时不关闭新页或推进旧节点', async () => {
    const pending = scenes.showRunTransition({ title:'商店', presentation:'node-cut', duration:240 });
    UI.showOverlay('新页', '<main id="destination">当前内容</main>', 'page');
    await vi.advanceTimersByTimeAsync(500);
    expect(await pending).toBe(false);
    expect(UI.el.overlay.hidden).toBe(false);
    expect(document.getElementById('destination')?.textContent).toBe('当前内容');
  });
  it('G04 房间结算回地图重置视口滚动，不滚动其他阅读区', () => {
    const viewport = document.createElement('div'); viewport.id = 'viewport';
    document.body.append(viewport); viewport.append(UI.el.overlay);
    const reading = document.createElement('section'); viewport.append(reading);
    viewport.scrollTop=104; viewport.scrollLeft=16; reading.scrollTop=40;
    UI.beginRoom(); UI.endRoom();
    expect(viewport.scrollTop).toBe(0); expect(viewport.scrollLeft).toBe(0);expect(reading.scrollTop).toBe(40);
  });
  it('旧房间延迟关闭后先登记再渲染，新复原页卡片和继续动作可用', async () => {
    const done = vi.fn();
    H.game.usedPocket = [{ card: { id:'restore', name:'复原样本', type:'武术' }, count:2 }];
    UI.showOverlay('旧页', '<main>旧页</main>', 'page');
    UI.act('old', vi.fn());
    UI.hideOverlay();
    expect(UI._acts.old).toBeUndefined();
    scenes.openPocketRestore(3, done);
    expect(UI._acts.restoreOne).toBeTypeOf('function');
    UI._acts.restoreOne({ name:'复原样本' });
    expect(H.game.ownedCards).toHaveLength(1);
    closeCoveredBag();
    UI._acts.restoreOne({ name:'复原样本' });
    expect(H.game.ownedCards).toHaveLength(2);
    UI._acts.fireDone();
    expect(done).toHaveBeenCalledTimes(1);
    expect(takeBagReturnHook()).toBeNull();
    expect(UI._acts.fireDone).toBeUndefined(); // 退出画面期间动作已同步失效
    await vi.advanceTimersByTimeAsync(240); // interface-motion 远征页退出保留 220ms 画面
    expect(UI.el.overlay.hidden).toBe(true);
  });
  it('延迟关闭切献祭预览，取消动作不会失联或被旧定时器清掉', async () => {
    const cancel = vi.fn();
    UI.showOverlay('旧页', '<main>旧页</main>', 'page'); UI.hideOverlay();
    UI.act('sacCancel', cancel);
    UI.showOverlay('献祭预览', '<button data-act="sacCancel">取消</button>', 'page');
    await vi.advanceTimersByTimeAsync(200);
    expect(UI.el.overlay.hidden).toBe(false);
    UI._acts.sacCancel();
    expect(cancel).toHaveBeenCalledTimes(1);
  });
  it('药摊领取前背包返回保留候选，领取后不重开或再次发奖', async () => {
    H.cards = [{ id:'ev19-potions', name:'药摊', type:'事件' }, ...[1,2,3].map(n => ({ id:`p${n}`, name:`药水${n}`, type:'道具', rarity:'普通' }))];
    H.game.layerData[0].logical[1].def.type = 'event';
    const opening = flow.runEventDeck();
    await vi.advanceTimersByTimeAsync(1000);
    await opening;
    UI._acts.evtChoice({ i:'0' });
    const before = UI.el.ovBody.textContent;
    closeCoveredBag();
    expect(UI.el.ovBody.textContent).toBe(before);
    UI._acts.eventCardPick({ i:'0' });
    expect(H.game.ownedCards).toHaveLength(1);
    expect(takeBagReturnHook()).toBeNull();
    closeCoveredBag();
    expect(UI._acts.eventCardPick).toBeUndefined(); // 领取后退出画面不可再次发奖
    await vi.advanceTimersByTimeAsync(240);
    expect(H.game.ownedCards).toHaveLength(1);
    expect(H.game.state).toBe('idle');
    expect(UI.el.ovBody.querySelector('[data-act="eventCardPick"]')).toBeNull();
  });
  it('G07 资源专用空格不允许复原新普通牌，同名叠放仍可复原', () => {
    const card = { id:'restore-full', name:'容量样本', type:'武术' };
    H.game.usedPocket = [{ card, count:1 }];
    H.game.canReceiveCard = () => false;
    scenes.openPocketRestore(1, () => {});
    UI._acts.restoreOne({ name:card.name });
    expect(H.game.usedPocket[0].count).toBe(1);expect(H.game.ownedCards).toHaveLength(0);
    H.game.canReceiveCard = () => true;UI._acts.restoreOne({ name:card.name });
    expect(H.game.ownedCards).toHaveLength(1);expect(H.game.usedPocket).toHaveLength(0);
  });
});

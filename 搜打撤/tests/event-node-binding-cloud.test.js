import { rollEventDice } from './helpers/event-dice.js';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const H = vi.hoisted(() => ({ game: {}, cards: [], saves: [], uid: 0, slot: null, narrative: async () => null, random: () => 0.9, pick: a => a[0] }));
vi.mock('../game/src/core/random.js', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, Random: { ...actual.Random, random: (...args) => H.random(...args) } };
});
vi.mock('../game/src/run/game.session.js', () => ({
  game: H.game, MAP: { rules: { fireHeal:10, fireClassCardChance:1, bossDeckSize:15, starterSha:5, battleStartDraw:5, battleTurnDraw:1, battleHandMax:8 }, monsters:{}, altar:{ bosses:[] } }, MODES: {},
  bagCap: () => 9, usedSlots: () => 0, newUid: () => `u${++H.uid}`, pick: (...args) => H.pick(...args),
  saveGame: () => { H.saves.push(JSON.parse(JSON.stringify(H.game))); return true; },
  scaledEnemy: a => a, getActiveSlot: () => H.slot, curLayer: () => H.game.layerData[H.game.layerIdx],
  cellCenter: () => ({}), markSeen() {}, modeCfg: () => ({}), gainCoins: n => H.game.coins += n,
  weighted: a => a[0], enterLayer() {}, exitToTitle() {},
}));
vi.mock('../game/src/hub/game.cardslib.js', () => ({ Sfx: { tick() {}, ding() {} }, _set_cardPageOpen() {}, cardHTML: c => `<span>${c.name}</span>` }));
vi.mock('../game/src/hub/game.hub.js', () => ({ openBaseHub() {} }));
vi.mock('../game/src/hub/extraction.commands.js', () => ({ createExtractionCommands: () => ({}), validatePendingExtraction: () => ({ ok: true }) }));
vi.mock('../game/src/hub/recovery.commands.js', () => ({ commitBaseAndRun() {}, readSettlementReceipt() {}, recoverSlot() {} }));
vi.mock('../game/src/home/story.commands.js', () => ({ storyCommands: { inspect: () => ({ ok: true, value: { kind: 'complete' } }) } }));
vi.mock('../game/src/home/narrative.js', () => ({ eventNarrative: (...args) => H.narrative(...args), lastLampNarrative: async () => null }));

let flow, scenes, UI, setBagReturnHook;
beforeAll(async () => {
  window.SDT = { game: H.game, Icons: { rich: x => x }, Sound: { sfx() {} }, Meta: { track() {}, addXpToProgress() {} }, Base: { bagCap:() => 9 },
    MAP:{ chestKinds:{ small:{ name:'小宝箱' } } },
    Cards: { DROP_WEIGHTS:{ 古朴:1 }, all: () => H.cards, classPool: () => H.cards.filter(c => c.type === '能力卡'), sellPrice:() => 1, isRandomObtainable: () => true, cardHTML: c => `<span>${c.name}</span>` } };
  const { overlayMethods } = await import('../game/src/ui/overlay.js');
  UI = window.SDT.UI = { ...overlayMethods, _acts: {}, _baseActs: {}, _roomActive: true, el: {},
    act: (name, fn) => UI._acts[name] = fn, refresh() {}, log() {}, showCardReward() {}, _checkPageBg() {},
  };
  ({ setBagReturnHook } = await import('../game/src/hub/bag-return-hook.js'));
  flow = await import('../game/src/run/game.run.flow.js');
  scenes = await import('../game/src/run/game.run.scenes.js');
  await import('../game/src/run/chests.js');
});
beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<div id="overlay" hidden><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div>';
  UI.el = { overlay: document.getElementById('overlay'), ovBody: document.getElementById('ovBody'), ovTitle: document.getElementById('ovTitle') };
  UI.el.ovBody.addEventListener('click', event => { const button = event.target.closest('[data-act]'); if (button) UI._acts[button.dataset.act]?.(button.dataset); });
  UI._acts = {}; UI._overlayInerted = []; UI._lastMode = null; UI._hideTimer = null; UI._roomActive = true; setBagReturnHook(null);
  H.random = () => 0.9; H.pick = a => a[0];
  H.saves = []; H.uid = 0; H.slot = null; H.narrative = async () => null;
  for (const key of Object.keys(H.game)) delete H.game[key];
  Object.assign(H.game, { seed: 7, state: 'idle', layerIdx: 0, trackPos: 1, hp: 1, maxHp: 35, visited: {}, ownedCards: [], usedPocket: [], myClass: '武', runActive: true, coins: 18, fragments: 0,
    altarActivated:false, altarRewardPending:false, altarItemSacrificed:false, nodeRewards:{}, entrySupply:null,
    discoveredPairs: new Set(), layerData: [{ logical: [{ def: { type: 'entrance' } }, { def: { type: 'event' } }] }],
    canReceiveCard: () => true, heal: n => H.game.hp = Math.min(H.game.maxHp, H.game.hp + n),
    damage: vi.fn((n, reason) => {
      H.game.hp -= n;
      if (H.game.hp <= 0) {
        H.game.terminalPending = { kind:'death', endReason:reason };
        H.game.state = 'terminalPending';
      }
    }),
    grantCard: (card, opts) => scenes.grantEventCard(card, opts), bagCap:() => 9, usedSlots:() => H.game.ownedCards.length,
  });
});
afterEach(() => { UI.hideOverlay({ immediate: true }); vi.restoreAllMocks(); vi.clearAllTimers(); vi.useRealTimers(); });

const potionCards = [1, 2, 3].map(i => ({ id: `p${i}`, name: `药水${i}`, type: '道具', rarity: '古朴' }));

const events = [
  { id:'ev19-quartermaster', name:'装备征用令', type:'事件', desc:'从三件装备选择一件' },
  { id:'tt6-demondeal', name:'隧道血契', type:'事件', desc:'交易或拒绝' },
];
async function openBoundEvent() {
  const pending = flow.runEventDeck();
  await vi.advanceTimersByTimeAsync(1000); await pending;
}

describe('事件卡足额生命代价', () => {
  it.each([1, 5, 6])('隧道血契从%s血足额扣5，致死不打开宝箱或覆盖终局状态', async hp => {
    H.cards = [events[1]];
    H.game.hp = hp;
    const open = vi.spyOn(window.SDT.Chests, 'open').mockImplementation(() => { H.game.state = 'modal'; });
    await openBoundEvent();
    UI._acts.evtChoice({ i:'0' });
    expect(H.game.damage).toHaveBeenCalledTimes(1);
    expect(H.game.damage).toHaveBeenCalledWith(5, '隧道血契');
    expect(H.game.hp).toBe(hp - 5);
    if (hp <= 5) {
      expect(open).not.toHaveBeenCalled();
      expect(H.game.terminalPending).toMatchObject({ kind:'death', endReason:'隧道血契' });
      expect(H.game.state).toBe('terminalPending');
      expect(H.saves.every(save => save.hp > 0)).toBe(true);
    } else {
      expect(open).toHaveBeenCalledTimes(1);
      expect(H.game.state).toBe('modal');
      expect(H.game.terminalPending).toBeUndefined();
    }
    UI._acts.evtChoice?.({ i:'0' });
    expect(H.game.damage).toHaveBeenCalledTimes(1);
  });

  it.each([1, 3, 4])('塌方采掘点从%s血足额扣3，不能由收尾复活', async hp => {
    H.cards = [{ id:'tt6-goldmine', name:'塌方采掘点', type:'事件', desc:'获得6币并损失3点生命' }];
    H.game.hp = hp;
    H.narrative = async () => ({ intro:'矿洞', choices:[
      { label:'稳妥', effect:'goldmine_safe', choose:() => '' },
      { label:'深挖', effect:'goldmine_deep', choose:() => '' },
    ] });
    await openBoundEvent();
    UI._acts.evtChoice({ i:'1' });
    expect(H.game.damage).toHaveBeenCalledTimes(1);
    expect(H.game.damage).toHaveBeenCalledWith(3, '塌方采掘点');
    expect(H.game.hp).toBe(hp - 3);
    expect(H.game.coins).toBe(24);
    if (hp <= 3) {
      expect(H.game.terminalPending).toMatchObject({ kind:'death', endReason:'塌方采掘点' });
      expect(H.game.state).toBe('terminalPending');
      expect(H.saves.every(save => save.hp > 0)).toBe(true);
    } else {
      expect(H.game.state).toBe('idle');
      expect(H.game.terminalPending).toBeUndefined();
    }
    UI._acts.evtChoice?.({ i:'1' });
    expect(H.game.damage).toHaveBeenCalledTimes(1);
  });
});

describe('未知节点首次事件绑定', () => {
  it('第一次仍按原卡池抽一次，未选一级动作退出重进不重抽、不消费节点', async () => {
    H.cards = events;
    H.pick = vi.fn(deck => deck.find(c => c.id === 'ev19-quartermaster'));
    await openBoundEvent();
    expect(H.pick.mock.calls[0][0]).toEqual(events);
    expect(H.game.nodeRewards['0,1']).toEqual({ version:1, type:'event', eventId:'ev19-quartermaster' });
    expect(H.saves.at(-1).nodeRewards['0,1'].eventId).toBe('ev19-quartermaster');
    UI._acts.eventExit(); await vi.advanceTimersByTimeAsync(400);
    H.pick.mockClear().mockImplementation(deck => deck.at(-1));
    expect(flow.reenterCell()).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(UI.el.ovBody.textContent).toContain('装备征用令');
    expect(UI.el.ovBody.textContent).not.toContain('隧道血契');
    expect(H.pick).not.toHaveBeenCalled();
    expect(H.game.visited).toEqual({});
    expect(H.game.coins).toBe(18);
  });

  it('正常JSON刷新重建后同位置仍恢复原事件，不从旧历史日志猜节点', async () => {
    H.cards = events;
    H.game.eventLog = [{ name:'隧道血契', desc:'其他节点历史', turn:0 }];
    H.pick = vi.fn(deck => deck[0]);
    await openBoundEvent(); UI._acts.eventExit();
    const snapshot = JSON.parse(JSON.stringify(H.saves.at(-1)));
    const mapSeed = H.game.mapSeed = 'binding-map-seed';
    snapshot.mapSeed = mapSeed;
    Object.assign(H.game, snapshot, { discoveredPairs:new Set() });
    H.cards = [...events].reverse(); H.pick = vi.fn(deck => deck[0]);
    await openBoundEvent();
    expect(UI.el.ovBody.textContent).toContain('装备征用令');
    expect(H.pick).not.toHaveBeenCalled();
    expect(H.game.mapSeed).toBe(mapSeed);
    const { validateRunSave } = await import('../game/src/hub/run-save-validation.js');
    expect(validateRunSave(snapshot).ok).toBe(true);
  });

  it('旧档没有节点记录时首次补建，其他节点各自抽一次互不覆盖', async () => {
    H.cards = events;
    H.game.eventLog = [{ name:'装备征用令', turn:1 }];
    H.pick = vi.fn(deck => deck[1]);
    await openBoundEvent(); UI._acts.eventExit();
    expect(H.game.nodeRewards['0,1'].eventId).toBe('tt6-demondeal');
    H.game.trackPos = 2;
    H.game.layerData[0].logical.push({ def:{ type:'event' } });
    H.pick.mockImplementation(deck => deck[0]);
    await openBoundEvent();
    expect(H.game.nodeRewards['0,1'].eventId).toBe('tt6-demondeal');
    expect(H.game.nodeRewards['0,2'].eventId).toBe('ev19-quartermaster');
    expect(H.pick).toHaveBeenCalledTimes(2);
  });

  it('已绑定但卡库移除的事件保持ID，明确返回地图且不软锁或静默重抽', async () => {
    H.game.nodeRewards = { '0,1':{ version:1, type:'event', eventId:'removed-event' } };
    H.cards = events; H.pick = vi.fn(deck => deck[0]);
    await openBoundEvent();
    expect(UI.el.ovBody.textContent).toContain('此处事件暂不可用');
    expect(H.pick).not.toHaveBeenCalled();
    UI.el.ovBody.querySelector('[data-act="eventUnavailableLeave"]').click();
    await vi.advanceTimersByTimeAsync(400);
    expect(H.game.state).toBe('idle'); expect(UI.el.overlay.hidden).toBe(true);
    expect(H.game.visited).toEqual({});
    expect(H.game.nodeRewards['0,1'].eventId).toBe('removed-event');
    H.cards = []; await openBoundEvent();
    expect(UI.el.ovBody.textContent).toContain('此处事件暂不可用');
    UI._acts.eventExit();
    expect(H.game.state).toBe('idle');
  });

  it('药摊/征用从绑定事件升级为固定候选，付款后再开事件入口不重扣或重抽', async () => {
    H.cards = [events[0], ...potionCards.map(c => ({ ...c, type:'装备' }))];
    await openBoundEvent(); UI._acts.evtChoice({ i:'0' }); rollEventDice(UI);
    const pending = JSON.parse(JSON.stringify(H.game.nodeRewards['0,1']));
    expect(pending.type).toBe('event-choice');
    expect(pending.eventId).toBe('ev19-quartermaster');
    expect(H.game.coins).toBe(15);
    UI._acts.eventExit();
    H.pick = vi.fn(deck => deck[0]);
    await flow.runEventDeck();
    expect(H.game.nodeRewards['0,1']).toEqual(pending);
    expect(H.game.coins).toBe(15); expect(H.pick).not.toHaveBeenCalled();
  });

  it('已完成事件仍按visited禁重复触发，非法绑定结构拒绝存档', async () => {
    H.cards = events; H.pick = vi.fn(deck => deck[1]);
    await openBoundEvent(); UI._acts.evtChoice({ i:'1' });
    expect(H.game.visited).toEqual({ '0,1':1 });
    H.pick.mockClear(); flow.reenterCell();
    expect(H.pick).not.toHaveBeenCalled();
    expect(H.game.coins).toBe(18);
    const { validateRunSave } = await import('../game/src/hub/run-save-validation.js');
    expect(validateRunSave({ nodeRewards:{ '0,1':{ version:1, type:'event', eventId:'' } } })).toMatchObject({ ok:false, preserveRun:true });
    expect(validateRunSave({ hp:20 }).ok).toBe(true);
  });
});

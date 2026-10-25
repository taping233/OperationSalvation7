import { altarMocks, altarStateFields } from './helpers/environment-fixtures.js';
/* SYS-03 物资事务审计（2026-10-03 老板 SYS-03）：祭坛献祭两分支、消耗区复原、
 * 钥匙复原链与火堆自动复原（只验证不改行为）的事务顺序钉现状。
 * 审计结论：五拍齐全、无「已领/未领搞混」缺陷——
 *   献祭道具：确认才上锁 altarItemSacrificed（随存档持久化）、取消不上锁卡不丢；
 *   弃 3 激活：卡不足 3 张拒开选卡器；确认后 markActivated+visited+saveGame；
 *   碎片兑换：先发卡后扣 2 碎片（满包拒收不扣碎片，2026-09-10 留言 #30/#532 注释口径）；
 *   奖励二选一：离开保留选择；传说+装备选择后冻结到持久化领奖页，容量失败保留；
 *   复原页 restoreOne：left 校验+满包拒绝（卡留口袋）；战地整备的复原分支 picks=1，复原 1 张自动收尾；
 *   火堆（10-02 玩法批改「发现两张自动复原」，本包不动行为）：满包先检后扣口袋、
 *   consumeCurrentCell 收格、saveGame 落盘；
 *   钥匙复原（base.restore）：钥匙不足 nokey 拒绝、仓库满 full 拒绝、mutate 事务内扣钥匙入仓。
 * mock 配方沿用 tests/extraction-flow.test.js，但 game.run.scenes.js 不 mock（走真实现，
 * 复原页/献祭确认链路端到端可达）。 */
import { beforeEach, expect, it, vi } from 'vitest';

const st = vi.hoisted(() => ({
  game: {},
  saves: [],
  consumed: 0,
  curLayer: { logical: [{ def: { type: 'altar' } }] },
  bagCapN: 10,
}));

vi.mock('../game/src/run/game.session.js', () => ({
  MAP: { rules: { fireHeal: 10, fireClassCardChance: 0 } },
  MODES: {},
  bagCap: () => st.bagCapN,
  curLayer: () => st.curLayer,
  enterLayer: vi.fn(), exitToTitle: vi.fn(),
  game: st.game,
  getActiveSlot: () => null,
  newUid: (() => { let n = 0; return () => 'uid-' + (n++); })(),
  saveGame: (...args) => { st.saves.push(args); },
  scaledEnemy: x => x,
  pick: xs => xs[0],
  usedSlots: () => st.game.ownedCards.length,
}));
vi.mock('../game/src/core/characters.js', () => ({ CHARACTERS: [], characterFor: () => null, characterName: () => '' }));
vi.mock('../game/src/hub/game.hub.js', () => ({ openBaseHub: vi.fn() }));
vi.mock('../game/src/hub/game.cardslib.js', () => ({ Sfx: { tick: vi.fn(), ding: vi.fn() }, _set_cardPageOpen: vi.fn(), cardHTML: c => c.name }));
vi.mock('../game/src/battle/battle-loader.js', () => ({ captureBattleContext: () => () => true, ensureBattleReady: vi.fn(), startBattle: vi.fn() }));
vi.mock('../game/src/run/game.run.data.js', () => ({
  IMMEDIATE_SCENES: {}, NODE_BG: { fire: 'scene-fire-bg', altar: 'scene-altar-bg', event: 'scene-event' },
  PICKUP_BG: {}, PRELOAD_SCENES: [], SCENES: { coin:{ icon:'', title:'硬币', lines:['风雪里的零钱'] } },
}));
vi.mock('../game/src/run/game.nest.js', () => ({ unlockNest: vi.fn() }));
vi.mock('../game/src/hub/game.storage.js', () => ({ RunStorage: {} }));
vi.mock('../game/src/hub/recovery.commands.js', () => ({ commitBaseAndRun: vi.fn(), readSettlementReceipt: vi.fn(), recoverSlot: vi.fn() }));

let UI, acts;
function makeGame() {
  return {
    state: 'idle', layerIdx: 0, trackPos: 0, turn: 1, mode: 'normal', myClass: 'wu',
    hp: 20, maxHp: 30, ...altarStateFields(),
    heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); },
    bagCap: () => st.bagCapN,
    usedSlots() { return this.ownedCards.length; },
    canReceiveCard(card) {
      if (this.__canReceive) return this.__canReceive(card);
      // 简化口径：新卡名需空格，本测试用 ownedCards.length 直接控满包；同名并入恒可收
      const owned = this.ownedCards.filter(o => o.card.name === card.name).length;
      return owned > 0 ? true : this.ownedCards.length < this.bagCap();
    },
  };
}

beforeEach(async () => {
  vi.resetModules();
  document.body.innerHTML = '<div id="body"></div>';
  // mock 工厂在首次执行时捕获 st.game 引用且 resetModules 不重跑工厂——
  // 必须原地 Object.assign 复用同一对象（extraction-flow.test.js 同款），不得换新实例
  Object.assign(st.game, makeGame());
  st.saves = [];
  st.curLayer = { logical: [{ def: { type: 'altar' } }] };
  st.bagCapN = 10;
  acts = {};
  UI = {
    el: { ovBody:document.getElementById('body') },
    showOverlay: (_t, html) => { document.getElementById('body').innerHTML = html; },
    hideOverlay: () => { document.getElementById('body').innerHTML = ''; },
    act: (name, fn) => { acts[name] = fn; },
    refresh: vi.fn(), log: vi.fn(), registerHelp: vi.fn(), helpBtn: () => '',
    showCardReward: vi.fn(), showCardZoom:vi.fn(),
  };
  window.SDT = {
    UI,
    ...altarMocks(st, () => vi),
  };
});

async function importAltar() {
  const scenes = await import('../game/src/run/game.run.scenes.js');
  st.game.grantCard = scenes.grantEventCard;
  await import('../game/src/run/chests.js');
  const altar = await import('../game/src/run/game.run.altar.js');
  return altar;
}
const owned = (uid, extras = {}, type = '法术') => ({ uid, card:{ id:uid, name:uid, type }, ...extras });
const ordinary = () => [0,1,2].map(i => owned(`bag-${i}`));

it('祭坛只列普通随身背包，安全格/珍珠盒/锦囊候选不可伪选；重复确认只扣三张', async () => {
  const protectedCards = [owned('safe', { safe:true }), owned('stored', { stored:1 }), owned('pouch', { pouchOf:'pouch' })];
  st.game.ownedCards = [...ordinary(), ...protectedCards];
  const { openAltarRitual } = await importAltar(); openAltarRitual(); acts.altarOn3();
  expect([...document.querySelectorAll('[data-act="sacPick"]')].map(el => el.dataset.uid)).toEqual(['bag-0','bag-1','bag-2']);
  expect(document.body.textContent).toContain('需先移回背包');
  for (const card of protectedCards) acts.sacPick({ uid:card.uid });
  expect(document.querySelectorAll('.sac-card.sel')).toHaveLength(0);
  for (const uid of ['bag-0','bag-1','bag-2']) acts.sacPick({ uid });
  const confirm = acts.sacConfirm; confirm(); confirm();
  expect(st.game.ownedCards).toEqual(protectedCards);
  expect(st.game.altarActivated).toBe(true);
  expect(st.game.altarRewardPending).toBe(true);
});

it.each(['safe', 'stored', 'pouchOf'])('已选卡在确认前跨到%s区，确认必须拒绝且重绘移除选择', async flag => {
  st.game.ownedCards = ordinary();
  const { openAltarRitual } = await importAltar(); openAltarRitual(); acts.altarOn3();
  for (const uid of ['bag-0','bag-1','bag-2']) acts.sacPick({ uid });
  const oldConfirm = acts.sacConfirm;
  st.game.ownedCards[0][flag] = flag === 'pouchOf' ? 'pouch' : 1;
  oldConfirm(); oldConfirm();
  expect(st.game.ownedCards).toHaveLength(3);
  expect(st.game.altarActivated).toBeFalsy();
  expect(document.querySelector('[data-uid="bag-0"]')).toBeNull();
  expect(document.querySelectorAll('.sac-card.sel')).toHaveLength(2);
  expect(document.querySelector('[data-act="sacConfirm"]').disabled).toBe(true);
});

it('选卡后跨区再点击旧候选不得加入；主动移回背包后重进可正常献祭', async () => {
  st.game.ownedCards = ordinary();
  const { openAltarRitual } = await importAltar(); openAltarRitual(); acts.altarOn3();
  const pick = acts.sacPick;
  st.game.ownedCards[0].safe = true;
  pick({ uid:'bag-0' });
  expect(document.querySelectorAll('.sac-card.sel')).toHaveLength(0);
  acts.sacCancel(); delete st.game.ownedCards[0].safe;
  acts.altarOn3();
  for (const uid of ['bag-0','bag-1','bag-2']) acts.sacPick({ uid });
  acts.sacConfirm();
  expect(st.game.ownedCards).toHaveLength(0);
  expect(st.game.altarActivated).toBe(true);
});

it('道具献祭同时按类型和位置筛选，安全/储藏道具与普通非道具均不列入', async () => {
  const protectedItems = [owned('safe-item', { safe:1 }, '道具'), owned('stored-item', { stored:1 }, '道具')];
  const spell = owned('spell');
  st.game.ownedCards = [owned('bag-item', {}, '道具'), spell, ...protectedItems];
  st.game.usedPocket = [{ card:{ id:'used', name:'已用招式', type:'武术' }, count:2 }];
  const { openAltarRitual } = await importAltar(); openAltarRitual(); acts.altarItemRestore();
  expect([...document.querySelectorAll('[data-act="sacPick"]')].map(el => el.dataset.uid)).toEqual(['bag-item']);
  const hand = document.querySelector('.sac-hand'), candidate = document.querySelector('[data-act="sacPick"]');
  acts.sacPick({ uid:'bag-item' });
  expect(document.querySelector('.sac-hand')).toBe(hand);
  expect(document.querySelector('[data-act="sacPick"]')).toBe(candidate);
  expect(candidate.getAttribute('aria-pressed')).toBe('true');
  expect(st.game.ownedCards).toHaveLength(4);
  const currentConfirm = acts.sacConfirm; currentConfirm(); currentConfirm();
  expect(st.game.ownedCards).toEqual([spell, ...protectedItems]);
  expect(st.game.altarItemSacrificed).toBe(true);
  expect(document.querySelector('[data-act="restoreOne"]')).not.toBeNull();
});

it('道具选择后改变类型，确认时再核验而不扣非道具或设置已献祭标记', async () => {
  st.game.ownedCards = [owned('bag-item', {}, '道具')];
  st.game.usedPocket = [{ card:{ id:'used', name:'已用招式', type:'武术' }, count:1 }];
  const { openAltarRitual } = await importAltar(); openAltarRitual(); acts.altarItemRestore(); acts.sacPick({ uid:'bag-item' });
  st.game.ownedCards[0].card.type = '法术'; acts.sacConfirm();
  expect(st.game.ownedCards).toHaveLength(1);
  expect(st.game.altarItemSacrificed).toBeFalsy();
  expect(document.querySelectorAll('[data-act="sacPick"]')).toHaveLength(0);
});

it('只有受保护道具时预检不开放道具献祭；普通背包不足三张也不能靠安全格凑数', async () => {
  st.game.ownedCards = [owned('bag-0'), owned('bag-1'), owned('safe-item', { safe:true }, '道具'), owned('stored-item', { stored:true }, '道具')];
  st.game.usedPocket = [{ card:{ id:'used', name:'已用招式', type:'武术' }, count:1 }];
  const { openAltarRitual } = await importAltar(); openAltarRitual();
  expect(document.querySelector('[data-act="altarItemRestore"]')).toBeNull();
  acts.altarItemRestore(); acts.altarOn3();
  expect(document.querySelector('[data-act="sacConfirm"]')).toBeNull();
  expect(st.game.ownedCards).toHaveLength(4);
  expect(st.game.altarActivated).toBeFalsy();
});

it('取消后旧选择/确认回调不能删卡，换成同槽新局也不能献祭新局卡', async () => {
  st.game.ownedCards = ordinary();
  const { openAltarRitual } = await importAltar(); openAltarRitual(); acts.altarOn3();
  acts.sacPick({ uid:'bag-0' });
  const pick = acts.sacPick, confirm = acts.sacConfirm;
  acts.sacCancel(); pick({ uid:'bag-1' }); confirm();
  expect(st.game.ownedCards).toHaveLength(3);
  expect(st.game.altarActivated).toBeFalsy();
  acts.altarOn3();
  for (const uid of ['bag-0','bag-1','bag-2']) acts.sacPick({ uid });
  const old = acts.sacConfirm;
  st.game.discoveredPairs = new Set(); st.game.ownedCards = ordinary(); old();
  expect(st.game.ownedCards).toHaveLength(3);
  expect(st.game.altarActivated).toBeFalsy();
});

it('第三层紧急撤离预检沿用普通背包计数，受保护卡不增加可支付张数', async () => {
  st.game.ownedCards = [owned('bag-0'), owned('bag-1'), owned('safe', { safe:true }), owned('stored', { stored:1 })];
  st.game.layerIdx = 2; st.curLayer = { logical:[{ def:{ type:'emergencyExit' } }] };
  const { openEmergencyModal } = await importAltar(); openEmergencyModal();
  expect(document.querySelector('[data-act="payExit"]').disabled).toBe(true);
  expect(document.body.textContent).toContain('现有 2/3');
  acts.payExit();
  expect(document.querySelector('[data-act="sacConfirm"]')).toBeNull();
  expect(st.game.ownedCards).toHaveLength(4);
});

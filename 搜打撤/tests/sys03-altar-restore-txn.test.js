/* SYS-03 物资事务审计（2026-10-03 老板 SYS-03）：祭坛献祭两分支、消耗区复原、
 * 钥匙复原链与火堆自动复原（只验证不改行为）的事务顺序钉现状。
 * 审计结论：五拍齐全、无「已领/未领搞混」缺陷——
 *   献祭道具：确认才上锁 altarItemSacrificed（随存档持久化）、取消不上锁卡不丢；
 *   弃 3 激活：卡不足 3 张拒开选卡器；确认后 markActivated+visited+saveGame；
 *   碎片兑换：先发卡后扣 2 碎片（满包拒收不扣碎片，2026-09-10 留言 #30/#532 注释口径）；
 *   奖励二选一：离开保留选择；传说+装备选择后冻结到持久化领奖页，容量失败保留；
 *   复原页 restoreOne：left 校验+满包拒绝（卡留口袋）；修鞋铺 picks=1 复原 1 张自动收尾；
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
    hp: 20, maxHp: 30, coins: 0, fragments: 0, visited: {},
    ownedCards: [], usedPocket: [], inventory: [],
    // 祭坛/火堆运行期标记：原地 assign 复用同一 game 对象时必须显式复位，
    // 否则上一用例的激活/上锁状态会泄漏到下一用例
    altarActivated: undefined, altarItemSacrificed: undefined, altarRewardPending: undefined,
    bossKilled: false, _fireRestKey: undefined, nodeRewards: {},
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
    Sound: { sfx: vi.fn(), scene: vi.fn() },
    Icons: { rich: x => x },
    Meta: { addXpToProgress: x => ({ after: x }), track: vi.fn() },
    Cards: {
      all: () => [
        { id: 'lg1', name: '传说甲', rarity: '传说', type: '法术' },
        { id: 'eq1', name: '装备甲', rarity: '史诗', type: '装备' },
      ],
      classPool: () => [{ id: 'ab1', name: '能力甲', rarity: '职业', type: '能力卡' }],
      isRandomObtainable: () => true,
      randomClassCard: () => null,
      cardHTML: c => c.name,
      sellPrice: () => 1,
    },
    MAP: { chestKinds:{ small:{ name:'小宝箱' } } },
    Base: { isSha: () => false, bagCap:() => st.bagCapN },
    Motion: undefined,
  };
});

async function importAltar() {
  const scenes = await import('../game/src/run/game.run.scenes.js');
  st.game.grantCard = scenes.grantEventCard;
  await import('../game/src/run/chests.js');
  const altar = await import('../game/src/run/game.run.altar.js');
  return altar;
}
async function importScenes() {
  return import('../game/src/run/game.run.scenes.js');
}

/* ---------- 献祭道具：确认上锁 / 取消不上锁 ---------- */

it('献祭道具：确认后上锁+道具移除+复原页打开，复原 min(2, 可复原数) 张后回流祭坛', async () => {
  const game = st.game;
  game.ownedCards.push({ uid: 'item-1', card: { id: 'p1', name: '药水瓶', type: '道具' } });
  game.usedPocket.push(
    { card: { id: 'a', name: '消耗甲', type: '法术' }, count: 1 },
    { card: { id: 'b', name: '消耗乙', type: '武术' }, count: 1 },
    { card: { id: 'c', name: '消耗丙', type: '装备' }, count: 1 },   // 装备不可复原
  );
  const { openAltarRitual } = await importAltar();
  openAltarRitual(st.curLayer.logical[0].def);
  expect(acts.altarItemRestore).toBeTypeOf('function');
  acts.altarItemRestore();
  expect(document.querySelector('[data-act="sacConfirm"]')).not.toBeNull();
  expect(document.querySelector('[data-act="sacPick"]')?.tagName).toBe('BUTTON');
  expect(document.querySelector('[data-act="sacPick"]').getAttribute('aria-pressed')).toBe('false');
  acts.sacPick({ uid: 'item-1' });
  expect(document.querySelector('[data-act="sacPick"]').getAttribute('aria-pressed')).toBe('true');
  expect(document.activeElement).toBe(document.querySelector('[data-act="sacPick"]'));
  acts.sacConfirm();
  expect(game.altarItemSacrificed).toBe(true);          // 确认才上锁
  expect(game.ownedCards.some(o => o.uid === 'item-1')).toBe(false);   // 道具已献
  const savesAtConfirm = st.saves.length;
  expect(savesAtConfirm).toBeGreaterThan(0);
  // 复原页：可复原=消耗甲/消耗乙（装备被滤掉），picks=min(2,2)=2
  expect(document.querySelector('[data-act="restoreOne"]')).not.toBeNull();
  acts.restoreOne({ name: '消耗甲' });
  expect(game.usedPocket.some(p => p.card.name === '消耗甲')).toBe(false);
  expect(game.ownedCards.some(o => o.card.name === '消耗甲')).toBe(true);
  acts.restoreOne({ name: '消耗乙' });
  expect(game.ownedCards.some(o => o.card.name === '消耗乙')).toBe(true);
  // left=0 自动收尾 → done 回调重开祭坛主面板（未激活 → 弃3 选项仍在）
  expect(document.querySelector('[data-act="altarOn3"]')).not.toBeNull();
});

it('献祭道具：取消分支不上锁、道具不丢，回流祭坛面板', async () => {
  const game = st.game;
  game.ownedCards.push({ uid: 'item-1', card: { id: 'p1', name: '药水瓶', type: '道具' } });
  game.usedPocket.push({ card: { id: 'a', name: '消耗甲', type: '法术' }, count: 1 });
  const { openAltarRitual } = await importAltar();
  openAltarRitual(st.curLayer.logical[0].def);
  acts.altarItemRestore();
  acts.sacPick({ uid: 'item-1' });
  acts.sacCancel();
  expect(game.altarItemSacrificed).toBeFalsy();   // 取消献祭不上锁（注释口径）
  expect(game.ownedCards.some(o => o.uid === 'item-1')).toBe(true);   // 卡未消耗
  expect(game.usedPocket.some(p => p.card.name === '消耗甲')).toBe(true);
  expect(document.querySelector('[data-act="altarOn3"]')).not.toBeNull();   // 回到祭坛
});

it('献祭道具：锁定后重复触发只播报不再开选卡器', async () => {
  const game = st.game;
  game.altarItemSacrificed = true;
  game.ownedCards.push({ uid: 'item-1', card: { id: 'p1', name: '药水瓶', type: '道具' } });
  const { openAltarRitual } = await importAltar();
  openAltarRitual(st.curLayer.logical[0].def);
  acts.altarItemRestore();
  expect(document.querySelector('[data-act="sacConfirm"]')).toBeNull();
  expect(UI.log.mock.calls.some(c => String(c[0]).includes('已经受理'))).toBe(true);
});

/* ---------- 弃 3 激活与奖励二选一 ---------- */

it('弃 3 激活：卡不足 3 张拒开选卡器；满 3 张确认后激活+消耗本格+进奖励面板', async () => {
  const game = st.game;
  game.ownedCards.push(
    { uid: '0', card: { name: '卡0', type: '法术' } },
    { uid: '1', card: { name: '卡1', type: '法术' } },
  );
  const { openAltarRitual } = await importAltar();
  openAltarRitual(st.curLayer.logical[0].def);
  acts.altarOn3();
  expect(document.querySelector('[data-act="sacConfirm"]')).toBeNull();   // 拒开选卡器
  expect(UI.log.mock.calls.some(c => String(c[0]).includes('不足 3 张'))).toBe(true);

  game.ownedCards.push({ uid: '2', card: { name: '卡2', type: '法术' } });
  acts.altarOn3();
  ['0', '1', '2'].forEach(uid => acts.sacPick({ uid }));
  acts.sacConfirm();
  expect(game.altarActivated).toBe(true);
  expect(game.visited['0,0']).toBe(1);   // 激活成功才消耗本格
  expect(game.ownedCards).toHaveLength(0);
  expect(game.altarRewardPending).toBe(true);   // 奖励待领
  expect(document.querySelector('[data-act="altarRewardLoot"]')).not.toBeNull();

  // 离开保留标记 → 重进直接回奖励面板（不重复弃 3、不重复激活）
  acts.altarRewardLeave();
  openAltarRitual(st.curLayer.logical[0].def);
  expect(document.querySelector('[data-act="altarRewardLoot"]')).not.toBeNull();
  expect(document.querySelector('[data-act="altarOn3"]')).toBeNull();
});

it('奖励② 传说+装备：满包时两张保留，整理后领取一次并可继续探索', async () => {
  const game = st.game;
  game.altarActivated = true;
  game.altarRewardPending = true;
  game.bagCapN = 0;
  st.bagCapN = 0;   // 满包（usedSlots 0 < 0 为假 → canReceiveCard false）
  const { openAltarRitual } = await importAltar();
  openAltarRitual(st.curLayer.logical[0].def);   // 激活+待领 → 直接进奖励面板
  acts.altarRewardLoot();
  expect(game.ownedCards).toHaveLength(0);
  expect(game.altarRewardPending).toBe(false);   // 固定奖励已交由持久化领奖页接管
  acts.chestTake();
  expect(window.SDT.Chests.serialize(game).current).toMatchObject({ taken:[], lost:[] });
  expect(document.body.textContent).toContain('放不下的保留');
  st.bagCapN = 10;
  window.SDT.Chests.resume();
  const take = acts.chestTake;
  take(); take();
  expect(game.ownedCards.map(o => o.card.id)).toEqual(['lg1', 'eq1']);
  expect(document.body.textContent).toContain('2 张已入背包');
  acts.chestContinue();
  expect(game.state).toBe('idle');
  expect(window.SDT.Chests.isOpen()).toBe(false);
});

/* ---------- 碎片兑换：先发卡后扣碎片 ---------- */

it('碎片兑换：满包拒收不扣 2 碎片不上锁；有格时发卡+扣碎片+激活', async () => {
  const game = st.game;
  game.fragments = 2;
  game.bagCapN = 0;
  st.bagCapN = 0;
  const { openAltarRitual } = await importAltar();
  openAltarRitual(st.curLayer.logical[0].def);
  acts.altarFragHero();
  expect(game.fragments).toBe(2);            // 发卡被拒 → 不白扣碎片（532 行注释口径）
  expect(game.altarActivated).toBeFalsy();
  expect(game.ownedCards).toHaveLength(0);

  st.bagCapN = 10;
  acts.altarFragHero();
  expect(game.ownedCards.map(o => o.card.name)).toEqual(['能力甲']);
  expect(game.fragments).toBe(0);
  expect(game.altarActivated).toBe(true);
});

/* ---------- 紧急撤离：卡不足 3 张的拒绝（取消/确认两分支已有 extraction-flow 钉住） ---------- */

it('紧急撤离：卡不足 3 张时 payExit 直调被拒、不开选卡器、卡不变', async () => {
  const game = st.game;
  st.curLayer = { logical: [{ def: { type: 'emergencyExit' } }] };
  game.layerIdx = 2;
  game.ownedCards.push({ uid: '0', card: { name: '卡0' } }, { uid: '1', card: { name: '卡1' } });
  const { openEmergencyModal } = await importAltar();
  openEmergencyModal();
  const savesBefore = st.saves.length;
  acts.payExit();
  expect(document.querySelector('[data-act="sacConfirm"]')).toBeNull();
  expect(game.ownedCards).toHaveLength(2);
  expect(st.saves.length).toBe(savesBefore);
});

/* ---------- 复原页（修鞋铺 cmtn7qttxqo4 共用链 openPocketRestore） ---------- */

it('复原页：picks=1（修鞋铺口径）复原 1 张自动收尾；未复原直接离开也收尾', async () => {
  const game = st.game;
  game.usedPocket.push({ card: { id: 'a', name: '消耗甲', type: '法术' }, count: 2 });
  const { openPocketRestore } = await importScenes();
  let done = 0;
  openPocketRestore(1, () => { done++; });
  acts.restoreOne({ name: '消耗甲' });
  expect(done).toBe(1);   // left=0 自动 finish，不重复收尾
  expect(game.usedPocket[0].count).toBe(1);   // 同名堆只扣 1 张
  expect(game.ownedCards).toHaveLength(1);

  done = 0;
  openPocketRestore(1, () => { done++; });
  acts.fireDone();   // 不复原直接「继续旅程」：幂等收尾，口袋不动
  expect(done).toBe(1);
  expect(game.usedPocket[0].count).toBe(1);
  expect(game.ownedCards).toHaveLength(1);
});

it('复原页：满包拒绝——口袋不动、卡不进包、可继续点收尾', async () => {
  const game = st.game;
  game.ownedCards.push({ uid: 'x', card: { name: '占格卡', type: '法术' } });
  st.bagCapN = 1;   // 已占满
  game.usedPocket.push({ card: { id: 'a', name: '消耗甲', type: '法术' }, count: 1 });
  const { openPocketRestore } = await importScenes();
  let done = 0;
  openPocketRestore(2, () => { done++; });
  acts.restoreOne({ name: '消耗甲' });
  expect(game.usedPocket.some(p => p.card.name === '消耗甲')).toBe(true);   // 留在口袋
  expect(game.ownedCards).toHaveLength(1);
  acts.fireDone();
  expect(done).toBe(1);
});

/* ---------- 火堆自动复原（2026-10-02 玩法批改后行为，只验证不动） ---------- */

it('火堆：确认才回血复原，结算落盘且重入不重复；继续才回图', async () => {
  const game = st.game;
  game.usedPocket.push(
    { card: { id: 'a', name: '消耗甲', type: '法术' }, count: 1 },
    { card: { id: 'b', name: '消耗乙', type: '装备' }, count: 1 },   // 不可复原，不计入
  );
  const { openFireRest } = await importAltar();
  openFireRest();
  expect(game.hp).toBe(20);
  expect(game.visited['0,0']).toBeUndefined();
  const rest = acts.fireRestGo;
  rest(); rest();
  expect(game.hp).toBe(30);   // heal 10 封顶
  expect(game.ownedCards.map(o => o.card.name)).toEqual(['消耗甲']);   // 只有可复原的那张
  expect(game.usedPocket).toHaveLength(1);   // 装备堆仍在
  expect(game.visited['0,0']).toBe(1);   // consumeCurrentCell 消耗本格
  expect(game.state).toBe('modal');
  expect(st.saves.length).toBeGreaterThan(0);
  expect(UI.log.mock.calls.some(c => String(c[0]).includes('复原 1 张'))).toBe(true);
  const result = JSON.parse(JSON.stringify(game.nodeRewards));
  openFireRest();
  expect(game.nodeRewards).toEqual(result);
  expect(game.hp).toBe(30);
  expect(game.ownedCards).toHaveLength(1);
  acts.fireDone();
  expect(game.state).toBe('idle');
});

it('火堆：满包时不扣口袋（先检后扣），deny 播报后照常收格', async () => {
  const game = st.game;
  st.bagCapN = 0;
  game.usedPocket.push({ card: { id: 'a', name: '消耗甲', type: '法术' }, count: 1 });
  const { openFireRest } = await importAltar();
  openFireRest();
  expect(document.body.textContent).toContain('当前可复原卡均放不下，将复原 0 张');
  expect(document.querySelector('[data-act="fireBag"]')).not.toBeNull();
  expect(st.game.visited).toEqual({});
  acts.fireRestGo();
  expect(game.usedPocket[0].count).toBe(1);   // 口袋未扣
  expect(game.ownedCards).toHaveLength(0);
  expect(window.SDT.Sound.sfx).toHaveBeenCalledWith('deny');
  expect(game.visited['0,0']).toBe(1);   // 照常消耗本格不卡流程
});

/* 钥匙复原链（base.restore + pocketKeyCost）拆至 sys03-base-key-restore.test.js：
 * 本文件的 vi.mock game.storage 与 base.js 的存档事务依赖冲突，须在无 mock 环境测。 */

it('A3文案：祭坛回赠复原保持祭坛身份，继续仍走原回调', async () => {
  st.game.altarActivated = true;
  st.game.altarRewardPending = true;
  st.game.usedPocket.push({ card: { id: 'a', name: '消耗甲', type: '法术' }, count: 1 });
  const { openAltarRitual } = await importAltar();
  openAltarRitual(st.curLayer.logical[0].def);
  await acts.altarRewardRestore();
  expect(document.querySelector('.pocket-restore .battle-decision-head h3').textContent).toContain('祭坛回赠 · 复原');
  expect(document.querySelector('.battle-decision.pocket-restore')).not.toBeNull();
  expect(st.game.altarRewardPending).toBe(false);
  expect(st.game.usedPocket[0].count).toBe(1);
  acts.fireDone();
  expect(st.game.state).toBe('idle');
  expect(st.saves.length).toBeGreaterThan(0);
});

it('A3文案：满包火堆准确报告容量，不能谎报没有可复原牌', async () => {
  st.bagCapN = 0;
  st.game.usedPocket.push({ card: { id: 'a', name: '消耗甲', type: '法术' }, count: 1 });
  const { openFireRest } = await importAltar();
  openFireRest();
  acts.fireRestGo();
  const messages = UI.log.mock.calls.map(c => String(c[0])).join('\n');
  expect(messages).toContain('背包已满');
  expect(messages).not.toContain('没有可复原的卡牌');
  expect(st.game.usedPocket[0].count).toBe(1);
  expect(st.game.ownedCards).toHaveLength(0);
  expect(st.game.visited['0,0']).toBe(1);
  expect(st.game.state).toBe('modal');
  acts.fireDone();
  expect(st.game.state).toBe('idle');
});

it('拾取页背包返回重注册仍只结算一次，旧回调不能领取或关闭新结果页', async () => {
  const { openPickupPage } = await importScenes();
  const { takeBagReturnHook } = await import('../game/src/hub/bag-return-hook.js');
  const receive = vi.fn(() => UI.showOverlay('', '<p id="next-page">下一个节点</p>'));
  openPickupPage('coin', '+1', receive, true);
  const old = acts.pickupGo;
  takeBagReturnHook()();
  old();
  expect(receive).not.toHaveBeenCalled();
  const current = acts.pickupGo;
  current(); current();
  expect(receive).toHaveBeenCalledTimes(1);
  expect(document.getElementById('next-page')).not.toBeNull();
});

it('火堆取消休整保留收益，再进入必须重新确认', async () => {
  const { openFireRest } = await importAltar();
  const done = vi.fn(() => { st.game.state = 'idle'; });
  openFireRest(done);
  const oldRest = acts.fireRestGo;
  acts.fireLeave();
  expect(st.game.hp).toBe(20);
  expect(st.game.nodeRewards).toEqual({});
  expect(done).toHaveBeenCalledWith(false);
  openFireRest(done);
  oldRest();
  expect(st.game.hp).toBe(20);
  acts.fireRestGo();
  expect(st.game.hp).toBe(30);
});

it('入城补给先阅读再逐张领取，刷新不重领，满包补给保留在实际入口', async () => {
  const game = st.game;
  game.entrySupply = { version:1, layerIdx:0, trackPos:0, cardIds:['lg1','eq1'], taken:[] };
  const { openEntrySupply } = await importAltar();
  expect(openEntrySupply()).toBe(true);
  expect(game.ownedCards).toHaveLength(0);
  expect(document.getElementById('body').textContent).toContain('领完全部补给');
  expect(document.getElementById('body').textContent).toContain('全部领取后才能继续探索');
  expect(document.getElementById('body').textContent).not.toContain('可领取最多');
  const reveal = acts.clsEntryReveal;
  reveal(); reveal();
  expect(game.ownedCards).toHaveLength(0);
  expect(document.querySelectorAll('.entry-supply-strips .reward-unit')).toHaveLength(2);
  expect(document.querySelector('.entry-supply-status b').textContent).toBe('0 / 2');
  expect(document.querySelector('.entry-supply-status').getAttribute('aria-live')).toBe('polite');
  expect(document.querySelector('[data-act="clsEntryContinue"]')).toBeNull();
  acts.clsEntryContinue();
  expect(game.state).toBe('modal');
  acts.clsEntryCard({ i:0 });
  expect(UI.showCardZoom.mock.lastCall[1].footer).toContain('entrySupplyTake');
  st.bagCapN = 0;
  acts.entrySupplyTake({ i:0 });
  expect(game.entrySupply.taken).toEqual([]);
  expect(document.querySelector('.reward-notice').textContent).toContain('仍保留在入口');
  expect(document.querySelector('.entry-supply-status b').textContent).toBe('0 / 2');
  st.bagCapN = 1;
  acts.entrySupplyTake({ i:0 });
  expect(game.entrySupply.taken).toEqual([0]);
  expect(document.querySelectorAll('.entry-supply-strips .reward-unit')).toHaveLength(1);
  expect(document.querySelector('.entry-supply-status b').textContent).toBe('1 / 2');
  expect(document.querySelector('.reward-notice').textContent).not.toContain('仍保留在入口');
  expect(document.querySelector('[data-act="clsEntryContinue"]')).toBeNull();
  acts.clsEntryContinue();
  expect(game.state).toBe('modal');
  expect(game.ownedCards[0].brought).toBe(1);
  expect(game.classCard.id).toBe('lg1');
  const oldTake = acts.entrySupplyTake;
  game.entrySupply = JSON.parse(JSON.stringify(game.entrySupply));
  openEntrySupply();
  oldTake({ i:1 });
  expect(game.ownedCards).toHaveLength(1);
  acts.entrySupplyTake({ i:0 });
  expect(game.ownedCards).toHaveLength(1);
  acts.entrySupplyTake({ i:1 });
  expect(game.entrySupply.taken).toEqual([0]);
  st.bagCapN = 2;
  acts.entrySupplyTake({ i:1 });
  expect(game.entrySupply.taken).toEqual([0,1]);
  expect(game.visited['0,0']).toBe(1);
  expect(game.ownedCards).toHaveLength(2);
  expect(document.querySelectorAll('.entry-supply-strips .reward-unit')).toHaveLength(0);
  expect(document.querySelector('.entry-supply-status b').textContent).toBe('2 / 2');
  expect(document.querySelector('[data-act="clsEntryContinue"]').textContent).toContain('继续探索');
  expect(document.querySelector('[data-act="entrySupplyTake"]')).toBeNull();
  acts.clsEntryContinue();
  expect(game.state).toBe('idle');
  expect(document.getElementById('body').textContent).toBe('');
});

it.each([0, 1])('入城补给仅有 %i 张时仍按实际总数显示并在全部收下后确认', async total => {
  st.game.entrySupply = { version:1, layerIdx:0, trackPos:0, cardIds:['lg1'].slice(0, total), taken:[] };
  const { openEntrySupply } = await importAltar();
  openEntrySupply();
  acts.clsEntryReveal();
  expect(document.querySelector('.entry-supply-status b').textContent).toBe(`0 / ${total}`);
  if (total) {
    expect(document.querySelector('[data-act="clsEntryContinue"]')).toBeNull();
    acts.entrySupplyTake({ i:0 });
  }
  expect(document.querySelector('.entry-supply-status b').textContent).toBe(`${total} / ${total}`);
  expect(document.querySelector('[data-act="clsEntryContinue"]')).not.toBeNull();
  expect(st.game.ownedCards).toHaveLength(total);
});

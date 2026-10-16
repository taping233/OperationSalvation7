import { continueChestRewards, openChestPicker } from './helpers/chest-actions.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ game:{}, actions:{}, random:null, payload:null, save:null, commands:null, module:null }));
vi.mock('../game/src/run/game.session.js', () => ({
  game:state.game, getActiveSlot:() => 1, createRunSavePayload:() => state.payload(), saveGame:() => state.save(),
  setBattleSettlementPending:vi.fn(), clearBattleSettlementPending:vi.fn(), doDeath:vi.fn(),
}));
vi.mock('../game/src/run/game.run.js', () => ({ showRunTransition:vi.fn(async () => true) }));
vi.mock('../game/src/core/event-bus.js', () => ({ on:vi.fn() }));
vi.mock('../game/src/core/random.js', () => ({ Random:{ random:(...args) => state.random(...args) } }));
vi.mock('../game/src/hub/game.bag.bridge.js', () => ({ bagSlots:{
  pocketAdd:vi.fn(),
  showBackpack:vi.fn(() => { window.SDT.Chests.suspend(); window.SDT.UI.showOverlay('背包', '<p>整理背包</p>'); }),
  closeBackpack:vi.fn(() => window.SDT.Chests.resume()),
} }));
vi.mock('../game/src/hub/battle-settlement.commands.js', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, createBattleSettlementCommands:options => {
    const commands = actual.createBattleSettlementCommands(options);
    state.commands = { ...commands, createAttempt:vi.fn(commands.createAttempt), commitAttempt:vi.fn(commands.commitAttempt) };
    return state.commands;
  } };
});

const legend = { id:'extra-legend', name:'固定额外传说', type:'装备', rarity:'传说', cost:0 };
const loot = { id:'ordinary-loot', name:'普通战利品', type:'法术', rarity:'古朴', cost:0 };
const runKey = 'sdt-save-v2-slot1';
let RunStorage, priorLocks;

beforeEach(async () => {
  vi.restoreAllMocks();
  vi.resetModules();
  localStorage.clear();
  priorLocks = Object.getOwnPropertyDescriptor(navigator, 'locks');
  Object.defineProperty(navigator, 'locks', { configurable:true, value:{ request:(_name, _options, action) => Promise.resolve(action()) } });
  document.body.innerHTML = '<div id="overlay"><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div>';
  state.actions = {};
  state.random = vi.fn(() => 0.5);
  window.SDT = {
    UI:{
      el:{ overlay:document.getElementById('overlay'), ovTitle:document.getElementById('ovTitle'), ovBody:document.getElementById('ovBody') },
      act:(name, action) => { state.actions[name] = action; }, log:vi.fn(), refresh:vi.fn(),
      showOverlay:vi.fn((title, html) => { const UI = window.SDT.UI; UI.el.overlay.hidden = false; UI.el.ovTitle.textContent = title; UI.el.ovBody.innerHTML = html; }),
      hideOverlay:vi.fn(() => { window.SDT.UI.el.overlay.hidden = true; }),
    },
    Icons:{ rich:html => html }, Sound:{ sfx:vi.fn() },
    MAP:{ rules:{ bagSize:16, bagMax:16 }, chestKinds:{ small:{ name:'小宝箱', cards:1, coins:[1,1] } } },
    Cards:{ SHA:{ id:'starter-attack' }, all:() => [legend], isRandomObtainable:() => true,
      RARITIES:['古朴','稀有','史诗','传说'], randomDropCard:vi.fn(() => loot), rarityOf:card => card.rarity,
      cardHTML:card => `<div>${card.name}</div>`, sellPrice:() => 1 },
    Battle:{ presentVictory:vi.fn(async () => true) },
    Meta:{ track:vi.fn(), xpMultiplier:() => 1, publishBattleProgress:vi.fn() },
  };
  const { overlayMethods } = await import('../game/src/ui/overlay.js');
  Object.assign(window.SDT.UI, overlayMethods);
  await import('../game/src/hub/base.js');
  window.SDT.Base.use(1);
  Object.assign(window.SDT.Base.data, { ammoTaught:false, eggBattles:0 });
  expect(window.SDT.Base.save()).toBe(true);
  vi.spyOn(window.SDT.Base, 'petEggDropChance').mockReturnValue(0);
  vi.spyOn(window.SDT.Base, 'markAmmoTaught');
  ({ RunStorage } = await import('../game/src/hub/game.storage.js'));
  RunStorage.readForLoad(1);
  Object.keys(state.game).forEach(key => { delete state.game[key]; });
  Object.assign(state.game, {
    state:'idle', runActive:true, seed:'extra-legend-run', discoveredPairs:new Set(), layerIdx:0, trackPos:1,
    ownedCards:[], usedPocket:[], visited:{}, coins:0, elapsed:30, elapsedSynced:20, myClass:'wu', hp:20, maxHp:20,
    usedSlots:() => state.game.ownedCards.length, bagCap:() => 16,
    canReceiveCard:card => state.game.ownedCards.some(owned => owned.card.name === card.name) || state.game.ownedCards.length < 16,
    grantCard:vi.fn(card => {
      if (!state.game.canReceiveCard(card)) return false;
      state.game.ownedCards.push({ uid:`claimed-${state.game.ownedCards.length}`, card }); return true;
    }),
    gainCoins:vi.fn(amount => { state.game.coins += amount; }), addItem:vi.fn(),
    persistSave:() => state.save(),
  });
  await import('../game/src/run/chests.js');
  vi.spyOn(window.SDT.Chests, 'rollDrops').mockReturnValue([{ kind:'small' }]);
  state.payload = () => ({ seed:state.game.seed, layerIdx:state.game.layerIdx, trackPos:state.game.trackPos,
    ownedCards:state.game.ownedCards, usedPocket:state.game.usedPocket, visited:state.game.visited,
    coins:state.game.coins, elapsed:state.game.elapsed, chestReward:window.SDT.Chests.serialize(state.game),
    nodeChestRewards:{...(state.game.nodeChestRewards||{}),...(window.SDT.Chests.serialize(state.game)?{[`${state.game.layerIdx},${state.game.trackPos}`]:window.SDT.Chests.serialize(state.game)}:{})},
    rngState:{ loot:state.random.mock.calls.length } });
  state.save = vi.fn(() => RunStorage.write(1, state.payload()));
  expect(state.save()).toBe(true);
  state.module = await import('../game/src/hub/game.bag.settle.js');
  state.module.bindBagMixins();
});

afterEach(() => {
  window.SDT.Chests?.suspend();
  if (priorLocks) Object.defineProperty(navigator, 'locks', priorLocks);
  else delete navigator.locks;
});

function disk() { return RunStorage.read(1); }
function reload() {
  const saved = RunStorage.readForLoad(1);
  expect(saved).toBeTruthy();
  Object.assign(state.game, { ownedCards:saved.ownedCards, visited:saved.visited, coins:saved.coins, nodeChestRewards:saved.nodeChestRewards, discoveredPairs:new Set() });
  state.module.bindBagMixins();
  expect(state.module.resumeBattleRewards(saved.chestReward)).toBe(true); openChestPicker(state.actions);
  return saved;
}
async function finishOrdinary(opts) {
  await state.game.onBattleEnd(opts, [], true, []);
  state.actions.chestNext(); state.actions.chestReveal();
  if (state.game.canReceiveCard(loot)) state.actions.chestTake1({ i:0 });
  else { state.actions.chestSkip(); state.actions.chestLeave(); }
  expect(disk().chestReward.current.cards).toEqual([loot]);
  continueChestRewards(state.actions);
}
async function expectCommitted() {
  await vi.waitFor(() => expect(state.commands.commitAttempt).toHaveBeenCalledTimes(1));
  await vi.waitFor(() => expect(disk().visited['0,1']).toBe(1));
  expect(disk().chestReward).toBeNull();
  expect(window.SDT.Base.data.eggBattles).toBe(1);
}

describe('战后额外传说先持久化待领奖，再原子完成胜利', () => {
  it('战后暂离先幂等提交击杀和XP；异地存档与读档续领奖不重复结算胜利', async () => {
    window.SDT.Base.data.ammoTaught = true;
    await state.game.onBattleEnd({ isBoss:false, foeNames:['测试敌人'] }, [], true, []);
    state.actions.chestNext();state.actions.chestReveal();
    const fixed = JSON.parse(JSON.stringify(disk().chestReward.current));
    await state.actions.chestReturn();
    expect(state.game.state).toBe('idle');expect(window.SDT.Chests.isOpen()).toBe(false);
    expect(state.commands.commitAttempt).toHaveBeenCalledTimes(1);
    expect(window.SDT.Base.data.eggBattles).toBe(1);
    const parked = disk();expect(parked.chestReward).toBeNull();
    expect(parked.nodeChestRewards['0,1'].current).toEqual(fixed);
    expect(parked.nodeChestRewards['0,1'].context.battleSettlement.progressCommitted).toBe(true);
    state.game.trackPos = 2;expect(state.save()).toBe(true);
    const away = disk();expect(away.nodeChestRewards['0,1'].current).toEqual(fixed);
    state.game.trackPos = 1;state.game.discoveredPairs = new Set();
    state.module.bindBagMixins();
    expect(state.module.resumeBattleRewards(away.nodeChestRewards['0,1'])).toBe(true); openChestPicker(state.actions);
    state.actions.chestTake1({i:0});continueChestRewards(state.actions);
    await vi.waitFor(() => expect(state.game.state).toBe('idle'));
    expect(state.commands.commitAttempt).not.toHaveBeenCalled(); // bindBagMixins 建立了新的计数器。
    expect(window.SDT.Base.data.eggBattles).toBe(1);
    expect(state.game.ownedCards.filter(item => item.card.id === loot.id)).toHaveLength(1);
    expect(disk().nodeChestRewards['0,1']).toBeUndefined();
  });
  it('暂离提交失败保留领奖与重试；重试成功后的活动/按节点快照同步提交标记，读档不再结算', async () => {
    window.SDT.Base.data.ammoTaught = true;
    await state.game.onBattleEnd({isBoss:false,foeNames:['重试敌人']},[],true,[]);
    state.actions.chestNext();state.actions.chestReveal();
    state.commands.commitAttempt.mockResolvedValueOnce({ok:false,message:'暂离保存失败'});
    expect(await state.actions.chestReturn()).toBe(false);
    expect(window.SDT.UI.el.overlay.hidden).toBe(false);expect(state.game.state).toBe('battleSettlement');
    expect(disk().chestReward.context.battleSettlement.progressCommitted).toBe(false);
    await state.actions.battleSettleRetry();
    expect(window.SDT.Chests.serialize(state.game).context.battleSettlement.progressCommitted).toBe(true);
    state.actions.chestCoins();
    expect(disk().chestReward.context.battleSettlement.progressCommitted).toBe(true);
    expect(disk().nodeChestRewards['0,1'].context.battleSettlement.progressCommitted).toBe(true);
    expect(await state.actions.chestReturn()).toBe(true);
    const parked=disk().nodeChestRewards['0,1'];
    state.game.discoveredPairs=new Set();state.module.bindBagMixins();
    expect(state.module.resumeBattleRewards(parked)).toBe(true); openChestPicker(state.actions);
    state.actions.chestTake1({i:0});continueChestRewards(state.actions);
    await vi.waitFor(()=>expect(state.game.state).toBe('idle'));
    expect(state.commands.commitAttempt).not.toHaveBeenCalled();
    expect(window.SDT.Base.data.eggBattles).toBe(1);expect(state.game.ownedCards).toHaveLength(1);
  });
  it.each([true, false])('满16格保留确定传说，刷新/整理/已领刷新不重掷，首胜教学最后出现（boss=%s）', async isBoss => {
    state.game.ownedCards = Array.from({ length:16 }, (_, i) => ({ uid:`full-${i}`, card:{ id:`full-${i}`, name:`已有${i}`, type:'法术' } }));
    expect(state.save()).toBe(true);
    const opts = { isBoss, foeNames:[isBoss ? '首脑' : '荒渊巨兽'], encounterId:isBoss ? 'boss' : 'beast' };
    state.random.mockReturnValue(0);
    await finishOrdinary(opts);
    await new Promise(resolve => setTimeout(resolve, 250));
    expect(window.SDT.UI.el.overlay.hidden).toBe(false);
    const pending = disk();
    expect(pending.chestReward.current.cards).toEqual([legend]);
    expect(pending.chestReward.context.battleSettlement.extraLegendaryPrepared).toBe(true);
    expect(JSON.parse(localStorage.getItem(runKey)).chestReward.context.battleSettlement.extraLegendaryPrepared).toBe(true);
    expect(pending.visited['0,1']).toBe(1);
    expect(pending.coins).toBe(1);
    expect(pending.chestReward.current.coins).toBe(0);
    expect(window.SDT.Base.data.eggPity).toBe(1);
    expect(window.SDT.Cards.randomDropCard).toHaveBeenCalledTimes(1);
    expect(state.commands.commitAttempt).not.toHaveBeenCalled();
    expect(window.SDT.Base.markAmmoTaught).not.toHaveBeenCalled();
    expect(window.SDT.Base.data.eggBattles).toBe(0);
    const draws = state.random.mock.calls.length;
    await state.game.onBattleEnd(opts, [], true, []);
    expect(state.random).toHaveBeenCalledTimes(draws);
    reload();
    expect(document.querySelector('.reward-v14')).not.toBeNull();
    state.actions.chestTake1({ i:0 }); // 容量端口拒收仍保持待领
    expect(disk().chestReward.current.taken).toEqual([]);
    continueChestRewards(state.actions);
    expect(state.commands.commitAttempt).not.toHaveBeenCalled();
    state.actions.chestOpenBag();
    state.game.ownedCards.splice(0, 1);
    expect(state.save()).toBe(true);
    const { bagSlots } = await import('../game/src/hub/game.bag.bridge.js');
    bagSlots.closeBackpack();
    state.actions.chestTake1({ i:0 });
    expect(disk().chestReward.current.taken).toEqual([0]);
    expect(disk().ownedCards.filter(owned => owned.card.id === legend.id)).toHaveLength(1);
    reload();
    state.actions.chestTake1({ i:0 });
    expect(disk().ownedCards.filter(owned => owned.card.id === legend.id)).toHaveLength(1);
    expect(state.random).toHaveBeenCalledTimes(draws);
    expect(window.SDT.Base.markAmmoTaught).not.toHaveBeenCalled();
    continueChestRewards(state.actions);
    await expectCommitted();
    expect(window.SDT.Base.markAmmoTaught).toHaveBeenCalledTimes(1);
    expect(window.SDT.UI.el.ovTitle.textContent).toContain('卡牌是消耗品');
    await new Promise(resolve => setTimeout(resolve, 250));
    expect(window.SDT.UI.el.overlay.hidden).toBe(false);
    expect(state.random).toHaveBeenCalledTimes(draws);
    expect(window.SDT.Chests.rollDrops).toHaveBeenCalledTimes(1);
  });

  it('普通箱已领取后刷新，保留普通奖励并只在接续后掷一次首脑额外传说', async () => {
    const opts = { isBoss:true, foeNames:['首脑'] };
    await state.game.onBattleEnd(opts, [], true, []);
    state.actions.chestNext(); state.actions.chestReveal(); state.actions.chestTake1({ i:0 });
    const ordinaryDraws = state.random.mock.calls.length;
    // 旧版本普通箱快照没有准备标记；它尚未执行箱后直接grant，因此应只准备一次。
    const old = disk();
    delete old.chestReward.context.battleSettlement.extraLegendaryPrepared;
    expect(RunStorage.write(1, old)).toBe(true);
    reload();
    expect(state.random).toHaveBeenCalledTimes(ordinaryDraws);
    continueChestRewards(state.actions);
    expect(disk().chestReward.current.cards).toEqual([legend]);
    expect(disk().ownedCards.map(owned => owned.card.id)).toEqual([loot.id]);
    expect(state.random).toHaveBeenCalledTimes(ordinaryDraws + 1);
    expect(disk().coins).toBe(1);
    state.actions.chestTake1({ i:0 }); continueChestRewards(state.actions);
    await expectCommitted();
    expect(disk().ownedCards.map(owned => owned.card.id)).toEqual([loot.id, legend.id]);
    expect(state.game.gainCoins).toHaveBeenCalledTimes(1);
    // 旧式已完成节点没有chestReward，已有收据阻止重新发奖。
    expect(state.module.resumeBattleRewards(disk().chestReward)).toBe(false);
    const completedDraws = state.random.mock.calls.length;
    state.module.bindBagMixins();
    expect(await state.game.onBattleEnd({ ...opts }, [], true, [])).toBe(false);
    expect(disk().ownedCards.map(owned => owned.card.id)).toEqual([loot.id, legend.id]);
    expect(state.random).toHaveBeenCalledTimes(completedDraws);
  });

  it.each([
    { isBoss:false, foeNames:['普通敌人'] },
    { isBoss:false, foeNames:['荒渊巨兽'] },
  ])('非首脑/巨兽未命中不误发额外卡：%j', async opts => {
    const { RULE_CONFIG } = await import('../game/src/core/rule-config.js');
    state.random.mockReturnValue(RULE_CONFIG.rewards.beastLegendaryChance);
    await finishOrdinary(opts);
    await expectCommitted();
    expect(disk().ownedCards.map(owned => owned.card.id)).toEqual([loot.id]);
  });

  it('传说空池不抛错、不丢已领普通奖励，也不多消耗选卡骰', async () => {
    window.SDT.Cards.all = () => [];
    await state.game.onBattleEnd({ isBoss:true, foeNames:['首脑'] }, [], true, []);
    state.actions.chestNext(); state.actions.chestReveal(); state.actions.chestTake1({ i:0 });
    const draws = state.random.mock.calls.length;
    continueChestRewards(state.actions);
    await expectCommitted();
    expect(disk().ownedCards.map(owned => owned.card.id)).toEqual([loot.id]);
    expect(state.random).toHaveBeenCalledTimes(draws);
  });

  it.each(['reject', 'throw-after-adoption'])('固定领奖接收器%s后可重试，仍只发原传说', async failure => {
    await state.game.onBattleEnd({ isBoss:true, foeNames:['首脑'] }, [], true, []);
    state.actions.chestNext(); state.actions.chestReveal(); state.actions.chestTake1({ i:0 });
    const original = window.SDT.Chests.restore;
    vi.spyOn(window.SDT.Chests, 'restore').mockImplementationOnce((...args) => {
      if (failure === 'reject') return false;
      original(...args);
      throw new Error('test after adoption');
    });
    continueChestRewards(state.actions);
    await vi.waitFor(() => expect(state.actions.battleSettleRetry).toBeTypeOf('function'));
    const draws = state.random.mock.calls.length;
    expect(state.commands.commitAttempt).not.toHaveBeenCalled();
    expect(state.game.ownedCards.map(owned => owned.card.id)).toEqual([loot.id]);
    expect(await state.actions.battleSettleRetry()).toBe(false);
    expect(disk().chestReward.current.cards).toEqual([legend]);
    state.actions.chestTake1({ i:0 }); continueChestRewards(state.actions);
    await expectCommitted();
    expect(disk().ownedCards.map(owned => owned.card.id)).toEqual([loot.id, legend.id]);
    expect(state.random).toHaveBeenCalledTimes(draws);
  });

  it('额外传说初次落盘失败时停在可重试阶段，恢复写入仍是原卡原骰', async () => {
    await state.game.onBattleEnd({ isBoss:true, foeNames:['首脑'] }, [], true, []);
    state.actions.chestNext(); state.actions.chestReveal(); state.actions.chestTake1({ i:0 });
    const nativeSet = Storage.prototype.setItem;
    const failPending = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === runKey && JSON.parse(value).chestReward?.context?.battleSettlement?.extraLegendaryPrepared) {
        throw new DOMException('test pending reward quota', 'QuotaExceededError');
      }
      return nativeSet.call(this, key, value);
    });
    continueChestRewards(state.actions);
    await vi.waitFor(() => expect(state.actions.battleSettleRetry).toBeTypeOf('function'));
    const draws = state.random.mock.calls.length;
    expect(state.commands.commitAttempt).not.toHaveBeenCalled();
    expect(disk().chestReward.current.cards).toEqual([loot]);
    expect(disk().visited['0,1']).toBe(1);
    failPending.mockRestore();
    expect(await state.actions.battleSettleRetry()).toBe(false);
    expect(disk().chestReward.current.cards).toEqual([legend]);
    expect(disk().chestReward.context.battleSettlement.extraLegendaryPrepared).toBe(true);
    expect(state.random).toHaveBeenCalledTimes(draws);
    state.actions.chestTake1({ i:0 }); continueChestRewards(state.actions);
    await expectCommitted();
    expect(disk().ownedCards.map(owned => owned.card.id)).toEqual([loot.id, legend.id]);
    expect(state.random).toHaveBeenCalledTimes(draws);
  });

  it('确定传说领取后真实Run写失败，原attempt恢复重试不重掷、不重复发卡', async () => {
    window.SDT.Base.data.ammoTaught = true;
    expect(window.SDT.Base.save()).toBe(true);
    await finishOrdinary({ isBoss:true, foeNames:['首脑'] });
    state.actions.chestTake1({ i:0 });
    const draws = state.random.mock.calls.length;
    const nativeSet = Storage.prototype.setItem;
    const failRun = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === runKey) throw new DOMException('test quota failure', 'QuotaExceededError');
      return nativeSet.call(this, key, value);
    });
    continueChestRewards(state.actions);
    await vi.waitFor(() => expect(state.actions.battleSettleRetry).toBeTypeOf('function'));
    expect(RunStorage.readIdentity(1)).toMatchObject({ ok:false, code:'RECOVERY_REQUIRED' });
    const attempt = state.commands.commitAttempt.mock.calls[0][0];
    failRun.mockRestore();
    expect(await state.actions.battleSettleRetry()).toBe(true);
    expect(state.commands.createAttempt).toHaveBeenCalledTimes(1);
    expect(state.commands.commitAttempt).toHaveBeenCalledTimes(2);
    expect(state.commands.commitAttempt.mock.calls[1][0]).toBe(attempt);
    expect(disk().ownedCards.filter(owned => owned.card.id === legend.id)).toHaveLength(1);
    expect(disk().chestReward).toBeNull();
    expect(state.random).toHaveBeenCalledTimes(draws);
    expect(window.SDT.Base.data.eggBattles).toBe(1);
  });
});

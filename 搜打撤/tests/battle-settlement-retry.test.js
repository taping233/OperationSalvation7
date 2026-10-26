import { battleRules, overlayElements, quietUiMocks } from './helpers/environment-fixtures.js';
import { installImmediateWebLocks } from './helpers/web-locks.js';
installImmediateWebLocks();
import { continueChestRewards } from './helpers/chest-actions.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  game: null, saveGame: null, payloadFactory: null, transition: null, actions: null, chestDone: null,
  extraReward:null, activeSlot: 1, runId: 'test-run', commands: null, commandOptions: null, readReceipt: null,
  commitResponses: [], commitApplied: false, pending: null, setPending: null, clearPending: null, random: null,
}));

vi.mock('../game/src/run/game.session.js', () => ({
  game: state.game,
  saveGame: async (...args) => await state.saveGame(...args),
  createRunSavePayload: (...args) => state.payloadFactory(...args),
  getActiveSlot: () => state.activeSlot,
  setBattleSettlementPending: (...args) => state.setPending(...args),
  clearBattleSettlementPending: (...args) => state.clearPending(...args),
  doDeath: vi.fn(), cardStacks: vi.fn(), newUid: vi.fn(), safeUsed: vi.fn(), usedSlots: vi.fn(),
}));
vi.mock('../game/src/hub/game.storage.js', () => ({ RunStorage: {
  readIdentity: () => ({ ok: true, value: { runId: state.runId, revision: 2 } }),
} }));
vi.mock('../game/src/hub/battle-settlement.commands.js', () => ({
  createBattleSettlementCommands: options => {
    state.commandOptions = options;
    return state.commands;
  },
}));
vi.mock('../game/src/hub/recovery.commands.js', () => ({
  commitBaseAndRun: vi.fn(), readSettlementReceipt: vi.fn(), recoverSlot: vi.fn(),
}));
vi.mock('../game/src/run/game.run.js', () => ({ showRunTransition: (...args) => state.transition(...args) }));
vi.mock('../game/src/hub/game.bag.bridge.js', () => ({ bagSlots: { closeBackpack: vi.fn(), pocketAdd: vi.fn() } }));
vi.mock('../game/src/core/event-bus.js', () => ({ on: vi.fn() }));
vi.mock('../game/src/core/random.js', () => ({ Random: { random: (...args) => state.random(...args) } }));
vi.mock('../game/src/core/shared.js', () => ({ clone: value => (value == null ? value : JSON.parse(JSON.stringify(value))), esc: String, escAttr:String }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  state.actions = {};
  state.chestDone = null;
  state.extraReward = null;
  state.activeSlot = 1;
  state.runId = 'test-run';
  state.game ||= {};
  Object.keys(state.game).forEach(key => { delete state.game[key]; });
  Object.assign(state.game, {
    state: 'idle', seed: 'seed-1', ownedCards: [], usedPocket: [], visited: {}, discoveredPairs: new Set(),
    layerIdx: 0, trackPos: 1, elapsed: 30, elapsedSynced: 20,
    grantCard: vi.fn(), addItem: vi.fn(), myClass: 'wu', hp: 20, maxHp: 20,
  });
  state.saveGame = vi.fn(() => true);
  state.payloadFactory = vi.fn(() => ({
    layerIdx: state.game.layerIdx, trackPos: state.game.trackPos, visited: { ...state.game.visited }, elapsed: state.game.elapsed,
  }));
  state.transition = vi.fn(async () => {});
  state.pending = null;
  state.setPending = vi.fn((slotId, runId) => { state.pending = { slotId, runId }; });
  state.clearPending = vi.fn(() => { state.pending = null; });
  state.commitResponses = [];
  state.commitApplied = false;
  state.random = vi.fn(() => 0.5);
  state.readReceipt = vi.fn(async () => ({ ok: true, replay: false, value: null }));
  state.commands = {
    readReceipt: (...args) => state.readReceipt(...args),
    createAttempt: vi.fn(async input => ({ ok: true, replay: false, attempt: Object.freeze({ id: 'attempt-1', ...input }) })),
    commitAttempt: vi.fn(async () => {
      const result = state.commitResponses.shift() || { ok: true, replay: false, receipt: { runRevision: 3 } };
      if (result.ok && !state.commitApplied) {
        window.SDT.Base.data.eggBattles += 1;
        state.commitApplied = true;
      }
      return result;
    }),
  };
  window.SDT = {
    // 胜利展示留在当前战场；失败、重试和并发通知仍经过同一受控反馈 Promise。
    Battle: { presentVictory: (...args) => state.transition(...args) },
    UI: {
      hideOverlay: vi.fn(), showOverlay: vi.fn(), refresh: vi.fn(), log: vi.fn(),
      act: (name, fn) => { state.actions[name] = fn; },
    },
    Base: {
      slot: 1, data: { eggBattles: 0, ammoTaught: true }, save: vi.fn(() => true), isSha: () => false,
      // 2026-09-29 直写收敛后 game.bag.settle 改调的两个 Base 命令（镜像真实门面旧语义）：
      markAmmoTaught: vi.fn(function () { const B = window.SDT.Base; B.data.ammoTaught = true; return B.save(); }),
      recordEggBattle: vi.fn(function () {
        const B = window.SDT.Base;
        B.data.eggBattles = (B.data.eggBattles || 0) + 1;
        return { eggBattles: B.data.eggBattles, persisted: false };
      }),
    },
    Cards: { SHA: { id: 'starter-attack' }, all: () => [{ id: 'legend', name:'额外传说', type:'装备', rarity: '传说' }], isRandomObtainable: () => true, cardHTML: () => '' },
    Meta: { track: vi.fn(), xpMultiplier: () => 1, publishBattleProgress: vi.fn() },
    Chests: {
      rollDrops: vi.fn(() => [{ kind: 'small' }]), dropText: () => '小型物资箱',
      open: vi.fn((_game, _drops, done) => { state.chestDone = done; }),
      restore:vi.fn((_game, saved, done) => { state.extraReward = { saved, done }; return true; }),
    },
  };
});

async function bind() {
  const { bindBagMixins } = await import('../game/src/hub/game.bag.settle.js');
  bindBagMixins();
  return state.game.onBattleEnd;
}

it('forwards the real battle review and boss identity to death settlement without persisting it', async () => {
  const onBattleEnd = await bind();
  const { doDeath } = await import('../game/src/run/game.session.js');
  const battleSummary = Object.freeze({round:4,remainingFoes:[],damageTaken:[]});
  await onBattleEnd({isBoss:true,battleSummary},[],false,[]);
  expect(doDeath).toHaveBeenCalledWith({battleSummary,battleIsBoss:true});
  expect(state.commands.createAttempt).not.toHaveBeenCalled();
});

async function openAndFinishChest(onBattleEnd, opts) {
  await onBattleEnd(opts, [], true, []);
  expect(state.chestDone).toBeTypeOf('function');
  return finishChestRewards();
}

// 模拟玩家完成普通箱，再逐张领取独立持久化的额外传说；事务断言仍覆盖真实续流。
async function finishChestRewards() {
  const result = await state.chestDone();
  if (!state.extraReward) return result;
  const { saved, done } = state.extraReward;
  state.extraReward = null;
  saved.current.cards.forEach(card => state.game.grantCard(card));
  return done();
}

async function mountRealRetryOverlay() {
  document.body.innerHTML = '<div id="overlay" hidden><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div>';
  window.SDT.Icons = { rich: value => value };
  window.SDT.Sound = { sfx() {} };
  const { overlayMethods } = await import('../game/src/ui/overlay.js');
  const UI = window.SDT.UI;
  Object.assign(UI, overlayMethods, {
    el: { overlay: document.getElementById('overlay'), ovTitle: document.getElementById('ovTitle'), ovBody: document.getElementById('ovBody') },
    _acts: {}, act(name, fn) { this._acts[name] = fn; },
  });
  let clicked;
  UI.el.ovBody.addEventListener('click', event => {
    const button = event.target.closest('[data-act]');
    if (button) clicked = UI._acts[button.dataset.act]?.(button.dataset);
  });
  return { UI, retry() { UI.el.ovBody.querySelector('[data-act="battleSettleRetry"]').click(); return clicked; } };
}

describe('真实战斗奖励刷新续流', () => {
  it.each([false, true])('未领/部分/全领未继续刷新后，胜利事务只完成一次（boss=%s）', async isBoss => {
    document.body.innerHTML = '<div id="overlay"><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div>';
    const UI = window.SDT.UI;
    UI.el = { ...overlayElements() };
    UI.showOverlay = (_title, html) => { UI.el.ovBody.innerHTML = html; };
    const cards = [0, 1].map(i => ({ id:`battle-loot-${i}`, name:`战利品${i}`, type:'法术', rarity:'古朴', cost:0, desc:'战斗中获得的奖励' }));
    const draw = vi.fn().mockImplementationOnce(() => cards[0]).mockImplementation(() => cards[1]);
    Object.assign(window.SDT, { MAP:{ chestKinds:{ small:{ name:'小型物资箱', cards:2, coins:[1,1] } } }, Sound:{ sfx() {} }, Icons:{ rich:html => html } });
    Object.assign(window.SDT.Cards, { RARITIES:['古朴','稀有','史诗','传说'], randomDropCard:draw,
      pickOfRarity:() => cards[0], classPool:() => [], rarityOf:c => c.rarity, sellPrice:() => 1, cardHTML:c => `<div>${c.name}</div>` });
    Object.assign(window.SDT.Base, { petEggDropChance:() => 0, recordPetEggChestResult:vi.fn(), bagCap:() => 16 });
    await import('../game/src/run/chests.js');
    const Chests = window.SDT.Chests;
    vi.spyOn(Chests, 'rollDrops').mockReturnValue([{ kind:'small' }]);
    let disk = null;
    Object.assign(state.game, { coins:0, usedSlots:() => state.game.ownedCards.length, bagCap:() => 16, canReceiveCard:() => true,
      grantCard:vi.fn(card => { state.game.ownedCards.push({ uid:`reward-${state.game.ownedCards.length}`, card }); return true; }),
      gainCoins:vi.fn(amount => { state.game.coins += amount; }),
      persistSave:vi.fn(() => { disk = JSON.parse(JSON.stringify({ ownedCards:state.game.ownedCards, coins:state.game.coins, chestReward:Chests.serialize(state.game) })); return true; }),
    });
    state.payloadFactory = vi.fn(() => ({ ownedCards:state.game.ownedCards, coins:state.game.coins,
      chestReward:Chests.serialize(state.game), elapsed:state.game.elapsed, visited:{ ...state.game.visited } }));
    const module = await import('../game/src/hub/game.bag.settle.js');
    module.bindBagMixins();
    state.game.ownedCards.push({ uid:'used-card', card:{ id:'used', name:'打出的卡', rarity:'古朴' } });
    const { bagSlots } = await import('../game/src/hub/game.bag.bridge.js');
    const movedBefore = bagSlots.pocketAdd.mock.calls.length;
    await state.game.onBattleEnd({ isBoss, foeNames:['首战敌人'], encounterId:'first-fight' }, ['used-card'], true, []);
    expect(disk.chestReward.context.battleSettlement.opts.isBoss).toBe(isBoss);
    expect(disk.chestReward.current.cards).toEqual(cards);
    const drawCount = draw.mock.calls.length;
    const reload = () => {
      state.game.ownedCards = JSON.parse(JSON.stringify(disk.ownedCards));
      state.game.coins = disk.coins;
      state.game.discoveredPairs = new Set();
      module.bindBagMixins();
      expect(module.resumeBattleRewards(disk.chestReward)).toBe(true);
      expect(draw).toHaveBeenCalledTimes(drawCount);
    };
    reload();
    expect(document.querySelector('.reward-v14')).not.toBeNull();
    await Promise.resolve();
    state.actions.chestSelect({ i:0 }); await state.actions.chestTake1({ i:0 });
    expect(disk.chestReward.current.taken).toEqual([0]);
    reload();
    await state.actions.chestTake1({ i:0 });
    expect(state.game.grantCard).toHaveBeenCalledTimes(1);
    state.actions.chestSelect({ i:1 }); await state.actions.chestTake1({ i:1 });
    expect(disk.chestReward.current.taken).toEqual([0,1]);
    reload();
    if (isBoss) state.commitResponses.push({ ok:false, code:'WRITE_FAILED', message:'restored reward retry' });
    await continueChestRewards(state.actions);
    if (isBoss) {
      expect(state.commands.commitAttempt).not.toHaveBeenCalled();
      await state.actions.chestTake1({ i:0 });
      await continueChestRewards(state.actions);
    }
    await vi.waitFor(() => expect(state.commands.commitAttempt).toHaveBeenCalledTimes(1));
    if (isBoss) {
      await vi.waitFor(() => expect(state.actions.battleSettleRetry).toBeTypeOf('function'));
      await state.actions.battleSettleRetry();
      expect(state.commands.createAttempt).toHaveBeenCalledTimes(1);
    }
    expect(state.game.coins).toBe(1);
    expect(state.game.gainCoins).toHaveBeenCalledTimes(1);
    expect(state.game.grantCard).toHaveBeenCalledTimes(isBoss ? 3 : 2);
    expect(bagSlots.pocketAdd.mock.calls.length - movedBefore).toBe(1);
    expect(state.commands.createAttempt.mock.calls[0][0].victoryProgress).toMatchObject({ foeNames:['首战敌人'], isBoss, classId:'wu', xpMultiplier:1 });
    expect(state.commands.createAttempt.mock.calls[0][0].afterRun.chestReward).toBeNull();
    expect(window.SDT.Base.data.eggBattles).toBe(1);
    expect(state.game.visited['0,1']).toBe(1);
    expect(state.transition).toHaveBeenCalledTimes(1);
    await continueChestRewards(state.actions);
    expect(state.commands.commitAttempt).toHaveBeenCalledTimes(isBoss ? 2 : 1);
    expect(state.game.coins).toBe(1);
  });
});

describe('战后结算事务接线与失败重试', () => {
  it('巨兽额外传说奖励使用规则概率且只消费原有loot骰', async () => {
    const { RULE_CONFIG } = await import('../game/src/core/rule-config.js');
    state.random = vi.fn().mockReturnValueOnce(RULE_CONFIG.rewards.beastLegendaryChance - 0.001).mockReturnValueOnce(0);
    const onBattleEnd = await bind();
    await openAndFinishChest(onBattleEnd, { isBoss: false, foeNames: ['荒渊巨兽'], encounterId: 'elite:beast' });

    expect(state.random).toHaveBeenNthCalledWith(1, 'loot', 'reward');
    expect(state.random).toHaveBeenNthCalledWith(2, 'loot', 'reward');
    expect(state.game.grantCard).toHaveBeenCalledTimes(1);
  });

  it('巨兽概率边界使用严格小于比较，恰等阈值时不发额外卡', async () => {
    const { RULE_CONFIG } = await import('../game/src/core/rule-config.js');
    state.random = vi.fn().mockReturnValue(RULE_CONFIG.rewards.beastLegendaryChance);
    const onBattleEnd = await bind();
    await openAndFinishChest(onBattleEnd, { isBoss: false, foeNames: ['荒渊巨兽'], encounterId: 'elite:beast' });

    expect(state.random).toHaveBeenCalledTimes(1);
    expect(state.random).toHaveBeenCalledWith('loot', 'reward');
    expect(state.game.grantCard).not.toHaveBeenCalled();
  });

  it('过场失败后重试，不再次消耗已转入口袋的牌', async () => {
    const onBattleEnd = await bind();
    state.game.ownedCards.push({ uid: 'played-1', card: { id: 'played', name: '已打出的牌', rarity: '古朴' } });
    state.transition.mockRejectedValueOnce(new Error('transition failed'));
    const opts = { isBoss: false, foeNames: ['敌人'], encounterId: 'entry:enemy' };

    expect(await onBattleEnd(opts, ['played-1'], true, [])).toBe(false);
    expect(state.game.ownedCards).toHaveLength(0);
    const { bagSlots } = await import('../game/src/hub/game.bag.bridge.js');
    expect(bagSlots.pocketAdd).toHaveBeenCalledTimes(1);
    await state.actions.battleSettleRetry();
    expect(bagSlots.pocketAdd).toHaveBeenCalledTimes(1);
    expect(window.SDT.Chests.open).toHaveBeenCalledTimes(1);
    await state.chestDone();
    expect(state.commands.commitAttempt).toHaveBeenCalledTimes(1);
  });

  it('展示结算按真实移动采样，失败重试不重复，展示字段不进入持久attempt', async () => {
    const onBattleEnd = await bind();
    const { bagSlots } = await import('../game/src/hub/game.bag.bridge.js');
    const pocketCallsBefore = bagSlots.pocketAdd.mock.calls.length;
    state.game.ownedCards.push(
      { uid:'spent', card:{ id:'normal', name:'普通消耗牌', rarity:'古朴' } },
      { uid:'gone', card:{ id:'class', name:'职业消散牌', rarity:'职业' } },
      { uid:'starter', card:{ id:'starter-attack', name:'初始攻击', rarity:'初始' } },
      { uid:'token', card:{ id:'token', name:'衍生牌', rarity:'衍生' } },
      { uid:'kept', card:{ id:'keep', name:'未用保留牌', rarity:'稀有' } },
    );
    state.transition.mockRejectedValueOnce(new Error('transition failed'));
    const opts = { isBoss:false, foeNames:['敌人'], encounterId:'entry:enemy',
      spentCards:[{ uid:'temporary', card:{ id:'temporary', name:'战斗生成牌', rarity:'衍生' } }] };
    const played = ['spent','gone','starter','token','temporary'];
    expect(await onBattleEnd(opts, played, true, ['spent','temporary'])).toBe(false);
    await state.actions.battleSettleRetry();
    const summary = window.SDT.Chests.open.mock.calls[0][3].battleSummary;
    expect(summary.cardOutcome).toEqual({ pocket:['普通消耗牌','职业消散牌','初始攻击','衍生牌','战斗生成牌'], gone:[], retained:['未用保留牌'] });
    expect(bagSlots.pocketAdd.mock.calls.length - pocketCallsBefore).toBe(5);
    await onBattleEnd(opts, played, true, ['spent','temporary']);
    expect(window.SDT.Chests.open).toHaveBeenCalledTimes(1);
    await state.chestDone();
    expect(state.commands.createAttempt.mock.calls[0][0]).not.toHaveProperty('cardOutcome');
    expect(state.commands.createAttempt.mock.calls[0][0].afterRun).not.toHaveProperty('cardOutcome');
    expect(state.game).not.toHaveProperty('cardOutcome');
  });

  it('重复通知与事务失败重试复用固定attempt，不重复发奖励、重开搜刮点或增计数', async () => {
    const onBattleEnd = await bind();
    let releaseTransition;
    state.transition.mockImplementationOnce(() => new Promise(resolve => { releaseTransition = resolve; }));
    state.commitResponses = [
      { ok: false, code: 'STORAGE_WRITE_FAILED', message: 'write failed' },
      { ok: true, replay: false, receipt: { runRevision: 3 } },
    ];
    const opts = { isBoss: true, foeNames: ['首脑'], encounterId: 'boss:final' };

    const first = onBattleEnd(opts, [], true, []);
    const duplicate = onBattleEnd(opts, [], true, []);
    await vi.waitFor(() => expect(state.transition).toHaveBeenCalledTimes(1));
    releaseTransition();
    await Promise.all([first, duplicate]);
    expect(window.SDT.Chests.open).toHaveBeenCalledTimes(1);

    await finishChestRewards();
    expect(state.game.grantCard).toHaveBeenCalledTimes(1);
    expect(state.game.visited['0,1']).toBe(1);
    expect(state.commands.createAttempt).toHaveBeenCalledTimes(1);
    expect(state.commands.commitAttempt).toHaveBeenCalledTimes(1);
    expect(state.commands.commitAttempt.mock.calls[0][0].id).toBe('attempt-1');
    expect(state.commands.createAttempt.mock.calls[0][0]).toMatchObject({
      slotId: 1, node: { layerIdx: 0, trackPos: 1, isBoss: true, encounterId: 'boss:final' },
      afterRun: { visited: { '0,1': 1 }, layerIdx: 0, trackPos: 1 }, elapsedDelta: 10,
    });
    expect(window.SDT.Base.data.eggBattles).toBe(0);
    expect(state.saveGame).toHaveBeenCalledTimes(1); // 额外传说待领奖先写普通Run快照
    expect(window.SDT.Base.save).not.toHaveBeenCalled();
    expect(state.game.state).toBe('battleSettlement');
    expect(state.pending).toEqual({ slotId: 1, runId: 'test-run' });

    await state.actions.battleSettleRetry();
    expect(state.commands.createAttempt).toHaveBeenCalledTimes(1);
    expect(state.commands.commitAttempt).toHaveBeenCalledTimes(2);
    expect(state.commands.commitAttempt.mock.calls[1][0]).toBe(state.commands.commitAttempt.mock.calls[0][0]);
    expect(state.game.grantCard).toHaveBeenCalledTimes(1);
    expect(state.random).toHaveBeenCalledTimes(1);
    expect(window.SDT.Chests.rollDrops).toHaveBeenCalledTimes(1);
    expect(window.SDT.Base.data.eggBattles).toBe(1);
    expect(state.clearPending).toHaveBeenCalledWith(1, 'test-run');
    expect(state.game.state).toBe('idle');
    await onBattleEnd(opts, [], true, []);
    expect(state.commands.commitAttempt).toHaveBeenCalledTimes(2);
  });

  it('允许同一局背包整理替换ownedCards数组后继续提交', async () => {
    const onBattleEnd = await bind();
    const opts = { isBoss: false, foeNames: ['敌人'] };
    await onBattleEnd(opts, [], true, []);
    state.game.ownedCards = state.game.ownedCards.filter(() => true);
    await state.chestDone();
    expect(state.commands.commitAttempt).toHaveBeenCalledTimes(1);
    expect(state.commands.createAttempt).toHaveBeenCalledTimes(1);
  });

  it('新节点已存在收据时在奖励与过场前停止，不投影旧结果', async () => {
    state.readReceipt.mockResolvedValueOnce({ ok: true, replay: true, value: { runRevision: 3 } });
    const onBattleEnd = await bind();
    const result = await onBattleEnd({ isBoss: true, foeNames: ['首脑'] }, [], true, []);
    expect(result).toBe(false);
    expect(state.game.state).toBe('battleSettlement');
    expect(state.transition).not.toHaveBeenCalled();
    expect(state.game.visited).toEqual({});
    expect(state.game.grantCard).not.toHaveBeenCalled();
    expect(state.commands.createAttempt).not.toHaveBeenCalled();
    expect(state.commands.commitAttempt).not.toHaveBeenCalled();
    expect(window.SDT.Chests.open).not.toHaveBeenCalled();
  });

  it('读取收据等待期间锁住战斗操作，切档后旧失败不弹新局重试面板', async () => {
    let releaseReceipt;
    state.readReceipt.mockImplementationOnce(() => new Promise(resolve => { releaseReceipt = resolve; }));
    const onBattleEnd = await bind();
    const pending = onBattleEnd({ isBoss: false, foeNames: ['敌人'] }, [], true, []);
    expect(state.game.state).toBe('battleSettlement');
    state.activeSlot = 2;
    releaseReceipt({ ok: false, code: 'STORAGE_READ_FAILED', message: 'failed' });
    expect(await pending).toBe(false);
    expect(window.SDT.UI.showOverlay).not.toHaveBeenCalled();
    expect(state.commands.createAttempt).not.toHaveBeenCalled();
  });

  it('提交等待期间同槽开启新局后，旧失败不改变新局状态或显示重试面板', async () => {
    let releaseCommit;
    state.commands.commitAttempt.mockImplementationOnce(() => new Promise(resolve => { releaseCommit = resolve; }));
    const onBattleEnd = await bind();
    await onBattleEnd({ isBoss: false, foeNames: ['敌人'] }, [], true, []);
    const pending = state.chestDone();
    await vi.waitFor(() => expect(releaseCommit).toBeTypeOf('function'));
    expect(state.game.state).toBe('battleSettlement');
    state.game.seed = 'seed-next';
    state.game.discoveredPairs = new Set();
    state.game.ownedCards = [];
    state.runId = 'next-run';
    state.game.state = 'idle';
    releaseCommit({ ok: false, code: 'STALE_RUN', message: 'stale' });
    expect(await pending).toBe(false);
    expect(state.game.state).toBe('idle');
    expect(window.SDT.UI.showOverlay).not.toHaveBeenCalled();
  });

  it('无档位胜利保留内存行为，撤退仍走普通保存且不创建胜利事务', async () => {
    const onBattleEnd = await bind();
    state.activeSlot = null;
    await onBattleEnd({ isBoss: false, foeNames: ['敌人'] }, [], true, []);
    await state.chestDone();
    expect(window.SDT.Base.data.eggBattles).toBe(1);
    expect(state.commands.createAttempt).not.toHaveBeenCalled();
    expect(state.saveGame).toHaveBeenCalledTimes(1);

    state.saveGame.mockClear();
    const retreat = onBattleEnd({ isBoss: false, foeNames: ['敌人'] }, [], null, []);
    await retreat;
    expect(state.saveGame).toHaveBeenCalledTimes(1);
    expect(state.commands.createAttempt).not.toHaveBeenCalled();
  });

  it('教学保存仅在事务成功后执行，失败重试不重复奖励', async () => {
    const onBattleEnd = await bind();
    window.SDT.Base.data.ammoTaught = false;
    window.SDT.Base.save.mockReturnValue(false);
    state.commitResponses = [
      { ok: false, code: 'STORAGE_WRITE_FAILED', message: 'write failed' },
      { ok: true, replay: false, receipt: { runRevision: 3 } },
    ];
    const opts = { isBoss: false, foeNames: ['敌人'] };

    await onBattleEnd(opts, [], true, []);
    await state.chestDone();
    expect(state.game.state).toBe('battleSettlement');
    expect(window.SDT.Base.data.ammoTaught).toBe(false);
    expect(window.SDT.Base.save).not.toHaveBeenCalled();
    expect(state.game.grantCard).toHaveBeenCalledTimes(0);

    await state.actions.battleSettleRetry();
    expect(window.SDT.Base.data.ammoTaught).toBe(true);
    expect(window.SDT.Base.save).toHaveBeenCalledTimes(1);
    expect(state.game.grantCard).toHaveBeenCalledTimes(0);
    expect(state.commands.createAttempt).toHaveBeenCalledTimes(1);
    expect(state.commands.commitAttempt).toHaveBeenCalledTimes(2);
    expect(state.game.state).toBe('modal');
    await onBattleEnd(opts, [], true, []);
    await state.chestDone();
    expect(state.commands.commitAttempt).toHaveBeenCalledTimes(2);
    expect(state.commands.createAttempt).toHaveBeenCalledTimes(1);
    expect(state.game.grantCard).toHaveBeenCalledTimes(0);
  });

  it('死亡与龙巢战斗仍绕过普通战后事务', async () => {
    const onBattleEnd = await bind();
    const { doDeath } = await import('../game/src/run/game.session.js');
    await onBattleEnd({ isBoss: false, foeNames: ['敌人'] }, [], false, []);
    expect(doDeath).toHaveBeenCalledTimes(1);
    expect(state.readReceipt).not.toHaveBeenCalled();
    expect(state.commands.createAttempt).not.toHaveBeenCalled();
    expect(state.commands.commitAttempt).not.toHaveBeenCalled();

    state.game.nestActive = true;
    await onBattleEnd({ isBoss: true, foeNames: ['龙巢首脑'] }, [], true, []);
    expect(state.readReceipt).not.toHaveBeenCalled();
    expect(state.commands.createAttempt).not.toHaveBeenCalled();
    expect(state.commands.commitAttempt).not.toHaveBeenCalled();
  });
});

describe('真实重试弹层的结算归属', () => {
  const failed = { ok: false, code: 'SAVE_FAILED_PENDING_RECOVERY', message: 'pending' };
  const opts = () => ({ isBoss: false, foeNames: ['敌人'] });

  it('持续失败保留错误层，成功立即关闭自有层并解绑回调且不重复奖励', async () => {
    const { UI, retry } = await mountRealRetryOverlay();
    const onBattleEnd = await bind();
    state.commitResponses = [failed, failed];
    await openAndFinishChest(onBattleEnd, opts());
    expect(UI.el.overlay.hidden).toBe(false);
    expect(UI.el.ovBody.textContent).toContain('重试保存战后奖励');
    await retry();
    expect(UI.el.overlay.hidden).toBe(false);
    expect(state.game.state).toBe('battleSettlement');
    const oldRetry = UI._acts.battleSettleRetry;
    await retry();
    expect(UI.el.overlay.hidden).toBe(true);
    expect(UI.el.ovBody.querySelector('[data-act="battleSettleRetry"]')).toBeNull();
    expect(UI._acts.battleSettleRetry).toBeUndefined();
    expect(state.game.state).toBe('idle');
    expect(window.SDT.Base.data.eggBattles).toBe(1);
    await oldRetry();
    expect(state.commands.createAttempt).toHaveBeenCalledTimes(1);
    expect(state.commands.commitAttempt).toHaveBeenCalledTimes(3);
  });

  it('首次成功教学不被重试层的210ms关闭尾巴清除', async () => {
    const { UI, retry } = await mountRealRetryOverlay();
    window.SDT.Base.data.ammoTaught = false;
    state.commitResponses = [failed];
    await openAndFinishChest(await bind(), opts());
    await retry();
    expect(UI._acts.battleSettleRetry).toBeUndefined();
    expect(UI.el.ovTitle.textContent).toContain('卡牌是消耗品');
    expect(UI.el.ovBody.querySelector('[data-act="ammoTeachOk"]')).not.toBeNull();
    await new Promise(resolve => setTimeout(resolve, 250));
    expect(UI.el.overlay.hidden).toBe(false);
    expect(UI.el.ovBody.querySelector('[data-act="ammoTeachOk"]')).not.toBeNull();
    expect(window.SDT.Base.save).toHaveBeenCalledTimes(1);
  });

  it.each(['own-callback', 'replacement-callback', 'new-run'])('异步成功不误关替代层（%s）', async scenario => {
    const { UI, retry } = await mountRealRetryOverlay();
    state.commitResponses = [failed];
    await openAndFinishChest(await bind(), opts());
    let resolveCommit;
    state.commands.commitAttempt.mockImplementationOnce(() => new Promise(resolve => { resolveCommit = resolve; }));
    const pending = retry();
    expect(resolveCommit).toBeTypeOf('function');
    UI.showOverlay('其他面板', '<button data-act="otherAction">其他操作</button>', 'discover');
    const other = vi.fn(); UI.act('otherAction', other);
    const replacement = vi.fn();
    if (scenario !== 'own-callback') UI.act('battleSettleRetry', replacement);
    if (scenario === 'new-run') {
      state.game.discoveredPairs = new Set(); state.runId = 'new-run'; state.game.state = 'modal';
    }
    resolveCommit({ ok: true, replay: false, receipt: { runRevision: 3 } });
    await pending;
    expect(UI.el.overlay.hidden).toBe(false);
    expect(UI.el.ovTitle.textContent).toBe('其他面板');
    expect(UI.el.ovBody.querySelector('[data-act="otherAction"]')).not.toBeNull();
    expect(UI._acts.otherAction).toBe(other);
    expect(UI._acts.battleSettleRetry).toBe(scenario === 'own-callback' ? undefined : replacement);
    if (scenario === 'new-run') expect(state.game.state).toBe('modal');
  });
});

it.each([true, false])('返回地图等待结算结果 %s 时换页，事务完成但不抢占新页面', async ok => {
  const onBattleEnd = await bind();
  await onBattleEnd({ isBoss:false, foeNames:['敌人'] }, [], true, []);
  const options = window.SDT.Chests.open.mock.calls[0][3];
  let resolveCommit;
  state.commands.commitAttempt.mockImplementationOnce(() => new Promise(resolve => { resolveCommit = resolve; }));
  let current = true;
  const view = { isCurrent:() => current, resume:vi.fn() };
  const pending = options.beforeMapReturn(options.battleSettlement, view);
  await vi.waitFor(() => expect(resolveCommit).toBeTypeOf('function'));
  current = false; state.game.state = 'new-page';
  const shown = window.SDT.UI.showOverlay.mock.calls.length;
  const refreshed = window.SDT.UI.refresh.mock.calls.length;
  resolveCommit(ok ? { ok:true, replay:false, receipt:{} } : { ok:false, code:'SAVE_FAILED' });
  expect(await pending).toBe(ok);
  expect(state.commands.createAttempt).toHaveBeenCalledTimes(1);
  expect(state.commands.commitAttempt).toHaveBeenCalledTimes(1);
  expect(state.game.state).toBe('new-page');
  expect(window.SDT.UI.showOverlay).toHaveBeenCalledTimes(shown);
  expect(window.SDT.UI.refresh).toHaveBeenCalledTimes(refreshed);
  expect(view.resume).not.toHaveBeenCalled();
  expect(options.battleSettlement.progressCommitted).toBe(ok);
});

it('返回地图结算仍在原页时，通过页面所有者恢复奖励再交还返回动作', async () => {
  const onBattleEnd = await bind();
  await onBattleEnd({ isBoss:false, foeNames:['敌人'] }, [], true, []);
  const options = window.SDT.Chests.open.mock.calls[0][3];
  const view = { isCurrent:() => true, resume:vi.fn() };
  expect(await options.beforeMapReturn(options.battleSettlement, view)).toBe(true);
  expect(view.resume).toHaveBeenCalledOnce();
  expect(state.game.state).toBe('modal');
  expect(state.commands.commitAttempt).toHaveBeenCalledOnce();
});

it('原页返回结算失败后重试页接管，重试复用原attempt且恢复奖励', async () => {
  const onBattleEnd = await bind();
  await onBattleEnd({ isBoss:false, foeNames:['敌人'] }, [], true, []);
  const options = window.SDT.Chests.open.mock.calls[0][3];
  window.SDT.Chests.resume = vi.fn();
  state.commitResponses.push({ ok:false, code:'SAVE_FAILED' });
  const view = { isCurrent:() => true, resume:vi.fn() };
  expect(await options.beforeMapReturn(options.battleSettlement, view)).toBe(false);
  expect(state.actions.battleSettleRetry).toBeTypeOf('function');
  await state.actions.battleSettleRetry();
  expect(state.commands.createAttempt).toHaveBeenCalledTimes(1);
  expect(state.commands.commitAttempt).toHaveBeenCalledTimes(2);
  expect(window.SDT.Chests.resume).toHaveBeenCalledOnce();
});

describe('真实 session 的战后保存入口', () => {
  it('payload构造不写盘，pending事务阻断普通saveGame直到清除', async () => {
    vi.doUnmock('../game/src/run/game.session.js');
    vi.doUnmock('../game/src/hub/game.storage.js');
    vi.doUnmock('../game/src/hub/recovery.commands.js');
    vi.doUnmock('../game/src/hub/extraction.commands.js');
    vi.doUnmock('../game/src/hub/terminal.commands.js');
    vi.doUnmock('../game/src/ui/game.menu.js');
    vi.doUnmock('../game/src/agent/agent.data.js');
    vi.doUnmock('../game/src/battle/battle-loader.js');
    vi.doUnmock('../game/src/core/random.js');
    vi.doUnmock('../game/src/core/shared.js');
    vi.doUnmock('../game/src/run/game.session.kernel.js');
    vi.doUnmock('../game/src/run/game.session.modes.js');
    vi.doUnmock('../game/src/run/game.session.bag.js');
    vi.doUnmock('../game/src/run/game.session.map.js');
    vi.doUnmock('../game/src/run/game.session.board.js');
    vi.doUnmock('../game/src/run/game.session.death.js');
    vi.resetModules();
    localStorage.clear();
    const ctx = new Proxy({}, { get: () => () => ctx, set: () => true });
    window.HTMLCanvasElement.prototype.getContext = () => ctx;
    document.body.innerHTML = '<canvas id="game"></canvas><div id="title"></div><div id="exitScr"></div>';
    window.SDT = {
      Icons: { img: () => '', TYPE_ART: {} }, Sound: { music() {}, sfx() {}, setDucked() {} }, FX: { feedback() {} },
      MAP: { rules: { playerMaxHp: 50, playerAtk: 4, fireHeal: 5, ...battleRules(2, 10, 10, 0, 5, 1) }, items: { rations: { name: '口粮' }, wood: { name: '木材' } } },
    };
    await import('../game/src/cards/cards.js');
    await import('../game/src/ui/ui.js');
    await import('../game/src/hub/base.js');
    Object.assign(window.SDT.UI, { log() {}, refresh() {}, ...quietUiMocks() });
    window.SDT.Meta = { setXpMul() {}, track() {} };
    window.SDT.Nest = { renderNestMap() {} };
    const session = await import('../game/src/run/game.session.js');
    const { RunStorage } = await import('../game/src/hub/game.storage.js');
    const Base = window.SDT.Base;
    const slot = 2;
    Base.use(slot);
    session._set_active_slot(slot);
    session.buildDerived('settlement-session-save');
    session.game.runActive = true;
    session.game.nestActive = false;
    session.game.state = 'idle';
    session.game.elapsed = 30;
    session.game.elapsedSynced = 20;
    expect(await session.saveGame()).toBe(true);
    const initialStats = Base.data.stats.playSeconds;
    const rawBeforePayload = [localStorage.getItem(RunStorage.key(slot)), localStorage.getItem(`sdt-base-v2-slot${slot}`)];
    const syncedBeforePayload = session.game.elapsedSynced;
    const payload = session.createRunSavePayload();
    expect(payload).toMatchObject({ slot, elapsed: 30, layerIdx: session.game.layerIdx, trackPos: session.game.trackPos });
    expect([localStorage.getItem(RunStorage.key(slot)), localStorage.getItem(`sdt-base-v2-slot${slot}`)]).toEqual(rawBeforePayload);
    expect(Base.data.stats.playSeconds).toBe(initialStats);
    expect(session.game.elapsedSynced).toBe(syncedBeforePayload);

    const identity = RunStorage.readIdentity(slot);
    session.setBattleSettlementPending(slot, identity.value.runId);
    session.game.elapsed = 40;
    session.game.ownedCards = session.game.ownedCards.filter(() => true);
    const rawBeforeBlockedSave = [localStorage.getItem(RunStorage.key(slot)), localStorage.getItem(`sdt-base-v2-slot${slot}`)];
    expect(await session.saveGame()).toBe(false);
    expect([localStorage.getItem(RunStorage.key(slot)), localStorage.getItem(`sdt-base-v2-slot${slot}`)]).toEqual(rawBeforeBlockedSave);
    expect(session.game.elapsedSynced).toBe(30);
    expect(Base.data.stats.playSeconds).toBe(initialStats);

    session.clearBattleSettlementPending(slot, identity.value.runId);
    expect(await session.saveGame()).toBe(true);
    expect(session.game.elapsedSynced).toBe(40);
    expect(Base.data.stats.playSeconds).toBe(initialStats + 10);
  });
});


import { beforeEach, describe, expect, it, vi } from 'vitest';
import { writeFileSync } from 'node:fs';

const state = vi.hoisted(() => ({
  game: null, saveGame: null, payloadFactory: null, transition: null, actions: null, chestDone: null,
  activeSlot: 1, runId: 'test-run', commands: null, commandOptions: null, readReceipt: null,
  commitResponses: [], commitApplied: false, pending: null, setPending: null, clearPending: null, random: null,
}));

vi.mock('../../../game/src/run/game.session.js', () => ({
  game: state.game,
  saveGame: (...args) => state.saveGame(...args),
  createRunSavePayload: (...args) => state.payloadFactory(...args),
  getActiveSlot: () => state.activeSlot,
  setBattleSettlementPending: (...args) => state.setPending(...args),
  clearBattleSettlementPending: (...args) => state.clearPending(...args),
  doDeath: vi.fn(), cardStacks: vi.fn(), newUid: vi.fn(), safeUsed: vi.fn(), usedSlots: vi.fn(),
}));
vi.mock('../../../game/src/hub/game.storage.js', () => ({ RunStorage: {
  readIdentity: () => ({ ok: true, value: { runId: state.runId, revision: 2 } }),
} }));
vi.mock('../../../game/src/hub/battle-settlement.commands.js', () => ({
  createBattleSettlementCommands: options => {
    state.commandOptions = options;
    return state.commands;
  },
}));
vi.mock('../../../game/src/hub/recovery.commands.js', () => ({
  commitBaseAndRun: vi.fn(), readSettlementReceipt: vi.fn(), recoverSlot: vi.fn(),
}));
vi.mock('../../../game/src/run/game.run.js', () => ({ showRunTransition: (...args) => state.transition(...args) }));
vi.mock('../../../game/src/hub/game.bag.bridge.js', () => ({ bagSlots: { closeBackpack: vi.fn(), pocketAdd: vi.fn() } }));
vi.mock('../../../game/src/core/event-bus.js', () => ({ on: vi.fn() }));
vi.mock('../../../game/src/core/random.js', () => ({ Random: { random: (...args) => state.random(...args) } }));
vi.mock('../../../game/src/core/shared.js', () => ({ clone: value => (value == null ? value : JSON.parse(JSON.stringify(value))), esc: String, escAttr:String }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  state.actions = {};
  state.chestDone = null;
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
    Cards: { SHA: { id: 'starter-attack' }, all: () => [{ id: 'legend', rarity: '传说' }], isRandomObtainable: () => true, cardHTML: () => '' },
    Meta: { track: vi.fn(), xpMultiplier: () => 1, publishBattleProgress: vi.fn() },
    Chests: {
      rollDrops: vi.fn(() => [{ kind: 'small' }]), dropText: () => '小宝箱',
      open: vi.fn((_game, _drops, done) => { state.chestDone = done; }),
    },
  };
});

async function bind() {
  const { bindBagMixins } = await import('../../../game/src/hub/game.bag.settle.js');
  bindBagMixins();
  return state.game.onBattleEnd;
}


it.each([true, false])('full bag rejects extra legendary but battle settlement still finalizes without a pending reward (boss=%s)', async isBoss => {
  const legend={ id:'legend', name:'首脑保底传说', rarity:'传说', type:'装备' };
  window.SDT.Cards.all=()=>[legend];
  state.random=vi.fn(()=>0); // guaranteed beast hit; boss branch does not need a chance roll
  state.game.ownedCards=Array.from({length:16},(_,i)=>({uid:`full-${i}`,card:{id:`full-${i}`,name:`已有卡${i}`,type:'法术'}}));
  state.game.grantCard=vi.fn(()=>false);
  state.payloadFactory=vi.fn(()=>({seed:state.game.seed,layerIdx:0,trackPos:1,visited:{...state.game.visited},ownedCards:structuredClone(state.game.ownedCards),chestReward:null}));
  const handler=await bind();
  const opts={isBoss,foeNames:[isBoss?'测试首脑':'荒渊巨兽'],encounterId:isBoss?'boss':'beast'};
  await handler(opts,[],true,[]); expect(state.chestDone).toBeTypeOf('function');
  const finished=await state.chestDone();
  expect(finished).toBe(true); expect(state.game.grantCard).toHaveBeenCalledTimes(1);
  expect(state.game.ownedCards).toHaveLength(16); expect(state.game.ownedCards.some(owned=>owned.card.id==='legend')).toBe(false);
  expect(state.game.state).toBe('idle'); expect(state.game.visited['0,1']).toBe(1);
  expect(state.commands.commitAttempt).toHaveBeenCalledTimes(1);
  const prepared=state.commands.createAttempt.mock.calls[0][0];
  expect(prepared.afterRun.chestReward).toBeNull(); expect(prepared.afterRun.ownedCards.some(owned=>owned.card.id==='legend')).toBe(false);
  await handler(opts,[],true,[]); expect(state.game.grantCard).toHaveBeenCalledTimes(1);
  writeFileSync(`docs/evidence/2026-10-16-reward-atomicity-audit/extra-legend-${isBoss?'boss':'beast'}.json`,JSON.stringify({at:new Date().toISOString(),input:{isBoss,usedSlots:16,capacity:16,grantCardResult:false},finished,grantCalls:state.game.grantCard.mock.calls,stateAfter:{state:state.game.state,visited:state.game.visited,ownedCardsCount:state.game.ownedCards.length},afterRun:prepared.afterRun,logs:window.SDT.UI.log.mock.calls,scope:'Real game.bag.settle controller; command persistence ports are stubbed successful, not real browser or player storage'},null,2)+'\n');
});

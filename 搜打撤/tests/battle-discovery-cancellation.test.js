import { inspectCardRuleCapability } from '../game/src/cards/card-rules.capability.js';
import { describe, expect, it, vi } from 'vitest';
import { createBattleRuntime } from '../game/src/battle/runtime/battle.runtime.factory.js';
import { createCombatRuntime } from '../game/src/battle/core/combat.factory.js';
import { createSelectionDomain } from '../game/src/battle/core/battle.selection-flow.domain.js';
import { createBagDomain } from '../game/src/battle/bag/battle.bag.domain.js';
import { createCardRuleExecutionView } from '../game/src/cards/card-execution-plan.js';
import { createExecPlayDomain } from '../game/src/battle/core/battle.exec-play.domain.js';
import { createBattleDiscoverFlow } from '../game/src/battle/effects/battle.discover-flow.js';
import { firstPureDiscoveryJob, withPreparedDiscovery, claimPreparedDiscovery } from '../game/src/battle/effects/battle.discover-preview.js';

function harness() {
  const combat = createCombatRuntime(), runtime = createBattleRuntime({ combat });
  const source = { id: 'source-card', name: '发现源牌', type: '法术', cost: 2,
    rules: { version: 1, triggers: { onPlay: [{ op: 'discover', count: 2, pool: { kind: 'moves', cost: 1 }, costDecayPerTurn: 1 }] } } };
  const entries = [{ uid: 'source', card: source }, { uid: 'fuel', card: { name: '材料', type: '武术' } }, { uid: 'pay', card: { name: '代价', type: '武术' } }];
  runtime.set$G({ battleActive: true, hp: 20, myClass: '法师', ownedCards: entries, log: vi.fn() });
  runtime.set$pstat({ status: {} }); runtime.set$pdef({ armor: 0 });
  runtime.set$energy(3); runtime.set$hand(entries.map(e => e.uid)); runtime.set$foes([{ hp: 20 }]);
  const catalog = [1, 2, 3].map(n => ({ id: `option-${n}`, name: `候选${n}`, type: '法术', rarity: '传说', cost: 1 }));
  let sample = 0;
  const random = vi.fn(() => (sample++ % 3) / 3);
  const cards = { all: () => catalog, isRandomObtainable: () => true, sellPrice: () => 1, DMG_TYPES: ['武术', '法术'] };
  const context = { runtime, combat, cards, audio: { sfx: vi.fn() }, random: { random }, readRules: () => ({}), normalizeCard: card => card };
  const findCard = uid => entries.find(e => e.uid === uid);
  const session = { handSelectQueue: [], choiceQueue: [], resumeTurnEnd: vi.fn() };
  const selection = createSelectionDomain(context).createBattleSelectionFlow({ cards, random01: random, session,
    findCard, requestBattleRender: vi.fn(), deny: vi.fn() });
  return { runtime, source, cards, random, context, findCard, selection };
}

describe('battle discovery cancellation boundaries', () => {
  it('cancels before energy, source, infusion and hand payments, without completion riders', async () => {
    const h = harness(); h.source.infuse = 1;
    h.source.rules.battle = { target: { side: null, area: false }, requirements: [{ kind: 'handCards', count: 1 }, { kind: 'infused' }] };
    const eligibility = inspectCardRuleCapability(h.source); expect(eligibility.ok, JSON.stringify(eligibility)).toBe(true);
    let action;
    const resolve = vi.fn(), onResolved = vi.fn();
    const flow = createExecPlayDomain(h.context).createBattleExecPlay({
      findCard: h.findCard, effCostOf: () => 2, requestBattleRender: vi.fn(), resolveCardWithFeedback: resolve,
      queueBattleAction: run => { action = run; return true; },
      previewDiscovery: (...args) => h.selection.previewDiscovery(...args),
    });
    flow.queueCardExecution('source', h.source, ['fuel'], null, false, true, ['pay'], onResolved);
    const pending = action(new AbortController().signal);
    expect(h.runtime.discovering.sourceCommit).toBe('preview');
    expect(h.selection.cancelDiscover(h.runtime.discovering.roundId)).toBe(true);
    await pending;
    expect(h.runtime.energy).toBe(3);
    expect(h.runtime.hand).toEqual(['source', 'fuel', 'pay']);
    expect(h.runtime.played).toEqual([]); expect(h.runtime.consumed).toEqual([]);
    expect(resolve).not.toHaveBeenCalled(); expect(onResolved).not.toHaveBeenCalled();
  });

  it('cancels the actual quick-item path for employee pass C before consuming its owned source', async () => {
    const h = harness();
    Object.assign(h.source, { id: 'tt4-shine-token', type: '道具',
      rules: { version: 1, bag: { use: [{ op: 'discover', count: 1, pool: { kind: 'legendary' } }] } } });
    let action;
    const bag = createBagDomain(h.context).createBattleBag({ findCard: h.findCard,
      alive: () => h.runtime.foes, queueBattleAction: run => { action = run; },
      clearTargetSession: vi.fn(), requestBattleRender: vi.fn(),
      throwIfActionCancelled: signal => { if (signal?.aborted) throw new Error('aborted'); },
      previewDiscovery: (...args) => h.selection.previewDiscovery(...args) });
    bag.useItem('source', null);
    const pending = action(new AbortController().signal);
    expect(h.runtime.discovering.sourceCommit).toBe('preview');
    expect(h.runtime.discovering.sourceCardId).toBe('tt4-shine-token');
    h.selection.cancelDiscover(h.runtime.discovering.roundId); await pending;
    expect(h.runtime.G.ownedCards.find(e => e.uid === 'source').card).toBe(h.source);
    expect(h.runtime.played).toEqual([]); expect(h.runtime.granted).toEqual([]);
    expect(bag.battleBagItems().some(e => e.uid === 'source')).toBe(true);
  });

  it('previews stored pouch cards without paying or consuming their owned originals', async () => {
    const h = harness();
    h.source.id = 'tt7-stratagem'; h.source.rules.triggers.onPlay = [{ op: 'castStored' }];
    const stored = { uid: 'stored-spell', pouchOf: 'tt7-stratagem', card: { id: 'spell', name: '囊内法术', type: '法术' } };
    h.runtime.G.ownedCards.push(stored);
    const wait = h.selection.previewDiscovery(h.source, 'source', new AbortController().signal);
    expect(h.runtime.discovering.act).toBe('pouch');
    expect(h.runtime.discovering.options[0].pouchUid).toBe(stored.uid);
    h.selection.cancelDiscover(h.runtime.discovering.roundId); expect(await wait).toBe(false);
    expect(h.runtime.G.ownedCards).toContain(stored); expect(h.runtime.energy).toBe(3);
    expect(h.runtime.hand).toContain('source'); expect(h.random).not.toHaveBeenCalled();
  });

  it('reuses cancelled candidates in the same turn and invalidates after a plan change', async () => {
    const h = harness();
    const first = h.selection.previewDiscovery(h.source, 'source', new AbortController().signal);
    const options = h.runtime.discovering.options, rolls = h.random.mock.calls.length;
    h.selection.cancelDiscover(h.runtime.discovering.roundId); expect(await first).toBe(false);
    const second = h.selection.previewDiscovery(h.source, 'source', new AbortController().signal);
    expect(h.runtime.discovering.options).toEqual(options); expect(h.random).toHaveBeenCalledTimes(rolls);
    h.selection.cancelDiscover(h.runtime.discovering.roundId); await second;
    h.source.rules.triggers.onPlay[0].count = 1;
    const changed = h.selection.previewDiscovery(h.source, 'source', new AbortController().signal);
    expect(h.random.mock.calls.length).toBeGreaterThan(rolls);
    h.selection.cancelDiscover(h.runtime.discovering.roundId); await changed;
  });

  it('returns one fixed confirmation to the source and does not accept a stale round', async () => {
    const h = harness(); const wait = h.selection.previewDiscovery(h.source, 'source', new AbortController().signal);
    const round = h.runtime.discovering.roundId;
    expect(h.selection.cancelDiscover('obsolete')).toBe(false);
    expect(h.selection.pickDiscover(1)).toBe(true);
    const prepared = await wait;
    expect(prepared.index).toBe(1); expect(h.runtime.discovering).toBeNull();
    const execution = createCardRuleExecutionView(withPreparedDiscovery(h.source, prepared), h.source.rules.triggers.onPlay);
    const job = { n: 2 };
    expect(claimPreparedDiscovery(execution, job)).toMatchObject({ fixedOptions: prepared.options, confirmedIndex: 1 });
    expect(claimPreparedDiscovery(execution, job)).toBe(job);
    expect(h.selection.cancelDiscover(round)).toBe(false);
  });

  it('releases the waiting action on abort without clearing a replacement interaction', async () => {
    const h = harness(), controller = new AbortController();
    const wait = h.selection.previewDiscovery(h.source, 'source', controller.signal);
    const replacement = { options: [], n: 1, roundId: 'replacement' };
    h.runtime.set$discovering(replacement); controller.abort();
    expect(await wait).toBe(false); expect(h.runtime.discovering).toBe(replacement);
  });

  it('only previews wholly discovery-owned unconditional plays', () => {
    const h = harness(), ports = { getAllCards: () => [], getMyClass: () => null };
    expect(firstPureDiscoveryJob(h.source, ports)).toMatchObject({ n: 2 });
    const mixed = { ...h.source, rules: { triggers: { onPlay: [{ op: 'damage', base: 3 }, ...h.source.rules.triggers.onPlay] } } };
    expect(firstPureDiscoveryJob(mixed, ports)).toBeNull();
  });

  it('ends only the current committed job, returns bottom UIDs and retains prior temporary expiry', () => {
    let state = { options: [], n: 3, roundId: 7, deckBottom: true, deckBottomUids: ['a', 'b'],
      consumeTempAtTurn: true, tempUids: ['already-picked'] };
    const other = { n: 1 }, jobs = [other];
    const returnToDeckBottom = vi.fn(), enqueueDelayed = vi.fn();
    const flow = createBattleDiscoverFlow({ cards: {}, random: {},
      interaction: { get: () => state, set: value => { state = value; }, getJobs: () => jobs, requestRender: vi.fn() },
      battle: { battleActive: () => true }, effects: { returnToDeckBottom, enqueueDelayed }, output: { log: vi.fn() } });
    expect(flow.cancelDiscover(6)).toBe(false); expect(flow.cancelDiscover(7)).toBe(true);
    expect(returnToDeckBottom).toHaveBeenCalledWith(['a', 'b']);
    expect(enqueueDelayed).toHaveBeenCalledWith({ special: 'consumeTemps', uids: ['already-picked'], cardName: '江湖救急' });
    expect(jobs).toEqual([other]); expect(state).toBeNull();
  });
});


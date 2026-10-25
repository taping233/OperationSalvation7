import { beforeEach, expect, it, vi } from 'vitest';
import { installImmediateWebLocks } from './helpers/web-locks.js';
installImmediateWebLocks();
window.SDT = { Icons:{ img:() => '', TYPE_ART:{} }, Sound:{ music(){}, sfx(){}, setDucked(){} }, FX:{ feedback(){} },
  UI:{ log(){}, refresh(){}, showOverlay(){}, hideOverlay(){}, act(){} },
  MAP:{ rules:{ playerMaxHp:50, playerAtk:4, fireHeal:5, battleEnergy:2, battleHandMax:10,
    bossDeckSize:10, starterSha:0, battleStartDraw:5, battleTurnDraw:1, diceSides:6, stashStart:20, stashMax:100, stashUpgradeSlots:5 } } };
await import('../game/src/cards/cards.js');
await import('../game/src/hub/base.js');
const { RunStorage } = await import('../game/src/hub/game.storage.js');
const { createRecoveryCommands } = await import('../game/src/hub/recovery.commands.js');
const { createExtractionCommands, validatePendingExtraction } = await import('../game/src/hub/extraction.commands.js');
const { planBaseDeparture } = await import('../game/src/hub/base-departure.commands.js');
const Base = window.SDT.Base;
const a = { id:'source-a', name:'同名招式', type:'法术', rarity:'古朴', dmg:2 };
const b = { id:'source-b', name:'同名招式', type:'法术', rarity:'史诗', dmg:9 };
const sourceKey = stack => JSON.stringify([stack.card.id || null, stack.variantKey || stack.card.variantKey || '', stack.card.id ? null : stack.card.name]);
beforeEach(() => localStorage.clear());
async function harness() {
  await RunStorage.remove(1); Base.use(1); await Base.reset(1);
  const departed = planBaseDeparture({ stash:[{ card:a, count:1 }, { card:b, count:1 }], pocket:[] },
    { 'card:source-a':1, 'card:source-b':1 }).departure;
  const game = { seed:'source-identity', rngState:{ seed:'source-identity' }, hp:20, maxHp:30, coins:0, turn:1,
    layerIdx:2, trackPos:1, elapsed:0, inventory:[], ownedCards:departed.cards.map((stack, i) => ({ uid:`u${i}`, card:stack.card })),
    usedPocket:[{ card:a, count:1 }, { card:b, count:1 }], pendingExtraction:null, runActive:true };
  expect(await RunStorage.write(1, game)).toBe(true);
  let failpoint = null;
  const recovery = createRecoveryCommands({ storage:localStorage, lockManager:{ request:(_name, _options, work) => work() },
    baseApi:Base, runStore:RunStorage, failpoint:phase => { if (phase === failpoint) { failpoint = null; throw new Error('interrupted'); } } });
  const commit = vi.fn((...args) => recovery.commitBaseAndRun(...args));
  const ports = { getActiveSlot:() => 1, runStore:RunStorage, baseApi:Base, recovery:{ ...recovery, commitBaseAndRun:commit }, game, random:() => 0 };
  const commands = createExtractionCommands(ports);
  const seedPending = async (modern = true) => {
    const runId = RunStorage.readIdentity(1).value.runId;
    const pending = { version:1, runId, phase:'organizing', requestSeq:0,
      remainingCards:modern ? [{ card:a, count:1 }, { card:b, count:1 }] : [{ card:a, count:2 }],
      keptPocket:[], lostPocketCount:0, totalPocketCount:0, resources:{ wood:0, rations:0 },
      ...(modern ? { sourceIdentityVersion:1 } : {}) };
    await RunStorage.write(1, { ...RunStorage.read(1), pendingExtraction:pending }); game.pendingExtraction = pending;
    return pending;
  };
  return { game, commands, commit, seedPending, newCommands:() => createExtractionCommands(ports),
    failNext:phase => { failpoint = phase; } };
}

it('new extraction preserves both source identities from stable departure keys and pocket rolls', async () => {
  const h = await harness(); expect((await h.commands.begin()).ok).toBe(true);
  const pending = h.game.pendingExtraction;
  expect(pending.remainingCards.map(stack => [stack.card.id, stack.count])).toEqual([['source-a',1],['source-b',1]]);
  expect(Base.data.pocket.map(stack => [stack.card.id, stack.count])).toEqual([['source-a',1],['source-b',1]]);
  expect(pending.sourceIdentityVersion).toBe(1); expect(validatePendingExtraction(pending).ok).toBe(true);
});

it('keyed selection deposits the chosen same-name source and the receipt retains its actual identity', async () => {
  const h = await harness(), pending = await h.seedPending();
  const result = await h.commands.updateCards([{ name:b.name, count:1, sourceKey:sourceKey({ card:b }) }], pending.runId, 1);
  expect(result.ok).toBe(true);
  expect(Base.data.stash.map(stack => stack.card.id)).toEqual(['source-b']);
  expect(h.game.pendingExtraction.remainingCards.map(stack => stack.card.id)).toEqual(['source-a']);
  const finished = await h.commands.finish(pending.runId, 1);
  expect(finished.value.output.receipt.savedCards.map(stack => [stack.card.id, stack.count])).toEqual([['source-b',1]]);
});

it('name-only selection rejects ambiguous modern sources without spending or changing their pending rows', async () => {
  const h = await harness(), pending = await h.seedPending();
  expect(await h.commands.updateCards([{ name:a.name, count:1 }], pending.runId, 1)).toMatchObject({ ok:false, code:'AMBIGUOUS_SELECTION' });
  expect(Base.data.stash).toEqual([]); expect(h.game.pendingExtraction.remainingCards).toHaveLength(2);
});

it('legacy pending and retry keep exact name-only journal payload and frozen source contents', async () => {
  const h = await harness(), pending = await h.seedPending(false);
  h.failNext('after-base'); const selection = [{ name:a.name, count:1 }];
  expect((await h.commands.updateCards(selection, pending.runId, 1)).ok).toBe(false);
  expect((await h.commands.updateCards(selection, pending.runId, 1)).ok).toBe(true);
  expect(h.commit.mock.calls[0][1].payload).toEqual({ selections:selection, requestSeq:0 });
  expect(Base.data.stash.map(stack => [stack.card.id, stack.count])).toEqual([['source-a',1]]);
  expect(h.game.pendingExtraction.sourceIdentityVersion).toBeUndefined();
  expect(h.game.pendingExtraction.remainingCards).toEqual([{ card:a, count:1 }]);
});

it('keyed journal interruption retries one chosen source without duplicating or substituting its twin', async () => {
  const h = await harness(), pending = await h.seedPending();
  h.failNext('after-base'); const selection = [{ name:b.name, count:1, sourceKey:sourceKey({ card:b }) }];
  expect((await h.commands.updateCards(selection, pending.runId, 1)).ok).toBe(false);
  expect((await h.commands.updateCards(selection, pending.runId, 1)).ok).toBe(true);
  expect(Base.data.stash.map(stack => [stack.card.id, stack.count])).toEqual([['source-b',1]]);
  expect(h.game.pendingExtraction.remainingCards.map(stack => stack.card.id)).toEqual(['source-a']);
  expect((await h.newCommands().updateCards(selection, pending.runId, 1)).ok).toBe(true);
  expect(Base.data.stash[0].count).toBe(1);
});

it('same-ID source variants survive begin, storage round-trip, selection, pocket and final receipt', async () => {
  const h = await harness();
  const variants = ['variant-one', 'variant-two'].map(variantKey => ({ card:a, count:1, variantKey }));
  h.game.ownedCards = variants.map((stack, i) => ({ ...stack, uid:`variant-${i}` }));
  h.game.usedPocket = variants;
  expect(await RunStorage.write(1, { ...RunStorage.read(1), ownedCards:h.game.ownedCards, usedPocket:variants })).toBe(true);
  expect((await h.commands.begin()).ok).toBe(true);
  const pending = JSON.parse(JSON.stringify(RunStorage.read(1).pendingExtraction));
  expect(pending.remainingCards.map(stack => stack.variantKey)).toEqual(['variant-one', 'variant-two']);
  expect(Base.data.pocket.map(stack => stack.variantKey)).toEqual(['variant-one', 'variant-two']);
  h.game.pendingExtraction = pending;
  expect((await h.newCommands().updateCards([{ name:a.name, count:1, sourceKey:sourceKey(variants[1]) }], pending.runId, 1)).ok).toBe(true);
  expect(Base.data.stash).toEqual([{ ...variants[1] }]);
  const finished = await h.newCommands().finish(pending.runId, 1);
  expect(finished.value.output.receipt.savedCards).toEqual([{ ...variants[1] }]);
});

it('unique modern sources still accept previous name-only callers', async () => {
  const h = await harness(), pending = await h.seedPending();
  pending.remainingCards = [{ card:a, count:1 }];
  h.game.ownedCards = [{ uid:'one', card:a }];
  expect(await RunStorage.write(1, { ...RunStorage.read(1), pendingExtraction:pending, ownedCards:h.game.ownedCards })).toBe(true);
  expect((await h.commands.updateCards([{ name:a.name, count:1 }], pending.runId, 1)).count).toBe(1);
  expect(Base.data.stash).toEqual([{ card:a, count:1 }]);
});

it('modern draft validation rejects unknown protocol versions and duplicate source identities without altering old drafts', async () => {
  const h = await harness(), pending = await h.seedPending();
  expect(validatePendingExtraction({ ...pending, sourceIdentityVersion:2 }).ok).toBe(false);
  expect(validatePendingExtraction({ ...pending, remainingCards:[pending.remainingCards[0], pending.remainingCards[0]] }).ok).toBe(false);
  const legacy = structuredClone(pending); delete legacy.sourceIdentityVersion;
  expect(validatePendingExtraction(legacy).ok).toBe(true);
  expect(legacy.sourceIdentityVersion).toBeUndefined();
});

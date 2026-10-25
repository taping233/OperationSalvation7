import { battleRules } from './helpers/environment-fixtures.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ game: {} }));
vi.mock('../game/src/run/game.session.js', () => ({
  game: fixture.game, getActiveSlot: () => null, startNewGame() {},
  curLayer: () => null, bagCap: () => 30, usedSlots: () => fixture.game.ownedCards?.length || 0,
}));
vi.mock('../game/src/run/game.run.flow.js', () => ({ moveTo: () => false, reenterCell: () => false }));

window.SDT = { Icons: { img: () => '', TYPE_ART: {} },
  Sound: { music() {}, sfx() {}, setDucked() {}, setBoss() {} }, UI: { _acts: {}, log() {} },
  MAP: { rules: { ...battleRules(10, 30, 15, 0, 5, 1) }, items: {} } };
await import('../game/src/cards/cards.js');
const C = window.SDT.Cards;
C.ensureSha(); C.ensureStarters(); C.ensureTabletop(); C.ensureDmgTypes(); C.ensureEffectFields();
const { BattleSession, configureBattleRenderer, infusionFuelReason } = await import('../game/src/battle/core/battle.core.js');
const { bustSigCache } = await import('../game/src/agent/agent.state.js');
const { Random } = await import('../game/src/core/random.js');
const { setTurbo } = await import('../game/src/core/turbo.js');
await import('../game/src/agent/agent.js');
const Agent = window.SDT.Agent;
const stepOptions = { allowEmpty: true, quietMs: 1, timeoutMs: 1000, commandTimeoutMs: 1000 };
const snapshot = () => BattleSession.getSnapshot();
const command = (name, ...args) => ({ type: 'battle', name, args });
const fuel = id => ({ id, name: '同名材料', type: '法术', cost: 0, desc: '回复1点生命', heal: 1 });
const pure = () => ({ id: 'agent-infused', name: '双材料注能箭', type: '法术', cost: 2, infuse: 2,
  dmg: 5, dmgType: 'fixed', desc: '注能（2）：造成5点固定伤害。',
  rules: { version: 1, battle: { target: { side: 'enemy', area: false }, requirements: [{ kind: 'infused' }] },
    triggers: { onPlay: [{ op: 'damage', amountField: 'dmg', target: 'chosenEnemy' }] } } });
const resources = () => {
  const state = snapshot();
  return { hand: [...state.hand], energy: state.energy, played: [...state.played], consumed: [...state.consumed],
    consumedPile: [...state.consumedPile], hp: state.foes.map(foe => foe.hp) };
};
async function begin(card = pure(), extra = [fuel('one'), fuel('two')]) {
  if (fixture.game.battleActive) BattleSession.commands.flee();
  Object.keys(fixture.game).forEach(key => { delete fixture.game[key]; });
  Object.assign(fixture.game, { runActive: true, nestActive: false, battleActive: false, state: 'idle',
    discoveredPairs: new Set(), nestRunes: [], turn: 1, mode: 'standard', hp: 30, maxHp: 50, atk: 0,
    spellPower: 0, coins: 0, myClass: null, characterId: null, inventory: [], usedPocket: [], cardOrder: [],
    ownedCards: [card, ...extra].map((card, i) => ({ uid: `agent-infuse-${i}`, card, safe: false })),
    log() {}, heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }, onBattleEnd() {} });
  window.SDT.game = fixture.game; window.SDT.Battle = BattleSession;
  BattleSession.start(fixture.game, [0, 1].map(i => ({ id: 'same-species', name: `目标${i}`, hp: 100, atk: 0 })), { isBoss: false });
  expect((await Agent.waitSettle(stepOptions)).ok).toBe(true);
  Agent.observe(); await vi.dynamicImportSettled();
}
async function step(decide) {
  const result = await Agent.step(decide, stepOptions);
  expect(result.res?.ok, JSON.stringify({ action: result.action, res: result.res })).toBe(true);
  return result.action;
}
async function startMaterials() {
  await step(() => command('playCard', 'agent-infuse-0', 0));
  expect(snapshot().infusing?.uid).toBe('agent-infuse-0');
}
const fightActions = () => Agent.observe().actions.filter(action => action.type === 'battle');

beforeEach(() => {
  document.body.innerHTML = '<div id="overlay" hidden><h2 id="ovTitle"></h2><div id="ovBody"></div></div>';
  setTurbo(true); configureBattleRenderer(() => {}); Random.reseed(72831);
});
afterEach(() => {
  if (fixture.game.battleActive) BattleSession.commands.flee();
  configureBattleRenderer(null); vi.restoreAllMocks();
});

describe('Agent uses the current domain infusion candidates', () => {
  it('does not advertise required direct play, premature confirmation, the source UID or forbidden fuel', async () => {
    await begin(pure(), [fuel('one'), fuel('two'), { ...fuel('blocked'), rules: { version: 1, battle: { fuelAllowed: false } } }]);
    expect(fightActions().some(action => action.name === 'playDirect' && action.args[0] === 'agent-infuse-0')).toBe(false);
    await startMaterials();
    const observation = Agent.observe(), state = observation.battle.infusing;
    expect(state).toMatchObject({ uid: 'agent-infuse-0', need: 2, picked: [], canConfirm: false, canPlayDirect: false });
    expect(state.candidateUids).toEqual(['agent-infuse-1', 'agent-infuse-2']);
    expect(state.candidateUids.every(uid => !infusionFuelReason(uid))).toBe(true);
    const actions = observation.actions.filter(action => action.type === 'battle');
    expect(actions.filter(action => action.name === 'selectInfusion').map(action => action.args[0])).toEqual(state.candidateUids);
    expect(actions.map(action => action.name)).not.toContain('playDirect');
    expect(actions.map(action => action.name)).not.toContain('confirmInfusion');
  });

  it('distinct same-name UIDs fill the selection once; only then is confirmation available', async () => {
    await begin(); await startMaterials(); const before = resources();
    bustSigCache(); const signatureBeforePick = Agent.settleSignature();
    await step(observation => observation.actions.find(action => action.name === 'selectInfusion'));
    bustSigCache(); expect(Agent.settleSignature()).not.toBe(signatureBeforePick);
    expect(snapshot().infusing.picked).toEqual(['agent-infuse-1']); expect(resources()).toEqual(before);
    let state = Agent.observe().battle.infusing;
    expect(state.candidateUids).toEqual(['agent-infuse-2']); expect(state.canConfirm).toBe(false);
    await step(observation => observation.actions.find(action => action.name === 'selectInfusion'));
    state = Agent.observe().battle.infusing;
    expect(state.picked).toEqual(['agent-infuse-1', 'agent-infuse-2']); expect(state.candidateUids).toEqual([]);
    expect(state.canConfirm).toBe(true); expect(resources()).toEqual(before);
    await step(observation => observation.actions.find(action => action.name === 'confirmInfusion'));
    expect(snapshot().infusing).toBeNull(); expect(snapshot().hand).toEqual([]);
    expect(snapshot().energy).toBe(before.energy - 2); expect(snapshot().foes[0].hp).toBe(95);
    expect(snapshot().consumed).toEqual(['agent-infuse-1', 'agent-infuse-2']);
    expect(snapshot().played.filter(uid => uid === 'agent-infuse-0')).toHaveLength(1);
  });

  it.each(['greedy', 'strategic'])('%s completes the default targeted pure-infusion path through Agent.step', async policy => {
    const card = structuredClone(C.all().find(card => card.id === 'tt12-raydragon'));
    await begin(card, [fuel('one')]); await startMaterials();
    const decide = Agent.policies[policy](), actions = [];
    for (let n = 0; n < 4 && snapshot().infusing; n++) actions.push((await step(decide)).name);
    expect(actions).toEqual(['selectInfusion', 'confirmInfusion']);
    expect(snapshot().infusing).toBeNull(); expect(snapshot().hand).toEqual([]);
    expect(snapshot().foes[0].hp).toBe(89); expect(snapshot().energy).toBe(8);
    expect(snapshot().consumed).toEqual(['agent-infuse-1']);
  });

  it.each([7, 19, 72831])('default random policy has a changing legal action and exits within the material bound (seed %s)', async seed => {
    await begin(); await startMaterials(); Random.reseed(seed);
    const decide = Agent.policies.random();
    for (let n = 0; n < 3 && snapshot().infusing; n++) {
      const before = Agent.observe().battle.infusing;
      const action = await step(decide);
      expect(['selectInfusion', 'confirmInfusion', 'cancelInfusion']).toContain(action.name);
      expect(Agent.observe().battle.infusing).not.toEqual(before);
    }
    expect(snapshot().infusing).toBeNull();
    expect(snapshot().played.filter(uid => uid === 'agent-infuse-0').length).toBeLessThanOrEqual(1);
  });

  it('a selected card that becomes forbidden is removed before cancellation, without resource payment', async () => {
    await begin(); await startMaterials();
    await step(() => command('selectInfusion', 'agent-infuse-1'));
    fixture.game.ownedCards[1].card.rules = { version: 1, battle: { fuelAllowed: false } };
    const before = resources(), observation = Agent.observe();
    expect(observation.battle.infusing.invalidPickedUids).toEqual(['agent-infuse-1']);
    expect(observation.battle.infusing.canConfirm).toBe(false);
    const decide = Agent.policies.greedy();
    const remove = await step(decide); expect(remove).toMatchObject({ name: 'selectInfusion', args: ['agent-infuse-1'] });
    expect(snapshot().infusing.picked).toEqual([]);
    await step(decide); expect(snapshot().infusing.picked).toEqual(['agent-infuse-2']);
    expect((await step(decide)).name).toBe('cancelInfusion');
    expect(snapshot().infusing).toBeNull(); expect(resources()).toEqual(before);
  });

  it('an optional card retains an available direct exit and preserves both material UIDs', async () => {
    const card = structuredClone(C.all().find(card => card.id === 'tt3sp-silverthorn'));
    await begin(card); await startMaterials();
    expect(Agent.observe().battle.infusing.canPlayDirect).toBe(true);
    expect(fightActions().some(action => action.name === 'playDirect')).toBe(true);
    await step(observation => observation.actions.find(action => action.name === 'playDirect'));
    expect(snapshot().infusing).toBeNull(); expect(snapshot().pendingTarget?.uid).toBe('agent-infuse-0');
    await step(() => command('playCard', 'agent-infuse-0', 0));
    expect(snapshot().hand).toEqual(['agent-infuse-1', 'agent-infuse-2']); expect(snapshot().consumed).toEqual([]);
  });

  it('a vanished selected UID does not advertise a no-op removal and random can cancel', async () => {
    await begin(); await startMaterials();
    await step(() => command('selectInfusion', 'agent-infuse-1'));
    await step(() => command('selectInfusion', 'agent-infuse-2'));
    fixture.game.ownedCards = fixture.game.ownedCards.filter(entry => entry.uid !== 'agent-infuse-1');
    const before = resources();
    expect(Agent.observe().battle.infusing.invalidPickedUids).toEqual(['agent-infuse-1']);
    expect(fightActions().map(action => action.name)).toEqual(['cancelInfusion']);
    expect((await step(Agent.policies.random())).name).toBe('cancelInfusion');
    expect(snapshot().infusing).toBeNull(); expect(resources()).toEqual(before);
  });

  it('an instance waiver still permits direct play and does not consume fuel', async () => {
    const card = { ...pure(), _noInfuse: true };
    await begin(card);
    expect(fightActions().some(action => action.name === 'playDirect' && action.args[0] === 'agent-infuse-0')).toBe(true);
    await step(() => command('playCard', 'agent-infuse-0', 0));
    expect(snapshot().infusing).toBeNull(); expect(snapshot().hand).toEqual(['agent-infuse-1', 'agent-infuse-2']);
    expect(snapshot().consumed).toEqual([]);
  });

  it('a policy cancels if the same ready selection is returned without progress', async () => {
    await begin(); await startMaterials();
    await step(() => command('selectInfusion', 'agent-infuse-1'));
    await step(() => command('selectInfusion', 'agent-infuse-2'));
    const observation = Agent.observe(), decide = Agent.policies.greedy();
    expect(decide(observation).name).toBe('confirmInfusion');
    expect(decide(observation).name).toBe('cancelInfusion');
    const before = resources(); await step(() => decide(observation));
    expect(snapshot().infusing).toBeNull(); expect(resources()).toEqual(before);
  });
});

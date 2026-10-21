import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { syncSelectionPrompt } from '../game/src/battle/view/battle.selection-ui.js';

window.SDT = { Icons: { img: () => '', TYPE_ART: {} },
  Sound: { music() {}, sfx() {}, setDucked() {}, setBoss() {} },
  MAP: { rules: { battleEnergy: 30, battleHandMax: 99, bossDeckSize: 99, starterSha: 0,
    battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6 }, items: {} } };
await import('../game/src/cards/cards.js');
const C = window.SDT.Cards;
C.ensureSha(); C.ensureStarters(); C.ensureTabletop(); C.ensureDmgTypes(); C.ensureEffectFields();
const { BattleSession, configureBattleRenderer } = await import('../game/src/battle/core/battle.core.js');
const E = await import('../game/src/battle/core/battle.engine.js');
const R = await import('../game/src/battle/runtime/battle.runtime.js');
const commands = BattleSession.commands;
const snapshot = () => BattleSession.getSnapshot();
const settle = () => vi.advanceTimersByTimeAsync(3000);
const byId = id => structuredClone(C.all().find(card => card.id === id));
const fuel = id => ({ id, name: '同名材料', type: '法术', cost: 0, desc: '回复1点生命', heal: 1 });
const optional = () => byId('tt3sp-silverthorn');
const pure = () => byId('tt12-raydragon');
const twoFuel = () => ({ id:'flow-two', name:'双材料注能箭', type:'法术', cost:2, infuse:2,
  dmg:5, dmgType:'spell', desc:'造成5点法术伤害；注能（2）：伤害+3。' });
let game;

beforeEach(() => {
  vi.useFakeTimers(); configureBattleRenderer(() => {});
  R.set$lastDeckSel([]); document.body.innerHTML = '';
});
afterEach(() => {
  if (game?.battleActive) E.finish(null);
  configureBattleRenderer(null); vi.clearAllTimers(); vi.useRealTimers();
});
async function begin(card, extra = [fuel('one')], enemies = 2) {
  if (game?.battleActive) E.finish(null);
  game = { ownedCards:[card, ...extra].map((card, i) => ({ uid:`flow-${i}`, card })),
    hp:30, maxHp:50, atk:0, spellPower:0, coins:0, myClass:null, characterId:null,
    state:'idle', battleActive:false, log:vi.fn(), inventory:[], usedPocket:[],
    heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }, addItem() {}, onBattleEnd() {} };
  BattleSession.start(game, Array.from({ length:enemies }, (_, i) => ({ id:'same-species', name:`靶子${i}`, hp:999, atk:0 })), { isBoss:false });
  await settle();
  expect(snapshot().phase).toBe('player');
  return game;
}
const resources = () => ({ hand:[...R.hand], energy:R.energy, played:[...R.played],
  consumed:[...R.consumed], discard:[...R.discard], grave:[...R.grave],
  drawPile:[...R.drawPile], infuseFuels:R.infuseFuels });
const pick = uid => commands.selectInfusion(uid);
function materialTarget(cardUid = 'flow-0', picked = ['flow-1']) {
  expect(commands.submitCardPlay(cardUid).kind).toBe('infusion');
  picked.forEach(pick);
  expect(commands.confirmInfusion().kind).toBe('target');
  return snapshot();
}

describe('one infusion cast across default pointer, keyboard and target steps', () => {
  it.each(['pointer', 'keyboard'])('optional infusion with no materials uses its base effect via %s', async input => {
    await begin(optional(), [], 1);
    const before = resources();
    expect(commands.getCardPlayAvailability('flow-0', input === 'pointer' ? 0 : undefined).status).toBe('ready');
    let submitted = commands.submitCardPlay('flow-0', input === 'pointer' ? 0 : undefined);
    if (input === 'keyboard') {
      expect(submitted.kind).toBe('target');
      expect(snapshot().infusing).toBeNull();
      expect(resources()).toEqual(before);
      submitted = commands.submitCardPlay('flow-0', 0);
    }
    expect(submitted.status).toBe('queued');
    await settle(); expect((await submitted.settled).status).toBe('committed');
    expect(R.foes[0].hp).toBeLessThan(999); expect(R.infuseFuels).toBe(0);
    expect(R.hand).not.toContain('flow-0'); expect(R.energy).toBe(before.energy - optional().cost);
  });

  it('optional infusion also falls back when the only remaining card forbids fuel', async () => {
    await begin(optional(), [{ ...fuel('blocked'), rules:{ version:1, battle:{fuelAllowed:false} } }], 1);
    const result = commands.submitCardPlay('flow-0', 0);
    expect(result.status).toBe('queued'); await settle();
    expect((await result.settled).status).toBe('committed');
    expect(R.hand).toEqual(['flow-1']); expect(R.infuseFuels).toBe(0);
  });

  it('optional infusion with fewer materials than its cost keeps its base play', async () => {
    await begin(twoFuel(), [fuel('one')], 1);
    const final = commands.submitCardPlay('flow-0', 0); await settle();
    expect((await final.settled).status).toBe('committed');
    expect(R.hand).toEqual(['flow-1']); expect(R.infuseFuels).toBe(0);
    expect(R.foes[0].hp).toBe(994);
  });

  it.each([undefined, 0])('pure infusion cannot bypass missing materials with side=%s', async side => {
    await begin(pure(), [], 1); const before = resources();
    expect(commands.getCardPlayAvailability('flow-0', side).reason.code).toBe('INFUSION_MATERIALS');
    expect(commands.submitCardPlay('flow-0', side).reason.code).toBe('INFUSION_MATERIALS');
    commands.playDirect('flow-0'); commands.confirmInfusion(); await settle();
    expect(resources()).toEqual(before); expect(snapshot().infusing).toBeNull();
  });

  it.each(['pointer', 'keyboard'])('eligible materials enter the same selection via %s and pay once', async input => {
    await begin(optional()); const before = resources();
    const first = commands.submitCardPlay('flow-0', input === 'pointer' ? 1 : undefined);
    expect(first).toMatchObject({ status:'needs-input', kind:'infusion' });
    expect(snapshot().infusing.targetIndex).toBe(input === 'pointer' ? 1 : null);
    expect(resources()).toEqual(before); pick('flow-1');
    let final = commands.confirmInfusion();
    if (input === 'keyboard') {
      expect(final.kind).toBe('target');
      expect(snapshot().pendingTarget.fuelUids).toEqual(['flow-1']);
      expect(Object.isFrozen(snapshot().pendingTarget.fuelUids)).toBe(true);
      expect(resources()).toEqual(before);
      final = commands.submitCardPlay('flow-0', 1);
    }
    expect(final.status).toBe('queued');
    commands.confirmInfusion(); await settle();
    expect((await final.settled).status).toBe('committed');
    expect(R.energy).toBe(before.energy - optional().cost); expect(R.infuseFuels).toBe(1);
    expect(R.foes[0].hp).toBe(999); expect(R.foes[1].hp).toBeLessThan(999);
    expect(R.played.filter(uid => uid === 'flow-0')).toHaveLength(1);
    expect(R.consumed.filter(uid => uid === 'flow-1')).toHaveLength(1);
    expect(snapshot().consumedPile).toEqual(expect.arrayContaining(['flow-0', 'flow-1']));
    expect(R.drawPile).toEqual(before.drawPile);
  });

  it('returns to materials with the same UIDs, removing only invalid choices before reselection', async () => {
    await begin(twoFuel(), [fuel('one'), fuel('two'), fuel('three')]);
    const before = resources();
    const targeted = materialTarget('flow-0', ['flow-1','flow-2']);
    R.cardOverrides.set('flow-1', { ...fuel('one'), rules:{version:1,battle:{fuelAllowed:false}} });
    commands.beginInfusion('flow-0');
    expect(snapshot().infusing.picked).toEqual(['flow-2']);
    expect(snapshot().infusing.selectionId).not.toBe(targeted.pendingTarget.selectionId);
    expect(snapshot().pendingTarget).toBeNull(); expect(resources()).toEqual(before);
    pick('flow-3'); expect(snapshot().infusing.picked).toEqual(['flow-2','flow-3']);
    expect(commands.confirmInfusion().kind).toBe('target');
    expect(snapshot().pendingTarget.fuelUids).toEqual(['flow-2','flow-3']);
    expect(targeted.pendingTarget.fuelUids).toEqual(['flow-1','flow-2']);
    commands.cancelPendingTarget(); commands.confirmInfusion(); await settle();
    expect(resources()).toEqual(before); expect(snapshot().pendingTarget).toBeNull();
  });

  it('can return after all selected fuel leaves the hand and still offers cancel without payment', async () => {
    await begin(pure()); materialTarget();
    R.set$hand(['flow-0']); const before = resources();
    commands.beginInfusion('flow-0');
    expect(snapshot().infusing.picked).toEqual([]);
    commands.confirmInfusion(); commands.cancelInfusion(); await settle();
    expect(resources()).toEqual(before); expect(snapshot().infusing).toBeNull();
  });

  it('rejects invalid fuel at the final target, preserving the material step for correction', async () => {
    await begin(optional()); materialTarget();
    R.cardOverrides.set('flow-1', { ...fuel('one'), rules:{version:1,battle:{fuelAllowed:false}} });
    const before = resources();
    expect(commands.getCardPlayAvailability('flow-0', 0).reason.code).toBe('FUEL_INVALID');
    expect(commands.submitCardPlay('flow-0', 0).reason.code).toBe('FUEL_INVALID');
    expect(snapshot().pendingTarget.fuelUids).toEqual(['flow-1']);
    commands.beginInfusion('flow-0'); expect(snapshot().infusing.picked).toEqual([]);
    commands.cancelInfusion(); await settle(); expect(resources()).toEqual(before);
  });

  it('rechecks effective cost while confirming and keeps the selection when energy changed', async () => {
    await begin(pure()); commands.beginInfusion('flow-0'); pick('flow-1');
    R.set$energy(0); const before = resources(); commands.confirmInfusion(); await settle();
    expect(snapshot().infusing.picked).toEqual(['flow-1']); expect(resources()).toEqual(before);
  });

  it('a pointer target replaced by another instance of the same species is selected again before payment', async () => {
    await begin(optional()); commands.submitCardPlay('flow-0', 1); pick('flow-1');
    R.foes[1] = { ...R.foes[1], hp:777 };
    const before = resources();
    expect(commands.confirmInfusion().kind).toBe('target');
    expect(resources()).toEqual(before); expect(snapshot().pendingTarget.fuelUids).toEqual(['flow-1']);
  });

  it('cancelled material and target steps cannot be revived by a late confirm', async () => {
    await begin(optional()); const before = resources();
    commands.beginInfusion('flow-0'); pick('flow-1'); commands.cancelInfusion(); commands.confirmInfusion();
    expect(resources()).toEqual(before); expect(snapshot().infusing).toBeNull();
    materialTarget(); commands.cancelPendingTarget(); commands.confirmInfusion(); await settle();
    expect(resources()).toEqual(before); expect(snapshot().pendingTarget).toBeNull();
  });

  it('old-battle material and target state cannot cast in a new battle using the same UIDs', async () => {
    await begin(optional()); commands.beginInfusion('flow-0'); pick('flow-1');
    const oldMaterials = R.infusing;
    await begin(optional()); const before = resources();
    R.set$infusing(oldMaterials); commands.confirmInfusion(); pick('flow-1');
    expect(resources()).toEqual(before); expect(snapshot().pendingTarget).toBeNull();
    R.set$infusing(null); materialTarget(); const oldTarget = R.interaction;
    await begin(optional()); const next = resources(); R.set$interaction(oldTarget);
    expect(commands.submitCardPlay('flow-0', 0).reason.code).toBe('STALE_SELECTION');
    await settle(); expect(resources()).toEqual(next);
  });

  it('late commands after battle teardown are inert even after the game host is removed', async () => {
    await begin(optional()); commands.beginInfusion('flow-0'); pick('flow-1');
    E.finish(null); R.set$G(null); const before = resources();
    expect(() => { commands.playCard('flow-0'); commands.beginInfusion('flow-0');
      commands.confirmInfusion(); commands.selectInfusion('flow-1'); }).not.toThrow();
    expect(commands.submitCardPlay('flow-0', 0).reason.code).toBe('NO_ACTIVE_BATTLE');
    expect(resources()).toEqual(before);
  });

  it('explicit direct play drops chosen fuel and uses the base effect', async () => {
    await begin(optional()); materialTarget(); const before = resources();
    commands.playDirect('flow-0');
    expect(snapshot().pendingTarget.fuelUids).toEqual([]);
    const final = commands.submitCardPlay('flow-0', 0); await settle();
    expect((await final.settled).status).toBe('committed');
    expect(R.hand).toContain('flow-1'); expect(R.infuseFuels).toBe(0);
    expect(R.energy).toBe(before.energy - optional().cost);
  });

  it('free casts keep their grant through material selection and targeting', async () => {
    await begin(pure()); R.freeCast.add('flow-0'); const before = resources();
    materialTarget(); commands.beginInfusion('flow-0');
    expect(R.freeCast.has('flow-0')).toBe(true);
    expect(commands.confirmInfusion().kind).toBe('target');
    const final = commands.submitCardPlay('flow-0', 0); await settle();
    expect((await final.settled).status).toBe('committed');
    expect(R.energy).toBe(before.energy); expect(R.infuseFuels).toBe(1);
  });

  it('switching a free cast to explicit direct play preserves free energy and all material UIDs', async () => {
    await begin(optional()); R.freeCast.add('flow-0'); const before = resources(); materialTarget();
    commands.playDirect('flow-0');
    expect(R.freeCast.has('flow-0')).toBe(true); expect(snapshot().pendingTarget.fuelUids).toEqual([]);
    const final = commands.submitCardPlay('flow-0', 0); await settle();
    expect((await final.settled).status).toBe('committed');
    expect(R.energy).toBe(before.energy); expect(R.hand).toContain('flow-1'); expect(R.infuseFuels).toBe(0);
  });

  it('actual normal-deck material keeps its UID in the unified consumed pile without permanent ownership', async () => {
    await begin(optional(), [], 1);
    expect(R.drawPile.filter(uid => uid.startsWith('normal-sha-'))).toHaveLength(99);
    expect(E.drawCards(1)).toBe(1);
    const temporary = R.hand.find(uid => uid.startsWith('normal-sha-'));
    expect(temporary).toBeTruthy(); const remainingDeck = [...R.drawPile];
    commands.submitCardPlay('flow-0', 0); pick(temporary);
    const final = commands.confirmInfusion(); await settle();
    expect((await final.settled).status).toBe('committed');
    expect(snapshot().consumedPile).toContain(temporary);
    expect(R.consumed).toContain(temporary); expect(R.drawPile).toEqual(remainingDeck);
    expect(game.ownedCards.some(entry => entry.uid === temporary)).toBe(false);
    E.finish(null);
    expect(R.opts.spentCards.some(entry => entry.uid === temporary)).toBe(false);
  });

  it.each(['instance','global'])('%s waiver still bypasses materials and keeps all fuel', async kind => {
    const card = pure(); if (kind === 'instance') card._noInfuse = true;
    await begin(card); R.set$allSpellsInfused(kind === 'global');
    const final = commands.submitCardPlay('flow-0', 0); await settle();
    expect((await final.settled).status).toBe('committed');
    expect(R.hand).toContain('flow-1'); expect(R.infuseFuels).toBe(0);
  });

  it('the target strip returns to the same material UIDs and rejects a late button from an older step', async () => {
    await begin(optional()); materialTarget();
    document.body.innerHTML = '<div class="battle-stage"></div>';
    const stage = document.querySelector('.battle-stage'); stage._battleToken = snapshot().battleToken;
    const returnToInfusion = vi.fn(uid => commands.beginInfusion(uid));
    const cancel = vi.fn();
    const sync = () => syncSelectionPrompt(stage, snapshot(), { getCurrent:() => ({snapshot:snapshot(),stage}),
      findCard:E.findCard, onCancel:cancel, onReturnToInfusion:returnToInfusion });
    sync(); const old = stage.querySelector('[data-act="btPickReturnInfusion"]');
    old.click(); expect(returnToInfusion).toHaveBeenCalledTimes(1);
    expect(snapshot().infusing.picked).toEqual(['flow-1']);
    expect(commands.confirmInfusion().kind).toBe('target');
    old.click(); expect(returnToInfusion).toHaveBeenCalledTimes(1);
    sync(); stage.querySelector('[data-act="btPickReturnInfusion"]').click();
    expect(returnToInfusion).toHaveBeenCalledTimes(2); expect(cancel).not.toHaveBeenCalled();
  });
});

/** Runtime integration for the 2026-10-20 card batch. All state belongs to this battle. */
import { G, pstat, turn, hand, discard, drawPile, equipped, allies, cardOverrides,
  set$hand, energy, set$energy, playedMartialThisTurn, playedMovesThisTurn } from '../runtime/battle.runtime.js';
import * as Combat from '../core/combat.js';
import { Random } from '../../core/random.js';
import { clone } from '../../core/shared.js';
import { chooseMissingCurse, transformChaosDeck, canMindControl, advanceBiphasicAstrolabe,
  soulContractTargets } from './requested-card-batch.js';
import { applyAtkDown } from './effect-steps.m2.js';

const random = () => Random.random('battle');
export function requestedBattleState() {
  return pstat.requestedCards ||= { damageTurn: -1, flameForms: [], astrolabes: {} };
}
export function requestedTargetReason(card, target, foes) {
  if (card?.id !== 'tt13-mind-control') return null;
  if (!foes.some(canMindControl)) return { code:'INVALID_MIND_CONTROL_TARGET', message:'没有受伤的非BOSS敌人可以控制' };
  return target && !canMindControl(target) ? { code:'INVALID_MIND_CONTROL_TARGET', message:'只能选择受伤的非BOSS敌人' } : null;
}
export function recordRequestedDamage(foe, amount, card, { alive, hitFoe }) {
  if (!(amount > 0)) return;
  requestedBattleState().damageTurn = turn;
  const targets = soulContractTargets(foe, alive(), { isMarked: f => f.soulContractMarked, chain: !!card?._soulEcho });
  if (!targets.length) return;
  hitFoe(targets[Math.floor(random() * targets.length)], { name:'灵魂契约', _soulEcho:true }, 2,
    Combat.TYPES.TRUE, '', { preserveBaseDamage:true });
}
export function requestedPlayerDamaged(amount, { alive, hitFoe, drawCards }) {
  if (!(amount > 0) || G.hp <= 0) return;
  for (const equipment of equipped.filter(e => e.card.id === 'tt13-scale-armor')) {
    const targets = alive();
    if (targets.length) hitFoe(targets[Math.floor(random() * targets.length)], equipment.card, 3,
      Combat.TYPES.FIXED, '', { preserveBaseDamage:true });
    if (random() < 0.5) drawCards(1);
  }
}
export function requestedCardPlayed(card) {
  if (card.type === '武术' && playedMartialThisTurn > 0) return;
  if (card.type === '法术' && playedMovesThisTurn - playedMartialThisTurn > 0) return;
  const state = requestedBattleState();
  for (const equipment of equipped.filter(e => e.card.id === 'tt13-astrolabe')) {
    const old = state.astrolabes[equipment.uid] || { firstTurn:turn };
    const result = advanceBiphasicAstrolabe(old, { turn, type:card.type, firstType:'武术', firstTurn:old.firstTurn });
    state.astrolabes[equipment.uid] = { ...result.state, firstTurn:old.firstTurn };
    if (result.refund) set$energy(energy + result.refund);
  }
}
export function requestedInfusion() {
  for (const form of requestedBattleState().flameForms) {
    form.fuel++;
    if (form.fuel % 2 === 0) Combat.addBlessing(pstat, 'spellUp', 1);
  }
}

/** Return true when this batch owns the card's complete resolution. */
export function* resolveRequestedCard(card, target, ports) {
  const id = card.id;
  if (!card.rules?.battle?.hosted?.some(name => name.startsWith('batch13-'))) return false;
  const { hitFoe, drawCards, addArmor, addEnergy, queueDiscover, getAllCards, isRandomObtainable,
    findCard, restoreHeroSkill } = ports;
  if (id === 'tt13-spring') { restoreHeroSkill(); drawCards(1); }
  else if (id === 'tt13-snipe' || id === 'tt13-mercy') {
    if (target && !target.dead && target.hp > 0) {
      yield { kind:'windup', targets:[target] };
      const before = target.hp;
      try {
        hitFoe(target, card, id === 'tt13-snipe' ? 9 : 3, id === 'tt13-snipe' ? 'fixed' : 'attack', '',
          { preserveBaseDamage:id === 'tt13-snipe' });
      } finally {
        // Boss defeat can end staged resolution immediately; the on-kill rider is atomic.
        if (id === 'tt13-snipe' && before > 0 && target.dead && target.hp <= 0) addEnergy(1);
      }
      yield { kind:'hit', segment:1 };
    }
  } else if (id === 'tt13-guard') {
    addArmor(requestedBattleState().damageTurn === turn ? 6 : 10);
  } else if (id === 'tt13-bitter-rain' && target && !target.dead) {
    const cursed = Combat.hasCurse(target);
    Combat.addCurse(target, 'poison', 2);
    if (cursed) {
      const kind = chooseMissingCurse(target.status, Combat.CURSES, random);
      if (kind) { Combat.addCurse(target, kind, 1); if (kind === 'atkDown') applyAtkDown(target, 1); }
    }
  } else if (id === 'tt13-mind-control' && canMindControl(target)) {
    const ally = clone(target);
    delete ally.intent; delete ally.soulContractMarked; delete ally.rotSeedMarked;
    ally.dead = false; ally.boss = false; ally.controlBoss = false;
    allies.push(ally);
    // Removal by conversion deliberately bypasses defeat and on-kill rewards.
    target.dead = true; target.controlled = true;
  } else if (id === 'tt13-soul-contract' && target && !target.dead) target.soulContractMarked = true;
  else if (id === 'tt13-stellar-divination') queueDiscover({ n:1, pred:c => c.type === '法术' && isRandomObtainable(c), act:'stellarCopies' });
  else if (id === 'tt13-chaos-deck') {
    const entries = drawPile.map(uid => ({ uid, card:cardOverrides.get(uid) || findCard(uid)?.card })).filter(e => e.card);
    const transformed = transformChaosDeck(entries.map(e => e.card), getAllCards(), { random, eligible:isRandomObtainable });
    entries.forEach((entry,index) => { cardOverrides.set(entry.uid, clone(transformed[index])); });
    discard.push(...hand); set$hand([]);
  } else if (id === 'cmtn1ntxzoc4') {
    requestedBattleState().flameForms.push({ fuel:0 });
    return false;
  }
  return true;
}

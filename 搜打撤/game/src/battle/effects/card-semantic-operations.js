import { clone } from '../../core/shared.js';
import { createM1Domain } from './effect-steps.m1.domain.js';
import { createM2Domain } from './effect-steps.m2.domain.js';
import { hasEnemyDamageFact } from '../core/battle.facts.js';
import { chooseMissingCurse, transformChaosDeck } from './requested-card-batch.js';

/** @param {{ when?: { infused?: boolean, brokeStealth?: boolean, targetStatus?: string, targetUndamagedBeforeCast?: boolean } }} operation @param {{ infused?: boolean, brokeStealth?: boolean, target?: { status?: Record<string, number>, hp: number, maxHp?: number }, hpAtCast?: Map<object, number> }} [state] */
export function matchesOperationWhen(operation, { infused, brokeStealth, target, hpAtCast } = {}) {
  const when = operation?.when;
  if (!when) return true;
  if (when.infused !== undefined && when.infused !== !!infused) return false;
  if (when.brokeStealth !== undefined && when.brokeStealth !== !!brokeStealth) return false;
  if (when.targetStatus && !(target?.status?.[when.targetStatus] > 0)) return false;
  if (when.targetUndamagedBeforeCast && (!target || (hpAtCast?.get(target) ?? target.hp) < target.maxHp)) return false;
  return true;
}

// The operation chooses behavior. Card IDs are used only to look up named input
// templates; there is no native-card dispatch or display-text interpreter here.
export function createCardSemanticOperations(context) {
  const runtime = context.runtime;
  const combat = context.combat;
  const { resolveDrawHandOps } = createM1Domain(context);
  const { applyAtkDown } = createM2Domain(context);
  return function* resolveSemanticOperation(card, operation, target, ports, execution = {}) {
    if (operation.op === 'discoverCopies') {
      ports.queueDiscover({ n: operation.count, pred: candidate => candidate.type === operation.type && ports.isRandomObtainable(candidate),
        act: 'copyToDeck', copies: operation.copies, castOnDraw: operation.castOnDraw });
      return true;
    }
    if (operation.op === 'schedule') {
      ports.addDelayed({ special: 'triggerOps', ops: clone(operation.ops), srcCard: card,
        cardName: card.name, notBeforeTurn: runtime.turn + operation.delay,
        targetIndex: target ? runtime.foes.indexOf(target) : -1 });
      return true;
    }
    if (operation.op === 'castDrawn') {
      const played = ports.autoPlayHandType(operation.type);
      if (played) ports.log(`[[icon:swords]] <b>${ports.esc(card.name)}</b>：直接释放了其中 ${played} 张${operation.type}`, 'ok');
      return played > 0;
    }
    if (operation.op === 'castStored') { ports.queuePouchCast(execution.uid, card); return true; }
    if (operation.op === 'registerInfusionBonus') {
      const state = runtime.pstat.requestedCards ||= { damageTurn: -1, flameForms: [], astrolabes: {} };
      state.flameForms.push({ fuel: 0, every: operation.every, key: operation.key, stacks: operation.stacks });
      return true;
    }
    if (operation.op === 'transformCards') {
      const entries = runtime.drawPile.map(uid => ({ uid, card: runtime.cardOverrides.get(uid) || ports.findCard(uid)?.card })).filter(entry => entry.card);
      const transformed = transformChaosDeck(entries.map(entry => entry.card), ports.getAllCards(),
        { random: ports.randomBattle, eligible: ports.isRandomObtainable });
      entries.forEach((entry, index) => runtime.cardOverrides.set(entry.uid, clone(transformed[index])));
      return true;
    }
    if (operation.op === 'markEnemy') {
      if (!target || target.dead || target.hp <= 0) return false;
      if (operation.event === 'death') target.deathBurst = {
        status: operation.status, multiplier: operation.multiplier, dmgType: operation.dmgType,
      };
      else target.damageEcho = { amount: operation.amount, dmgType: operation.dmgType, recursive: operation.recursive };
      return true;
    }
    if (operation.op === 'armor' && operation.bonus?.if === 'noEnemyDamageThisTurn') {
      const history = runtime.pstat.requestedCards?.history;
      const causedDamage = history ? hasEnemyDamageFact(history, runtime.turn)
        : runtime.pstat.requestedCards?.damageTurn === runtime.turn;
      ports.addArmor(operation.amount + (causedDamage ? 0 : operation.bonus.amount)); return true;
    }
    if (operation.op === 'curse' && operation.missingBonusIfCursed) {
      if (!target || target.dead) return false;
      const cursed = combat.hasCurse(target);
      combat.addCurse(target, operation.curse, operation.stacks);
      if (cursed) {
        const kind = chooseMissingCurse(target.status, combat.CURSES, ports.randomBattle);
        if (kind) {
          combat.addCurse(target, kind, 1);
          if (kind === 'atkDown') applyAtkDown(target, 1);
        }
      }
      return true;
    }
    if (operation.op === 'acquire' && (['ids', 'types'].includes(operation.pool?.kind) || operation.expire)) {
      const pool = operation.pool.kind === 'ids' ? ports.getAllCards().filter(candidate => operation.pool.ids.includes(candidate.id))
        : operation.pool.kind === 'types' ? ports.getAllCards().filter(candidate => operation.pool.types.includes(candidate.type) && ports.isRandomObtainable(candidate))
          : operation.expire ? ports.getAllCards().filter(candidate => ports.isRandomObtainable(candidate)
            && (runtime.mode !== 'boss' || candidate.type !== '道具')) : null;
      if (pool && !pool.length) {
        ports.log('[[icon:cards]] 当前没有符合本场战斗规则的随机卡牌', 'sys');
        return false;
      }
      const uids = [];
      for (let index = 0; index < operation.n; index++) {
        const selected = pool ? pool[Math.floor(ports.randomBattle() * pool.length)] : ports.randomDiscoverCard(null);
        if (!selected) {
          ports.log('[[icon:cards]] 当前没有符合本场战斗规则的随机卡牌', 'sys');
          break;
        }
        const value = operation.act === 'zeroCost' ? { ...selected, cost: 0, _baseCost: selected.cost || 0 } : selected;
        const uid = ports.addTempCard(value);
        if (uid) {
          uids.push(uid);
          ports.log(`[[icon:cards]] <b>${ports.esc(card.name)}</b>：获得【${ports.esc(selected.name)}】${operation.act === 'zeroCost' ? '（0 费）' : ''}`, 'loot');
        }
      }
      if (operation.expire && uids.length) ports.addDelayed({ special: 'consumeTemps', uids, cardName: card.name });
      return true;
    }
    if (operation.op === 'adjustCurse') {
      const battleCombat = ports.combat || combat;
      const targets = operation.target === 'allEnemies' ? ports.getAliveFoes()
        : operation.target === 'randomEnemy' ? (() => {
          const live = ports.getAliveFoes();
          return live.length ? [live[Math.floor(ports.randomBattle('target') * live.length)]] : [];
        })() : target && !target.dead ? [target] : [];
      if (!targets.length) return false;
      for (const foe of targets) {
        const current = Number(foe.status?.[operation.curse]) || 0;
        if (operation.multiply > 1 && current > 0) battleCombat.addCurse(foe, operation.curse, current * (operation.multiply - 1));
        let total = 0;
        for (let index = 0; index < (operation.burst || 0) && !foe.dead; index++) total += battleCombat.tickPoison(foe)?.dealt || 0;
        ports.log(`[[icon:skull]] <b>${ports.esc(foe.name)}</b>：中毒 ${foe.status?.poison || 0} 层，触发毒伤 ${total}`, 'sys');
      }
      return true;
    }
    if (operation.op === 'restoreHeroSkill') { ports.restoreHeroSkill(); return true; }
    if (operation.op === 'recruitEnemy') {
      if (!target || target.dead || target.hp <= 0 || target.boss || target.controlBoss || !(target.hp < target.maxHp)) return false;
      const ally = clone(target);
      delete ally.intent; delete ally.soulContractMarked; delete ally.rotSeedMarked;
      ally.dead = false; ally.boss = false; ally.controlBoss = false;
      runtime.allies.push(ally);
      target.dead = true; target.controlled = true;
      return true;
    }
    if (operation.op === 'insertCards') {
      const library = ports.getAllCards();
      let count = 0;
      for (const id of operation.ids) {
        const template = library.find(candidate => candidate.id === id);
        if (template) { ports.addDeckCard(template); count++; }
      }
      if (count) {
        ports.shuffleDeck();
        ports.log(`[[icon:recycle]] <b>${ports.esc(card.name)}</b>：将 ${count} 张牌洗入牌库（已洗混）`, 'sys');
      }
      return count > 0;
    }
    if (operation.op === 'fillHand') {
      let spells = 0, put = 0;
      while (ports.getHandSize() < operation.untilHandN) {
        const template = ports.randomDiscoverCard(null);
        if (!template) break;
        const before = ports.getHandSize();
        ports.addTempCard(template);
        if (ports.getHandSize() <= before) break;
        put++;
        if (template.type === '法术') spells++;
      }
      if (spells && operation.perSpellHeal && !(ports.getPlayerStatus().status.healban > 0)) {
        ports.heal(spells * operation.perSpellHeal);
        ports.addFloat({ unit: 'self', text: '', cls: 'stk sticker-heal', warm: true });
      }
      ports.log(`[[icon:cards]] <b>${ports.esc(card.name)}</b>：置入 ${put} 张随机卡牌（手牌 ${ports.getHandSize()}/${operation.untilHandN}）`, 'loot');
      return true;
    }
    if (operation.op === 'castRandomSpells') {
      ports.startSurge(ports.castRandomSpells(operation.count, card.id)); return true;
    }
    if (operation.op === 'equipCapacity') {
      const status = ports.getPlayerStatus().status;
      status.equipCapacityBonus = (status.equipCapacityBonus || 0) + operation.n;
      return true;
    }
    if (operation.op === 'transform' && operation.what === 'starterAttacks') {
      runtime.set$shaTransform(operation.into);
      ports.log(`[[icon:recycle]] <b>战斗规则</b>：你的「初始攻击」在本场战斗中化为【<b>${ports.esc(operation.into)}</b>】`, 'ok');
      return true;
    }
    if (operation.op === 'registerRule' && operation.rule === 'poisonOnSpell') {
      runtime.set$poisonOnSpell(true); return true;
    }
    if (operation.op === 'registerRule' && operation.rule === 'deathSave') {
      runtime.set$deathSave(operation.n); return true;
    }
    if (operation.op === 'registerRule' && operation.rule === 'playerCurseImmune' && operation.duration === 1) {
      const prior = runtime.playerCurseImmune;
      runtime.set$playerCurseImmune(true);
      if (!runtime.delayed.some(entry => entry.special === 'curseImmuneOff')) {
        runtime.delayed.push({ special: 'curseImmuneOff', restore: !!prior });
      }
      return true;
    }
    if (operation.op === 'release') {
      if (operation.source === 'generated') return ports.castStarterAttack(target);
      return ports.releaseHandMatches(operation.key === '初始攻击' ? '杀' : operation.key,
        operation.eachDraw || 0, operation.max) > 0;
    }
    if (operation.op === 'consumeHand') {
      if (operation.trigger === false) {
        runtime.discard.push(...runtime.hand); runtime.set$hand([]); return true;
      }
      yield* resolveDrawHandOps(card, [{ op: 'consumeHand' }], ports); return true;
    }
    if (operation.op === 'handSelect') {
      ports.queueHandSelect({ n: operation.n, type: operation.type || null,
        act: operation.act === 'zeroNext' ? 'zero' : operation.act,
        ...(execution.onHandSelectDone ? { onDone: execution.onHandSelectDone } : {}) });
      return true;
    }
    if (operation.op === 'swapDiscoverCosts') { ports.queueSwapCostDiscover(); return true; }
    return null;
  };
}

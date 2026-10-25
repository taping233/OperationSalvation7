import { usesNonLethalDamage, doublesLegacyBleed } from '../../cards/card-legacy-battle-policy.js';
import { esc } from '../../core/shared.js';
import { dealMeasuredDamage } from './battle.measured-damage.js';

/** Instance-owned state and host services are captured explicitly. */
export function createDamageDomain(context) {

const Combat = context.combat;
/** Enemy damage boundary shared by card hits and prepared effect damage.
 * Owns protection, heart conversion, bonuses and feedback ordering; Combat remains the numerical rule kernel.
 * readState is live so recursive requested damage and defeat callbacks observe the same battle.
 */
function createBattleDamage({ readState, sound, alive, recordRequestedDamage, resolveFoeDefeat }) {
  // 敌人免伤判定（异能领主：偶数回合全免伤，破甲克制）
  function aegisBlocked(foe) {
    return foe.affix === 'aegis' && readState().turn % 2 === 0 && (foe.status.abreak || 0) <= 0;
  }

  // 敌人数组下标（飘字特效用）：按对象引用找 idx
  function foeIdx(foe) { return readState().foes.indexOf(foe); }

  // 两种生命计量共用：只有实际造成伤害才破除自己的潜行。
  function breakOwnStealthOnDamage(dealt) {
    if (dealt > 0 && Combat.breakStealth(readState().pstat)) {
      readState().G.log('[[icon:runner]] 你造成了伤害，<b>潜行</b>被破除', 'dim');
    }
  }

  function foeDamageBlocked(foe, card, seg) {
    if (foe.dead) return true;
    // 龙巢：风暴之手存活时，元素领主不可被招式指定（全场命中统一拦截）
    if (foe.protected && readState().foes.some(p => !p.dead && p.protects)) {
      if (card && card.name && card.name !== '?') {
        readState().floats.push({ unit: foeIdx(foe), text: '庇护', cls: 'block' });
        readState().G.log(`[[icon:shield]] <b>风暴之手</b>庇护着 <b>${esc(foe.name)}</b>——伤害被完全偏转`, 'warn');
      }
      return true;
    }
    if (aegisBlocked(foe)) {
      sound('parry');
      readState().floats.push({ unit: foeIdx(foe), text: '免伤', cls: 'block' });
      readState().G.log(`[[icon:crystal]] ${seg || ''}<b>${esc(foe.name)}</b> 的元素庇幕展开：伤害被完全减免！（破甲可击碎）`, 'warn');
      return true;
    }
    return false;
  }

  // 提交已经准备好数值的一段伤害。文本、结构化牌效和敌人互殴共用目标防御与心数口径。
  function commitFoeDamage(foe, card, attacker, amount, type, multiplier = 1) {
    const result = dealMeasuredDamage(Combat, attacker, foe, amount, type, { nonLethal: usesNonLethalDamage(card), multiplier });
    recordRequestedDamage(foe, result.dealt, card, { alive, hitFoe });
    return result;
  }

  function dealEffectDamage({ caster, target, amount, type, card, source = 'player' }) {
    if (foeDamageBlocked(target, card)) return { dealt: 0, log: [] };
    const result = commitFoeDamage(target, card, caster, amount, type);
    if (source === 'player') breakOwnStealthOnDamage(result.dealt);
    return result;
  }

  // 对单个敌人结算一次伤害（含潜行/免伤/死亡处理），返回实际伤害。
  function hitFoe(foe, card, amount, type, seg, { preserveBaseDamage = false, deferDefeat = false } = {}) {
    if (foeDamageBlocked(foe, card, seg)) return 0;
    // 破隐一击（白梅落影·妄）：自己处于潜行中发动的攻击伤害 ×2
    const stealthedBefore = Combat.isStealthed(readState().pstat);
    let amt = amount;
    const multiplier = !preserveBaseDamage && readState().stealthStrike && stealthedBefore ? 2 : 1;
    if (multiplier > 1) readState().G.log('[[icon:runner]] <b>破隐一击</b>：从潜行中发动，本段伤害翻倍', 'ok');
    // 法伤加成（含祝福）；「受法伤加成翻倍」（爆燃火球）在此翻倍。
    // 2026-09-09 修复：spellUp 不再预加进 spellPower——dealDamage 会从 status 再加一次，
    // 此前法术强化被双重计数；现在 bonus 一次性算清并置空 status.spellUp，卡面显示口径一致
    let sp = (readState().G.spellPower || 0) + ((readState().pstat && readState().pstat.status.spellUp) || 0);
    if (card && /受法伤加成翻倍/.test(String(card.desc || ''))) sp *= 2;
    const statusForHit = (readState().pstat && readState().pstat.status)
      ? Object.assign({}, readState().pstat.status, { spellUp: 0 })
      : { spellUp: 0 };
    // 「对冰冻角色伤害 +N」（寒冰剑）：目标被冰冻时追加
    const frzM = card && String(card.desc || '').match(/对冰冻[^。]*?伤害\s*\+\s*(\d+)/);
    if (!preserveBaseDamage && frzM && (foe.status.freeze || 0) > 0) amt += +frzM[1];
    // M3：装备被动 cond.vsFreeze（寒冰剑「对冰冻角色伤害 +N」）——穿戴中即对任何攻击生效
    if (!preserveBaseDamage) for (const eq of readState().equipped) {
      const vsFreeze = eq?.card?.rules?.equip?.passive?.cond?.vsFreeze;
      if (Number.isInteger(vsFreeze) && vsFreeze > 0 && (foe.status.freeze || 0) > 0) {
        amt += vsFreeze;
        readState().G.log(`[[icon:crystal]] 【${esc(eq.card.name)}】对冰冻目标伤害 +${vsFreeze}`, 'sys');
      }
    }
    // 「触发的流血伤害翻倍」（飞身劈）：流血加成部分再叠一次。
    // M2：registerRule bleedAmp 旗标（readState().pstat.status.bleedAmp）——结构化规则的同一翻倍口径
    if (!preserveBaseDamage && type === Combat.TYPES.ATTACK && card && doublesLegacyBleed(card) && (foe.status.bleed || 0) > 0) {
      amt += foe.status.bleed;
      readState().G.log(`[[icon:blood]] <b>流血伤害翻倍</b>：流血加成 ${foe.status.bleed} → ${foe.status.bleed * 2}`, 'sys');
    } else if (!preserveBaseDamage && type === Combat.TYPES.ATTACK && (readState().pstat.status.bleedAmp || 0) > 0 && (foe.status.bleed || 0) > 0) {
      amt += foe.status.bleed;
      readState().G.log(`[[icon:blood]] <b>流血伤害翻倍</b>（持续规则）：流血加成 ${foe.status.bleed} → ${foe.status.bleed * 2}`, 'sys');
    }
    // 攻击强化祝福（atkUp）经 status 传入结算（此前 hitFoe 未带 status，攻击 blessings 未生效）；
    // spellUp 已并入 sp，传 statusForHit 防止二次叠加
    // 龙巢·暗羁绊：暗3 对敌人伤害 +1；暗1 对半血敌伤害 +1
    if (!preserveBaseDamage && amt > 0) {
      if (readState().nestSyn.dark3) amt += 1;
      else if (readState().nestSyn.dark1 && foe.maxHp && foe.hp <= foe.maxHp / 2) amt += 1;
    }
    // 龙巢·心（heartsMode）：1-7 点伤害 -1 心、8+ 点 -2 心；破甲时心视作血量（1:1）；
    // 真实伤害 N 点直接 -N 心。
    // 2026-09-18 第1局实测修复：心数此前按卡面基础伤害值折算——「初始攻击」等 0 伤卡
    // 永远击碎 0 心，龙巢战斗根本打不死敌人。改为先用影子目标试算最终伤害
    // （含攻击力/法伤加成与护甲减免），再按上述规则折算心数。
    if (foe.heartsMode) {
      const hpBefore = foe.hp;
      const isTrue = type === Combat.TYPES.TRUE;
      const abreakOn = (foe.status.abreak || 0) > 0;
      const { dealt: loss } = commitFoeDamage(foe, card, { atk: readState().G.atk, spellPower: sp, status: statusForHit }, amt, type, multiplier);
      if (loss > 0) readState().floats.push({ unit: foeIdx(foe), text: '-' + loss + '♥', cls: 'dmg', type,
        hpBefore, hpAfter: foe.hp, maxHp: foe.maxHp });
      readState().G.log(`[[icon:play]] <b>${esc(card.name)}</b> → ${esc(foe.name)}：${isTrue || abreakOn ? '真伤/破甲，' : ''}击碎 <b>${loss}</b> 颗心（余 ${Math.max(0, foe.hp)} 心）`, 'sys');
      breakOwnStealthOnDamage(loss);
      if (!deferDefeat) resolveFoeDefeat(foe);
      return loss;
    }
    const hpBefore = foe.hp;
    const shieldBefore = foe.defense?.shield || 0;
    const r = commitFoeDamage(foe, card, { atk: readState().G.atk, spellPower: sp, status: statusForHit }, amt, type, multiplier);
    if (r.stealthed) {
      sound('parry');
      readState().floats.push({ unit: foeIdx(foe), text: '未命中', cls: 'block' });
      readState().G.log(`[[icon:runner]] ${seg || ''}<b>${esc(foe.name)}</b> 处于<b>潜行</b>中：无法成为被攻击对象！`, 'warn');
      return 0;
    }
    const shieldBreak = shieldBefore > 0 && !(foe.defense?.shield || 0);
    if (r.dealt > 0 || shieldBreak) readState().floats.push({
      unit: foeIdx(foe), text: r.dealt > 0 ? '-' + r.dealt : '护盾破碎',
      cls: r.dealt > 0 ? 'dmg' : 'block', type, shieldBreak,
      ...(r.dealt > 0 ? { hpBefore, hpAfter: foe.hp, maxHp: foe.maxHp } : {}),
    });
    readState().G.log(`[[icon:play]] <b>${esc(card.name)}</b>${seg || ''} → ${esc(foe.name)}：造成 <b>${r.dealt}</b> 点${Combat.TYPE_NAME[type]}` +
      (r.log.length ? `（${r.log.join('，')}）` : ''), 'sys');
    breakOwnStealthOnDamage(r.dealt);
    if (!deferDefeat) resolveFoeDefeat(foe);
    return r.dealt;
  }

  return { aegisBlocked, foeIdx, dealEffectDamage, hitFoe };
}
return { createBattleDamage };
}

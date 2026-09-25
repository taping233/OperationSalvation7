import * as Combat from './combat.js';

const SEMANTICS = Object.freeze({
  'starter-attack': ['武术', 'attack', 0, '攻(+0):造成等同于攻击力的伤害', 1],
  'tt7-sneak': ['武术', 'attack', -1, '攻(-1)', 1],
  'tt3-reshot': ['武术', 'attack', 2, '攻(+2)', 1],
  'tt2-shoot': ['武术', 'fixed', 2, '造成2点伤害', 1],
  'tt3-fireball': ['法术', 'spell', 4, '造成4点法术伤害', 1],
  'cmtna0nb1yxt': ['法术', 'spell', 5, '5点法术伤害', 1],
  'tt3-double-shot': ['武术', 'fixed', 2, '造成2点固定伤害,触发3次', 3],
  'tt3-chain-lightning': ['法术', 'spell', 3, "3',触发2次", 2],
  'tt7-meteorrain': ['武术', 'attack', -1, '攻(-1),触发2次', 2],
});

function normalizeDesc(value) {
  return String(value || '').trim()
    .replace(/[（]/g, '(').replace(/[）]/g, ')').replace(/[：]/g, ':')
    .replace(/[；;]/g, ',').replace(/[，]/g, ',').replace(/[′‘’]/g, "'")
    .replace(/\s+/g, '').replace(/[。.]+$/g, '');
}

// B1/B2（2026-09-25）：结构化 damage op → 预览规格。纯字面量/字段伤害（amount/amountField）
// 加确定段数（hitCount/hits.count）可精确预演；条件（cond）、增伤（bonus）、区间（range）、
// 吸血、随机目标/随机段数、墓地/重施/延迟一律降级 unknown——宁可不给数字，不给错数字。
// 与解释器（battle.resolution.js castSegment）共享语义口径：amount 与 card.dmg 由 schema 强制一致，
// growth 由 cardContext.damageGrowth 通道承担（>0 时 previewAction 已降级 unknown）。
function structuredDamageSpec(card) {
  const operation = card?.rules?.triggers?.onPlay?.find(item => item && item.op === 'damage');
  if (!operation) return null;
  const unstable = operation.range !== undefined || operation.cond !== undefined || operation.bonus !== undefined ||
    operation.lifesteal === true || operation.graveyard !== undefined || operation.recast !== undefined ||
    operation.schedule !== undefined || operation.target === 'randomEnemy' ||
    (operation.hits != null && (operation.hits.range !== undefined || operation.hits.perFoe !== undefined));
  if (unstable) return { unknown: true };
  // target 未声明时解释器按「倒下顺延战场首位」结算——预览按 retarget 式逐段转移处理
  const retarget = operation.retarget === 'livingFoes' || operation.target === undefined;
  const countSource = operation.hitCount ?? operation.hits?.count;
  if (countSource !== undefined && (!Number.isInteger(countSource) || countSource < 1)) return { unknown: true };
  const hits = Math.max(1, Math.floor(countSource || 1));
  if (operation.amount !== undefined) {
    return Number.isFinite(+operation.amount) ? { hits, retarget, amount: +operation.amount } : { unknown: true };
  }
  if (operation.amountField === 'dmg' && !Number.isFinite(+card.dmg)) return { unknown: true };
  return { hits, retarget };
}

function semanticMatch(card) {
  const structured = structuredDamageSpec(card);
  if (structured) return structured;
  const spec = card && SEMANTICS[card.id];
  if (!spec) return null;
  return card.type === spec[0] && card.dmgType === spec[1] && +card.dmg === spec[2]
    && normalizeDesc(card.desc) === spec[3] ? { hits: spec[4] } : null;
}

function cardRuleHint(card) {
  if (!card) return '';
  const operation = card.rules?.triggers?.onPlay?.find(item => item.op === 'damage' && item.retarget === 'livingFoes');
  if (!operation) return '';
  const payment = card.rules?.battle?.requirements?.find(rule => rule.kind === 'handCards');
  return payment
    ? `先消耗 ${payment.count} 张${payment.type || '手牌'}；${operation.hitCount} 段，目标倒下后按战场顺序转移。`
    : `${operation.hitCount} 段；目标倒下后按战场顺序转移。`;
}

function cloneTarget(foe) {
  return {
    hp: +foe.hp || 0,
    status: { ...(foe.status || {}) },
    defense: { shield: +(foe.defense?.shield || 0), armor: +(foe.defense?.armor || 0), guard: !!foe.defense?.guard },
  };
}

function unknown(cost, targets, reason) {
  return Object.freeze({ legal: true, cost, targetIndexes: targets, confidence: 'unknown', damage: null,
    knownEffects: Object.freeze([]), unknownEffects: Object.freeze([]), reasons: Object.freeze([reason]) });
}

function illegal(cost, targets, reason) {
  return Object.freeze({ legal: false, cost, targetIndexes: targets, confidence: 'unknown', damage: null,
    knownEffects: Object.freeze([]), unknownEffects: Object.freeze([]), reasons: Object.freeze([reason]) });
}

function previewAction({ snapshot, action, cardContext }) {
  const uid = action?.uid;
  const targetIndex = +action?.targetIndex;
  const card = cardContext?.card;
  const foe = snapshot?.foes?.[targetIndex];
  const targets = (cardContext?.targetIndexes || []).slice();
  const cost = +(cardContext?.effectiveCost ?? card?.cost ?? 0);
  const frozenTargets = Object.freeze(targets);
  if (!card || !uid || !foe || foe.dead) return illegal(cost, frozenTargets, '当前目标不可用');
  if (cardContext.legal === false) return illegal(cost, frozenTargets, cardContext.illegalReason || '当前不能打出这张牌');
  if (!targets.includes(targetIndex)) return illegal(cost, frozenTargets, '当前目标不可用');
  if (cardContext.heartsMode) return unknown(cost, frozenTargets, '心形生命的伤害换算暂不支持预览');
  if (cardContext.shaTransformed) return unknown(cost, frozenTargets, '这张初始攻击将变为另一张牌结算');
  if (cardContext.modifiers?.stealthStrike) return unknown(cost, frozenTargets, '破隐一击会改变本次伤害');
  if (cardContext.modifiers?.nestDark1 || cardContext.modifiers?.nestDark3) return unknown(cost, frozenTargets, '黑暗羁绊会逐段改变伤害');
  if (cardContext.modifiers?.allSpellsInfused || cardContext.selectedFuelUids?.length) return unknown(cost, frozenTargets, '注能会改变这张牌的伤害');
  if ((cardContext.wholeCardRepeats || 1) !== 1) return unknown(cost, frozenTargets, '这张牌会整体重复结算');
  if (cardContext.arrowRuneRepeat) return unknown(cost, frozenTargets, '箭矢符文会重复结算这张牌');

  // 只计算通过语义验证的伤害流程。非白名单、随机、AOE、状态前置或任何字段被改写的卡
  // 都不猜测段数和结算顺序；带 v2 条件/区间/增伤的结构化伤害降级 unknown（不猜数字）。
  const exactSpec = semanticMatch(card);
  if (!exactSpec) return unknown(cost, frozenTargets, '这张牌的伤害流程暂不支持预览');
  if (exactSpec.unknown) return unknown(cost, frozenTargets, '这张牌带有条件/区间/随机伤害效果，暂不支持精确预览');
  if (cardContext.damageGrowth > 0) return unknown(cost, frozenTargets, '本场成长会改变这张牌的伤害');
  if (!Combat.TYPE_NAME[card.dmgType] || (!Number.isFinite(+card.dmg) && exactSpec.amount === undefined)) {
    return unknown(cost, frozenTargets, '这张牌没有可预览的固定伤害流程');
  }

  const hitsPlanned = exactSpec.hits;
  const hasRetargetSpecial = exactSpec.retarget && hitsPlanned > 1 && snapshot.foes.some((candidate, index) => index !== targetIndex
    && !candidate.dead && candidate.hp > 0
    && (candidate.heartsMode || candidate.protected || candidate.affix === 'aegis'));
  if (hasRetargetSpecial) return unknown(cost, frozenTargets, '后续转向目标带有特殊免伤或生命规则，无法精确预览');
  const targetsByIndex = snapshot.foes.map(cloneTarget);
  const target = targetsByIndex[targetIndex];
  const hpBefore = target.hp;
  const shieldBefore = target.defense.shield;
  const armorBefore = target.defense.armor;
  const dodgeBefore = +(target.status.dodge || 0);
  const hits = [];
  const targetIndexesByHit = [];
  const defeatedTargetIndexes = [];
  const logs = [];
  if (cardContext.targetProtected || cardContext.aegisBlocked) {
    for (let i = 0; i < hitsPlanned; i++) { hits.push(0); targetIndexesByHit.push(targetIndex); }
  } else {
    const attacker = { atk: +(snapshot.player?.atk || 0), spellPower: +(snapshot.player?.spellPower || 0), status: { ...(snapshot.pstat?.status || {}) } };
    const amount = (exactSpec.amount ?? (+card.dmg || 0)) + (+cardContext.damageGrowth || 0);
    let currentIndex = targetIndex;
    for (let i = 0; i < hitsPlanned; i++) {
      if (!exactSpec.retarget && target.hp <= 0) break;
      let hitIndex = currentIndex;
      if (exactSpec.retarget && targetsByIndex[hitIndex].hp <= 0) hitIndex = targetsByIndex.findIndex((t, index) => snapshot.foes[index] && !snapshot.foes[index].dead && t.hp > 0);
      if (hitIndex < 0 || !targetsByIndex[hitIndex]) break;
      const hitTarget = targetsByIndex[hitIndex];
      const hpBeforeHit = hitTarget.hp;
      const result = Combat.dealDamage(attacker, hitTarget, amount, card.dmgType);
      hits.push(result.dealt);
      targetIndexesByHit.push(hitIndex);
      if (hpBeforeHit > 0 && hitTarget.hp <= 0) defeatedTargetIndexes.push(hitIndex);
      logs.push(...result.log);
      currentIndex = hitIndex;
    }
  }
  const total = hits.reduce((sum, value) => sum + value, 0);
  return Object.freeze({
    legal: true, cost, targetIndexes: frozenTargets, confidence: 'exact',
    damage: Object.freeze({ type: card.dmgType, hits: Object.freeze(hits), targetIndexesByHit: Object.freeze(targetIndexesByHit),
      defeatedTargetIndexes: Object.freeze(defeatedTargetIndexes), total, hpBefore, hpAfter: target.hp,
      lethal: hpBefore > 0 && target.hp <= 0, shieldBefore, shieldAfter: target.defense.shield,
      armorBefore, armorAfter: target.defense.armor, dodgeBefore, dodgeAfter: +(target.status.dodge || 0),
      blockedBy: cardContext.targetProtected ? 'protected' : cardContext.aegisBlocked ? 'aegis' : null,
      notes: Object.freeze([...new Set(logs)]), }),
    knownEffects: Object.freeze(['damage']), unknownEffects: Object.freeze([]), reasons: Object.freeze([]),
  });
}

export { cardRuleHint, normalizeDesc, previewAction, semanticMatch };

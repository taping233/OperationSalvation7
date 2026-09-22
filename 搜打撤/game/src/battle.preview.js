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

function semanticMatch(card) {
  const spec = card && SEMANTICS[card.id];
  if (!spec) return null;
  return card.type === spec[0] && card.dmgType === spec[1] && +card.dmg === spec[2]
    && normalizeDesc(card.desc) === spec[3] ? { hits: spec[4] } : null;
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

  // 只计算通过完整语义指纹验证的有限白名单。非白名单、随机、AOE、
  // 状态前置或任何字段被改写的卡都不猜测段数和结算顺序。
  const exactSpec = semanticMatch(card);
  if (!exactSpec) return unknown(cost, frozenTargets, '这张牌的伤害流程暂不支持预览');
  if (cardContext.damageGrowth > 0) return unknown(cost, frozenTargets, '本场成长会改变这张牌的伤害');
  if (!Combat.TYPE_NAME[card.dmgType] || !Number.isFinite(+card.dmg)) return unknown(cost, frozenTargets, '这张牌没有可预览的固定伤害流程');

  const hitsPlanned = exactSpec.hits;
  const target = cloneTarget(foe);
  const hpBefore = target.hp;
  const shieldBefore = target.defense.shield;
  const armorBefore = target.defense.armor;
  const dodgeBefore = +(target.status.dodge || 0);
  const hits = [];
  const logs = [];
  if (cardContext.targetProtected || cardContext.aegisBlocked) {
    for (let i = 0; i < hitsPlanned; i++) hits.push(0);
  } else {
    const attacker = { atk: +(snapshot.player?.atk || 0), spellPower: +(snapshot.player?.spellPower || 0), status: { ...(snapshot.pstat?.status || {}) } };
    const amount = (+card.dmg || 0) + (+cardContext.damageGrowth || 0);
    for (let i = 0; i < hitsPlanned && target.hp > 0; i++) {
      const result = Combat.dealDamage(attacker, target, amount, card.dmgType);
      hits.push(result.dealt);
      logs.push(...result.log);
    }
  }
  const total = hits.reduce((sum, value) => sum + value, 0);
  return Object.freeze({
    legal: true, cost, targetIndexes: frozenTargets, confidence: 'exact',
    damage: Object.freeze({ type: card.dmgType, hits: Object.freeze(hits), total, hpBefore, hpAfter: target.hp,
      lethal: hpBefore > 0 && target.hp <= 0, shieldBefore, shieldAfter: target.defense.shield,
      armorBefore, armorAfter: target.defense.armor, dodgeBefore, dodgeAfter: +(target.status.dodge || 0),
      blockedBy: cardContext.targetProtected ? 'protected' : cardContext.aegisBlocked ? 'aegis' : null,
      notes: Object.freeze([...new Set(logs)]), }),
    knownEffects: Object.freeze(['damage']), unknownEffects: Object.freeze([]), reasons: Object.freeze([]),
  });
}

export { normalizeDesc, previewAction, semanticMatch };

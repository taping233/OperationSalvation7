// @ts-check
import * as Combat from '../core/combat.js';
import { dealMeasuredDamage } from '../core/battle.measured-damage.js';

/** @typedef {import('../battle.snapshot.types.js').SnapshotBattleCard} SnapshotBattleCard */
/** @typedef {import('../battle.snapshot.types.js').SnapshotFoe} SnapshotFoe */
/** @typedef {import('../battle.snapshot.types.js').PreviewActionInput} PreviewActionInput */
/** @typedef {import('../battle.snapshot.types.js').PreviewResult} PreviewResult */
/** @typedef {import('../battle.snapshot.types.js').PreviewDamageSpec} PreviewDamageSpec */

/** @type {Readonly<Record<string, readonly [string, string, number, string, number]>>} */
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

/** @param {unknown} value */
function normalizeDesc(value) {
  return String(value || '').trim()
    .replace(/[（]/g, '(').replace(/[）]/g, ')').replace(/[：]/g, ':')
    .replace(/[；;]/g, ',').replace(/[，]/g, ',').replace(/[′‘’]/g, "'")
    .replace(/\s+/g, '').replace(/[。.]+$/g, '');
}

/** @type {Record<string, string>} */
const DAMAGE_TYPE_NAMES = Combat.TYPE_NAME;

const EXACT_DAMAGE_KEYS = new Set(['op', 'amount', 'amountField', 'target', 'hitCount', 'hits', 'retarget', 'infuseBonus', 'perInfusedInHand', 'spellPowerMul', 'when']);
const FOLLOWUP_OPS = new Set(['curse', 'draw', 'cleanse', 'registerRule', 'blessing', 'armor', 'heal', 'coins']);

// 只接纳完整扫描后可证明的单个 damage op；新参数默认降级，不能忽略后再宣称精确。
// 后置抽牌/附加状态与时点触发不计入此处直接伤害，并通过 unknownEffects 明示。
/** @param {SnapshotBattleCard | null | undefined} card @returns {PreviewDamageSpec | null} */
function structuredDamageSpec(card) {
  const triggers = card?.rules?.triggers;
  if (!triggers) return null;
  const operations = triggers.onPlay;
  if (!Array.isArray(operations)) return { unknown: true };
  const damageOps = operations.filter(item => item?.op === 'damage');
  if (damageOps.length !== 1) return { unknown: true, reason: '包含多个或未声明的直接伤害流程，暂未完整预演' };
  const operation = damageOps[0];
  if (operation.when && (Object.keys(operation.when).some(key => key !== 'infused') || typeof operation.when.infused !== 'boolean')) return { unknown: true };
  for (const key of ['infuseBonus', 'perInfusedInHand', 'spellPowerMul']) if (operation[key] !== undefined && !Number.isFinite(operation[key])) return { unknown: true };
  if (Object.keys(operation).some(key => !EXACT_DAMAGE_KEYS.has(key)) ||
      (operation.target !== undefined && !['chosenEnemy', 'allEnemies'].includes(operation.target)) ||
      (operation.retarget !== undefined && operation.retarget !== 'livingFoes') ||
      (operation.hitCount !== undefined && operation.hits !== undefined) ||
      (operation.hits !== undefined && (!operation.hits || typeof operation.hits !== 'object' ||
        Object.keys(operation.hits).some(key => key !== 'count')))) {
    return { unknown: true, reason: '伤害含尚未预演的条件、动态参数或目标流程' };
  }
  if (operations.some(item => !item || (item.op !== 'damage' &&
      (!FOLLOWUP_OPS.has(item.op || '') || item.burst !== undefined || item.pick !== undefined || item.schedule !== undefined)))) {
    return { unknown: true, reason: '包含尚未预演的额外伤害或后续施放流程' };
  }
  const sources = ['amount', 'amountField'].filter(key => operation[key] !== undefined);
  if (sources.length !== 1 || (operation.amountField !== undefined && operation.amountField !== 'dmg')) return { unknown: true };
  const unknownEffects = operations.length > 1 || Object.keys(triggers).some(key => key !== 'onPlay' && key !== 'duration')
    ? ['仅计算直接伤害；附加效果及后续触发未计入'] : [];
  if (operations.some(item => item.op === 'draw')) unknownEffects.push('敌人全灭时停止余下效果');
  // target 未声明时解释器按「倒下顺延战场首位」结算——预览按 retarget 式逐段转移处理
  const retarget = operation.retarget === 'livingFoes' || operation.target === undefined;
  const countSource = operation.hitCount ?? operation.hits?.count;
  if (countSource !== undefined && typeof countSource !== 'number') return { unknown: true };
  const numericCount = typeof countSource === 'number' ? countSource : undefined;
  if (numericCount !== undefined && (!Number.isInteger(numericCount) || numericCount < 1)) return { unknown: true };
  const hits = Math.max(1, Math.floor(numericCount || 1));
  if (operation.amount !== undefined) {
    const amount = Number(operation.amount);
    return Number.isFinite(amount) ? { hits, retarget, amount, unknownEffects } : { unknown: true };
  }
  if (operation.amountField === 'dmg' && !Number.isFinite(Number(card?.dmg))) return { unknown: true };
  return { hits, retarget, unknownEffects };
}

/** @param {SnapshotBattleCard} card @param {PreviewActionInput['cardContext']} context @returns {PreviewDamageSpec | null} */
function hostedDamageSpec(card, context) {
  if (card.id !== 'tt7-arcanebolt') return null;
  const rules = card.rules;
  const hosted = rules?.battle?.hosted;
  if (context.mode !== 'normal' || !context.hostedExecutionVerified ||
      card.type !== '法术' || card.dmgType !== 'spell' || typeof card.dmg !== 'number' || !Number.isFinite(card.dmg) || card.dmg <= 0 ||
      !rules || Object.keys(rules).some(key => !['version', 'battle'].includes(key)) ||
      Object.keys(rules.battle || {}).some(key => key !== 'hosted') ||
      !Array.isArray(hosted) || hosted.length !== 1 || hosted[0] !== 'damage-and-draw' ||
      normalizeDesc(card.desc) !== "1',抽1张牌") return { unknown: true };
  return { hits: 1, amount: card.dmg, unknownEffects: ['仅计算直接伤害；后续抽牌与触发未计入；敌人全灭时停止余下效果'] };
}

/** @param {SnapshotBattleCard | null | undefined} card @param {PreviewActionInput['cardContext']} context @returns {PreviewDamageSpec | null} */
function semanticMatch(card, context) {
  if (!card) return null;
  const structured = structuredDamageSpec(card);
  if (structured && !card.rules?.battle?.hosted) {
    // 奥术弹的 BOSS 抽牌后续仍沿原有保守预览边界。
    if (card.id === 'tt7-arcanebolt' && context.mode !== 'normal') return { unknown: true };
    return structured;
  }
  const hosted = hostedDamageSpec(card, context);
  if (hosted) return hosted;
  if (card.rules?.equip || card.rules?.bag || card.rules?.battle?.hosted) return null;
  const spec = card.id ? SEMANTICS[card.id] : undefined;
  if (!spec) return null;
  return card.type === spec[0] && card.dmgType === spec[1] && Number(card.dmg) === spec[2]
    && normalizeDesc(card.desc) === spec[3] ? { hits: spec[4] } : null;
}

/** @param {SnapshotBattleCard | null | undefined} card @param {string} [mode] */
function cardRuleHint(card, mode) {
  if (!card) return '';
  const operation = card.rules?.triggers?.onPlay?.find(item => item.op === 'damage' && item.retarget === 'livingFoes');
  const onPlay = card.rules?.triggers?.onPlay;
  const drawsByType = onPlay
    ? onPlay.some(item => item.op === 'draw' && item.filter)
    : /从牌库中抽取\s*(\d+)\s*张?(初始攻击|装备|法术|武术|杀)牌?/.test(card.desc || '');
  const drawHint = mode === 'normal' && drawsByType ? '从本场牌库抽取符合类型的牌。' : '';
  if (!operation) return drawHint;
  const payment = card.rules?.battle?.requirements?.find(rule => rule.kind === 'handCards');
  const damageHint = payment
    ? `先消耗 ${payment.count} 张${payment.type || '手牌'}；${operation.hitCount} 段，目标倒下后按战场顺序转移。`
    : `${operation.hitCount} 段；目标倒下后按战场顺序转移。`;
  return [drawHint, damageHint].filter(Boolean).join(' ');
}

const STATUS_TARGET_LABELS = Object.freeze({ chosenEnemy: '目标', allEnemies: '所有敌人', self: '自己' });

// 仅展示结构化声明，不模拟状态施加、免疫、重复结算或后续触发。
// 未知字段不忽略；不从卡名或自由描述推断效果，更不把无 damage op 当成 0 伤害。
/** @param {SnapshotBattleCard} card @param {string} [mode] */
function declaredStatusEffects(card, mode) {
  const operations = card.rules?.triggers?.onPlay;
  if (!Array.isArray(operations) || !operations.length || card.rules?.battle?.hosted) return null;
  const effects = [];
  for (const operation of operations) {
    if (!operation) return null;
    if (operation.op === 'armor' || operation.op === 'draw') {
      if (Object.keys(operation).some(key => !['op', 'amount'].includes(key)) ||
          !Number.isInteger(operation.amount) || operation.amount <= 0) return null;
      effects.push(operation.op === 'armor' ? `自己获得 ${operation.amount} 点护甲`
        : mode === 'normal' ? `从本场牌库抽 ${operation.amount} 张牌` : `抽 ${operation.amount} 张牌`);
    } else if (operation.op === 'curse') {
      if (Object.keys(operation).some(key => !['op', 'curse', 'stacks', 'duration', 'extend', 'target'].includes(key))) return null;
      if (typeof operation.curse !== 'string' || !Object.hasOwn(Combat.CURSE_META, operation.curse) ||
          typeof operation.target !== 'string' || !Object.hasOwn(STATUS_TARGET_LABELS, operation.target)) return null;
      const meta = Combat.CURSE_META[/** @type {keyof typeof Combat.CURSE_META} */ (operation.curse)];
      const target = STATUS_TARGET_LABELS[/** @type {keyof typeof STATUS_TARGET_LABELS} */ (operation.target)];
      if (!meta || operation.curse === 'atkDown' || !target) return null;
      const amount = meta.stack ? operation.stacks : operation.duration;
      if (!Number.isInteger(amount) || amount <= 0 ||
          (meta.stack ? operation.duration !== undefined : operation.stacks !== undefined)) return null;
      if (operation.extend !== undefined) {
        if (meta.stack || !Number.isInteger(operation.extend) || operation.extend <= 0) return null;
        effects.push(`${target}已有的${meta.name}延长 ${operation.extend} 回合（未附带时无效）`);
      } else effects.push(`${target}附加 ${amount} ${meta.stack ? '层' : '回合'}${meta.name}`);
    } else return null;
  }
  return effects;
}

/** @param {SnapshotFoe} foe */
function cloneTarget(foe) {
  return {
    hp: +foe.hp || 0, heartsMode: !!foe.heartsMode, damageCap: foe.damageCap,
    status: { ...(foe.status || {}) },
    defense: { shield: +(foe.defense?.shield || 0), armor: +(foe.defense?.armor || 0), guard: !!foe.defense?.guard },
  };
}

/** @param {number} cost @param {readonly number[]} targets @param {string} reason @returns {PreviewResult} */
function unknown(cost, targets, reason) {
  return Object.freeze({ legal: true, cost, targetIndexes: targets, confidence: 'unknown', damage: null,
    knownEffects: Object.freeze([]), unknownEffects: Object.freeze([]), reasons: Object.freeze([reason]) });
}

/** @param {number} cost @param {readonly number[]} targets @param {string} reason @returns {PreviewResult} */
function illegal(cost, targets, reason) {
  return Object.freeze({ legal: false, cost, targetIndexes: targets, confidence: 'unknown', damage: null,
    knownEffects: Object.freeze([]), unknownEffects: Object.freeze([]), reasons: Object.freeze([reason]) });
}

/** @param {PreviewActionInput} input @returns {PreviewResult} */
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
  if (cardContext.shaTransformed) return unknown(cost, frozenTargets, '变形卡按当前效果结算，预览无法精算');
  const declaredEffects = declaredStatusEffects(card, cardContext.mode);
  if (declaredEffects) return Object.freeze({
    legal: true, cost, targetIndexes: frozenTargets, confidence: 'unknown', damage: null,
    knownEffects: Object.freeze(declaredEffects),
    unknownEffects: Object.freeze((cardContext.wholeCardRepeats || 1) !== 1 || cardContext.arrowRuneRepeat
      ? ['本次会重复结算'] : []), reasons: Object.freeze([]),
  });
  if (cardContext.modifiers?.specialLifecycle) return unknown(cost, frozenTargets, '目标带有复活等特殊生命流程，暂未完整预演');
  if (cardContext.modifiers?.vsFreezeBonus && !Number.isFinite(cardContext.freezeDamageBonus)) return unknown(cost, frozenTargets, '冰冻目标的伤害加成尚未提供');

  // AOE 数字仅对应当前指向目标；随机、未建模参数与额外伤害流程不猜数字。
  const exactSpec = semanticMatch(card, cardContext);
  if (!exactSpec) return unknown(cost, frozenTargets, '这张牌的伤害流程暂不支持预览');
  if (exactSpec.unknown === true) return unknown(cost, frozenTargets, exactSpec.reason || '这张牌带有尚未完整预演的伤害流程');
  const dmgType = card.dmgType;
  const cardDamage = Number(card.dmg);
  const damageGrowth = Number(cardContext.damageGrowth) || 0;
  if (!dmgType || !DAMAGE_TYPE_NAMES[dmgType] || (!Number.isFinite(cardDamage) && exactSpec.amount === undefined)) {
    return unknown(cost, frozenTargets, '这张牌没有可预览的固定伤害流程');
  }

  const repeats = Math.max(1, cardContext.wholeCardRepeats || 1) + (cardContext.arrowRuneRepeat ? 1 : 0);
  if (repeats > 1 && exactSpec.unknownEffects?.length) return unknown(cost, frozenTargets, '附加效果会在重放之间改变局面，仅基础伤害可确定');
  const damageOp = card.rules?.triggers?.onPlay?.find(item => item.op === 'damage');
  const infused = !!(cardContext.modifiers?.allSpellsInfused || cardContext.selectedFuelUids?.length);
  const condition = /** @type {{ infused?: boolean } | undefined} */ (damageOp?.when);
  const hitsPlanned = condition?.infused !== undefined && condition.infused !== infused ? 0 : exactSpec.hits * repeats;
  const targetsByIndex = snapshot.foes.map(cloneTarget);
  const target = targetsByIndex[targetIndex];
  const hpBefore = target.hp;
  const shieldBefore = target.defense.shield;
  const armorBefore = target.defense.armor;
  const dodgeBefore = +(target.status.dodge || 0);
  /** @type {number[]} */
  const hits = [];
  /** @type {number[]} */
  const targetIndexesByHit = [];
  /** @type {number[]} */
  const defeatedTargetIndexes = [];
  /** @type {string[]} */
  const logs = [];
  if (cardContext.targetProtected || cardContext.aegisBlocked) {
    for (let i = 0; i < hitsPlanned; i++) { hits.push(0); targetIndexesByHit.push(targetIndex); }
  } else {
    const attacker = { atk: +(snapshot.player?.atk || 0), spellPower: +(snapshot.player?.spellPower || 0), status: { ...(snapshot.pstat?.status || {}) } };
    const amount = (exactSpec.amount ?? (cardDamage || 0)) + damageGrowth
      + (infused ? Number(damageOp?.infuseBonus || 0) : 0)
      + Number(cardContext.handInfuseCount || 0) * Number(damageOp?.perInfusedInHand || 0)
      + Math.max(0, attacker.spellPower + Number(attacker.status.spellUp || 0)) * (Number(damageOp?.spellPowerMul ?? 1) - 1);
    let currentIndex = targetIndex;
    let stealthed = !!cardContext.modifiers?.stealthStrike;
    for (let i = 0; i < hitsPlanned; i++) {
      if (!exactSpec.retarget && target.hp <= 0) break;
      let hitIndex = currentIndex;
      if (exactSpec.retarget && targetsByIndex[hitIndex].hp <= 0) hitIndex = targetsByIndex.findIndex((t, index) => snapshot.foes[index] && !snapshot.foes[index].dead && t.hp > 0);
      if (hitIndex < 0 || !targetsByIndex[hitIndex]) break;
      const hitTarget = targetsByIndex[hitIndex];
      const hpBeforeHit = hitTarget.hp;
      const original = snapshot.foes[hitIndex];
      const protectedTarget = original.protected && snapshot.foes.some((candidate, index) => candidate.protects && !candidate.dead && targetsByIndex[index].hp > 0);
      const aegis = original.affix === 'aegis' && Number(snapshot.turn || 1) % 2 === 0 && !(Number(hitTarget.status.abreak) > 0);
      let modified = amount;
      if (Number(hitTarget.status.freeze) > 0) modified += Number(cardContext.freezeDamageBonus || 0);
      if (cardContext.modifiers?.bleedAmp && dmgType === 'attack') modified += Number(hitTarget.status.bleed || 0);
      if (modified > 0 && (cardContext.modifiers?.nestDark3 || cardContext.modifiers?.nestDark1 && original.maxHp && hitTarget.hp <= Number(original.maxHp) / 2)) modified += 1;
      const result = protectedTarget || aegis ? { dealt: 0, log: [protectedTarget ? '庇护' : '免伤'] } : dealMeasuredDamage(Combat, attacker, hitTarget, modified, dmgType, { multiplier: stealthed ? 2 : 1 });
      if (result.dealt > 0) stealthed = false;
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
    damage: Object.freeze({ type: dmgType, hits: Object.freeze(hits), targetIndexesByHit: Object.freeze(targetIndexesByHit),
      defeatedTargetIndexes: Object.freeze(defeatedTargetIndexes), total, hpBefore, hpAfter: target.hp,
      lethal: hpBefore > 0 && target.hp <= 0, shieldBefore, shieldAfter: target.defense.shield,
      armorBefore, armorAfter: target.defense.armor, dodgeBefore, dodgeAfter: +(target.status.dodge || 0),
      blockedBy: cardContext.targetProtected ? 'protected' : cardContext.aegisBlocked ? 'aegis' : null,
      notes: Object.freeze([...new Set(logs)]), }),
    knownEffects: Object.freeze(['damage']), unknownEffects: Object.freeze(exactSpec.unknownEffects || []), reasons: Object.freeze([]),
  });
}

export { cardRuleHint, previewAction };

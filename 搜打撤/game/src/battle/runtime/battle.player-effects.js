// Pure, explicit projection of active player rules. Never inspect pending cards or mutate runtime jobs.
// @ts-check
/** @typedef {import('../battle.snapshot.types.js').PlayerEffectView} PlayerEffectView */
/**
 * @param {{playerCurseImmune?: boolean, curseImmunityTemporary?: boolean, holyRune?: boolean,
 * turn?: number, spellCost1?: boolean, meleeCost1?: boolean, nextSpellTwice?: number,
 * allSpellsInfused?: boolean, discoverPlus?: number, bleedAmp?: number,
 * deathSave?: number, extraTurn?: boolean}} state
 * @returns {PlayerEffectView[]}
 */
export function projectPlayerEffects(state) {
  /** @type {PlayerEffectView[]} */
  const effects = [];
  /** @param {string} key @param {string} name @param {string} icon @param {string} duration @param {string} description */
  const add = (key, name, icon, duration, description) => effects.push({ key, name, icon, duration, description });
  const holyTurns = state.holyRune ? Math.max(0, 4 - (state.turn || 1)) : 0;
  if (state.playerCurseImmune || holyTurns > 0) {
    const duration = state.playerCurseImmune && !state.curseImmunityTemporary ? '本场' : holyTurns > 0 ? `${holyTurns}回合` : '本回合';
    add('curseImmunity', '免疫诅咒', 'shield', duration,
      `阻止对自身施加诅咒。${duration === '本场' ? '持续至本场战斗结束。' : holyTurns > 0 ? '圣洁符文在前3回合有效。' : '下回合开始时结束。'}不等于免疫伤害。`);
  }
  if (state.spellCost1 || state.meleeCost1) {
    const kind = state.spellCost1 && state.meleeCost1 ? '招式' : state.spellCost1 ? '法术' : '武术';
    add('moveCost', `${kind}1费`, 'sparkles', '本场', `${kind}按1费结算，持续至本场战斗结束；单牌限回合0费、无限符文等更高优先级费用规则仍适用，以手牌实际费用为准。`);
  }
  if ((state.nextSpellTwice || 0) > 0) add('nextSpell', '法术额外施放', 'sparkles', '下一张', '下一张法术额外施放1次，触发后消失；不会为额外施放再次支付费用。');
  if (state.allSpellsInfused) add('infused', '招式已注能', 'sparkles', '本场', '可注能与必须注能的武术、法术均视为已注能，无需材料；仍需支付正常费用，持续至本场战斗结束。');
  if ((state.discoverPlus || 0) > 0) add('discoverPlus', `发现候选+${state.discoverPlus}`, 'question', '本场', '随机发现的候选数量增加，不增加可选择的张数。持续至本场战斗结束。');
  if ((state.bleedAmp || 0) > 0) add('bleedAmp', '流血加成翻倍', 'blood', '本场', '对流血敌人造成伤害时，流血附加伤害再增加一份，不是总伤害翻倍。持续至本场战斗结束。');
  if ((state.deathSave || 0) > 0) add('deathSave', '抵挡致命伤害', 'shield', `${state.deathSave}次`, '受到致命伤害时抵挡该次伤害并获得本回合免疫伤害，每次触发消耗1次；剩余次数保留至本场战斗结束。');
  if (state.extraTurn) add('extraTurn', '额外回合', 'hourglass', '待触发', '结束当前回合后跳过敌方行动，立即进入自己的下一回合；触发后消失。');
  return effects;
}

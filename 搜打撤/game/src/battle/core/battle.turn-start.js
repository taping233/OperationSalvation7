import { esc } from '../../core/shared.js';
import { withBlessingChoices } from '../effects/random-blessings.js';
import { decayEffectiveCardCost } from '../effects/battle.card-cost.js';
import { createCardRuleExecution } from '../effects/battle.rule-guard.js';

/** Owns the turn-start batch: deferred jobs, repeating clauses and hand growth.
 * Re-read runtime after every async boundary; jobs added during a batch belong to the next turn.
 */
export function createBattleTurnStart({ throwIfActionCancelled, readState, alive, foeIdx, findCard, findEffectiveCard,
  fireTurnStart, consumeHandUids, resolveCardWithFeedback, applyTextEffects, runStagedSteps,
  set$playerCurseImmune, set$delayed }) {
  // 注册「回合开始时」延迟段（2026-09-09 老板定向 Q3）：
  //   repeat = 装备卡 /「每回合开始时」/ 能力卡或形态卡（形态=每回合）→ 每回合开始触发；
  //   「持续 N 回合」= 重复 N 次（left 计数递减）；其余一次性
  function registerTurnStart(card, items, target) {
    const descDur = +(((String(card.desc || '').match(/持续\s*(\d+)\s*回合/)) || [])[1] || 0);
    const formLike = card.type === '能力卡' || /形态/.test(String(card.name || ''));
    items.forEach(it => {
      const dur = +(((String(it.text).match(/持续\s*(\d+)\s*回合/)) || [])[1] || 0) || descDur;
      let repeat = card.type === '装备' || card.id === 'cmtn7err0a7' || it.each || formLike;
      let left = null;
      if (!repeat && dur > 0) { repeat = true; left = dur; }   // 持续 N 回合 = 重复 N 次
      readState().delayed.push({ text: withBlessingChoices(it.text, card.desc), cardName: card.name, repeat, left, targetIndex: foeIdx(target) });
      readState().G.log(`[[icon:hourglass]] <b>回合开始时</b>：【${esc(card.name)}】${esc(it.text)}（下个回合开始${repeat ? (left ? `起共 ${left} 次` : '起每回合') : ''}生效）`, 'sys');
    });
  }

  // 回合开始：结算延迟段（沉默中技能无效——一次性段被吞掉，重复段保留到下回合；
  // notBeforeTurn = 花开两面未选之门「两回合后」的定时刻；special = 江湖救急临时卡消耗）
  async function processDelayed(signal = readState().activeActionSignal) {
    throwIfActionCancelled(signal);
    if (!readState().G?.battleActive || readState().G.hp <= 0 || !alive().length) return;
    const token = readState().battleState.token;
    const pending = readState().delayed;
    const batch = pending.slice();
    const keep = [];
    let nextIndex = 0;
    try {
    // M2：结构化 onTurnStart 触发（登记卡 + 装备 focus 光环）——置于任何早退之前，
    // 与 delayed 文本管线同一回合开始时点
    fireTurnStart();
    if (!batch.length) return;
    let curseImmunityRestored = false;
    for (const q of batch) {
      throwIfActionCancelled(signal);
      if (!readState().G?.battleActive || readState().battleState.token !== token || readState().G.hp <= 0 || !alive().length) break;
      nextIndex++;
      const selected = Number.isInteger(q.targetIndex) ? readState().foes[q.targetIndex] : null;
      // 与直接施放相同：原目标失效后回退首名存活敌人，存活时保持原目标。
      const delayedTarget = selected && !selected.dead ? selected : alive()[0] || null;
      if (q.notBeforeTurn && readState().turn < q.notBeforeTurn) { keep.push(q); continue; }
      if (q.special === 'consumeTemps') {
        await consumeHandUids(q.uids || [], q.cardName, signal);
        continue;   // 一次性，不保留
      }
      // 第十二批（2026-09-23）两个一次性 special：均不走沉默门（状态还原/费用记账非技能句）
      if (q.special === 'curseImmuneOff') {
        // 旧战斗存档可能保留重复任务，只兑现最早记录的基值。
        if (!curseImmunityRestored) set$playerCurseImmune(!!q.restore);
        curseImmunityRestored = true;
        continue;   // 一次性，不保留
      }
      if (q.special === 'costDecay' || q.special === 'ruleCostDecay') {
        // Legacy text jobs and structured rule jobs both bind decay to the discovered card uid.
        const o = q.uid ? findCard(q.uid) : null;
        if (o) {
          const cur = +(o.card.cost || 0);
          const decayed = decayEffectiveCardCost(o.card, q.special === 'costDecay' ? 1 : q.amount);
          const nc = +(decayed.cost || 0);
          if (nc !== cur) {
            readState().cardOverrides.set(q.uid, decayed);
            readState().G.log(`[[icon:bolt]] <b>回合开始时</b>：【${esc(o.card.name)}】费用 -${cur - nc}（现 ${nc} 费）`, 'sys');
          }
          if (nc > 0) keep.push(q);
        }
        continue;   // 保留与否自行管理
      }
      // M2：结构化延迟段（damage.schedule nextTurn/nextTurnStart）——沉默封印与非延迟口径一致
      if (q.special === 'triggerOps' || q.special === 'choiceOps') {
        // 到期标记剥离后复用同一合成器与沉默门，避免继承原卡无关字段或再次调度自身。
        const ops = q.ops.map(op => { const rest = { ...op }; delete rest.schedule; return rest; });
        const synthetic = createCardRuleExecution(q.srcCard || { name: q.cardName }, ops);
        await resolveCardWithFeedback(synthetic, delayedTarget, false, 0, 'm2-scheduled', signal);
        if (q.special === 'choiceOps' && q.repeat) keep.push(q);
        continue;
      }
      // 神秘药水已在本道具入口消费；专用任务兑现产卡，不属于受沉默限制的法术技能。
      readState().G.log(`[[icon:hourglass]] <b>回合开始时</b>：【${esc(q.cardName)}】${esc(q.text)}`, 'sys');
      const flags = { triggered: q.special !== 'mysteryPotion' };
      if (applyTextEffects.steps) {
        await runStagedSteps(applyTextEffects.steps({ name: q.cardName }, q.text, delayedTarget, flags), signal);
      } else {
        applyTextEffects({ name: q.cardName }, q.text, delayedTarget, flags);
      }
      if (q.repeat) {
        if (typeof q.left === 'number') { q.left -= 1; if (q.left > 0) keep.push(q); }
        else keep.push(q);
      }
    }
    } finally {
      if (readState().G?.battleActive && readState().battleState.token === token) {
        // 当批任务产生的新调度只留给下个时点，不当场递归兑现，也不被旧列表覆盖。
        const added = readState().delayed === pending ? readState().delayed.slice(batch.length) : readState().delayed;
        set$delayed([...keep, ...batch.slice(nextIndex), ...added]);
      }
    }
  }

  // 「回合开始时，本牌伤害+N」成长：所有在场/在库副本按 uid 累积（充能火球）
  function accrueGrowth() {
    for (const uid of new Set([...readState().hand, ...readState().drawPile, ...readState().discard, ...readState().grave])) {
      const o = findEffectiveCard(uid) || findCard(uid);
      const card = o?.card;
      if (!card) continue;
      const amount = +(String(card.desc || '').match(/回合开始时[，,]?\s*本牌伤害\s*\+\s*(\d+)/)?.[1] || 0);
      if (amount > 0) readState().growth[uid] = (readState().growth[uid] || 0) + amount;
    }
  }


  return { registerTurnStart, processDelayed, accrueGrowth };
}

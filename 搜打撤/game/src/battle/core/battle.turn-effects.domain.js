import { esc } from '../../core/shared.js';
import { createBattleTurnStart } from './battle.turn-start.js';

/** Battle-duration rules and turn-start effects share the current battle state.
 * State is read on demand, including after staged consumption; no pile is captured.
 * The scheduler retains ownership of delayed batch and duration semantics.
 */
export function createBattleTurnEffects({ readState, throwIfActionCancelled,
  alive, foeIdx, findCard, findEffectiveCard, fireTurnStart, resolveCardWithFeedback,
  applyTextEffects, runStagedSteps, set$playerCurseImmune, set$delayed,
  set$meleeCost1, set$spellCost1, battleBagItems, onHandConsumed, consumeFireballSteps }) {
  const turnStart = createBattleTurnStart({ readState, throwIfActionCancelled,
    alive, foeIdx, findCard, findEffectiveCard, fireTurnStart, resolveCardWithFeedback,
    applyTextEffects, runStagedSteps, set$playerCurseImmune, set$delayed, consumeHandUids });

  // 「本局对战内」持续效果：注册并结算其中已支持的部分（增益本身即战斗内长期有效）
  function registerBattle(card, clause, target) {
    readState().G.log(`[[icon:question]] <b>本局对战内</b>：${esc(clause)}（整场战斗有效，离开战斗失效）`, 'ok');
    const inner = clause.replace(/^(本局对战内|本场对战|本场战斗)[中内]?[：:，,]?\s*/, '');
    // 银河之旅（2026-10-06 老板拍板改版）：desc 定稿「你的所有招式均为 1 费」——招式=武术+法术
    // （terminology 定版口径），双旗标同落；「所有卡牌」是宇宙形态的口径，不得混同
    if (/所有招式[^。]*?1\s*费/.test(inner)) {
      set$meleeCost1(true);
      set$spellCost1(true);
      readState().G.log('[[icon:sparkles]] 持续规则：你的所有招式（武术与法术）均按 <b>1</b> 费打出', 'ok');
    } else if (/所有武术[^。]*?1\s*费/.test(inner)) {
      set$meleeCost1(true);
      readState().G.log('[[icon:sparkles]] 持续规则：你的所有武术均按 <b>1</b> 费打出', 'ok');
    } else if (/所有法术[^。]*?1\s*费/.test(inner)) {
      set$spellCost1(true);
      readState().G.log('[[icon:sparkles]] 持续规则：你的所有法术均按 <b>1</b> 费打出', 'ok');
    }
    return applyTextEffects(card, inner, target).did;
  }

  // 江湖救急：回合开始将其置入的临时卡消耗（会正确触发「每消耗 1 张」联动）
  async function consumeHandUids(uids, cardName, signal = readState().activeActionSignal) {
    let n = 0;
    for (const u of new Set(uids || [])) {
      throwIfActionCancelled(signal);
      if (!readState().G?.battleActive || readState().G.hp <= 0 || !alive().length) break;
      if (readState().consumed.includes(u)) continue;
      const idx = readState().hand.indexOf(u);
      // 临时道具改入快捷栏后仍遵守到期回收；已使用/消耗的 UID 不再重复结算。
      const temporaryItem = readState().granted.some(o => o.uid === u && o.card.type === '道具') &&
        battleBagItems().some(o => o.uid === u);
      if (idx < 0 && !temporaryItem) continue;
      if (idx >= 0) readState().hand.splice(idx, 1);
      readState().consumed.push(u);
      if (readState().mode === 'boss') readState().grave.push(u);
      const o = findCard(u);
      readState().cardAnims.push({ kind: 'burn', uid: u, name: o ? o.card.name : '' });
      if (o) await runStagedSteps(onHandConsumed(o.card), signal);
      else if (readState().consumeFireballN > 0) await runStagedSteps(consumeFireballSteps(readState().consumeFireballN), signal);
      n++;
    }
    if (n) readState().G.log(`[[icon:flask]] <b>${esc(cardName || '临时卡')}</b>：回合开始，消耗了 ${n} 张临时卡`, 'sys');
    return n;
  }
  return { ...turnStart, registerBattle, consumeHandUids };
}

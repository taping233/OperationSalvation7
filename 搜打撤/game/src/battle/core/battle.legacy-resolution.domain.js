import { isLegacyRotSeed, isLegacyEmergencySupply, isLegacySearchChest } from '../../cards/card-legacy-battle-policy.js';

/** Full-resolution fallbacks for old snapshots, after structured ownership checks.
 * The caller controls ordering and cancellation; commands use its live state ports.
 */
export function createLegacyResolution({ combat, log, esc, getHandSize, randomDiscoverCard,
  addTempCard, getPlayerStatus, heal, addFloat, getAllCards, isRandomObtainable,
  readState, randomBattle, addDelayed, deckBottomCount, takeDeckBottom, findCard, queueDiscoverTracked }) {
  function resolveOpening(card, target, ownsOnPlay) {
    if (!ownsOnPlay && isLegacyRotSeed(card)) {
      const foe = target && !target.dead && target.hp > 0 ? target : null;
      if (foe) {
        combat.addCurse(foe, 'poison', 2);
        foe.rotSeedMarked = true;
        log(`[[icon:skull]] <b>腐化之种</b>：标记 <b>${esc(foe.name)}</b> 并附加 2 层中毒；死亡时按中毒层数对所有敌人造成真实伤害`, 'sys');
      }
      return true;
    }

    // 牧师浪掷风吟：固定宿主实现，直接按随机池置入至 6 张并只按新置入法术数回血。
    // 原文分号会拆开手牌填充与回血句，旧文本步骤因此先泛化回复 heal 字段再漏算逐张系数；
    // 入口沿已有 priest 宿主声明，不扩大到同名卡；不依赖可编辑描述执行。
    if (!ownsOnPlay && card.rules?.battle?.hosted?.includes('priest')) {
      let put = 0, spells = 0;
      while ((typeof getHandSize === 'function' ? getHandSize() : 0) < 6) {
        const candidate = randomDiscoverCard(null);
        if (!candidate) break;
        const before = typeof getHandSize === 'function' ? getHandSize() : 0;
        addTempCard(candidate);
        const after = typeof getHandSize === 'function' ? getHandSize() : 0;
        if (after <= before) break;
        put++;
        if (candidate.type === '法术') spells++;
      }
      const healAmount = Math.max(0, Number(card.heal) || 0) * spells;
      if (healAmount > 0) {
        const healban = getPlayerStatus().status.healban || 0;
        if (healban > 0) log(`[[icon:heart]] 禁疗中：浪掷风吟回复无效（还剩 ${healban} 回合）`, 'warn');
        else { heal(healAmount); addFloat({ unit: 'self', text: '', cls: 'stk sticker-heal', warm: true }); }
      }
      const handSize = typeof getHandSize === 'function' ? getHandSize() : 0;
      log(`[[icon:cards]] <b>${esc(card.name)}</b>：置入 ${put} 张随机卡牌（手牌 ${handSize}/6）${spells ? `，其中 ${spells} 张法术回复 ${healAmount} 血` : ''}`, 'loot');
      return true;
    }

    return false;
  }

  function resolveAcquisition(card, hasStructuredOnPlay) {
    // 江湖救急（2026-09-18 老板定版）：「随机直接给 3 张」才是本意——不走发现面板。
    // 随机池与发现同口径（isRandomObtainable），置入的临时卡在下个回合开始时消耗。
    if (!hasStructuredOnPlay && isLegacyEmergencySupply(card)) {   // 同名旧卡 tt2-jianghu 有自己的发现流程
      const pool = getAllCards().filter(c => isRandomObtainable(c)
        && (readState().mode !== 'boss' || c.type !== '道具'));
      if (!pool.length) {
        log(`[[icon:cards]] <b>${esc(card.name)}</b>：当前没有符合本场战斗规则的随机卡牌`, 'warn');
        return true;
      }
      const uids = [];
      for (let k = 0; k < 3 && pool.length; k++) {
        const c = pool[Math.floor(randomBattle() * pool.length)];
        uids.push(addTempCard({ ...c }));
      }
      if (uids.length) {
        addDelayed({ special: 'consumeTemps', uids, cardName: card.name });
        log(`[[icon:cards]] <b>${esc(card.name)}</b>：随机获得 ${uids.length} 张临时卡牌（下个回合开始时消耗）`, 'loot');
      }
      return true;
    }
    // 搜索军用保险柜「探宝」（2026-09-17 留言「探宝没有从牌库底发现卡牌，而是随机发现」）：
    // 三张候选就是牌库底的真实卡牌，选 1 张入手、其余按原顺序放回牌库底。
    // 探宝只有发现效果，结算完直接收尾；空库不会随机补足。
    if (!hasStructuredOnPlay && isLegacySearchChest(card)) {
      const take = Math.min(3, deckBottomCount());
      const uids = takeDeckBottom(take);   // 数组头部 = 牌库底
      const cards = uids.map(u => { const o = findCard(u); return o ? o.card : null; }).filter(Boolean);
      if (cards.length) {
        // n=1：三张候选就是本次面板，选 1 张入手即完（其余放回牌库底）。此前 n 误传候选数 3，
        // pickDiscover 的 n>1 分支又排队 2 次随机发现（09-30 深审 BC-05）
        queueDiscoverTracked({ n: 1, explicit: cards, explicitUids: uids, deckBottom: true });
        log(`[[icon:question]] <b>${esc(card.name)}</b>：翻开牌库底 ${cards.length} 张——选 1 张入手，其余放回牌库底`, 'loot');
      }
      return true;
    }
    return false;
  }
  return { resolveOpening, resolveAcquisition };
}

import { discoveryActionsHTML, bindDiscoverySelection } from '../ui/discovery-selection.js';
import { isBattleOnlyBagCard, isLegacyDiscoveryToken, isLegacyRestorePreviewCard } from './bag-use-compatibility.js';
import { esc, escAttr } from '../core/shared.js';
import { saveRunCheckpoint } from '../core/run-checkpoint.js';
import { isBagItemUsePending, useBagItemOperations } from './bag-item-use.js';
import { stackCapOf, canReceiveCardFromBag, canAcceptCardAtCapacity } from '../core/card-capacity.js';
import { rewardSceneHTML } from '../ui/reward-scene-view.js';
import { BAG_SUPPORTED_OPS } from '../cards/card-rules.schema.js';
import { bagRecoveryStatus, isRestorableBagEntry } from './bag-item-effects.js';

const isMapBagOperation = operation => operation &&
  (operation.op === 'heal' || operation.op === 'restoreConsumed' ||
    (['acquire', 'discover'].includes(operation.op) && ['classAbility', 'legendary'].includes(operation.pool?.kind)));

// 复用地图消费器支持的操作；未知/旧文本卡不推断用途，保留原执行回退。
export function bagUseLocation(card) {
  if (card?.type !== '道具') return null;
  if (isBattleOnlyBagCard(card)) return 'battle'; // 既有地图禁用例外
  if (isLegacyDiscoveryToken(card)) return 'map'; // 同时覆盖尚无结构化bag规则的旧卡快照
  const operations = card.rules?.bag?.use;
  if (!Array.isArray(operations) || !operations.length) return null;
  return operations.some(isMapBagOperation) ? 'map' : 'battle';
}

// Explain only the supported map portion of a mixed item, without replacing
// its complete card text or guessing at battle effects and legacy wording.
export function mapBagUseHint(card) {
  if (bagUseLocation(card) !== 'map') return '';
  const operations = card.rules?.bag?.use;
  if (!Array.isArray(operations) || operations.some(operation => !operation || !BAG_SUPPORTED_OPS.has(operation.op))) return '';
  const mapSide = operations.filter(isMapBagOperation);
  if (!mapSide.length || mapSide.length === operations.length) return '';
  const discovery = mapSide.find(operation => operation.op === 'discover');
  const summaries = (discovery ? [discovery] : mapSide).map(operation => {
    if (operation.op === 'heal') return '回复生命';
    if (operation.op === 'restoreConsumed') return '复原消耗区卡牌';
    if (operation.op === 'acquire') return operation.pool.kind === 'legendary' ? '获得传说卡' : '获得本职业能力卡';
    if (operation.op === 'discover') return operation.pool.kind === 'legendary' ? '发现传说卡' : '发现本职业能力卡';
    return '';
  });
  return summaries.every(Boolean) ? `地图使用：${[...new Set(summaries)].join('、')}。` : '';
}

// Preview the same per-card receipt rules as execution, after consuming the item.
export function restorationCapacityReason(game, ownedIndex, { usedSlots, bagCap, baseCap = bagCap, renderState = null }) {
  const ports = { usedSlots: () => renderState ? renderState.used : usedSlots(),
    bagCap: () => renderState ? renderState.cap : bagCap(), baseCap: () => renderState ? renderState.baseCap : baseCap(), renderState };
  return game.usedPocket.some(entry => isRestorableBagEntry(entry) && canReplaceBagCard(game, ownedIndex, entry.card, ports))
    ? '' : '背包空间不足，先腾位再复原';
}

export function bagUseStatus(card, uid, { game, usedSlots, bagCap, baseCap = bagCap, renderState = null }) {
  if (isBattleOnlyBagCard(card)) return { label:'仅战斗中使用', badge:'战斗使用', reason:'神秘药水仅能在战斗中使用' };
  if (bagUseLocation(card) === 'battle') return { label:'仅战斗中使用', badge:'战斗使用', reason:'该道具的效果需要在战斗中使用' };
  const operations = card.rules?.bag?.use;
  const structured = Array.isArray(operations) && operations.length > 0;
  const legacyRestore = !structured && isLegacyRestorePreviewCard(card);
  const mapSide = structured ? operations.filter(isMapBagOperation) : legacyRestore ? [{ op:'restoreConsumed', amount:1 }] : [];
  // Random rewards and unknown snapshots stay with their execution owner.
  // Battle-only energy/draw/etc. cannot make a map recovery effect useful.
  const deterministic = legacyRestore || (structured && operations.every(operation => operation && BAG_SUPPORTED_OPS.has(operation.op))
    && !operations.some(operation => ['acquire', 'discover'].includes(operation.op)));
  if (deterministic && mapSide.length) {
    const capacityReason = () => restorationCapacityReason(game, renderState ? (renderState.ownedIndexByUid.get(uid) ?? -1)
      : game.ownedCards.findIndex(o => o.uid === uid), { usedSlots, bagCap, baseCap, renderState });
    const statuses = mapSide.map(operation => bagRecoveryStatus(card, operation, game, capacityReason));
    if (statuses.every(Boolean)) {
      const failures = [...new Map(statuses.map(status => [status.reason, status])).values()];
      if (failures.length === 1) return failures[0];
      return { label:'地图效果当前均无法生效', badge:'暂不可用', reason:failures.map(status => status.reason.replace('；卡牌未消耗', '')).join('；') + '；卡牌未消耗' };
    }
  }
  return { label:'使用这张道具', badge:bagUseLocation(card) === 'map' ? '可用' : '查看用法', reason:'' };
}

// 使用同叠道具未必腾出一格；先预估移除源牌后的真实容量，再接收奖励。
export function canReplaceBagCard(game, ownedIndex, card, { usedSlots, bagCap, baseCap = bagCap, renderState = null }) {
  const entry = game.ownedCards[ownedIndex];
  if (!entry) return false;
  const normal = !entry.safe && !entry.stored;
  const same = renderState ? renderState.bagNameCounts.get(entry.card.name) || 0
    : game.ownedCards.filter(o => !o.safe && !o.stored && o.card.name === entry.card.name).length;
  const cap = stackCapOf(entry.card);
  const frees = normal && Math.ceil(same / cap) > Math.ceil((same - 1) / cap);
  const projected = usedSlots() - Number(frees);
  if (renderState) {
    const remaining = (renderState.bagNameCounts.get(card.name) || 0) - Number(normal && entry.card.name === card.name);
    return (remaining > 0 && remaining % stackCapOf(card) !== 0)
      || canAcceptCardAtCapacity(card, { usedSlots: projected, baseCap: baseCap(), totalCap: bagCap() });
  }
  return canReceiveCardFromBag(card, { ownedCards:game.ownedCards.filter((_, i) => i !== ownedIndex),
    canAcceptCard:target => canAcceptCardAtCapacity(target, {usedSlots:projected,baseCap:baseCap(),totalCap:bagCap()}) });
}

export function canReceiveBagCard(game, card, { usedSlots, bagCap, baseCap = bagCap }) {
  return canReceiveCardFromBag(card, { ownedCards: game.ownedCards,
    canAcceptCard: target => canAcceptCardAtCapacity(target, { usedSlots: usedSlots(), baseCap: baseCap(), totalCap: bagCap() }) });
}

// Reopening the same source shares its candidate save, including an in-flight attempt.
const bagDiscoverySaves = new WeakMap();

// Candidates live on the existing owned entry, so the normal run save preserves
// a cancelled/interrupted discovery without consuming its source or rerolling.
export function openBagDiscovery(card, ownedIndex, {
  UI, SDT, game, Random, newUid, saveGame, showBackpack, usedSlots, bagCap,
  setReceipt = /** @type {(text:string) => void} */ (() => {}), captureContext = () => () => true,
}, poolKind = 'legendary') {
  const entries = game.ownedCards, source = entries[ownedIndex];
  if (!source || source.card !== card) return true;
  if (!['legendary', 'classAbility'].includes(poolKind)) { UI.log('发现卡池暂不可用；卡牌未消耗', 'warn'); return true; }
  const legendary = poolKind === 'legendary';
  const rewardLabel = legendary ? '传说卡' : '本职业能力卡';
  const defaultNotice = '确认后才消耗通行证；取消可保留候选。';
  const candidateSaveNotice = '候选尚未保存，通行证与原候选已保留；确认或重新打开时可重试，请勿刷新。';
  const pool = (legendary ? SDT.Cards.all().filter(candidate => candidate.rarity === '传说' && SDT.Cards.isRandomObtainable(candidate))
    : SDT.Cards.classPool(game.myClass).filter(candidate => candidate.type === '能力卡')).filter(candidate => candidate.id);
  if (!pool.length) { UI.log(`没有可获得的${rewardLabel}；卡牌未消耗`, 'warn'); return true; }
  if (!source.bagDiscover) {
    const available = [...new Map(pool.map(candidate => [candidate.id, candidate])).values()], cardIds = [];
    while (available.length && cardIds.length < 3) {
      const index = Math.floor(Random.random('loot', 'reward') * available.length);
      cardIds.push(available.splice(index, 1)[0].id);
    }
    source.bagDiscover = legendary ? { version:1, cardIds } : { version:1, cardIds, poolKind };
  }
  const pending = source.bagDiscover;
  const ids = pending?.cardIds;
  const candidates = Array.isArray(ids) ? ids.map(id => pool.find(candidate => candidate.id === id)) : [];
  if ((pending?.poolKind || 'legendary') !== poolKind || pending?.version !== 1 || !candidates.length || candidates.length > 3 || candidates.some(candidate => !candidate)
    || new Set(ids).size !== ids.length) {
    UI.log('发现候选暂不可用；通行证与原候选已保留', 'warn'); return true;
  }
  let candidateSave = bagDiscoverySaves.get(source);
  if (candidateSave?.pending !== pending) {
    candidateSave = { pending, saved:false, saving:null };
    bagDiscoverySaves.set(source, candidateSave);
  }
  const sameContext = captureContext();
  let settled = false, root, claimed = null;
  const current = () => !settled && sameContext() && !game.battleActive && game.ownedCards === entries
    && (claimed || (entries.includes(source) && source.bagDiscover === pending));
  const live = () => current() && root?.isConnected && UI.el.ovBody.contains(root)
    && !UI.el.overlay.hidden && !UI.el.overlay.classList.contains('closing');
  const canTake = got => canReplaceBagCard(game, entries.indexOf(source), got,
    { usedSlots, bagCap, baseCap:SDT.Base?.bagCap || bagCap });
  function showNotice(text) {
    const notice = root?.querySelector('.reward-notice');
    if (notice) notice.textContent = text;
  }
  function saveCandidates() {
    if (!current()) return Promise.resolve(false);
    if (!candidateSave.saved && !candidateSave.saving) {
      candidateSave.saving = Promise.resolve().then(() => current() ? saveRunCheckpoint(saveGame) : false).then(saved => {
        candidateSave.saved = saved;
        candidateSave.saving = null;
        return saved;
      });
    }
    return (candidateSave.saving || Promise.resolve(true)).then(saved => {
      if (live()) showNotice(saved ? defaultNotice : candidateSaveNotice);
      return saved;
    });
  }
  function render(notice = '') {
    UI.showOverlay(`发现${rewardLabel}`, rewardSceneHTML({
      title:`发现${rewardLabel}`, countLabel:`${candidates.length} 选 1`, count:candidates.length,
      className:'reward-v14 reward-standalone-picker bag-discover',
      cards:candidates.map((candidate, i) => `<div class="reward-unit"><button type="button" class="bt-card reward-card" data-act="bagDiscoverPick" data-i="${i}" data-cancel="false" aria-label="选择${escAttr(candidate.name)}">${SDT.Cards.cardHTML(candidate, 'sm')}</button></div>`).join(''),
      actions:discoveryActionsHTML({ confirmAct:'bagDiscoverConfirm', cancelAct:'bagDiscoverCancel' }),
      warning:`<p class="reward-notice" role="status">${esc(notice || defaultNotice)}</p>`,
    }), 'discover');
    root = UI.el.ovBody.querySelector('.bag-discover');
    const view = root;
    const ownsView = () => root === view && view?.isConnected && UI.el.ovBody.contains(view)
      && !UI.el.overlay.hidden && !UI.el.overlay.classList.contains('closing');
    const returnToBackpack = async () => {
      if (!live() || !ownsView()) return false;
      try { await showBackpack(true); } catch { /* Keep this view available for another return attempt. */ }
      if (!ownsView()) { settled = true; return true; }
      if (!current()) return false;
      if (claimed) {
        const chosen = candidates.indexOf(claimed);
        for (const button of view.querySelectorAll('[data-act="bagDiscoverPick"]')) {
          if (Number(button.dataset.i) !== chosen) button.setAttribute('disabled', '');
        }
        const confirm = view.querySelector('[data-act="bagDiscoverConfirm"]');
        const cancel = view.querySelector('[data-act="bagDiscoverCancel"]');
        if (confirm) confirm.textContent = '重试返回';
        if (cancel) cancel.textContent = '返回背包';
        showNotice(`已获得${rewardLabel}【${claimed.name}】并保存；返回背包未完成，请重试返回。`);
      } else showNotice(candidateSave.saved ? '返回背包未完成；通行证与候选已保留，请重试返回。'
        : `${candidateSaveNotice} 返回背包未完成，请重试返回。`);
      return false;
    };
    const submitChoice = async data => {
      if (!live() || root !== view) return false;
      if (claimed) return returnToBackpack();
      const index = Number(data.i), got = candidates[index];
      if (!Number.isInteger(index) || !got) return false;
      if (!await saveCandidates() || !live() || !ownsView()) return false;
      if (!canTake(got)) { showNotice('背包空间不足；请返回整理，通行证与候选已保留。'); return false; }
      const sourceIndex = entries.indexOf(source);
      const reward = { uid:newUid(), card:{ ...got } };
      settled = true;
      entries.splice(sourceIndex, 1); entries.push(reward);
      const saved = await saveRunCheckpoint(saveGame);
      if (saved === false) {
        if (sameContext() && game.ownedCards === entries) {
          const rewardIndex = entries.indexOf(reward);
          if (rewardIndex >= 0) entries.splice(rewardIndex, 1);
          if (!entries.includes(source)) entries.splice(Math.min(sourceIndex, entries.length), 0, source);
          settled = false;
          if (current() && ownsView()) showNotice('保存未成功；通行证与候选已保留，请重试。');
        }
        return false;
      }
      claimed = got;
      const receipt = `使用【${card.name}】：获得${rewardLabel}【${got.name}】`;
      if (!sameContext() || game.ownedCards !== entries || game.battleActive) return true;
      settled = false;
      setReceipt(receipt); UI.log(esc(receipt), 'loot');
      if (!ownsView()) { settled = true; return true; }
      return returnToBackpack();
    };
    const cancelChoice = async () => {
      if (!live() || !ownsView()) return false;
      if (!claimed) {
        const saved = await saveCandidates();
        if (!live() || !ownsView()) return false;
        if (!saved) { setReceipt(candidateSaveNotice); UI.log(esc(candidateSaveNotice), 'warn'); }
      }
      return returnToBackpack();
    };
    bindDiscoverySelection({ UI, root:view, optionSelector:'[data-act="bagDiscoverPick"]', selectAct:'bagDiscoverPick',
      confirmAct:'bagDiscoverConfirm', cancelAct:'bagDiscoverCancel', isCurrent:live,
      onConfirm:submitChoice, onCancel:cancelChoice,
    });
  }
  render('正在保存通行证与发现候选…');
  void saveCandidates();
  return true;
}


// Existing callers retain the legendary-only compatibility entry.
export function openBagLegendaryDiscovery(card, ownedIndex, ports) {
  return openBagDiscovery(card, ownedIndex, ports, 'legendary');
}


/**
 * 结构化背包用法的地图侧消费器。
 * 结算治疗、复原与直接获取；依赖由背包壳注入，避免规则片反向依赖壳。
 */
export function useStructuredBagRule(card, ownedIndex, ports) {
  const { UI, SDT, game, Random, newUid, saveGame, showBackpack, usedSlots, bagCap,
    setReceipt = /** @type {(text:string) => void} */ (() => {}), captureContext,
    current = () => true, beforePresent,
    onComplete = /** @type {(result:boolean | Promise<boolean>) => void} */ (() => {}) } = ports;
  const bagRules = card.rules?.bag;
  if (!bagRules || !Object.hasOwn(bagRules, 'use')) return false;
  const operations = Array.isArray(bagRules.use) ? bagRules.use : [];
  if (!operations.length) return false;
  if (!current() || game.battleActive || isBagItemUsePending(game)) { onComplete(false); return true; }
  const mapSide = operations.filter(isMapBagOperation);
  const discovery = mapSide.find(operation => operation.op === 'discover');
  if (discovery) {
    const nextCurrent = beforePresent?.();
    if (typeof nextCurrent === 'function' && !nextCurrent()) { onComplete(false); return true; }
    onComplete(openBagDiscovery(card, ownedIndex, { UI, SDT, game, Random, newUid, saveGame,
      showBackpack, usedSlots, bagCap, setReceipt, captureContext }, discovery.pool.kind));
    return true;
  }
  if (!mapSide.length) {
    if (current()) {
      setReceipt(`道具卡【${card.name}】的效果需要在战斗中使用；卡牌未消耗。`);
      UI.log(`道具卡【${esc(card.name)}】的效果需要在战斗中使用`, 'warn');
    }
    onComplete(false);
    return true;
  }
  // This public result only says the structured entrance claimed the card.
  // The shell receives the actual synchronous result / Promise via onComplete.
  onComplete(useOrdinaryBagRule(card, ownedIndex, mapSide, ports));
  return true;
}

export function useOrdinaryBagRule(card, ownedIndex, operations, ports) {
  const { game, usedSlots, bagCap, SDT } = ports;
  const source = game.ownedCards[ownedIndex];
  const capacity = { usedSlots, bagCap, baseCap:SDT.Base?.bagCap || bagCap };
  return useBagItemOperations(card, ownedIndex, operations, { ...ports,
    canReplace:got => canReplaceBagCard(game, game.ownedCards.indexOf(source), got, capacity),
    canReceive:got => canReceiveBagCard(game, got, capacity),
  });
}

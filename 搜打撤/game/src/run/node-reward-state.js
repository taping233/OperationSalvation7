import { validAltarFragmentChoice, validNodeRestore } from './node-restore-state.js';
export { validAltarFragmentChoice } from './node-restore-state.js';
const ids = value => Array.isArray(value) && value.every(id => typeof id === 'string' && id.length > 0);
const coordinate = value => Number.isInteger(value) && value >= 0;
const endedRewardRecords = new WeakSet();

export function nodeContentEndedAt(game, li = game.layerIdx, idx = game.trackPos) {
  const record = game.nodeRewards?.[`${li},${idx}`];
  return record?.version === 1 && record.type === 'closed';
}

// 供实际移动提交与旧档离开记录迁移调用；关闭面板与整理背包不结束内容。
export function endNodeContent(game, li, idx) {
  if (!coordinate(li) || !coordinate(idx)) return false;
  const key = `${li},${idx}`, record = game.nodeRewards?.[key];
  if (record && typeof record === 'object') endedRewardRecords.add(record);
  if (record?.altarFragmentChoice) endedRewardRecords.add(record.altarFragmentChoice);
  game.visited ||= {};
  game.visited[key] = 1;
  game.nodeRewards ||= {};
  if (!nodeContentEndedAt(game, li, idx)) {
    const commission = record?.commission;
    // 已获得的跨节点凭据沿用原对象，已兑付收据也保留；只结束本地内容。
    const keepCommission = commission && typeof commission === 'object' && !Array.isArray(commission)
      && ['pending','applied'].includes(commission.status);
    game.nodeRewards[key] = { version:1, type:'closed', ...(keepCommission ? { commission } : {}) };
  }
  if (game.nodeChestRewards) delete game.nodeChestRewards[key];
  if (game.entrySupply?.layerIdx === li && game.entrySupply.trackPos === idx) game.entrySupply = null;
  const sourceType = game.layerData?.[li]?.logical?.[idx]?.def?.type;
  if (sourceType === 'altar') game.altarRewardPending = false;
  // 移动提交可先写目的坐标；事件记录与源节点类型仍能确认战利品归属。
  if (!game.nestActive && (sourceType === 'event' || ['event','event-choice'].includes(record?.type)
    || game.layerIdx === li && game.trackPos === idx)) game.pendingEventLoot = null;
  if (game.layerIdx === li && game.trackPos === idx) {
    actionTokens.delete(game);
  }
  return true;
}

// 旧档只迁移已有内容或访问凭据的离开节点；当前节点与仅见过的节点保持原状。
export function endAbandonedNodeContent(game) {
  const currentKey = `${game.layerIdx},${game.trackPos}`;
  const keys = new Set([
    ...Object.keys(game.nodeRewards || {}),
    ...Object.keys(game.nodeChestRewards || {}),
    ...Object.entries(game.visited || {}).filter(([, visited]) => visited).map(([key]) => key),
  ]);
  const supply = game.entrySupply;
  if (coordinate(supply?.layerIdx) && coordinate(supply?.trackPos)) keys.add(`${supply.layerIdx},${supply.trackPos}`);
  const pendingEventLoot = game.pendingEventLoot;
  const currentAltar = game.layerData?.[game.layerIdx]?.logical?.[game.trackPos]?.def?.type === 'altar';
  const altarRewardPending = game.altarRewardPending;
  for (const key of keys) {
    if (key === currentKey || !/^\d+,\d+$/.test(key)) continue;
    const [li, idx] = key.split(',').map(Number);
    if (li === game.layerIdx && idx === game.trackPos) continue;
    endNodeContent(game, li, idx);
  }
  // 这些无坐标字段由当前节点持有，旧节点迁移不能清掉当前续流。
  game.pendingEventLoot = pendingEventLoot;
  if (currentAltar) game.altarRewardPending = altarRewardPending;
}

export function validEntrySupply(value) {
  return !!value && value.version === 1 && value.layerIdx === 0 && coordinate(value.trackPos)
    && ids(value.cardIds) && value.cardIds.length <= 2 && new Set(value.cardIds).size === value.cardIds.length
    && Array.isArray(value.taken) && new Set(value.taken).size === value.taken.length
    && (value.entered === undefined || typeof value.entered === 'boolean')
    && value.taken.every(i => Number.isInteger(i) && i >= 0 && i < value.cardIds.length);
}

/** @returns {import('../hub/game.store.types.js').EntrySupply} */
export function createEntrySupply(game, cards) {
  return { version:1, layerIdx:0, trackPos:game.trackPos,
    cardIds:[...new Set(cards.filter(Boolean).map(card => card.id))], taken:[] };
}

export function entrySupplyAt(game) {
  if (nodeContentEndedAt(game)) return null;
  const value = game.entrySupply;
  return validEntrySupply(value) && value.layerIdx === game.layerIdx && value.trackPos === game.trackPos ? value : null;
}

// 入城补给全部领取后才能前往其他节点；打开页面或只领取部分卡牌不会解锁。
export function entrySupplyGate(game) {
  const supply = entrySupplyAt(game);
  return !!supply && supply.taken.length < supply.cardIds.length;
}

export function claimEntrySupply(game, { findCard, canReceive, newUid, index:onlyIndex = null }) {
  const supply = entrySupplyAt(game);
  if (!supply) return [];
  const received = [];
  supply.cardIds.forEach((id, index) => {
    if (onlyIndex !== null && index !== onlyIndex) return;
    if (supply.taken.includes(index)) return;
    const card = findCard(id);
    if (!card || !canReceive(card)) return;
    const copy = { ...card };
    game.ownedCards.push({ uid:newUid(), card:copy, brought:1 });
    if (!game.classCard) game.classCard = copy;
    supply.taken.push(index);
    received.push(copy);
  });
  return received;
}

// Event choices keep candidate IDs and payment in the same run snapshot as coins/cards.
export function validEventChoiceReward(item) {
  return !!item && item.version === 1 && item.type === 'event-choice'
    && ['ev19-potions', 'ev19-quartermaster'].includes(item.eventId)
    && ids(item.cardIds) && item.cardIds.length > 0 && item.cardIds.length <= 3
    && new Set(item.cardIds).size === item.cardIds.length
    && item.paidCoins === (item.eventId === 'ev19-quartermaster' ? 3 : 0)
    && (item.taken === null || (Number.isInteger(item.taken) && item.taken >= 0 && item.taken < item.cardIds.length));
}

export function eventChoiceRewardAt(game) {
  const item = game.nodeRewards?.[`${game.layerIdx},${game.trackPos}`];
  return validEventChoiceReward(item) && item.taken === null ? item : null;
}

export function nodeEventAt(game) {
  const item = game.nodeRewards?.[`${game.layerIdx},${game.trackPos}`];
  return item?.version === 1 && ['event', 'event-choice'].includes(item.type)
    && typeof item.eventId === 'string' && item.eventId.length > 0 ? item : null;
}

export function bindNodeEvent(game, eventId) {
  if (nodeContentEndedAt(game)) return null;
  const existing = nodeEventAt(game);
  if (existing) return existing;
  game.nodeRewards ||= {};
  const record = { version:1, type:'event', eventId };
  game.nodeRewards[`${game.layerIdx},${game.trackPos}`] = record;
  return record;
}

export function validNodeRewards(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).every(([key, item]) => {
    if (!/^\d+,\d+$/.test(key) || !item || item.version !== 1) return false;
    if (item.type === 'closed') return true;
    if (item.altarFragmentChoice !== undefined && !validAltarFragmentChoice(item.altarFragmentChoice)) return false;
    if (item.type === 'altar') return validAltarFragmentChoice(item.altarFragmentChoice);
    if (item.type === 'restore') return validNodeRestore(item);
    if (item.type === 'event') return typeof item.eventId === 'string' && item.eventId.length > 0;
    if (item.type === 'event-choice') return validEventChoiceReward(item);
    if (item.type === 'resource') return ids(item.cardIds) && item.cardIds.length <= 2
      && (item.taken === null || (Number.isInteger(item.taken) && item.taken >= 0 && item.taken < item.cardIds.length));
    if (item.type === 'fire') return [item.hpBefore,item.hpAfter,item.hpGain].every(n => Number.isFinite(n) && n >= 0)
      && ids(item.restoredIds) && (item.classCardId === null || typeof item.classCardId === 'string')
      && typeof item.bonusReceived === 'boolean' && (item.continued === undefined || typeof item.continued === 'boolean')
      && ([item.healUsed,item.restoreUsed,item.bonusRolled].every(flag => flag === undefined)
        || [item.healUsed,item.restoreUsed,item.bonusRolled].every(flag => typeof flag === 'boolean'));
    return false;
  });
}

export function altarFragmentChoiceAt(game) {
  const record = game.nodeRewards?.[`${game.layerIdx},${game.trackPos}`];
  if (record?.type === 'restore' ? !validNodeRestore(record)
    : record?.version !== 1 || record.type !== 'altar') return null;
  return validAltarFragmentChoice(record.altarFragmentChoice) ? record.altarFragmentChoice : null;
}

export function reserveAltarFragmentChoice(game, { characterId, drawCard }) {
  const choice = altarFragmentChoiceAt(game);
  if (choice) return choice;
  const key = `${game.layerIdx},${game.trackPos}`, existing = game.nodeRewards?.[key];
  if (existing != null && !validNodeRestore(existing)) return null;
  if (typeof characterId !== 'string' || !characterId.length || typeof drawCard !== 'function') return null;
  const card = drawCard();
  if (typeof card?.id !== 'string' || !card.id.length) return null;
  const reserved = { characterId, cardIds:[card.id], taken:null };
  game.nodeRewards ||= {};
  const record = existing ?? { version:1, type:'altar' };
  record.altarFragmentChoice = reserved;
  game.nodeRewards[key] = record;
  return reserved;
}

export function resourceRewardAt(game, drawCards) {
  game.nodeRewards ||= {};
  const key = `${game.layerIdx},${game.trackPos}`;
  if (!game.nodeRewards[key]) game.nodeRewards[key] = {
    version:1, type:'resource', cardIds:drawCards().filter(Boolean).map(card => card.id), taken:null,
  };
  return game.nodeRewards[key].type === 'resource' ? game.nodeRewards[key] : null;
}

const resourceClaims = new WeakSet();
export function claimResourceReward(record, index, receive, received = () => false) {
  if (!record || endedRewardRecords.has(record) || record.type === 'closed'
    || record.taken !== null || !Number.isInteger(index) || !record.cardIds[index]) return false;
  if (resourceClaims.has(record)) return false;
  resourceClaims.add(record);
  try {
    record.taken = index;
    let accepted = false;
    try { accepted = !!receive(record.cardIds[index]); }
    catch (error) {
      if (!received()) { record.taken = null; throw error; }
      accepted = true;
    }
    if (!accepted && !received()) { record.taken = null; return false; }
    return true;
  } finally { resourceClaims.delete(record); }
}

// A page callback cannot outlive its run, location, or visible action.
const actionTokens = new WeakMap();
export function nodeActionBinding(game, UI, act) {
  const page = {}, map = game.layerData;
  actionTokens.set(game, page);
  const seed = game.seed, token = game.discoveredPairs, layer = game.layerIdx, index = game.trackPos;
  return () => (act === 'goDoor' || !nodeContentEndedAt(game, layer, index)) && actionTokens.get(game) === page && game.layerData === map && game.seed === seed && game.discoveredPairs === token && game.layerIdx === layer && game.trackPos === index
    && game.state === 'modal' && (!UI.el?.ovBody || !!UI.el.ovBody.querySelector(`[data-act="${act}"]`));
}

import { validNodeRestore } from './node-restore-state.js';
const ids = value => Array.isArray(value) && value.every(id => typeof id === 'string' && id.length > 0);
const coordinate = value => Number.isInteger(value) && value >= 0;

export function validEntrySupply(value) {
  return !!value && value.version === 1 && value.layerIdx === 0 && coordinate(value.trackPos)
    && ids(value.cardIds) && value.cardIds.length <= 2 && new Set(value.cardIds).size === value.cardIds.length
    && Array.isArray(value.taken) && new Set(value.taken).size === value.taken.length
    && (value.entered === undefined || typeof value.entered === 'boolean')
    && value.taken.every(i => Number.isInteger(i) && i >= 0 && i < value.cardIds.length);
}

export function createEntrySupply(game, cards) {
  return { version:1, layerIdx:0, trackPos:game.trackPos,
    cardIds:[...new Set(cards.filter(Boolean).map(card => card.id))], taken:[] };
}

export function entrySupplyAt(game) {
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
    if (item.type === 'restore') return validNodeRestore(item);
    if (item.type === 'event') return typeof item.eventId === 'string' && item.eventId.length > 0;
    if (item.type === 'event-choice') return validEventChoiceReward(item);
    if (item.type === 'resource') return ids(item.cardIds) && item.cardIds.length <= 2
      && (item.taken === null || (Number.isInteger(item.taken) && item.taken >= 0 && item.taken < item.cardIds.length));
    if (item.type === 'fire') return [item.hpBefore,item.hpAfter,item.hpGain].every(n => Number.isFinite(n) && n >= 0)
      && ids(item.restoredIds) && (item.classCardId === null || typeof item.classCardId === 'string')
      && typeof item.bonusReceived === 'boolean' && (item.continued === undefined || typeof item.continued === 'boolean');
    return false;
  });
}

export function resourceRewardAt(game, drawCards) {
  game.nodeRewards ||= {};
  const key = `${game.layerIdx},${game.trackPos}`;
  if (!game.nodeRewards[key]) game.nodeRewards[key] = {
    version:1, type:'resource', cardIds:drawCards().filter(Boolean).map(card => card.id), taken:null,
  };
  return game.nodeRewards[key].type === 'resource' ? game.nodeRewards[key] : null;
}

export function claimResourceReward(record, index, receive) {
  if (!record || record.taken !== null || !Number.isInteger(index) || !record.cardIds[index]) return false;
  if (!receive(record.cardIds[index])) return false;
  record.taken = index;
  return true;
}

// A page callback cannot outlive its run, location, or visible action.
const actionTokens = new WeakMap();
export function nodeActionBinding(game, UI, act) {
  const page = {}, map = game.layerData;
  actionTokens.set(game, page);
  const seed = game.seed, token = game.discoveredPairs, layer = game.layerIdx, index = game.trackPos;
  return () => actionTokens.get(game) === page && game.layerData === map && game.seed === seed && game.discoveredPairs === token && game.layerIdx === layer && game.trackPos === index
    && game.state === 'modal' && (!UI.el?.ovBody || !!UI.el.ovBody.querySelector(`[data-act="${act}"]`));
}

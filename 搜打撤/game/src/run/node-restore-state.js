const SOURCES = { 'altar-reward':3, 'altar-offering':2 };
const keyAt = game => `${game.layerIdx},${game.trackPos}`;

export function validNodeRestore(record) {
  return !!record && record.version === 1 && record.type === 'restore'
    && Object.hasOwn(SOURCES, record.source)
    && Number.isInteger(record.total) && record.total > 0 && record.total <= SOURCES[record.source]
    && Number.isInteger(record.left) && record.left >= 0 && record.left <= record.total
    && Array.isArray(record.restoredIds) && record.restoredIds.every(id => typeof id === 'string' && id.length > 0)
    && record.restoredIds.length + record.left === record.total
    && [record.hpBefore, record.hpAfter, record.hpGain].every(n => Number.isFinite(n) && n >= 0)
    && record.hpAfter - record.hpBefore === record.hpGain
    && (record.source !== 'altar-offering' || record.hpGain === 0)
    && record.hpGain <= 10 && typeof record.finished === 'boolean'
    && (record.left > 0 || record.finished);
}

export function nodeRestoreAt(game, layerIdx = game.layerIdx, trackPos = game.trackPos) {
  const record = game.nodeRewards?.[`${layerIdx},${trackPos}`];
  return validNodeRestore(record) && !record.finished && record.left > 0 ? record : null;
}

// Payment, healing and this record are saved together by the existing run snapshot.
export function beginNodeRestore(game, { source, picks }) {
  if (!Object.hasOwn(SOURCES, source) || !Number.isInteger(picks) || picks < 1 || picks > SOURCES[source]) return null;
  game.nodeRewards ||= {};
  const key = keyAt(game), existing = game.nodeRewards[key];
  if (validNodeRestore(existing)) {
    if (existing.source === source) return existing;
    if (!existing.finished) return null;
  } else if (existing) return null;
  const hpBefore = game.hp;
  if (source === 'altar-reward') game.heal(10);
  const record = { version:1, type:'restore', source, total:picks, left:picks, restoredIds:[],
    hpBefore, hpAfter:game.hp, hpGain:Math.max(0, game.hp - hpBefore), finished:false };
  game.nodeRewards[key] = record;
  return record;
}

export function claimNodeRestore(game, record, { name, entry = null, isRestorable, canReceive, newUid }) {
  if (nodeRestoreAt(game) !== record) return false;
  const matches = game.usedPocket.filter(item => (!entry || item === entry)
    && item.card.name === name && isRestorable(item.card));
  if (matches.length !== 1) return false;
  const item = matches[0];
  if (!item || item.count < 1 || !item.card.id || !canReceive(item.card)) return false;
  const copy = { uid:newUid(), card:{ ...item.card } };
  item.count--;
  if (item.count === 0) game.usedPocket.splice(game.usedPocket.indexOf(item), 1);
  game.ownedCards.push(copy);
  record.restoredIds.push(item.card.id);
  record.left--;
  if (record.left === 0) record.finished = true;
  return true;
}

export function finishNodeRestore(game, record) {
  if (game.nodeRewards?.[keyAt(game)] !== record || !validNodeRestore(record)) return false;
  record.finished = true;
  return true;
}

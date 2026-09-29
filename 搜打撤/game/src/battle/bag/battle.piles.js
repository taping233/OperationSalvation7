/* 牌堆边界操作：统一 UID 移动，避免同一张牌残留在多个区域。 */

function removeUid(pile, uid) {
  const index = pile.indexOf(uid);
  if (index < 0) return false;
  pile.splice(index, 1);
  return true;
}

function moveUid(from, to, uid) {
  if (!removeUid(from, uid)) return false;
  if (!to.includes(uid)) to.push(uid);
  return true;
}

function zoneForUid(zones, uid) {
  return Object.keys(zones).find(zone => zones[zone].includes(uid)) || null;
}

function assertUniqueZones(zones) {
  const seen = new Set();
  for (const [zone, pile] of Object.entries(zones)) {
    for (const uid of pile) {
      if (seen.has(uid)) throw new Error(`card ${uid} exists in multiple zones (at ${zone})`);
      seen.add(uid);
    }
  }
  return true;
}

export { assertUniqueZones, moveUid, removeUid, zoneForUid };

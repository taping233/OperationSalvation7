/* ============================================================
 * encounter-meta.js —— 本层遭遇池元数据只读 helper（2026-09-28 代码线 CODE-003）
 *
 * 供体验线路线面板做「常规/高危/精英池」差异化提示。口径与引擎一致：
 * 层回退镜像 buildEncounter（game.run.scenes.js:204 encounters[layerIdx] || [0]）；
 * 固定精英池概率为1，否则沿用 enc.elite.chance；这里只揭示不掷骰。
 * 纯只读零依赖：不 import 门面、不消费随机流、不写任何状态。
 * 敌人名经 MAP.monsters 映射，仅供展示；不做强度估算（避免制造隐性玩法口径）。
 * ============================================================ */

const nameOf = (monsters, id) => (monsters && monsters[id] && monsters[id].name) || id;

export function encounterPoolMeta(enc, monsters) {
  if (!enc) return null;
  const entries = Array.isArray(enc.entries) ? enc.entries : [];
  const groups = Array.isArray(enc.groups) ? enc.groups : [];
  return {
    risk: enc.risk || '中',
    strategy: enc.strategy || '',
    entryCount: entries.length,
    groupCount: groups.length,
    eliteChance: enc.guaranteedElite?.length ? 1 : enc.elite && Number.isFinite(enc.elite.chance) ? enc.elite.chance : 0,
    eliteEnemies: (enc.guaranteedElite || enc.elite?.pool || []).map(id => nameOf(monsters, id)),
    entries: entries.map(e => ({ id: e && e.id, name: nameOf(monsters, e && e.id), size: [...(e && e.size || [])] })),
    groups: groups.map(g => ({ id: g && g.id, enemies: (g && g.enemyIds || []).map(id => nameOf(monsters, id)) })),
  };
}

// layerIdx 越界/缺表时回退第 0 层（同引擎）；表不存在返回 null（展示层降级隐藏）
export function layerEncounterMeta(map, layerIdx) {
  const tables = Array.isArray(map && map.encounters) ? map.encounters : [];
  if (!tables.length) return null;
  const enc = tables[layerIdx] || tables[0];
  return encounterPoolMeta(enc, map && map.monsters);
}

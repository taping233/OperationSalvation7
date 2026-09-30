import { RULE_CONFIG } from '../core/rule-config.js';

/* ============================================================
 * extraction-preview.js —— 撤离「带出预估」纯函数（2026-09-28 代码线 CODE-002）
 *
 * 口径唯一权威：hub/extraction.commands.js 的 calculateBaseAndPending（结算本体）。
 * 这里是给地图态 UI（体验线「随身口袋」状态条等）的期望值投影：
 *   - usedPocket：结算按份逐张按 pocketKeepChance 保留 → 期望值 = Σcount × pocketKeepChance；
 *   - ownedCards：100% 带回，唯一豁免是 Base.isSha（初始攻击，结算时不入 remainingCards）；
 *   - 木材/口粮 100%；随身币不带回（结算只记 bestRunCoins 统计）。
 * 纯只读：不碰状态、不消费随机流、不判玩法（撤离资格仍由引擎判定，
 * 这里只提供 isExtractNode 供展示层参考）。
 * ============================================================ */

const EXTRACT_NODE_TYPES = ['emergencyExit', 'extraction'];

// 该节点类型是否撤离点（紧急撤离 / 终局撤离）
export function isExtractNode(nodeType) {
  return EXTRACT_NODE_TYPES.includes(nodeType);
}

export function previewExtraction(game, baseApi) {
  const owned = Array.isArray(game && game.ownedCards) ? game.ownedCards : [];
  const isSha = baseApi && typeof baseApi.isSha === 'function' ? (c) => baseApi.isSha(c) : () => false;
  const bagTotal = owned.reduce((a, o) => {
    return a + (o && o.card && !isSha(o.card) ? (o.count || 1) : 0);
  }, 0);

  const pocket = Array.isArray(game && game.usedPocket) ? game.usedPocket : [];
  const pocketTotal = pocket.reduce((a, p) => a + (p && p.card ? (p.count || 1) : 0), 0);

  const inventory = Array.isArray(game && game.inventory) ? game.inventory : [];
  let wood = 0;
  let rations = 0;
  inventory.forEach((item) => {
    const count = (item && item.count) || 1;
    if (item && item.name === '木材') wood += count;
    else if (item && item.name === '口粮') rations += count;
  });

  return {
    bagTotal,
    bagCap: baseApi && typeof baseApi.bagCap === 'function' ? baseApi.bagCap() : null,
    pocketTotal,
    expectedKept: pocketTotal * RULE_CONFIG.extraction.pocketKeepChance,   // 展示层自行格式化（如「≈2 张」）
    wood,
    rations,
    coins: (game && game.coins) || 0,
    layerIdx: game && Number.isInteger(game.layerIdx) ? game.layerIdx : null,
  };
}

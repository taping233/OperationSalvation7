// @ts-check
/* 通用定版卡面刷新器（2026-09-29）：M 批 marker 一次性回填会把回填时的卡面固化进存档，
 * 之后定版修订（老板改数值/文案）不再跟随。本刷新器按 FACE_REFRESH_BY_ID 注册表，每次启动
 * 幂等把点名卡的字段重刷为 canonical 定版值（沿用 ensureFoeRename 幂等惯例），替代
 * 一批一函数的专用刷新补丁（首例 ensurePetalFaceRefresh）。
 *
 * 保守口径：
 *   - 只刷 FACE_REFRESH_BY_ID 显式点名的 id + 字段，其余任何字段（含玩家在制作坊的改动）不碰；
 *   - 字段值动态取自 canonical 定版表（零重复副本）；
 *   - 缺表/缺卡/隐私模式静默跳过；saveAll 失败重放一次（seedBatch 同款）；
 *   - rules 一概不动——结构化 op 用 amountField 等引用卡面时，卡面刷新即生效。
 *
 * 新增一行注册表 = 一次定版修订要刷新旧档卡面；删除行 = 不再刷新。 */

/** id → 允许重刷的卡面字段列表。 */
const FACE_REFRESH_BY_ID = new Map([
  ['tt3-petal', ['heal', 'desc']],   // 2026-09-29 老板裁决 heal 2→3（覆盖 09-27 保留 heal:2 旧裁决）
]);

/** id → canonical 定版数组名（SDT.Cards 上的表）。 */
const FACE_REFRESH_TABLE_BY_ID = new Map([
  ['tt3-petal', 'TABLETOP11'],
]);

/**
 * 幂等卡面刷新入口。生产无参调用；deps 仅测试注入用。
 * @param {{ library?: any }} [deps]
 */
export function ensureCanonicalFaceRefresh(deps = {}) {
  const library = deps.library !== undefined ? deps.library
    : (typeof window !== 'undefined' ? window.SDT?.Cards : null);
  try {
    if (!library) return;
    const cards = library.all();
    let dirty = false;
    for (const [id, fields] of FACE_REFRESH_BY_ID) {
      const tableName = FACE_REFRESH_TABLE_BY_ID.get(id);
      const table = tableName ? library[tableName] : null;
      const canonical = Array.isArray(table) ? table.find(card => card && card.id === id) : null;
      if (!canonical) continue;   // 缺定版表/缺行：静默跳过（播种链未跑完时下次重试）
      const card = cards.find(item => item && item.id === id);
      if (!card) continue;
      for (const field of fields) {
        if (canonical[field] !== undefined && card[field] !== canonical[field]) {
          card[field] = canonical[field];
          dirty = true;
        }
      }
    }
    if (dirty && !library.saveAll(cards)) library.saveAll(cards);   // 失败重放一次（seedBatch 同款）
  } catch { /* 隐私模式等场景静默跳过 */ }
}

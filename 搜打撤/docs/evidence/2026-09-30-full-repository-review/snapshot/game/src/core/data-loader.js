/* ============================================================
 * data-loader.js —— 中央数据源加载器（2026-09-11 架构批次 2）
 *
 * game/data/*.json 是全部非卡牌玩法的唯一数据真源：
 *   pets.json          宠物表（孵化/升级/携带效果）
 *   achievements.json  成就展示字段 + 收藏里程碑（done 判定函数在 meta.js 按 id 关联）
 *   art-mapping.json   美术映射（职业/怪物/卡面家族/资源卡 → 资产 id）
 *   scenes.json        场景叙事、事件场景契约、职业故事
 *   map.json           地图静态表（怪物图鉴/遭遇/宝箱掉落/祭坛 BOSS）
 *   cards-sync.json    实机卡库定版覆盖批次（由 scripts/sync-cards-from-live.mjs 生成）
 *
 * 除 map 外一律深冻结：数据表运行期不可变，改数据 = 改 JSON。
 * map 不冻结：对局模式会就地改写 rules 可变副本（见 mapData.js）。
 * 其余卡牌种子（TABLETOP1~11）是代码内建卡库，仍由 cards.js 承载。
 * ============================================================ */
import pets from '../../data/pets.json';
import achievements from '../../data/achievements.json';
import artMapping from '../../data/art-mapping.json';
import scenes from '../../data/scenes.json';
import mapData from '../../data/map.json';
import cardsSync from '../../data/cards-sync.json';

const deepFreeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const key of Object.keys(value)) deepFreeze(value[key]);
    Object.freeze(value);
  }
  return value;
};

export const DATA = {
  pets: deepFreeze(pets),
  achievements: deepFreeze(achievements),
  art: deepFreeze(artMapping),
  scenes: deepFreeze(scenes),
  map: mapData,
  cardsSync: deepFreeze(cardsSync),
};

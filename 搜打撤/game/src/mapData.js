import { RULES } from './rules.js';
import { sdtDefine } from './sdt-facade.js';
import mapData from '../data/map.json';

/* ============================================================
 * 搜打撤 —— 地图静态数据表
 *
 * 地图几何（每层结点、门与入口）由 map-generator.js 按种子生成；
 * 纯数据（物品/宝箱表、怪物图鉴、遭遇表、祭坛 BOSS）外置 game/data/map.json
 * （2026-09-11 架构批次 2：中央数据源），本文件只做组装与行为注入。
 *
 * 生成器口径（2026-09-10 四层定版）：
 *   四层结点数 13/15/17/15，每层从 x=0 的入口进入、走到最右端出口；
 *   前三层出口是通往下一层的门，第 4 层出口是终局撤离点（先激活祭坛）；
 *   每层保证 ≥3 场战斗、物资格保底 1 上限 4、野生敌人格上限 4。
 *
 * 格子事件类型（生成器产出的 def.type）：
 *   entrance(入口) battle(战斗) event(随机) fire(火堆) chest(搜刮点)
 *   shop(补给站) emergencyExit(紧急撤离) door(层间门) extraction(终局撤离)
 * ============================================================ */

/* ESM 垫片：命名空间由 sdt-facade.js 唯一创建 */
sdtDefine('MAP', {
  ...mapData,

  // 对局模式会临时调整治疗等数值，因此地图持有基线规则的可变副本。
  rules: { ...RULES },

  // rollCount：区间 [min,max] 内等概率取整数（2026-09-10 定版——1-3 出 1/2/3 各 1/3，2-3 出 2/3 各 1/2）
  rollCount(size, rand) {
    const [min, max] = size;
    return min + Math.floor(rand() * (max - min + 1));
  },
});

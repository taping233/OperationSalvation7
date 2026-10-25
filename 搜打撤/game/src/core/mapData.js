import { RULES } from './rules.js';
import { sdtDefine } from './sdt-facade.js';
import mapData from '../../data/map.json' with { type: 'json' };

/* ============================================================
 * 搜打撤 —— 地图静态数据表
 *
 * 物品/宝箱表、怪物图鉴、遭遇表与祭坛 BOSS 数据来自 game/data/map.json；
 * 本文件只做组装与行为注入。
 * 新局由 run/map-generator-v7.js 生成，经 map-exploration-adapter.js 安装探索支路；
 * 节点数量与约束以 run/map-generation-rules.js 为准。
 * run/map-generator.js 是冻结的 3/9 旧版生成器，也为新生成器提供候选几何；
 * 其中历史注释不代表当前读档会重生成地图。恢复规则见 docs/save-format.md。
 * ============================================================ */

/* ESM 垫片：命名空间由 sdt-facade.js 唯一创建 */
/** @type {typeof mapData & {items:typeof mapData.items & {rations:typeof mapData.items.rations & {count?:number}},rules:{-readonly [K in keyof typeof RULES]:typeof RULES[K]},rollCount:(size:number[],rand:()=>number)=>number}} */
export const MAP = sdtDefine('MAP', {
  ...mapData,

  // 对局模式会临时调整治疗等数值，因此地图持有基线规则的可变副本。
  rules: { ...RULES },

  // rollCount：区间 [min,max] 内等概率取整数（2026-09-10 定版——1-3 出 1/2/3 各 1/3，2-3 出 2/3 各 1/2）
  rollCount(size, rand) {
    const [min, max] = size;
    return min + Math.floor(rand() * (max - min + 1));
  },
});

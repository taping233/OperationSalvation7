// @ts-check
/* M10：B-M3 装备剩余 hosted 批，魔法锅炉退役后现存 10 张。
 * Hosted 名称必须同时匹配固定 id 注册表与 canonical description；battle.hosted 执行适配由
 * battle.hosted.js 提供，玩家保存卡的自定义描述不参与宿主分派。
 * M7 已迁 tt3-master-staff / tt3-twinwater-mail，故此批不重复声明。
 *
 * 2026-09-29 重构：入口骨架收敛到 cards.sync.backfiller.js createRuleBackfiller，
 * 本文件只保留 definitions 数据与批次参数；迁移数据行为不变（m10-data.test.js 守护）。
 */
import { createRuleBackfiller } from './cards.sync.backfiller.js';

const MARKER_KEY = 'sdt-cards-m10-hosted-equipment-v1-seeded';
export const M10_HOSTED_EQUIPMENT_MARKER_KEY = MARKER_KEY;
const hostedRuleById = new Map([
  ['tt2-frostsword', 'frost-sword'],
  ['tt3-crimson-pouch', 'crimson-pouch'],
  ['tt3-fate-wheel', 'fate-wheel'],
  ['tt3-azure-sword', 'azure-sword'],
  ['tt3-chaos-eye', 'chaos-eye'],
  ['tt3-immortal-blade', 'immortal-blade'],
  ['tt3-silver-runesword', 'silver-runesword'],
  ['tt3-sapper-bomb', 'sapper-bomb'],
  ['tt3-wolf-bow', 'wolf-bow'],
  ['tt3-reverse-bow', 'reverse-bow'],
]);
const definitions = new Map([...hostedRuleById].map(([id, name]) => [id, {
  rules: { version: 1, battle: { hosted: [name] } },
}]));
const CANONICAL_TABLE_BY_ID = new Map([...hostedRuleById.keys()].map(id => [id, 'TABLETOP10']));

export const ensureM10HostedEquipmentRules = createRuleBackfiller({
  label: 'M10',
  markerKey: MARKER_KEY,
  definitions,
  canonicalTableById: CANONICAL_TABLE_BY_ID,
});

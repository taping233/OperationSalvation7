// @ts-check
// M9：命名宿主规则 + 银河之旅；完整 canonical 深相等，双门校验，保存复读后 marker。
//
// 2026-09-29 重构：入口骨架收敛到 cards.sync.backfiller.js createRuleBackfiller（canonical
// 走 canonicalOrder 优先级扫描形态，原 canonicalCard 函数同语义）；迁移数据行为不变
// （m9-data.test.js 守护）。
// 2026-10-06 招式改版（老板拍板）：银河之旅 desc「所有武术」→「所有招式」（招式=武术+法术，
// terminology 定版口径），rules 改 registerRule moveCost1（effect-steps.m2 双旗标同落）；
// marker 升 v2 + previousRulesById 收录 v1 旧版快照，让已盖章旧档按 m3 v3 先例重放改写。
import { createRuleBackfiller } from './cards.sync.backfiller.js';

const M9_MARKER_KEY = 'sdt-cards-m9-hosted-rules-v2-seeded';
export const M9_HOSTED_BY_ID = {
  "tt7-imitate": "imitate",
  "cc-mana-surge": "mana-surge",
  "cc-rot-seed": "rot-seed",
  "cmtn1lbhbqi4": "charge-fireball",
  "tt7-stratagem": "pouch-container",
  "tt2-pearlbox": "pearl-container",
  "tt2-venomstaff": "venom-staff",
  "tt3-element-seal": "element-seal",
  "tt3eq-mistbox": "cost-swap",
  "tt7-darkfort": "dark-fort",
  "tt7-naturestaff": "nature-staff",
  "tt8-demonslay": "ranger-chain",
  "tt8-heavensword": "ranger-chain",
  "tt8-abyss-sovereign": "sovereign",
  "tt8-hero-assassin": "assassin",
  "tt8-hero-descender": "consume-fireball",
  "tt8-hero-sealer": "seal-chain",
  "tt8-hero-summoner": "gate-choices",
  "tt8-hero-warrior": "kill-transform",
  "tt3-mystery-potion": "mystery-potion",
  "tt8-hero-guardian": "guardian",
  "tt8-hero-mage": "mage",
  "tt8-hero-priest": "priest",
  "tt8-hero-ranger": "ranger",
  "tt8-hero-sword": "sword",
  "tt8-hero-warlock": "warlock"
};
/** @type {Map<string, { rules: object }>} */
const definitions = new Map(Object.entries(M9_HOSTED_BY_ID).map(([id, name]) =>
  [id, { rules: { version: 1, battle: { hosted: [name],
    ...(id === 'tt8-hero-sealer' ? { requirements: [{ kind: 'unplayable' }] } : {}) } } }]));
definitions.set('tt5-galaxy-voyage', { rules: { version: 1,
  battle: { target: { side: 'self', area: false } },
  triggers: { onPlay: [{ op: 'registerRule', rule: 'moveCost1' }] } } });

// 优先实机同步，其次最新 TABLETOP11/10；从源定义取 canonical，不读玩家当前卡面。
//（原 canonicalCard 扫描顺序逐字保留，现为工厂 canonicalOrder 形态。）
const CANONICAL_ORDER = ['CARDS_SYNC', 'TABLETOP11', 'TABLETOP10'];

// v1 时代旧版 rules 快照（m3 v3 先例）：整卡（canonical 卡面 + 旧版 rules）精确匹配的存档
// 视为本批旧版产物，允许重写为现行版；玩家改名/改字段的卡深不相等，仍保守跳过。
const previousRulesById = new Map([
  ['tt5-galaxy-voyage', { version: 1,
    battle: { target: { side: 'self', area: false } },
    triggers: { onPlay: [{ op: 'registerRule', rule: 'meleeCost1' }] } }],
]);

export const ensureM9HostedRules = createRuleBackfiller({
  label: 'M9',
  markerKey: M9_MARKER_KEY,
  definitions,
  canonicalOrder: CANONICAL_ORDER,
  previousRulesById,
});

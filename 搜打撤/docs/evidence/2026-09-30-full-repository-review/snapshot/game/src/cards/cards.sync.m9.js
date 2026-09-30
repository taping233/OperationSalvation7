// @ts-check
// M9：命名宿主规则 + 银河之旅；完整 canonical 深相等，双门校验，保存复读后 marker。
//
// 2026-09-29 重构：入口骨架收敛到 cards.sync.backfiller.js createRuleBackfiller（canonical
// 走 canonicalOrder 优先级扫描形态，原 canonicalCard 函数同语义）；迁移数据行为不变
// （m9-data.test.js 守护）。
import { createRuleBackfiller } from './cards.sync.backfiller.js';

const M9_MARKER_KEY = 'sdt-cards-m9-hosted-rules-v1-seeded';
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
const definitions = new Map(Object.entries(M9_HOSTED_BY_ID).map(([id, name]) =>
  [id, { rules: { version: 1, battle: { hosted: [name],
    ...(id === 'tt8-hero-sealer' ? { requirements: [{ kind: 'unplayable' }] } : {}) } } }]));
definitions.set('tt5-galaxy-voyage', { rules: { version: 1,
  battle: { target: { side: 'self', area: false } },
  triggers: { onPlay: [{ op: 'registerRule', rule: 'meleeCost1' }] } } });

// 优先实机同步，其次最新 TABLETOP11/10；从源定义取 canonical，不读玩家当前卡面。
//（原 canonicalCard 扫描顺序逐字保留，现为工厂 canonicalOrder 形态。）
const CANONICAL_ORDER = ['CARDS_SYNC', 'TABLETOP11', 'TABLETOP10'];

export const ensureM9HostedRules = createRuleBackfiller({
  label: 'M9',
  markerKey: M9_MARKER_KEY,
  definitions,
  canonicalOrder: CANONICAL_ORDER,
});

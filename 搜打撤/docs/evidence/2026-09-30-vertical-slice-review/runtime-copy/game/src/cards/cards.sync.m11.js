// @ts-check
// M11：M 批剩余普通卡的命名 hosted 声明；执行文本由 battle.hosted 固定 canonical identity adapter 提供。
//
// 2026-09-29 重构：入口骨架收敛到 cards.sync.backfiller.js createRuleBackfiller（canonical
// 走 canonicalOrder 优先级扫描形态，原 canonicalCard 函数同语义）；迁移数据行为不变
// （m11-data.test.js 守护）。
import { createRuleBackfiller } from './cards.sync.backfiller.js';

export const M11_MARKER_KEY = 'sdt-cards-m11-hosted-rules-v1-seeded';

export const M11_HOSTED_BY_ID = Object.freeze({
  'cmtn1wnhhym': 'temporary-hand-cards',
  'cmtn233trmeg': 'keep-self-in-hand',
  'tt3-fatal-pierce': 'bleed-gated-armor-break',
  'tt3-frostfall': 'choose-and-cast-melee',
  'tt3-qi-wave': 'draw-and-price-damage',
  'tt7-bloodpoison': 'double-target-poison-daggers',
  'tt7-ghostblade': 'stealth-break-bonus',
  'tt7-marchrush': 'last-hand-repeat-all',
  'cc-poison-burst': 'burst-existing-poison',
  'tt12-felguard': 'infused-immune-spell',
  'tt12-freezeray': 'untouched-target-freeze',
  'tt12-raydragon': 'infused-ray',
  'tt3-magic-lamp': 'three-choice-lamp',
  'tt7-holyheal': 'infused-price-heal',
  'tt7-meteorstrong': 'infused-fireball-burst',
  'tt7-provoke': 'foe-fight-select',
  'tt3sp-bloodstorm': 'infused-repeating-lifesteal',
  'tt3sp-flowerzhen': 'double-and-burst-poison',
  'tt3sp-silverthorn': 'infused-damage-bonus',
  'tt-token-color': 'class-ability-acquire',
  'tt-medneedle': 'delayed-heal-item',
  'tt7-arcanebolt': 'damage-and-draw',
});

// tt-token-color 是 bag.use 特例（员工通行证：直授职业能力，非 hosted 声明），其余为命名 hosted。
const definitions = new Map(Object.entries(M11_HOSTED_BY_ID).map(([id, hosted]) =>
  [id, id === 'tt-token-color'
    ? { rules: { version: 1, bag: { use: [{ op: 'acquire', pool: { kind: 'classAbility' } }] } } }
    : { rules: { version: 1, battle: { hosted: [hosted] } } }]));

// 优先实机同步，其次最新 TABLETOP 定版；从源定义取 canonical，不读玩家当前卡面。
//（原 canonicalCard 扫描顺序逐字保留，现为工厂 canonicalOrder 形态。）
const CANONICAL_ORDER = ['CARDS_SYNC', 'TABLETOP12', 'TABLETOP11', 'TABLETOP10', 'TABLETOP7'];

export const ensureM11HostedRules = createRuleBackfiller({
  label: 'M11',
  markerKey: M11_MARKER_KEY,
  definitions,
  canonicalOrder: CANONICAL_ORDER,
});

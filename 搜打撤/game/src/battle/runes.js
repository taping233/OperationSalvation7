import { sdtDefine } from '../core/sdt-facade.js';
/* ============================================================
 * 龙巢 · 符文系统（2026-09-16 Item：第二地图「龙巢」定版初稿实装）
 *
 *   共 19 种符文类别 × 5 属性（水火草光暗）；稀有度权重 古朴4 : 稀有2 : 史诗1
 *   （稀有=古朴一半、史诗=稀有一半）；0.7% 概率出双属性符文（两个不同属性）。
 *   符文槽上限 3，重复属性在羁绊判定中不叠加。
 *   属性羁绊（按槽内去重属性集合判定）：
 *     水1 开战获得1张本职业卡  水3 每回合开始发现1张本职业卡
 *     火1 首回合额外1能量      火3 每回合额外1能量
 *     草1 装备上限+1           草3 装备无上限
 *     光1 洗入1张随机传说招式并0费  光3 洗入3张不同随机传说招式并0费
 *     暗1 对半血敌人伤害+1     暗3 对敌人伤害+1
 * ============================================================ */

export const RUNE_ATTRIBUTES = ['水', '火', '草', '光', '暗'];

export const RUNE_KINDS = [
  { id: 'life',    name: '生命符文', rarity: '古朴', desc: '每场战斗结束后，本轮冒险中生命上限永久 +3。' },
  { id: 'attack',  name: '攻击符文', rarity: '古朴', desc: '攻 +1。' },
  { id: 'mana',    name: '法力符文', rarity: '古朴', desc: '法伤 +1。' },
  { id: 'time',    name: '时光符文', rarity: '稀有', desc: '回合结束效果触发 2 次（实装口径：你的正面计时状态到回合结束不再递减）。' },
  { id: 'swift',   name: '极速符文', rarity: '古朴', desc: '回合结束时打出最左边的手牌。' },
  { id: 'bleed',   name: '流血符文', rarity: '古朴', desc: '对战开始时对所有敌人施加 1 层流血。' },
  { id: 'poison',  name: '中毒符文', rarity: '古朴', desc: '回合开始时对所有敌人施加 1 层中毒。' },
  { id: 'frozen',  name: '冰冻符文', rarity: '古朴', desc: '每当你冰冻 1 名角色，抽 2 张牌。' },
  { id: 'arrow',   name: '箭矢符文', rarity: '古朴', desc: '你的箭释放 2 次。' },
  { id: 'fireball', name: '火球符文', rarity: '稀有', desc: '回合开始时，消耗牌库底的 1 张牌并随机释放 1 张火球类法术。' },
  { id: 'morph',   name: '变身符文', rarity: '古朴', desc: '对战开始时从 2 种随机形态中选择 1 张释放。' },
  { id: 'rainbow', name: '彩虹符文', rarity: '稀有', desc: '在符文背包中使用：选择 1 种属性 + 1 项符文类别，合成 1 块自定义完美符文。' },
  { id: 'holy',    name: '圣洁符文', rarity: '古朴', desc: '对战开始的前三回合免疫诅咒，且回合结束时获得 4 点护甲。' },
  { id: 'void',    name: '虚空符文', rarity: '古朴', desc: '第一回合开始时，复制你手牌和牌库中的 0 费招式各 1 张。' },
  { id: 'shield',  name: '防御符文', rarity: '古朴', desc: '获得护甲量翻倍。' },
  { id: 'unyield', name: '不屈符文', rarity: '古朴', desc: '每当你受到伤害时，抽 1 张牌。' },
  { id: 'ash',     name: '灰烬符文', rarity: '稀有', desc: '你的手牌上限为 9，手牌中放不下的招式会直接释放。' },
  { id: 'infinite', name: '无限符文', rarity: '史诗', desc: '套牌外的招式均 -1 费。' },
  { id: 'spacetime', name: '时空符文', rarity: '史诗', desc: '本局对战限一次，回合开始时若你牌库已空，立即获得 1 个额外回合。' },
];

export const RUNE_RARITY_WEIGHTS = { '古朴': 4, '稀有': 2, '史诗': 1 };
const DUAL_CHANCE = 0.007;   // 0.7%：双属性符文

/** 按稀有度权重随机一种类别（可限定稀有度，用于定向箱子）。 */
export function rollRuneKind(random, rarity, excludeNames) {
  let kinds = RUNE_KINDS.filter(k => !excludeNames || !excludeNames.includes(k.name));
  if (rarity) kinds = kinds.filter(k => k.rarity === rarity);
  if (!kinds.length) kinds = RUNE_KINDS;
  const r = random();
  return kinds[Math.floor(r * kinds.length)];
}

/** 随机属性（可排除已选属性，供双属性第二个属性使用）。 */
export function rollAttribute(random, exclude) {
  let attrs = RUNE_ATTRIBUTES.filter(a => !exclude || !exclude.includes(a));
  if (!attrs.length) attrs = RUNE_ATTRIBUTES;
  const r = random();
  return attrs[Math.floor(r * attrs.length)];
}

/** 按爆率刷一块符文：rarityWeights 同源；0.7% 双属性。 */
export function rollRune(random, opts) {
  const o = opts || {};
  const r = random();
  let attrs;
  if (o.forceAttrs && o.forceAttrs.length) {
    attrs = o.forceAttrs.slice(0, 2);
  } else if (r < DUAL_CHANCE) {
    const a1 = rollAttribute(random);
    const a2 = rollAttribute(random, [a1]);
    attrs = [a1, a2];
  } else {
    attrs = [rollAttribute(random)];
  }
  const kind = o.forceKind || rollRuneKind(random, o.rarity, o.excludeNames);
  return { kind: kind.id, name: kind.name, rarity: o.rarity || kind.rarity, attrs, desc: kind.desc };
}

/** 属性羁绊判定：attrs = 槽内符文属性的去重集合。 */
export function synergyOf(distinctAttrs) {
  const set = new Set(distinctAttrs || []);
  return {
    water1: set.has('水'),
    water3: set.has('水'),      // 3水需要 3 个水属性符文（槽上限 3 = 全水）
    fire1: set.has('火'),
    fire3: set.has('火'),
    grass1: set.has('草'),
    grass3: set.has('草'),
    light1: set.has('光'),
    light3: set.has('光'),
    dark1: set.has('暗'),
    dark3: set.has('暗'),
    full: set.size >= 3,
  };
}

/** 槽内符文（最多 3）→ 生效羁绊：水3/火3/光3/草3/暗3 需要同属性符文 ≥3 块。 */
export function evaluateSlots(slots) {
  const runes = (slots || []).filter(Boolean);
  const distinct = [...new Set(runes.flatMap(r => r.attrs))];
  const attrCount = {};
  runes.forEach(r => r.attrs.forEach(a => { attrCount[a] = (attrCount[a] || 0) + 1; }));
  const syn = synergyOf(distinct);
  // 3 段羁绊要求同属性符文占满 3 槽（重复属性不能叠加 → 只有全同属性才升 3 段）
  ['水', '火', '草', '光', '暗'].forEach(a => {
    const three = (attrCount[a] || 0) >= 3;
    if (a === '水') syn.water3 = three; if (a === '火') syn.fire3 = three;
    if (a === '草') syn.grass3 = three; if (a === '光') syn.light3 = three;
    if (a === '暗') syn.dark3 = three;
  });
  return syn;
}

sdtDefine('Runes', { RUNE_ATTRIBUTES, RUNE_KINDS, RUNE_RARITY_WEIGHTS, rollRune, rollRuneKind, rollAttribute, synergyOf, evaluateSlots, DUAL_CHANCE });

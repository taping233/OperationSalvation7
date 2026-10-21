// 在内存投影已批准的卡面修订；历史 E8 before 文件保持原字节。
import frozenInventory from '../../docs/evidence/e8-card-migration-2026-09-27/catalog-before.json';
import approvedExecution from '../fixtures/builtin-execution-approved-20261020.json';

// 反馈 #5 的独立批准值；不得从待验证的生产数据/规则反推测试期望。
const APPROVED_LAMP_DESC = '抉择：1° 发现招式并释放；2° 消灭 1 名受伤敌人（非 BOSS）；3° 冰冻 2 名角色，获得5 点护甲。';

export const RETIRED_1010 = new Set(['tt-medneedle', 'tt-token-color', 'tt3-deep-seal', 'tt3eq-boiler']);
// 2026-10-18 老板批准的事件选择与腐化之种死亡真伤；仅投影生产副本，CARDS_SYNC 不变。
export const APPROVED_1018_PRODUCTION_REVISIONS = [
  ['tt6-bandits', 'desc', '反抗组织拾荒者 ×3~5（随层数增加）。奖励：密封物资箱 ×2。', '可逃离，或迎战反抗组织拾荒者 ×3~5（随层数增加），胜利获得密封物资箱 ×2。'],
  ['tt6-goldhammer', 'desc', '获得卡牌「闪金之锤」。', '选择领取「闪金之锤」，或接受送信委托：下一家商店随机两格商品免费，排除初始攻击。'],
  ['tt6-mystery', 'desc', '获得员工通行证A碎片，+2 币。', '投骰领取：1~3 点获得员工通行证A碎片 ×1，4~6 点获得 3 币；也可离开。'],
  ['tt6-relief', 'desc', '回复 6 点生命。', '选择回复 6 点生命，或投骰获得 1 张随机招式。'],
  ['cc-rot-seed', 'desc', '对 1 名敌人附加 2 层中毒；其死亡时，将中毒层数转移给另一名敌人。', '对 1 名敌人附加 2 层中毒并标记。被标记的敌人死亡时，对所有敌人造成等同于其死亡时中毒层数的真实伤害。'],
  ['cc-rot-seed', 'dmgType', undefined, 'true'],
  ['tt3-dig-treasure', 'desc', '从牌库底发现 1 张牌，并获得等同于其价格的护甲。', '从牌库底三张牌中发现1张牌，并获得等同于其价格的护甲。'],
];
const revisions = {
  'cc-demon': { dmg: 7, desc: '7′，损失 2 点生命。' },
  'tt2-forestarrow': { name: '回音箭' },
  'tt5-galaxy-voyage': { desc: '本场对战中，你的所有招式均为 1 费。' },
  'cc-poison-burst': { cost: 1 },
  'cmtn125e1nk0': { desc: '发现一张传说卡。' },
  'tt4-shine-token': { rarity: '传说' },
  // 2026-10-21 反馈#5：神灯第 1 项文案改「发现招式」——基线同步新文案，
  // armor:5 删除与规则改写仍由 isApprovedLampArmorRemoval 单独守护。
  'tt3-magic-lamp': { desc: APPROVED_LAMP_DESC },
};
const sorted = value => Array.isArray(value) ? value.map(sorted) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(k => [k, sorted(value[k])])) : value;
// compareMigrationInventories 接收已投影新文案的 before，仍锁原有 armor:5 与全部其余字段。
const lampBefore = { ...frozenInventory.production.cards.find(row => row.id === 'tt3-magic-lamp').card,
  desc: APPROVED_LAMP_DESC };
const lampFace = { ...lampBefore };
delete lampFace.armor;
const lampAfter = { ...lampFace, rules: approvedExecution['tt3-magic-lamp'].rules };

// 仅放行已冻结的生产神灯 armor:5 → 字段不存在（连同已批准的第 1 项文案/抉择池修订），
// 其余卡面字节语义与现行定版声明必须一致。
export function isApprovedLampArmorRemoval(previous, current) {
  return previous?.armor === 5 && current != null && !Object.hasOwn(current, 'armor')
    && JSON.stringify(sorted(previous)) === JSON.stringify(sorted(lampBefore))
    && JSON.stringify(sorted(current)) === JSON.stringify(sorted(lampAfter));
}

export function approvedRevisionBaseline(original) {
  const baseline = structuredClone(original);
  const revise = row => {
    Object.assign(row.card, revisions[row.id] || {});
    if (row.id === 'tt2-piercearrow') {
      row.card.desc = '造成（你的攻击力 - 1）点攻击伤害；对目标附加破甲，持续 2 回合。';
      delete row.card.armor;
    }
    if (row.id === 'cmtn125e1nk0' && row.card.rules) row.card.rules.triggers.onPlay[0].pool.kind = '传说';
    return row;
  };
  baseline.production.cards = baseline.production.cards.filter(r => !RETIRED_1010.has(r.id)).map(revise);
  baseline.cardsSync.cards = baseline.cardsSync.cards.filter(r => !RETIRED_1010.has(r.id)).map(revise);
  for (const id of ['cc-poison-burst', 'cmtn125e1nk0', 'tt4-shine-token', 'tt2-forestarrow']) {
    const card = structuredClone(baseline.production.cards.find(r => r.id === id).card);
    if (id === 'cmtn125e1nk0') card.rules = { version: 1,
      battle: { target: { side: 'self', area: false } },
      triggers: { onPlay: [{ op: 'acquire', n: 1, pool: { kind: '传说' }, dest: 'discover' }] } };
    if (id === 'tt2-forestarrow') card.rules = { version: 1,
      battle: { target: { side: 'enemy', area: false } },
      triggers: { onPlay: [
        { op: 'damage', amountField: 'dmg', target: 'chosenEnemy' },
        { op: 'armor', amount: 3 },
      ] } };
    const row = baseline.cardsSync.cards.find(r => r.id === id);
    if (row) row.card = sorted(card); else baseline.cardsSync.cards.push({ id, card: sorted(card) });
  }
  for (const [id, field, previous, current] of APPROVED_1018_PRODUCTION_REVISIONS) {
    const card = baseline.production.cards.find(row => row.id === id)?.card;
    if (!card || card[field] !== previous) throw new Error(`Unreviewed original ${id}.${field}`);
    card[field] = current;
  }
  baseline.cardsSync.cards.sort((a,b) => a.id < b.id ? -1 : 1);
  return baseline;
}

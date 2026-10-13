// 在内存投影已批准的卡面修订；历史 E8 before 文件保持原字节。
export const RETIRED_1010 = new Set(['tt-medneedle', 'tt-token-color', 'tt3-deep-seal', 'tt3eq-boiler']);
const revisions = {
  'cc-demon': { dmg: 7, desc: '7′，损失 2 点生命。' },
  'tt2-forestarrow': { name: '回音箭' },
  'tt5-galaxy-voyage': { desc: '本场对战中，你的所有招式均为 1 费。' },
  'cc-poison-burst': { cost: 1 },
  'cmtn125e1nk0': { desc: '发现一张传说卡。' },
  'tt4-shine-token': { rarity: '传说' },
};
const sorted = value => Array.isArray(value) ? value.map(sorted) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(k => [k, sorted(value[k])])) : value;
export function approvedRevisionBaseline(original) {
  const baseline = structuredClone(original);
  const revise = row => {
    Object.assign(row.card, revisions[row.id] || {});
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
  baseline.cardsSync.cards.sort((a,b) => a.id < b.id ? -1 : 1);
  return baseline;
}

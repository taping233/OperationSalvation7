// 2026-10-20 定版：破甲箭由自身 +3 甲改为对目标附加 2 回合破甲。
// 每次播种检查已知旧卡，兼容 M2 marker 已存在的卡库；自定义字段与规则保持原样。
const ID = 'tt2-piercearrow';
const OLD_DESCRIPTIONS = new Set([
  '攻（-1），获得 3 点护甲。',
  '造成（你的攻击力 - 1）点攻击伤害，你获得 3 点护甲。',
]);
const OLD_RULES = {
  version: 1,
  battle: { target: { side: 'enemy', area: false } },
  triggers: { onPlay: [
    { op: 'damage', amountField: 'dmg', target: 'chosenEnemy' },
    { op: 'armor', amount: 3 },
  ] },
};
const normalized = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);

export function ensurePierceArrowRevision(library) {
  const canonical = library.TABLETOP10?.find(card => card?.id === ID);
  if (!canonical?.rules) return false;
  const cards = library.all();
  let changed = false;
  const next = cards.map(card => {
    if (card?.id !== ID || !OLD_DESCRIPTIONS.has(card.desc) || card.armor !== 3
      || !['name', 'cost', 'rarity', 'type', 'dmg', 'dmgType', 'value'].every(key => card[key] === canonical[key])
      || (card.rules !== undefined && normalized(card.rules) !== normalized(OLD_RULES))) return card;
    const updated = { ...card, desc: canonical.desc, rules: JSON.parse(JSON.stringify(canonical.rules)) };
    delete updated.armor;
    changed = true;
    return updated;
  });
  return changed ? library.saveAll(next) !== false : false;
}

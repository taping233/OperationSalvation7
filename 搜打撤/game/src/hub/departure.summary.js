// Presentation preview: no random draw, storage write or rule mutation.
import { departureStackKey, findDepartureStack } from './base-departure.commands.js';

// 推荐只预览，不抽牌、不写预设、不扣仓；既有选择始终保留。
export function previewRecommendedDeparture(options) {
  const picks = { ...options.picks }, added = [];
  const ref = stack => ({ cardId: stack.card.id, ...((stack.variantKey || stack.card.variantKey) ? { variantKey: stack.variantKey || stack.card.variantKey } : {}) });
  const presetFor = selection => ({ picks: Object.entries(selection).filter(([, n]) => n > 0).map(([key, count]) => ({ card: ref(findDepartureStack(options.stash, key) || { card: {} }), count })) });
  const rank = card => /护甲|护盾|格挡|破甲|回复|治疗/.test(card.desc || '') ? 0 : 1;
  const candidates = options.stash.filter(stack => stack.count > 0 && stack.card.id && stack.card.rarity !== '职业' &&
    (['武术', '法术', '生物', '装备'].includes(stack.card.type) || stack.card.type === '道具' && /回复|治疗|复原/.test(stack.card.desc || '')))
    .sort((a, b) => rank(a.card) - rank(b.card) || (a.card.cost || 0) - (b.card.cost || 0));
  for (const stack of candidates) {
    if (added.length >= 3) break;
    const key = departureStackKey(stack);
    if (findDepartureStack(options.stash, key) !== stack || Object.entries(picks).some(([selected, n]) => n > 0 && findDepartureStack(options.stash, selected)?.card.name === stack.card.name)) continue;
    const next = { ...picks, [key]: 1 }, summary = departureSummary({ ...options, picks: next });
    const preview = options.previewDeployment({ baseSnapshot: { stash: options.stash }, preset: presetFor(next), cardCatalog: options.stash.map(item => item.card), bagCapacity: summary.capacity });
    if (!preview.canStart || summary.slots > Math.max(0, options.capacity - 3)) continue;
    picks[key] = 1; added.push(stack.card.name);
  }
  return { picks, added, summary: departureSummary({ ...options, picks }) };
}
export function departureSummary({ starterCount, starterCard, fireball, pet, stash, picks, capacity, stackCapOf }) {
  const effect = pet?.effect || {};
  const starter = effect.shaToFireball && fireball ? fireball : starterCard;
  const count = starterCount + (effect.extraSha || 0);
  const known = new Map([[starter.name, { card: starter, count }]]);
  let extraCount = 0;
  let resourceBonus = 0;
  for (const [key, requested] of Object.entries(picks || {})) {
    const stack = findDepartureStack(stash, key);
    if (!stack || stack.card.rarity === '职业') continue;
    const quantity = Math.min(Math.max(0, Math.floor(Number(requested) || 0)), stack.count);
    if (!quantity) continue;
    extraCount += quantity;
    if (stack.card.id === 'tt2-pearlbox') resourceBonus += quantity * 9;
    const name = stack.card.name;
    const entry = known.get(name) || { card: stack.card, stackKey: departureStackKey(stack), count: 0 };
    entry.count += quantity;
    known.set(name, entry);
  }
  const cells = [...known.values()].flatMap(entry => {
    const cap = stackCapOf(entry.card);
    return Array.from({ length: Math.ceil(entry.count / cap) }, (_, index) => ({ card: entry.card, stackKey: entry.stackKey, count: Math.min(cap, entry.count - index * cap), fixed: entry.card.name === starter.name }));
  });
  return { starter, starterCount: count, extraCount, knownCount: count + extraCount, slots: cells.length, capacity: capacity + resourceBonus, resourceBonus, cells };
}

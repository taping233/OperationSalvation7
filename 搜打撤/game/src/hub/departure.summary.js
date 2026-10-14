// Presentation preview: no random draw, storage write or rule mutation.
import { departureStackKey, findDepartureStack } from './base-departure.commands.js';
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

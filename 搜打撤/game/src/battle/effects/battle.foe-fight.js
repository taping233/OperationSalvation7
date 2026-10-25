import { isLegacyProvoke } from '../../cards/card-legacy-battle-policy.js';
// Selection belongs to this cast, never to persisted card data. Object spreads
// preserve the symbol through hosted normalization; JSON saves omit it.
const selectedFighters = Symbol('selectedFighters');
export const isFoeFightCard = card => card?.rules?.triggers?.onPlay?.some(operation => operation.op === 'foeFight' && operation.pick === 'two')
  || isLegacyProvoke(card);
export const foeFightTargets = card => card?.[selectedFighters];
export const withFoeFightTargets = (card, targets) => ({ ...card, [selectedFighters]: Object.freeze([...targets]) });
export const validFoeFightTargets = (targets, alive) => Array.isArray(targets) && targets.length === 2
  && targets[0] !== targets[1] && targets.every(foe => alive.includes(foe) && !foe.dead);

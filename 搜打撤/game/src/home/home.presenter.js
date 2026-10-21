import { getCollection, getCharacter } from '../hub/collection.commands.js';
import { getHome } from './home.commands.js';

const freeze = value => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
};

/** 把 M01/M02/M03 的只读快照收敛为 M05 场景唯一输入。 */
export function presentHome(baseSnapshot, { cardCatalog, characterId, revision = 0 } = {}) {
  const home = getHome(baseSnapshot);
  const collection = getCollection(baseSnapshot, cardCatalog)
    .filter(item => item.registered)
    .map(item => ({ ...item, label: cardCatalog?.find?.(card => card.id === item.card.cardId)?.name || item.card.cardId }));
  const selectedCharacter = characterId || baseSnapshot?.selClass || 'wu';
  return freeze({
    home,
    character: getCharacter(baseSnapshot, selectedCharacter),
    collectionDisplays: collection,
    resources: {
      coins: Number(baseSnapshot?.coins) || 0,
      wood: Number(baseSnapshot?.wood) || 0,
      rations: Number(baseSnapshot?.rations) || 0,
    },
    revision,
  });
}

export { homeErrorMessage } from '../hub/command-errors.js';

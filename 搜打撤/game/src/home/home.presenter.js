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

export function homeErrorMessage(result) {
  if (!result || result.ok) return '';
  return result.message || ({
    STALE_REVISION: '基地资料已变化，请刷新后重试。',
    SAVE_FAILED: '保存失败，原布局仍然保留。',
    INSUFFICIENT_FUNDS: '储备币不足。',
    PLACEMENT_OVERLAP: '家具位置重叠。',
    PLACEMENT_OUT_OF_BOUNDS: '家具超出房间范围。',
  }[result.code] || '操作失败，请重试。');
}

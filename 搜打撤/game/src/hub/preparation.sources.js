import { freezeDeep as freeze } from './commands.shared.js';
import { isRandomObtainableCard } from '../cards/card-obtainability.js';

// Evidence follows source symbols so line shifts do not invalidate the references.
const SOURCE_EVIDENCE = freeze({
  randomPool: { sourceId: 'random-obtainable-pool', kind: 'pool', conditions: '进入实际调用通用随机卡池的奖励、发现或商店候选；进入候选池不表示本次必得。', evidenceRef: 'game/src/cards/card-obtainability.js isRandomObtainableCard + game/src/run/game.run.shop.js generateShopStock + game/src/cards/cards.rules.js pickOfRarity', certainty: 'known' },
  classPool: { sourceId: 'matching-class-pool', kind: 'class-pool', conditions: '选择对应人物职业后，在实际调用职业卡池的火堆、搜刮点或祭坛候选中出现；不保证本次必得。', evidenceRef: 'game/src/cards/cards.rules.js classPool/randomClassCard + game/src/run/chests.js 职业搜刮点 + game/src/run/game.run.altar.js openFireRest', certainty: 'known' },
  abilityPool: { sourceId: 'matching-ability-pool', kind: 'class-pool', conditions: '选择对应人物职业后，在实际过滤能力卡的职业候选中出现；不保证本次必得。', evidenceRef: 'game/src/run/game.run.altar.js openAltarRitual/altarFragHero 能力卡过滤', certainty: 'known' },
  unknown: { sourceId: 'unconfirmed-source', kind: 'unknown', conditions: '当前代码与配置中没有足够证据确认稳定来源。', evidenceRef: 'unconfirmed', certainty: 'unknown' },
});

export function getSources(targetId, catalogVersion, cardCatalog = []) {
  const card = cardCatalog.find(item => item?.id === targetId);
  let sources;
  if (!card) sources = [SOURCE_EVIDENCE.unknown];
  else if (card.type === '能力卡' && card.cls) sources = [SOURCE_EVIDENCE.abilityPool];
  else if (card.rarity === '职业' && card.cls) sources = [SOURCE_EVIDENCE.classPool];
  else if (isRandomObtainableCard(card)) sources = [SOURCE_EVIDENCE.randomPool];
  else sources = [SOURCE_EVIDENCE.unknown];
  return freeze(sources.map(source => ({ ...source, targetId, catalogVersion: catalogVersion ?? 'unknown', ...(card?.cls ? { classId: card.cls } : {}) })));
}


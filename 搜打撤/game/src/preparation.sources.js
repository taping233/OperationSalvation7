const freeze = value => { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; Object.values(value).forEach(freeze); return Object.freeze(value); };

export const SOURCE_EVIDENCE = freeze({
  randomPool: { sourceId: 'random-obtainable-pool', kind: 'pool', conditions: '进入实际调用通用随机卡池的奖励、发现或商店候选；进入候选池不表示本次必得。', evidenceRef: 'game/src/cards.js:isRandomObtainable + game/src/base.js:shopCards', certainty: 'known' },
  classPool: { sourceId: 'matching-class-pool', kind: 'class-pool', conditions: '选择对应人物职业后，在实际调用职业卡池的火堆、宝箱或祭坛候选中出现；不保证本次必得。', evidenceRef: 'game/src/cards.js:classPool + game/src/chests.js:52 + game/src/game.run.altar.js:39', certainty: 'known' },
  abilityPool: { sourceId: 'matching-ability-pool', kind: 'class-pool', conditions: '选择对应人物职业后，在实际过滤能力卡的职业候选中出现；不保证本次必得。', evidenceRef: 'game/src/game.run.altar.js:473', certainty: 'known' },
  unknown: { sourceId: 'unconfirmed-source', kind: 'unknown', conditions: '当前代码与配置中没有足够证据确认稳定来源。', evidenceRef: 'unconfirmed', certainty: 'unknown' },
});

function isRandomObtainableShape(card) {
  return !!card && !card.unrandom && !['初始', '职业', '衍生', '棱彩'].includes(card.rarity) && card.type !== '生物' && card.name !== '初始攻击';
}

export function getSources(targetId, catalogVersion, cardCatalog = []) {
  const card = cardCatalog.find(item => item?.id === targetId);
  let sources;
  if (!card) sources = [SOURCE_EVIDENCE.unknown];
  else if (card.type === '能力卡' && card.cls) sources = [SOURCE_EVIDENCE.abilityPool];
  else if (card.rarity === '职业' && card.cls) sources = [SOURCE_EVIDENCE.classPool];
  else if (isRandomObtainableShape(card)) sources = [SOURCE_EVIDENCE.randomPool];
  else sources = [SOURCE_EVIDENCE.unknown];
  return freeze(sources.map(source => ({ ...source, targetId, catalogVersion: catalogVersion ?? 'unknown', ...(card?.cls ? { classId: card.cls } : {}) })));
}


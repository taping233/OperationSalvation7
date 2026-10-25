import { freezeDeep as freeze } from './commands.shared.js';

// 来源证据引用（2026-10-03 复核：path:line 已按现行真身校准；下列目标再移动/增删须同步更新此处）
const SOURCE_EVIDENCE = freeze({
  randomPool: { sourceId: 'random-obtainable-pool', kind: 'pool', conditions: '进入实际调用通用随机卡池的奖励、发现或商店候选；进入候选池不表示本次必得。', evidenceRef: 'game/src/cards/cards.rules.js:234 isRandomObtainable + game/src/run/game.run.shop.js:43 商店随机槽取卡 + game/src/cards/cards.rules.js:157 pickOfRarity 池谓词', certainty: 'known' },
  classPool: { sourceId: 'matching-class-pool', kind: 'class-pool', conditions: '选择对应人物职业后，在实际调用职业卡池的火堆、宝箱或祭坛候选中出现；不保证本次必得。', evidenceRef: 'game/src/cards/cards.rules.js:247 classPool + game/src/run/chests.js:69 职业宝箱 + game/src/run/game.run.altar.js:58 火堆 randomClassCard', certainty: 'known' },
  abilityPool: { sourceId: 'matching-ability-pool', kind: 'class-pool', conditions: '选择对应人物职业后，在实际过滤能力卡的职业候选中出现；不保证本次必得。', evidenceRef: 'game/src/run/game.run.altar.js:523 碎片兑换能力卡过滤', certainty: 'known' },
  unknown: { sourceId: 'unconfirmed-source', kind: 'unknown', conditions: '当前代码与配置中没有足够证据确认稳定来源。', evidenceRef: 'unconfirmed', certainty: 'unknown' },
});

// 本地形判镜像 cards.rules.js:234 isRandomObtainable，两侧须同口径勿单侧改（2026-10-03 复核补「能力卡」排除，对齐 cards.rules.js:236）
function isRandomObtainableShape(card) {
  return !!card && !card.unrandom && !['初始', '职业', '衍生', '棱彩'].includes(card.rarity) && card.type !== '能力卡' && card.type !== '生物' && card.name !== '初始攻击';
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


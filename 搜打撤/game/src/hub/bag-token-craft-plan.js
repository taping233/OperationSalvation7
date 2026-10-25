// Pure recipe planning: resolve every input before the caller changes inventory.
const recipes = {
  gold: {
    source: 'tt-token-gold', count: 3, output: 'tt-token-color', fragments: 0,
    missing: '员工通行证B不足 3 张，无法合成',
    success: '[[icon:sparkles]] 合成成功：3 张员工通行证B → 1 张<b>员工通行证A</b>',
  },
  fragments: {
    source: 'tt-token-color', count: 1, output: 'cmtmvq6ss84l', fragments: 2,
    missing: '缺少员工通行证A，无法合成',
    success: '[[icon:sparkles]] 合成成功：员工通行证A + 2 枚碎片 → 1 张<b>员工通行证A</b>（使用后获取本职业能力卡）',
  },
};

export function planBagTokenCraft(game, kind, catalog, sourceUid) {
  const recipe = recipes[kind];
  if (!recipe) return { ok:false, reason:'未知通行证配方，无法合成' };
  if ((game.fragments || 0) < recipe.fragments) return { ok:false, reason:'员工通行证A碎片不足 2 枚，无法合成' };
  // Legacy detail consumes its inspected UID; stack zoom uses the first live A.
  const sources = game.ownedCards.map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry.card?.id === recipe.source
      && (sourceUid === undefined || entry.uid === sourceUid)).slice(0, recipe.count);
  if (sources.length !== recipe.count) return { ok:false, reason:recipe.missing };
  const card = catalog.find(entry => entry.id === recipe.output);
  if (!card) return { ok:false, reason:'通行证合成目标卡缺失，材料未消耗' };
  return { ok:true, sourceUids:sources.map(({ entry }) => entry.uid), sourceIndices:sources.map(({ index }) => index),
    card:{ ...card }, fragments:recipe.fragments, message:recipe.success };
}

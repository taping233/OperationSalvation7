// @vitest-environment node
import { expect, it } from 'vitest';
import { parsePoolNoun } from '../game/src/battle/effects/effect-steps.ctx.js';
import { buildDiscoverPool, isDiscoverClassAllowed } from '../game/src/battle/effects/battle.discover-candidates.js';

it('灵能召唤的注能池排除仅提及已注能的法术和棱彩职业能力卡', () => {
  const catalog = [
    { id:'fuel', name:'注能招式', type:'法术', rarity:'稀有', infuse:2 },
    { id:'legacy', name:'旧注能牌', type:'武术', desc:'注能（小）：造成伤害。' },
    { id:'cc-mana-surge', name:'法力奔涌', type:'法术', desc:'释放4个随机法术（这些随机法术默认已注能）。' },
    { id:'ability', name:'职业能力', type:'能力卡', rarity:'棱彩', cls:'降临者', desc:'所有法术视为已注能。' },
    { id:'class', name:'职业注能', type:'法术', rarity:'职业', cls:'降临者', infuse:1 },
  ];
  const pool = buildDiscoverPool(catalog, { myClass:'降临者', pred:parsePoolNoun('注能', '降临者'), isRandomObtainable:() => true });
  expect(pool.map(card => card.id)).toEqual(['fuel', 'legacy']);
  expect(isDiscoverClassAllowed(catalog[3])).toBe(false);
  expect(isDiscoverClassAllowed(catalog[3], { pred:parsePoolNoun('本职业', '降临者') })).toBe(true);
});

import { expect, it, vi } from 'vitest';
import { createAcquireOperation } from '../game/src/battle/effects/battle.acquire-operation.domain.js';
import { displayCardDescription } from '../game/src/cards/card-description-text.js';
import { createCardRenameMigrations } from '../game/src/cards/cards.sync.renames.js';

it.each(['搜索大宝箱', '搜索军用保险柜'])('saved named acquisition %s still grants the specific card after renaming', kind => {
  const target = { id:'cmtn28jv33wx', name:'搜索军用保险柜', rarity:'衍生', type:'法术' };
  const addDeckCard = vi.fn(), randomDiscoverCard = vi.fn();
  const { resolveAcquireOperation } = createAcquireOperation({
    getAllCards:() => [target], getMyClass:() => '侠客', addDeckCard, randomDiscoverCard,
    shuffleDeck:() => 1, esc:String, log:vi.fn(),
  });
  expect(resolveAcquireOperation({ id:'tt2-treasuremap', name:'寻宝图' }, {
    op:'acquire', n:1, pool:{ kind }, dest:'deck',
  })).toBe(true);
  expect(addDeckCard).toHaveBeenCalledWith(expect.objectContaining({ id:target.id }));
  expect(randomDiscoverCard).not.toHaveBeenCalled();
});

it('renders an old saved card description using current labels', () => {
  const card = { id:'tt2-treasuremap', desc:'主动技能：将 1张‘搜索大宝箱’洗入牌库，抽1张牌。' };
  const text = displayCardDescription(card.desc, card.id, card);
  expect(text).toContain('搜索军用保险柜');
  expect(text).not.toContain('宝箱');
  expect(card.desc).toContain('搜索大宝箱');
});

it('updates an existing built-in card library once while preserving IDs and custom cards', () => {
  const cards = [{ id:'cmtn28jv33wx', name:'搜索大宝箱' }, { id:'custom-loot', name:'私人箱子' }];
  const { applyDuplicateRenames } = createCardRenameMigrations({ storage:() => localStorage });
  expect(applyDuplicateRenames(cards)).toBe(true);
  expect(cards[0]).toEqual({ id:'cmtn28jv33wx', name:'搜索军用保险柜' });
  expect(cards[1]).toEqual({ id:'custom-loot', name:'私人箱子' });
  expect(applyDuplicateRenames(cards)).toBe(false);
});

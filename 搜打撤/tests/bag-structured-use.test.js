import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ game: null, ui: null, saveGame: vi.fn(), uid: 0 }));

vi.mock('../game/src/core/shared.js', () => ({ esc: value => String(value), escAttr: value => String(value) }));
vi.mock('../game/src/run/game.session.js', () => ({
  MAP: { items: { rations: 'rations', wood: 'wood' } },
  bagCap: () => state.game.cap,
  safeCap: () => 0,
  cardStacks: safe => {
    const cards = state.game.ownedCards.filter(entry => !!entry.safe === !!safe);
    const stacks = new Map();
    for (const entry of cards) {
      const key = entry.card.name;
      if (!stacks.has(key)) stacks.set(key, { card: entry.card, count: 0, uids: [] });
      const stack = stacks.get(key);
      stack.count++;
      stack.uids.push(entry.uid);
    }
    return [...stacks.values()];
  },
  doDeath: vi.fn(),
  game: state.game,
  newUid: () => `new-${++state.uid}`,
  safeUsed: () => 0,
  saveGame: (...args) => state.saveGame(...args),
  usedSlots: () => new Set(state.game.ownedCards.filter(entry => !entry.safe).map(entry => entry.card.name)).size,
}));
vi.mock('../game/src/core/random.js', () => ({ Random: { random: () => 0 } }));
vi.mock('../game/src/core/event-bus.js', () => ({ on: vi.fn() }));
vi.mock('../game/src/hub/bag-return-hook.js', () => ({ setBagReturnHook: vi.fn(), takeBagReturnHook: vi.fn() }));
vi.mock('../game/src/run/game.run.js', () => ({ showRunTransition: vi.fn() }));
vi.mock('../game/src/hub/game.cardslib.js', () => ({ _set_cardPageOpen: vi.fn() }));
vi.mock('../game/src/hub/game.bag.bridge.js', () => ({ bagSlots: { bindBagDrag: vi.fn() } }));
vi.mock('../game/src/hub/game.bag.drag.js', () => ({ bagDrag: null, resetBagDrag: vi.fn() }));
vi.mock('../game/src/hub/game.bag.settle.js', () => ({ bindBagMixins: vi.fn() }));

let showBackpack;

beforeEach(async () => {
  vi.resetModules();
  state.uid = 0;
  state.saveGame = vi.fn();
  Object.assign(state.game ??= {}, {
    runActive: true, myClass: 'test', state: 'idle', battleActive: false, cap: 6,
    inventory: [], ownedCards: [], usedPocket: [], cardOrder: [], fragments: 0,
  });
  Object.assign(state.ui ??= {}, {
    el: { overlay: { hidden: true } }, acts: {},
    act(name, fn) { this.acts[name] = fn; },
    hideOverlay() { this.el.overlay.hidden = true; },
    helpBtn: () => '', log: vi.fn(), registerHelp: vi.fn(),
    showOverlay() { this.el.overlay.hidden = false; },
    showCardZoom: vi.fn(),
  });
  window.SDT = {
    UI: state.ui,
    Base: { bagCap: () => state.game.cap },
    Cards: {
      SHA: { id: 'starter-sha', name: '初始攻击' },
      cardHTML: card => card.name,
      cardBackHTML: () => '',
    },
  };
  ({ showBackpack } = await import('../game/src/hub/game.bag.js'));
});

function useCard() {
  const potion = state.game.ownedCards.find(entry => entry.card.id === 'cmtn6bge52qt');
  if (!potion) throw new Error('expected test potion in backpack');
  showBackpack(true);
  state.ui.acts.inspectStack({ name: potion.card.name, safe: '0' });
  expect(state.ui.acts.useDetailCard).toBeTypeOf('function');
  state.ui.acts.useDetailCard();
}

describe('背包结构化道具用法', () => {
  it('基线：旧档复原药水仍按当前名称/描述复原最多两张', () => {
    state.game.ownedCards.push({ uid: 'old-potion', card: {
      id: 'cmtn6bge52qt', name: '复原药水', type: '道具', desc: '在背包中才能使用，复原最多两张卡牌',
    } });
    state.game.usedPocket.push({ card: { id: 'used-card', name: '消耗卡' }, count: 3 });

    useCard();

    expect(state.game.ownedCards.map(entry => entry.card.name)).toEqual(['消耗卡', '消耗卡']);
    expect(state.game.usedPocket[0].count).toBe(1);
    expect(state.saveGame).toHaveBeenCalledOnce();
  });

  it('稳定 id cmtn6bge52qt 按规则复原两张，忽略改名和改写描述', () => {
    const card = {
      id: 'cmtn6bge52qt', name: '改名后的道具', type: '道具', desc: '此文本没有复原规则。',
      rules: { version: 1, bag: { use: [{ op: 'restoreConsumed', amount: 2 }] } },
    };
    state.game.ownedCards.push({ uid: 'potion-1', card });
    state.game.usedPocket.push({ card: { id: 'used-card', name: '消耗卡' }, count: 3 });

    useCard();

    expect(state.game.ownedCards.map(entry => entry.card.name)).toEqual(['消耗卡', '消耗卡']);
    expect(state.game.ownedCards.map(entry => entry.uid)).toEqual(['new-1', 'new-2']);
    expect(state.game.usedPocket).toEqual([{ card: { id: 'used-card', name: '消耗卡' }, count: 1 }]);
    expect(state.ui.log).toHaveBeenCalledWith(expect.stringContaining('复原了消耗口袋中的 <b>2</b> 张卡牌'), 'ok');
    expect(state.saveGame).toHaveBeenCalledOnce();
  });

  it('复原时受背包空位限制，剩余卡继续留在消耗口袋', () => {
    state.game.cap = 2;
    state.game.ownedCards.push(
      { uid: 'potion-1', card: { id: 'cmtn6bge52qt', name: '旧名', type: '道具', desc: '回复 999 点生命。', rules: { version: 1, bag: { use: [{ op: 'restoreConsumed', amount: 2 }] } } } },
      { uid: 'occupied', card: { id: 'occupied', name: '占位卡' } },
    );
    state.game.usedPocket.push({ card: { id: 'used-card', name: '消耗卡' }, count: 3 });

    useCard();

    expect(state.game.ownedCards.map(entry => entry.card.name)).toEqual(['占位卡', '消耗卡']);
    expect(state.game.usedPocket[0].count).toBe(2);
    expect(state.ui.log).toHaveBeenCalledWith(expect.stringContaining('剩 2 张留在口袋'), 'ok');
    expect(state.saveGame).toHaveBeenCalledOnce();
  });
});

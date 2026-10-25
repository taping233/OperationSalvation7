import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCardInstance, refreshedCardFace } from '../game/src/cards/card-instance.js';
import { createShopCommands } from '../game/src/run/shop-commands.js';
import { Random } from '../game/src/core/random.js';

const H = vi.hoisted(() => ({ game: {}, cards: [], uid: 0, UI: {} }));
vi.mock('../game/src/run/game.session.js', () => ({
  game: H.game, MAP: { rules: {} }, bagCap: () => 30, usedSlots: () => H.game.ownedCards.length,
  newUid: () => `reward-${++H.uid}`, pick: items => items[0], scaledEnemy: item => item, saveGame() {},
}));
vi.mock('../game/src/run/game.session.kernel.js', () => ({ game: H.game, MAP: { rules: {} } }));
vi.mock('../game/src/hub/game.cardslib.js', () => ({ _set_cardPageOpen() {}, cardHTML: () => '' }));
vi.mock('../game/src/hub/game.bag.bridge.js', () => ({ bagSlots: {} }));

let grantEventCard, refreshCardClones;
const face = () => ({ id: 'instance-fixture', name: '实例测试卡', type: '法术', cost: 2, desc: '测试',
  rules: { version: 1, triggers: { onPlay: [{ op: 'damage', amount: 3, target: 'chosenEnemy' }] } },
  meta: { notes: ['原备注'] }, _pouch: [{ id: 'stored-spell', rules: { nested: { value: 1 } } }],
  _customHistory: { entries: [{ value: 7 }] },
});
const transient = () => ({ _baseCost: 9, _noInfuse: true, _castOnDraw: true,
  _battleTransformMissing: '旧转换', _registeredTriggers: { onPlay: [] },
  _triggerPoint: 'onKill', _soulEcho: true, _preview: true });

beforeAll(async () => {
  Object.assign(H.UI, { log: vi.fn(), act() {}, showCardReward: vi.fn() });
  window.SDT ||= {};
  Object.assign(window.SDT, { game: H.game, UI: H.UI, Sound: { sfx() {} },
    Base: { bagCap: () => 30, safeCap: () => 3 },
    Cards: { all: () => H.cards, isRandomObtainable: () => true },
  });
  ({ grantEventCard } = await import('../game/src/run/game.run.scenes.js'));
  ({ refreshCardClones } = await import('../game/src/run/game.session.bag.js'));
});

beforeEach(() => {
  H.uid = 0;
  H.cards = [];
  Object.assign(H.game, { ownedCards: [], inventory: [], usedPocket: [], canReceiveCard: () => true });
  vi.clearAllMocks();
});

describe('card instance creation at real acquisition boundaries', () => {
  it('manufactures independent nested data with caller UIDs and leaves editable templates mutable', () => {
    const template = face(), original = structuredClone(template), rng = Random.snapshot();
    const first = createCardInstance(template, 'first'), second = createCardInstance(template, 'second');
    expect([first.uid, second.uid]).toEqual(['first', 'second']);
    first.card.rules.triggers.onPlay[0].amount = 99;
    first.card.meta.notes.push('只属于第一张');
    first.card._pouch[0].rules.nested.value = 88;
    first.card._customHistory.entries[0].value = 77;
    expect(second.card).toEqual(original);
    expect(template).toEqual(original);
    expect(Random.snapshot()).toEqual(rng);
    template.meta.notes.push('库内编辑仍可用');
    expect(template.meta.notes).toHaveLength(2);
  });

  it('removes known battle/play/preview fields but preserves run data and unknown extensions', () => {
    const template = { ...face(), ...transient(), _futureExtension: { keep: [1, 2] }, _comment: '作者备注' };
    const instance = createCardInstance(template, 'new');
    for (const field of Object.keys(transient())) expect(instance.card).not.toHaveProperty(field);
    expect(instance.card).toMatchObject({ _futureExtension: { keep: [1, 2] }, _comment: '作者备注' });
    expect(instance.card._pouch).toEqual(template._pouch);
    expect(instance.card._pouch).not.toBe(template._pouch);
    expect(template).toMatchObject(transient());
  });

  it('real repeated shop purchases isolate rules while preserving UID allocation, price and quantity', async () => {
    const template = face(), original = structuredClone(template), slot = { card: template, price: 2, shaReplenish: 2 };
    const state = { coins: 10, shopStock: [slot], ownedCards: [] };
    let next = 0;
    const newUid = vi.fn(() => `shop-${++next}`), save = vi.fn(() => true);
    const commands = createShopCommands({ state, canReceive: () => true, newUid, save,
      isSellable: () => true, sellPrice: () => 1 });
    const quote = { slot, card: template, price: 2, free: undefined, replenish: true };
    expect((await commands.buy({ index: 0, quote, replenish: true })).ok).toBe(true);
    expect((await commands.buy({ index: 0, quote, replenish: true })).ok).toBe(true);
    expect(state.ownedCards.map(entry => entry.uid)).toEqual(['shop-1', 'shop-2']);
    expect(state.coins).toBe(6);
    expect(slot.shaReplenish).toBe(0);
    expect(newUid).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenCalledTimes(2);
    state.ownedCards[0].card.rules.triggers.onPlay[0].amount = 99;
    expect(state.ownedCards[1].card).toEqual(original);
    expect(template).toEqual(original);
  });

  it('real reward grants isolate rules and retain rejection and quantity semantics', () => {
    const template = face(), original = structuredClone(template);
    expect(grantEventCard(template, { silent: true })).toBe(true);
    expect(grantEventCard(template, { silent: true })).toBe(true);
    expect(H.game.ownedCards.map(entry => entry.uid)).toEqual(['reward-1', 'reward-2']);
    H.game.ownedCards[0].card.rules.triggers.onPlay[0].amount = 99;
    H.game.ownedCards[0].card._pouch[0].rules.nested.value = 66;
    expect(H.game.ownedCards[1].card).toEqual(original);
    expect(template).toEqual(original);
    H.game.canReceiveCard = () => false;
    expect(grantEventCard(template, { silent: true })).toBe(false);
    expect(H.game.ownedCards).toHaveLength(2);
    expect(H.uid).toBe(2);
    expect(H.UI.showCardReward).not.toHaveBeenCalled();
  });
});

describe('card definition refresh lifecycle and legacy compatibility', () => {
  it('computes refreshed faces without modifying either source and preserves unknown historical data', () => {
    const template = face(), previous = { ...face(), name: '旧名称', cost: 8, ...transient(),
      _pouch: [{ id: 'legacy-spell', legacy: { kept: true } }], _unknownLegacy: { payload: [1, 2] } };
    const beforeTemplate = structuredClone(template), beforePrevious = structuredClone(previous);
    const refreshed = refreshedCardFace(template, previous);
    expect(refreshed.name).toBe(template.name);
    expect(refreshed.cost).toBe(template.cost);
    expect(refreshed._pouch).toEqual(previous._pouch);
    expect(refreshed._unknownLegacy).toEqual(previous._unknownLegacy);
    for (const field of Object.keys(transient())) expect(refreshed).not.toHaveProperty(field);
    expect(template).toEqual(beforeTemplate);
    expect(previous).toEqual(beforePrevious);
  });

  it('real refresh takes the current same-ID custom definition and keeps historical instance extensions', () => {
    const custom = { ...face(), name: '库内定制牌', cost: 5 };
    H.cards = [custom];
    const old = { ...face(), name: '旧定制名称', cost: 1, ...transient(),
      _pouch: [{ id: '保留旧法术', details: ['不修剪历史内容'] }], _futureSave: { kept: true } };
    const reference = old, originalLibrary = structuredClone(custom);
    expect(refreshCardClones([old])).toBe(1);
    expect(old).toBe(reference);
    expect(old).toMatchObject({ name: '库内定制牌', cost: 5, _futureSave: { kept: true },
      _pouch: [{ id: '保留旧法术', details: ['不修剪历史内容'] }] });
    for (const field of Object.keys(transient())) expect(old).not.toHaveProperty(field);
    const stable = structuredClone(old);
    expect(refreshCardClones([old])).toBe(0);
    expect(old).toEqual(stable);
    expect(custom).toEqual(originalLibrary);
  });

  it('real refresh detaches pre-existing shallow aliases even when content and refresh counts are unchanged', () => {
    const template = face(); H.cards = [template];
    const first = { ...template }, second = { ...template };
    expect(refreshCardClones([first, second])).toBe(0);
    first.rules.triggers.onPlay[0].amount = 99;
    first._pouch[0].rules.nested.value = 88;
    expect(second.rules.triggers.onPlay[0].amount).toBe(3);
    expect(template.rules.triggers.onPlay[0].amount).toBe(3);
    expect(second._pouch[0].rules.nested.value).toBe(1);
    expect(template._pouch[0].rules.nested.value).toBe(1);
  });

  it('real refresh leaves orphan custom cards byte-equivalent when their template is absent', () => {
    H.cards = [face()];
    const orphan = { ...face(), id: 'orphan-custom', name: '库外自定义牌', ...transient(),
      _unknownLegacy: { saved: [1, 2] } };
    const before = JSON.stringify(orphan), rules = orphan.rules;
    expect(refreshCardClones([orphan])).toBe(0);
    expect(JSON.stringify(orphan)).toBe(before);
    expect(orphan.rules).toBe(rules);
  });
});

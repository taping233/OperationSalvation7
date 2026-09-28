import { hashSeed, nextRandom } from '../game/src/core/random-core.js';
import { clone, esc, escAttr } from '../game/src/core/shared.js';
import { commitBaseMutation } from '../game/src/hub/base-mutation.js';
import { createBaseEconomy } from '../game/src/hub/base-economy.js';

const seed: number = hashSeed(undefined);
const step: { state: number; value: number } = nextRandom(seed);
const state = { coins: 2 };
const copied = clone(state);
copied.coins += 1;
const text: string = esc({ label: '<fixture>' });
const attribute: string = escAttr('"fixture"');

const result = commitBaseMutation(state, draft => {
  draft.coins += 1;
  return draft.coins;
}, draft => draft.coins > 0);
if (result.ok) {
  const value: number = result.value;
  void value;
} else {
  const code: 'SAVE_FAILED' = result.code;
  void code;
}

void step;
void text;
void attribute;

const economyState = {
  coins: 8, wood: 1, rations: 2, keys: 0,
  stash: [{ card: { id: 'card-1', name: '样例牌' }, count: 1 }],
  achClaimed: {}, collClaimed: {}, backs: {},
};
const economy = createBaseEconomy({
  read: () => economyState,
  mutate: (prepare, failure) => {
    const draft = { ...economyState };
    const result = prepare(draft);
    return result === undefined ? failure : result;
  },
  appendCards: (_draft, cards) => { void cards; },
  room: () => 4,
});
const purchase = economy.purchase({ price: 2, material: 'wood' });
const pack = economy.openCardPack('card-1', economyState.stash);
const reward = economy.grantReward({ kind: 'achievement', id: 'first-win', reward: { keys: 1 } });
void purchase;
void pack;
void reward;

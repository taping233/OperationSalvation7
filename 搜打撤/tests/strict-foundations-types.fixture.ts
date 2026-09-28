import { hashSeed, nextRandom } from '../game/src/core/random-core.js';
import { clone, esc, escAttr } from '../game/src/core/shared.js';
import { commitBaseMutation } from '../game/src/hub/base-mutation.js';
import { createBaseEconomy } from '../game/src/hub/base-economy.js';
import { createBaseProgressionCommands } from '../game/src/hub/base-progression.commands.js';

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

const progressionState = { keys: 10, nestUnlocked: false, selMode: 'standard' };
const progression = createBaseProgressionCommands({
  read: () => progressionState,
  mutate: (prepare, failure = false) => {
    const draft = { ...progressionState };
    const value = prepare(draft);
    if (value === false) return failure;
    Object.assign(progressionState, draft);
    return value;
  },
  keyNeeded: 10,
});
const modeResult = progression.selectMode('elite');
if (modeResult.ok) {
  const selectedMode: 'standard' | 'elite' = modeResult.mode;
  void selectedMode;
} else {
  const modeError: 'INVALID_MODE' | 'SAVE_FAILED' = modeResult.code;
  void modeError;
}
const gateResult = progression.unlockNestGate();
if (gateResult.ok && !gateResult.alreadyUnlocked) {
  const spent: number = gateResult.spent;
  void spent;
} else if (!gateResult.ok && gateResult.code === 'INSUFFICIENT_KEYS') {
  const need: number = gateResult.need;
  const available: number = gateResult.available;
  void need;
  void available;
}
// @ts-expect-error Unsupported modes must be rejected by the command contract.
progression.selectMode('casual');
// @ts-expect-error The persistence port must report boolean success.
createBaseProgressionCommands({ read: () => progressionState, mutate: () => 'saved', keyNeeded: 10 });

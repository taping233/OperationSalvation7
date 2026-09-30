import { hashSeed, nextRandom } from '../game/src/core/random-core.js';
import { clone, esc, escAttr } from '../game/src/core/shared.js';
import { commitBaseMutation } from '../game/src/hub/base-mutation.js';
import { createBaseEconomy } from '../game/src/hub/base-economy.js';
import { createBaseProgressionCommands } from '../game/src/hub/base-progression.commands.js';
import { isHeroLine, rarityOf } from '../game/src/cards/card-rarity.js';
import { createCardRenderContext } from '../game/src/cards/card-render-context.js';
import { createBaseDepartureCommands } from '../game/src/hub/base-departure.commands.js';
import { createBasePetEggCommands } from '../game/src/hub/base-pet-egg.commands.js';
import { createBaseElapsedCommands } from '../game/src/hub/base-elapsed.commands.js';

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

const sparseToken = { tokenOf: 'missing', rarity: '衍生' };
const unresolvedRarity: string | undefined = rarityOf(sparseToken, _id => undefined);
const nullableHeroCheck: boolean = isHeroLine(null, _id => undefined);
const cardRenderContext = createCardRenderContext([
  null,
  { id: 'creator', rarity: '稀有' },
  sparseToken,
]);
const inheritedRarity: string | undefined = cardRenderContext.rarityOf(sparseToken);
void unresolvedRarity;
void nullableHeroCheck;
void inheritedRarity;
// @ts-expect-error Card lookups are keyed by stable string ids and return card-like records.
rarityOf({ rarity: '衍生', tokenOf: 'creator' }, _id => 42);
// @ts-expect-error Rarity must be a string when present.
rarityOf({ rarity: 42 }, _id => undefined);
// @ts-expect-error A context card must be non-null; null entries are filtered from catalogs.
cardRenderContext.rarityOf(null);
// @ts-expect-error The render context is an immutable lookup snapshot.
cardRenderContext.rarityOf = () => '古朴';

const departureState = {
  stash: [{ card: { id: 'card-1', name: '试探招式', rarity: '稀有', type: '武术' }, count: 2 }],
  pocket: [],
};
const departureCommands = createBaseDepartureCommands({
  read: () => departureState,
  mutate: (prepare, _failure) => prepare(structuredClone(departureState)),
});
const departureResult = departureCommands.prepareDeparture({ '试探招式': 1 });
if (departureResult.ok) {
  const cardName: string = departureResult.cards[0]?.card.name;
  const pocketWasCleared: boolean = departureResult.pocketCleared;
  void cardName;
  void pocketWasCleared;
} else {
  const saveError: 'save' = departureResult.why;
  void saveError;
}
// @ts-expect-error A card stack must provide the card name consumed by departure selection.
createBaseDepartureCommands({ read: () => ({ stash: [{ card: { id: 'missing-name' }, count: 1 }] }), mutate: (prepare, failure) => failure });
// @ts-expect-error Callers must narrow the discriminated save result before consuming cards.
const unsafeDepartureCards = departureResult.cards;
void unsafeDepartureCards;

const petEggCommands = createBasePetEggCommands({
  read: () => ({ eggPity: 2, eggBattles: 3 }),
  persistPity: next => next >= 0,
});
const eggChance: number = petEggCommands.petEggDropChance();
const eggRecord = petEggCommands.recordPetEggChestResult({ eggGranted: false });
const nextEggPity: number = eggRecord.eggPity;
const eggWasPersisted: boolean = eggRecord.persisted;
void eggChance;
void nextEggPity;
void eggWasPersisted;
// @ts-expect-error Chest outcome must be a boolean.
petEggCommands.recordPetEggChestResult({ eggGranted: 'yes' });
// @ts-expect-error The persistence port must report whether the write succeeded.
createBasePetEggCommands({ read: () => ({}), persistPity: () => 'saved' });

const elapsedState = { stats: { playSeconds: 25 } };
const elapsedCommands = createBaseElapsedCommands({
  read: () => elapsedState,
  persistPlaySeconds: next => next >= 0,
});
const elapsedSync = elapsedCommands.syncPlayTime(10, 5);
if (elapsedSync.changed) {
  const syncDelta: number = elapsedSync.delta;
  const syncPersisted: boolean = elapsedSync.persisted;
  void syncDelta;
  void syncPersisted;
} else {
  const noChangeDelta: 0 = elapsedSync.delta;
  void noChangeDelta;
  // @ts-expect-error No-op sync results do not represent a persistence attempt.
  elapsedSync.persisted;
}
const elapsedMigration = elapsedCommands.migrateElapsed(30);
if (elapsedMigration.changed) {
  const migrationPersisted: boolean = elapsedMigration.persisted;
  void migrationPersisted;
} else {
  const unchangedCheckpoint: number = elapsedMigration.checkpoint;
  void unchangedCheckpoint;
}
// @ts-expect-error Play-time persistence must report boolean success.
createBaseElapsedCommands({ read: () => ({ stats: {} }), persistPlaySeconds: () => 'saved' });

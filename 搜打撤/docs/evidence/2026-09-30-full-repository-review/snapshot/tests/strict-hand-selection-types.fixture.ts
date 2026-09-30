import { isHandPaymentCandidate, matchesHandSelectKey } from '../game/src/battle/core/battle.hand-selection.js';
import type { HandSelectionState } from '../game/src/battle/core/battle.hand-selection.js';
import { buildDiscoverPool, pickRandomDiscoverCandidate } from '../game/src/battle/effects/battle.discover-candidates.js';
import type { DiscoverCandidateCard } from '../game/src/battle/effects/battle.discover-candidates.js';
import { buildExplicitDiscoverState, buildPouchDiscoverState, buildRandomDiscoverState } from '../game/src/battle/effects/battle.discover-state.js';
import type { DiscoveringState, ExplicitDiscoverQueueJob } from '../game/src/battle/effects/battle.discover-state.js';

const paymentState: HandSelectionState = {
  act: 'payment',
  mandatory: true,
  n: 2,
  type: '武术',
  excludedUids: ['source', 'fuel'],
  selectedUids: [],
  payment: {
    uid: 'source',
    card: { id: 'card-a', name: '出牌', type: '武术' },
    fuelUids: ['fuel'],
    target: null,
    freeCost: false,
    onResolved: null,
  },
};

const effectState: HandSelectionState = {
  act: 'consume',
  mandatory: false,
  n: 1,
  type: null,
  thenText: '',
  target: null,
  srcCard: null,
  onDone: null,
};

if (paymentState?.act === 'payment') paymentState.payment.card.name;
if (effectState) effectState.onDone?.();

matchesHandSelectKey({ name: '杀', type: '攻击' }, '初始攻击');
isHandPaymentCandidate({
  uid: 'candidate',
  handUids: new Set(['candidate']),
  card: { name: '出牌', type: '武术' },
  type: '武术',
  excludedUids: new Set(),
  selectedUids: new Set(),
});

// @ts-expect-error hand-selection key is a string or nullish, not numeric
matchesHandSelectKey({ type: '武术' }, 7);
// @ts-expect-error a candidate needs a card UID and current hand membership
isHandPaymentCandidate({ card: { type: '武术' }, type: '武术' });
// @ts-expect-error payment states are mandatory and carry the payment payload
const invalidPaymentState: HandSelectionState = { act: 'payment', n: 1, type: null, thenText: '', target: null };
void invalidPaymentState;

const discoverCatalog: DiscoverCandidateCard[] = [
  { id: 'candidate-1', name: '武术', rarity: '稀有', type: '武术', cls: 'class-a', cost: 2 },
];
const discoverPool = buildDiscoverPool(discoverCatalog, {
  myClass: 'class-b',
  otherCls: true,
  isRandomObtainable: card => card.type !== '资源',
});
const sampledDiscover: DiscoverCandidateCard | null | undefined = pickRandomDiscoverCandidate(discoverPool, () => 0.5);
void sampledDiscover;
// @ts-expect-error Discovery predicates consume card records, not numeric IDs.
buildDiscoverPool(discoverCatalog, { myClass: 'class-b', isRandomObtainable: (_card: number) => true });
// @ts-expect-error Random selection receives a pool and a numeric random source.
pickRandomDiscoverCandidate(discoverPool, () => '0.5');
// @ts-expect-error `otherCls` is a boolean enable flag, not a class-name selector.
buildDiscoverPool(discoverCatalog, { myClass: 'class-b', otherCls: 'class-a', isRandomObtainable: () => true });

const explicitJob: ExplicitDiscoverQueueJob = {
  n: 2,
  explicit: discoverCatalog,
  explicitUids: ['deck-a', 'deck-b'],
  deckBottom: true,
  tempUids: ['temp-ref'],
  swapPair: ['swap-ref'],
};
const explicitState = buildExplicitDiscoverState(explicitJob);
const explicitDeckUids: string[] = explicitState.deckBottomUids;
const queuedState: DiscoveringState = explicitState;
const randomState = buildRandomDiscoverState({ n: 2 }, discoverCatalog);
const randomStateOptions: DiscoverCandidateCard[] = randomState.options;
const pouchState = buildPouchDiscoverState(discoverCatalog, 'pouch-uid');
const pouchAct: 'pouch' = pouchState.act;
void explicitDeckUids;
void queuedState;
void randomStateOptions;
void pouchAct;
// @ts-expect-error Explicit discovery state requires its UID array, even when empty.
const invalidExplicitState: import('../game/src/battle/effects/battle.discover-state.js').ExplicitDiscoverState = { ...randomState, deckBottom: true };
// @ts-expect-error Explicit candidates must be card records, not UIDs.
buildExplicitDiscoverState({ n: 1, explicit: ['card-uid'] });

import { isHandPaymentCandidate, matchesHandSelectKey } from '../game/src/battle/battle.hand-selection.js';
import type { HandSelectionState } from '../game/src/battle/battle.hand-selection.js';

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

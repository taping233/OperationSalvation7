import { createAcquireOperation } from './battle.acquire-operation.domain.js';
import { isLegacySearchChestOperation } from '../../cards/card-legacy-battle-policy.js';

// Private metadata follows only this source's resolver view, never saved cards.
const preparedDiscovery = Symbol('prepared discovery');
export const withPreparedDiscovery = (card, prepared) => prepared ? { ...card, [preparedDiscovery]: prepared } : card;
export function claimPreparedDiscovery(card, job) {
  const prepared = card[preparedDiscovery];
  if (!prepared || prepared.claimed) return job;
  prepared.claimed = true;
  return { ...job, fixedOptions: prepared.options, confirmedIndex: prepared.index };
}

/** Only unconditional, wholly discovery-owned plays can be previewed before payment.
 * Mixed, scheduled, legacy text and deck-bottom flows retain committed semantics.
 */
export function firstPureDiscoveryJob(card, { getAllCards, getMyClass, getStoredCards = () => [], sourceUid }) {
  // The item resolver gives bag.use precedence; other card types execute onPlay.
  const bag = card.type === '道具' && Array.isArray(card.rules?.bag?.use);
  const ops = bag ? card.rules.bag.use : card.rules?.triggers?.onPlay;
  if (!bag && ops?.length === 1 && ops[0]?.op === 'castStored' && !ops[0].when) {
    const stored = getStoredCards();
    return stored.length ? { n: 1, act: 'pouch', explicit: stored, pouchUid: sourceUid, sourceCardId: card.id } : null;
  }
  if (bag) {
    if (!ops.length || ops.some(op => !op || op.when || op.schedule || !(
      op.op === 'discover' || op.op === 'acquire' && !['classAbility', 'legendary'].includes(op.pool?.kind)))) return null;
    const op = ops[0];
    return { n: Number.isInteger(op.amount) ? op.amount : op.n || 1,
      pool: op.pool || { kind: '随机' }, dest: op.dest, act: op.act, sourceCardId: card.id };
  }
  if (!Array.isArray(ops) || !ops.length || card.type === '装备'
    || ops.some(op => !op || op.when || op.schedule || op.pick || !(
      op.op === 'discover' && Number.isInteger(op.count) && op.count > 0
      || op.op === 'acquire' && (!op.dest || op.dest === 'discover') && Number.isInteger(op.n) && op.n > 0
        && op.pool?.kind !== '牌库底'))) return null;
  const op = ops[0];
  if (op.op === 'discover') return { n: op.count, pool: op.pool, costDecayPerTurn: op.costDecayPerTurn, sourceCardId: card.id };
  if (isLegacySearchChestOperation(card, op)) return null;
  let job = null;
  const unavailable = () => { throw new Error('Discovery preview cannot execute or mutate battle state'); };
  // Use the execution planner itself for pool/filter/named-pool semantics.
  createAcquireOperation({ getAllCards, getMyClass, queueDiscoverTracked: value => { job = value; },
    deckBottomCount: () => 0, takeDeckBottom: () => [], findCard: () => null,
    randomDiscoverCard: unavailable, addDeckCard: unavailable, shuffleDeck: unavailable, addTempCard: unavailable,
    esc: String, log: () => {} }).resolveAcquireOperation(card, op);
  return job;
}

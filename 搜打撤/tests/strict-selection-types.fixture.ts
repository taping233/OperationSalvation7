// Contract-only check: exercise the factory's declared external ports. The legacy body and
// imported battle runtime state are intentionally outside this narrow strict config.
import { createBattleSelectionFlow } from '../game/src/battle/core/battle.selection-flow.js';
import { createBattleRuntime } from '../game/src/battle/runtime/battle.runtime.factory.js';
const runtime = createBattleRuntime();
type SelectionCards = Parameters<typeof createBattleSelectionFlow>[0]['cards'];
type SelectionCard = Parameters<SelectionCards['isRandomObtainable']>[0];
const cards: SelectionCards = {
  all: () => [{ id: 'move-1', name: '试探招式', type: '武术', rarity: '稀有' }],
  isRandomObtainable: (_card: SelectionCard) => true,
  sellPrice: (_card: SelectionCard) => 2,
};
const createFlow = (selectionCards: SelectionCards) => createBattleSelectionFlow({
  runtime,
  cards: selectionCards,
  deny: () => undefined,
  random01: () => 0.5,
  throwIfActionCancelled: (_signal: AbortSignal | undefined) => undefined,
  session: { handSelectQueue: [], choiceQueue: [] },
});
const sharedPorts = {
  runtime,
  deny: () => undefined,
  random01: () => 0.5,
  throwIfActionCancelled: (_signal: AbortSignal | undefined) => undefined,
  session: { handSelectQueue: [], choiceQueue: [] },
};

const flow = createFlow(cards);
const picked = flow.randomDiscoverCard(null, '稀有', null);
void picked;
// @ts-expect-error Catalog entries are battle cards, not arbitrary numbers.
createFlow({ ...cards, all: () => [42] });
// @ts-expect-error Random source is numeric and deterministic at the port boundary.
createBattleSelectionFlow({ runtime, cards, deny: () => undefined, random01: () => '0.5', throwIfActionCancelled: () => undefined, session: { handSelectQueue: [], choiceQueue: [] } });
const invalidPredicateCards = { ...cards, isRandomObtainable: (_card: number) => true };
// @ts-expect-error The factory rejects a predicate that cannot accept its battle-card input.
createBattleSelectionFlow({ ...sharedPorts, cards: invalidPredicateCards });
const invalidPriceCards = { ...cards, sellPrice: (_card: SelectionCard) => '2' };
// @ts-expect-error The factory price port must return the numeric armor amount.
createBattleSelectionFlow({ ...sharedPorts, cards: invalidPriceCards });
// @ts-expect-error Factory lookup results must be real cards with the declared rarity/cost contract.
createBattleSelectionFlow({ ...sharedPorts, cards: { all: () => [42], isRandomObtainable: (_card: SelectionCard) => true, sellPrice: (_card: SelectionCard) => 2 } });
// @ts-expect-error The cancellation helper is a required external dependency.
createBattleSelectionFlow({ runtime, cards, deny: sharedPorts.deny, random01: sharedPorts.random01, session: sharedPorts.session });

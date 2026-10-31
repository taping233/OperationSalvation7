import { createRunEventController } from './game.run.events.js';
import { createEventCommands } from './event-commands.js';
import { createEventDiceController } from '../ui/event-dice.js';
import { eventOptionHTML, eventOptionState } from '../ui/event-option-state.js';
import { patchRewardScene, rewardCardUnitHTML, rewardClaimHTML, rewardExitHTML, rewardSceneHTML, restoreRewardActionFocus } from '../ui/reward-scene-view.js';
import { captureOverlayReturnState, restoreOverlayReturnState } from '../ui/overlay-return-state.js';
import { eventNarrative } from '../home/narrative.js';
import { playOutcomeFeedback } from '../ui/outcome-feedback.js';
import { canReplaceBagCards } from '../hub/game.bag.rules.js';
import { encounterOpeningHTML } from '../ui/encounter-presentation.js';


// Loaded by the flow entry only; the event controller stays an injected-port factory.
export function createRunEventRuntime(ports, lifecycle) {
  const { game, SDT, gainCoins, grantEventCard } = ports;
  return createRunEventController({ ...ports, lifecycle, eventOptionHTML, playOutcomeFeedback, encounterOpeningHTML,
    eventOptionState, richHTML:html => SDT.Icons.rich(html),
    patchRewardScene, rewardCardUnitHTML, rewardClaimHTML, rewardExitHTML, rewardSceneHTML, restoreRewardActionFocus,
    captureOverlayReturnState, restoreOverlayReturnState,
    eventCommands:createEventCommands({ state:game, gainCoins,
      heal:amount => game.heal(amount), damage:(amount, reason) => game.damage(amount, reason),
      canRecode:(entries, cards) => canReplaceBagCards(game, entries.map(entry => game.ownedCards.indexOf(entry)), cards,
        { usedSlots:() => game.usedSlots(), bagCap:() => game.bagCap(), baseCap:() => SDT.Base.bagCap() }),
      grantCard:(card, options) => grantEventCard(card, options) }),
    createDice:options => createEventDiceController({ ...options, SDT }),

    eventNarrative:id => eventNarrative(id),
  });
}

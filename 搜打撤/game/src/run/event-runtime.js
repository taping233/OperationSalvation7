import { createRunEventController } from './game.run.events.js';
import { createEventCommands } from './event-commands.js';
import { createEventDiceController } from '../ui/event-dice.js';
import { eventOptionHTML } from '../ui/event-option-state.js';
import { eventNarrative } from '../home/narrative.js';
import { playOutcomeFeedback } from '../ui/outcome-feedback.js';


// Loaded by the flow entry only; the event controller stays an injected-port factory.
export function createRunEventRuntime(ports, lifecycle) {
  const { game, SDT, gainCoins, grantEventCard } = ports;
  return createRunEventController({ ...ports, lifecycle, eventOptionHTML, playOutcomeFeedback,
    eventCommands:createEventCommands({ state:game, gainCoins,
      heal:amount => game.heal(amount), damage:(amount, reason) => game.damage(amount, reason),
      grantCard:(card, options) => grantEventCard(card, options) }),
    createDice:options => createEventDiceController({ ...options, SDT }),

    eventNarrative:id => eventNarrative(id),
  });
}

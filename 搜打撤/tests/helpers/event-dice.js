// jsdom has no WAAPI; the roll settles synchronously while production waits for animation.
export function rollEventDice(UI) {
  for (let step = 0; step < 20; step++) {
    const panel = UI.el.ovBody.querySelector('.event-dice-panel');
    if (!panel) return;
    const roll = panel.querySelector('[data-act="eventDiceRoll"]');
    if (!roll.hidden) UI._acts.eventDiceRoll();
    UI._acts.eventDiceContinue();
    if (UI.el.ovBody.querySelector('.event-dice-panel') === panel) return;
  }
  throw new Error('Dice sequence did not reach its destination');
}

import { vi } from 'vitest';
// Allow detached DOM handlers and nested controller opens to finish without expiring timers.
export async function flushEventActions() {
  if (vi.isFakeTimers()) await vi.advanceTimersByTimeAsync(0);
  else await new Promise(resolve => setTimeout(resolve, 0));
}
export async function rollEventDice(UI) {
  await flushEventActions();
  for (let step = 0; step < 20; step++) {
    const panel = UI.el.ovBody.querySelector('.event-dice-panel');
    if (!panel) return;
    const roll = panel.querySelector('[data-act="eventDiceRoll"]');
    if (!roll.hidden) await UI._acts.eventDiceRoll();
    await UI._acts.eventDiceContinue();
    await flushEventActions();
    if (UI.el.ovBody.querySelector('.event-dice-panel') === panel) return;
  }
  throw new Error('Dice sequence did not reach its destination');
}

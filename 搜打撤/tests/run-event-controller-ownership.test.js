import { flushEventActions } from './helpers/event-dice-async.js';
import { describe, expect, it, vi } from 'vitest';
import { createRunEventController } from '../game/src/run/game.run.events.js';

function harness(enterNode = async () => true) {
  const game = { state:'modal', seed:1, layerIdx:0, trackPos:1, nodeRewards:{}, visited:{} };
  const consumeCurrentCell = vi.fn(), saveGame = vi.fn(() => true);
  const UI = { hideOverlay:vi.fn(), refresh:vi.fn(), log:vi.fn() };
  const controller = createRunEventController({ game, UI, MAP:{ randomEvents:[] }, enterNode,
    getCards:() => ({ all:() => [] }), captureRunContext:() => () => true,
    getActiveSlot:() => null, createCardChoice:() => ({ resume:() => false }),
    weighted:() => ({ text:'空旷的街角' }), consumeCurrentCell, saveGame, setBagReturnHook:vi.fn() });
  return { controller, game, UI, consumeCurrentCell, saveGame };
}

describe('event controller request ownership', () => {
  it('independent controllers do not invalidate each other while node entry is pending', async () => {
    let release;
    const delayed = new Promise(resolve => { release = resolve; });
    const first = harness(() => delayed), second = harness();
    const pending = first.controller.runEventDeck();
    await second.controller.runEventDeck();
    expect(second.consumeCurrentCell).toHaveBeenCalledOnce();
    release(true);
    await pending; await flushEventActions();
    expect(first.consumeCurrentCell).toHaveBeenCalledOnce();
    expect(first.game.state).toBe('idle'); expect(second.game.state).toBe('idle');
  });

  it('a newer request in the same controller suppresses its late predecessor', async () => {
    let release;
    const delayed = new Promise(resolve => { release = resolve; });
    const enterNode = vi.fn().mockImplementationOnce(() => delayed).mockResolvedValue(true);
    const h = harness(enterNode);
    const earlier = h.controller.runEventDeck();
    await h.controller.runEventDeck();
    release(true);
    await earlier; await flushEventActions();
    expect(h.consumeCurrentCell).toHaveBeenCalledOnce(); expect(h.saveGame).toHaveBeenCalledOnce();
  });
});

import { beforeEach, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ move: vi.fn(() => true), game: {} }));
vi.mock('../game/src/run/game.session.js', () => ({ game: fixture.game, getActiveSlot: () => 1, startNewGame: vi.fn() }));
vi.mock('../game/src/run/game.run.flow.js', () => ({ moveTo: fixture.move, reenterCell: vi.fn() }));
vi.mock('../game/src/agent/agent.state.js', () => ({ markUiFailure() {} }));
import { act } from '../game/src/agent/agent.action-router.js';

beforeEach(() => { fixture.move.mockClear(); document.body.innerHTML = ''; });

it.each([null, false, true, '', '  ', [], [0], {}, { toString: null, valueOf: null }, NaN, Infinity, 0.5, -1].map(coordinate => ({ coordinate })))('does not coerce malformed move coordinate $coordinate into a real node', ({ coordinate }) => {
  for (const field of ['li', 'idx']) {
    const result = act({ type: 'move', li: 0, idx: 0, [field]: coordinate });
    expect(result).toMatchObject({ ok: false, code: 'MOVE_INVALID' });
  }
  expect(fixture.move).not.toHaveBeenCalled();
});

it.each([[0, 0], ['0', '0'], [1, 2], ['1', '2']])('keeps explicit numeric coordinates %j/%j compatible', (li, idx) => {
  expect(act({ type: 'move', li, idx })).toMatchObject({ ok: true });
  expect(fixture.move).toHaveBeenCalledWith(Number(li), Number(idx));
});

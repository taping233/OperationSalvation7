// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  buildExplicitDiscoverState,
  buildPouchDiscoverState,
  buildRandomDiscoverState,
} from '../game/src/battle/effects/battle.discover-state.js';

describe('pure discovery state builders', () => {
  it('slices explicit options while preserving deck and effect tracking references', () => {
    const options = [
      { id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'ignored' },
    ];
    const explicitUids = ['bottom-a', 'bottom-b', 'bottom-c', 'ignored'];
    const tempUids = ['temp-existing'];
    const swapPair = ['swap-existing'];
    const state = buildExplicitDiscoverState({
      n: 2, explicit: options, explicitUids, deckBottom: true, tempUids, swapPair,
    });

    expect(state.options).toEqual(options.slice(0, 3));
    expect(state.options[0]).toBe(options[0]);
    expect(state.deckBottom).toBe(true);
    expect(state.deckBottomUids).toBe(explicitUids);
    expect(state.tempUids).toBe(tempUids);
    expect(state.swapPair).toBe(swapPair);
  });

  it('keeps random state free of deck-bottom fields and uses real default tracking arrays', () => {
    const cards = [{ id: 'random-a' }];
    const state = buildRandomDiscoverState({ n: 1, act: 'play' }, cards);

    expect(state.options).toBe(cards);
    expect(state.act).toBe('play');
    expect(state).not.toHaveProperty('deckBottom');
    expect(state).not.toHaveProperty('deckBottomUids');
    expect(state.tempUids).toEqual([]);
    expect(state.swapPair).toBeNull();
  });

  it('builds the minimal pouch state without inventing queue metadata', () => {
    const cards = [{ id: 'pouch-a' }];
    const state = buildPouchDiscoverState(cards, 'pouch-uid');

    expect(state).toEqual({ options: cards, n: 1, act: 'pouch', pouchUid: 'pouch-uid', pred: null });
    expect(state.options).toBe(cards);
  });
});

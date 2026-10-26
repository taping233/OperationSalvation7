// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { WU_FRAME_SEQUENCES, wuTimeline } from '../game/src/battle/view/battle.frame-catalog.js';
import { registerDefeatPresenter, presentBattleDefeat } from '../game/src/battle/core/battle.presentation.js';

describe('Wu runtime sprite contract', () => {
  it('shares idle endpoints for attacks and hurt, while death ends fallen', () => {
    const neutral = WU_FRAME_SEQUENCES.idle[0];
    for (const action of ['atk', 'hurt']) {
      expect(WU_FRAME_SEQUENCES[action][0]).toBe(neutral);
      expect(WU_FRAME_SEQUENCES[action].at(-1)).toBe(neutral);
    }
    expect(WU_FRAME_SEQUENCES.death[0]).toBe(neutral);
    expect(WU_FRAME_SEQUENCES.death.at(-1)).not.toBe(neutral);
    expect(wuTimeline('death').hold).toBe(true);
  });

  it('preserves authored timing and allows fast actions without the 80ms per-frame floor', () => {
    const total = action => wuTimeline(action).dur.reduce((a,b) => a+b, 0);
    expect(total('idle')).toBe(3000);
    expect(total('atk')).toBe(417);
    expect(total('hurt')).toBe(334);
    expect(total('death')).toBe(875);
    expect(wuTimeline('atk', 2).dur.reduce((a,b) => a+b, 0)).toBe(208.5);
    expect(wuTimeline('idle', 2).dur).toEqual(wuTimeline('idle').dur);
  });

  it('does not defer headless settlement and forwards a registered view completion', async () => {
    registerDefeatPresenter(null);
    expect(presentBattleDefeat()).toBeNull();
    const completed = Promise.resolve();
    registerDefeatPresenter(() => completed);
    expect(presentBattleDefeat()).toBe(completed);
    await completed;
    registerDefeatPresenter(null);
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import { clearFeedback, enqueueFeedback, feedbackShakeDuration, waitForFeedback } from '../game/src/battle/battle.feedback.js';
import { setPace } from '../game/src/battle/battle.pace.js';

describe('battle presentation queue', () => {
  afterEach(() => clearFeedback());

  it('plays hit feedback in enqueue order and resolves only after the queue drains', async () => {
    const events = [];
    enqueueFeedback(() => events.push('first'));
    enqueueFeedback(() => events.push('second'));

    await waitForFeedback();

    expect(events).toEqual(['first', 'second']);
  });

  it('drops stale feedback after the battle queue is cleared', async () => {
    const events = [];
    enqueueFeedback(() => events.push('stale'), 500);
    clearFeedback();
    await waitForFeedback();
    await Promise.resolve();

    expect(events).toEqual([]);
  });

  it('keeps each multi-hit shake inside its scaled beat interval', () => {
    setPace(1);
    const oneX = feedbackShakeDuration(3);
    setPace(2);
    const twoX = feedbackShakeDuration(3);
    expect(oneX).toBe(256);
    expect(twoX).toBe(128);
    expect(feedbackShakeDuration(1)).toBe(500);
    setPace(1);
  });
});

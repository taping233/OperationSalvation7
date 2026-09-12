import { describe, expect, it, beforeEach } from 'vitest';
import { isLiveBattleFigure, hide } from '../game/src/battle.frames.js';

describe('battle frame lifecycle', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="overlay"><div id="ovBody"><div class="battle-stage sts"><div id="btSelf"><div class="sts-figure"><img /></div></div></div></div><div id="unitFrames"></div></div>';
  });

  it('rejects a late resource callback after hide or overlay replacement', () => {
    const body = document.getElementById('ovBody');
    const fig = body.querySelector('.sts-figure');
    // attach is not active in this isolated test until a real battle render marks it wanted;
    // the lifecycle predicate must remain closed, so a stale callback cannot show frames.
    expect(isLiveBattleFigure(body, fig)).toBe(false);
    hide();
    expect(document.getElementById('unitFrames').hidden).toBe(true);
    const replacement = body.cloneNode(true);
    document.getElementById('ovBody').replaceWith(replacement);
    expect(isLiveBattleFigure(body, fig)).toBe(false);
  });
});

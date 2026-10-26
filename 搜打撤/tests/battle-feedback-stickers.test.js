import { beforeAll, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const pending = vi.hoisted(() => ({ floats: [] }));
vi.mock('../game/src/battle/core/battle.core.js', () => ({
  takeFloats: () => pending.floats.splice(0),
}));
vi.mock('../game/src/battle/view/battle.frames.js', () => ({ play: () => false }));
vi.mock('../game/src/battle/runtime/battle.clock.js', () => ({
  schedulePresentation: () => {}, schedulePresentationMs: () => {},
  waitHitStop: () => Promise.resolve(), waitPresentationMs: () => Promise.resolve(),
}));
vi.mock('../game/src/ui/ui-scale.js', () => ({
  rect: () => ({ left: 0, top: 0, width: 800, height: 600 }), scale: () => 1,
}));

let spawnFloats, waitForFeedback;
beforeAll(async () => {
  document.body.innerHTML = '<div id="overlay"><div id="battleBody" class="battle-stage"><div id="btSelf"><div class="sts-figure"></div></div><div class="sts-foe" data-eidx="0"><div class="sts-figure"></div></div></div></div>';
  window.SDT = {
    UI: { el: { overlay: document.getElementById('overlay') } },
    Motion: { reduceMotion: () => true }, Sound: { sfx() {} },
  };
  ({ spawnFloats } = await import('../game/src/battle/view/battle.vfx.js'));
  ({ waitForFeedback } = await import('../game/src/battle/view/battle.feedback.js'));
});

it('settled feedback uses the transparent atlas and suppresses the retired duplicate injury sticker', async () => {
 pending.floats.push({unit:'self',text:'',cls:'stk stk-late sticker-hurt'},{unit:'self',text:'',cls:'stk sticker-heal',warm:true},{unit:0,text:'',cls:'stk sticker-boom'});
 spawnFloats(document.getElementById('battleBody')); await waitForFeedback();
 expect(document.querySelector('.fx-art-heal')).not.toBeNull();expect(document.querySelector('.fx-art-death')).not.toBeNull();expect(document.querySelectorAll('.bt-fx-art')).toHaveLength(2);
 expect(document.querySelector('.sts-float.stk')).toBeNull();
 const atlas=readFileSync('game/assets/battle/fx-atlas.webp');expect(atlas.toString('ascii',0,4)).toBe('RIFF');expect(atlas.toString('ascii',8,12)).toBe('WEBP');
 for(const n of document.querySelectorAll('.bt-fx-art'))expect(n.style.backgroundImage).toContain('fx-atlas.webp');
});

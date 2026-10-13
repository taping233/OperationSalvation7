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
  document.body.innerHTML = '<div id="overlay"><div id="battleBody"><div id="btSelf"><div class="sts-figure"></div></div><div class="sts-foe" data-eidx="0"><div class="sts-figure"></div></div></div></div>';
  window.SDT = {
    UI: { el: { overlay: document.getElementById('overlay') } },
    Motion: { reduceMotion: () => true }, Sound: { sfx() {} },
  };
  ({ spawnFloats } = await import('../game/src/battle/view/battle.vfx.js'));
  ({ waitForFeedback } = await import('../game/src/battle/view/battle.feedback.js'));
});

it('受击、治疗及敌人击杀贴纸进入可见反馈层并引用真实 SVG', async () => {
  pending.floats.push(
    { unit: 'self', text: '', cls: 'stk stk-late sticker-hurt' },
    { unit: 'self', text: '', cls: 'stk sticker-heal', warm: true },
    { unit: 0, text: '', cls: 'stk sticker-boom' },
  );
  spawnFloats(document.getElementById('battleBody'));
  await waitForFeedback();
  for (const name of ['hurt', 'heal', 'boom']) {
    const image = document.querySelector(`#overlay > .sts-float.stk.sticker-${name}.sticker img`);
    expect(image).not.toBeNull();
    expect(image.getAttribute('src')).toMatch(new RegExp(`^assets/battle/fx-sticker-${name}\\.svg\\?v=.+$`));
    const source = readFileSync(`game/assets/battle/fx-sticker-${name}.svg`, 'utf8');
    expect(source).toContain('<svg');
    expect(source).toContain('viewBox="0 0 64 64"');
    const parsed = new DOMParser().parseFromString(source, 'image/svg+xml');
    expect(parsed.querySelector('parsererror'), `${name} 贴纸必须是可解码的 SVG XML`).toBeNull();
  }
});

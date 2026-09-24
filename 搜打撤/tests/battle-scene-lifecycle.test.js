import { beforeEach, describe, expect, it } from 'vitest';

window.SDT = {
  Icons: { rich: value => value },
  Sound: { sfx() {} },
  Motion: { overlayIn() {} },
};

describe('battle overlay scene lifecycle', () => {
  let UI;

  beforeEach(async () => {
    document.body.innerHTML = '<button id="heroAva">旅</button><main id="viewport"><div id="overlay" hidden><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div></main>';
    const mod = await import('../game/src/ui/ui.js');
    UI = mod.UI;
    UI._hasBattleStage = false;
    UI._overlayReturnFocus = null;
    UI._overlayInerted = [];
    UI.init();
  });

  it('announces battle scene leave once when replacing the battle stage', () => {
    const leftScenes = [];
    const onLeave = event => leftScenes.push(event.detail.scene);
    document.addEventListener('sdt-scene-leave', onLeave);

    UI.showOverlay('战斗', '<div class="battle-stage"></div>', 'battle');
    UI.showOverlay('墓地', '<div class="grave"></div>', 'discover');
    UI.showOverlay('牌库', '<div class="deck"></div>', 'page');

    document.removeEventListener('sdt-scene-leave', onLeave);
    expect(leftScenes).toEqual(['battle']);
  });

  it('announces battle scene leave before hideOverlay clears the stage, only once', () => {
    const leaveEvents = [];
    const onLeave = event => leaveEvents.push({ scene: event.detail.scene, stageStillMounted: !!document.querySelector('#ovBody .battle-stage') });
    document.addEventListener('sdt-scene-leave', onLeave);

    UI.showOverlay('战斗', '<div class="battle-stage"></div>', 'battle');
    UI.hideOverlay({ immediate: true });
    UI.hideOverlay({ immediate: true });

    document.removeEventListener('sdt-scene-leave', onLeave);
    expect(leaveEvents).toEqual([{ scene: 'battle', stageStillMounted: true }]);
    expect(document.querySelector('#ovBody .battle-stage')).toBeNull();
  });
});

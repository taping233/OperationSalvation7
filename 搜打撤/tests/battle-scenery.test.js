import { expect, it } from 'vitest';
import { createBattleSceneryCapture, selectBattleScenery } from '../game/src/battle/view/battle.scenery.js';

it.each([[0,'winter-platform-minimal'],[1,'winter-platform-minimal'],[2,'winter-platform-minimal'],[3,'winter-platform-minimal']])('selects layer index %s as %s', (layerIdx,key) => {
  expect(selectBattleScenery({layerIdx}).key).toBe(key);
});
it('uses the approved three-layer platform for bosses and every expedition layer', () => {
  const boss=selectBattleScenery({layerIdx:0,isBoss:true});
  expect(boss.ground).toContain('platform-minimal-1016/ground.webp');
  for (const layerIdx of [1,2,3]) {
    const scene=selectBattleScenery({layerIdx});
    expect(scene.image).toBeUndefined();expect(scene.foreground).toBeTruthy();expect(scene.far).toBeTruthy();
    expect(scene.footLine).toBe(.68);
  }
  const bridge=selectBattleScenery({layerIdx:0});
  expect([bridge.far,bridge.ground,bridge.foreground].every(Boolean)).toBe(true);
  expect(bridge.stageLayers).toBe(true);
  expect(bridge.ground).toContain('platform-minimal-1016/ground.webp');
});
it('captures the layer and boss identity once per battle token, with explicit opts taking priority', () => {
  const capture=createBattleSceneryCapture();
  const first=capture({battleToken:1,opts:{}},2);
  expect(first.key).toBe('winter-platform-minimal');
  expect(capture({battleToken:1,opts:{layerIdx:3,isBoss:true}},0)).toBe(first);
  expect(capture({battleToken:2,opts:{layerIdx:1}},3).key).toBe('winter-platform-minimal');
});

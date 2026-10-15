import { expect, it } from 'vitest';
import { createBattleSceneryCapture, selectBattleScenery } from '../game/src/battle/view/battle.scenery.js';

it.each([[0,'winter-bridge'],[1,'winter-street'],[2,'frozen-ruins'],[3,'contaminated-core']])('selects layer index %s as %s', (layerIdx,key) => {
  expect(selectBattleScenery({layerIdx}).key).toBe(key);
});
it('uses the contaminated core for bosses and never overlays winter layers onto static scenes', () => {
  const boss=selectBattleScenery({layerIdx:0,isBoss:true});
  expect(boss.image).toContain('contaminated-core-1015.webp');
  for (const layerIdx of [1,2,3]) {
    const scene=selectBattleScenery({layerIdx});
    expect(scene.image).toBeTruthy();expect(scene.foreground).toBeUndefined();expect(scene.far).toBeUndefined();
    expect(scene.footLine).toBe(.74);
  }
  const bridge=selectBattleScenery({layerIdx:0});
  expect([bridge.far,bridge.ground,bridge.foreground].every(Boolean)).toBe(true);
  expect(bridge.stageLayers).toBe(true);
  expect(bridge.ground).toContain('stage-reset-1015/ground.webp');
});
it('captures the layer and boss identity once per battle token, with explicit opts taking priority', () => {
  const capture=createBattleSceneryCapture();
  const first=capture({battleToken:1,opts:{}},2);
  expect(first.key).toBe('frozen-ruins');
  expect(capture({battleToken:1,opts:{layerIdx:3,isBoss:true}},0)).toBe(first);
  expect(capture({battleToken:2,opts:{layerIdx:1}},3).key).toBe('winter-street');
});

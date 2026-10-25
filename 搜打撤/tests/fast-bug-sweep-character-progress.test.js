// @vitest-environment node
import { expect, it } from 'vitest';
import { normalizeBaseState } from '../game/src/hub/base-state.js';
import { prepareBattleVictoryProgress } from '../game/src/hub/battle-victory-progress.js';

const win = {foeNames:['普通敌人'], isBoss:false, classId:'wu', xpMultiplier:1};

it.each(['bad', 3, true, [], {}, {lv:'bad', xp:'bad'}, {lv:-1, xp:-5}])('repairs invalid individual progress %j before real battle settlement', bad => {
  const state = normalizeBaseState({characters:{wu:bad, baita:{lv:4, xp:7}}, coins:9});
  const {afterBase} = prepareBattleVictoryProgress(state, win);
  const reloaded = normalizeBaseState(JSON.parse(JSON.stringify(afterBase)));
  expect(reloaded.characters.wu).toEqual({lv:1, xp:6});
  expect(reloaded.characters.baita).toEqual({lv:4, xp:7});
  expect(reloaded.coins).toBe(9);
});

it('can recover a corrupt modern entry from intact legacy class progression', () => {
  const state = normalizeBaseState({characters:{wu:'bad'}, classes:{侠客:{lv:3, xp:8}}});
  expect(prepareBattleVictoryProgress(state, win).afterBase.characters.wu).toEqual({lv:3, xp:14});
});

it('discards invalid legacy entries before migration instead of copying their array properties', () => {
  const state = normalizeBaseState({classes:{侠客:[]}});
  expect(state.classes).not.toHaveProperty('侠客');
  expect(prepareBattleVictoryProgress(state, win).afterBase.characters.wu).toEqual({lv:1, xp:6});
});

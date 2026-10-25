import { expect, it } from 'vitest';
import { installImmediateWebLocks } from './helpers/web-locks.js';
import { normalizeBaseState } from '../game/src/hub/base-state.js';
installImmediateWebLocks();

it.each(['bad', 3, true, [], {lv:'bad', ts:9}])('repairs invalid starter pet %j before actual persisted upgrades', async bad => {
  window.SDT ||= {Icons:{img:() => ''}};
  window.SDT.Icons ||= {img:() => ''};
  await import('../game/src/hub/base.js');
  const base = window.SDT.Base;
  localStorage.clear();
  localStorage.setItem(base.SLOT_KEY(1), JSON.stringify({version:2, rations:10, pets:{dog:bad, cat:{lv:4, ts:12}}, petSel:'dog'}));
  base.use(1);
  expect(base.canUpgradePet('dog')).toBe(true);
  expect(await base.upgradePet('dog')).toBe(true);
  base.use(1);
  expect(base.data.pets.dog.lv).toBe(2);
  expect(base.data.rations).toBe(8);
  expect(base.data.pets.cat).toEqual({lv:4, ts:12});
});

it('does not grant non-starter pets from invalid ownership records', () => {
  const state = normalizeBaseState({pets:{cat:'bad', robot:[], falcon:{lv:3, ts:7}}});
  expect(state.pets).toEqual({falcon:{lv:3, ts:7}});
});

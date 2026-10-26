// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { infusionMaterialState } from '../game/src/battle/view/battle.infusion-material-state.js';
const group = { uids:['a','b'] };
const state = (picked, need = 2, hand = ['a','b'], reason = () => '') => infusionMaterialState(group, { picked, need }, hand, reason);
describe('infusion material presentation', () => {
  it('distinguishes full selection from a fully selected group', () => {
    expect(state(['a','b']).addReason).toContain('材料已齐');
    expect(state(['a','b'], 3).addReason).toBe('该组材料已全部选中');
    expect(state(['a','b'], 3)).toMatchObject({ remove:true, canAdjust:true });
  });
  it('keeps an unselected group disabled at the limit, without claiming it is ineligible', () => {
    expect(state(['other'], 1)).toMatchObject({ unavailable:'', remove:false, canAdjust:false });
  });
  it('explains ineligible and absent materials without offering an action', () => {
    expect(state([], 2, ['a','b'], () => '不能消耗此牌')).toMatchObject({ unavailable:'不能消耗此牌', canAdjust:false });
    expect(state([], 2, [])).toMatchObject({ addReason:'材料已不在手牌中', canAdjust:false });
  });
  it('keeps a selected copy removable when the other copy is ineligible', () => {
    expect(state(['a'], 2, ['a','b'], uid => uid === 'b' ? '不能消耗此牌' : '')).toMatchObject({ remove:true, canAdjust:true });
  });
  it('does not mutate selection or hand while projecting an action', () => {
    const picked = Object.freeze(['a']), hand = Object.freeze(['a','b']);
    expect(state(picked, 2, hand)).toMatchObject({ remove:false, canAdjust:true });
    expect(picked).toEqual(['a']); expect(hand).toEqual(['a','b']);
  });
});

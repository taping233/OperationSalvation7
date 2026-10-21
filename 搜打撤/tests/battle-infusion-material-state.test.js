import { describe, expect, it, vi } from 'vitest';
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


describe('existential material eligibility', () => {
  it('returns only the presentation contract and stops after the first eligible copy', () => {
    const reason = vi.fn(() => '');
    const result = state([], 2, ['a','b'], reason);
    expect(reason.mock.calls).toEqual([['a']]);
    expect(result).toEqual({ selected:[], unavailable:'', addReason:'', remove:false, canAdjust:true });
  });
  it('skips absent and selected copies, then searches past a forbidden copy', () => {
    const reason = vi.fn(uid => uid === 'b' ? '不能消耗此牌' : '');
    const result = infusionMaterialState({ uids:['absent','a','b','c','d'] }, { picked:['a'], need:3 }, ['a','b','c','d'], reason);
    expect(reason.mock.calls).toEqual([['b'],['c']]);
    expect(result).toEqual({ selected:['a'], unavailable:'', addReason:'', remove:false, canAdjust:true });
  });
  it('retains the full scan and exact first-copy fallback when every copy is forbidden', () => {
    const reason = vi.fn(uid => `不能消耗${uid}`);
    expect(state([], 2, ['a','b'], reason)).toMatchObject({ unavailable:'不能消耗a', canAdjust:false });
    expect(reason.mock.calls).toEqual([['a'],['b'],['a']]);
  });
  it('retains absent first-copy fallback and selected UID order, without checking selected copies', () => {
    const reason = vi.fn(() => '');
    expect(state([], 2, [], reason)).toMatchObject({ unavailable:'材料已不在手牌中' });
    expect(reason.mock.calls).toEqual([['a']]); reason.mockClear();
    expect(state(['b','outside','a'], 4, ['a','b'], reason)).toMatchObject({ selected:['a','b'], unavailable:'', addReason:'该组材料已全部选中', remove:true, canAdjust:true });
    expect(reason).not.toHaveBeenCalled();
  });
  it('matches every used result of the original complete-filter algorithm over 5,120 cases', () => {
    const uids = ['a','b','c'];
    const original = (infusion, hand, reason) => {
      const selected = uids.filter(uid => infusion.picked.includes(uid));
      const available = uids.filter(uid => hand.includes(uid) && !infusion.picked.includes(uid) && !reason(uid));
      const full = infusion.picked.length >= infusion.need;
      const unavailable = !selected.length && !available.length ? reason(uids[0]) || '材料已不在手牌中' : '';
      const addReason = unavailable || (full ? '材料已齐，请先减少已选材料' : !available.length ? selected.length === uids.length ? '该组材料已全部选中' : '该组没有更多可选材料' : '');
      const remove = selected.length > 0 && (full || !available.length);
      return { selected, unavailable, addReason, remove, canAdjust:remove || !addReason };
    };
    let cases = 0;
    for (let pickedMask = 0; pickedMask < 16; pickedMask++) for (let handMask = 0; handMask < 8; handMask++) for (let reasonMask = 0; reasonMask < 8; reasonMask++) for (let need = 0; need < 5; need++) {
      const infusion = { picked:[...uids,'outside'].filter((_, i) => pickedMask & (1 << i)), need };
      const hand = uids.filter((_, i) => handMask & (1 << i));
      const reason = uid => reasonMask & (1 << uids.indexOf(uid)) ? '本牌无法用于注能' : '';
      const { selected, unavailable, addReason, remove, canAdjust } = infusionMaterialState({ uids }, infusion, hand, reason);
      expect({ selected, unavailable, addReason, remove, canAdjust }).toEqual(original(infusion, hand, reason)); cases++;
    }
    expect(cases).toBe(5120);
  });
});

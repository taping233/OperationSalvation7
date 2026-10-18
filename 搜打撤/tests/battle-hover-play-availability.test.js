import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ snapshot: null, context: null }));
const availability = vi.hoisted(() => vi.fn());
vi.mock('../game/src/battle/core/battle.core.js', () => ({
  commands: { getCardPlayAvailability: availability }, Combat: { TYPE_NAME: {} },
  getSnapshot: () => state.snapshot, getPreviewContext: () => state.context,
}));
vi.mock('../game/src/battle/view/battle.preview.js', () => ({
  cardRuleHint: () => '',
  previewAction: ({ cardContext }) => ({ legal: cardContext.legal !== false, cost: 1, damage: null,
    reasons: cardContext.legal === false ? [cardContext.illegalReason] : [], unknownEffects: [] }),
}));
const sound = vi.fn();
window.SDT = { Sound: { sfx: sound } };
const { showFoePreview } = await import('../game/src/battle/view/battle.hover.js');
let foes;
beforeEach(() => {
  vi.clearAllMocks();
  state.snapshot = { hand: ['devour'], foes: [{ name: '枪手', dead: false }, { name: '合格敌人', dead: false }] };
  state.context = Object.freeze({ legal: true, isFreeCast: false });
  availability.mockReturnValue({ status: 'rejected', reason: { code: 'EXECUTE_TARGET_INELIGIBLE', message: '请选择攻击力不高于4的敌人' } });
  document.body.innerHTML = '<div class="bt-foe"></div><div class="bt-foe"></div>';
  foes = document.querySelectorAll('.bt-foe');
});
afterEach(() => document.body.replaceChildren());
function show(idx = 0, mode = 'click', uid = 'devour') {
  showFoePreview(foes[idx], idx, uid, { name: '吞噬' }, mode);
  return foes[idx].textContent;
}
it.each(['click', 'drag'])('shows submission rejection instead of a misleading %s play prompt', mode => {
  const text = show(0, mode);
  expect(availability).toHaveBeenCalledWith('devour', 0);
  expect(text).toContain('当前无法打出'); expect(text).toContain('请选择攻击力不高于4的敌人');
  expect(text).not.toMatch(/点击该敌人打出|松手打出|无法精算/);
  expect(sound).not.toHaveBeenCalled();
  expect(state.context).toEqual({ legal: true, isFreeCast: false });
});
it('immediately restores the normal unknown-damage prompt on an eligible target', () => {
  show(); availability.mockReturnValue({ status: 'ready' });
  const text = show(1);
  expect(text).toContain('无法精算'); expect(text).toContain('点击该敌人打出');
  expect(text).not.toContain('不高于4'); expect(foes[0].querySelector('.bt-fpreview')).toBeNull();
});
it('ready does not override an existing illegal preview context', () => {
  availability.mockReturnValue({ status: 'ready' });
  state.context = { legal: false, illegalReason: '请先完成当前操作' };
  expect(show()).toContain('请先完成当前操作'); expect(foes[0].textContent).not.toContain('点击该敌人打出');
});
it('resolves a pending ordinary hand uid and supports object hand entries', () => {
  state.snapshot.hand = [{ uid: 'devour' }]; state.snapshot.pendingTarget = { uid: 'devour' };
  expect(show(0, 'click', null)).toContain('不高于4'); expect(availability).toHaveBeenCalledWith('devour', 0);
});
it.each(['missing-uid', 'not-in-hand', 'item', 'slam', 'dart', 'free-cast', 'other-mode'])('does not apply ordinary-card rejection to %s previews', variant => {
  let uid = 'devour', mode = 'click';
  if (variant === 'missing-uid') uid = null;
  if (variant === 'not-in-hand') state.snapshot.hand = [];
  if (variant === 'item') state.snapshot.pendingItem = { uid: 'devour' };
  if (variant === 'slam') state.snapshot.slamPending = true;
  if (variant === 'dart') state.snapshot.dartPending = true;
  if (variant === 'free-cast') state.context = { legal: true, isFreeCast: true };
  if (variant === 'other-mode') mode = 'intent';
  show(0, mode, uid); expect(availability).not.toHaveBeenCalled();
});
it.each(['能量不足（需要2，当前1）', '还需要1张注能材料'])('uses the current authoritative rejection: %s', message => {
  availability.mockReturnValue({ status: 'rejected', reason: { message } });
  expect(show()).toContain(message); expect(foes[0].textContent).not.toContain('点击该敌人打出');
});

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { equipmentInfoHTML } from '../game/src/ui/equipment-info.js';

beforeAll(async () => {
  window.SDT ||= {};
  await import('../game/src/ui/term-tips.js');
});
beforeEach(() => {
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{ x:0, y:0, width:80, height:20 }]);
  document.body.insertAdjacentHTML('beforeend', '<span id="term" data-term="poison">中毒</span>');
});
afterEach(() => {
  document.dispatchEvent(new CustomEvent('sdt-overlay-close'));
  pointer(document, 'pointerup', 1);
  pointer(document, 'pointercancel', 1);
  document.getElementById('term')?.remove();
  document.getElementById('equipment-test')?.remove();
  vi.restoreAllMocks();
});

function pointer(target, type, pointerId = 1) {
  const event = new Event(type, { bubbles: true });
  Object.assign(event, { pointerId, pointerType: 'touch', button: 0 });
  target.dispatchEvent(event);
}
const tip = () => document.querySelector('.term-tip');

describe('term tooltip pointer lifecycle', () => {
  it.each([false, true])('装备聚焦只查说明，保留主动技能原点击（已使用=%s）', used => {
    document.body.insertAdjacentHTML('beforeend', `<div id="equipment-test">${equipmentInfoHTML({ name:'护符', desc:'抵挡寒风', skill:'获得护盾', uid:'eq1', used })}</div>`);
    const host = document.getElementById('equipment-test');
    const trigger = host.querySelector('[data-ui-tip]');
    const button = host.querySelector('button');
    const action = vi.fn();
    button.addEventListener('click', action);
    trigger.focus();
    expect(tip().hidden).toBe(false);
    expect(tip().textContent).toContain('抵挡寒风');
    expect(tip().textContent).toContain(used ? '本场已用过' : '点击发动');
    expect(action).not.toHaveBeenCalled();
    button.click();
    expect(action).toHaveBeenCalledTimes(used ? 0 : 1);
    expect(button.dataset.act).toBe('btEquipSkill');
    expect(host.querySelector('[title]')).toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true }));
    expect(tip().hidden).toBe(true);
  });

  it('被动装备可用键盘阅读说明，不生成主动操作', () => {
    document.body.insertAdjacentHTML('beforeend', `<div id="equipment-test">${equipmentInfoHTML({ name:'靴子', desc:'踏雪无痕' })}</div>`);
    const trigger = document.querySelector('#equipment-test [data-ui-tip]');
    trigger.focus();
    expect(tip().textContent).toContain('踏雪无痕');
    expect(document.querySelector('#equipment-test [data-act]')).toBeNull();
  });

  it('does not accumulate release listeners across ordinary presses or cancellations', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const term = document.getElementById('term');
    for (let i = 0; i < 20; i++) {
      pointer(term, 'pointerdown');
      pointer(document, i % 2 ? 'pointerup' : 'pointercancel');
      expect(tip().hidden).toBe(true);
    }
    expect(add.mock.calls.filter(([type]) => type === 'pointerup' || type === 'pointercancel')).toHaveLength(0);
  });

  it('only releases the current pointer when another finger ends', () => {
    const term = document.getElementById('term');
    pointer(term, 'pointerdown', 1);
    pointer(term, 'pointerdown', 2);
    pointer(document, 'pointerup', 1);
    expect(tip().hidden).toBe(false);
    pointer(document, 'pointercancel', 2);
    expect(tip().hidden).toBe(true);
  });

  it('forgets a cancelled press on navigation, so its late release cannot hide a new hover', () => {
    const term = document.getElementById('term');
    pointer(term, 'pointerdown', 1);
    document.dispatchEvent(new CustomEvent('sdt-overlay-close'));
    expect(tip().hidden).toBe(true);
    pointer(term, 'pointerover', 2);
    pointer(document, 'pointercancel', 1);
    expect(tip().hidden).toBe(false);
    window.dispatchEvent(new Event('blur'));
    expect(tip().hidden).toBe(true);
  });

  it.each(['pointerup', 'pointercancel'])('releases a long press even after its term is removed (%s)', type => {
    const term = document.getElementById('term');
    pointer(term, 'pointerdown', 7);
    expect(tip().hidden).toBe(false);
    term.remove();
    pointer(document, type, 7);
    expect(tip().hidden).toBe(true);
  });
});

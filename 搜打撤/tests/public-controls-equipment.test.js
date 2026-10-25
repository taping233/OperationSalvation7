import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { equipmentInfoHTML } from '../game/src/ui/equipment-info.js';

function render(equipment, busy = false) {
  const host = document.createElement('div');
  host.innerHTML = equipmentInfoHTML(equipment, busy);
  return host;
}

beforeEach(() => {
  window.SDT ||= {};
  window.SDT.Art = { cardIcon: vi.fn(() => '<img src="/equip-thumb.webp" alt="装备图">') };
});

describe('battle equipment power icons', () => {
  const equipment = { name:'护符', desc:'获得护甲。主动技能：获得护盾。', skill:'获得护盾。', uid:'eq1', used:false, card:{ id:'eq1', name:'护符' } };

  it.each([
    [false, false, 'ready'],
    [true, false, 'busy'],
    [false, true, 'used'],
  ])('preserves a single icon action and readable tooltip (busy=%s used=%s)', (busy, used, state) => {
    const host = render({ ...equipment, used }, busy);
    const icon = host.querySelector('.sts-equip');
    const button = host.querySelector('[data-act="btEquipSkill"]');
    const trigger = host.querySelector('[data-ui-tip]');
    expect(icon.dataset.equipState).toBe(state);
    expect(host.querySelectorAll('.sts-equip')).toHaveLength(1);
    expect(host.querySelector('.sts-equip-art img').getAttribute('src')).toBe('/equip-thumb.webp');
    expect(host.querySelector('.sts-equip-art').textContent).toBe('');
    expect(icon.textContent).not.toContain('获得护甲');
    expect(trigger.getAttribute('data-ui-tip-text')).toContain('获得护甲');
    expect(trigger.getAttribute('data-ui-tip-title')).toBe('护符');
    expect(button.dataset.uid).toBe('eq1');
    expect(button.disabled).toBe(busy || used);
    expect(trigger.tabIndex).toBe(0);
    expect(window.SDT.Art.cardIcon).toHaveBeenCalledWith(equipment.card, { low:true });
  });

  it('keeps passive equipment focusable without an action', () => {
    const host = render({ name:'斗篷', desc:'抵挡寒风', uid:'eq2', card:{ id:'eq2' } });
    const icon = host.querySelector('.sts-equip');
    expect(icon.dataset.equipState).toBe('passive');
    expect(icon.tabIndex).toBe(0);
    expect(icon.getAttribute('data-ui-tip-text')).toBe('抵挡寒风');
    expect(host.querySelector('[data-act]')).toBeNull();
  });

  it('keeps health below the figure and equipment in the shared side lane', () => {
    const css = readFileSync('game/css/battle-equipment.css', 'utf8');
    const view = readFileSync('game/src/battle/view/battle.layers.js', 'utf8');
    expect(css).toMatch(/\.sts-me \.sts-unit-actions\s*\{[^}]*flex-flow:\s*column nowrap/s);
    expect(css).toContain('--battle-unit-control-size: 48px');
    expect(css).toContain('width: var(--battle-unit-control-size)');
    expect(css).toContain('pointer-events: auto');
    expect(view).toContain('parts.vitals.appendChild(parts.hp)');
    expect(view).toContain('parts.actions.appendChild(parts.equips)');
    expect(view).toContain('parts.vitals.appendChild(parts.actions)');
    expect(view).not.toContain('np.appendChild(parts.equips)');
  });
});

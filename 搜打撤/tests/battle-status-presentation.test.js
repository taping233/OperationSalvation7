import { describe, it, expect } from 'vitest';
import { createCombatRuntime } from '../game/src/battle/core/combat.factory.js';
import { statusChipsHTML, reconcileStatusChips } from '../game/src/battle/view/battle.status-chips.js';
import { readCssSource } from './helpers/css-source.js';

const combat = createCombatRuntime();
const render = html => html.replace(/\[\[icon:([a-z-]+)\]\]/g, '<img class="ic" data-icon="$1" alt="">');
const paint = (element, status, compact = true, extra = '') => reconcileStatusChips(element,
  extra + statusChipsHTML(status, combat, { compact }), render);

describe('战斗状态的稳定阅读与机制语义', () => {
  it('第5项不删除前4项的名称数据，也不改变固定compact版式', () => {
    const first = { atkUp:1, spellUp:2, stealth:3, immune:4 };
    const root = document.createElement('div');
    paint(root, first);
    const four = [...root.querySelector('.status-chip-list').children].map(node => ({ key:node.dataset.statusKey, name:node.querySelector('.status-name').textContent, cls:node.className }));
    paint(root, { ...first, reduce:5 });
    for (const previous of four) {
      const next = root.querySelector(`[data-status-key="${previous.key}"]`);
      expect(next.querySelector('.status-name').textContent).toBe(previous.name);
      expect(next.className).toBe(previous.cls);
    }
    expect(root.querySelector('.status-chip-list').children).toHaveLength(5);
    expect(root.querySelector('.status-chip-summary').textContent).toBe('5项↕');
  });

  it('compact视觉仅图标和数值，玩家full保留名称与单位，两者详情及ARIA都完整', () => {
    const style = document.createElement('style');
    style.textContent = readCssSource('game/css/battle-status-chips.css', 'utf8');
    document.head.append(style);
    const overlay = document.createElement('div'); overlay.id = 'overlay';
    overlay.innerHTML = '<main class="battle-stage sts"><div class="sts-chips"></div></main>';
    document.body.append(overlay);
    const root = overlay.querySelector('.sts-chips');
    try {
      for (const compact of [true, false]) {
        paint(root, { freeze:99, swordForm:1 }, compact);
        const freeze = root.querySelector('[data-term="freeze"]');
        expect(freeze.getAttribute('aria-label')).toBe('冰冻 99回合');
        expect(freeze.dataset.uiTipNote).toContain('99回合');
        expect(freeze.querySelector('.status-value').textContent).toBe('99');
        expect(freeze.querySelector('.status-unit').textContent).toBe('回合');
        expect(getComputedStyle(freeze.querySelector('.status-name')).display === 'none').toBe(compact);
        expect(getComputedStyle(freeze.querySelector('.status-unit')).display === 'none').toBe(compact);
        expect(getComputedStyle(freeze.querySelector('.status-amount')).fontSize).not.toBe('0px');
        const flag = root.querySelector('[data-term="swordForm"]');
        expect(flag.querySelector('.status-amount')).toBeNull();
        expect(flag.getAttribute('aria-label')).toContain('生效中');
        expect(flag.querySelector('.status-icon img')).not.toBeNull();
      }
    } finally { overlay.remove(); style.remove(); }
  });

  it('数值、回合、层数、次数与flag分别表达，并移除归零项', () => {
    const root = document.createElement('div');
    paint(root, { atkUp:10, stealth:2, bleed:99, dodge:3, swordForm:1, poison:0 });
    const text = key => root.querySelector(`[data-term="${key}"]`).textContent;
    expect(text('atkUp')).toBe('强攻10');
    expect(text('stealth')).toBe('潜行2回合');
    expect(text('bleed')).toBe('流血99层');
    expect(text('dodge')).toBe('闪避3次');
    expect(text('swordForm')).toBe('剑仙');
    expect(root.querySelector('[data-term="swordForm"]').getAttribute('aria-label')).toContain('生效中');
    expect(root.querySelector('[data-term="poison"]')).toBeNull();
  });

  it('B更新不销毁正在读A的节点、焦点或tooltip描述关联', () => {
    const root = document.createElement('div'); document.body.append(root);
    paint(root, { atkUp:1, bleed:1 });
    const trigger = root.querySelector('[data-term="atkUp"]');
    const list = root.querySelector('.status-chip-list'); list.scrollTop = 42;
    trigger.focus(); trigger.setAttribute('aria-describedby', 'external sdt-term-tip');
    paint(root, { atkUp:10, bleed:2, poison:1 });
    expect(root.querySelector('[data-term="atkUp"]')).toBe(trigger);
    expect(document.activeElement).toBe(trigger);
    expect(trigger.getAttribute('aria-describedby')).toBe('external sdt-term-tip');
    expect(trigger.getAttribute('data-ui-tip-note')).toContain('10');
    expect(trigger.querySelector('.status-amount').textContent).toBe('10');
    expect(root.querySelector('.status-chip-list')).toBe(list);
    expect(list.scrollTop).toBe(42);
    root.remove();
  });

  it('数量说明计入全部状态，0/1/4/5/8/16沿同一滚动宿主而不删除内容', () => {
    const root = document.createElement('div');
    const keys = [...combat.BUFFS, ...combat.CURSES];
    let list;
    for (const count of [0, 1, 4, 5, 8, 16]) {
      paint(root, Object.fromEntries(keys.slice(0, count).map(key => [key,99])));
      expect(root.querySelectorAll('[data-status-key]')).toHaveLength(count);
      if (!count) { expect(root.childNodes).toHaveLength(0); continue; }
      const current = root.querySelector('.status-chip-list');
      if (list) expect(current).toBe(list);
      list = current;
      expect(root.querySelector('.status-chip-summary').textContent).toBe(`${count}项↕`);
      expect(root.getAttribute('aria-label')).toContain(`共${count}项`);
      expect(root.hasAttribute('data-ui-tip')).toBe(false);
      expect(root.dataset.uiTipNote).toBeUndefined();
    }
    paint(root, {});
    expect(root.childNodes).toHaveLength(0);
    expect(root.hasAttribute('data-ui-tip')).toBe(false);
  });

  it('阅读区域的空白和数量说明不冒泡确认单位，也不取消原生点击默认行为', () => {
    const unit = document.createElement('div'), root = document.createElement('div'); unit.append(root);
    let targetClicks = 0; unit.addEventListener('click', () => { targetClicks++; });
    paint(root, { atkUp:1 });
    for (const region of [root.querySelector('.status-chip-list'), root.querySelector('.status-chip-summary')]) {
      const event = new MouseEvent('click', { bubbles:true, cancelable:true });
      expect(region.dispatchEvent(event)).toBe(true);
      expect(event.defaultPrevented).toBe(false);
    }
    expect(targetClicks).toBe(0);
  });

  it('保留动态扩展标记及其顺序，复用同一标记的外层节点', () => {
    const root = document.createElement('div');
    paint(root, { poison:1 }, true, '<span data-status-key="mark:echo">契约回响 2</span>');
    const marker = root.querySelector('[data-status-key="mark:echo"]');
    paint(root, { poison:2, bleed:1 }, true, '<span data-status-key="mark:echo">契约回响 3</span>');
    expect(root.querySelector('.status-chip-list').firstElementChild).toBe(marker);
    expect(marker.textContent).toBe('契约回响 3');
    expect(marker.getAttribute('tabindex')).toBe('0');
    expect(root.querySelector('.status-chip-summary').textContent).toBe('3项↕');
    paint(root, {});
    expect(root.children).toHaveLength(0);
    expect(root.hasAttribute('aria-label')).toBe(false);
  });

  it('所有现行状态有独立机制图标，详情同时提供当前值和原机制说明', () => {
    const root = document.createElement('div');
    paint(root, Object.fromEntries([...combat.BUFFS, ...combat.CURSES].map(key => [key,1])));
    const icons = [...root.querySelectorAll('img')].map(img => img.dataset.icon);
    expect(new Set(icons).size).toBe(16);
    for (const node of root.querySelector('.status-chip-list').children) {
      expect(node.getAttribute('data-ui-tip-title')).toBeTruthy();
      expect(node.getAttribute('data-ui-tip-text')).toBeTruthy();
      expect(node.getAttribute('tabindex')).toBe('0');
    }
    expect(root.getAttribute('aria-label')).toContain('共16项');
    expect(root.getAttribute('aria-label')).toContain('上下滚动');
    expect(root.querySelector('.status-chip-summary').textContent).toBe('16项↕');
  });
});

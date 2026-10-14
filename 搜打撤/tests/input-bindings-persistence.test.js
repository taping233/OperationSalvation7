import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const loadInput = async () => { vi.resetModules(); await import('../game/src/core/input.js'); return window.SDT.Input; };
beforeEach(() => localStorage.removeItem('sdt-keybinds'));
afterEach(() => localStorage.removeItem('sdt-keybinds'));

describe('动作键位持久化', () => {
  it('抢占较早动作的默认键后，刷新保持新动作和旧动作的空映射', async () => {
    const input = await loadInput();
    expect(input.rebind('backpack', 'Q')).toBe('camRotateL');
    expect(input.actionFor({ key: 'q' })).toBe('backpack');
    const reloaded = await loadInput();
    expect(reloaded.actionFor({ key: 'q' })).toBe('backpack');
    expect(reloaded.bindings.camRotateL).toEqual([]);
  });
  it('改其他键后，刷新保留默认动作的全部备用键', async () => {
    const input = await loadInput(); input.rebind('backpack', 'v');
    const reloaded = await loadInput();
    expect(reloaded.actionFor({ key: 'Enter' })).toBe('roll');
    expect(reloaded.actionFor({ key: ' ' })).toBe('roll');
  });
  it('只抢占某个备用键时，刷新保留原动作的另一个键', async () => {
    const input = await loadInput(); expect(input.rebind('backpack', ' ')).toBe('roll');
    const reloaded = await loadInput();
    expect(reloaded.actionFor({ key: ' ' })).toBe('backpack');
    expect(reloaded.actionFor({ key: 'Enter' })).toBe('roll');
  });
  it('兼容旧字符串键位设置并归一为小写', async () => {
    localStorage.setItem('sdt-keybinds', JSON.stringify({ backpack: 'V', missing: 'y' }));
    const input = await loadInput();
    expect(input.actionFor({ key: 'v' })).toBe('backpack');
    expect(input.actionFor({ key: 'Enter' })).toBe('roll');
  });
  it('旧字符串改键抢占默认键时，迁移仍优先保存的显式覆写', async () => {
    localStorage.setItem('sdt-keybinds', JSON.stringify({ backpack: 'Q' }));
    const input = await loadInput();
    expect(input.actionFor({ key: 'q' })).toBe('backpack');
    expect(input.bindings.camRotateL).toEqual([]);
  });
  it('空数组保持未绑定，多键数组逐个归一，未知或无效条目不影响默认动作', async () => {
    localStorage.setItem('sdt-keybinds', JSON.stringify({ camRotateL: [], backpack: ['V', 'J'], roll: null }));
    const input = await loadInput();
    expect(input.actionFor({ key: 'q' })).toBeNull();
    expect(input.actionFor({ key: 'j' })).toBe('backpack');
    expect(input.actionFor({ key: 'Enter' })).toBe('roll');
  });
  it('继承来的对象属性不是合法动作，不得抢占默认确认键', async () => {
    localStorage.setItem('sdt-keybinds', JSON.stringify({ constructor: 'X', toString: 'Q' }));
    const input = await loadInput();
    expect(input.actionFor({ key: 'x' })).toBe('moveConfirm');
    input.rebind('constructor', 'x');
    expect(input.actionFor({ key: 'x' })).toBe('moveConfirm');
    expect(input.actionFor({ key: 'q' })).toBe('camRotateL');
  });
  it('损坏设置降级默认，reset清空覆写', async () => {
    localStorage.setItem('sdt-keybinds', 'broken');
    const input = await loadInput(); expect(input.actionFor({ key: 'b' })).toBe('backpack');
    input.rebind('backpack', 'v'); input.reset();
    expect(input.actionFor({ key: 'b' })).toBe('backpack');
    expect(input.actionFor({ key: 'v' })).toBeNull();
  });
});

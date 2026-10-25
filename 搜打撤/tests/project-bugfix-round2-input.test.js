import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let Input, bindInputSettings, inputSettingsHTML;
beforeEach(async () => {
  vi.resetModules(); localStorage.clear();
  ({ Input } = await import('../game/src/core/input.js'));
  ({ bindInputSettings, inputSettingsHTML } = await import('../game/src/ui/settings-input.js'));
});
afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; localStorage.clear(); });
function setup(confirm) {
  document.body.innerHTML = `<div id="input-settings">${inputSettingsHTML()}</div>`;
  const root = document.querySelector('#input-settings');
  bindInputSettings(root, confirm);
  const listen = action => root.querySelector(`[data-rebind="${action}"]`).click();
  const key = value => root.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true }));
  return { root, listen, key };
}

describe('键位设置特殊情况', () => {
  it('重置后迟到的冲突确认不得重新覆盖默认键位', async () => {
    let approve;
    const h = setup(() => new Promise(resolve => { approve = resolve; }));
    h.listen('backpack'); h.key('q');
    h.root.querySelector('[data-binding-reset]').click(); approve(true);
    await Promise.resolve();
    expect(Input.bindings.backpack).toEqual(['b']);
    expect(Input.bindings.camRotateL).toEqual(['q']);
  });
  it('开始另一动作改键后，旧确认不得改变键位或覆盖新监听提示', async () => {
    let approve;
    const h = setup(() => new Promise(resolve => { approve = resolve; }));
    h.listen('backpack'); h.key('q'); h.listen('camFocus'); approve(true);
    await Promise.resolve();
    expect(h.root.querySelector('[data-rebind="camFocus"]').textContent).toBe('请按新键…');
    expect(Input.bindings.backpack).toEqual(['b']);
    h.key('v'); expect(Input.bindings.camFocus).toEqual(['v']);
  });
  it('冲突弹窗抛错后可重新修改且无异步拒绝外溢', async () => {
    const h = setup(() => Promise.reject(new Error('closed')));
    h.listen('backpack'); h.key('q'); await Promise.resolve();
    expect(h.root.querySelector('[data-binding-status]').textContent).toContain('请重试');
    h.listen('backpack'); h.key('v'); expect(Input.bindings.backpack).toEqual(['v']);
  });
  it('页面替换后迟到确认不得改键', async () => {
    let approve;
    const h = setup(() => new Promise(resolve => { approve = resolve; }));
    h.listen('backpack'); h.key('q'); h.root.remove(); approve(true);
    await Promise.resolve(); expect(Input.bindings.backpack).toEqual(['b']);
  });
  it('存储拒绝删除时恢复默认仍在当前会话生效', () => {
    Input.rebind('backpack', 'v');
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('denied'); });
    Input.reset(); expect(Input.actionFor({ key: 'b' })).toBe('backpack');
    expect(Input.actionFor({ key: 'v' })).toBeNull();
  });
  it('存储拒绝写入时关闭单字母快捷键仍立即生效，可再次开启', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    Input.setLettersEnabled(false);
    expect(Input.lettersEnabled).toBe(false); expect(Input.actionFor({ key: 'b' })).toBeNull();
    expect(Input.actionFor({ key: 'Enter' })).toBe('roll');
    Input.setLettersEnabled(true); expect(Input.actionFor({ key: 'b' })).toBe('backpack');
  });
  it('存储正常时继续读取外部更新', () => {
    Input.setLettersEnabled(false); localStorage.setItem('sdt-letter-shortcuts', '1');
    expect(Input.lettersEnabled).toBe(true);
  });
});

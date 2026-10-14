import { beforeAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
let UI;
function dom() {
  document.body.innerHTML = '<main id="viewport"><button id="opener">打开</button><div id="heroAva">旅</div><div id="overlay" tabindex="-1" hidden><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div></main>';
}
beforeAll(async () => {
  dom();
  window.SDT = { Icons:{ rich:x=>x }, Sound:{ sfx() {}, scene() {} }, Motion:{ overlayIn() {} } };
  ({ UI } = await import('../game/src/ui/ui.js'));
});
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', fn => setTimeout(fn, 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
  dom(); UI._acts = {}; UI._lastMode = null; UI._hideTimer = null; UI._overlayInerted = []; UI.init();
});
afterEach(() => {
  UI.hideOverlay({ immediate:true });
  vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals();
});
describe('真实 UI 同模式换页焦点', () => {
  it('重新创建 page 页面后把焦点移入新页，Tab/Esc 仍留在模态中', async () => {
    document.getElementById('opener').focus();
    UI.showOverlay('旧页面', '<button data-act="oldBack">返回旧页</button>', 'page');
    await vi.advanceTimersByTimeAsync(20);
    expect(document.activeElement.dataset.act).toBe('oldBack');
    UI.showOverlay('新页面', '<button data-act="newBack">返回新页</button>', 'page');
    UI.act('newBack', () => UI.hideOverlay({ immediate:true }));
    await vi.advanceTimersByTimeAsync(20);
    expect(document.activeElement.dataset.act).toBe('newBack');
    const esc = new KeyboardEvent('keydown', { key:'Escape', bubbles:true, cancelable:true });
    document.activeElement.dispatchEvent(esc);
    expect(esc.defaultPrevented).toBe(true);
    expect(UI.el.overlay.hidden).toBe(true);
    expect(document.activeElement.id).toBe('opener');
  });
  it('同模式确认的显式安全首焦点也生效', async () => {
    UI.showOverlay('确认一', '<button data-act="cancel">取消</button>', 'glass');
    await vi.advanceTimersByTimeAsync(20);
    UI.showOverlay('确认二', '<button data-act="danger">删除</button><button data-act="safe">保留</button>', 'glass', { initialFocus:'[data-act="safe"]' });
    await vi.advanceTimersByTimeAsync(20);
    expect(document.activeElement.dataset.act).toBe('safe');
  });
  it('不覆盖调用方在 show 之后建立的新表单焦点', async () => {
    UI.showOverlay('编辑', '<input id="editor"><button data-act="cancel">取消</button>', 'page');
    const editor=document.getElementById('editor'); editor.focus();
    await vi.advanceTimersByTimeAsync(20);
    expect(document.activeElement).toBe(editor);
  });
  it('快速显示关闭不会在旧帧恢复模态焦点', async () => {
    const opener = document.getElementById('opener'); opener.focus();
    UI.showOverlay('即关', '<button data-act="cancel">取消</button>', 'page');
    UI.hideOverlay({ immediate:true });
    await vi.advanceTimersByTimeAsync(20);
    expect(document.activeElement).toBe(opener);
  });
  it('较新页面替换令旧帧及旧显式首焦点失效', async () => {
    UI.showOverlay('旧页', '<button id="oldFocus">删除</button>', 'glass', { initialFocus:'#oldFocus' });
    UI.showOverlay('新页', '<input id="newFocus"><button data-act="cancel">取消</button>', 'glass');
    document.getElementById('newFocus').focus();
    await vi.advanceTimersByTimeAsync(20);
    expect(document.activeElement.id).toBe('newFocus');
  });
  it('显式目标已断开或禁用时退回安全焦点', async () => {
    const gone = document.createElement('button');
    UI.showOverlay('断开', '<button data-act="cancel">取消</button>', 'glass', { initialFocus:gone });
    await vi.advanceTimersByTimeAsync(20);
    expect(document.activeElement.dataset.act).toBe('cancel');
    UI.showOverlay('禁用', '<button id="disabledFocus" disabled>删除</button><button data-act="safe">保留</button>', 'glass', { initialFocus:'#disabledFocus' });
    await vi.advanceTimersByTimeAsync(20);
    expect(document.activeElement.dataset.act).toBe('safe');
  });
  it('同模式 data-initial-focus 明示优先；Tab 仍循环', async () => {
    UI.showOverlay('旧页', '<button data-act="cancel">取消</button>', 'page');
    await vi.advanceTimersByTimeAsync(20);
    UI.showOverlay('新页', '<button data-act="first">第一项</button><button data-initial-focus data-act="next">下一项</button>', 'page');
    await vi.advanceTimersByTimeAsync(20);
    expect(document.activeElement.dataset.act).toBe('next');
    document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key:'Tab', bubbles:true, cancelable:true }));
    expect(document.activeElement.dataset.act).toBe('first');
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

window.SDT = { Icons: { rich: value => value }, Sound: { sfx() {}, scene() {} } };
const { overlayMethods } = await import('../game/src/ui/overlay.js');
let UI;
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', vi.fn());
  document.body.innerHTML = '<main><button id="opener">打开</button><div id="overlay" tabindex="-1" hidden><div class="card"><h2 id="ovTitle"></h2><button id="ovCloseX">×</button><div id="ovBody"></div></div></div></main>';
  document.body.className = 'interface-motion';
  UI = { ...overlayMethods, _overlayInerted: [], el: Object.fromEntries(['overlay', 'ovTitle', 'ovBody', 'ovCloseX'].map(id => [id, document.getElementById(id)])) };
});
afterEach(() => {
  UI._cancelPageBg?.();
  vi.restoreAllMocks(); vi.unstubAllGlobals();
  document.body.replaceChildren(); document.body.className = '';
});
const inputs = () => Array.from({ length: 100 }, (_, i) => `<input id="setting${i}">`).join('');

describe('overlay mount work stays bounded without caching visibility', () => {
  it('finishes mode and inert writes before checking cancel visibility', () => {
    const readStyle = getComputedStyle;
    const style = vi.spyOn(globalThis, 'getComputedStyle').mockImplementation(element => {
      expect(document.body.classList.contains('page-covered')).toBe(true);
      expect(document.body.classList.contains('page-opaque')).toBe(true);
      expect(document.getElementById('opener').hasAttribute('inert')).toBe(true);
      return readStyle(element);
    });
    UI.showOverlay('设置', '<button data-cancel="true">返回</button>', 'page');
    expect(style).toHaveBeenCalled();
    expect(UI.el.ovCloseX.hidden).toBe(false);
  });

  it('does not compute styles for unrelated controls to select the safe initial focus', () => {
    UI.el.overlay.hidden = false;
    UI.el.ovBody.innerHTML = inputs() + '<button id="back">返回</button>';
    const style = vi.spyOn(globalThis, 'getComputedStyle');
    expect(UI._resolveOverlayInitialFocus().id).toBe('back');
    expect(style.mock.calls.some(([el]) => el.tagName === 'INPUT')).toBe(false);
    expect(style.mock.calls.length).toBeLessThan(10);
    document.getElementById('back').hidden = true;
    expect(UI._resolveOverlayInitialFocus().id).toBe('setting0');
  });

  it('valid explicit focus avoids a full sequential-focus scan, including tabindex minus one', () => {
    UI.el.overlay.hidden = false;
    UI.el.ovBody.innerHTML = inputs() + '<h3 id="heading" tabindex="-1">设置</h3>';
    const style = vi.spyOn(globalThis, 'getComputedStyle');
    expect(UI._resolveOverlayInitialFocus('#heading').id).toBe('heading');
    expect(style.mock.calls.some(([el]) => el.tagName === 'INPUT')).toBe(false);
  });

  it('invalid preferred and explicit targets fall back using current styles and disclosure state', () => {
    UI.el.overlay.hidden = false;
    UI.el.ovBody.innerHTML = '<details><summary id="summary">详情</summary><button id="old">返回旧页</button></details><fieldset disabled><button>取消禁用</button></fieldset><div style="display:none"><button>返回隐藏</button></div><button id="safe">取消</button>';
    expect(UI._resolveOverlayInitialFocus('#old').id).toBe('safe');
    UI.el.ovBody.querySelector('details').open = true;
    expect(UI._resolveOverlayInitialFocus('#old').id).toBe('old');
    document.getElementById('old').disabled = true;
    document.getElementById('safe').style.visibility = 'hidden';
    expect(UI._resolveOverlayInitialFocus('#old').id).toBe('summary');
  });

  it('only known bitmap icons skip CSS-background probing; ordinary background IMG stays supported', () => {
    const style = vi.spyOn(globalThis, 'getComputedStyle').mockReturnValue({ backgroundImage: 'url("/room.webp")' });
    UI.el.ovBody.innerHTML = '<img class="ic" data-asset-key="icon-gear" src="gear.png">';
    UI._checkPageBg();
    expect(style).not.toHaveBeenCalled();
    UI.el.ovBody.innerHTML = '<img data-asset-key="room-art" src="transparent.png">';
    UI._checkPageBg();
    expect(style).toHaveBeenCalledOnce();
    expect(UI.el.ovBody.firstElementChild.classList.contains('bg-loading')).toBe(true);
  });
});

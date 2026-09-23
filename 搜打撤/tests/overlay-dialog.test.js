import { describe, expect, it, beforeEach } from 'vitest';

window.SDT = {
  Icons: { rich: value => value },
  Sound: { sfx() {} },
  Motion: { overlayIn() {} },
};

const makeDom = () => {
  document.body.innerHTML = `
    <main id="viewport">
      <div id="heroAva">旅</div>
      <button id="opener">打开弹窗</button>
      <button id="backgroundAction">背景动作</button>
      <div id="overlay" role="dialog" aria-modal="true" aria-labelledby="ovTitle" tabindex="-1" hidden>
        <div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div>
      </div>
      <div id="otherBackground"><button>另一个背景动作</button></div>
    </main>`;
};

const waitFrame = () => new Promise(resolve => setTimeout(resolve, 30));

describe('overlay dialog accessibility contract', () => {
  let UI;

  beforeEach(async () => {
    makeDom();
    const mod = await import('../game/src/ui/ui.js');
    UI = mod.UI;
    UI._acts = {};
    UI._overlayReturnFocus = null;
    UI._overlayInerted = [];
    UI.init();
  });

  it('sets dialog semantics, isolates the background, traps Tab, and restores the opener', async () => {
    const opener = document.getElementById('opener');
    opener.focus();
    UI.showOverlay('确认操作', `
      <button class="danger" data-act="destructive">确认删除</button>
      <button data-act="cancel">取消</button>`);
    UI.act('cancel', () => UI.hideOverlay());
    await waitFrame();

    const overlay = document.getElementById('overlay');
    const cancel = overlay.querySelector('[data-act="cancel"]');
    expect(overlay.getAttribute('role')).toBe('dialog');
    expect(overlay.getAttribute('aria-modal')).toBe('true');
    expect(overlay.getAttribute('aria-labelledby')).toBe('ovTitle');
    expect(document.getElementById('backgroundAction').hasAttribute('inert')).toBe(true);
    expect(document.getElementById('otherBackground').hasAttribute('inert')).toBe(true);
    expect(document.activeElement).toBe(cancel);

    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    cancel.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement.dataset.act).toBe('destructive');

    document.getElementById('overlay').querySelector('[data-act="destructive"]').focus();
    const shiftTab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    document.activeElement.dispatchEvent(shiftTab);
    expect(shiftTab.defaultPrevented).toBe(true);
    expect(document.activeElement.dataset.act).toBe('cancel');

    UI.hideOverlay();
    await new Promise(resolve => setTimeout(resolve, 230));
    expect(overlay.hidden).toBe(true);
    expect(document.getElementById('backgroundAction').hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it('honors an explicit safe initialFocus selector and closes through Escape', async () => {
    const opener = document.getElementById('opener');
    opener.focus();
    UI.showOverlay('危险操作', `
      <button data-act="confirm">确认清空</button>
      <button data-act="cancel">返回</button>`, undefined, { initialFocus: '[data-act="cancel"]' });
    UI.act('cancel', () => UI.hideOverlay());
    await waitFrame();
    expect(document.activeElement.dataset.act).toBe('cancel');

    let bubbled = false;
    const observeBubble = () => { bubbled = true; };
    window.addEventListener('keydown', observeBubble);
    const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.activeElement.dispatchEvent(esc);
    window.removeEventListener('keydown', observeBubble);
    expect(esc.defaultPrevented).toBe(true);
    expect(bubbled).toBe(false);
    await new Promise(resolve => setTimeout(resolve, 230));
    expect(document.getElementById('overlay').hidden).toBe(true);
    expect(document.activeElement).toBe(opener);
  });
});

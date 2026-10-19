import { describe, expect, it, beforeEach, vi } from 'vitest';

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

  it('axe validates actual dialog markup after repeated close and reopening', async () => {
    const { default: axe } = await import('axe-core');
    const options = { runOnly: { type: 'rule', values: ['button-name', 'aria-dialog-name', 'aria-valid-attr', 'aria-valid-attr-value', 'aria-allowed-role'] } };
    UI.showOverlay('返回确认', '<button data-cancel="true">返回游戏</button>', 'page');
    const before = await axe.run(UI.el.overlay, options);
    expect(before.violations).toEqual([]);
    UI.hideOverlay(); UI.hideOverlay(); UI.hideOverlay({ immediate: true });
    UI.showOverlay('下一页', '<button data-cancel="true">继续</button>', 'page');
    const after = await axe.run(UI.el.overlay, options);
    expect(after.violations).toEqual([]);
    expect(after.incomplete).toEqual([]);
    expect(UI.el.overlay.hidden).toBe(false);
    UI.hideOverlay({ immediate: true });
  });

  it('照相馆卡牌IMG跳过背景样式读取，房间背景仍保留加载检测', () => {
    const style = vi.spyOn(globalThis, 'getComputedStyle').mockReturnValue({ backgroundImage: 'url("/room.webp")' });
    try {
      UI.el.ovBody.innerHTML = '<div class="photo-studio-v3"><img data-asset-key="card-art"></div>';
      UI._checkPageBg();
      expect(style).not.toHaveBeenCalled();
      UI.el.ovBody.innerHTML = '<div class="node-pg" data-asset-key="room-art"></div>';
      UI._checkPageBg();
      expect(style).toHaveBeenCalledOnce();
      expect(UI.el.ovBody.firstElementChild.classList.contains('bg-loading')).toBe(true);
      UI._cancelPageBg();
      expect(UI.el.ovBody.firstElementChild.classList.contains('bg-loading')).toBe(false);
    } finally { UI._cancelPageBg?.(); style.mockRestore(); }
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

  it('收回大卡后的按键重复不会触发底层奖励离开', async () => {
    window.SDT.Cards = { all: () => [], cardHTML: () => '<article class="hs-card"><div class="hsc-desc"></div></article>' };
    UI.showOverlay('奖励', '<button data-act="inspect">查看卡牌</button><button data-act="leave">离开</button>', 'chest');
    let left = 0;
    UI.act('leave', () => { left++; });
    await waitFrame();
    const source = document.querySelector('[data-act="inspect"]');
    source.focus();
    UI.showCardZoom({ id:'card', name:'测试卡', desc:'完整规则' }, { hideNote:true, presentation:'expedition' });
    const zoom = document.getElementById('cardZoom');
    expect(zoom.querySelector('.cz-note')).toBeNull();
    zoom.querySelector('.cz-close').dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true, cancelable:true }));
    // 原生输入把焦点还给来源后，可能继续发送同一次长按的 repeat。
    source.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', repeat:true, bubbles:true, cancelable:true }));
    expect(left).toBe(0);
    expect(UI.el.overlay.hidden).toBe(false);
    zoom._closeCardZoom(true);
  });

  it('显式安全取消优先于猜测文案，并由 Esc 调用原返回操作', () => {
    UI.showOverlay('锦囊', '<button data-act="leave">离开</button><button data-act="pouchBack" data-cancel="true">收好锦囊</button>');
    const leave = vi.fn(), back = vi.fn(); UI.act('leave', leave); UI.act('pouchBack', back);
    expect(UI._findCancelBtn().dataset.act).toBe('pouchBack');
    expect(UI.closeTopOverlayByEsc()).toBe(true);
    expect(back).toHaveBeenCalledOnce(); expect(leave).not.toHaveBeenCalled();
  });

  it('强制领取页无取消入口，隐藏或禁用标记及明确禁止按钮都不能被 Esc 跳过', () => {
    UI.showOverlay('领取补给', '<button data-act="take">收下</button><button data-cancel="false">返回地图</button><button data-cancel="true" disabled>取消</button><div hidden><button data-cancel="true">收好</button></div>', 'chest');
    expect(UI._findCancelBtn()).toBeUndefined();
    expect(UI._canCancelOverlay()).toBe(false);
    expect(UI.closeTopOverlayByEsc()).toBe(false);
    expect(UI.el.overlay.hidden).toBe(false);
  });

  it('closes immediately when reduced motion is enabled', () => {
    UI.showOverlay('成就总览', '<div class="achievement-gallery">奖章</div>', 'page');
    document.body.classList.add('reduce-motion');
    try {
      UI.hideOverlay();
      expect(document.getElementById('overlay').hidden).toBe(true);
      expect(document.getElementById('ovBody').childElementCount).toBe(0);
      expect(UI._hideTimer).toBeNull();
    } finally { document.body.classList.remove('reduce-motion'); }
  });
});

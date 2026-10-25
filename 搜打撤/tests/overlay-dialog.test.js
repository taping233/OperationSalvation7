import { createMenuLeaveFlow } from '../game/src/ui/menu-leave.js';
import { confirmAction } from '../game/src/ui/confirm-dialog.js';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { linkedBackHTML } from '../game/src/ui/home-linked-interactions.js';
import { setRunTopBarBattleOptions } from '../game/src/ui/run-top-bar.js';
import { mountCombatOverlay, restoreCombatScene } from '../game/src/battle/view/battle.secondary-overlay.js';

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

  it('mounts the shared run bar inside the live modal before isolation, and re-isolates it for leave/confirmation', async () => {
    const bar=document.getElementById('runTopBar');
    expect(bar.parentNode).toBe(document.getElementById('viewport'));
    UI.showOverlay('战斗','<section class="battle-stage"><button id="battleAction">出牌</button></section>','battle');
    expect(bar.parentNode).toBe(UI.el.overlay); expect(bar.hasAttribute('inert')).toBe(false);
    expect(document.getElementById('backgroundAction').hasAttribute('inert')).toBe(true);
    // Repeat the real hidden→mounted→isolate order without refreshing the HUD.
    UI._isolateOverlayBackground(); expect(bar.hasAttribute('inert')).toBe(false);
    UI.showOverlay('系统菜单','<section class="leave-run-panel"><button>继续游玩</button></section>','glass');
    expect(bar.hasAttribute('inert')).toBe(true);
    UI.showOverlay('战斗','<section class="battle-stage"><button>出牌</button></section>','battle');
    expect(bar.hasAttribute('inert')).toBe(false);
    const confirmation=confirmAction({title:'确认',message:'测试当前上层',confirmLabel:'确认'});
    expect(document.getElementById('viewport').inert).toBe(true);
    document.querySelector('[data-confirm-cancel]').click(); expect(await confirmation).toBe(false);
    expect(document.getElementById('viewport').inert).toBe(false); expect(bar.hasAttribute('inert')).toBe(false);
    expect(document.getElementById('backgroundAction').hasAttribute('inert')).toBe(true);
    UI.hideOverlay({immediate:true});
    expect(bar.hasAttribute('inert')).toBe(false); expect(document.getElementById('backgroundAction').hasAttribute('inert')).toBe(false);
  });

  it('commits battle option visibility after the pre-commit mode broadcast and restores it with the retained scene', () => {
    UI.showOverlay('战斗', '<section class="battle-stage sts"><div class="sts-topbar"><details class="sts-options"><summary>选项</summary><button>战斗规则</button></details></div></section>', 'battle');
    const scene = UI.el.ovBody.querySelector('.battle-stage'); scene._battleToken = 42;
    const action=vi.fn(); UI.act('btSettings',action); setRunTopBarBattleOptions(UI, scene);
    const button = document.getElementById('btnBattleOptions'); button.click();
    expect(button.hidden).toBe(false); expect(action).toHaveBeenCalledOnce();
    const observations=[];
    const beforeCommit=event=>{ if(event.detail==='settings') observations.push(UI._lastMode); };
    document.addEventListener('sdt-overlay-mode',beforeCommit);
    try {
      expect(mountCombatOverlay(UI,'战斗规则','<button>返回战斗</button>','settings',scene)).toBe(true);
      expect(observations).toEqual(['battle']); expect(UI._lastMode).toBe('settings');
      expect(button.hidden).toBe(false); button.click(); expect(action).toHaveBeenCalledOnce();
      expect(restoreCombatScene(UI,42)).toBe(true);
      expect(button.hidden).toBe(false);
      UI.act('btSettings',action); button.click(); expect(action).toHaveBeenCalledTimes(2);
    } finally { document.removeEventListener('sdt-overlay-mode',beforeCommit); UI.hideOverlay({immediate:true}); }
  });

  it('returns a temporary battle from the real system-menu flow without hiding its modal', () => {
    const game={state:'modal',battleActive:true,runActive:true,seed:7,discoveredPairs:new Set(),ownedCards:[]};
    const battleHTML='<section class="battle-stage"><button>出牌</button></section>';
    UI.showOverlay('战斗',battleHTML,'battle');
    const refreshView=vi.fn(()=>UI.showOverlay('战斗',battleHTML,'battle'));
    const flow=createMenuLeaveFlow({UI,game,document,getActiveSlot:()=>null,esc:String,readBattle:()=>({commands:{refreshView}})});
    flow.openLeaveMenu(); expect(document.querySelector('.battle-stage')).toBeNull();
    expect(UI._acts.leaveCancel()).toBe(true);
    expect(refreshView).toHaveBeenCalledOnce(); expect(game.state).toBe('modal'); expect(UI.el.overlay.hidden).toBe(false);
    expect(document.querySelector('.battle-stage')).not.toBeNull();
    const bar=document.getElementById('runTopBar'); expect(bar.parentNode).toBe(UI.el.overlay); expect(bar.hasAttribute('inert')).toBe(false);
    UI.hideOverlay({immediate:true});
  });

  it('returns a shared bar re-mounted during the close animation to the viewport at final hide', () => {
    UI.showOverlay('系统菜单','<section class="leave-run-panel"><button>继续游玩</button></section>','glass');
    UI.hideOverlay();
    const bar=document.getElementById('runTopBar');
    // This is the real HUD refresh race: closing has begun but hidden is still false.
    UI.el.overlay.prepend(bar);
    UI.hideOverlay({immediate:true});
    expect(UI.el.overlay.hidden).toBe(true); expect(bar.parentNode).toBe(document.getElementById('viewport'));
    expect(bar.hasAttribute('inert')).toBe(false); expect(bar.dataset.surface).toBe('map');
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

  it('picker focus excludes inert background, disabled-fieldset controls and negative tab order', async () => {
    UI.showOverlay('选择奖励', `<div class="cqo-background" inert><button id="backgroundReturn">返回总览</button></div>
      <fieldset disabled><button id="fieldsetDisabled">取消旧操作</button></fieldset>
      <button id="programmaticOnly" tabindex="-1">返回定位</button>
      <button id="pickerReturn" data-cancel="true">返回当前奖励</button><button id="pickerNext">确认</button>`, 'chest');
    await waitFrame();
    expect(UI._overlayFocusable().map(node => node.id)).toEqual(['pickerReturn', 'pickerNext']);
    expect(document.activeElement.id).toBe('pickerReturn');
    document.getElementById('pickerNext').focus();
    const forward = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    UI._trapOverlayFocus(forward);
    expect(forward.defaultPrevented).toBe(true); expect(document.activeElement.id).toBe('pickerReturn');
    const backward = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true });
    UI._trapOverlayFocus(backward);
    expect(backward.defaultPrevented).toBe(true); expect(document.activeElement.id).toBe('pickerNext');
    UI.hideOverlay({ immediate: true });
  });

  it('invalid explicit focus falls back safely while deliberate negative-tabindex focus remains supported', () => {
    UI.showOverlay('操作', '<div inert><button id="inertFocus">返回背景</button></div><button id="safeFocus">取消</button><h3 id="headingFocus" tabindex="-1">内容标题</h3><input id="hiddenInput" type="hidden">', 'page');
    expect(UI._resolveOverlayInitialFocus('#inertFocus').id).toBe('safeFocus');
    expect(UI._resolveOverlayInitialFocus('#headingFocus').id).toBe('headingFocus');
    expect(UI._resolveOverlayInitialFocus('#hiddenInput').id).toBe('safeFocus');
    UI.hideOverlay({ immediate: true });
  });

  it('native disabled-fieldset legend exception remains keyboard reachable', () => {
    UI.showOverlay('设置', '<fieldset disabled><legend><button id="legendAction">启用设置</button></legend><button id="disabledSetting">旧设置</button></fieldset><button id="safeReturn">返回</button>', 'page');
    expect(UI._overlayFocusable().map(node => node.id)).toEqual(['legendAction', 'safeReturn']);
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

  it.each(['reward-card', 'event-choice-card', 'bt-card'])('卡牌%s正文含返回/离开不会成为取消按钮', className => {
    UI.showOverlay('领取补给', `<button class="${className}" data-act="readCard">离开战斗时返回背包</button><button data-act="back">返回地图</button>`, 'chest');
    const read = vi.fn(), back = vi.fn(); UI.act('readCard', read); UI.act('back', back);
    expect(UI._findCancelBtn()?.dataset.act).toBe('back');
    UI.closeTopOverlayByEsc();
    expect(read).not.toHaveBeenCalled(); expect(back).toHaveBeenCalledOnce();
    UI.showOverlay('强制领取', `<button class="${className}" data-act="claim">返回手牌</button>`, 'chest');
    expect(UI._findCancelBtn()).toBeUndefined();
    expect(UI.closeTopOverlayByEsc()).toBe(false);
  });

  it('显式安全取消优先于猜测文案，并由 Esc 调用原返回操作', () => {
    UI.showOverlay('锦囊', '<button data-act="leave">离开</button><button data-act="pouchBack" data-cancel="true">收好锦囊</button>');
    const leave = vi.fn(), back = vi.fn(); UI.act('leave', leave); UI.act('pouchBack', back);
    expect(UI._findCancelBtn().dataset.act).toBe('pouchBack');
    expect(UI.closeTopOverlayByEsc()).toBe(true);
    expect(back).toHaveBeenCalledOnce(); expect(leave).not.toHaveBeenCalled();
  });

  it.each(['slotBack', 'cls2Quit', 'clsBack', 'depBack', 'dataPageBack'])('共用返回%s的点击、Esc和遮罩使用同一个显式动作', action => {
    UI.showOverlay('档案', linkedBackHTML(action, '收回档案', '', 'button', { cancel:true }), 'page');
    const back = vi.fn(); UI.act(action, back);
    const button = document.querySelector(`[data-act="${action}"]`);
    expect(button.dataset.cancel).toBe('true');
    button.click();
    button.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true, cancelable:true }));
    UI.el.overlay.click();
    expect(back).toHaveBeenCalledTimes(3);
    expect(UI.el.overlay.hidden).toBe(false);
  });

  it.each(['button', 'Escape', 'backdrop'])('内层详情的%s只收回详情，下一次取消才返回页面', method => {
    UI.showOverlay('档案', `${linkedBackHTML('pageBack', '返回档案', '', 'button', { cancel:true })}
      <section role="dialog" aria-label="详情"><button data-act="detailBack" data-cancel="true">收回详情</button></section>`, 'page');
    const pageBack = vi.fn(), detailBack = vi.fn(() => { document.querySelector('[role="dialog"] [data-act="detailBack"]').parentElement.hidden = true; });
    UI.act('pageBack', pageBack); UI.act('detailBack', detailBack);
    const detail = document.querySelector('[data-act="detailBack"]');
    if (method === 'button') detail.click();
    if (method === 'Escape') detail.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true, cancelable:true }));
    if (method === 'backdrop') UI.el.overlay.click();
    expect(detailBack).toHaveBeenCalledOnce(); expect(pageBack).not.toHaveBeenCalled();
    expect(UI.closeTopOverlayByEsc()).toBe(true); expect(pageBack).toHaveBeenCalledOnce();
  });

  it.each(['page', 'bagpage'])('必须选择的内层%s不穿透到底层显式返回或背包关闭兜底', mode => {
    UI.showOverlay('档案', `${linkedBackHTML('pageBack', '返回档案', '', 'button', { cancel:true })}
      <section role="dialog" aria-label="必须选择"><button data-act="choose" data-cancel="false">返回手牌</button></section>`, mode);
    const back = vi.fn(), choose = vi.fn(), closeBag = vi.fn();
    UI.act('pageBack', back); UI.act('choose', choose); UI._bagCloseHook = closeBag;
    try {
      expect(UI._findCancelBtn()).toBeUndefined(); expect(UI._canCancelOverlay()).toBe(false);
      expect(UI.closeTopOverlayByEsc()).toBe(false); UI.el.overlay.click();
      expect(back).not.toHaveBeenCalled(); expect(choose).not.toHaveBeenCalled(); expect(closeBag).not.toHaveBeenCalled();
      expect(UI.el.overlay.hidden).toBe(false);
    } finally { UI._bagCloseHook = null; }
  });

  it('特写拥有遮罩和直接取消，不能代点底层返回', () => {
    UI.showOverlay('档案', linkedBackHTML('pageBack', '返回档案', '', 'button', { cancel:true }), 'page');
    const back = vi.fn(); UI.act('pageBack', back);
    const zoom = document.createElement('div'); zoom.id = 'cardZoom';
    zoom._closeCardZoom = vi.fn(); document.body.append(zoom);
    expect(UI._canCancelOverlay()).toBe(true);
    UI.el.overlay.click(); UI.closeTopOverlayByEsc();
    expect(zoom._closeCardZoom).toHaveBeenCalledTimes(2); expect(back).not.toHaveBeenCalled();
    zoom.remove(); UI.closeTopOverlayByEsc(); expect(back).toHaveBeenCalledOnce();
  });

  it('共用返回组件只按调用方声明取消，明确禁止时不再猜测返回文字', () => {
    UI.showOverlay('选择', linkedBackHTML('mustChoose', '返回手牌', '', 'button', { cancel:false }), 'page');
    expect(UI._findCancelBtn()).toBeUndefined(); expect(UI.closeTopOverlayByEsc()).toBe(false);
    document.getElementById('ovBody').innerHTML = linkedBackHTML('legacyBack', '返回页面');
    expect(document.querySelector('[data-act="legacyBack"]').hasAttribute('data-cancel')).toBe(false);
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

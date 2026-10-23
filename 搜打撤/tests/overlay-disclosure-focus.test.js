import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerRuntimeTracePanel } from '../game/src/core/runtime-trace-panel.local.js';

window.SDT = { Icons: { rich: value => value }, Sound: { sfx() {} } };
const { overlayMethods } = await import('../game/src/ui/overlay.js');
let UI;
const ids = () => UI._overlayFocusable().map(node => node.id);

beforeEach(() => {
  document.body.innerHTML = '<div id="overlay" tabindex="-1"><div id="ovBody"></div></div>';
  UI = { ...overlayMethods, el: { overlay: document.getElementById('overlay'), ovBody: document.getElementById('ovBody') } };
});
afterEach(() => { document.body.replaceChildren(); });

describe('shared overlay native disclosure keyboard contract', () => {
  it('cancel, explicit initial focus and Tab share the live inner dialog', () => {
    UI.el.ovBody.innerHTML = '<button id="pageBack" data-cancel="true">返回页面</button><section id="detail" role="dialog"><button id="detailBack" data-cancel="true">收回详情</button><button id="detailNext">下一项</button></section>';
    const detail = document.getElementById('detail');
    expect(UI._overlayInteractionRoot()).toBe(detail);
    expect(UI._findCancelBtn().id).toBe('detailBack');
    expect(ids()).toEqual(['detailBack', 'detailNext']);
    expect(UI._resolveOverlayInitialFocus('#pageBack').id).toBe('detailBack');
    expect(UI._resolveOverlayInitialFocus(document.getElementById('pageBack')).id).toBe('detailBack');
    document.getElementById('detailNext').focus();
    UI._trapOverlayFocus(new KeyboardEvent('keydown', { key:'Tab', cancelable:true }));
    expect(document.activeElement.id).toBe('detailBack');
    detail.hidden = true;
    expect(UI._overlayInteractionRoot()).toBe(UI.el.ovBody);
    expect(ids()).toEqual(['pageBack']);
    UI.el.ovBody.innerHTML = '<section id="replacement" role="dialog"><button id="replacementBack" data-cancel="true">返回新详情</button></section>';
    expect(UI._overlayInteractionRoot().id).toBe('replacement');
    expect(UI._resolveOverlayInitialFocus('#detailBack').id).toBe('replacementBack');
  });

  it('a mandatory empty dialog retains focus without exposing background actions', () => {
    UI.el.ovBody.innerHTML = '<button id="pageBack" data-cancel="true">返回页面</button><section id="choice" role="dialog" aria-label="选择处理中">处理中</section>';
    expect(ids()).toEqual([]);
    expect(UI._resolveOverlayInitialFocus('#pageBack').id).toBe('choice');
    expect(UI._findCancelBtn()).toBeUndefined();
    UI._trapOverlayFocus(new KeyboardEvent('keydown', { key:'Tab', cancelable:true }));
    expect(document.activeElement.id).toBe('choice');
  });

  it('only the registered diagnostic panel stays in the Tab set beside a detail', () => {
    UI.el.overlay.setAttribute('role', 'dialog'); UI.el.overlay.setAttribute('aria-modal', 'true');
    UI.el.ovBody.innerHTML = '<button id="pageBack" data-cancel="true">返回页面</button><section role="dialog"><button id="detailBack" data-cancel="true">收回详情</button></section>';
    const panel = document.createElement('aside'); panel.innerHTML = '<button id="traceAction">记录</button>';
    document.body.append(panel); const unregister = registerRuntimeTracePanel(panel);
    const unrelated = document.createElement('button'); unrelated.id = 'unrelated'; UI.el.overlay.append(unrelated);
    try {
      expect(ids()).toEqual(['detailBack', 'traceAction']);
      expect(UI._resolveOverlayInitialFocus('#pageBack').id).toBe('detailBack');
      expect(UI._findCancelBtn().id).toBe('detailBack');
    } finally { unregister(); }
  });

  it('collapsed reward shelf exposes its summary, not its hidden card actions', () => {
    UI.el.ovBody.innerHTML = '<details><summary id="shelf">本次已入库</summary><button id="card">查看卡牌</button></details><button id="back">返回</button>';
    expect(ids()).toEqual(['shelf', 'back']);
    expect(UI._resolveOverlayInitialFocus('#card').id).toBe('back');
    UI.el.ovBody.querySelector('details').open = true;
    expect(ids()).toEqual(['shelf', 'card', 'back']);
  });

  it('only the first direct summary is a native tab stop, including explicit initial focus', () => {
    UI.el.ovBody.innerHTML = '<details open><summary id="first">展柜灯光</summary><summary id="second">说明</summary><button id="polish">擦亮</button></details>';
    expect(ids()).toEqual(['first', 'polish']);
    expect(UI._resolveOverlayInitialFocus('#first').id).toBe('first');
    expect(UI._resolveOverlayInitialFocus('#second').id).toBe('first');
  });

  it('nested closed disclosures hide descendants but preserve actions within their first summary', () => {
    UI.el.ovBody.innerHTML = '<details><summary id="outer">明细 <button id="summaryAction">说明</button></summary><details open><summary id="inner">卡牌</summary><button id="innerAction">查看</button></details></details><button id="back">返回</button>';
    expect(ids()).toEqual(['outer', 'summaryAction', 'back']);
    UI.el.ovBody.querySelector('details').open = true;
    expect(ids()).toEqual(['outer', 'summaryAction', 'inner', 'innerAction', 'back']);
  });

  it('Tab wraps through the visible summary rather than a collapsed action', () => {
    UI.el.ovBody.innerHTML = '<details><summary id="shelf">已入库卡牌</summary><button id="hiddenCard">查看</button></details><button id="back">返回</button>';
    document.getElementById('back').focus();
    const forward = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    UI._trapOverlayFocus(forward);
    expect(forward.defaultPrevented).toBe(true);
    expect(document.activeElement.id).toBe('shelf');
    const backward = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true });
    UI._trapOverlayFocus(backward);
    expect(backward.defaultPrevented).toBe(true);
    expect(document.activeElement.id).toBe('back');
  });

  it('Esc ignores inert, fieldset-disabled, collapsed and CSS-hidden cancellation actions', () => {
    UI.el.ovBody.innerHTML = '<div inert><button data-cancel="true">返回背景</button></div><fieldset disabled><button data-cancel="true">取消禁用</button></fieldset><details><summary>明细</summary><button data-cancel="true">关闭明细</button></details><div style="display:none"><button data-cancel="true">返回隐藏页</button></div><button style="visibility:hidden" data-cancel="true">隐藏返回</button><button id="back" data-cancel="true">返回当前页</button>';
    const back = vi.fn();
    document.getElementById('back').addEventListener('click', back);
    expect(UI._findCancelBtn().id).toBe('back');
    expect(UI.closeTopOverlayByEsc()).toBe(true);
    expect(back).toHaveBeenCalledOnce();
  });

  it('CSS-hidden targets are skipped while explicitly visible descendants remain available', () => {
    UI.el.ovBody.innerHTML = '<div style="display:none"><button id="displayHidden">返回隐藏页</button></div><div style="visibility:hidden"><button id="visibilityHidden">关闭</button><button id="visibleOverride" style="visibility:visible">查看</button></div><button id="back">返回</button>';
    expect(ids()).toEqual(['visibleOverride', 'back']);
    expect(UI._resolveOverlayInitialFocus('#displayHidden').id).toBe('back');
    expect(UI._resolveOverlayInitialFocus('#visibilityHidden').id).toBe('back');
  });
});

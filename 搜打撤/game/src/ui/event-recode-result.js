import { esc } from '../core/shared.js';
import { beginRoomSave } from './room-footer.js';
import { captureOverlayReturnState, restoreOverlayReturnState } from './overlay-return-state.js';
import '../../css/event-recode-result.css';

// The caller owns the draw record and mutation. This screen only holds a
// frozen result for reading; leaving and reopening must never roll new cards.
export function showEventRecodeResult({ UI, Cards, cards, entries, nodeShell, setReturn, current, done, openBag = null }) {
  let finished = false, pending = null, presentation = null;
  const render = () => {
    if (finished || !current()) return;
    setReturn(render);
    nodeShell({ tone:'event', asset:'scene-event-recode', icon:'[[icon:recycle]]', title:'重编结果',
      sub:'新卡已确定，确认后替换原卡。',
      body:`<section class="recode-result" data-event-recode-result aria-label="查看换牌结果">${cards.map((card, i) => `<article class="recode-result-item"><p class="recode-result-source">${esc(entries[i].card.name)} <span aria-hidden="true">→</span></p><button type="button" class="recode-result-card" data-act="eventRecodeInspect" data-i="${i}" aria-label="查看${esc(card.name)}详情">${Cards.cardHTML(card)}</button></article>`).join('')}</section>`,
      foot:`${openBag ? '<button type="button" class="ov-btn" data-act="eventRecodeResultBag">整理背包</button>' : ''}<button type="button" class="ov-btn ok" data-act="eventRecodeAccept">确认更换，继续探索</button><p class="reward-notice" data-recode-confirm-notice role="status" aria-live="polite"></p>`,
    });
    const root = /** @type {HTMLElement} */ (UI.el.ovBody.querySelector('[data-event-recode-result]'));
    const page = UI.el.ovBody.firstElementChild, revision = UI._overlayRevision;
    const ownsPage = () => !finished && current() && root?.isConnected && UI._overlayRevision === revision
      && UI.el.ovBody.firstElementChild === page && !UI.el.overlay.hidden && !UI.el.overlay.classList.contains('closing')
      && /** @type {HTMLElement} */ (UI.el.ovBody.querySelector('[data-event-recode-result]')) === root;
    const active = () => !pending && ownsPage();
    UI.act('eventRecodeInspect', data => {
      if (!active()) return;
      const card = cards[Number(data.i)];
      if (card) UI.showCardZoom(card, { returnFocus:root.querySelector(`[data-i="${Number(data.i)}"]`) });
    });
    UI.act('eventRecodeResultBag', () => {
      if (!active() || !openBag) return false;
      presentation = captureOverlayReturnState(page, page.querySelector('[data-act="eventRecodeResultBag"]'));
      setReturn(render);
      return openBag();
    });
    UI.act('eventRecodeAccept', () => {
      if (pending) return pending;
      if (!active()) return false;
      let release = () => {};
      const work = Promise.resolve().then(async () => {
        if (!ownsPage()) return false;
        release = beginRoomSave(page, null, '正在确认…');
        let result;
        try { result = await done(); }
        catch (error) { console.warn('[event-recode] 更换尚未完成', error); result = false; }
        if (result === false) {
          if (ownsPage()) {
            setReturn(render);
            page.querySelector('[data-recode-confirm-notice]').textContent = '本次更换尚未完成，原卡和结果已保留；可整理背包后重试。';
          }
          return false;
        }
        const clearReturn = ownsPage();
        finished = true;
        if (clearReturn) setReturn(null);
        return true;
      }).finally(() => { release(); if (pending === work) pending = null; });
      pending = work;
      return work;
    });
    restoreOverlayReturnState(page, presentation, { isCurrent:ownsPage });
    return true;
  };
  render();
}

import { esc } from '../core/shared.js';
import '../../css/event-recode-result.css';

// The caller owns the draw record and mutation. This screen only holds a
// frozen result for reading; leaving and reopening must never roll new cards.
export function showEventRecodeResult({ UI, Cards, cards, entries, nodeShell, setReturn, current, done }) {
  let finished = false;
  const render = () => {
    if (finished || !current()) return;
    setReturn(render);
    nodeShell({ tone:'event', asset:'scene-event-recode', icon:'[[icon:recycle]]', title:'重编结果',
      sub:'新卡已确定，确认后替换原卡。',
      body:`<section class="recode-result" data-event-recode-result aria-label="查看换牌结果">${cards.map((card, i) => `<article class="recode-result-item"><p class="recode-result-source">${esc(entries[i].card.name)} <span aria-hidden="true">→</span></p><button type="button" class="recode-result-card" data-act="eventRecodeInspect" data-i="${i}" aria-label="查看${esc(card.name)}详情">${Cards.cardHTML(card)}</button></article>`).join('')}</section>`,
      foot:'<button type="button" class="ov-btn ok" data-act="eventRecodeAccept">确认更换，继续探索</button>',
    });
    const root = UI.el.ovBody.querySelector('[data-event-recode-result]');
    const active = () => !finished && current() && root?.isConnected
      && UI.el.ovBody.querySelector('[data-event-recode-result]') === root;
    UI.act('eventRecodeInspect', data => {
      if (!active()) return;
      const card = cards[Number(data.i)];
      if (card) UI.showCardZoom(card, { returnFocus:root.querySelector(`[data-i="${Number(data.i)}"]`) });
    });
    UI.act('eventRecodeAccept', () => {
      if (!active()) return;
      finished = true;
      setReturn(null);
      done();
    });
  };
  render();
}

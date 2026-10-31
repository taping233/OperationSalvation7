import { esc } from '../core/shared.js';
import { Random } from '../core/random.js';
import { eventDieHTML, animateEventDie } from './event-dice-visual.js';
import { saveRunCheckpoint } from '../core/run-checkpoint.js';
import '../../css/event-dice.css';

// Outcomes and the result live in the caller's run record, never in animation state.
export function diceStep(owner, key, outcomes, sides = 6) {
  owner.dice ||= {};
  if (!owner.dice[key]) owner.dice[key] = { sides, outcomes, result:null };
  const step = owner.dice[key];
  if (step.sides !== 6 || step.outcomes.length > 6) {
    // Preserve a legacy roll's reward while moving its display to a six-sided die.
    const chosen = step.result == null ? null : step.outcomes[Math.floor((step.result - 1) * step.outcomes.length / step.sides)];
    if (step.outcomes.length > 6) {
      const pool = step.outcomes.filter(outcome => outcome !== chosen);
      const candidates = chosen ? [chosen] : [];
      while (candidates.length < 6 && pool.length) {
        candidates.push(pool.splice(Math.floor(Random.random('event') * pool.length), 1)[0]);
      }
      step.outcomes = candidates;
    }
    step.sides = 6;
    if (chosen) step.result = Math.ceil(step.outcomes.indexOf(chosen) * 6 / step.outcomes.length) + 1;
  }
  return owner.dice[key];
}

export function createEventDiceController({ UI, SDT, save, show, bind, onLeave, setReturn = undefined }) {
  let sequence = 0;
  const persist = async () => await saveRunCheckpoint(save);
  async function open({ owner, key, title, outcomes, sides = undefined, done, beforeRoll = () => true, current:context = () => true, openingCurrent = () => true }) {
    if (!context() || !openingCurrent()) return false;
    const step = diceStep(owner, key, outcomes, sides);
    const token = ++sequence;
    let rolling = false, continued = false;
    const selected = () => step.result == null ? null : step.outcomes[Math.floor((step.result - 1) * step.outcomes.length / step.sides)];
    function render(notice = '') {
      if (token !== sequence || continued || !context()) return;
      const result = selected();
      show({ title, sub:'当前节点可返回重进，投骰结果不变；前往下一节点后事件结束。',
        body:`<div class="event-dice-panel">${eventDieHTML(step.sides, result ? step.result : null)}
          <p class="event-dice-result" role="status">${result ? `${step.result} 点 · ${esc(result.label)}` : `D${step.sides} · 等待投骰`}</p>
          <details class="event-dice-rules" open><summary>点数与结果</summary>${step.outcomes.map((o,i) => {
            const from = Math.ceil(i * step.sides / step.outcomes.length) + 1;
            const to = Math.ceil((i + 1) * step.sides / step.outcomes.length);
            return `<p><b>${from === to ? from : `${from}～${to}`} 点</b><span>${esc(o.label)}</span></p>`;
          }).join('')}</details><p role="status">${esc(notice)}</p>
          <button type="button" class="ov-btn ok" data-act="eventDiceRoll"${result ? ' hidden' : ''}>投掷骰子</button>
          <button type="button" class="ov-btn ok" data-act="eventDiceContinue"${result ? '' : ' hidden'}>确认结果，继续</button>
          <button type="button" class="ov-btn" data-act="eventDiceLeave">返回地图</button></div>` });
      const active = bind('eventDiceRoll');
      const current = () => token === sequence && !continued && context() && active();
      setReturn?.(() => { if (token === sequence && !continued) render(); });
      const leave = () => { if (current() && !rolling) { sequence++; return onLeave(); } };
      UI.act('eventDiceLeave', leave);
      UI.act('eventExit', leave);
      UI.act('eventDiceContinue', async () => {
        if (!current() || rolling || !selected()) return;
        rolling = true;
        const saved = await persist();
        rolling = false;
        if (!current()) return;
        if (!saved) { render('保存未成功，请重试确认；本次结果不会改变。'); return; }
        continued = true;
        if (await done(selected().value) === false) {
          continued = false;
          // 下游可能已打开保存重试页；只重绘仍由本次骰子持有的页面。
          if (current()) render('奖励尚未承接，请重试确认；本次结果不会改变。');
        }
      });
      UI.act('eventDiceRoll', async () => {
        if (!current() || rolling || step.result != null) return;
        rolling = true;
        if (!await beforeRoll()) { rolling = false; if (current()) render('当前无法投骰，请检查货币。'); return; }
        if (!current()) { rolling = false; return; }
        step.result = 1 + Math.floor(Random.random('event') * step.sides);
        // Persist payment and roll together before revealing the outcome.
        if (!await persist()) {
          rolling = false;
          render('保存未成功，结果已保留在本局；请先重试保存。');
          return;
        }
        if (!current()) { rolling = false; return; }
        SDT.Sound?.sfx?.('scene');
        const die = /** @type {HTMLElement} */ (UI.el?.ovBody?.querySelector('[data-event-die]'));
        /** @type {NodeListOf<HTMLButtonElement>} */ (UI.el?.ovBody?.querySelectorAll('button') || []).forEach(button => button.disabled = true);
        if (die && !SDT.Motion?.reduceMotion?.()
            && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
            && !document.body.classList.contains('reduce-motion')) await animateEventDie(die, step.sides, step.result);
        rolling = false;
        if (current()) render();
      });
    }
    const saved = await persist();
    if (token !== sequence || !context() || !openingCurrent()) return false;
    if (!saved) { await onLeave(); return false; }
    render();
    return true;
  }
  return { open };
}

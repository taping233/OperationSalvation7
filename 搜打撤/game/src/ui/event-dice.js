import { esc } from '../core/shared.js';
import { Random } from '../core/random.js';
import { hopPoint, ease } from '../core/motion-primitives.js';
import '../../css/event-dice.css';

// Outcomes and the result live in the caller's run record, never in animation state.
export function diceStep(owner, key, outcomes, sides = outcomes.length) {
  owner.dice ||= {};
  if (!owner.dice[key]) owner.dice[key] = { sides, outcomes, result:null };
  return owner.dice[key];
}

export function createEventDiceController({ UI, SDT, save, show, bind, onLeave, setReturn }) {
  let sequence = 0;
  function open({ owner, key, title, outcomes, sides, done, beforeRoll = () => true, current:context = () => true }) {
    const step = diceStep(owner, key, outcomes, sides);
    const token = ++sequence;
    let rolling = false, continued = false;
    const selected = () => step.result == null ? null : step.outcomes[Math.floor((step.result - 1) * step.outcomes.length / step.sides)];
    function render(notice = '') {
      if (token !== sequence || continued || !context()) return;
      const result = selected();
      show({ title, sub:'先看点数规则，再亲手投骰。结果会保留，离开重进不会重投。',
        body:`<div class="event-dice-panel"><div class="event-die" data-event-die aria-label="${result ? `骰子 ${step.result} 点` : '尚未投骰'}">${result ? step.result : '？'}</div>
          <p class="event-dice-result" role="status">${result ? `${step.result} 点 · ${esc(result.label)}` : `D${step.sides} · 等待投骰`}</p>
          <details class="event-dice-rules" open><summary>点数与结果</summary>${step.outcomes.map((o,i) => {
            const from = Math.ceil(i * step.sides / step.outcomes.length) + 1;
            const to = Math.ceil((i + 1) * step.sides / step.outcomes.length);
            return `<p><b>${from === to ? from : `${from}～${to}`} 点</b><span>${esc(o.label)}</span></p>`;
          }).join('')}</details><p role="status">${esc(notice)}</p>
          <button type="button" class="ov-btn ok" data-act="eventDiceRoll"${result ? ' hidden' : ''}>投掷骰子</button>
          <button type="button" class="ov-btn ok" data-act="eventDiceContinue"${result ? '' : ' hidden'}>确认结果，继续</button>
          <button type="button" class="ov-btn" data-act="eventDiceLeave">暂离，保留进度</button></div>` });
      const active = bind('eventDiceRoll');
      const current = () => token === sequence && !continued && active();
      setReturn?.(() => { if (token === sequence && !continued) render(); });
      UI.act('eventDiceLeave', () => { if (current() && !rolling) { sequence++; onLeave(); } });
      UI.act('eventDiceContinue', () => {
        if (!current() || rolling || !selected()) return;
        if (save() === false) { render('保存未成功，请重试确认；本次结果不会改变。'); return; }
        continued = true;
        done(selected().value);
      });
      UI.act('eventDiceRoll', async () => {
        if (!current() || rolling || step.result != null) return;
        rolling = true;
        if (!beforeRoll()) { rolling = false; render('当前无法投骰，请检查货币。'); return; }
        step.result = 1 + Math.floor(Random.random('event') * step.sides);
        // Persist payment and roll together before revealing the outcome.
        const saved = save();
        if (saved === false) {
          rolling = false;
          render('保存未成功，结果已保留在本局；请先重试保存。');
          return;
        }
        SDT.Sound?.sfx?.('scene');
        const die = UI.el?.ovBody?.querySelector('[data-event-die]');
        UI.el?.ovBody?.querySelectorAll('button').forEach(button => button.disabled = true);
        if (die && !SDT.Motion?.reduceMotion?.() && typeof die.animate === 'function') {
          const frames = Array.from({ length:19 }, (_, i) => {
            const t = i / 18, p = hopPoint(t, {x:0,y:0}, {x:0,y:0}, {height:74,curve:ease.smoother});
            return { transform:`translateY(${p.y}px) rotate(${t * 720}deg) scale(${1 + Math.sin(t * Math.PI) * .15})`, offset:t };
          });
          const animation = die.animate(frames, {duration:850,easing:'ease-out'});
          // Bounded fallback also covers interrupted or unavailable WAAPI completion.
          await Promise.race([animation.finished.catch(() => {}), new Promise(resolve => setTimeout(resolve, 1000))]);
        }
        rolling = false;
        if (current()) render();
      });
    }
    if (save() === false) { onLeave(); return false; }
    render();
    return true;
  }
  return { open };
}

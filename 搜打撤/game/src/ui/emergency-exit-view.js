import { illustratedChoiceHTML } from './illustrated-node.js';
import { roomFooterHTML } from './room-footer.js';
import '../../css/emergency-exit.css';

// Presentation for the existing third-layer event; payment stays with the run.
export function emergencyExitScene({ available = 0, coins = 0, locked = false } = {}) {
  const count = Math.max(0, Math.floor(Number(available) || 0));
  const canPay = !locked && count >= 3;
  const coinCount = Math.max(0, Math.floor(Number(coins) || 0));
  return {
    tone:'event', asset:'scene-extract-bg', icon:'[[icon:exit]]',
    title:locked ? '停用的撤离点' : '紧急撤离',
    sub:`<div class="emergency-exit-story">
      <p class="emergency-exit-kicker">第三层 · 撤离信标</p>
      <p class="emergency-exit-prose">${locked
        ? '信标沉寂在风雪里。只有第三层的撤离终端仍在工作。'
        : '风雪吞没了来路，信标仍亮着最后一束光。向终端献祭三张卡牌，就能带着剩余收获返回基地。'}</p>
      <div class="emergency-exit-payment" data-payment-ready="${canPay}">
        <div><span class="emergency-exit-label">启动代价</span><strong>3 <small>张卡牌</small></strong></div>
        <div class="emergency-exit-availability"><span class="emergency-exit-label">背包可献祭</span><b>${count} <small>张</small></b>
          <span class="emergency-exit-state">${locked ? '信标已停用' : canPay ? '可以启动' : `还需 ${3 - count} 张`}</span></div>
      </div>
      <p class="emergency-exit-scope">安全格及容器内卡牌需先移回普通背包。</p>
      ${coinCount ? `<p class="emergency-exit-coins">[[icon:coin]] 随身 ${coinCount} 币将在离局时清零。</p>` : ''}
    </div>`,
    body:`<div class="emergency-exit-options-head"><span>行动选择</span><small>选择后确认</small></div>${locked ? '' : illustratedChoiceHTML({
      action:'payExit', label:'启动撤离信标',
      detail:canPay ? '选择并献祭 3 张卡牌，带回剩余战利品。' : '先整理背包，凑齐 3 张可献祭的卡牌。',
      art:'leave', className:'evt-opt emergency-exit-option', disabled:!canPay,
      attrs:'data-cancel="false" data-choice-art="leave"',
    })}${illustratedChoiceHTML({ action:'stayHere', label:'继续深入',
      detail:'保留当前行装，返回地图继续探索。', art:'explore',
      className:'evt-opt emergency-exit-option', attrs:'data-cancel="true" data-choice-art="explore"' })}`,
    foot:roomFooterHTML({ tag:'div', className:'emergency-exit-footer',
      back:'<button class="ov-btn ghost" data-act="emergencyReturn">返回地图</button>',
      actions:'<button class="ov-btn" data-act="emergencyBag">整理背包</button>' }),
  };
}

export function emergencySacrificeHeader(selected, required) {
  return `<header class="emergency-sacrifice-head"><h3>献祭卡牌</h3>
    <div class="emergency-sacrifice-count" aria-live="polite"><span>已选</span><b data-sac-count>${selected}</b><span>/ ${required}</span></div></header>`;
}

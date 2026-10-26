import { esc } from '../core/shared.js';
import { uiDisclosure } from './ui-disclosure.js';
import '../../css/fire-rest.css';
import { illustratedChoiceHTML } from './illustrated-node.js';

// Read-only presentation; each action's usage and persistence belong to the caller.
/** @param {{heal: number, chance: number, restorable: number, fits: boolean, capacity: string, hp?: number, maxHp?: number, healUsed?: boolean, restoreUsed?: boolean, hpFull?: boolean, hpGain?: number, restoredCount?: number}} options */
export function fireRestDecisionHTML({ heal, chance, restorable, fits, capacity, hp = 0, maxHp = hp + heal, healUsed = false, restoreUsed = false, hpFull = false, hpGain = 0, restoredCount = 0 }) {
  const actualHeal = Math.max(0, Math.min(heal, maxHp - hp));
  const healLabel = healUsed ? `已回复 ${hpGain} 点` : hpFull ? '生命已满' : `${hp} → ${hp + actualHeal} · 实际回复 ${actualHeal}`;
  const restoreLabel = restoreUsed ? `已复原 ${restoredCount} 张` : !restorable ? '暂无可复原卡牌' : !fits ? '背包空间不足' : '随机复原至多 2 张';
  return `<section class="ui-design-system fire-rest-plan" aria-label="火堆操作">
    <div class="fire-rest-actions">
      ${illustratedChoiceHTML({action:'fireHeal',label:'回复生命',detail:healLabel,art:'heal',className:`fire-rest-option${healUsed ? ' is-used' : ''}`,disabled:healUsed || hpFull,attrs:`data-fire-preview="${esc(healLabel)}" aria-describedby="fire-effect-preview"`})}
      ${illustratedChoiceHTML({action:'fireRestore',label:'复原卡牌',detail:restoreLabel,art:'cards',className:`fire-rest-option${restoreUsed ? ' is-used' : ''}`,disabled:restoreUsed || !restorable || !fits,attrs:`data-fire-preview="${esc(restoreLabel)} · 消耗区 ${restorable} 张可复原" aria-describedby="fire-effect-preview"`})}
    </div>
    <div class="fire-effect-preview"><p id="fire-effect-preview" role="status">${esc(healUsed ? restoreLabel : healLabel)}</p><small>首次成功操作有 ${chance}% 概率额外获得职业卡；每处营火判定一次。</small></div>
    <p class="fire-rest-inline-capacity">生命 ${hp} / ${maxHp} · 背包 ${esc(capacity)}</p>
    ${uiDisclosure({ label:'休整说明', content:`<p>回血、复原各可使用一次；停留当前地点时可关闭面板或整理后继续。成功前往下一地点后，剩余机会作废，火堆不可重进。</p><p>首次成功操作有 ${chance}% 概率获得职业卡；每处火堆仅判定一次，额外职业卡放不下时不会获得。</p><p>复原从消耗区随机取至多 2 张可接收卡牌，不复原道具与装备。无法复原时不消耗机会。</p>` })}
  </section>`;
}

export function initFireRestPreview(root) {
  const output = root?.querySelector('#fire-effect-preview');
  if (!output) return;
  for (const button of root.querySelectorAll('[data-fire-preview]')) {
    const show = () => { output.textContent = button.dataset.firePreview; };
    button.addEventListener('pointerenter', show); button.addEventListener('focus', show);
  }
}

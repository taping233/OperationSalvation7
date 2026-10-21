import { esc } from '../core/shared.js';
import { uiDisclosure } from './ui-disclosure.js';
import '../../css/fire-rest.css';

// Read-only presentation; each action's usage and persistence belong to the caller.
/** @param {{heal: number, chance: number, restorable: number, fits: boolean, capacity: string, healUsed?: boolean, restoreUsed?: boolean, hpFull?: boolean, hpGain?: number, restoredCount?: number}} options */
export function fireRestDecisionHTML({ heal, chance, restorable, fits, capacity, healUsed = false, restoreUsed = false, hpFull = false, hpGain = 0, restoredCount = 0 }) {
  const healLabel = healUsed ? `已回复 ${hpGain} 点` : hpFull ? '生命已满' : `最多 +${heal} 生命`;
  const restoreLabel = restoreUsed ? `已复原 ${restoredCount} 张` : !restorable ? '暂无可复原卡牌' : !fits ? '背包空间不足' : '随机复原至多 2 张';
  return `<section class="ui-design-system fire-rest-plan" aria-label="火堆操作">
    <div class="fire-rest-actions">
      <button type="button" class="fire-rest-option${healUsed ? ' is-used' : ''}" data-act="fireHeal"${healUsed || hpFull ? ' disabled' : ''}><span class="fire-option-icon" aria-hidden="true">[[icon:heart]]</span><span class="fire-option-copy"><b>回复生命</b><small>${esc(healLabel)}</small></span><span class="fire-option-arrow" aria-hidden="true">${healUsed ? '✓' : '→'}</span></button>
      <button type="button" class="fire-rest-option${restoreUsed ? ' is-used' : ''}" data-act="fireRestore"${restoreUsed || !restorable || !fits ? ' disabled' : ''}><span class="fire-option-icon" aria-hidden="true">[[icon:archive]]</span><span class="fire-option-copy"><b>复原卡牌</b><small>${esc(restoreLabel)}</small></span><span class="fire-option-arrow" aria-hidden="true">${restoreUsed ? '✓' : '→'}</span></button>
    </div>
    <p class="fire-rest-inline-capacity">背包 ${esc(capacity)}</p>
    ${uiDisclosure({ label:'休整说明', content:`<p>回血、复原各可使用一次，返回地图后保留未用机会。</p><p>首次成功操作有 ${chance}% 概率获得职业卡；每处火堆仅判定一次，额外职业卡放不下时不会获得。</p><p>复原从消耗区随机取至多 2 张可接收卡牌，不复原道具与装备。无法复原时不消耗机会。</p>` })}
  </section>`;
}

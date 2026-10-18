import { esc } from '../core/shared.js';
import { uiDisclosure } from './ui-disclosure.js';

// Read-only presentation. The caller owns randomness, capacity checks and the one-shot transaction.
export function fireRestDecisionHTML({ heal, chance, restorable, fits, capacity }) {
  const capacityWarning = restorable && !fits ? '当前可复原卡均放不下，将复原 0 张。' : '实际复原数量受叠放与剩余容量限制。';
  return `<section class="ui-design-system fire-rest-plan" aria-label="休整收益与限制">
    <dl class="ui-facts"><div><dt>生命回复</dt><dd>最多 +${heal}</dd></div><div><dt>随机复原</dt><dd>至多 ${fits ? Math.min(2, restorable) : 0} 张</dd></div><div><dt>职业卡机会</dt><dd>${chance}%</dd></div></dl>
    <div class="fire-rest-capacity" role="status"><p>背包 <b>${esc(capacity)}</b> · 可复原 <b>${restorable} 张</b></p><p>${capacityWarning}</p></div>
    <p class="ui-risk">休整后本处机会即消耗；额外职业卡放不下时不会获得。</p>
    <button type="button" class="ui-action ui-action-primary" data-act="fireRestGo">休整 <span aria-hidden="true">→</span></button>
    ${uiDisclosure({ label:'休整说明', content:'<p>随机复原至多 2 张可复原卡牌；放不下的消耗卡保留在消耗区。</p><p>额外职业卡先尝试入包，再依照剩余容量复原卡牌。生命回复不超过上限。</p>' })}
  </section>`;
}

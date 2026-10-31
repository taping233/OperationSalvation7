import { esc, escAttr } from '../core/shared.js';
import '../../css/run-presentation.css';

const openings = {
  'tt6-mystery': { kind:'supply', title:'备用电源接通', line:'柜内的指示灯逐一亮起，封存的配给仍在等待领取。' },
  'tt6-chestdraw': { kind:'supply', title:'封存储备库', line:'灰尘下的电源灯还亮着，库门后的封条保持完整。' },
  'ev19-recode': { kind:'signal', title:'改装台待机', line:'备用屏幕亮起，机械臂停在等待指令的位置。' },
  altar: { kind:'altar', title:'沉睡的祭坛', line:'残存的纹路在暗处显现，中央仍是一片寂静。' },
  boss: { kind:'boss', title:'污染核心 · 封锁目标', line:'门后的守卫已经察觉到你。检查行装，再决定是否迎战。' },
};

// Presentation memory follows the current run object graph; no save, RNG or reward writes.
const shown = new WeakMap();
export function claimEncounterOpening(game, kind) {
  const token = game.discoveredPairs || game.layerData || game;
  let run = shown.get(game);
  if (!run || run.token !== token) { run = { token, keys:new Set() }; shown.set(game, run); }
  const key = `${game.layerIdx},${game.trackPos}:${kind}`;
  if (run.keys.has(key)) return false;
  run.keys.add(key);
  return true;
}

export function encounterOpeningHTML(id, { animate = false } = {}) {
  const spec = openings[id];
  if (!spec) return '';
  return `<section class="encounter-opening encounter-${escAttr(spec.kind)}${animate ? ' is-entering' : ''}" aria-label="遭遇提示">
    <span class="encounter-emblem" aria-hidden="true"><i></i><i></i><i></i></span>
    <div><b>${esc(spec.title)}</b><p>${esc(spec.line)}</p></div>
  </section>`;
}

export function commissionGoodsHTML(slots, stock) {
  return `<div class="commission-goods" aria-label="接应凭据兑付清单">${slots.map(index => {
    const slot = stock[index];
    return `<article class="commission-good"><span>第 ${index + 1} 格</span><b>${esc(slot.mystery ? '神秘货箱' : slot.card.name)}</b><div><del>待付款</del><strong>免费</strong></div></article>`;
  }).join('')}</div><p class="commission-receipt-note">运输员代付 · 商品仍在货架，进入商店后领取</p>`;
}

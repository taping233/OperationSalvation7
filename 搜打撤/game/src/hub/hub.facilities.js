import { esc } from '../core/shared.js';
import { MAP } from '../run/game.session.js';
import { facilityIllustration } from './hub.visuals.js';
import { linkedCostsHTML } from '../ui/home-linked-interactions.js';

let selected = 'bag';
export function logisticsTabsHTML(active) {
  return `<nav class="logistics-sections" aria-label="后勤分类">${[['shop', '补给'], ['upgrade', '扩建']].map(([id, name]) => `<button class="${active === id ? 'on' : ''}" data-act="hubTab" data-tab="${id}" aria-pressed="${active === id}">${name}</button>`).join('')}</nav>`;
}
export function selectFacility(id) { if (id === 'bag' || id === 'stash') selected = id; }
export function facilitiesHTML() {
  const base = window.SDT.Base, rules = MAP.rules;
  const facilities = [
    { id: 'bag', icon: 'bag', name: '出征背包', unit: '格', have: base.bagCap(), max: rules.bagMax, slots: 1, cost: rules.bagUpgradeWood, can: base.canUpgradeBag(), act: 'upBag', note: '增加本次出征可携带的卡牌种类。' },
    { id: 'stash', icon: 'archive', name: '基地仓库', unit: '格', have: base.stashCap(), max: rules.stashMax, slots: rules.stashUpgradeSlots, cost: rules.stashUpgradeWood, can: base.canUpgradeStash(), act: 'upStash', note: '卡牌每张、符文每块各占一个仓库格。' },
  ];
  const facility = facilities.find(item => item.id === selected);
  const maxed = facility.have >= facility.max;
  const runes = base.data.runes?.length || 0;
  const runeCost = facility.id === 'stash' && !maxed && facility.have >= (rules.stashRuneSlotFrom || 50) ? (rules.stashRuneSlotCost || 2) : 0;
  const why = maxed ? '已达上限' : [base.data.wood < facility.cost ? `木材不足，还需 ${facility.cost - base.data.wood}` : '', runes < runeCost ? `符文不足，还需 ${runeCost - runes}` : ''].filter(Boolean).join(' · ');
  return `<div class="facilities-v2 facilities-v12"><header class="camp-section-head"><h2>建设</h2><span>设施扩建</span></header>
    <div class="facility-layout"><nav class="facility-map" aria-label="可扩建设施">${facilities.map((item, index) => `<button type="button" class="facility-tile${selected === item.id ? ' on' : ''}" data-act="campFacility" data-id="${item.id}" aria-pressed="${selected === item.id}"><small>0${index + 1}</small><h3>${item.name}</h3><b>${item.have}<small> / ${item.max} ${item.unit}</small></b><span aria-hidden="true">›</span></button>`).join('')}</nav>
    <section class="facility-v12-stage" aria-label="${facility.name}"><div class="facility-v12-object">${facilityIllustration(facility.id)}</div><div class="facility-v12-caption"><h3>${facility.name}</h3><p>${facility.note}</p><div class="facility-track"><i style="width:${facility.have / facility.max * 100}%"></i></div><span>${maxed ? '建设完成' : facility.can ? '材料齐备 · 可扩建' : '等待材料'}</span></div></section>
    <aside class="facility-details"><header><span>设施扩建</span><h3>${facility.name}</h3></header><div class="facility-benefit"><div class="facility-capacity"><span>当前容量</span><b>${facility.have}<small> ${facility.unit}</small></b></div><span class="facility-change-arrow" aria-hidden="true">→</span><div class="facility-capacity"><span>${maxed ? '容量上限' : '扩建后容量'}</span><b>${Math.min(facility.max, facility.have + (maxed ? 0 : facility.slots))}<small> ${facility.unit}</small></b></div></div><div class="facility-v12-costs"><h4>${maxed ? '持有材料' : '扩建材料'}</h4>${linkedCostsHTML([{name: "木材", have: base.data.wood, need: maxed ? null : facility.cost}, ...(runeCost ? [{name: "符文", have: runes, need: runeCost}] : [])])}</div><div class="facility-v12-confirm"><button class="mini-btn ok base-command base-command-primary" data-act="${facility.act}"${why ? ' aria-describedby="facility-upgrade-reason"' : ''}${facility.can ? '' : ' disabled'}><span class="base-command-label">${maxed ? '建设完成' : '确认扩建'}</span><span class="base-command-arrow" aria-hidden="true">→</span></button>${why ? `<p class="hint" id="facility-upgrade-reason" role="status">${esc(why)}</p>${base.data.wood < facility.cost && !maxed ? '<button class="base-link source-link" data-act="hubTab" data-tab="shop" data-trade-mode="buy">交易所补充木材 →</button>' : ''}` : ''}</div></aside></div></div>`;
}

import { esc } from '../core/shared.js';
import { MAP } from '../run/game.session.js';
import { facilityIllustration } from './hub.visuals.js';
import { linkedCostsHTML } from '../ui/home-linked-interactions.js';

let selected = 'bag';
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
  return `<div class="facilities-v2"><header class="camp-section-head"><small>DEVELOPMENT / 扩建</small><h2>基地建设</h2></header>
    <div class="camp-upgrade-reserve"><span>建设储备</span><span>[[icon:wood]] 木材 <b>${base.data.wood}</b></span><span>[[icon:crystal]] 符文 <b>${runes}</b></span></div>
    <div class="facility-layout"><section class="facility-map" aria-label="可扩建设施">${facilities.map(item => `<button type="button" class="facility-tile${selected === item.id ? ' on' : ''}" data-act="campFacility" data-id="${item.id}" aria-pressed="${selected === item.id}">${facilityIllustration(item.id)}<small>${item.id === 'bag' ? 'FIELD STORAGE' : 'BASE STORAGE'}</small><h3>${item.name}</h3><b>${item.have}<small> / ${item.max} ${item.unit}</small></b><div class="facility-track"><i style="width:${item.have / item.max * 100}%"></i></div><span>${selected === item.id ? '正在查看' : '查看扩建'}</span></button>`).join('')}<div class="facility-partners"><span>伙伴的安全格由独立培养决定。</span><button class="mini-btn" data-act="hubTab" data-tab="classes" data-group="pets">[[icon:paw]] 前往伙伴培养</button></div></section>
    <aside class="facility-details"><small>EXPANSION / ${selected.toUpperCase()}</small><h3>${facility.name}</h3><p>${facility.note}</p><div class="facility-benefit"><span>${maxed ? '容量上限' : '本次扩建'}</span><b>${maxed ? facility.have : `${facility.have}<span> → </span>${Math.min(facility.max, facility.have + facility.slots)}`}<small> ${facility.unit}</small></b></div>${linkedCostsHTML([{name: "木材", have: base.data.wood, need: maxed ? null : facility.cost}, ...(runeCost ? [{name: "符文", have: runes, need: runeCost}] : [])])}<button class="mini-btn ok" data-act="${facility.act}"${facility.can ? '' : ' disabled'}>${maxed ? '建设完成' : `[[icon:wood]] ×${facility.cost}${runeCost ? ` · 符文 ×${runeCost}` : ''} 确认扩建`}</button>${why ? `<p class="hint" role="status">${esc(why)}</p>` : ''}</aside></div></div>`;
}

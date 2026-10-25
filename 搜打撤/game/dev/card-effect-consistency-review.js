import SDT, { sdtDefine } from '../src/core/sdt-facade.js';
import '../src/core/icons-bitmap.js';
import '../src/core/art.js';
import { rulesSlice } from '../src/cards/cards.rules.js';
import { dataSlice } from '../src/cards/cards.data.js';
import { cardHTML } from '../src/cards/cards.view.js';
import { registerBattleValueProvider } from '../src/cards/battle-value-context.js';

// Pure production presentation with source definitions. No main.js, engine or storage API.
const catalog = Object.values(dataSlice).filter(Array.isArray).flat();
sdtDefine('Cards', { ...rulesSlice, all: () => catalog, cardHTML });
const ids = ['tt12-unstableray', 'tt7-burnharvest', 'tt7-holyheal'];
function render(battle) {
  registerBattleValueProvider(() => battle ? { active: true, atk: 5, spellPower: 2 } : null);
  document.getElementById('samples').innerHTML = SDT.Icons.rich(ids.map(id => {
    const card = catalog.findLast(candidate => candidate.id === id);
    const options = battle && card.dmgType === 'spell' ? { dmgOverride: { bonus: 2 } } : {};
    return `<section class="sample" data-card-id="${id}"><h2>${card.name}</h2>${cardHTML(card, 'sm', options)}</section>`;
  }).join(''));
  document.getElementById('status').textContent = battle
    ? '当前法伤加成 +2：射线应显示 6–8；爆燃火球正文与角标均为 9；圣疗使用“费用”。'
    : '无战斗加成：射线显示 4–6；爆燃火球显示 5；圣疗使用“费用”。';
}
document.getElementById('staticMode').addEventListener('click', () => render(false));
document.getElementById('battleMode').addEventListener('click', () => render(true));
render(new URL(location.href).searchParams.get('mode') !== 'static');

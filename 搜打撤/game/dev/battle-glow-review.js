import SDT, { sdtDefine } from '../src/core/sdt-facade.js';
import '../src/core/icons-bitmap.js';
import '../src/core/art.js';
import { rulesSlice } from '../src/cards/cards.rules.js';
import { dataSlice } from '../src/cards/cards.data.js';
import { cardHTML } from '../src/cards/cards.view.js';

// Production card faces with fixed presentation states. No engine or save access.
const catalog = Object.values(dataSlice).filter(Array.isArray).flat();
sdtDefine('Cards', { ...rulesSlice, all:() => catalog, cardHTML });
const base = catalog.find(card => card.id === 'tt3-ice-spike');
const samples = [
  ['原卡', base],
  ['临时生成', { ...base, _presentation:{ temporary:true } }],
  ['随动变形', { ...base, _presentation:{ transforming:true } }],
  ['临时生成＋变形', { ...base, _presentation:{ temporary:true, transforming:true } }],
];
const stage = document.querySelector('#glowStage');
stage.innerHTML = samples.map(([label, card]) => `<section class="sample"><h2>${label}</h2>${cardHTML(card)}</section>`).join('');
stage.innerHTML = SDT.Icons.rich(stage.innerHTML);
document.querySelector('#battleGlow').addEventListener('change', event => {
  stage.classList.toggle('battle-stage', event.target.checked);
});
document.querySelector('#reduceMotion').addEventListener('change', event => {
  document.body.classList.toggle('reduce-motion', event.target.checked);
});

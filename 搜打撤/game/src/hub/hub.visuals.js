import { assetUrl } from '../core/asset-url.js';
const paintedIcons = new Set(['warehouse', 'expedition', 'wood', 'rations', 'key', 'coin', 'personnel', 'shop', 'archive', 'rune']);
const resourceIconsE = new Set(['wood', 'rations', 'key', 'coin']);
export function baseIcon(id, fallback = 'archive') {
  return paintedIcons.has(id) ? `<img class="base-painted-icon" src="${assetUrl(`assets/icons/${resourceIconsE.has(id) ? 'base-v12' : 'base-v3'}/${id}.webp`)}" alt="" aria-hidden="true">` : window.SDT.Icons.img(fallback);
}
const portraits = {
  dog: '<path d="M63 76 39 51Q17 92 43 133l20-16m114-41 24-25q22 41-4 82l-20-16" fill="var(--pet-dark)"/><path d="M61 89q0-40 59-40t59 40v59q-7 39-59 40-52-1-59-40Z" fill="var(--pet-light)"/><path d="M67 89q9-38 35-29l-1 46q-18 16-34-2" fill="var(--pet-dark)"/><ellipse cx="120" cy="149" rx="39" ry="29" fill="var(--pet-paper)"/><path d="m107 139 13 12 13-12Z" fill="var(--pet-dark)"/><path d="M120 151v13m0-1q-12 13-23 0m23 0q12 13 23 0"/><circle cx="86" cy="114" r="5"/><circle cx="154" cy="114" r="5"/><path d="M77 179q43 16 86 0l-5 17H82Z" fill="var(--pet-accent)"/>',
  falcon: '<path d="M39 144q14-69 56-86l23 26q-4-35 40-47-6 25 3 43 42 13 36 57l-39-7-16 59-35-12-22-36Z" fill="var(--pet-dark)"/><path d="m105 90 52-5q21 7 17 27l-29 15-23 38-30-25Z" fill="var(--pet-light)"/><path d="m152 116 45 8-24 22-29-12" fill="var(--pet-accent)"/><path d="m71 139 26-37m-18 54 20-25m13 39 17-24"/><circle cx="151" cy="99" r="5" fill="var(--pet-dark)"/>',
  cat: '<path d="m65 91-6-48 48 23h27l48-23-7 48q15 18 15 49-3 49-70 49-67 0-70-49 0-31 15-49Z" fill="var(--pet-light)"/><path d="m69 71 10-6 15 17m52 0 15-17 10 6" fill="var(--pet-accent)"/><path d="m76 117 18-4m52 0 18 4m-104 21-22-6m24 19-25 4m143-17 22-6m-24 19 25 4"/><path d="m109 137 11 10 11-10Z" fill="var(--pet-dark)"/><path d="M120 147v11m0 0q-10 9-19 0m19 0q10 9 19 0"/><circle cx="120" cy="184" r="15" fill="var(--pet-accent)"/><path d="M120 178v12"/>',
  robot: '<path d="M120 43V29"/><circle cx="120" cy="23" r="6" fill="var(--pet-accent)"/><rect x="55" y="51" width="130" height="116" rx="22" fill="var(--pet-light)"/><path d="M55 91H39v41h16m130-41h16v41h-16" fill="var(--pet-dark)"/><rect x="72" y="76" width="96" height="43" rx="10" fill="var(--pet-dark)"/><path d="m87 96 10-6 10 6m26 0 10-6 10 6" stroke="var(--pet-accent)"/><path d="M90 141h60m-37-4v9m14-9v9"/><path d="m71 170-15 27h128l-15-27" fill="var(--pet-dark)"/><path d="M98 185h44" stroke="var(--pet-accent)"/>',
  fire: '<path d="M121 34q11 37 45 51-4-19 1-29 15 19 20 33 35 51-4 91-24 26-63 26-62 0-74-55-7-34 28-62-1 27 16 34 35-42 31-89Z" fill="var(--pet-accent)"/><path d="M119 100q-23 28-35 44-20 38 35 42 57-7 32-43-6 17-16 13-4-34-16-56Z" fill="var(--pet-light)"/><path d="m90 155 10 3m40 0 10-3m-40 14q10 8 20 0"/>',
  penguin: '<path d="M67 103q0-64 53-64t53 64v57q-3 38-53 38t-53-38Z" fill="var(--pet-dark)"/><path d="M93 79q13-18 27 0 14-18 27 0l11 50q13 53-38 53-51 0-38-53Z" fill="var(--pet-paper)"/><path d="m102 114 18 16 18-16Z" fill="var(--pet-accent)"/><circle cx="102" cy="98" r="5"/><circle cx="138" cy="98" r="5"/><path d="m64 128-23 37m135-37 23 37M76 196h32m24 0h32"/><path d="M72 142q48 17 96 0l-2 13q-44 17-92 0Z" fill="var(--pet-accent)"/>'
};
export function partnerPortrait(id) {
  if (['dog', 'falcon', 'cat', 'robot', 'fire', 'penguin'].includes(id)) return `<img class="companion-art companion-${id}" src="${assetUrl(`assets/icons/base-v3/companion-${id}.webp`)}" alt="" aria-hidden="true">`;
  return `<svg class="companion-art companion-${id in portraits ? id : 'dog'}" viewBox="0 0 240 240" aria-hidden="true" fill="none" stroke="var(--pet-dark)" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"><circle cx="120" cy="120" r="111" stroke="currentColor" stroke-opacity=".18" stroke-width="2"/><path d="M10 120h17m186 0h17M120 10v17m0 186v17" stroke="currentColor" stroke-opacity=".3" stroke-width="2"/>${portraits[id] || portraits.dog}</svg>`;
}
export function materialIllustration(kind) {
  const card = window.SDT.Cards?.all?.().find(item => item.id === (kind === 'wood' ? 'tt-wood' : 'tt-rations'));
  if (card && window.SDT.Art?.cardIcon) return `<span class="supply-card-art">${window.SDT.Art.cardIcon(card, { low: true })}</span>`;
  const body = kind === 'wood'
    ? '<path d="m37 81 65-26 104 30-63 30Z" fill="#bba778"/><path d="M37 81v78l106 36v-80Z" fill="#7b6950"/><path d="M143 115v80l63-31V85Z" fill="#a38a62"/><path d="m62 90 66 22m-66-1 66 22m-66-1 66 22m-66-1 66 22m37-61 21-11m-21 32 21-11m-21 32 21-11"/><path d="m67 68 103 32v81m-33-119-60 26v83" stroke="#314753" stroke-width="10"/>'
    : '<path d="M75 58h92l-9 32 24 47 5 53H52l5-53 26-47Z" fill="#cfb779"/><path d="M77 89h83l-5 76H85Z" fill="#e8dfc0"/><path d="M68 53h107v19H68Z" fill="#526874"/><path d="m83 128 21-19 31 14 18-17m-34-15v71m-18-30 18 12 20-14"/><path d="M70 191h99" stroke="#314753" stroke-width="10"/>';
  return `<svg class="supply-illustration" viewBox="0 0 240 240" aria-hidden="true" fill="none" stroke="#526874" stroke-width="3" stroke-linejoin="round"><path d="M24 204h192M34 215h172" stroke-opacity=".2"/>${body}</svg>`;
}
export function facilityIllustration(id) {
  const art = id === 'bag' ? '<rect x="77" y="58" width="91" height="143" rx="16"/><path d="M92 56V39q29-20 59 0v17m-75 73H55v64h24m89-64h22v64h-22"/><rect x="92" y="127" width="61" height="51" rx="5"/><path d="M103 95h40m-51 20h61"/>' : '<path d="M39 61h161v136H39Zm0 45h161M39 151h161M61 61v136m116-136v136"/><path d="M76 70h42v28H76Zm58 0h26v28h-26M76 117h84v27H76Zm0 45h28v26H76Zm41 0h43v26h-43"/>';
  return `<svg class="facility-art" viewBox="0 0 240 240" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"><path d="M20 213h200" stroke-opacity=".25"/>${art}</svg>`;
}

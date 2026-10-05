// Original vector artwork: a common cut-corner seal, five distinct archive motifs.
// The canvas outside the seal is transparent. No external assets are required.
function seal(motif) {
  return `<svg class="ic slot-ico" viewBox="0 0 144 144" aria-hidden="true">
    <path d="M36 8h72l28 28v72l-28 28H36L8 108V36Z" fill="#1b3442" stroke="#d8bd84" stroke-width="3" stroke-linejoin="round"/>
    <path d="M38 17h68l21 21v68l-21 21H38l-21-21V38Z" fill="none" stroke="#819c9d" stroke-width="1.5"/>
    <g stroke-linecap="round" stroke-linejoin="round">${motif}</g>
    <path d="m72 118 4 4-4 4-4-4Z" fill="#d8bd84"/>
  </svg>`;
}

export const SLOT_EMBLEMS = Object.freeze([
  // Crossed blades: broad ivory cutting faces and warm brass guards.
  seal(`<path d="m33 29 11 4 49 49-11 11-49-49Z" fill="#f0eee2"/>
    <path d="m111 29-11 4-49 49 11 11 49-49Z" fill="#f0eee2"/>
    <path d="m41 39 45 45M103 39 58 84" fill="none" stroke="#83a3a8" stroke-width="3"/>
    <path d="m46 87 17 17M98 87l-17 17M57 98l-10 10M87 98l10 10" fill="none" stroke="#d8bd84" stroke-width="5"/>
    <path d="m72 59 13 13-13 13-13-13Z" fill="#1b3442" stroke="#d8bd84" stroke-width="3"/>`),
  // Witch's hat: bent crown, layered brim and a floating star.
  seal(`<path d="M41 85C50 63 54 44 73 29l22 9-17 5 23 42Z" fill="#f0eee2"/>
    <path d="m52 69 40-6 7 15-53 9Z" fill="#d8bd84"/>
    <path d="M31 85c24-10 57-10 83 0l-5 10c-27 9-50 9-74 0Z" fill="#f0eee2" stroke="#1b3442" stroke-width="3"/>
    <path d="m105 37 4 10 10 4-10 4-4 10-4-10-10-4 10-4Z" fill="#d8bd84"/>
    <path d="m61 74 12-2 3 10-13 2Z" fill="#1b3442"/>`),
  // Tower: crenellations, an arched gate and a small pennant.
  seal(`<path d="M42 39h12v10h11V39h14v10h11V39h12v23h-7v45H49V62h-7Z" fill="#f0eee2"/>
    <path d="M45 62h54M48 108h50" fill="none" stroke="#d8bd84" stroke-width="5"/>
    <path d="M65 108V94a7 9 0 0 1 14 0v14ZM57 73h7v10h-7ZM82 73h7v10h-7Z" fill="#1b3442"/>
    <path d="M91 37V23" stroke="#d8bd84" stroke-width="3"/>
    <path d="m92 23 20 6-20 6Z" fill="#d8bd84"/>`),
  // Greatsword and coffee: a strong central blade with a smaller companion motif.
  seal(`<path d="m72 24 14 20v42H58V44Z" fill="#f0eee2"/>
    <path d="M72 39v44" stroke="#83a3a8" stroke-width="3"/>
    <path d="M49 86h46v10H49ZM66 96h12v15H66Z" fill="#d8bd84"/>
    <path d="M93 93h18v10a9 9 0 0 1-18 0Z" fill="#f0eee2"/>
    <path d="M111 95h3a5 5 0 0 1 0 10h-3M99 87l-2-5M105 87l2-5" fill="none" stroke="#d8bd84" stroke-width="3"/>`),
  // Moon and lantern: broad crescent, four-point star and a hanging light.
  seal(`<path d="M84 28a40 40 0 1 0 25 58 32 32 0 1 1-25-58Z" fill="#d8bd84"/>
    <path d="m101 34 5 12 12 5-12 5-5 12-5-12-12-5 12-5Z" fill="#f0eee2"/>
    <path d="M61 77v11M53 88h16l5 8-8 14H56l-8-14Z" fill="none" stroke="#f0eee2" stroke-width="3"/>
    <path d="m61 92 5 6-5 7-5-7Z" fill="#f0eee2"/>`),
]);

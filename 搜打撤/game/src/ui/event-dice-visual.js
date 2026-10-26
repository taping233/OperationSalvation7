// Original CSS cube implementation; visual reference: github.com/Vaibh31/Rolling-dice.
// Animation consumes the saved result and never draws gameplay randomness.
const rotations = [[0,0],[-90,0],[0,-90],[0,90],[90,0],[0,180]];
const pips = [[5],[1,9],[1,5,9],[1,3,7,9],[1,3,5,7,9],[1,3,4,6,7,9]];
const pose = (value, extra = 0) => {
  const [x,y] = rotations[(value || 1) - 1] || rotations[0];
  return `rotateX(-32deg) rotateY(-20deg) rotateX(90deg) rotateX(${x + extra}deg) rotateY(${y + extra * 1.5}deg)`;
};

/** @param {number} sides @param {number | null} result */
export function eventDieHTML(sides, result) {
  const cube = sides === 6;
  const faces = cube ? pips.map((dots,i) => `<span class="event-die-face event-die-face-${i + 1}">${dots.map(dot => `<i style="grid-area:${Math.ceil(dot / 3)}/${(dot - 1) % 3 + 1}"></i>`).join('')}</span>`).join('') : `<span class="event-die-number">${result || '？'}</span>`;
  return `<div class="event-dice-stage${cube ? '' : ' event-dice-poly'}" data-event-die role="img" aria-label="${result ? `骰子 ${result} 点` : `D${sides}，尚未投骰`}"><span class="event-dice-shadow"></span><div class="event-dice-hop"><div class="event-die${cube ? ' event-die-cube' : ''}" style="transform:${cube ? pose(result) : 'none'}">${faces}</div></div><span class="event-dice-kind">D${sides}</span></div>`;
}

/** @param {HTMLElement} stage @param {number} sides @param {number} result */
export async function animateEventDie(stage, sides, result) {
  const die = /** @type {HTMLElement} */ (stage?.querySelector('.event-die'));
  const hop = /** @type {HTMLElement} */ (stage?.querySelector('.event-dice-hop'));
  if (!die || !hop || typeof die.animate !== 'function') return;
  const cube = sides === 6;
  const target = cube ? pose(result,720) : 'rotateZ(720deg)';
  const spin = die.animate([
    {transform:cube ? pose(1) : 'rotateZ(0deg)',offset:0},
    {transform:cube ? pose(4,360) : 'rotateZ(480deg)',offset:.55},
    {transform:target,offset:1},
  ], {duration:1250,easing:'cubic-bezier(.16,.65,.28,1)',fill:'forwards'});
  const bounce = hop.animate([
    {transform:'translate3d(-65px,0,0) scale(.92)',offset:0},
    {transform:'translate3d(-28px,-72px,0) scale(1.08)',offset:.28},
    {transform:'translate3d(12px,0,0) scale(1.08,.9)',offset:.65},
    {transform:'translate3d(5px,-18px,0) scale(.97,1.03)',offset:.78},
    {transform:'translate3d(0,0,0) scale(1)',offset:1},
  ], {duration:1250,easing:'ease-in-out',fill:'forwards'});
  const shadow = stage.querySelector('.event-dice-shadow')?.animate([
    {opacity:.5,transform:'translateX(-40px) scale(.8)'},
    {opacity:.16,transform:'scale(1.35)',offset:.28},
    {opacity:.65,transform:'translateX(8px) scale(1.1)',offset:.65},
    {opacity:.5,transform:'scale(1)'},
  ], {duration:1250,fill:'forwards'});
  let timer;
  try {
    await Promise.race([spin.finished.catch(() => {}),new Promise(resolve => { timer = setTimeout(resolve,1450); })]);
    die.style.transform = cube ? pose(result) : 'none';
    if (!cube) die.querySelector('.event-die-number').textContent = String(result);
  } finally {
    clearTimeout(timer); spin.cancel(); bounce.cancel(); shadow?.cancel();
  }
}

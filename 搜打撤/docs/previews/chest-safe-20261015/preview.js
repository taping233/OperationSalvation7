const assets = '../../../game/assets/scenes/chests/safe-simple-v7/';
const frameUrls = [0,1,2,3].map(index => new URL(`${assets}frame-0${index}.webp`,import.meta.url).href);
const fxUrl = new URL(`${assets}burst.webp`,import.meta.url).href;
const root = document.querySelector('.opening');
const current = document.querySelector('.current');
const previous = document.querySelector('.previous');
const burst = document.querySelector('.burst');
const status = document.querySelector('.phase');
const replay = document.querySelector('#replay');
const poses = [...document.querySelectorAll('[data-pose]')];
const labels = ['封存中','锁定解除','物资匣开启','物资已解锁'];
const reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;
const timers = new Set();
let sequence = 0, frame = 0;
const later = (delay, fn, token = sequence) => {
  const timer = setTimeout(() => { timers.delete(timer); if(token === sequence) fn(); },delay);
  timers.add(timer);
};
function cancel() { sequence++; timers.forEach(clearTimeout); timers.clear(); }
function showFrame(index, phase = 'still') {
  previous.src = frameUrls[frame]; current.style.opacity = '0';
  current.src = frameUrls[index]; frame = index; current.alt = `保险箱：${labels[index]}`;
  root.dataset.phase = phase; root.dataset.frame = String(index); status.textContent = labels[index];
  poses.forEach((button,i) => button.setAttribute('aria-pressed',String(i === index)));
  requestAnimationFrame(() => { current.style.opacity = '1'; });
}
function sound(name) {
  if(!document.querySelector('#sound').checked || reduced) return;
  const audio = new Audio(`/assets/sfx/battle/${name}-1.ogg`);
  audio.volume = name === 'chestshake' ? .4 : .5;
  audio.play().catch(() => {});
}
function play() {
  cancel(); showFrame(0,'charge');
  if(reduced) { showFrame(3,'settle'); return; }
  sound('chestshake');
  later(650,() => showFrame(1,'opening'));
  later(810,() => showFrame(2,'opening'));
  later(1010,() => { showFrame(3,'burst'); sound('chestburst'); });
  later(1600,() => { root.dataset.phase = 'settle'; sound('reveal'); });
}
replay.addEventListener('click',play);
poses.forEach(button => button.addEventListener('click',() => { cancel(); showFrame(Number(button.dataset.pose)); }));
window.addEventListener('pagehide',cancel,{once:true});
burst.src = fxUrl;
try {
  await Promise.all([...frameUrls,fxUrl].map(async src => { const image = new Image(); image.src = src; await image.decode(); }));
  showFrame(0); replay.disabled = false;
} catch(error) { status.textContent = '素材加载失败，请重载预览'; console.error(error); }

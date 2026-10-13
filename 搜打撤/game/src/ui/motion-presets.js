/* 界面动效唯一参数来源；业务计时、转场跳过和路由仍由各自模块负责。 */
export const motionTiming = Object.freeze({
  pageEnter: 500, regionEnter: 360, change: 280, detailEnter: 320,
  exit: 180, feedback: 180, fastEnter: 180, fastExit: 110,
  stagger: 35, staggerMax: 105,
});
export const motionEasing = Object.freeze({
  enter: 'cubic-bezier(.22,1,.36,1)',
  exit: 'cubic-bezier(.4,0,.7,1)',
});
export function motionReduced() {
  return document.body.classList.contains('reduce-motion')
    || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
export function changeFrames(direction = 0) {
  return [
    { opacity: .6, transform: direction ? `translateX(${Math.sign(direction) * 10}px)` : 'translateY(6px)' },
    { opacity: 1, transform: 'none' },
  ];
}
if (typeof document !== 'undefined') {
  for (const [key, value] of Object.entries(motionTiming)) {
    const name = key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
    document.documentElement.style.setProperty(`--motion-${name}`, `${value}ms`);
  }
  document.documentElement.style.setProperty('--motion-ease-enter', motionEasing.enter);
  document.documentElement.style.setProperty('--motion-ease-exit', motionEasing.exit);
}

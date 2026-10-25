import { createCityCut, playPreparedCut } from './camp-entry.js';
import { waitPageVisual } from './page-visual-ready.js';
import { motionReduced } from './motion-presets.js';
import { linkedAnimate } from './home-linked-interactions.js';
import { pageMotionProfile, pageMotionBlocks } from './page-motion-profiles.js';
import { baseNavigationTiming, baseNavigationEasing } from './navigation-motion.js';
import { transitionFrame } from './transition-handoff.js';
import { createDepartureCinematic } from './departure-cinematic.js';
import '../../css/expedition-transitions.css';

let handoff = null;
// 遮层先于 newRun 挂载，地图初始化与整备关层都在遮层下发生。
export function startDepartureHandoff(start, source, kind = 'departure') {
  if (handoff) return handoff.promise;
  const cinematic = createDepartureCinematic(kind);
  const curtain = cinematic.element;
  const previousFocus = /** @type {HTMLElement} */ (document.activeElement);
  document.body.append(curtain);
  const skipButton = curtain.querySelector('button');
  skipButton.focus({ preventScroll:true });
  const block = event => {
    if (event.key === 'Escape' || event.key === ' ' || (event.key === 'Enter' && event.target === skipButton)) cinematic.skip();
    if (event.key === 'Tab') skipButton.focus({ preventScroll:true });
    event.preventDefault(); event.stopImmediatePropagation();
  };
  window.addEventListener('keydown', block, true);
  const operation = { promise: null };
  handoff = operation;
  const delay = ms => new Promise((/** @type {(value?: void) => void} */ resolve) => setTimeout(resolve, ms));
  operation.promise = (async () => {
    try {
      if (!motionReduced()) await delay(160);
      if (source && !source.isConnected) return false;
      const playback = cinematic.play();
      const result = await start();
      if (result === false) return false;
      if (result !== false) {
        await waitPageVisual(document.getElementById('viewport'), { background: window.SDT?.UI?._pageBgReady });
        const game = window.SDT?.game;
        if (game?.runActive && game.state === 'idle' && !game.battleActive && !game.nestActive) {
          await window.SDT.Renderer?.prepare?.(game, () => handoff === operation);
        }
      }
      // 给已挂载过场/地图两个绘制机会；后台窗口仍有时间上限。
      await transitionFrame();
      await playback;
      await cinematic.reveal();
      return result !== false;
    } finally {
      cinematic.dispose();
      window.removeEventListener('keydown', block, true);
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll:true });
      if (handoff === operation) handoff = null;
    }
  })();
  return operation.promise;
}

// The receipt has already committed before this decorative result entrance.
export function playExtractionCinematic(source) {
  return startDepartureHandoff(() => true, source, 'extraction');
}

// 人物与整备是同一流程的相邻步骤，滑动只作用于内容，不重播入口遮幕。
export function enterDepartureStep(page, direction = 1) {
  if (!page?.isConnected || motionReduced()) return;
  const profile = pageMotionProfile(page.parentElement);
  const regions = profile ? pageMotionBlocks(profile, true) : [];
  const targets = regions.length ? regions : [{ el: page, delay: 0 }];
  targets.forEach(({ el }, index) => {
    // Stop this region's generic entrance; descendant idle animations remain active.
    el.getAnimations?.().forEach(animation => animation.cancel());
    linkedAnimate(el, [
      { transform: `translateX(${(Math.sign(direction) || 1) * 96}px)` },
      { transform: 'none' },
    ], { duration: baseNavigationTiming.detail, delay: Math.min(index * baseNavigationTiming.stagger, baseNavigationTiming.staggerMax), easing: baseNavigationEasing, fill: 'backwards' });
  });
}

// 首次进入流程仍保留入口反馈，不等待或接管业务输入。
export function enterDepartureCut(page) {
  const overlay = page?.closest('#overlay');
  const card = page?.closest('.card');
  if (motionReduced() || !overlay || !card) return;
  const cut = createCityCut({ archive: '出征档案', title: '出征整备',
    subtitle: 'DEPARTURE / 人物与携带准备', destination: 'DEPARTURE', watermark: 'PREPARE' });
  playPreparedCut(page, cut);
}

import '../../css/base-chibi.css';
import { motionReduced } from '../ui/motion-presets.js';
import { CHIBI_GAIT } from './base-chibi-gait.js';
import { createChibiSkin } from './base-chibi-skin.js';

const parts = Object.freeze({
  head: new URL('../../assets/chibi/wu-v1/head.webp', import.meta.url).href,
  hair: new URL('../../assets/chibi/wu-v1/hair.webp', import.meta.url).href,
  body: new URL('../../assets/chibi/wu-v1/body.webp', import.meta.url).href,
  armBack: new URL('../../assets/chibi/wu-v1/arm-back.webp', import.meta.url).href,
  armFront: new URL('../../assets/chibi/wu-v1/arm-front.webp', import.meta.url).href,
  legBack: new URL('../../assets/chibi/wu-v1/leg-back.webp', import.meta.url).href,
  legFront: new URL('../../assets/chibi/wu-v1/leg-front.webp', import.meta.url).href,
  sword: new URL('../../assets/chibi/wu-v1/sword.webp', import.meta.url).href,
});
const part = (name, file) => `<img class="chibi-part chibi-${name}" src="${parts[file]}" alt="" draggable="false">`;

export function baseChibiHTML({ version = 'v1' } = {}) {
  if (version === 'v2') return `<div class="base-chibi-lane" aria-label="基地小人"><button type="button" class="base-chibi" data-version="v2" data-state="idle" aria-label="和无打招呼" title="点我打个招呼">
    <span class="chibi-shadow" aria-hidden="true"></span><span class="chibi-facing" aria-hidden="true"><span class="chibi-scale">
    <img class="chibi-v2-source" src="${new URL('../../assets/chibi/wu-v2/setup.webp',import.meta.url).href}" alt="" draggable="false">
    </span></span><span class="chibi-speech" role="status" aria-live="polite"></span></button></div>`;
  return `<div class="base-chibi-lane" aria-label="基地小人">
    <button type="button" class="base-chibi" aria-label="和无打招呼" title="点我打个招呼" data-state="idle">
      <span class="chibi-shadow" aria-hidden="true"></span>
      <span class="chibi-facing" aria-hidden="true"><span class="chibi-scale"><span class="chibi-rig">
        ${part('hair', 'hair')}${part('sword', 'sword')}${part('arm-back', 'armBack')}
        ${part('leg-back', 'legBack')}${part('leg-front', 'legFront')}${part('body', 'body')}
        ${part('head', 'head')}${part('arm-front', 'armFront')}
      </span></span></span>
      <span class="chibi-speech" role="status" aria-live="polite"></span>
    </button>
  </div>`;
}

// Display-only paper doll. No save, economy or combat state is changed.
export function mountBaseChibi(root, { motion = 'auto', startAt = 0, skin = false, rest = false, pose = null } = {}) {
  const lane = root?.querySelector('.base-chibi-lane');
  const button = lane?.querySelector('.base-chibi');
  if (!button) return () => {};
  const overlay = root.closest('#overlay');
  const speech = button.querySelector('.chibi-speech');
  const controller = new AbortController();
  let frame = 0, disposed = false, last = 0, elapsed = 0;
  let player = null, poseTime = 0, distance = 0, walkBlend = 0, reactionTime = -1;
  const scale = Math.max(1, button.offsetWidth / 150);
  let x = Math.max(0, lane.clientWidth - button.offsetWidth) * Math.max(0, Math.min(1, startAt));
  let direction = 1, state = motion === 'walk' ? 'walk' : 'idle', waiting = 2400, greeting = 0;
  button.dataset.state = state;
  let hovering = false, focused = false;
  const setState = next => { state = next; button.dataset.state = next; };
  const draw = () => {
    button.style.setProperty('--chibi-x', `${x}px`);
    button.style.setProperty('--chibi-facing', String(direction));
  };
  const dispose = () => {
    disposed = true;
    cancelAnimationFrame(frame);
    controller.abort();
    player?.dispose(); player = null;
  };
  const react = () => {
    if (disposed) return;
    setState('react');
    elapsed = 0;
    reactionTime = 0;
    speech.textContent = ['老板，要一起出去走走吗？', '在呢！', '稍微活动一下～'][greeting++ % 3];
  };
  const listen = (type, callback) => button.addEventListener(type, callback, { signal: controller.signal });
  listen('click', react);
  listen('pointerenter', () => { hovering = true; if (state === 'walk') setState('idle'); });
  listen('pointerleave', () => { hovering = false; });
  listen('focus', () => { focused = true; if (state === 'walk') setState('idle'); });
  listen('blur', () => { focused = false; });
  const skinFactory = skin === 'v2' ? host => import('./base-chibi-v2.skin.js').then(module => module.createV2Skin(host)) : createChibiSkin;
  if (skin) skinFactory(button).then(result => {
    if (disposed) { result?.dispose(); return; }
    player = result;
  }).catch(error => {
    if (disposed) return;
    button.dataset.skinError = error.message;
    speech.textContent = '动画加载失败，请重新切换动作。';
  });

  function tick(time) {
    if (disposed) return;
    if (!root.isConnected || overlay?.hidden || overlay?.classList.contains('closing') || overlay?.hasAttribute('data-ui-closing')) {
      dispose(); return;
    }
    const delta = last ? Math.min(time - last, 64) : 0;
    last = time;
    const max = Math.max(0, lane.clientWidth - button.offsetWidth);
    x = Math.max(0, Math.min(x, max));
    const paused = document.hidden || !!document.querySelector('.page-loading') || overlay?.hasAttribute('data-camp-entry');
    button.dataset.paused = String(paused);
    if (!paused) {
      poseTime += delta / 1000;
      if (reactionTime >= 0) reactionTime += delta / 1000;
      walkBlend += ((state === 'walk' && !hovering && !focused && !motionReduced() ? 1 : 0) - walkBlend) * Math.min(1, delta / 140);
      elapsed += delta;
      if (state === 'react') {
        if (elapsed >= 1800) { speech.textContent = ''; elapsed = 0; waiting = 2400; setState('idle'); }
      } else if (motionReduced() || hovering || focused || max === 0) {
        setState('idle'); elapsed = 0;
      } else if (state === 'idle' && motion !== 'idle' && elapsed >= (motion === 'walk' ? 0 : waiting)) {
        if (x >= max) direction = -1;
        if (x <= 0) direction = 1;
        elapsed = 0; setState('walk');
      } else if (state === 'walk') {
        const stride = skin ? delta / 1000 * CHIBI_GAIT.speed * walkBlend : delta * .036;
        x = Math.max(0, Math.min(max, x + direction * stride * (skin ? scale : 1)));
        if (skin) distance += stride;
        if (x === max || x === 0 || (motion !== 'walk' && elapsed >= 3600)) {
          direction *= -1; waiting = 2600; elapsed = 0;
          if (motion !== 'walk') setState('idle');
        }
      }
    }
    draw();
    if (!paused) player?.render(pose || { time:poseTime, distance, walk:motionReduced() ? 0 : walkBlend, rest,
      reaction:state === 'react' && !motionReduced() ? reactionTime : -1 });
    frame = requestAnimationFrame(tick);
  }
  draw(); frame = requestAnimationFrame(tick);
  return dispose;
}

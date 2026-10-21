import { escAttr } from '../core/shared.js';
import { motionReduced } from './motion-presets.js';

const reactions = ['tilt', 'hop', 'nuzzle'];
const replies = {
  dog: ['歪头看着你。', '开心地晃了晃。', '又凑近了一点。'],
  falcon: ['偏过头来瞧你。', '轻轻抖了抖翅膀。', '安静地陪着你。'],
  cat: ['嗯？', '伸了个小懒腰。', '眯起了眼睛。'],
  robot: ['滴，收到。', '天线晃了晃。', '陪伴模式，已就位。'],
  fire: ['小火苗歪了歪。', '噗，跳了一下。', '暖乎乎地靠过来。'],
  penguin: ['歪头瞧了瞧。', '摇摇摆摆。', '挨着你坐一会儿。'],
};

// portrait is the existing, trusted partnerPortrait markup; only UI text is added.
export function partnerInteractionHTML(portrait, { id, name }) {
  return `<div class="partner-play" data-partner-play="${escAttr(id)}"><button type="button" class="partner-play-target" aria-label="逗一逗${escAttr(name)}">${portrait}</button><span class="partner-play-hint" aria-hidden="true">逗一逗</span><span class="partner-play-reply" role="status" aria-live="polite" aria-atomic="true"></span></div>`;
}

// Display-only and deliberately independent of Base, session, commands and RNG.
// The owner calls dispose before page replacement or exit; one tap replaces the last.
export function mountPartnerInteraction(root) {
  const target = /** @type {HTMLElement} */ (root?.querySelector('.partner-play-target'));
  const reply = /** @type {HTMLElement} */ (root?.querySelector('.partner-play-reply'));
  if (!target || !reply) return () => {};
  let next = 0, timer = null, disposed = false;
  const reset = () => {
    clearTimeout(timer);
    timer = null;
    delete root.dataset.reaction;
    reply.textContent = '';
  };
  const play = () => {
    if (disposed) return;
    if (!root.isConnected) { dispose(); return; }
    reset();
    const index = next++ % reactions.length;
    reply.textContent = (replies[root.dataset.partnerPlay] || replies.dog)[index];
    if (!motionReduced()) root.dataset.reaction = reactions[index];
    timer = setTimeout(() => { if (root.isConnected) reset(); else dispose(); }, 1400);
  };
  const onVisibility = () => { if (document.hidden) reset(); };
  const onOverlayMode = () => { if (!root.isConnected) dispose(); };
  function dispose() {
    if (disposed) return;
    disposed = true;
    reset();
    target.removeEventListener('click', play);
    document.removeEventListener('visibilitychange', onVisibility);
    document.removeEventListener('sdt-overlay-close', dispose);
    document.removeEventListener('sdt-overlay-mode', onOverlayMode);
  }
  // Native button activation provides pointer, Enter and Space without duplicate keys.
  target.addEventListener('click', play);
  document.addEventListener('visibilitychange', onVisibility);
  document.addEventListener('sdt-overlay-close', dispose);
  document.addEventListener('sdt-overlay-mode', onOverlayMode);
  return dispose;
}

import '../../css/feedback-theme.css';

// Shared reveal cadence and winter palette. Presentation only, never battle pace.
export const FEEDBACK_TIMING = Object.freeze({ enter: 160, hold: 480, travel: 360, title: 1450, ease: 'cubic-bezier(.3,.7,.4,1)' });
export function quietFeedback() {
  return document.body?.dataset.renderQuality === 'low'
    || !!window.SDT?.Motion?.reduceMotion?.()
    || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

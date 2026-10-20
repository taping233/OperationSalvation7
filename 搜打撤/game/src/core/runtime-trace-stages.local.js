// Inert until the explicitly enabled local trace installs its bounded sink.
// Fixed labels only: never accept URLs, error messages, DOM text or game state.
export const RUNTIME_STAGES = Object.freeze([
  'settings-module-wait', 'settings-overlay-sync',
  'settings-navigation-sync', 'settings-visual-wait',
]);
let sink = null;
let context;
const noop = () => {};
export function connectRuntimeStages(next) {
  sink = next;
  return () => { if (sink === next) sink = null; };
}
export function captureRuntimeStageContext() { return context ?? sink?.capture(); }
export function withRuntimeStageContext(value, run) {
  const previous = context;
  context = value;
  try { return run(); } finally { context = previous; }
}
export function beginRuntimeStage(stage, value = captureRuntimeStageContext()) {
  if (!RUNTIME_STAGES.includes(stage)) return noop;
  return sink?.begin(stage, value) || noop;
}

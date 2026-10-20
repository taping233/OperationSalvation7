// Contact/release poses verified against the delivered images, not card damage.
const contactFrames = Object.freeze({
  wu: 'sprite-v1/frame-039', changwuyu: 'sprite-v1/f038',
  baita: 'sprite-v1/frame-038', heixiang: 'sprite-v1/frame-038', xingyue: 'sprite-v1/frame-038',
});

export const cueAction = cue => ({ 'player-attack': 'atk', 'player-spell': 'cast' })[cue?.attacker];

// The view renders card events before it consumes this render's feedback list.
// Hold the original card action for that one handoff, without inferring rules.
const cardActions = new WeakMap();
export function queueCardAction(body, action) { if (body && action) cardActions.set(body, action); }
export function takeCardAction(body, feedback = []) {
  const action = cardActions.get(body); cardActions.delete(body);
  return feedback.some(f => (f.cls || '').includes('windupfx') && cueAction(f.cue)) ? null : action;
}

// Use the running, texture-filtered timeline and its next frame deadline.
// A neutral-only cast or missing contact frame must retain the cue fallback.
export function frameImpactRemaining({ role, timeline, index, nextAt, now }) {
  const contact = timeline?.list.indexOf(contactFrames[role]);
  if (!(contact >= 0) || timeline.list.length < 2) return null;
  if (index >= contact) return 0;
  let remaining = nextAt - now;
  for (let frame = index + 1; frame < contact; frame++) remaining += timeline.dur[frame];
  return Math.max(0, remaining);
}

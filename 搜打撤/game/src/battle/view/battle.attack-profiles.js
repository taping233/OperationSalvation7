// Presentation only: counts and amounts come from the already resolved damage step.
export const attackProfiles = Object.freeze({
  light: Object.freeze({ windupMs: 130, stopMs: 0, impactScale: .9, recoil: .8 }),
  heavy: Object.freeze({ windupMs: 240, stopMs: 100, impactScale: 1.3, recoil: 1.4 }),
  spell: Object.freeze({ windupMs: 200, stopMs: 0, impactScale: 1.08, recoil: .75 }),
  combo: Object.freeze({ windupMs: 90, stopMs: 0, impactScale: .8, recoil: .6 }),
});

export function attackProfile(kind, card, { hitCount = 1, amount = card?.dmg } = {}) {
  if (Number(hitCount) > 1) return 'combo';
  if (kind === 'spell') return 'spell';
  return Number(amount) >= 10 ? 'heavy' : 'light';
}

export function impactProfile(cue, amount, { kill = false, critical = false, reduced = false } = {}) {
  const key = Object.hasOwn(attackProfiles, cue?.profile) ? cue.profile : null;
  const heavyHit = key !== 'combo' && (critical || Number(amount) >= 10);
  const profile = attackProfiles[heavyHit ? 'heavy' : key || 'light'];
  return {
    ...profile,
    stopMs: reduced ? 0 : kill ? 120 : profile.stopMs,
  };
}

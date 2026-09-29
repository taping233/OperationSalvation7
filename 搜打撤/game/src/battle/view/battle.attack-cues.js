// Symbolic attack presentation cues. Consumers map these IDs to available UI
// feedback; keep this catalog independent of card data and asset paths.
const CUES = Object.freeze({
  attack: Object.freeze({ windupMs: 130, attacker: 'player-attack', hit: 'target-damage', hitSound: null }),
  spell: Object.freeze({ windupMs: 130, attacker: 'player-spell', hit: 'target-magic', hitSound: null }),
  fixed: Object.freeze({ windupMs: 130, attacker: 'player-attack', hit: 'target-damage', hitSound: null }),
  true: Object.freeze({ windupMs: 130, attacker: 'player-attack', hit: 'target-damage', hitSound: null }),
});

/** Return a fresh, validated cue or undefined when the damage kind is unknown. */
export function attackCue(damageKind) {
  if (!Object.prototype.hasOwnProperty.call(CUES, damageKind)) return undefined;
  const cue = CUES[damageKind];
  const windupMs = Number(cue?.windupMs);
  if (!Number.isFinite(windupMs) || windupMs < 0) return undefined;
  if (!['player-attack', 'player-spell'].includes(cue.attacker)) return undefined;
  if (!['target-damage', 'target-magic'].includes(cue.hit)) return undefined;
  if (cue.hitSound !== null && typeof cue.hitSound !== 'string') return undefined;
  return { windupMs, attacker: cue.attacker, hit: cue.hit, hitSound: cue.hitSound };
}

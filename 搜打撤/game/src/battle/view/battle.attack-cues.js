// Symbolic attack presentation cues. Consumers map these IDs to available UI
// feedback; keep this catalog independent of card data and asset paths.
import { attackProfile, attackProfiles } from './battle.attack-profiles.js';

const CUES = Object.freeze({
  attack: Object.freeze({ attacker: 'player-attack', hit: 'target-damage', hitSound: null }),
  spell: Object.freeze({ attacker: 'player-spell', hit: 'target-magic', hitSound: null }),
  fixed: Object.freeze({ attacker: 'player-attack', hit: 'target-damage', hitSound: null }),
  true: Object.freeze({ attacker: 'player-attack', hit: 'target-damage', hitSound: null }),
});

/** Return a fresh, validated cue or undefined when the damage kind is unknown. */
export function attackCue(damageKind, card, context) {
  if (!Object.prototype.hasOwnProperty.call(CUES, damageKind)) return undefined;
  const cue = CUES[damageKind];
  const profile = attackProfile(damageKind, card, context);
  const windupMs = Number(attackProfiles[profile].windupMs);
  if (!Number.isFinite(windupMs) || windupMs < 0) return undefined;
  if (!['player-attack', 'player-spell'].includes(cue.attacker)) return undefined;
  if (!['target-damage', 'target-magic'].includes(cue.hit)) return undefined;
  if (cue.hitSound !== null && typeof cue.hitSound !== 'string') return undefined;
  const name = String(card?.name || '');
  const materialSounds = [
    [/雷|电|射线/, 'attackLightning'], [/火|焰|燃|烟火|余烬|灼/, 'attackFire'],
    [/冰|冻|霜|寒/, 'attackIce'], [/毒|腐化|腐蚀/, 'attackPoison'],
    [/弓|箭/, 'attackArrow'], [/精神|心灵|幻|梦/, 'attackPsychic'],
    [/穿刺|突刺|长枪|枪刺|刺击/, 'attackPierce'], [/拳|掌|锤|砸|钝|打击/, 'attackBlunt'],
  ];
  const hitSound = materialSounds.find(([pattern]) => pattern.test(name))?.[1] || cue.hitSound;
  return { profile, windupMs, attacker: cue.attacker, hit: cue.hit, hitSound };
}

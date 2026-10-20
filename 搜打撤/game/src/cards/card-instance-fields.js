// Card-face fields only. Unknown underscore fields remain compatible extension data.
// These lifetimes describe acquisition/definition refresh, not battle-copy effects.
// @ts-check
export const CARD_INSTANCE_FIELD_LIFETIMES = Object.freeze({
  _pouch: 'run',
  _baseCost: 'battle',
  _noInfuse: 'battle',
  _castOnDraw: 'battle',
  _battleTransformMissing: 'play',
  _registeredTriggers: 'play',
  _triggerPoint: 'play',
  _soulEcho: 'play',
  _preview: 'presentation',
});

/** @param {string} field */
export function isTransientCardInstanceField(field) {
  const lifetime = /** @type {Record<string, string>} */ (CARD_INSTANCE_FIELD_LIFETIMES)[field];
  return lifetime !== undefined && lifetime !== 'run';
}

/** Preserve known run data and unknown historical/custom extensions on definition refresh.
 * @param {string} field */
export function retainCardInstanceField(field) {
  return field.startsWith('_') && !isTransientCardInstanceField(field);
}

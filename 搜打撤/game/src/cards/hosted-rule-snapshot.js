// Each historical rule owns its objects; field order is the migration fingerprint.
/** @param {string} name */
export function hostedRuleSnapshot(name) {
  return { version: 1, battle: { hosted: [name] } };
}

/** @param {string} name @param {'self' | 'enemy'} side */
export function targetedHostedRuleSnapshot(name, side) {
  return { version: 1, battle: { target: { side, area: false }, hosted: [name] } };
}

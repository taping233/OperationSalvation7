/** Commit one numeric hit, preserving defense consumption before heart conversion.
 * The caller supplies a copy for previews and the live target for actual damage. */
export function dealMeasuredDamage(Combat, attacker, target, amount, type, options = {}) {
  if (!target.heartsMode) return Combat.dealDamage(attacker, target, amount, type, options);
  Combat.ensureStatus(target);
  const probe = Combat.dealDamage(attacker, { status: target.status, defense: target.defense }, amount, type, options);
  let loss = type === Combat.TYPES.TRUE || target.status.abreak > 0
    ? probe.dealt : probe.dealt >= 8 ? 2 : probe.dealt > 0 ? 1 : 0;
  if (options.nonLethal) loss = Math.min(loss, Math.max(0, target.hp - 1));
  target.hp -= loss;
  return { ...probe, dealt: loss, hearts: true };
}

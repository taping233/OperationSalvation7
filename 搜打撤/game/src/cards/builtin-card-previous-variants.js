// Earlier released structured declarations, before the current native revision.
export const BUILTIN_PREVIOUS_VARIANTS = {
  'cmtn1ntxzoc4': [{ version: 1, battle: { target: { side: 'self', area: false } },
    triggers: { onPlay: [{ op: 'blessing', key: 'spellUp' }] } }],
  'tt3-dig-treasure': [{ version: 1, battle: { target: { side: 'self', area: false } },
    triggers: { onPlay: [{ op: 'acquire', n: 1, pool: { kind: '牌库底' }, dest: 'discover' }, { op: 'armor', priceOf: 'discovered' }] } }],
};

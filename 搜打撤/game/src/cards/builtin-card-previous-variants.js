// Earlier released structured declarations, before the current native revision.
export const BUILTIN_PREVIOUS_VARIANTS = {
  'cmtn1ntxzoc4': [{ version: 1, battle: { target: { side: 'self', area: false } },
    triggers: { onPlay: [{ op: 'blessing', key: 'spellUp' }] } }],
  'tt3-dig-treasure': [{ version: 1, battle: { target: { side: 'self', area: false } },
    triggers: { onPlay: [{ op: 'acquire', n: 1, pool: { kind: '牌库底' }, dest: 'discover' }, { op: 'armor', priceOf: 'discovered' }] } }],
  // 2026-10-21 反馈#5：神灯第 1 项「发现任意 1 张牌并释放」→「发现招式并释放」（招式池收窄）；
  // 已落库的旧 native 抉择形状按旧指纹升级到现行 revision（ensureBuiltinExecutionRules 幂等重放）。
  'tt3-magic-lamp': [{ version: 1, battle: { target: { side: 'enemy', area: false } },
    triggers: { onPlay: [{ op: 'choice', options: [
      { label: '发现 1 张牌并将其释放', ops: [{ op: 'acquire', n: 1, pool: { kind: '随机' }, dest: 'discover', act: 'play' }] },
      { label: '消灭 1 名受伤敌人（非 BOSS）', ops: [{ op: 'execute', cap: { wounded: true }, count: 1 }] },
      { label: '冰冻 2 名角色，获得 5 点护甲', ops: [{ op: 'freezeFirstEnemies', count: 2, duration: 1 }, { op: 'armor', amount: 5 }] },
    ] }] } }],
};

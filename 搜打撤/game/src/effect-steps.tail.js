/* 由 effect-steps.js 拆出（2026-09-22 六文件重构批1）。原第 1449-1472 行，逐字搬迁。
 * 铁律：顺序即语义——本分节在壳 effect-steps.js 的 concat 顺序即旧 if 链物理顺序，勿重排。
 * 共享端口由壳经参数 s 注入（deps 展开 + esc/hitFoe + 模块级常量），本文件零 import。 */
export function tailSteps(s) {
  const {log, addEnergy, addEnergyCap, matchElsewhere, refillEnergy} = s;
  return [
      /* ============ 外部层实装识别 + 能量 + 哨兵 ============ */
      {
        id: 'elsewhere.recognized', gate: 'fresh', label: '识别补丁：出牌结算段/规则层/背包实装的句式',
        when: (ctx) => matchElsewhere(ctx.desc, { structuredHit: !!ctx.flags.structuredHit, infusedLead: !!ctx.infLead }).length ? true : null,
        run: (ctx) => { ctx.did = true; },
      },
      {
        id: 'res.energy', gate: 'always', label: '获得/回复 N 点能量',
        when: (ctx) => (!/该牌时/.test(ctx.desc)) ? ctx.desc.match(/(?:获得|回复)\s*(\d+)\s*点?能量/) : null,
        run: (ctx, m) => {
          const current = addEnergy(+m[1]);
          log(`[[icon:bolt]] 获得 ${m[1]} 点能量（当前 ${current}）`, 'sys');
          ctx.did = true;
        },
      },
      {
        id: 'res.energyCap', gate: 'always', label: '能量上限 +N',
        when: (ctx) => ctx.desc.match(/能量上限\s*\+\s*(\d+)/),
        run: (ctx, m) => {
          const currentMax = addEnergyCap(+m[1]);
          log(`[[icon:bolt]] 本场战斗能量上限 +${m[1]}（每回合 ${currentMax} 费）`, 'sys');
          ctx.did = true;
        },
      },
      {
        // 第十二批·后备能源（2026-09-23）：「回复所有费用」= 能量直接回满
        id: 'res.energyRefill', gate: 'always', label: '回复所有费用（能量回满）',
        when: (ctx) => (/回复所有费用|回满所有能量/.test(ctx.desc)) ? true : null,
        run: (ctx) => {
          const current = refillEnergy();
          log(`[[icon:bolt]] 能量回满（${current} 费）`, 'sys');
          ctx.did = true;
        },
      },
  ];
}

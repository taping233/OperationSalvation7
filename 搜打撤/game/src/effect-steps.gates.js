/* 由 effect-steps.js 拆出（2026-09-22 六文件重构批1）。原第 127-217 行，逐字搬迁。
 * 铁律：顺序即语义——本分节在壳 effect-steps.js 的 concat 顺序即旧 if 链物理顺序，勿重排。
 * 共享端口由壳经参数 s 注入（deps 展开 + esc/hitFoe + 模块级常量），本文件零 import。 */
export function gatesSteps(s) {
  const {combat, log, queueChoice, registerTurnStartText, getInfuseFuels, unlockSeal, esc, HALT, FRESH_RESULT} = s;
  return [
      /* ============ 前置改写与门控（旧实现顶部） ============ */
      {
        id: 'gate.infuseRequired', gate: 'always', label: '未注能时跳过纯注能效果句',
        when: (ctx) => ctx.flags.infused !== true && /^注能\s*[（(][^）)]*[）)][：:]?/.test(ctx.desc),
        run: () => HALT(FRESH_RESULT(false)),
      },
      {
        id: 'pre.infuseLead', gate: 'always', label: '「注能(N)：效果」前缀剥离',
        when: (ctx) => ctx.flags.infused === true ? ctx.desc.match(/^注能\s*[（(][^）)]*[）)][：:]?\s*(.+)$/) : null,
        run: (ctx, m) => { ctx.infLead = m; ctx.desc = m[1]; },
      },
      {
        id: 'pre.fuelPrice', gate: 'always', label: '「N倍于被注能卡牌价格」按牺牲品费用折算',
        when: (ctx) => (ctx.flags.fuelCost != null) ? ctx.desc.match(/(\d+)\s*倍于被注能卡牌价格/) : null,
        run: (ctx, m) => {
          ctx.desc = ctx.desc.replace(/[^，。]*?\d+\s*倍于被注能卡牌价格的血量/, `回复 ${+m[1] * Math.max(0, ctx.flags.fuelCost)} 点生命`);
          log(`[[icon:flask]] 牺牲品费用 ${ctx.flags.fuelCost} → 折算回复 ${+m[1] * Math.max(0, ctx.flags.fuelCost)} 点生命`, 'sys');
        },
      },
      {
        id: 'gate.sealUnlock', gate: 'always', label: '「累计注能 N 张后解锁」门',
        when: (ctx) => ctx.desc.match(/累计注能\s*(\d+)\s*张[^。；]*?解锁[：:]?\s*([\s\S]*)/),
        run: (ctx, m) => {
          const need = +m[1];
          const fuels = typeof getInfuseFuels === 'function' ? getInfuseFuels() : need;
          if (fuels >= need) {
            if (typeof unlockSeal === 'function') {
              unlockSeal(ctx.card.name);
              return HALT(FRESH_RESULT(true));
            }
            ctx.desc = m[2];   // 无端口环境（审计/复核 harness）：直接展开效果本体
            log(`[[icon:crystal]] <b>${esc(ctx.card.name)}</b> 已解锁（累计注能 ${fuels}/${need} 张）`, 'ok');
          } else {
            log(`[[icon:crystal]] <b>${esc(ctx.card.name)}</b> 未解锁：累计注能 ${fuels}/${need} 张`, 'dim');
            return HALT(FRESH_RESULT(true));
          }
        },
      },
      {
        id: 'gate.curseCond', gate: 'always', label: '「诅咒状态下」条件门（装备改穿戴期核算）',
        when: (ctx) => (/诅咒状态[下时]/.test(ctx.desc) && !/对手|对方/.test(ctx.desc)) ? true : null,
        run: (ctx) => {
          const met = typeof combat.hasCurse === 'function' && combat.hasCurse(ctx.pstat);
          if (ctx.card.type === '装备') {
            log(met
              ? `[[icon:crystal]] <b>${esc(ctx.card.name)}</b>：当前身负诅咒，条件加成已生效`
              : `[[icon:cross]] ${esc(ctx.card.name)}：自身未处于诅咒状态，穿戴期间身负诅咒时自动生效`, met ? 'ok' : 'dim');
            return HALT(FRESH_RESULT(true));
          }
          if (!met) {
            log(`[[icon:cross]] ${esc(ctx.card.name)}：自身未处于诅咒状态，条件加成不生效`, 'dim');
            return HALT(FRESH_RESULT(true));
          }
        },
      },
      {
        id: 'pre.turnNegExtract', gate: 'always', label: '「回合开始 -N 血」从句剥出为延迟段',
        when: (ctx) => ctx.desc.match(/回合开始[时：:，,]?\s*[-－]\s*(\d+)\s*点?血/),
        run: (ctx, m) => {
          if (typeof registerTurnStartText !== 'function') return;
          registerTurnStartText(`-${m[1]} 血`, ctx.card.name);
          ctx.desc = ctx.desc.replace(/[,，]?\s*回合开始[时：:，,]?\s*[-－]\s*\d+\s*点?血/, '');
          log(`[[icon:hourglass]] <b>${esc(ctx.card.name)}</b>：每个回合开始失去 ${m[1]} 点生命`, 'sys');
          ctx.did = true;
        },
      },
      {
        id: 'gate.choice', gate: 'fresh', label: '抉择面板拦截（必须在其它动词之前）',
        when: (ctx) => (/抉择[:：]/.test(ctx.desc) && typeof queueChoice === 'function') ? true : null,
        run: (ctx) => {
          const body = ctx.desc.replace(/^.*?抉择[:：]\s*/, '');
          let options;
          if (/\d\s*[°º]/.test(body)) {
            options = body.split(/[,，]?\s*\d\s*[°º]\s*/).map(s => s.trim()).filter(Boolean);
          } else {
            options = body.split(/或者/).map(s => s.trim()).filter(Boolean);
          }
          if (options.length > 1) {
            // secondDoor：花开两面——未选择的门「两回合后」也要展开（pickChoice 调度）
            queueChoice({ cardName: ctx.card.name, options, secondDoor: /两回合后[^。]*未选择/.test(String(ctx.card.desc || '')) });
            log(`[[icon:question]] <b>${esc(ctx.card.name)}</b>：抉择（${options.length} 选 1）——请从面板中选择`, 'sys');
            return HALT(FRESH_RESULT(true));
          }
        },
      },
      {
        id: 'gate.randomOptionsSkip', gate: 'always', label: '「从这些中随机」可选项说明不逐项生效',
        when: (ctx) => (/从这些中随机/.test(ctx.desc) && !/随机获取一项祝福/.test(ctx.desc)) ? true : null,
        run: () => HALT(FRESH_RESULT(false)),
      },
  
  ];
}

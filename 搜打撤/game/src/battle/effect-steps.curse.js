/* 由 effect-steps.js 拆出（2026-09-22 六文件重构批1）。原第 218-430 行，逐字搬迁。
 * 铁律：顺序即语义——本分节在壳 effect-steps.js 的 concat 顺序即旧 if 链物理顺序，勿重排。
 * 共享端口由壳经参数 s 注入（deps 展开 + esc/hitFoe + 模块级常量），本文件零 import。 */
export function curseSteps(s) {
  const {combat, getAlive, log, setDeathSave, handCurseSpecs, queueSwapCostDiscover, esc, num} = s;
  return [
      /* ============ 诅咒与祝福段（多为无条件段） ============ */
      {
        id: 'curse.burn', gate: 'always', label: '灼烧（不叠加、按回合固定掉血）',
        when: (ctx) => ctx.desc.match(/(?:附加|施加|攻击并)\s*(?:\d+\s*层?\s*)?灼烧/),
        run: (ctx) => {
          const fm = ctx.desc.match(/灼烧(?:状态)?\s*(\d+)\s*回合/);
          const n = fm ? +fm[1] : (ctx.durOv ? +ctx.durOv : 2);
          if (ctx.curseTarget) { combat.addCurse(ctx.curseTarget, 'burn', n); log(`[[icon:fire]] <b>${esc(ctx.curseTarget.name)}</b> 被灼烧（${n} 回合内每回合结束受 1 点固定伤害，不叠加）`, 'sys'); ctx.did = true; }
        },
      },
      {
        id: 'curse.bleedGate', gate: 'always', label: '「若对方流血」条件门（未流血时后续条件子句空过）',
        when: (ctx) => {
          const fail = /若对方[^。]*流血/.test(ctx.desc) &&
            !((ctx.curseTarget && ctx.curseTarget.status && ctx.curseTarget.status.bleed) > 0);
          return fail ? true : null;
        },
        run: (ctx) => {
          ctx.bleedGateFail = true;
          log(`[[icon:cross]] ${esc(ctx.card.name)}：对方未处于流血状态，条件效果不生效`, 'dim');
        },
      },
      {
        id: 'curse.bleed', gate: 'always', label: '附加流血',
        when: (ctx) => ctx.desc.match(/(?:附加|施加)\s*(?:(\d+)\s*层?)?\s*流血/) || (/附加流血|施加流血/.test(ctx.desc) ? true : null),
        run: (ctx, m) => {
          // m 命中但组 1 缺失（「附加流血」无层数）时 +m[1] 是 NaN——曾把敌人 bleed 写成 NaN（2026-09-09 老板 #15/#16）
          const n = m && m[1] ? +m[1] : 1;
          if (ctx.curseTarget) { combat.addCurse(ctx.curseTarget, 'bleed', n); log(`[[icon:blood]] <b>${esc(ctx.curseTarget.name)}</b> 附加 ${n} 层流血`, 'sys'); ctx.did = true; }
        },
      },
      {
        id: 'curse.poison', gate: 'always', label: '附加中毒（「所有敌人」走全体）',
        when: (ctx) => ctx.desc.match(/(?:附加|施加)\s*(?:(\d+)\s*层)?\s*中毒/),
        run: (ctx, m) => {
          const n = m[1] ? +m[1] : 1;
          // 2026-09-12：剧毒药水/棘刺之地类「对所有敌人附加 N 层中毒」→ 全体结算
          const aoeP = /所有敌人|敌方全体|全体敌人|目标为全体/.test(ctx.desc);
          const targets = (aoeP ? getAlive() : (ctx.curseTarget ? [ctx.curseTarget] : [])).filter(t => t && !t.dead);
          if (targets.length) {
            targets.forEach(t => combat.addCurse(t, 'poison', n));
            log(targets.length > 1
              ? `[[icon:skull]] 全体敌人附加 ${n} 层中毒（每层回合末 1 点固定伤害）`
              : `[[icon:skull]] <b>${esc(targets[0].name)}</b> 附加 ${n} 层中毒（每层回合末 1 点固定伤害）`, 'sys');
            ctx.did = true;
          }
        },
      },
      {
        id: 'curse.swapCostDiscover', gate: 'always', label: '迷之匣：发现两张随机招式并交换费用',
        when: (ctx) => (typeof queueSwapCostDiscover === 'function' && /发现两张随机招式/.test(ctx.desc)) ? true : null,
        run: (ctx) => { queueSwapCostDiscover(); ctx.did = true; },
      },
      {
        id: 'curse.handCurseAll', gate: 'always', label: '诅咒之刃：附加手牌招式的全部诅咒',
        when: (ctx) => (typeof handCurseSpecs === 'function' && /附加手牌中的招式所具有的全部诅咒/.test(ctx.desc)) ? true : null,
        run: (ctx) => {
          const specs = handCurseSpecs();
          const ct = (ctx.target && !ctx.target.dead) ? ctx.target : (getAlive()[0] || null);
          if (specs.length && ct) {
            const names = specs.map(s => {
              const meta = combat.CURSE_META[s.key];
              combat.addCurse(ct, s.key, s.n);
              return `${meta ? meta.name : s.key}${meta && meta.stack ? '×' + s.n : ''}`;
            }).join('、');
            log(`[[icon:skull]] <b>${esc(ctx.card.name)}</b>：附加手牌招式的诅咒 → <b>${esc(ct.name)}</b>：${names}`, 'sys');
          } else {
            log(`[[icon:cross]] <b>${esc(ctx.card.name)}</b>：手牌中没有带诅咒的招式`, 'dim');
          }
          ctx.did = true;
        },
      },
      {
        id: 'curse.freeze', gate: 'always', label: '冰冻/冻结（免疫冰冻句除外）',
        when: (ctx) => (!/免疫冰冻|对冰冻/.test(ctx.desc) && /附加冰冻|冰冻\s*所有|冰冻\s*(?:\d+|[一两二三四五])\s*名|冻结/.test(ctx.desc)) ? true : null,
        run: (ctx) => {
          // 第十二批·冷冻射线（2026-09-23）：「若此前其未曾受到过伤害」——以本卡结算前的
          // hpAtCast 快照为准（同卡先行伤害会让满血判定误杀）；无快照时回退当前满血。
          if (/未曾受到过伤害/.test(ctx.desc)) {
            const t0 = ctx.curseTarget;
            const pre = t0 && ctx.flags.hpAtCast ? ctx.flags.hpAtCast.get(t0) : null;
            const undmg = t0 ? (pre != null ? pre >= (t0.maxHp || 0) : t0.hp >= (t0.maxHp || 0)) : false;
            if (!undmg) {
              if (t0) log(`[[icon:crystal]] ${esc(t0.name)} 此前已受过伤，冰冻未生效`, 'dim');
              ctx.did = true;
              return;
            }
          }
          const fm = ctx.desc.match(/(?:冻结|冰冻)状态\s*(\d+)\s*回合/);
          const n = fm ? +fm[1] : (ctx.durOv ? +ctx.durOv : 1);
          // 2026-09-06 #13：desc 带「冰冻 N 名」时对前 N 个存活目标生效；2026-09-12：支持中文量词
          const multiM = ctx.desc.match(/(?:冰冻|冻结)\s*(\d+|[一两二三四五])\s*名/);
          const multiN = multiM ? num(multiM[1]) : 0;
          // 2026-09-15：「冰冻所有敌人」类群体句 → 全体结算（与 curse.poison 同口径；此前无此分支只冻单体）
          const aoeP = /所有敌人|敌方全体|全体敌人|目标为全体/.test(ctx.desc);
          if (aoeP) {
            const targets = getAlive().filter(t => t && !t.dead);
            targets.forEach(t => combat.addCurse(t, 'freeze', n));
            if (targets.length) { log(`[[icon:crystal]] 全体敌人被冰冻 ${n} 回合（无法行动）`, 'sys'); ctx.did = true; }
          } else if (multiN > 1) {
            const targets = getAlive().slice(0, multiN);
            targets.forEach(t => combat.addCurse(t, 'freeze', n));
            if (targets.length) { log(`[[icon:crystal]] ${targets.map(t => esc(t.name)).join('、')} 被冰冻 ${n} 回合（无法行动）`, 'sys'); ctx.did = true; }
          } else if (ctx.curseTarget) { combat.addCurse(ctx.curseTarget, 'freeze', n); log(`[[icon:crystal]] <b>${esc(ctx.curseTarget.name)}</b> 被冰冻 ${n} 回合（无法行动）`, 'sys'); ctx.did = true; }
        },
      },
      {
        id: 'curse.silence', gate: 'always', label: '沉默',
        when: (ctx) => /沉默/.test(ctx.desc) ? true : null,
        run: (ctx) => {
          const n = ctx.durOv ? +ctx.durOv : 1;
          if (ctx.curseTarget) { combat.addCurse(ctx.curseTarget, 'silence', n); log(`[[icon:cross]] <b>${esc(ctx.curseTarget.name)}</b> 被沉默 ${n} 回合（技能无效，攻击除外）`, 'sys'); ctx.did = true; }
        },
      },
      {
        id: 'curse.abreak', gate: 'always', label: '破甲（流血条件门未过时空过）',
        when: (ctx) => (/破甲/.test(ctx.desc) && !ctx.bleedGateFail) ? true : null,
        run: (ctx) => {
          const n = ctx.durOv ? +ctx.durOv : 2;
          if (ctx.curseTarget) { combat.addCurse(ctx.curseTarget, 'abreak', n); log(`[[icon:tools]] <b>${esc(ctx.curseTarget.name)}</b> 破甲 ${n} 回合（无法减免伤害——元素庇幕失效）`, 'sys'); ctx.did = true; }
        },
      },
      {
        id: 'curse.healban', gate: 'always', label: '禁疗',
        when: (ctx) => /禁疗/.test(ctx.desc) ? true : null,
        run: (ctx) => {
          const n = ctx.durOv ? +ctx.durOv : 2;
          if (ctx.curseTarget) { combat.addCurse(ctx.curseTarget, 'healban', n); log(`[[icon:heart]] <b>${esc(ctx.curseTarget.name)}</b> 禁疗 ${n} 回合（无法回复生命）`, 'sys'); ctx.did = true; }
        },
      },
      {
        id: 'buff.stealth', gate: 'always', label: '潜行',
        when: (ctx) => /潜行/.test(ctx.desc) ? true : null,
        run: (ctx) => {
          const stm = ctx.desc.match(/潜行(?:状态)?\s*(\d+)\s*回合/);
          const n = stm ? +stm[1] : (ctx.durOv ? +ctx.durOv : 1);
          combat.addBlessing(ctx.pstat, 'stealth', n);
          log(`[[icon:runner]] <b>祝福·潜行</b>：${n} 回合内无法成为被攻击对象（造成伤害会破除）`, 'ok');
          ctx.did = true;
        },
      },
      {
        id: 'buff.atkUp', gate: 'always', label: '攻+N / 获得 N 点攻击力（结构化伤害已结算时不再叠加）',
        when: (ctx) => ((ctx.flags.structuredHit
          ? null
          : (ctx.desc.match(/攻击\s*\+\s*(\d+)/) || ctx.desc.match(/攻\s*\+\s*(\d+)/) || ctx.desc.match(/\+\s*(\d+)\s*攻/)))
          || ctx.desc.match(/获得\s*(\d+)\s*点?攻击力?/)),
        run: (ctx, m) => {
          combat.addBlessing(ctx.pstat, 'atkUp', +m[1], ctx.durOv ? +ctx.durOv : 0);
          log(`[[icon:swords]] <b>祝福·攻击力增加</b>：攻击力 +${m[1]}（${ctx.durOv ? ctx.durOv + ' 回合' : '本场战斗'}，当前加成 ${ctx.pstat.status.atkUp}）`, 'ok');
          ctx.did = true;
        },
      },
      {
        id: 'buff.spellUp', gate: 'always', label: '法伤 +N',
        when: (ctx) => ctx.desc.match(/法伤\s*\+\s*(\d+)/) || ctx.desc.match(/法术伤害\s*\+\s*(\d+)/),
        run: (ctx, m) => {
          combat.addBlessing(ctx.pstat, 'spellUp', +m[1], ctx.durOv ? +ctx.durOv : 0);
          log(`[[icon:crystal]] <b>祝福·法伤增加</b>：法术伤害 +${m[1]}（${ctx.durOv ? ctx.durOv + ' 回合' : '本场战斗'}，当前加成 ${ctx.pstat.status.spellUp}）`, 'ok');
          ctx.did = true;
        },
      },
      {
        id: 'buff.deathSave', gate: 'always', label: '免疫 N 次致命伤害（死亡保险）',
        when: (ctx) => ctx.desc.match(/免疫\s*(\d+)\s*次致命伤害/),
        run: (ctx, m) => {
          if (typeof setDeathSave !== 'function') return;
          setDeathSave(+m[1]);
          log(`[[icon:sparkles]] <b>${esc(ctx.card.name)}</b>：本场战斗免疫 ${m[1]} 次致命伤害（触发后该回合无敌）`, 'ok');
          ctx.did = true;
        },
      },
      {
        id: 'buff.immune', gate: 'always', label: '免疫伤害 / 无敌',
        when: (ctx) => {
          const dsave = ctx.desc.match(/免疫\s*(\d+)\s*次致命伤害/);
          // 「免疫所有伤害」（第十二批·邪能护体 2026-09-23）与「免疫伤害」同义入祝福
          return ((/免疫(?:所有)?伤害/.test(ctx.desc) || /无敌/.test(ctx.desc)) && !dsave) ? true : null;
        },
        run: (ctx) => {
          const im = ctx.desc.match(/(\d+)\s*回合内[^。]*无敌/) || ctx.desc.match(/无敌[^。]*?(\d+)\s*回合/);
          const n = im ? +im[1] : (ctx.durOv ? +ctx.durOv : 1);
          combat.addBlessing(ctx.pstat, 'immune', n);
          log(`[[icon:sparkles]] <b>祝福·免疫伤害</b>：${n} 回合内不受到任何伤害`, 'ok');
          ctx.did = true;
        },
      },
      {
        id: 'buff.reduce', gate: 'always', label: '减伤 N',
        when: (ctx) => ctx.desc.match(/减伤\s*(\d+)?/),
        run: (ctx, m) => {
          const n = m[1] ? +m[1] : 1;
          combat.addBlessing(ctx.pstat, 'reduce', n);
          log(`[[icon:plate]] <b>祝福·减伤</b>：每次受到的伤害 -${n}（本场战斗）`, 'ok');
          ctx.did = true;
        },
      },
      {
        id: 'buff.swordForm', gate: 'always', label: '剑仙形态（回合开始额外抽 1）',
        when: (ctx) => (/剑仙形态/.test(ctx.desc) || /每回合额外抽\s*\d+\s*张/.test(ctx.desc) ||
          /回合开始时[^。]*?额外抽\s*\d+\s*张/.test(ctx.desc)) ? true : null,
        run: (ctx) => {
          combat.addBlessing(ctx.pstat, 'swordForm');
          log('[[icon:sword]] <b>祝福·剑仙形态</b>：回合开始时额外抽 1 张牌（本局对战）', 'ok');
          ctx.did = true;
        },
      },
      {
        id: 'buff.natureForm', gate: 'always', label: '自然形态（回合开始额外 1 能量）',
        when: (ctx) => (/自然形态/.test(ctx.desc) || /回合开始时[^。]*获得\s*\d+\s*点?能量/.test(ctx.desc)) ? true : null,
        run: (ctx) => {
          combat.addBlessing(ctx.pstat, 'natureForm');
          log('[[icon:wood]] <b>祝福·自然形态</b>：回合开始时额外获得 1 点能量（本局对战）', 'ok');
          ctx.did = true;
        },
      },
      {
        id: 'buff.cosmosForm', gate: 'always', label: '宇宙形态（全场 1 费）',
        when: (ctx) => /宇宙形态/.test(ctx.desc) ? true : null,
        run: (ctx) => {
          combat.addBlessing(ctx.pstat, 'cosmosForm');
          log('[[icon:sparkles]] <b>祝福·宇宙形态</b>：本局对战内，所有卡牌变为 1 费', 'ok');
          ctx.did = true;
        },
      },
  
  ];
}

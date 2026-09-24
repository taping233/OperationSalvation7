/* 由 effect-steps.js 拆出（2026-09-22 六文件重构批1）。原第 431-668 行，逐字搬迁。
 * 铁律：顺序即语义——本分节在壳 effect-steps.js 的 concat 顺序即旧 if 链物理顺序，勿重排。
 * 共享端口由壳经参数 s 注入（deps 展开 + esc/hitFoe + 模块级常量）；攻击表现 cue 来自白名单模块。 */
import { attackCue } from './battle.attack-cues.js';
export function damageSteps(s) {
  const {combat, getAlive, log, addTempCard, allCards, random01, getPlayerCaster, damagePlayer, addPlayerMaxHp, dumpHand, esc, hitFoe, ARROW_TOKEN, num} = s;
  const drain = steps => {
    let next = steps.next();
    while (!next.done) next = steps.next();
    return next.value;
  };
  // 步骤表的同步调用方仍直接调用 run；玩家出牌可经 run.steps 逐击推进同一份规则。
  const paced = steps => Object.assign((...args) => drain(steps(...args)), { steps });
  function* repeatLiveTargets(ctx, initialTarget, count, amount, type, caster, label) {
    let preferred = initialTarget;
    let total = 0;
    const hitTargets = [];
    for (let i = 0; i < count; i++) {
      let target = preferred && !preferred.dead ? preferred : getAlive().find(foe => foe && !foe.dead);
      if (!target) {
        log(`[[icon:cross]] <b>${esc(ctx.card.name)}</b>：第 ${i + 1}/${count} 段未施放，场上已无可攻击的敌人`, 'dim');
        break;
      }
      const cue = attackCue(type);
      yield { kind: 'windup', targets: [target], ...(cue ? { cue } : {}) };
      target = preferred && !preferred.dead ? preferred : getAlive().find(foe => foe && !foe.dead);
      if (!target) {
        log(`[[icon:cross]] <b>${esc(ctx.card.name)}</b>：第 ${i + 1}/${count} 段未施放，场上已无可攻击的敌人`, 'dim');
        break;
      }
      const dealt = hitFoe(ctx, target, amount, type, caster, i + 1).dealt;
      total += dealt;
      hitTargets.push(target);
      log(`[[icon:play]] <b>${esc(ctx.card.name)}</b>：第 ${i + 1}/${count} 段${label || ''} → <b>${esc(target.name)}</b>（${dealt} 点）`, 'sys');
      preferred = target;
      yield { kind: 'hit', segment: i + 1, ...(cue ? { cue } : {}) };
    }
    return { total, hitTargets };
  }
  return [
      /* ============ 伤害段 ============ */
      {
        // 第十二批·元素爆裂（2026-09-23）：对随机敌人 + 区间触发次数——每段随机选一名存活敌人。
        // 必须先于 dmg.direct：本步骤置位 did 后，dmg.direct 另有区间触发排除双保险。
        id: 'dmg.randomRepeat', gate: 'fresh', label: '对随机敌人造成 N 点法伤、触发 M-K 次（区间随机目标）',
        when: (ctx) => ctx.desc.match(/对随机敌人造成\s*(\d+)\s*点法(?:术)?伤[，,]\s*触发\s*(\d+)\s*[-–~至]\s*(\d+)\s*次/),
        run: paced(function* (ctx, m) {
          const lo = Math.min(+m[2], +m[3]), hi = Math.max(+m[2], +m[3]);
          const times = lo + Math.floor(random01() * (hi - lo + 1));
          const caster = getPlayerCaster ? getPlayerCaster() : {};
          const type = combat.TYPES.SPELL;
          let total = 0, hits = 0;
          for (let i = 0; i < times; i++) {
            const pool = getAlive().filter(t => t && !t.dead);
            if (!pool.length) break;
            const t = pool[Math.floor(random01() * pool.length)];
            const cue = attackCue(type);
            yield { kind: 'windup', targets: [t], ...(cue ? { cue } : {}) };
            const dealt = hitFoe(ctx, t, +m[1], type, caster, i + 1).dealt;
            total += dealt;
            log(`[[icon:play]] <b>${esc(ctx.card.name)}</b>：第 ${i + 1}/${times} 段 → <b>${esc(t.name)}</b>（${dealt} 点）`, 'sys');
            hits++;
            yield { kind: 'hit', segment: i + 1, ...(cue ? { cue } : {}) };
          }
          if (hits) {
            log(`[[icon:play]] <b>${esc(ctx.card.name)}</b> → 随机敌人 ×${hits}：造成 <b>${total}</b> 点${combat.TYPE_NAME[type]}`, 'sys');
            ctx.did = true;
          }
        }),
      },
      {
        id: 'dmg.direct', gate: 'always', label: '造成 N 点固定/法术/真实/攻击伤害（结构化已结算时跳过）',
        // 卡面伤害词条已结算过时跳过，防双倍；「消耗该牌时」前缀句只在消耗触发点结算。
        // 「连开 N 枪」延迟段由 dmg.fourShots 专责结算（2026-09-16 修 09-13 留言「正午决战有bug」：
        // 此前本步骤抢先吃掉「每枪造成2点固定伤害」，四枪只打出一枪 2 点）。
        // 区间触发句（触发 M-K 次）归 dmg.randomRepeat——此处排除防双结算（2026-09-23 第十二批）。
        // 位置在诅咒处理之后：流血药水类「造成 N 点伤害，附加流血」需要伤害与诅咒都结算
        when: (ctx) => (!ctx.flags.structuredHit && !/该牌时/.test(ctx.desc) && !/连开\s*[一二三四五六七八九十\d]+\s*枪/.test(ctx.desc)
            && !/触发\s*\d+\s*[-–~至]\s*\d+\s*次/.test(ctx.desc))
          ? ((rg => rg ? [null, rg[1], '法术', rg[2]] : null)(ctx.desc.match(/造成\s*(\d+)\s*[-–~至]\s*(\d+)\s*点法(?:术)?伤/))
            || (sp => sp ? [null, sp[1], '法术'] : null)(ctx.desc.match(/造成\s*(\d+)\s*点法(?:术)?伤/))
            || ctx.desc.match(/造成\s*(\d+)\s*点(?:\s*(固定|法术|真实|攻击))?\s*伤害/))
          : null,
        run: paced(function* (ctx, tdm) {
          const type = tdm[2] === '法术' ? combat.TYPES.SPELL
            : tdm[2] === '真实' ? combat.TYPES.TRUE
            : tdm[2] === '攻击' ? combat.TYPES.ATTACK : combat.TYPES.FIXED;
          // 区间伤害（tdm[3]=上限，第十二批 不稳定射线 4-6）：含端点掷骰
          const amount = tdm[3] != null
            ? Math.min(+tdm[1], +tdm[3]) + Math.floor(random01() * (Math.abs(+tdm[3] - +tdm[1]) + 1))
            : +tdm[1];
          const aoe = /所有敌人|敌方全体|全体敌人|目标为全体|对全体/.test(ctx.desc);
          const targets = (aoe ? getAlive().slice() : (ctx.curseTarget ? [ctx.curseTarget] : [])).filter(t => t && !t.dead);
          const caster = getPlayerCaster ? getPlayerCaster() : {};
          let total = 0;
          const cue = attackCue(type);
          if (targets.length) yield { kind: 'windup', targets, ...(cue ? { cue } : {}) };
          for (const t of targets) {
            total += hitFoe(ctx, t, amount, type, caster).dealt;
          }
          if (targets.length) yield { kind: 'hit', ...(cue ? { cue } : {}) };
          if (targets.length) {
            log(`[[icon:play]] <b>${esc(ctx.card.name)}</b> → ${targets.map(t => esc(t.name)).join('、')}：造成 <b>${total}</b> 点${combat.TYPE_NAME[type]}`, 'sys');
            ctx.did = true;
          }
        }),
      },
      {
        id: 'dmg.fourShots', gate: 'fresh', label: '连开四枪（4×2 固定）',
        when: (ctx) => /连开\s*四\s*枪/.test(ctx.desc) ? true : null,
        run: paced(function* (ctx) {
          const { total, hitTargets } = yield* repeatLiveTargets(ctx, ctx.curseTarget, 4, 2, combat.TYPES.FIXED, {}, '（连开四枪）');
          log(`[[icon:swords]] <b>连开四枪</b>：${hitTargets.map(t => esc(t.name)).join('、') || '无目标'}，共 ${total} 点固定伤害（每枪 2 点）`, 'sys');
          ctx.did = true;
        }),
      },
      {
        id: 'dmg.multiAttack', gate: 'fresh', label: '「攻击 N 次」整句（手选消耗后的尾段）',
        when: (ctx) => ctx.desc.match(/^攻击\s*(\d+)\s*次[。.！!]?$/),
        run: paced(function* (ctx, m) {
          const caster = getPlayerCaster ? getPlayerCaster() : {};
          const times = Math.max(1, +m[1]);
          const { total, hitTargets } = yield* repeatLiveTargets(ctx, ctx.curseTarget, times, 0, combat.TYPES.ATTACK, caster, '（攻击）');
          if (hitTargets.length) log(`[[icon:swords]] <b>${esc(ctx.card.name)}</b>：攻击 <b>${hitTargets.length}/${times}</b> 次，共造成 <b>${total}</b> 点攻击伤害`, 'sys');
          ctx.did = true;
        }),
      },
      {
        id: 'dmg.atkDown', gate: 'fresh', label: '降低敌人攻击（割蚀）',
        when: (ctx) => ctx.desc.match(/降低\s*(?:(\d+)\s*名?)?\s*敌人\s*(\d+)\s*攻/),
        run: (ctx, m) => {
          const t = ctx.curseTarget;
          if (t && !t.dead) {
            t.atk = Math.max(0, (t.atk || 0) - +m[2]);
            log(`[[icon:arrow]] <b>${esc(t.name)}</b> 攻击力降低 ${m[2]} 点（当前 ${t.atk}）`, 'sys');
            ctx.did = true;
          }
        },
      },
      {
        id: 'dmg.stealAtk', gate: 'fresh', label: '偷取攻击至 1 点（影噬）',
        when: (ctx) => /偷取[^。]*?攻击/.test(ctx.desc) ? true : null,
        run: (ctx) => {
          const t = ctx.curseTarget;
          if (t && !t.dead && (t.atk || 0) > 1) {
            const stolen = t.atk - 1;
            t.atk = 1;
            t._stealRestore = (t._stealRestore || 0) + stolen;
            t._stealRestoreTurn = ctx.turn;
            t._stealRestoreTurn = ctx.turn;
            t._stealRestoreTurn = ctx.turn;
            combat.addBlessing(ctx.pstat, 'atkUp', stolen, 1);
            log(`[[icon:arrow]] <b>偷取攻击</b>：<b>${esc(t.name)}</b> 的攻击力被压到 1，你获得攻击力 +${stolen}（各自 1 回合后还原）`, 'sys');
            ctx.did = true;
          }
        },
      },
      {
        id: 'curse.extendFreeze', gate: 'fresh', label: '延长冰冻（坚冰结界）',
        when: (ctx) => ctx.desc.match(/延长[^。]*?冰冻[^。]*?(\d+)\s*回合/),
        run: (ctx, m) => {
          const t = ctx.curseTarget;
          if (t && (t.status.freeze || 0) > 0) {
            t.status.freeze += +m[1];
            log(`[[icon:crystal]] <b>${esc(t.name)}</b> 的冰冻延长 ${m[1]} 回合（剩 ${t.status.freeze} 回合）`, 'sys');
          } else {
            log(`[[icon:crystal]] 目标未被冰冻，延长无效`, 'dim');
          }
          ctx.did = true;
        },
      },
      {
        id: 'curse.randomKinds', gate: 'fresh', label: '附加 N 种/层随机诅咒（致命射线 / 感染射线）',
        // 第十二批·感染射线（2026-09-23）：量词扩到「层」、数词支持中文（一层随机诅咒）
        when: (ctx) => ctx.desc.match(/附加\s*(\d+|[一二两三四五])\s*[种层]随机诅咒/),
        run: (ctx, m) => {
          const n = num(m[1]);
          const keys = ['bleed', 'poison', 'freeze', 'silence', 'abreak', 'healban', 'burn']
            .sort(() => random01() - 0.5)
            .slice(0, n);
          const t = ctx.curseTarget;
          if (t) {
            keys.forEach(k => combat.addCurse(t, k, 1));
            log(`[[icon:skull]] <b>${esc(t.name)}</b> 附加了 ${keys.length} 种随机诅咒`, 'sys');
            ctx.did = true;
          }
        },
      },
      {
        id: 'curse.doomGate', gate: 'fresh', label: '末日浩劫之门：全体各 1 层随机诅咒（优先不重复）',
        when: (ctx) => /对所有敌方(?:角色)?各施加(?:一|1)层随机诅咒/.test(ctx.desc) ? true : null,
        run: (ctx) => {
          const keys = ['bleed', 'poison', 'freeze', 'silence', 'abreak', 'healban', 'burn'];
          let hit = 0;
          getAlive().slice().forEach(t => {
            const fresh = keys.filter(k => !((t.status[k] || 0) > 0));
            const pool = fresh.length ? fresh : keys;
            const k = pool[Math.floor(random01() * pool.length)];
            combat.addCurse(t, k, 1);
            hit++;
          });
          if (hit) { log(`[[icon:skull]] <b>末日浩劫之门</b>：对 ${hit} 名敌人各施加 1 层随机诅咒（优先不重复）`, 'sys'); ctx.did = true; }
        },
      },
      {
        id: 'summon.morphRandom', gate: 'fresh', label: '变成随机招式卡牌、费用为 0（神秘药水回合开始）',
        when: (ctx) => ctx.desc.match(/变成\s*(\d+|一)\s*张随机\s*(招式|武术|法术)?\s*卡牌/),
        run: (ctx, m) => {
          const want = m[2] === '法术' ? '法术' : '武术';
          const pool = allCards().filter(c => c.type === want && c.rarity !== '衍生' && !['生物', '事件'].includes(c.type));
          const c = pool.length ? pool[Math.floor(random01() * pool.length)] : null;
          if (c) {
            addTempCard({ ...c, cost: 0, _baseCost: c.cost || 0 });   // _baseCost：费用角标显示绿色「降费」（需求 #16）
            log(`[[icon:flask]] 神秘变化：变成【<b>${esc(c.name)}</b>】（招式，费用已降为 0）`, 'loot');
          } else log('[[icon:flask]] 卡牌库是空的，什么也没有变成', 'dim');
          ctx.did = true;
        },
      },
      {
        id: 'summon.randomKeyedZero', gate: 'fresh', label: '获得随机「箭矢/火球/药水…」并降为 0 费（天狼长弓）',
        when: (ctx) => ctx.desc.match(/获得\s*(?:(\d+)|一)?\s*张?随机的?[‘“「]?(箭矢?|火球|药水|招式|初始攻击|杀)[’”」]?/),
        run: (ctx, m) => {
          const key = m[2] === '箭矢' ? '箭' : m[2];
          const pool = allCards().filter(c => c.rarity !== '衍生' && !['生物', '事件'].includes(c.type) &&
            (key === '杀' ? (c.id === 'starter-attack' || c.name === '杀' || c.name === '初始攻击')
              : key === '招式' ? c.type === '武术'
              : String(c.name || '').includes(key)));
          // 2026-09-13：卡库没有「箭」——回落到战斗令牌模板（天狼长弓的箭矢来源）
          const c = pool.length ? pool[Math.floor(random01() * pool.length)] : (key === '箭' ? ARROW_TOKEN : null);
          if (c) {
            addTempCard({ ...c, cost: 0, _baseCost: c.cost || 0 });
            log(`[[icon:cards]] 获得【<b>${esc(c.name)}</b>】，其费用已变为 0`, 'loot');
          } else log(`[[icon:question]] 找不到随机的「${esc(key)}」（占位）`, 'warn');
          ctx.did = true;
        },
      },
      {
        id: 'curse.enumeration', gate: 'fresh', label: '诅咒枚举句「(N′)冰冻、流血、中毒」',
        when: (ctx) => ctx.desc.match(/^(?:(\d+)\s*′\s*)?((?:冰冻|流血|中毒|沉默|破甲|禁疗|灼烧)(?:[、，]\s*(?:冰冻|流血|中毒|沉默|破甲|禁疗|灼烧))*)$/),
        run: paced(function* (ctx, m) {
          const t = ctx.curseTarget;
          if (t) {
            const keyMap = { '冰冻': 'freeze', '流血': 'bleed', '中毒': 'poison', '沉默': 'silence', '破甲': 'abreak', '禁疗': 'healban', '灼烧': 'burn' };
            if (m[1]) {
              const cue = attackCue(combat.TYPES.SPELL);
              yield { kind: 'windup', targets: [t], ...(cue ? { cue } : {}) };
              hitFoe(ctx, t, +m[1], combat.TYPES.SPELL, getPlayerCaster ? getPlayerCaster() : {});
              yield { kind: 'hit', ...(cue ? { cue } : {}) };
            }
            m[2].split(/[、，]\s*/).forEach(w => combat.addCurse(t, keyMap[w], 1));
            log(`[[icon:skull]] <b>${esc(t.name)}</b> 附加：${esc(m[2])}${m[1] ? `（并受到 ${m[1]} 点法术伤害）` : ''}`, 'sys');
            ctx.did = true;
          }
        }),
      },
      {
        id: 'dmg.fireballN', gate: 'fresh', label: '施放 N 次火球（星陨之力）',
        when: (ctx) => (ctx.curseTarget ? ctx.desc.match(/施放\s*(\d+)\s*次?火球(?:术)?/) : null),
        run: paced(function* (ctx, m) {
          const caster = getPlayerCaster ? getPlayerCaster() : {};
          const { total, hitTargets } = yield* repeatLiveTargets(ctx, ctx.curseTarget, +m[1], 4, combat.TYPES.SPELL, caster, '（火球）');
          log(`[[icon:fire]] <b>${esc(ctx.card.name)}</b>：施放 ${hitTargets.length} 次火球${hitTargets.length === +m[1] ? '' : `（计划 ${m[1]} 次）`} → ${hitTargets.map(t => esc(t.name)).join('、') || '无目标'}，共 ${total} 点法术伤害`, 'sys');
          ctx.did = true;
        }),
      },
      {
        id: 'dmg.stormFireball', gate: 'fresh', label: '全体敌人每人 1 次火球（风暴火球）',
        when: (ctx) => ctx.desc.match(/(?:每个?敌人|全体敌人|敌方全体)每人?释放\s*(?:(\d+)\s*次)?火球/),
        run: paced(function* (ctx, m) {
          const caster = getPlayerCaster ? getPlayerCaster() : {};
          const per = m[1] ? +m[1] : 1;
          const initialTargets = getAlive().filter(t => t && !t.dead);
          const planned = initialTargets.length * per;
          let total = 0, sequence = 0;
          const hitTargets = [];
          for (const original of initialTargets) {
            let preferred = original;
            for (let k = 0; k < per; k++) {
              let target = preferred && !preferred.dead ? preferred : getAlive().find(foe => foe && !foe.dead);
              if (!target) break;
              const cue = attackCue(combat.TYPES.SPELL);
              yield { kind: 'windup', targets: [target], ...(cue ? { cue } : {}) };
              target = preferred && !preferred.dead ? preferred : getAlive().find(foe => foe && !foe.dead);
              if (!target) break;
              sequence++;
              const dealt = hitFoe(ctx, target, 4, combat.TYPES.SPELL, caster, sequence).dealt;
              total += dealt;
              hitTargets.push(target);
              log(`[[icon:fire]] 火球风暴：第 ${sequence}/${planned} 发 → <b>${esc(target.name)}</b>（${dealt} 点）`, 'sys');
              preferred = target;
              yield { kind: 'hit', segment: sequence, ...(cue ? { cue } : {}) };
            }
            if (sequence >= planned) break;
          }
          log(`[[icon:fire]] 火球风暴：对全体初始敌人各施放 ${per} 次火球，实际 ${sequence}/${planned} 发，共 ${total} 点法术伤害`, 'sys');
          ctx.did = true;
        }),
      },
      {
        id: 'dmg.selfReceived', gate: 'fresh', label: '受到 N 点伤害（自伤）',
        when: (ctx) => ctx.desc.match(/受到\s*(\d+)\s*点?伤害/),
        run: (ctx, m) => {
          if (typeof damagePlayer !== 'function') return;
          damagePlayer(+m[1]);
          ctx.did = true;
        },
      },
      {
        id: 'buff.maxHpUp', gate: 'always', label: '血量上限 +N（混沌之眼）',
        when: (ctx) => ctx.desc.match(/血量上限\s*\+\s*(\d+)/),
        run: (ctx, m) => {
          if (typeof addPlayerMaxHp !== 'function') return;
          addPlayerMaxHp(+m[1]);
          ctx.did = true;
        },
      },
      {
        id: 'hand.dumpAll', gate: 'fresh', label: '消耗所有手牌（金蝉脱壳）',
        when: (ctx) => (/消耗(?:所有|全部)(?:的)?手牌/.test(ctx.desc) && typeof dumpHand === 'function') ? true : null,
        run: (ctx) => {
          const nDump = dumpHand();
          log(`[[icon:flask]] 消耗了所有手牌（${nDump} 张）`, 'sys');
          ctx.did = true;
        },
      },
      {
        id: 'buff.dodge', gate: 'fresh', label: '闪避：本回合避开第 N 段伤害',
        when: (ctx) => ctx.desc.match(/避开第\s*(\d+)\s*段伤害/),
        run: (ctx, m) => {
          const n = +m[1] || 1;
          // 09-20 老板定版：闪避=免疫下一次攻击（完整避开该段伤害），不是获得减伤——
          // dodge 祝福按层计数每层挡 1 次攻击；「本回合」口径沿用 turns=1 回合末过期
          combat.addBlessing(ctx.pstat, 'dodge', n, 1);
          log(`[[icon:shield]] <b>闪避</b>：接下来 ${n} 次攻击将被完全避开${n > 1 ? '（各消耗 1 层）' : ''}`, 'ok');
          ctx.did = true;
        },
      },
  
  ];
}

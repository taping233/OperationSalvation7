import { attackCue } from '../view/battle.attack-cues.js';

// B5 诅咒日志动词：逐字对齐文本路径 effect-steps.curse.js 的 run 文案（图标不在此表——
// 统一取 combat.CURSE_META[kind].icon，保证与 combat.js 枚举单源）。括注部分为卡面语义解释，
// 与 steps 同款，便于两条路径的日志互相检索比对。
const CURSE_VERBS = {
  bleed: n => `附加 ${n} 层流血`,
  poison: n => `附加 ${n} 层中毒（每层回合末 1 点固定伤害）`,
  freeze: n => `被冰冻 ${n} 回合（无法行动）`,
  silence: n => `被沉默 ${n} 回合（技能无效，攻击除外）`,
  abreak: n => `破甲 ${n} 回合（无法减免伤害——元素庇幕失效）`,
  healban: n => `禁疗 ${n} 回合（无法回复生命）`,
  atkDown: n => `攻击力降低（${n} 回合后归还，扣减量见日志）`,
};

// B7 blessing 两型（schema BLESSING_KEYS 六键的运行时收口，语义与 combat.js BUFF_META 单源）：
// value 型叠层相加（addBlessing 第 4 参 turns>0 到期扣回）；timed 型取「剩余较大值」（n 即回合数）。
const BLESSING_VALUE_KEYS = new Set(['atkUp', 'spellUp', 'reduce', 'dodge']);
const BLESSING_TIMED_KEYS = new Set(['stealth', 'immune']);

/** Structured status operations over explicit commands; no retained battle state. */
export function createStatusOperations({ combat, getAliveFoes, randomBattle, getPlayerStatus,
  handMoveCurses, m2Deps, getDamageTypeMeta, fixedDamageType, addPlayerCurse,
  canApplyPlayerCurse, applyAtkDown, esc, log }) {
  // —— A3 第二批（B5 诅咒族，2026-09-25）：结构化 curse op 结算 ——
  // 底层与文本路径（effect-steps.curse.js / .damage.js / .kills.js）共用同一 combat 端口：
  // 同一状态袋（target.status）、同一天花板语义（combat.addCurse：叠层相加 / 计时取较大 /
  // 龙巢 noCurseKeys 免疫返回 0 / NaN 兜底按 1 层）、同一毒伤公式（combat.tickPoison：
  // 每层 1 点固定伤害、不衰减、免疫挡下）、同一日志文案（CURSE_VERBS 对齐 steps，图标取 CURSE_META）。
  // 单 op 内顺序：施加（extend 存在则整体改走「延长」语义）→ double 翻倍 → burst 引爆——
  // 与花鸩（先翻倍后引爆）、棘刺之地（先附加后引爆）的文本路径步序一致。
  // 演出：windup → 结算 → hit，与 damage 段（castSegment）同一节奏。
  function* resolveCurseOperation(card, operation, preferredTarget, boundTargets) {
    const isStacking = kind => !!combat.CURSE_META[kind]?.stack;
    // chosenEnemy 绑定原选目标，倒下后跳过附加效果；randomEnemy 独立掷存活敌人；
    // self 指玩家自身（getPlayerStatus，不在 foes 里，windup 由 staged-playback 按 foeIdx<0 跳过）；
    // bindTarget:'prevDamage'（M2，血毒双镖式段绑定）→ 目标沿用同一 onPlay 内前一 damage 段实际命中者。
    const pickTargets = () => {
      if (operation.target === 'allEnemies') return getAliveFoes();
      if (operation.target === 'randomEnemy') {
        const alive = getAliveFoes();
        return alive.length ? [alive[Math.floor(randomBattle() * alive.length)]] : [];
      }
      if (operation.bindTarget === 'prevDamage') {
        return (boundTargets || []).filter(foe => foe && !foe.dead);
      }
      if (operation.target === 'self') return [getPlayerStatus()].filter(Boolean);
      return [preferredTarget ? (preferredTarget.dead ? null : preferredTarget) : getAliveFoes()[0]].filter(Boolean);
    };
    // 施加量：叠层型取 stacks（bleed/poison，具名施加时 schema 必填）；计时型取 duration（schema 必填）。
    // randomKinds/source handMoves 不携带 stacks——抽中/扫描到的叠层型固定 1 层；计时型
    // 默认 1 回合；operation.duration 若存在则优先（向前兼容，键不静默丢弃）。
    const amountFor = kind => isStacking(kind)
      ? (operation.randomKinds !== undefined || operation.source !== undefined
        ? 1
        : operation.stacks)
      : (Number.isInteger(operation.duration) ? operation.duration : 1);
    const drawKinds = () => {
      if (operation.source === 'handMoves') {
        // M2：source:'handMoves'——直接消费扫描器逐卡解析出的层数/时长，不再把卡面值压成默认 1。
        return handMoveCurses(m2Deps).map(entry => typeof entry === 'string'
          ? { kind: entry, amount: amountFor(entry) } : entry);
      }
      if (operation.randomKinds === undefined) return [{ kind: operation.curse, amount: amountFor(operation.curse) }];
      // 随机 n 种**不同**诅咒：池与顺序同 combat.CURSES；洗牌写法与文本路径 curse.randomKinds 逐字
      // 同款（.sort(() => r - 0.5)——分布有偏是已知债，为保持两路径掷骰序列一致不改）。
      // M2：atkDown 需 amount 扣减量参数，不参与「各 1 层/1 回合」的随机施加，池中排除。
      const pool = combat.CURSES.filter(k => k !== 'atkDown').sort(() => randomBattle() - 0.5);
      return pool.slice(0, operation.randomKinds).map(kind => ({ kind, amount: amountFor(kind) }));
    };
    // 数据健壮性：schema 已拦非法键，这里再滤一次未知诅咒名（防查表崩结算）。
    const kinds = drawKinds().filter(entry => combat.CURSE_META[entry.kind] && CURSE_VERBS[entry.kind]);
    if (!kinds.length) {
      if (operation.source === 'handMoves') log(`[[icon:cross]] <b>${esc(card.name)}</b>：手牌中没有带诅咒的招式`, 'dim');
      return false;
    }
    const windupTargets = pickTargets();
    if (!windupTargets.length) return false;
    const type = getDamageTypeMeta()[card.dmgType] ? card.dmgType : fixedDamageType;
    const cue = attackCue(type, card);
    yield { kind: 'windup', targets: windupTargets, ...(cue ? { cue } : {}) };
    // windup 后重算目标（damage 段同款：演出等待期间点选目标可能倒下——同卡先前的 damage 段即可致死）
    const targets = pickTargets().filter(foe => foe && !foe.dead);
    if (!targets.length) return false;
    const appliedKinds = new Map();
    const applyCurseTo = (foe, kind, amount, track = true) => {
      const result = operation.target === 'self' && typeof addPlayerCurse === 'function'
        ? addPlayerCurse(kind, amount) : combat.addCurse(foe, kind, amount);
      if (track && result > 0) {
        if (!appliedKinds.has(kind)) appliedKinds.set(kind, new Set());
        appliedKinds.get(kind).add(foe);
      }
      return result;
    };
    const nameOf = foe => `<b>${esc(foe.name || '自身')}</b>`;
    // —— 施加（或延长）——
    if (operation.extend !== undefined) {
      // extend（坚冰结界「延长冰冻 1 回合」）走**延长语义**：只给目标身上已有的计时诅咒 +n 回合，
      // 不新挂诅咒——与文本路径 curse.extendFreeze 同款（目标未被冰冻 → 记「延长无效」）。
      // 取舍：schema 对计时诅咒强制要求 duration，带 extend 的 op 其 duration 因此不参与施加
      //（否则未冰冻目标会被白嫖挂上 duration+extend 回合的冻结，偏离卡面「延长」的措辞）。
      for (const foe of targets) {
        for (const { kind } of kinds) {
          const meta = combat.CURSE_META[kind];
          if (isStacking(kind)) {
            log(`${meta.icon} ${nameOf(foe)} 的${meta.name}是叠层诅咒，没有可延长的持续时间`, 'dim');
            continue;
          }
          const current = +(foe.status?.[kind] || 0);
          if (current > 0) {
            if (operation.target === 'self' && !canApplyPlayerCurse()) continue;
            // 延长不属于新施加，不广播 onFreeze 等施加事件。
            foe.status[kind] = current + operation.extend;
            log(`${meta.icon} ${nameOf(foe)} 的${meta.name}延长 ${operation.extend} 回合（剩 ${foe.status[kind]} 回合）`, 'sys');
          } else {
            log(`${meta.icon} 目标未被${meta.name}，延长无效`, 'dim');
          }
        }
      }
    } else if (operation.randomKinds !== undefined || operation.source === 'handMoves') {
      // randomKinds：各抽中的诅咒按 1 层 / 1 回合施加；日志与文本路径同款（一行汇总不逐种列名，
      // 层数与剩余回合由状态角标呈现）。免疫（龙巢 noCurseKeys）时 addCurse 返回 0，不计入。
      let applied = 0;
      for (const { kind, amount } of kinds) {
        for (const foe of targets) if (applyCurseTo(foe, kind, amount) > 0) applied++;
      }
      if (applied > 0) {
        // 日志主语口径对齐文本路径：单体带尾随空格（<b>名</b> 附加…），「全体敌人」紧贴动词（全体敌人附加…）
        const subject = targets.length > 1 ? '全体敌人' : `${nameOf(targets[0])} `;
        const label = operation.source === 'handMoves'
          ? `附加手牌招式的诅咒（${kinds.length} 种）` : `附加了 ${kinds.length} 种随机诅咒`;
        log(`[[icon:skull]] ${subject}${label}`, 'sys');
      }
    } else {
      // 具名诅咒：逐目标 addCurse（叠层相加 / 计时取较大）；只对真正生效的目标记日志
      //（免疫返回 0 不记——与结构化 status 冰冻分支同口径）。
      const [{ kind, amount }] = kinds;
      const meta = combat.CURSE_META[kind];
      const affected = targets.filter(foe => applyCurseTo(foe, kind, amount) > 0);
      if (affected.length) {
        // 日志主语口径对齐文本路径：单体/逐名带尾随空格（<b>名</b> 附加…），全体紧贴动词（全体敌人附加…）；
        // 部分生效（免疫等）时逐名列名，与结构化 status 冰冻分支同款。
        const allAffected = affected.length > 1 && affected.length === targets.length;
        const subject = allAffected ? '全体敌人' : `${affected.map(nameOf).join('、')} `;
        log(`${meta.icon} ${subject}${CURSE_VERBS[kind](amount)}`, 'sys');
      }
    }
    // —— double（花鸩「中毒层数翻倍」）：与文本路径 curse.poisonDouble 同一 API——
    // 再叠自身当前层数即翻倍。计时诅咒没有层数（addCurse 取较大值也翻不动），只记日志不改状态。
    // 叠层型在合法数据下必经上方施加步（stacks schema 必填），current>0 兜底主要防免疫/异常数据。
    if (operation.double === true) {
      for (const foe of targets) {
        for (const { kind } of kinds) {
          const meta = combat.CURSE_META[kind];
          const current = +(foe.status?.[kind] || 0);
          if (!isStacking(kind)) {
            log(`${meta.icon} ${nameOf(foe)} 的${meta.name}是计时诅咒，没有可翻倍的层数（剩 ${current} 回合）`, 'dim');
          } else if (current > 0) {
            const after = applyCurseTo(foe, kind, current);
            log(`${meta.icon} ${nameOf(foe)} ${meta.name}翻倍至 ${after} 层`, 'sys');
          } else {
            log(`${meta.icon} ${nameOf(foe)} 当前没有${meta.name}层数，翻倍无效`, 'dim');
          }
        }
      }
    }
    // —— burst（毒爆 / 棘刺之地「立即触发 N 次毒伤」）：每发按当前全部层数走 combat.tickPoison
    //（既有毒伤公式，层数不衰减；目标无中毒该发计 0 点，免疫挡下计 0 点），对本 op 解析出的
    // 每个目标各引爆 n 次——allEnemies 即全体各 n 次。日志与文本路径 curse.poisonBurstN 逐字对齐。
    if (Number.isInteger(operation.burst) && operation.burst > 0) {
      for (const foe of targets) {
        let total = 0;
        for (let i = 0; i < operation.burst; i++) total += combat.tickPoison(foe)?.dealt || 0;
        log(`[[icon:skull]] ${nameOf(foe)} 毒伤引爆 ${operation.burst} 次，共 <b>${total}</b> 点固定伤害（${+(foe.status?.poison || 0)} 层中毒保留）`, 'sys');
      }
    }
    // —— M2：atkDown 侧效——挂诅咒后按 amount 扣攻并登记归还量（到期由回合管线归还）。
    // 具名/randomKinds 两条施加路径都经此处（source handMoves 抽到 atkDown 时扣减量缺省 1）。
    for (const { kind, atkAmount } of kinds) {
      if (kind !== 'atkDown') continue;
      const cut = Number.isInteger(atkAmount) ? atkAmount
        : operation.amount !== undefined && Number.isInteger(operation.amount) ? operation.amount : 1;
      for (const foe of appliedKinds.get(kind) || []) applyAtkDown(foe, cut);
    }
    yield { kind: 'hit', ...(cue ? { cue } : {}) };
    return true;
  }

  // —— A3 第三批（B7 G4 增益·祝福·能量族，2026-09-25）：结构化 blessing op 结算 ——
  // 与文本路径增益专支（effect-steps.curse.js buff.*、effect-steps.damage.js buff.dodge）共用
  // 同一 combat.addBlessing 与同一状态袋（getPlayerStatus().status）：
  // value 型（atkUp/spellUp/reduce/dodge，BUFF_META.value）叠层相加；第 4 参 turns>0 时按
  // __timedBuffs 到期扣回，缺省 0 = 本场战斗；timed 型（stealth/immune，BUFF_META.timed）取
  // 「剩余较大值」，n 即回合数（每回合结束 tickDurations 递减）。
  // duration 缺省口径（逐 key 对齐文本路径既有实现）：
  //   atkUp/spellUp/reduce → 本场战斗（buff.atkUp/buff.spellUp 无回合词时 turns=0；buff.reduce 恒本场）；
  //   dodge → 本回合（buff.dodge 固定 turns=1，09-20 老板定版「闪避=免疫下一次攻击，按层计数」）；
  //   stealth/immune → 1 回合（buff.stealth/buff.immune 无回合词时缺省 1）。
  // stacks/duration 组合：value 型 stacks=层数、duration=持续回合（两键语义独立、同时消费）；
  // timed 型无层数概念——duration 优先（回合语义），stacks 兜底按回合数解释（向前兼容防数据
  // 作者用错字段，键不静默丢弃），两键同带时以 duration 为准。
  // 日志：逐 key 逐字对齐文本路径 buff.* 模板（含「当前加成」读加祝福后的状态袋值）。
  function resolveBlessingOperation(operation) {
    const key = operation.key;
    if (!BLESSING_VALUE_KEYS.has(key) && !BLESSING_TIMED_KEYS.has(key)) return false;
    const pstat = getPlayerStatus();
    if (BLESSING_TIMED_KEYS.has(key)) {
      const turns = Number.isInteger(operation.duration) ? operation.duration
        : Number.isInteger(operation.stacks) ? operation.stacks : 1;
      combat.addBlessing(pstat, key, turns);
      if (key === 'stealth') {
        log(`[[icon:runner]] <b>祝福·潜行</b>：${turns} 回合内无法成为被攻击对象（造成伤害会破除）`, 'ok');
      } else {
        log(`[[icon:sparkles]] <b>祝福·免疫伤害</b>：${turns} 回合内不受到任何伤害`, 'ok');
      }
      return true;
    }
    const amount = Number.isInteger(operation.stacks) ? operation.stacks : 1;
    const turns = Number.isInteger(operation.duration) ? operation.duration : (key === 'dodge' ? 1 : 0);
    combat.addBlessing(pstat, key, amount, turns);
    const durLabel = turns > 0 ? `${turns} 回合` : '本场战斗';
    if (key === 'atkUp') {
      log(`[[icon:swords]] <b>祝福·攻击力增加</b>：攻击力 +${amount}（${durLabel}，当前加成 ${pstat.status.atkUp}）`, 'ok');
    } else if (key === 'spellUp') {
      log(`[[icon:crystal]] <b>祝福·法伤增加</b>：法术伤害 +${amount}（${durLabel}，当前加成 ${pstat.status.spellUp}）`, 'ok');
    } else if (key === 'reduce') {
      log(`[[icon:plate]] <b>祝福·减伤</b>：每次受到的伤害 -${amount}（${durLabel}）`, 'ok');
    } else {
      // dodge：日志逐字对齐文本路径 buff.dodge（默认本回合口径不加回合括注；显式 duration≠1 时补注）
      const durNote = Number.isInteger(operation.duration) && operation.duration !== 1 ? `（持续 ${turns} 回合）` : '';
      log(`[[icon:shield]] <b>闪避</b>：接下来 ${amount} 次攻击将被完全避开${amount > 1 ? '（各消耗 1 层）' : ''}${durNote}`, 'ok');
    }
    return true;
  }

  return { resolveCurseOperation, resolveBlessingOperation };
}

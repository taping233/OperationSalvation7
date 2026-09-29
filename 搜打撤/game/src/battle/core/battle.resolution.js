// Card resolution is isolated behind explicit state reads and domain commands.
import { attackCue } from '../view/battle.attack-cues.js';
// G3（A3 第三批）：获取池谓词单源——parsePoolNoun 是「发现/随机获取/获得 N 张 ____」句式
// 的限制卡池解析器（effect-steps.ctx.js 纯叶子模块，与文本路径 effect-steps 家族同一实现，
// 避免两份池名词清单漂移）。
import { parsePoolNoun } from '../effects/effect-steps.ctx.js';
// M 批契约扩展执行件（M1，2026-09-27）：cleanse / draw.untilHandN / draw.handOps。
// 实现体在 effect-steps.m1.js（新文件挂接，减小本文件 diff），本文件只保留注册点。
import { resolveCleanseOperation, resolveDrawUntilHandN, resolveDrawHandOps } from '../effects/effect-steps.m1.js';
// M 批契约扩展执行件第二批（M2，2026-09-27）：stealAtk/noDrawNext/extraTurn/execute/summon/
// registerRule/damage.onKill/curse.source handMoves/armor.consumeEquip/atkDown 侧效。
import {
  resolveStealAtk, resolveNoDrawNext, resolveExtraTurn, resolveExecute, resolveSummon,
  resolveRegisterRule, applyDamageOnKill, resolveConsumeEquip, applyAtkDown, countCurseKinds,
  handMoveCurses, isLastHandCard, resolveFoeFight, resolveCopyRandom,
} from '../effects/effect-steps.m2.js';

// Schema and runtime support share the same complete-list boundary at every battle entry.
import { assertCardRulesExecutable } from '../effects/battle.rule-guard.js';
import { getHostedExecutionCard } from '../effects/battle.hosted.js';

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
  burn: n => `被灼烧（${n} 回合内每回合结束受 1 点固定伤害，不叠加）`,
  atkDown: n => `攻击力降低（${n} 回合后归还，扣减量见日志）`,
};

// B7 blessing 两型（schema BLESSING_KEYS 六键的运行时收口，语义与 combat.js BUFF_META 单源）：
// value 型叠层相加（addBlessing 第 4 参 turns>0 到期扣回）；timed 型取「剩余较大值」（n 即回合数）。
const BLESSING_VALUE_KEYS = new Set(['atkUp', 'spellUp', 'reduce', 'dodge']);
const BLESSING_TIMED_KEYS = new Set(['stealth', 'immune']);

function createBattleResolution(ports) {
  const { readState, getPlayerStatus, esc, log, heal, addFloat, addDelayed, takeDeckBottom, deckBottomCount,
    startSurge, getAllCards, isRandomObtainable, randomBattle, getDamageTypes, getDamageTypeMeta,
    fixedDamageType, hasCurse, getAliveFoes, getGrowth, addArmor, applyStatus, findCard, addTempCard, queueDiscover,
    splitClauses, applyTextEffects, registerTurnStart, registerBattle, castRandomSpells,
    drawCards, grantSha, hitFoe, drawOf, isAOE, damagePlayer, getPlayerHp, countDrawnSpells, getHandSize,
    // G3（A3 第三批）端口：addDeckCard/shuffleDeck 洗入牌库（deck.insert 文本路径同一底层）；
    // randomDiscoverCard 随机池/指定池单源抽卡（battle.selection-flow.js，pred 指定池与通用池
    // isRandomObtainable 口径都在其内部）；addCoins 战斗币（与 applyKillRewards/bag 同一 G.coins 计数）；
    // getMyClass 供「本职业/其它职业」池谓词判定（parsePoolNoun 第二参）。
    addDeckCard, shuffleDeck, randomDiscoverCard, addCoins, getMyClass,
    // B7（A3 第三批）端口：能量/上限资源命令——命令体与文本路径 res.energy/res.energyCap
    // （effect-steps.tail.js 经 applyTextEffects 用的同一批引擎命令）、开战被动 addPlayerMaxHp
    // 逐字同款（见 battle.engine.js resolution 端口装配处注释）。
    addEnergy, addEnergyCap, addPlayerMaxHp,
    // B5 端口：combat 为引擎侧包装后的 combat 命名空间（与文本路径 effect-steps 同一份对象）——
    // addCurse 负责状态袋与 cursefx 彩闪、tickPoison 负责毒伤引爆、CURSES/CURSE_META 供随机池与图标单源。
    combat,
    // M2（2026-09-27）端口：偷取/禁抽/额外回合/持续规则旗标/随从位/价格与牌库定向抽取——
    // 命令体与文本路径专支同一批引擎函数（engine 端口装配处透传，不新增引擎逻辑）。
    markNoDrawNext, setExtraTurn, setBleedAmp, setMeleeCost1, setSpellCost1,
    summonAlly, getPriceOfLastDrawn, deckDraw, getTurn, getPlayerSpellPower, setNextSpellTwice,
  } = ports;
  // 吸血/回复等量生命公共体（09-29 jscpd 收敛批，PENDING #12 档一）：
  // 结构化路径 operation.lifesteal 与文本路径「回复等量生命」同语义，统一禁疗判定与演出。
  const applyLifesteal = total => {
    if ((getPlayerStatus().status.healban || 0) > 0) {
      log(`[[icon:heart]] 禁疗中：吸血回复无效（还剩 ${getPlayerStatus().status.healban} 回合）`, 'warn');
      return;
    }
    heal(total);
    addFloat({ unit: 'self', text: '', cls: 'stk sticker-heal', warm: true });
    log(`[[icon:heart]] 吸血：回复 ${total} 点生命`, 'ok');
  };
  // M1（M 批契约扩展，2026-09-27）：effect-steps.m1.js 的注入端口收口——
  // 全部来自本文件既有端口，不新增引擎侧装配点。
  const m1Deps = { combat, getPlayerStatus, drawCards, grantSha, countDrawnSpells, findCard, log, esc,
    onHandConsumed: ports.onHandConsumed };
  // M2（M 批契约扩展第二批，2026-09-27）：effect-steps.m2.js 的注入端口收口。
  const m2Deps = {
    combat, getAliveFoes, findCard, addCoins, addArmor, log, esc,
    sweepDead: ports.sweepDead,
    markNoDrawNext, setExtraTurn, setBleedAmp, setMeleeCost1, setSpellCost1,
    summonAlly, hitFoe, getTurn, getPlayerStatus, getPlayerSpellPower,
    random: randomBattle,
    addTempCard, setNextSpellTwice,
    foeDealDamage: (attacker, target, amount) => combat.dealDamage(attacker, target, amount, 'attack'),
  };
  // B1：伤害条件对象（schema CONDITION_KEYS 共用形状）。
  // 口径对照：foeHpBelow 以「血量 ≤ n」承接斩杀「对 9 血以下」（与 hpCap 同口径）；
  // foeHpHalf 以「血量 ≤ 上限一半」承接惩击 halfB；foeStatus 查目标身上的诅咒层；
  // foeFullHp 以「本段伤害结算前当前满血」承接冷冻射线类「未曾受到过伤害」判定；
  // anyCurse（M2）以「目标身负任意诅咒」承接暗影射击类条件。
  function conditionMatches(cond, foe) {
    if (!cond || typeof cond !== 'object') return true;
    if (cond.foeHpBelow !== undefined && !(foe.hp <= cond.foeHpBelow)) return false;
    if (cond.foeHpHalf === true && !(foe.maxHp && foe.hp <= foe.maxHp / 2)) return false;
    if (cond.foeStatus !== undefined && !((foe.status?.[cond.foeStatus] || 0) > 0)) return false;
    if (cond.foeFullHp === true && Number.isFinite(foe.maxHp) && foe.hp < foe.maxHp) return false;
    if (cond.anyCurse === true && !hasCurse(foe)) return false;
    return true;
  }

  // B1：区间掷骰（含端点）——与文本路径 dmg.direct 区间口径一致（不稳定射线 4-6）。
  function rollRange(range) {
    const min = Array.isArray(range) ? range[0] : 0;
    const max = Array.isArray(range) ? range[1] : min;
    return min + Math.floor(randomBattle() * (Math.abs(max - min) + 1));
  }

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
    // 目标解析与 damage 段同口径：chosenEnemy 倒下顺延战场首位；randomEnemy 施放时掷一名存活敌人；
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
      return [preferredTarget && !preferredTarget.dead ? preferredTarget : getAliveFoes()[0]].filter(Boolean);
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
    const cue = attackCue(type);
    yield { kind: 'windup', targets: windupTargets, ...(cue ? { cue } : {}) };
    // windup 后重算目标（damage 段同款：演出等待期间点选目标可能倒下——同卡先前的 damage 段即可致死）
    const targets = pickTargets().filter(foe => foe && !foe.dead);
    if (!targets.length) return false;
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
        for (const foe of targets) if (combat.addCurse(foe, kind, amount) > 0) applied++;
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
      const affected = targets.filter(foe => combat.addCurse(foe, kind, amount) > 0);
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
            const after = combat.addCurse(foe, kind, current);
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
      for (const foe of targets) {
        if ((foe.status?.atkDown || 0) > 0) applyAtkDown(foe, cut);
      }
    }
    yield { kind: 'hit', ...(cue ? { cue } : {}) };
    return true;
  }

  // —— A3 第三批（G3 acquire 族，2026-09-25）：结构化 acquire/coins 结算 ——
  // 语义真源：docs/cards/card-rules-v2-taxonomy-2026-09-25.md §3「卡牌获取与牌库」25 张效果一句话 + G3 行。
  // 池谓词（B6 定版「池谓词复用 parsePoolNoun 语义；注意 isRandomObtainable 口径」）：
  //   {kind:'moves', cost?} —— v1 discover 结构化池形状，与 selection-flow structuredPred 同款（武术 + 可选费用）；
  //   其他非空 kind —— 中文池名词直透 parsePoolNoun（'武术'/'装备'/'火球'/'2费招式'/'能施加诅咒的招式'/
  //   '传说或能力卡'…）；parsePoolNoun 未识别时再试 named 具体卡名通道（'二次爆炸'/'流光照影'——
  //   文本路径 deck.gainNamed 的 find-by-name 口径，parsePoolNoun 名词清单不含具体卡名）；
  //   仍无命中 → null = 通用随机池。
  // 随机抽卡单源 randomDiscoverCard（battle.selection-flow.js）：pred 指定池排除 生物/事件/资源/衍生、
  //   允许职业/传说特例（江湖救急类「其它职业」池必需）；无 pred 通用池内部走 isRandomObtainable
  //   （排除 初始/职业/衍生/棱彩/能力卡/生物/unrandom）并另排 道具/资源——与文本路径发现/随机获取同源，
  //   外层不再叠 isRandomObtainable（三重火球「2 张火球」的初始稀有度卡必须可指定获取）。
  function acquirePoolPred(pool, myClass) {
    if (!pool || typeof pool !== 'object' || typeof pool.kind !== 'string' || !pool.kind.trim()) return null;
    if (pool.kind === 'moves') {
      const cost = pool.cost;
      return card => card.type === '武术' && (cost === undefined || (+card.cost || 0) === cost);
    }
    const noun = parsePoolNoun(pool.kind, myClass);
    if (noun) return noun;
    // named 具体卡名（熔岩爆破「获得 1 张『二次爆炸』」/流光斩「将流光照影洗入牌库」）：
    // 精确同名卡存在才收窄为指定池，否则维持 null 交回通用池（与文本路径「未识别 → 通用池」一致）
    const named = typeof getAllCards === 'function' && getAllCards().find(c => c.name === pool.kind);
    return named ? card => card.name === pool.kind : null;
  }

  // dest 三向（G3 行「去向 hand|deck|discover」，缺省 discover——发现面板三选一是本域辨识度最高的
  // 获取途径，与 v1 discover op 口径连续）：
  //   'hand'    随机/指定直发置入手牌（addTempCard；江湖救急-改/基础开发/厄运/三重火球先例），同名可重复；
  //   'deck'    洗入牌库（addDeckCard + shuffleDeck，deck.insert 文本路径同一底层）——仅 BOSS 战有牌库；
  //             普通战无牌库时降级为直接置入手牌（deckDraw/grantSha 先例口径「普通战斗无牌库，改为直接获得」）；
  //   'discover' 走发现面板 queueDiscover（面板原生 n 展开、防重、act/费用修饰）。
  // act 修饰（G3 行「动作 play|playKeep|dup|zeroCost|decay|noInfuse」）按 dest×act 组合门放行：
  //   discover：play/playKeep/dup（面板原生 act，pickDiscover 直接施放/施放+入手/×2 置手）、
  //             zeroCost/decay（面板 zeroCost/decayEachTurn 费用修饰）——全部有既有机制承载；
  //             noInfuse 不支持（发现面板置入无免注能透传键；文本先例灵能召唤实为随机直发，应写 dest:'hand'）。
  //   hand：dup（本体+复制 ×2 置手，二刀流语义）、noInfuse（模板透传 _noInfuse，灵能召唤先例）；
  //         play/playKeep 需要面板外的直接施放执行通道（既有文本路径一律经发现面板承载）——pending；
  //         zeroCost/decay 需 cardOverrides/费用衰减登记（selection-flow 内部态，无对外端口）——pending。
  //   deck：dup（×2 洗入）、zeroCost（洗入模板静态 cost:0——铁甲阵「费用均-1」同款改模板法，
  //         卡在牌库中无费用修饰状态，抽出即 0 费）、noInfuse（模板透传）；
  //         play/playKeep 同 hand 理由 pending；decay（逐回合 -1 费）对牌库中的卡无结算观测点——pending。
  // dest×act and unconsumed filter are rejected by the complete-list capability guard.
  function resolveAcquireOperation(card, operation) {
    const myClass = typeof getMyClass === 'function' ? getMyClass() : null;
    // M2：pool.kind '牌库底'——从牌库底发现（搜索大宝箱「探宝」专支同款；普通战斗无牌库降级随机）
    if (operation.pool?.kind === '牌库底' && readState().mode === 'boss' && deckBottomCount()) {
      const take = Math.min(operation.n, deckBottomCount());
      const uids = takeDeckBottom(take);
      const cards = uids.map(u => { const o = findCard(u); return o ? o.card : null; }).filter(Boolean);
      if (cards.length) {
        queueDiscover({ n: cards.length, explicit: cards, explicitUids: uids, deckBottom: true });
        log(`[[icon:question]] <b>${esc(card.name)}</b>：翻开牌库底 ${cards.length} 张——选 1 张入手，其余放回牌库底`, 'loot');
        return true;
      }
    }
    // M1：filter 基础扩展——在池谓词上叠加 { type, cost, costMax } 约束（武装「抽 2 张装备牌」、
    // ev19 箭系列式需求的第一批）。named 具体卡名直取不受 filter 影响（指定获取语义，
    // 「获得 1 张『二次爆炸』」不存在再过滤）。filter 存在时随机抽卡走指定池口径
    // （randomDiscoverCard 的 pred 分支，排除 生物/事件/资源/衍生）。
    const basePred = acquirePoolPred(operation.pool, myClass);
    const filter = operation.filter;
    const filterPred = filter ? candidate => {
      if (filter.type !== undefined && candidate.type !== filter.type) return false;
      if (filter.cost !== undefined && (+candidate.cost || 0) !== filter.cost) return false;
      if (filter.costMax !== undefined && (+candidate.cost || 0) > filter.costMax) return false;
      if (Array.isArray(filter.exceptIds) && filter.exceptIds.includes(candidate.id)) return false;
      return true;
    } : null;
    const pred = basePred && filterPred ? candidate => basePred(candidate) && filterPred(candidate)
      : (filterPred || basePred);
    const dest = operation.dest || 'discover';
    const act = operation.act;
    // 面板日志的池名（文本路径 discover.pool 同款：名词去尾「的」+ 限制池括注）
    const label = pred ? String(operation.pool.kind === 'moves' ? '招式' : operation.pool.kind).replace(/的$/, '') : '';
    const poolSuffix = pred ? `【${esc(label)}】（限制卡池）` : '';
    // named 精确同名卡优先直取：「获得/将指定卡…」（熔岩爆破二次爆炸/三重火球火球/流光斩流光照影）
    // 是指定获取语义，与文本路径 deck.gainNamed/insertHand 同款——不得被发现池的
    // rarity=衍生/职业/unrandom 资格边界滤空（pred 谓词来自 named 兜底分支时才走此捷径，
    // parsePoolNoun 类型/系列谓词仍走随机池口径）。仅影响 acquire 路径，不碰 discover op。
    const namedExact = typeof getAllCards === 'function' && pred
      ? getAllCards().find(c => c.name === operation.pool.kind) : null;
    const drawOne = namedExact ? () => ({ ...namedExact }) : () => randomDiscoverCard(pred);
    // act 在直发路径的模板修饰：zeroCost 洗入模板静态 0 费（铁甲阵改模板先例）；noInfuse 透传 _noInfuse
    const decorate = tpl => {
      if (act === 'zeroCost') return { ...tpl, cost: 0 };
      if (act === 'noInfuse') return { ...tpl, _noInfuse: true };
      return { ...tpl };
    };

    if (dest === 'discover') {
      queueDiscover({
        n: operation.n,
        pred,
        act: ['play', 'playKeep', 'dup'].includes(act) ? act : undefined,
        zeroCost: act === 'zeroCost' ? true : undefined,
        decayEachTurn: act === 'decay' ? true : undefined,
        sourceCardId: card.id,
      });
      const actLabel = act === 'play' ? '发现并直接施放' : act === 'playKeep' ? '发现（施放 1 张，其余入手）'
        : act === 'zeroCost' ? '发现（入手后费用变为 0）' : act === 'decay' ? '发现（每回合开始费用 -1）' : '发现';
      log(`[[icon:question]] <b>${esc(card.name)}</b>：${actLabel} ${operation.n} 张${poolSuffix}卡牌`, 'sys');
      return true;
    }

    if (dest === 'deck') {
      // BOSS/普通双口径：BOSS 战洗入牌库并洗混；普通战无牌库，降级为直接置入手牌
      //（deckDraw/grantSha 同款先例「普通战斗无牌库，改为直接获得」）。
      const isBoss = readState().mode === 'boss';
      const gained = [];
      for (let k = 0; k < operation.n; k++) {
        const c = drawOne();
        if (!c) break;
        const tpl = decorate(c);
        for (let copy = 0; copy < (act === 'dup' ? 2 : 1); copy++) {
          if (isBoss) addDeckCard(act === 'dup' && copy === 1 ? { ...tpl } : tpl);
          else addTempCard(act === 'dup' && copy === 1 ? { ...tpl } : tpl);
        }
        gained.push(c.name);
      }
      if (gained.length) {
        const counts = {};
        gained.forEach(name => { counts[name] = (counts[name] || 0) + 1; });
        const detail = Object.keys(counts).map(name => `【${esc(name)}】×${counts[name] * (act === 'dup' ? 2 : 1)}`).join('、');
        if (isBoss) {
          const deckSize = shuffleDeck();
          log(`[[icon:recycle]] <b>${esc(card.name)}</b>：将 ${detail} 洗入牌库（牌库 ${deckSize} 张，已洗混）`, 'sys');
        } else {
          log(`[[icon:cards]] <b>${esc(card.name)}</b>：普通战斗无牌库，改为直接获得 ${detail}`, 'loot');
        }
      } else {
        log(`[[icon:question]] <b>${esc(card.name)}</b>：卡池里没有符合条件的卡牌`, 'dim');
      }
      return true;
    }

    // dest:'hand'——随机/指定直发置入手牌（同名可重复：三重火球「2 张火球」必需）
    const gained = [];
    for (let k = 0; k < operation.n; k++) {
      const c = drawOne();
      if (!c) break;
      // dup 复制体同样基于 decorate 后的模板（与 deck 路径对齐）：否则 zeroCost/noInfuse 修饰只在首张生效
      const tpl = decorate(c);
      addTempCard(tpl);
      if (act === 'dup') addTempCard({ ...tpl });
      gained.push(c.name);
    }
    if (gained.length) {
      const counts = {};
      gained.forEach(name => { counts[name] = (counts[name] || 0) + 1; });
      const detail = Object.keys(counts).map(name => `【${esc(name)}】×${counts[name] * (act === 'dup' ? 2 : 1)}`).join('、');
      log(`[[icon:cards]] <b>${esc(card.name)}</b>：获得 ${detail}${poolSuffix ? `（${esc(label)}池）` : ''}（战斗内临时卡，战后消散）`, 'loot');
    } else {
      log(`[[icon:question]] <b>${esc(card.name)}</b>：卡池里没有符合条件的卡牌`, 'dim');
    }
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

  function* resolveCardSteps(card, target, infused, fuelCost, uid) {
    card = getHostedExecutionCard(card);
    const registeredTriggers = card?._registeredTriggers;
    if (registeredTriggers) {
      assertCardRulesExecutable({ ...card, rules: { ...card.rules, triggers: registeredTriggers } });
      card = { ...card };
      delete card._registeredTriggers;
    } else {
      assertCardRulesExecutable(card);
    }

    // 牧师浪掷风吟：固定宿主实现，直接按随机池置入至 6 张并只按新置入法术数回血。
    // 原文分号会拆开手牌填充与回血句，旧文本步骤因此先泛化回复 heal 字段再漏算逐张系数；
    // hosted adapter 提供定版卡面，仅此 ID 走此分支，不依赖可编辑描述执行。
    if (card.rules?.battle?.hosted?.includes('priest')) {
      let put = 0, spells = 0;
      while ((typeof getHandSize === 'function' ? getHandSize() : 0) < 6) {
        const candidate = randomDiscoverCard(null);
        if (!candidate) break;
        const before = typeof getHandSize === 'function' ? getHandSize() : 0;
        addTempCard(candidate);
        const after = typeof getHandSize === 'function' ? getHandSize() : 0;
        if (after <= before) break;
        put++;
        if (candidate.type === '法术') spells++;
      }
      const healAmount = Math.max(0, Number(card.heal) || 0) * spells;
      if (healAmount > 0) {
        const healban = getPlayerStatus().status.healban || 0;
        if (healban > 0) log(`[[icon:heart]] 禁疗中：浪掷风吟回复无效（还剩 ${healban} 回合）`, 'warn');
        else { heal(healAmount); addFloat({ unit: 'self', text: '', cls: 'stk sticker-heal', warm: true }); }
      }
      const handSize = typeof getHandSize === 'function' ? getHandSize() : 0;
      log(`[[icon:cards]] <b>${esc(card.name)}</b>：置入 ${put} 张随机卡牌（手牌 ${handSize}/6）${spells ? `，其中 ${spells} 张法术回复 ${healAmount} 血` : ''}`, 'loot');
      return;
    }

    // 血毒双镖（2026-09-16 留言「血毒双镖应该能选择两次目标」）：两段拆开——首段（攻+1 附加流血）
    // 随本牌目标结算；二段（攻+1 附加中毒）由 execPlay 收尾进入点选（interaction 'dart'），
    // 可另选目标或重复选择同一目标
    let desc = String(card.desc || '');
    const hasStructuredOnPlay = card.rules?.triggers != null &&
      Object.prototype.hasOwnProperty.call(card.rules.triggers, 'onPlay');
    const structuredOnPlay = hasStructuredOnPlay ? card.rules.triggers.onPlay : [];
    // M3（执行器收编轮）：装备域结构化抑制——卡带 rules.equip 时文本立即句/兜底/回合宿主
    // 一律不再回放（equipment/registerEquip/runner 单路径承接），防止文本与结构化双结算
    const hasStructuredEquip = card.rules != null && Object.prototype.hasOwnProperty.call(card.rules, 'equip');
    const suppressText = hasStructuredOnPlay || hasStructuredEquip;
    // M2 守卫（G13 落地后的新口径）：resolver 只消费 onPlay；其余时点容器（onTurnStart/
    // onDraw/onConsume…）必须先经 battle.triggers.m2.js runner 登记管线（打出/穿戴时登记、
    // 抽到/消耗时直调）。直接喂给 resolver 的卡若携带时点容器＝绕过登记管线＝静默不结算，
    // 此处立即抛出（exec-play 打出路径会先登记再剥离后进入；runner 合成卡只带 onPlay）。
    if (card.rules?.triggers != null) {
      for (const triggerKey of Object.keys(card.rules.triggers)) {
        if (triggerKey !== 'onPlay' && triggerKey !== 'duration') {
          throw new TypeError(`Trigger '${triggerKey}' must be registered via battle.triggers.m2.js before resolution (card ${card.id || '<missing id>'})`);
        }
      }
    }
    if (card.id === 'tt7-bloodpoison') desc = '攻（+1），附加流血。';
    // 江湖救急（2026-09-18 老板定版）：「随机直接给 3 张」才是本意——不走发现面板。
    // 随机池与发现同口径（isRandomObtainable），置入的临时卡在下个回合开始时消耗。
    if (card.id === 'cmtn1wnhhym') {   // 仅限实机版 id——同名旧卡 tt2-jianghu 有自己的发现流程
      const pool = getAllCards().filter(c => isRandomObtainable(c));
      const uids = [];
      for (let k = 0; k < 3 && pool.length; k++) {
        const c = pool[Math.floor(randomBattle() * pool.length)];
        uids.push(addTempCard({ ...c }));
      }
      if (uids.length) {
        addDelayed({ special: 'consumeTemps', uids, cardName: card.name });
        log(`[[icon:cards]] <b>${esc(card.name)}</b>：随机获得 ${uids.length} 张临时卡牌（下个回合开始时消耗）`, 'loot');
      }
      return;
    }
    // 搜索大宝箱「探宝」（2026-09-17 留言「探宝没有从牌库底发现卡牌，而是随机发现」）：
    // BOSS 战改为从牌库底发现——三张候选就是牌库底的真实卡牌，选 1 张入手、其余按原顺序放回牌库底；
    // 普通战斗没有牌库，维持随机发现口径。探宝只有发现效果，结算完直接收尾。
    if (card.id === 'cmtn28jv33wx' && readState().mode === 'boss' && deckBottomCount()) {
      const take = Math.min(3, deckBottomCount());
      const uids = takeDeckBottom(take);   // 数组头部 = 牌库底
      const cards = uids.map(u => { const o = findCard(u); return o ? o.card : null; }).filter(Boolean);
      if (cards.length) {
        queueDiscover({ n: cards.length, explicit: cards, explicitUids: uids, deckBottom: true });
        log(`[[icon:question]] <b>${esc(card.name)}</b>：翻开牌库底 ${cards.length} 张——选 1 张入手，其余放回牌库底`, 'loot');
      }
      return;
    }
    const parts = splitClauses(desc);
    // 「限定技能：」装备：打出只穿戴，技能句留给角色信息区的技能按钮发动（2026-09-09 老板 #9）。
    // 卡面若只有技能句，结构化 heal/armor/draw 兜底也一并跳过，否则穿戴即自动放了一次技能。
    const skillOnly = parts.skill.length > 0 && !parts.immediate.length && !parts.turnStart.length &&
      !parts.battle.length && !parts.onInfused.length && !parts.onDraw.length;
    // 第十二批（2026-09-23）：纯注能句（desc 以「注能（N）」开头）未注能直打时，文本执行器
    // 已被 gate.infuseRequired 整句拦停——结构化 damage/heal/armor/draw 兜底同门跳过，
    // 否则未注能白嫖回填字段（邪能护体 draw:3 即此例）；注能打出时不受影响。
    const infuseLead = /^注能\s*[（(]/.test(desc);
    // 冷冻射线「若此前其未曾受到过伤害」：本卡结算前的血量快照（先行伤害会让满血判定误杀）
    const hpAtCast = new Map(getAliveFoes().map(f => [f, f.hp]));
    let did = false;
    // B3：本次结算中入手的法术数（perSpellHeal 折算基数；普通战 grantSha 发初始攻击不计）
    let spellsGained = 0;
    // M2：本次结算中最近一个 damage 段实际命中者（curse.bindTarget:'prevDamage' 段绑定）
    let lastDamageTargets = [];
    const isDmgType = getDamageTypes().includes(card.type);
    let structuredHit = false;
    // —— 伤害（卡面伤害词条立即结算，不受沉默影响） ——
    if (hasStructuredOnPlay) {
      const type = getDamageTypeMeta()[card.dmgType] ? card.dmgType : fixedDamageType;
      const damageCard = { ...card, desc: '' };
      for (const operation of structuredOnPlay) {
        // curse 在循环 2（沉默门之后）由 resolveCurseOperation 结算——伤害先于诅咒（先伤害后诅咒）；
        // acquire/coins 同属循环 2（G3：获取/金币在沉默门后，沉默封印一切非攻击技能效果）；
        // B7 的 blessing 与资源族同在循环 2（先伤害后增益，与文本路径步序一致）
        // The complete list has passed the shared schema/capability guard.
        if (operation.op !== 'damage') continue;
        // M3：pick:'new' 段不随主结算——延后进入点选（exec-play 尾部 beginDartStrike 泛化）
        if (operation.pick === 'new') continue;
        // M2：schedule:'nextTurn'/'nextTurnStart'——该段延迟到下回合开始结算（正午决战「下回合
        // 开始时连开四枪」），走 delayed 管线 triggerOps 通道；本回合不产出任何伤害
        if (operation.schedule !== undefined) {
          addDelayed({ special: 'triggerOps', ops: [operation], cardName: card.name, srcCard: card, notBeforeTurn: getTurn() + 1 });
          log(`[[icon:hourglass]] <b>回合开始时</b>：【${esc(card.name)}】延迟效果将在下个回合开始结算`, 'sys');
          did = true;
          continue;
        }
        // B1：伤害来源四选一（schema 保证恰好一个）——v1 字段引用 / v2 字面量 / v2 区间 /
        // M2 perTargetPrice（锚定参照牌价格：气功波「抽 1 张牌，对全体敌人造成等同于其价格的固定伤害」）。
        // 回合成长（充能火球）按 uid 叠加；区间每次施放掷一次（含端点，与 dmg.direct 同口径）。
        const sources = ['amountField', 'amount', 'range', 'perTargetPrice'].filter(field => operation[field] !== undefined);
        const growth = (uid && getGrowth(uid)) || 0;
        let baseDamage = sources[0] === 'amountField' ? +card[operation.amountField] + growth
          : sources[0] === 'amount' ? operation.amount + growth
          : sources[0] === 'range' ? rollRange(operation.range)
          : getPriceOfLastDrawn();
        // M2：perInfusedInHand——「本牌在手时每注能过 1 张卡牌，伤害 +N」（充能射线，infuseFuels 全局计数）
        if (operation.perInfusedInHand !== undefined) {
          const infusedCount = readState().infuseFuels;
          if (infusedCount > 0) {
            baseDamage += infusedCount * operation.perInfusedInHand;
            log(`[[icon:crystal]] <b>${esc(card.name)}</b>：本局已注能 ${infusedCount} 张，伤害 +${infusedCount * operation.perInfusedInHand}`, 'sys');
          }
        }
        // M2：infuseBonus——注能打出时伤害 +N（镭射「注能(1)：伤害+3」口径，infused 由 exec 层传入）
        if (operation.infuseBonus !== undefined && infused) {
          baseDamage += operation.infuseBonus;
          log(`[[icon:fire]] <b>${esc(card.name)}</b>：注能加成，伤害 +${operation.infuseBonus}`, 'sys');
        }
        // M2：graveyard 接线——墓地中每有 1 张该类型牌伤害 +N（雷殛；普通战斗无墓地不生效）
        if (operation.graveyard !== undefined) {
          const cnt = readState().mode === 'boss'
            ? readState().grave.filter(u => { const o = findCard(u); return o && o.card.type === operation.graveyard.type; }).length
            : 0;
          if (cnt > 0) {
            baseDamage += cnt * operation.graveyard.perCard;
            log(`[[icon:recycle]] 墓地增伤：墓地中有 ${cnt} 张【${esc(operation.graveyard.type)}】牌，伤害 +${cnt * operation.graveyard.perCard}`, 'sys');
          }
        }
        // M2：spellPowerMul——受法伤加成翻倍（爆燃火球）：本段额外再叠 (M-1)×法伤加成
        //（hitFoe→dealDamage 内部对法术伤害叠 1×，此处补齐倍率余量，总量 = 基础 + M×加成）
        if (operation.spellPowerMul !== undefined) {
          const power = getPlayerSpellPower() + (+getPlayerStatus().status?.spellUp || 0);
          if (power > 0) {
            baseDamage += power * (operation.spellPowerMul - 1);
            log(`[[icon:crystal]] <b>${esc(card.name)}</b>：法伤加成 ×${operation.spellPowerMul}（额外 +${power * (operation.spellPowerMul - 1)}）`, 'sys');
          }
        }
        // B2：段数来源——v1 hitCount / v2 hits.count / v2 hits.range（每次施放掷一次）；
        // hits.perFoe 已由顶部守卫拦截（pending）。
      // B2：段数来源——v1 hitCount / v2 hits.count / v2 hits.range（每次施放掷一次）；
      // M2：hits.perPlayedMoves——段数 = 本回合已打出的招式数（连续射击，结算后自增口径不含本牌）。
      // hits.perFoe 已由顶部守卫拦截（pending）。
      let hitCount;
      if (operation.hits?.perPlayedMoves !== undefined) {
        hitCount = Math.max(0, readState().playedMovesThisTurn);
        if (hitCount > 0) {
          log(`[[icon:swords]] <b>${esc(card.name)}</b>：本回合已打出 ${hitCount} 张招式，触发 ${hitCount} 次`, 'sys');
        } else {
          log(`[[icon:cross]] <b>${esc(card.name)}</b>：本回合还没有打出其他招式，不造成伤害`, 'dim');
        }
      } else {
        hitCount = operation.hitCount ?? operation.hits?.count
          ?? (operation.hits?.range !== undefined ? rollRange(operation.hits.range) : 1);
      }
        let preferred = target;
        const foesHit = [];
        let dealtTotal = 0;
        // 目标选取（每段重算，windup 后目标可能倒下）：allEnemies 全体 / randomEnemy 每段随机一名 /
        // 其余为点选目标（倒下则顺延战场首位，与 v1 同口径）。
        const pickTargets = () => {
          if (operation.target === 'allEnemies') return getAliveFoes();
          if (operation.target === 'randomEnemy') {
            const alive = getAliveFoes();
            return alive.length ? [alive[Math.floor(randomBattle() * alive.length)]] : [];
          }
          return [preferred && !preferred.dead ? preferred : getAliveFoes()[0]].filter(Boolean);
        };
        // 单段结算：windup → 逐敌（cond 门 → bonus 条件增伤 → hitFoe）→ hit。
        // 返回 { dealt: 本段实际伤害合计, first: 段首目标（null = 无可用目标） }。
        function* castSegment(segment, label, applyModifiers) {
          const windupTargets = pickTargets();
          if (!windupTargets.length) return { dealt: 0, first: null };
          const cue = attackCue(type);
          yield { kind: 'windup', targets: windupTargets, ...(cue ? { cue } : {}) };
          const targets = pickTargets();
          if (!targets.length) return { dealt: 0, first: null };
          let dealt = 0;
          let hitThisSegment = false;
          for (const foe of targets) {
            if (foe.dead) continue;
            if (applyModifiers && operation.cond && !conditionMatches(operation.cond, foe)) {
              if (segment === 0) log(`[[icon:cross]] <b>${esc(foe.name)}</b> 不满足条件：${esc(card.name)} 无效`, 'warn');
              continue;
            }
            let foeDamage = baseDamage;
            if (applyModifiers && operation.bonus &&
                (!operation.bonus.if || conditionMatches(operation.bonus.if, foe))) {
              const before = foeDamage;
              foeDamage = operation.bonus.amount !== undefined ? foeDamage + operation.bonus.amount
                : Math.floor(foeDamage * (1 + operation.bonus.pct / 100));
              if (segment === 0 && foeDamage !== before) {
                log(`[[icon:arrow]] <b>${esc(foe.name)}</b> 满足增伤条件，伤害增加（${before} → ${foeDamage}）`, 'sys');
              }
            }
            dealt += hitFoe(foe, damageCard, foeDamage, type, label);
            foesHit.push(foe);
            hitThisSegment = true;
          }
          if (hitThisSegment) yield { kind: 'hit', segment: segment + 1, ...(cue ? { cue } : {}) };
          return { dealt, first: targets[0] || null };
        }
        for (let segment = 0; segment < hitCount; segment++) {
          const result = yield* castSegment(segment, hitCount > 1 ? `（第 ${segment + 1} 段）` : '', true);
          if (result.first === null) break;
          dealtTotal += result.dealt;
          if (operation.target === 'chosenEnemy') preferred = result.first;
          if (operation.retarget !== 'livingFoes' && operation.target === 'chosenEnemy' && preferred.dead) break;
        }
        // B3：吸血——按本 op 实际造成的伤害回复，走 healban 门（与文本路径吸血同口径）。
        if (operation.lifesteal === true && dealtTotal > 0) applyLifesteal(dealtTotal);
        // B2：recast:{on:'kill'}——本 op 击杀过敌人时再施放 N 次（镜像文本路径击杀连锁：
        // 余烬爆裂/饱和打击）。再施放段不做 cond/bonus 复判，按基础伤害结算。
        // M2：recast.on 扩 'lastHand'——本牌为最后一张手牌时再施放 N 次（急行军/破釜沉舟族）。
        const recastActive = operation.recast && (
          (operation.recast.on === 'kill' && foesHit.some(foe => foe.dead)) ||
          (operation.recast.on === 'lastHand' && isLastHandCard(uid, m2Deps))
        );
        if (recastActive) {
          log(`[[icon:sparkles]] <b>${esc(card.name)}</b>：${operation.recast.on === 'kill' ? '击杀敌人' : '本牌是最后一张手牌'}，再施放${operation.recast.times > 1 ? ` ${operation.recast.times} 次` : '一次'}`, 'sys');
          for (let k = 0; k < operation.recast.times; k++) {
            const result = yield* castSegment(hitCount + k,
              operation.recast.times > 1 ? `（再施放第 ${k + 1} 次）` : '（再施放）', false);
            if (result.first === null) break;
            dealtTotal += result.dealt;
          }
        }
        // M2：damage.onKill 结构化击杀奖励（闪金之锤 +币 / 破甲重斩 +甲）。
        // foesHit 按命中段累加，多段打同一敌人会重复计数——按「击杀只数」去重结算
        if (operation.onKill) {
          applyDamageOnKill(card, operation.onKill, new Set(foesHit.filter(foe => foe.dead)).size, m2Deps);
        }
        // M2：段绑定记账——curse.bindTarget:'prevDamage' 沿用本段实际命中者
        lastDamageTargets = [...foesHit];
        structuredHit = true;
        did = true;
      }
    } else if (isDmgType && ((+card.dmg || 0) > 0 || card.dmgType === 'attack') && !(infuseLead && !infused)) {
      structuredHit = true;
      const type = getDamageTypeMeta()[card.dmgType] ? card.dmgType : fixedDamageType;
      let dmgVal = (+card.dmg || 0) + ((uid && getGrowth(uid)) || 0);   // 充能火球：回合成长
      if (uid && getGrowth(uid)) log(`[[icon:fire]] <b>${esc(card.name)}</b>：回合成长 +${getGrowth(uid)}（基础 ${+card.dmg || 0}）`, 'sys');
      const tm = desc.match(/(?:攻击|命中)\s*(\d+)\s*次/) || desc.match(/(\d+)\s*段/);
      let times = tm ? Math.max(1, +tm[1]) : 1;
      if (!tm) {
        // 「触发 N 次」（流星箭雨）；带「注能(…)」前缀的触发次数只在注能打出时生效（血蝠风暴）。
        // 「若本牌为最后一张手牌，效果触发 N 次」（急行军/破釜沉舟）的次数归出牌结算层
        // （playCard 末手整卡重跑），剥离后另行判定，否则这里会当成多段伤害再翻一次
        const tg = desc.replace(/最后一张手牌[^。；]*?触发\s*(?:\d+\s*)?次?/, '').match(/触发\s*(\d+)\s*次/);
        if (tg && !/注能\s*[（(][^）)]*[）)][^。]*?触发/.test(desc)) times = Math.max(1, +tg[1]);
      }
      // 连续射击（2026-09-10 需求）：「本回合每打出一张其他招式，造成2点固定伤害」——
      // 招式＝武术+法术（设计者 2026-09-10 定版）。打出本牌时按本回合已打出的招式数 n
      // 触发 n 次；n=0 时不造成伤害。计数器在结算后自增（execPlay），所以读到的不含本牌；
      // 注能牺牲品不算「打出」，万剑归宗等免费释放的招式会计入。
      if (/本回合每打出一张其他招式/.test(desc)) {
      times = readState().playedMovesThisTurn;
        log(times > 0
          ? `[[icon:swords]] <b>${esc(card.name)}</b>：本回合已打出 ${times} 张招式，固定伤害触发 ${times} 次`
          : `[[icon:cross]] <b>${esc(card.name)}</b>：本回合还没有打出其他招式，不造成伤害`, times > 0 ? 'sys' : 'dim');
      }
      // 墓地增伤（雷殛：墓地中每有 1 张法术牌，伤害 +1；普通战斗无墓地不生效）
      const graveM = desc.match(/墓地中每有\s*1\s*张(武术|法术|装备|道具|资源)牌[^。；]*?伤害\s*\+\s*(\d+)/);
      if (graveM && readState().mode === 'boss') {
        const cnt = readState().grave.filter(u => { const o = findCard(u); return o && o.card.type === graveM[1]; }).length;
        if (cnt > 0) {
          dmgVal += cnt * +graveM[2];
          log(`[[icon:recycle]] 墓地增伤：墓地中有 ${cnt} 张【${esc(graveM[1])}】牌，伤害 +${cnt * +graveM[2]}`, 'sys');
        }
      }
      // 注能在手增伤（第十二批·充能射线 2026-09-23）：「本牌在你手牌中时每注能过 1 张卡牌，伤害 +N」——
      // 打出时本牌必在手，计数取本局累计注能数（state.infuseFuels，与元素符印同一计数器）。
      const inhandM = desc.match(/每注能过\s*1?\s*张?卡牌[^。；]*?伤害\s*\+\s*(\d+)/);
      if (inhandM && readState().infuseFuels > 0) {
        const infusedCount = readState().infuseFuels;
        dmgVal += infusedCount * +inhandM[1];
        log(`[[icon:crystal]] <b>${esc(card.name)}</b>：本局已注能 ${infusedCount} 张，伤害 +${infusedCount * +inhandM[1]}`, 'sys');
      }
      // 斩杀阈值（斩杀：对 N 血以下角色才造成伤害）
      const hpCap = +((desc.match(/对\s*(\d+)\s*血以下/) || [])[1] || 0);
      // 半血增伤（惩击：对血量一半及以下的敌人伤害 +N%）
      const halfB = desc.match(/血量一半及以下的敌人伤害增加\s*(\d+)\s*%/);
      if (infused) {
        // 注能加成（设计者记号：注能(N)：改为 6′ / 伤害 +3 / 触发 2 次）
        const icost = desc.match(/注能\s*[（(][^）)]*[）)][：:]?\s*改为\s*(\d+)\s*′/);
        if (icost) dmgVal = +icost[1];
        const ibonus = desc.match(/注能\s*[（(][^）)]*[）)][：:]?[^。]*?伤害\s*\+\s*(\d+)/);
        if (ibonus) dmgVal = (+card.dmg || 0) + +ibonus[1];
        const itg = desc.match(/注能\s*[（(][^）)]*[）)][：:]?[^。]*?触发\s*(\d+)\s*次/);
        if (itg) times = Math.max(1, +itg[1]);
      }
      const targets = isAOE(card) ? getAliveFoes() : [target || getAliveFoes()[0]].filter(Boolean);
      if (!targets.length) return;
      let dealtTotal = 0;
      for (let i = 0; i < times; i++) {
        const windupTargets = isAOE(card)
          ? getAliveFoes()
          : [target && !target.dead ? target : getAliveFoes()[0]].filter(Boolean);
        if (!windupTargets.length) break;
        const cue = attackCue(type);
        yield { kind: 'windup', targets: windupTargets, ...(cue ? { cue } : {}) };
        const segmentTargets = isAOE(card)
          ? getAliveFoes()
          : [target && !target.dead ? target : getAliveFoes()[0]].filter(Boolean);
        if (!segmentTargets.length) break;
        let hitThisSegment = false;
        for (const foe of segmentTargets) {
          if (!foe.dead) {
            if (hpCap > 0 && foe.hp > hpCap) {
              if (i === 0) log(`[[icon:cross]] <b>${esc(foe.name)}</b> 血量高于 ${hpCap}：${esc(card.name)} 无效`, 'warn');
              continue;
            }
            let foeDmg = dmgVal;
            if (halfB && foe.maxHp && foe.hp <= foe.maxHp / 2) {
              foeDmg = Math.floor(foeDmg * (1 + +halfB[1] / 100));
              if (i === 0) log(`[[icon:arrow]] <b>${esc(foe.name)}</b> 血量过半，伤害增加 ${halfB[1]}%（→ ${foeDmg}）`, 'sys');
            }
            // 致命穿刺：若对方处于流血状态，伤害 +2（2026-09-09 补实装）
            const pierceB = desc.match(/若对方[^。]*?流血[^。]*?伤害\s*\+\s*(\d+)/);
            if (pierceB && (foe.status.bleed || 0) > 0) {
              foeDmg += +pierceB[1];
              if (i === 0) log(`[[icon:blood]] <b>${esc(foe.name)}</b> 处于流血状态，伤害 +${pierceB[1]}`, 'sys');
            }
            dealtTotal += hitFoe(foe, card, foeDmg, type, times > 1 ? `（第 ${i + 1} 段）` : '');
            hitThisSegment = true;
          }
        }
        if (hitThisSegment) yield { kind: 'hit', segment: i + 1, ...(cue ? { cue } : {}) };
      }
      // 吸血：回复等量生命（嗜血刃/噬血术/血蝠风暴）
      if (/回复等量生命/.test(desc) && dealtTotal > 0) applyLifesteal(dealtTotal);
      // 条件额外施放（暗影射击：对手处于诅咒状态，额外施放 1 次）
      const sm = desc.match(/若[^。]*?诅咒[^。]*?额外施放\s*(\d+)\s*次/);
      if (sm) {
        const t0 = targets.find(t => hasCurse(t));
        if (t0) {
          let preferred = t0, cast = 0;
          for (let k = 0; k < +sm[1]; k++) {
            let next = preferred && !preferred.dead ? preferred : getAliveFoes()[0];
            if (!next) break;
            const cue = attackCue(type);
            yield { kind: 'windup', targets: [next], ...(cue ? { cue } : {}) };
            next = preferred && !preferred.dead ? preferred : getAliveFoes()[0];
            if (!next) break;
            hitFoe(next, card, dmgVal, type, `（额外施放第 ${k + 1} 次）`);
            yield { kind: 'hit', segment: k + 1, ...(cue ? { cue } : {}) };
            preferred = next;
            cast++;
          }
          log(`[[icon:play]] 对手身负诅咒：【${esc(card.name)}】额外施放 ${cast}/${sm[1]} 次`, 'sys');
        }
      }
      // 击杀连锁（余烬爆裂「再施放一次」/ 第十二批·饱和打击「如果消灭敌人，额外释放一次」2026-09-23）——
      // 本段伤害击杀过敌人时：群体→存活目标再结算一段；单体全灭→顺延给战场第一名存活敌人。
      if (/(?:若击杀(?:任何)?敌人|如果(?:消灭|击杀)(?:任何)?敌人)[^。；]*(?:再施放一次|额外释放一次)/.test(desc) && targets.some(t => t.dead)) {
        const rest = targets.filter(t => !t.dead);
        const recast = rest.length ? rest : getAliveFoes().slice(0, 1);
        log(`[[icon:sparkles]] <b>${esc(card.name)}</b>：击杀敌人，再施放一次`, 'sys');
        const cue = attackCue(type);
        if (recast.length) yield { kind: 'windup', targets: recast, ...(cue ? { cue } : {}) };
        let recastHit = false;
        for (const foe of recast) {
          if (!foe.dead) { hitFoe(foe, card, dmgVal, type, '（再施放）'); recastHit = true; }
        }
        if (recastHit) yield { kind: 'hit', segment: times + 1, ...(cue ? { cue } : {}) };
      }
      did = true;
    }
    // 沉默：除攻击外的技能效果全部失效（延迟段与持续段也不注册）
    if ((getPlayerStatus().status.silence || 0) > 0) {
      log(`[[icon:cross]] <b>${esc(card.name)}</b> 的技能效果被沉默封印（只剩攻击生效，持续 ${getPlayerStatus().status.silence} 回合）`, 'warn');
      return;
    }
    if (hasStructuredOnPlay) {
      for (const operation of structuredOnPlay) {
        if (operation.op === 'damage') continue;
        if (operation.op === 'status' && operation.status === 'freeze' && operation.target === 'allEnemies' &&
            Number.isInteger(operation.duration) && operation.duration > 0) {
          const targets = getAliveFoes();
          const affected = targets.filter(foe => applyStatus(foe, 'freeze', operation.duration) > 0);
          if (affected.length) {
            const names = affected.length === targets.length
              ? '全体敌人'
              : affected.map(foe => esc(foe.name)).join('、');
            log(`[[icon:crystal]] ${names} 被冰冻 ${operation.duration} 回合（无法行动）`, 'sys');
            did = true;
          }
          continue;
        }
        if (operation.op === 'discover' && Number.isInteger(operation.count) && operation.count > 0) {
          queueDiscover({ n: operation.count, pool: operation.pool, costDecayPerTurn: operation.costDecayPerTurn,
            sourceCardId: card.id });
          did = true;
          continue;
        }
        // B5（A3 第二批）：结构化诅咒——7 诅咒 × target × randomKinds/double/burst/extend 全键在此消费
        // M2：source handMoves / bindTarget prevDamage / atkDown（amount 扣攻）
        // M3：pick:'new' 段延后到点选结算
        if (operation.op === 'curse') {
          if (operation.pick === 'new') continue;
          did = (yield* resolveCurseOperation(card, operation, target, lastDamageTargets)) || did;
          continue;
        }
        // M3：foeFight——迫使其相互攻击（扰敌）；copyRandom——随机复制一张手牌（刀剑形态）
        if (operation.op === 'foeFight') {
          did = resolveFoeFight(card, operation, m2Deps) || did;
          continue;
        }
        if (operation.op === 'copyRandom') {
          did = resolveCopyRandom(card, m2Deps) || did;
          continue;
        }
        // M2：stealAtk——偷取/夺取敌人攻击力（影噬/禁咒口径，enemy-phase 归还管线复用）
        if (operation.op === 'stealAtk') {
          const stealTarget = (operation.bindTarget === 'prevDamage' && lastDamageTargets.length)
            ? lastDamageTargets[lastDamageTargets.length - 1]
            : (target && !target.dead ? target : getAliveFoes()[0]);
          did = resolveStealAtk(card, operation, stealTarget, m2Deps) || did;
          continue;
        }
        // M2：noDrawNext / extraTurn / execute / summon / registerRule（键位已定族接线）
        if (operation.op === 'noDrawNext') {
          did = resolveNoDrawNext(card, operation, m2Deps) || did;
          continue;
        }
        if (operation.op === 'extraTurn') {
          did = resolveExtraTurn(card, operation, m2Deps) || did;
          continue;
        }
        if (operation.op === 'execute') {
          const execTarget = lastDamageTargets.length
            ? lastDamageTargets[lastDamageTargets.length - 1]
            : (target && !target.dead ? target : getAliveFoes()[0]);
          did = resolveExecute(card, operation, execTarget, m2Deps) || did;
          continue;
        }
        if (operation.op === 'summon') {
          did = resolveSummon(card, operation, m2Deps) || did;
          continue;
        }
        if (operation.op === 'registerRule') {
          did = resolveRegisterRule(card, operation, m2Deps) || did;
          continue;
        }
        // G3（A3 第三批）：结构化获取（池谓词 parsePoolNoun 单源 / dest 三向 / act 组合门）
        if (operation.op === 'acquire') {
          did = resolveAcquireOperation(card, operation) || did;
          continue;
        }
        // M1（M 批契约扩展，2026-09-27）：净化——清除自身全部诅咒（combat.purify 与文本路径同源）
        if (operation.op === 'cleanse') {
          did = resolveCleanseOperation(card, operation, m1Deps) || did;
          continue;
        }
        // G3（A3 第三批）：coins 获得金币——{op, n}，与 applyKillRewards/bag 同一 G.coins 计数
        if (operation.op === 'coins') {
          addCoins(operation.n);
          log(`[[icon:coin]] <b>${esc(card.name)}</b>：获得 ${operation.n} 币`, 'loot');
          did = true;
          continue;
        }
        // B7（A3 第三批）：结构化增益——六 key 全在此消费（resolveBlessingOperation，同一状态袋）
        if (operation.op === 'blessing') {
          did = resolveBlessingOperation(operation) || did;
          continue;
        }
        // B7：能量 +n——引擎 addEnergy 命令（文本路径 res.energy 同款，不设上限夹逼，回合开始重置回满）
        if (operation.op === 'energy') {
          const current = addEnergy(operation.n);
          log(`[[icon:bolt]] 获得 ${operation.n} 点能量（当前 ${current}）`, 'sys');
          did = true;
          continue;
        }
        // B7：能量上限 +n——引擎 addEnergyCap 命令（文本路径 res.energyCap 同款：上限与当前能量同加）
        if (operation.op === 'energyCap') {
          const currentMax = addEnergyCap(operation.n);
          log(`[[icon:bolt]] 本场战斗能量上限 +${operation.n}（每回合 ${currentMax} 费）`, 'sys');
          did = true;
          continue;
        }
        // B7：生命上限 +n——引擎 addPlayerMaxHp 命令。口径（B7 默认）：上限 +n 同时回复 n 点
        //（G.maxHp += n; G.heal(n)，引擎命令内部出「血量上限 +n（…并回复 n 点）」日志，本层不重复记）。
        if (operation.op === 'maxHp') {
          addPlayerMaxHp(operation.n);
          did = true;
          continue;
        }
        // B7：牌库上限 +n——记录型 no-op。考古：牌库上限唯一消费点在开战前编组
        //（battle.lifecycle.js prepareDeckSelection → deckCapBonus()，只读「编入的迎战装备」desc，
        // 混沌之眼路径；selDeckMax 每次编组重算，战斗内无持久承载）。战斗内打出无法追溯扩容
        // 已定格的牌库：BOSS 战注明不追溯，普通战注明无牌库。
        if (operation.op === 'deckCap') {
          log(readState().mode === 'boss'
            ? `[[icon:cards]] <b>${esc(card.name)}</b>：牌库上限在开战前编组阶段生效，战斗中 +${operation.n} 不追溯扩容`
            : `[[icon:cards]] <b>${esc(card.name)}</b>：普通战斗没有牌库，牌库上限 +${operation.n} 无处生效`, 'dim');
          did = true;
          continue;
        }
        if (!['heal', 'armor', 'draw'].includes(operation.op)) {
          throw new TypeError(`Unsupported onPlay operation for card ${card.id || '<missing id>'}`);
        }
        if (operation.op === 'heal') {
          // B3：回复来源五选一（schema 保证恰好一个）。禁疗门统一走 healban 检查（与文本路径同口径）。
          const healban = getPlayerStatus().status.healban || 0;
          if (operation.selfDamage !== undefined) {
            // 自伤（恶魔之力「损失 N 点生命」）：不是治疗，不受禁疗影响，走 damagePlayer 命令
            damagePlayer(operation.selfDamage);
          } else if (operation.upTo !== undefined) {
            // 回复至 N 血（沐愈光辉）：与文本路径 heal.upTo 同口径
            const want = operation.upTo;
            const current = getPlayerHp();
            if (healban > 0) {
              log(`[[icon:heart]] 禁疗中：回复至 ${want} 血无效（还剩 ${getPlayerStatus().status.healban} 回合）`, 'warn');
            } else if (want > current) {
              heal(want - current);
              addFloat({ unit: 'self', text: '', cls: 'stk sticker-heal', warm: true });
              log(`[[icon:heart]] 回复至 <b>${want}</b> 血（当前 ${current}，回复 ${want - current}）`, 'ok');
            } else {
              log(`[[icon:heart]] 回复至 ${want} 血：当前 ${current} 不低于目标值，无变化`, 'ok');
            }
          } else {
            let amount;
            if (operation.amountField !== undefined) amount = +card[operation.amountField];
            else if (operation.amount !== undefined) amount = operation.amount;
            else if (operation.perFuelCost !== undefined) {
              // 按注能牺牲品价格折算（圣光治愈「N 倍于被注能卡牌价格」）：与 pre.fuelPrice 同口径
              const fuel = Math.max(0, fuelCost || 0);
              amount = operation.perFuelCost * fuel;
              log(`[[icon:flask]] 牺牲品费用 ${fuel} → 折算回复 ${amount} 点生命`, 'sys');
            } else {
              // perSpellHeal：按本次结算中入手的法术数折算（浪掷风吟「每置入 1 张法术回复 N 血」）
              amount = operation.perSpellHeal * spellsGained;
              log(`[[icon:cards]] 本次入手 ${spellsGained} 张法术 → 回复 ${amount} 点生命`, 'sys');
            }
            if (healban > 0) {
              log(`[[icon:heart]] 禁疗中：回复 ${amount} 点生命无效（还剩 ${getPlayerStatus().status.healban} 回合）`, 'warn');
            } else {
              heal(amount);
              addFloat({ unit: 'self', text: '', cls: 'stk sticker-heal', warm: true });
            }
          }
        } else if (operation.op === 'armor') {
          // B3：护甲来源二选一（amountField/amount）；guard=true 叠加格挡（本回合所受伤害降为 1）；
          // decayAtTurnEnd=n 注册「下回合开始时 -n 点」延迟段（与坚盾文本路径同一条 delayed 管线）。
          // M2：priceOf:'discovered' 护甲锚定发现牌价格（挖宝）；consumeEquip 消耗手牌装备为代价（铸甲）。
          if (operation.consumeEquip !== undefined && !resolveConsumeEquip(card, m2Deps)) {
            // 付不出代价：整段无效（不白拿甲），与手牌代价「付不出即无效果」口径一致
            continue;
          }
          let amount = operation.amountField !== undefined ? +(card[operation.amountField] || 0)
            : operation.amount !== undefined ? +(operation.amount || 0)
            : operation.priceOf !== undefined ? Math.max(0, getPriceOfLastDrawn())
            : 0;
          if (operation.priceOf !== undefined) {
            log(`[[icon:flask]] 参照牌价格 ${amount} → 折算护甲`, 'sys');
          }
          if (amount > 0) {
            addArmor(amount, operation.guard === true ? { guard: true } : undefined);
            log(`[[icon:plate]]获得 ${amount} 点护甲`, 'sys');
          } else if (operation.guard === true) {
            addArmor(0, { guard: true });
          }
          if (operation.guard === true) {
            log('[[icon:shield]] 格挡：本回合所受伤害降为 1', 'sys');
          }
          if (operation.decayAtTurnEnd !== undefined) {
            addDelayed({ text: `-${operation.decayAtTurnEnd} 点`, cardName: card.name });
            log(`[[icon:hourglass]] <b>回合开始时</b>：【${esc(card.name)}】护甲 -${operation.decayAtTurnEnd} 点（下个回合开始生效）`, 'sys');
          }
        } else {
          // draw：五源选一（v1 amountField / v2 字面量 amount / M1 range 区间随机张数 /
          // M1 untilHandN 抽到目标手牌数 / M2 perCurseKinds 按目标诅咒种类数）；
          // M2 filter：牌库定向抽取（武装「从牌库中抽取 2 张装备牌」，deckDraw type 口径）；
          // handOps 为抽牌前置手牌操作（实现体在 effect-steps.m1.js）。
          if (operation.amountField === undefined && operation.amount === undefined &&
              operation.range === undefined && operation.untilHandN === undefined &&
              operation.perCurseKinds === undefined) {
            throw new TypeError(`Unsupported onPlay operation for card ${card.id || '<missing id>'}`);
          }
          if (operation.handOps !== undefined) yield* resolveDrawHandOps(card, operation.handOps, m1Deps);
          if (operation.untilHandN !== undefined) {
            spellsGained += resolveDrawUntilHandN(card, operation, m1Deps) || 0;
          } else if (operation.filter !== undefined) {
            // M2：牌库定向抽取——BOSS 战 deckDraw(type)，普通战无牌库降级为获得初始攻击
            const want = operation.filter.type;
            const got = readState().mode === 'boss' ? deckDraw({ n: operation.amount || 1, type: want }) : 0;
            if (readState().mode === 'boss') {
              log(`[[icon:cards]] <b>${esc(card.name)}</b>：从牌库抽取 ${got} 张【${esc(want)}】牌`, 'sys');
            } else {
              grantSha(operation.amount || 1);
              log(`[[icon:cards]] <b>${esc(card.name)}</b>：普通战斗没有牌库，改为获得 ${operation.amount || 1} 张【初始攻击】`, 'sys');
            }
          } else {
            let amount = operation.amountField !== undefined ? +card[operation.amountField]
              : operation.range !== undefined ? rollRange(operation.range)
              : +(operation.amount || 0);
            if (operation.perCurseKinds !== undefined) {
              const anchor = lastDamageTargets.length ? lastDamageTargets[lastDamageTargets.length - 1]
                : (target && !target.dead ? target : getAliveFoes()[0]);
              const kinds = countCurseKinds(anchor, m2Deps);
              amount = kinds;
              log(`[[icon:cards]] <b>${esc(card.name)}</b>：目标身负 ${kinds} 种诅咒，抽 ${kinds} 张牌`, 'sys');
            }
            if (readState().mode === 'boss') {
              const got = drawCards(amount);
              if (typeof countDrawnSpells === 'function') spellsGained += countDrawnSpells();
              log(`[[icon:cards]] <b>${esc(card.name)}</b>：抽了 ${got} 张牌`, 'sys');
            } else {
              grantSha(amount);
              log(`[[icon:cards]] <b>${esc(card.name)}</b>：获得 ${amount} 张【初始攻击】（普通战斗抽牌效果改为获得初始攻击）`, 'sys');
            }
          }
        }
        did = true;
      }
    }
    // 法力奔涌（2026-09-10 需求 #37/#38）：「对随机敌人释放4个随机法术（这些随机法术默认已注能）」。
    // 识别加名称/ID 兜底——旧档背包里的快照克隆可能带着旧措辞描述，正则失配曾导致整卡无效果。
    const surgeM = desc.match(/对随机敌人释放\s*(\d+|四)\s*个随机法术/);
    if (!suppressText && (surgeM || card.id === 'cc-mana-surge' ||
        card.rules?.battle?.hosted?.includes('mana-surge') || /法力奔涌/.test(String(card.name || '')))) {
      startSurge(castRandomSpells(surgeM ? (surgeM[1] === '四' ? 4 : Math.max(1, +surgeM[1])) : 4, card.id));
      did = true;
    }
    // —— 立即生效句（逐句结算：句与句不再用「，」拼接——拼接曾污染花开两面的抉择选项，
    //     也让 A 句未识别时吞掉 B 句的独立结算机会）——
    // 例外：神灯类「抉择：1° …；2° …」的编号续句（^\d° 开头）必须并回抉择主句，
    // 否则选项会被拆成独立子句抢先自动结算（2026-09-12 回归修复）
    const imm = [];
    if (!suppressText) parts.immediate.forEach(cl => {
      if (/^\s*\d\s*[°º]/.test(cl) && imm.length && /抉择[:：]/.test(imm[imm.length - 1])) imm[imm.length - 1] += '，' + cl;
      else imm.push(cl);
    });
    let healed = false, armored = false, drawn = false;
    for (const cl of imm) {
      // 双镖首段若已击杀原目标，流血不得借文本执行器的空目标回退串到下一名活敌人。
      if (card.id === 'tt7-bloodpoison' && target && target.dead && /流血/.test(cl)) continue;
      const args = [card, cl, target, { structuredHit, infused, fuelCost, uid, hpAtCast }];
      const res = applyTextEffects.steps ? yield* applyTextEffects.steps(...args) : applyTextEffects(...args);
      did = did || res.did;
      healed = healed || res.healed;
      armored = armored || res.armored;
      drawn = drawn || res.drawn;
    }
    // 结构化词条兜底（描述未写明但制作坊标注了回复/护甲/抽卡字段时）——纯注能句未注能时同门跳过（第十二批）
    if (!suppressText && !(infuseLead && !infused) && !healed && !skillOnly && +(card.heal || 0) > 0) {
      const n = +(card.heal || 0);
      if ((getPlayerStatus().status.healban || 0) > 0) {
        log(`[[icon:heart]] 禁疗中：回复 ${n} 点生命无效（还剩 ${getPlayerStatus().status.healban} 回合）`, 'warn');
      } else { heal(n); addFloat({ unit: 'self', text: '', cls: 'stk sticker-heal', warm: true }); }
      did = true;
    }
    if (!suppressText && !(infuseLead && !infused) && !armored && !skillOnly && +(card.armor || 0) > 0) {
      addArmor(+(card.armor || 0));
      log(`[[icon:plate]]获得 ${+(card.armor || 0)} 点护甲`, 'sys');
      did = true;
    }
    // 卡面结构化抽卡字段兜底（描述未写「抽 N 张牌」时）——邪能护体 draw:3 依赖此门防未注能白嫖
    const hostedWarlockHandlesItsOwnDraw = card.rules?.battle?.hosted?.includes('warlock') === true;
    if (!suppressText && !(infuseLead && !infused) && !drawn && !skillOnly &&
        !hostedWarlockHandlesItsOwnDraw && drawOf(card) > 0) {
      const n = drawOf(card);
      if (readState().mode === 'boss') {
        const got = drawCards(n);
        log(`[[icon:cards]] <b>${esc(card.name)}</b>：抽了 ${got} 张牌`, 'sys');
      } else {
        grantSha(n);
        log(`[[icon:cards]] <b>${esc(card.name)}</b>：获得 ${n} 张【初始攻击】（普通战斗抽牌效果改为获得初始攻击）`, 'sys');
      }
      did = true;
    }
    // —— 「回合开始时」生效时刻词条 ——
    if (!suppressText && parts.turnStart.length) { registerTurnStart(card, parts.turnStart); did = true; }
    // —— 「本局对战内」持续时间词条 ——
    if (!suppressText) parts.battle.forEach(cl => { did = registerBattle(card, cl, target) || did; });
    // 「被注能时」句在打出时不结算（splitClauses 已剥出，留给 resolveInfusedFuel）
    if (!did && !skillOnly && !suppressText) log(`[[icon:play]] <b>${esc(card.name)}</b>：该效果在 M1 后续实装（占位）`, 'dim');
  
  }

  // 敌方回合与抽到即施放仍需要同步结算；玩家动作队列可逐段推进同一规则生成器。
  function resolveCard(...args) {
    // eslint-disable-next-line no-unused-vars -- _ 仅为把 resolveCardSteps 生成器驱动到底的占位，段值本就不消费
    for (const _ of resolveCardSteps(...args)) { /* 同步消费每段 */ }
  }
  resolveCard.steps = resolveCardSteps;
  return resolveCard;
}

export { createBattleResolution };

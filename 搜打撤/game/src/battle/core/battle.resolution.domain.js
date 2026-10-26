import { claimPreparedDiscovery } from '../effects/battle.discover-preview.js';
import { energyCapGrantsCurrent } from '../../cards/card-energy-policy.js';
import { hasLegacyStealthBreakBonus, isLegacyBloodpoison, legacyTurnStartDescription, hasLegacyManaSurge } from '../../cards/card-legacy-battle-policy.js';
import { createLegacyResolution } from './battle.legacy-resolution.domain.js';
import { attackCue } from '../view/battle.attack-cues.js';
import { createAcquireOperation } from '../effects/battle.acquire-operation.domain.js';
import { createStatusOperations } from '../effects/battle.status-operations.domain.js';
import { createM1Domain } from '../effects/effect-steps.m1.domain.js';
import { createM2Domain } from '../effects/effect-steps.m2.domain.js';
import { assertCardRulesExecutable } from '../effects/battle.rule-guard.js';
import { createInfusionDomain } from '../effects/battle.infusion.domain.js';
import { hasStructuredTrigger } from '../../cards/card-trigger-contract.js';
import { cardPlayExecutionPlan, assertPlayExecutionView } from '../../cards/card-execution-plan.js';
import { createCardSemanticOperations, matchesOperationWhen } from '../effects/card-semantic-operations.js';
import { createChoiceSemanticOperations } from '../effects/choice-semantic-operations.js';

/** Instance-owned state and host services are captured explicitly. */
export function createResolutionDomain(context) {

const { resolveCleanseOperation, resolveDrawUntilHandN, resolveDrawHandOps } = createM1Domain(context);
const { resolveStealAtk, resolveNoDrawNext, resolveExtraTurn, resolveExecute, resolveSummon, resolveRegisterRule, applyDamageOnKill, resolveConsumeEquipSteps, applyAtkDown, countCurseKinds, handMoveCurses, isLastHandCard, resolveFoeFightSteps, resolveCopyRandom } = createM2Domain(context);
const getHostedExecutionCard = context.normalizeCard;
const { hasInfusionWaiver } = createInfusionDomain(context);
const resolveSemanticOperation = context.resolveSemanticOperation || createCardSemanticOperations(context);
const choiceSemantics = createChoiceSemanticOperations(context);
// Card resolution is isolated behind explicit state reads and domain commands.

// G3（A3 第三批）：获取池谓词单源——parsePoolNoun 是「发现/随机获取/获得 N 张 ____」句式
// 的限制卡池解析器（effect-steps.ctx.js 纯叶子模块，与文本路径 effect-steps 家族同一实现，
// 避免两份池名词清单漂移）。

// M 批契约扩展执行件（M1，2026-09-27）：cleanse / draw.untilHandN / draw.handOps。
// 实现体在 effect-steps.m1.js（新文件挂接，减小本文件 diff），本文件只保留注册点。

// M 批契约扩展执行件第二批（M2，2026-09-27）：stealAtk/noDrawNext/extraTurn/execute/summon/
// registerRule/damage.onKill/curse.source handMoves/armor.consumeEquip/atkDown 侧效。

// Schema and runtime support share the same complete-list boundary at every battle entry.

function createBattleResolution(ports) {
  const { emitRecast = () => {}, readState, getPlayerStatus, esc, log, heal, addFloat, addDelayed, takeDeckBottom, deckBottomCount,
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
    addEnergy, refillEnergy, addEnergyCap, addPlayerMaxHp,
    // B5 端口：combat 为引擎侧包装后的 combat 命名空间（与文本路径 effect-steps 同一份对象）——
    // addCurse 负责状态袋与 cursefx 彩闪、tickPoison 负责毒伤引爆、CURSES/CURSE_META 供随机池与图标单源。
    combat, addPlayerCurse, canApplyPlayerCurse = () => true,
    // M2（2026-09-27）端口：偷取/禁抽/额外回合/持续规则旗标/随从位/价格与牌库定向抽取——
    // 命令体与文本路径专支同一批引擎函数（engine 端口装配处透传，不新增引擎逻辑）。
    markNoDrawNext, setExtraTurn, setBleedAmp, setMeleeCost1, setSpellCost1,
    summonAlly, getPriceOfLastDrawn, deckDraw, getTurn, getPlayerSpellPower, setNextSpellTwice,
    getHandInfuseCount = () => 0, getFoeIndex = () => -1,
  } = ports;
  // 吸血/回复等量生命公共体（09-29 jscpd 收敛批，PENDING #12 档一）：
  // 结构化路径 operation.lifesteal 与文本路径「回复等量生命」同语义，统一禁疗判定与演出。
  const applyLifesteal = total => {
    if ((getPlayerStatus().status.healban || 0) > 0) {
      log(`[[icon:status-heal-ban]] 禁疗中：吸血回复无效（还剩 ${getPlayerStatus().status.healban} 回合）`, 'warn');
      return;
    }
    heal(total);
    addFloat({ unit: 'self', text: '', cls: 'stk sticker-heal', warm: true });
    log(`[[icon:heart]] 吸血：回复 ${total} 点生命`, 'ok');
  };
  // BC-04（09-30 深审）：armor.priceOf:'discovered'（挖宝）的甲必须在玩家选完发现牌后
  // 按所选牌价格结算——排队时取价（getPriceOfLastDrawn）拿到的是前次抽牌的价格，常见 0/错值。
  // 这里记录最近一次排队的发现 job，armor op 据此挂 priceArmor 旗（pickDiscover 既有结算通道）。
  let lastQueuedDiscoverJob = null;
  const queueDiscoverTracked = job => { lastQueuedDiscoverJob = job; queueDiscover(job); };
  // M1（M 批契约扩展，2026-09-27）：effect-steps.m1.js 的注入端口收口——
  // 全部来自本文件既有端口，不新增引擎侧装配点。
  const m1Deps = { combat, getPlayerStatus, drawCards, grantSha, countDrawnSpells, findCard, log, esc,
    onHandConsumed: ports.onHandConsumed };
  // M2（M 批契约扩展第二批，2026-09-27）：effect-steps.m2.js 的注入端口收口。
  const m2Deps = {
    combat, getAliveFoes, findCard, addCoins, addArmor, addEnergy, log, esc,
    onHandConsumed: ports.onHandConsumed,
    sweepDead: ports.sweepDead,
    markNoDrawNext, setExtraTurn, setBleedAmp, setMeleeCost1, setSpellCost1,
    summonAlly, hitFoe, getTurn, getPlayerStatus, getPlayerSpellPower,
    random: randomBattle,
    addTempCard, setNextSpellTwice,
    setConsumeFireball: ports.setConsumeFireball, setAllSpellsInfused: ports.setAllSpellsInfused,
    registerGrowthCard: ports.registerGrowthCard, setPoisonLegacy: ports.setPoisonLegacy,
    setPlayerCurseImmune: ports.setPlayerCurseImmune, setStealthStrike: ports.setStealthStrike,
    foeDealDamage: ports.foeDealDamage || ((attacker, target, amount) => combat.dealDamage(attacker, target, amount, 'attack')),
  };
  const { resolveAcquireOperation } = createAcquireOperation({ getAllCards, getMyClass, deckBottomCount, takeDeckBottom,
    findCard, queueDiscoverTracked, prepareDiscoverJob: claimPreparedDiscovery, randomDiscoverCard, addDeckCard, shuffleDeck, addTempCard, esc, log });
  const { resolveCurseOperation, resolveBlessingOperation } = createStatusOperations({ combat, getAliveFoes, randomBattle,
    getPlayerStatus, handMoveCurses, m2Deps, getDamageTypeMeta, fixedDamageType, addPlayerCurse,
    canApplyPlayerCurse, applyAtkDown, esc, log });
  const legacyResolution = createLegacyResolution({ combat, log, esc, getHandSize, randomDiscoverCard,
    addTempCard, getPlayerStatus, heal, addFloat, getAllCards, isRandomObtainable,
    readState, randomBattle, addDelayed, deckBottomCount, takeDeckBottom, findCard, queueDiscoverTracked });
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
    if (cond.playerStealthed === true && !combat.isStealthed(getPlayerStatus())) return false;
    return true;
  }

  // B1：区间掷骰（含端点）——与文本路径 dmg.direct 区间口径一致（不稳定射线 4-6）。
  function rollRange(range) {
    const min = Array.isArray(range) ? range[0] : 0;
    const max = Array.isArray(range) ? range[1] : min;
    return min + Math.floor(randomBattle() * (Math.abs(max - min) + 1));
  }

  function* resolveCardSteps(card, target, infused, fuelCost, uid) {
    card = getHostedExecutionCard(card);
    // Direct resolution (e.g. ash overflow) bypasses execPlay but retains infusion waivers.
    infused = !!infused || hasInfusionWaiver(card, readState().allSpellsInfused);
    const stealthBreakBonus = hasLegacyStealthBreakBonus(card);
    let brokeOwnStealth = false;
    assertCardRulesExecutable(card);
    if (card.type === '道具' && Array.isArray(card.rules?.bag?.use)) {
      if (typeof ports.resolveBagOperations !== 'function') throw new TypeError('Bag card resolution requires the bag operation port');
      yield* ports.resolveBagOperations(card, target);
      return;
    }
    const playPlan = cardPlayExecutionPlan(card);
    const ownsOnPlay = playPlan.onPlay.kind === 'structured';
    const ignoresSilence = card.rules?.battle?.ignoresSilence === true;
    const hostedPlaySetup = card.rules?.battle?.hosted?.includes('batch13-flame-form');
    if ((!ownsOnPlay || hostedPlaySetup) && ports.resolveRequestedCard && (yield* ports.resolveRequestedCard(card, target, ports))) return;

    if (legacyResolution.resolveOpening(card, target, ownsOnPlay)) return;

    // 血毒双镖（2026-09-16 留言「血毒双镖应该能选择两次目标」）：两段拆开——首段（攻+1 附加流血）
    // 随本牌目标结算；二段（攻+1 附加中毒）由 execPlay 收尾进入点选（interaction 'dart'），
    // 可另选目标或重复选择同一目标
    let desc = String(card.desc || '');
    const hasStructuredOnPlay = ownsOnPlay;
    const structuredOnPlay = playPlan.onPlay.ops;
    const suppressText = playPlan.suppressImmediateText;
    assertPlayExecutionView(card);
    if (!hasStructuredOnPlay && isLegacyBloodpoison(card)) desc = '攻（+1），附加流血。';
    if (legacyResolution.resolveAcquisition(card, hasStructuredOnPlay)) return;
    const parts = splitClauses(legacyTurnStartDescription(card, desc));
    const equipRules = card.rules?.equip;
    const ownsEquipField = playPlan.ownsField;
    const ownsPassive = playPlan.equipment('passive').kind === 'structured';
    const legacyImmediate = clause => {
      if (playPlan.equipment('battleStart').kind === 'structured' && /^对战开始时/.test(clause)) return false;
      if (ownsPassive && /诅咒状态[下时]|[+＋]\s*\d+\s*(?:攻|法伤)|(?:攻(?:击(?:力)?)?|法伤)\s*[+＋]\s*\d+|(?:攻击力|法伤|法术伤害)(?:增加|提升)\s*\d+|获得\s*\d+\s*点?攻击力|对冰冻[^。]*?伤害\s*\+/.test(clause)) return false;
      return true;
    };
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
    const operationMatches = operation => matchesOperationWhen(operation, { infused, brokeStealth: brokeOwnStealth, target, hpAtCast });
    let did = false;
    // B3：本次结算中实际入手的法术数（perSpellHeal 折算基数）。
    let spellsGained = 0;
    // M2：本次结算中最近一个 damage 段实际命中者（curse.bindTarget:'prevDamage' 段绑定）
    let lastDamageTargets = [];
    const isDmgType = getDamageTypes().includes(card.type);
    let structuredHit = false;
    // U16（PENDING #14 老板 2026-09-30 拍板）：STS2 IsEnding 同款终局守卫——敌人全灭
    // （getAliveFoes 与 exec-play 胜利判定同口径）后，本卡余下 op 中止。
    // 击杀事件在 finish 前兑现其独立收益；伤害仍由实际存活目标截停。
    const foesAnnihilated = () => card._triggerPoint !== 'onKill' && getAliveFoes().length === 0;
    // —— 伤害（卡面伤害词条立即结算，不受沉默影响） ——
    function* resolveStructuredDamage(operations) {
      const type = getDamageTypeMeta()[card.dmgType] ? card.dmgType : fixedDamageType;
      for (const operation of operations) {
        if (!operationMatches(operation)) continue;
        if (foesAnnihilated()) break;   // 终局守卫：前序段已全灭，余下伤害段不再结算
        // 调度器按声明顺序调用伤害与技能执行体，沉默只跳过非伤害操作。
        // The complete list has passed the shared schema/capability guard.
        if (operation.op !== 'damage') continue;
        const damageCard = { ...card, desc: '', ...(operation.nonLethal ? { _cardDamagePolicy: { nonLethal: true } } : {}) };
        const energyKills = new Set();
        // M3：pick:'new' 段不随主结算——延后进入点选（exec-play 尾部 beginDartStrike 泛化）
        if (operation.pick === 'new') continue;
        // M2：schedule:'nextTurn'/'nextTurnStart'——该段延迟到下回合开始结算（正午决战「下回合
        // 开始时连开四枪」），走 delayed 管线 triggerOps 通道；本回合不产出任何伤害
        if (operation.schedule !== undefined) {
          addDelayed({ special: 'triggerOps', ops: [operation], cardName: card.name, srcCard: card, targetIndex: getFoeIndex(target), notBeforeTurn: getTurn() + 1 });
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
        // 本牌当前在手期间发生的注能次数；离手重入后重新计数。
        if (operation.perInfusedInHand !== undefined) {
          const infusedCount = getHandInfuseCount(uid);
          if (infusedCount > 0) {
            baseDamage += infusedCount * operation.perInfusedInHand;
            log(`[[icon:infuse]] <b>${esc(card.name)}</b>：本牌在手期间已注能 ${infusedCount} 张，伤害 +${infusedCount * operation.perInfusedInHand}`, 'sys');
          }
        }
        // M2：infuseBonus——注能打出时伤害 +N（镭射「注能(1)：伤害+3」口径，infused 由 exec 层传入）
        if (operation.infuseBonus !== undefined && infused) {
          baseDamage += operation.infuseBonus;
          log(`[[icon:fire]] <b>${esc(card.name)}</b>：注能加成，伤害 +${operation.infuseBonus}`, 'sys');
        }
        // grave 由查询端口提供统一消耗牌堆，普通战斗与 Boss 战使用相同计数。
        if (operation.graveyard !== undefined) {
          const cnt = readState().grave.filter(u => { const o = findCard(u); return o && o.card.type === operation.graveyard.type; }).length;
          if (cnt > 0) {
            baseDamage += cnt * operation.graveyard.perCard;
            log(`[[icon:recycle]] 消耗牌堆增伤：消耗牌堆中有 ${cnt} 张【${esc(operation.graveyard.type)}】牌，伤害 +${cnt * operation.graveyard.perCard}`, 'sys');
          }
        }
        // M2：spellPowerMul——受法伤加成翻倍（爆燃火球）：本段额外再叠 (M-1)×法伤加成
        //（hitFoe→dealDamage 内部对法术伤害叠 1×，此处补齐倍率余量，总量 = 基础 + M×加成）
        if (operation.spellPowerMul !== undefined) {
          const power = getPlayerSpellPower() + (+getPlayerStatus().status?.spellUp || 0);
          if (power > 0) {
            baseDamage += power * (operation.spellPowerMul - 1);
            log(`[[icon:spell-power]] <b>${esc(card.name)}</b>：法伤加成 ×${operation.spellPowerMul}（额外 +${power * (operation.spellPowerMul - 1)}）`, 'sys');
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
        hitCount = operation.hitCount ?? /** @type {{count?: unknown} | undefined} */ (operation.hits)?.count
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
            return alive.length ? [alive[Math.floor(randomBattle('target') * alive.length)]] : [];
          }
          return [preferred && !preferred.dead ? preferred : getAliveFoes()[0]].filter(Boolean);
        };
        // 单段结算：windup → 逐敌（cond 门 → bonus 条件增伤 → hitFoe）→ hit。
        // 返回 { dealt: 本段实际伤害合计, first: 段首目标（null = 无可用目标） }。
        function* castSegment(segment, label, applyModifiers, repeat = null) {
          const windupTargets = pickTargets();
          if (!windupTargets.length) return { dealt: 0, first: null };
          const cue = attackCue(type, card, { hitCount, amount: baseDamage });
          yield { kind: 'windup', targets: windupTargets, ...(cue ? { cue } : {}) };
          const targets = operation.target === 'randomEnemy'
            ? windupTargets.some(foe => !foe.dead && foe.hp > 0) ? windupTargets : pickTargets()
            : pickTargets();
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
            if (repeat && !hitThisSegment) emitRecast({ card, uid, ...repeat, scope: 'damage' });
            const stealthedBefore = combat.isStealthed?.(getPlayerStatus());
            try {
              const hit = hitFoe(foe, damageCard, foeDamage, type, label,
                operation.perTargetPrice ? { preserveBaseDamage: true, deferDefeat: true } : undefined);
              dealt += hit;
              if (hit > 0 && stealthedBefore && !combat.isStealthed(getPlayerStatus())) brokeOwnStealth = true;
            }
            finally {
              if (operation.onKill?.energy !== undefined && foe.dead && foe.hp <= 0 && !energyKills.has(foe)) {
                energyKills.add(foe);
                applyDamageOnKill(card, { energy: operation.onKill.energy }, 1, m2Deps);
              }
            }
            foesHit.push(foe);
            hitThisSegment = true;
          }
          if (operation.perTargetPrice) ports.sweepDead?.();
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
              operation.recast.times > 1 ? `（再施放第 ${k + 1} 次）` : '（再施放）', false,
              { source: operation.recast.on === 'kill' ? '击杀追加' : '末手追加', repeatIndex: k + 1, repeatTotal: operation.recast.times });
            if (result.first === null) break;
            dealtTotal += result.dealt;
          }
        }
        // Recasts belong to this same operation, so lifesteal includes every
        // completed segment while retaining the shared healing-ban boundary.
        if (operation.lifesteal === true && dealtTotal > 0) applyLifesteal(dealtTotal);
        // M2：damage.onKill 结构化击杀奖励（闪金之锤 +币 / 破甲重斩 +甲）。
        // foesHit 按命中段累加，多段打同一敌人会重复计数——按「击杀只数」去重结算
        if (operation.onKill) {
          applyDamageOnKill(card, { ...operation.onKill, energy: undefined }, new Set(foesHit.filter(foe => foe.dead)).size, m2Deps);
        }
        // M2：段绑定记账——curse.bindTarget:'prevDamage' 沿用本段实际命中者
        lastDamageTargets = [...foesHit];
        structuredHit = true;
        did = true;
      }
    }
    if (hasStructuredOnPlay) {
      const silenced = !ignoresSilence && (getPlayerStatus().status.silence || 0) > 0;
      for (const operation of structuredOnPlay) {
        if (!operationMatches(operation)) continue;
        if (foesAnnihilated()) break;
        if (operation.op === 'damage') yield* resolveStructuredDamage([operation]);
        else if (!silenced) yield* resolveStructuredEffects([operation]);
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
      // 旧卡文的墓地、弃牌堆均按统一消耗牌堆计数。
      const graveM = desc.match(/(?:墓地|弃牌堆|消耗牌堆)中每有\s*1\s*张(武术|法术|装备|道具|资源)牌[^。；]*?伤害\s*\+\s*(\d+)/);
      if (graveM) {
        const cnt = readState().grave.filter(u => { const o = findCard(u); return o && o.card.type === graveM[1]; }).length;
        if (cnt > 0) {
          dmgVal += cnt * +graveM[2];
          log(`[[icon:recycle]] 消耗牌堆增伤：消耗牌堆中有 ${cnt} 张【${esc(graveM[1])}】牌，伤害 +${cnt * +graveM[2]}`, 'sys');
        }
      }
      // 注能在手增伤（第十二批·充能射线 2026-09-23）：「本牌在你手牌中时每注能过 1 张卡牌，伤害 +N」——
      // 计数由手牌实例生命周期提供，离手重入后重新计数。
      const inhandM = desc.match(/每注能过\s*1?\s*张?卡牌[^。；]*?伤害\s*\+\s*(\d+)/);
      if (inhandM && getHandInfuseCount(uid) > 0) {
        const infusedCount = getHandInfuseCount(uid);
        dmgVal += infusedCount * +inhandM[1];
        log(`[[icon:infuse]] <b>${esc(card.name)}</b>：本牌在手期间已注能 ${infusedCount} 张，伤害 +${infusedCount * +inhandM[1]}`, 'sys');
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
        const cue = attackCue(type, card, { hitCount: times, amount: dmgVal });
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
              if (i === 0) log(`[[icon:status-bleed]] <b>${esc(foe.name)}</b> 处于流血状态，伤害 +${pierceB[1]}`, 'sys');
            }
            // 固定 hosted 规则：只奖励这张牌实际破除自己的潜行，不把敌方潜行当条件。
            const breakingStealth = stealthBreakBonus && !brokeOwnStealth && combat.isStealthed(getPlayerStatus());
            if (breakingStealth) foeDmg += 2;
            const dealt = hitFoe(foe, card, foeDmg, type, times > 1 ? `（第 ${i + 1} 段）` : '');
            dealtTotal += dealt;
            if (breakingStealth && dealt > 0 && !combat.isStealthed(getPlayerStatus())) brokeOwnStealth = true;
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
            const cue = attackCue(type, card);
            yield { kind: 'windup', targets: [next], ...(cue ? { cue } : {}) };
            next = preferred && !preferred.dead ? preferred : getAliveFoes()[0];
            if (!next) break;
            emitRecast({ card, uid, source: '诅咒追加', repeatIndex: k + 1, repeatTotal: +sm[1], scope: 'damage' });
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
        const cue = attackCue(type, card);
        if (recast.length) yield { kind: 'windup', targets: recast, ...(cue ? { cue } : {}) };
        let recastHit = false;
        for (const foe of recast) {
          if (!foe.dead) {
            if (!recastHit) emitRecast({ card, uid, source: '击杀追加', repeatIndex: 1, repeatTotal: 1, scope: 'damage' });
            hitFoe(foe, card, dmgVal, type, '（再施放）'); recastHit = true;
          }
        }
        if (recastHit) yield { kind: 'hit', segment: times + 1, ...(cue ? { cue } : {}) };
      }
      did = true;
    }
    // 沉默：除攻击外的技能效果全部失效（延迟段与持续段也不注册）
    if (!ignoresSilence && (getPlayerStatus().status.silence || 0) > 0) {
      log(`[[icon:cross]] <b>${esc(card.name)}</b> 的技能效果被沉默封印（只剩攻击生效，持续 ${getPlayerStatus().status.silence} 回合）`, 'warn');
      return;
    }
    function* resolveStructuredEffects(operations) {
      for (const operation of operations) {
        if (!operationMatches(operation)) continue;
        if (foesAnnihilated()) break;   // 终局守卫：伤害段已全灭，heal.selfDamage/coins/draw 等余下 op 不结算
        if (operation.op === 'damage') continue;
        const choice = choiceSemantics.resolveOperation(card, operation, ports);
        if (choice !== null) { did = choice || did; continue; }
        const semantic = yield* resolveSemanticOperation(card, operation, target, ports, { uid, infused, fuelCost });
        if (semantic !== null) { did = semantic || did; continue; }
        if (operation.op === 'status' && operation.status === 'freeze' && operation.target === 'allEnemies' &&
            Number.isInteger(operation.duration) && operation.duration > 0) {
          const targets = getAliveFoes();
          const affected = targets.filter(foe => applyStatus(foe, 'freeze', operation.duration) > 0);
          if (affected.length) {
            const names = affected.length === targets.length
              ? '全体敌人'
              : affected.map(foe => esc(foe.name)).join('、');
            log(`[[icon:status-freeze]] ${names} 被冰冻 ${operation.duration} 回合（无法行动）`, 'sys');
            did = true;
          }
          continue;
        }
        if (operation.op === 'discover' && Number.isInteger(operation.count) && operation.count > 0) {
          queueDiscoverTracked(claimPreparedDiscovery(card, { n: operation.count, pool: operation.pool, costDecayPerTurn: operation.costDecayPerTurn,
            sourceCardId: card.id }));
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
          did = (yield* resolveFoeFightSteps(card, operation, m2Deps)) || did;
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
          const singleEnemy = card.rules?.battle?.target?.side === 'enemy' && !card.rules.battle.target.area;
          const execTarget = lastDamageTargets.length
            ? lastDamageTargets[lastDamageTargets.length - 1]
            : singleEnemy ? target : (target && !target.dead ? target : getAliveFoes()[0]);
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
        // 能量上限命令与文本路径共用；满月形态只加上限，其余卡保留当前能量同加。
        if (operation.op === 'refillEnergy') {
          const current = refillEnergy();
          log(`[[icon:bolt]] 能量回满（${current} 费）`, 'sys');
          did = true;
          continue;
        }
        if (operation.op === 'energyCap') {
          const currentMax = addEnergyCap(operation.n, energyCapGrantsCurrent(card));
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
        // 已定格的牌库不追溯扩容；普通战不使用 BOSS 编组上限。
        if (operation.op === 'deckCap') {
          log(readState().mode === 'boss'
            ? `[[icon:draw-pile]] <b>${esc(card.name)}</b>：牌库上限在开战前编组阶段生效，战斗中 +${operation.n} 不追溯扩容`
            : `[[icon:draw-pile]] <b>${esc(card.name)}</b>：普通战斗不使用 BOSS 编组上限，牌库上限 +${operation.n} 不改变本场牌数`, 'dim');
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
              log(`[[icon:status-heal-ban]] 禁疗中：回复至 ${want} 血无效（还剩 ${getPlayerStatus().status.healban} 回合）`, 'warn');
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
              log(`[[icon:status-heal-ban]] 禁疗中：回复 ${amount} 点生命无效（还剩 ${getPlayerStatus().status.healban} 回合）`, 'warn');
            } else {
              heal(amount);
              addFloat({ unit: 'self', text: '', cls: 'stk sticker-heal', warm: true });
            }
          }
        } else if (operation.op === 'armor') {
          // B3：护甲来源二选一（amountField/amount）；guard=true 叠加格挡（本回合所受伤害降为 1）；
          // decayAtTurnEnd=n 注册「下回合开始时 -n 点」延迟段（与坚盾文本路径同一条 delayed 管线）。
          // M2：priceOf:'discovered' 护甲锚定发现牌价格（挖宝）；consumeEquip 消耗手牌装备为代价（铸甲）。
          if (operation.consumeEquip !== undefined && !(yield* resolveConsumeEquipSteps(card, m2Deps))) {
            // 付不出代价：整段无效（不白拿甲），与手牌代价「付不出即无效果」口径一致
            continue;
          }
          // BC-04（09-30 深审）：priceOf:'discovered' 不在排队时取价——挂 priceArmor 旗给本卡
          // 刚排队的发现 job，由 pickDiscover 按玩家所选牌的价格结算（与文本路径发现同通道）
          if (operation.priceOf === 'discovered' && lastQueuedDiscoverJob &&
              lastQueuedDiscoverJob.sourceCardId === card.id) {
            lastQueuedDiscoverJob.priceArmor = true;
            log('[[icon:plate]] 护甲将按你选中的发现牌价格结算', 'sys');
            did = true;
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
          } else {
            // 定向抽取与普通抽牌共用张数源；filter 只决定选牌，不能覆盖字段、随机区间或诅咒计数。
            let amount = operation.amountField !== undefined ? +card[operation.amountField]
              : operation.range !== undefined ? rollRange(operation.range)
              : +(operation.amount || 0);
            if (operation.perCurseKinds !== undefined) {
              const anchor = lastDamageTargets.length ? lastDamageTargets[lastDamageTargets.length - 1]
                : (target && !target.dead ? target : getAliveFoes()[0]);
              const kinds = countCurseKinds(anchor, m2Deps);
              amount = kinds;
              log(`[[icon:draw-card]] <b>${esc(card.name)}</b>：目标身负 ${kinds} 种诅咒，抽 ${kinds} 张牌`, 'sys');
            }
            if (operation.filter !== undefined) {
              // M2：所有模式按指定类型从真实牌库抽取。
              const want = operation.filter.type;
              const got = deckDraw({ n: amount, type: want });
              log(`[[icon:draw-card]] <b>${esc(card.name)}</b>：从牌库抽取 ${got} 张【${esc(want)}】牌`, 'sys');
            } else {
              const got = drawCards(amount);
              if (typeof countDrawnSpells === 'function') spellsGained += countDrawnSpells();
              log(`[[icon:draw-card]] <b>${esc(card.name)}</b>：抽了 ${got} 张牌`, 'sys');
            }
          }
        }
        did = true;
      }
    }
    // 法力奔涌（2026-09-10 需求 #37/#38）：「对随机敌人释放4个随机法术（这些随机法术默认已注能）」。
    // 识别加名称/ID 兜底——旧档背包里的快照克隆可能带着旧措辞描述，正则失配曾导致整卡无效果。
    const surgeM = desc.match(/对随机敌人释放\s*(\d+|四)\s*个随机法术/);
    if (!suppressText && (surgeM || hasLegacyManaSurge(card))) {
      startSurge(castRandomSpells(surgeM ? (surgeM[1] === '四' ? 4 : Math.max(1, +surgeM[1])) : 4, card.id));
      did = true;
    }
    // —— 立即生效句（逐句结算：句与句不再用「，」拼接——拼接曾污染花开两面的抉择选项，
    //     也让 A 句未识别时吞掉 B 句的独立结算机会）——
    // 例外：神灯类「抉择：1° …；2° …」的编号续句（^\d° 开头）必须并回抉择主句，
    // 否则选项会被拆成独立子句抢先自动结算（2026-09-12 回归修复）
    const imm = [];
    if (!suppressText) parts.immediate.filter(legacyImmediate).forEach(cl => {
      if (/^\s*\d\s*[°º]/.test(cl) && imm.length && /抉择[:：]/.test(imm[imm.length - 1])) imm[imm.length - 1] += '，' + cl;
      else imm.push(cl);
    });
    let healed = false, armored = false, drawn = false;
    for (const cl of imm) {
      // 鬼魅的增伤已由伤害段处理；抽牌统一走下方有条件字段分支，避免文本无条件再抽。
      if (stealthBreakBonus) continue;
      if (foesAnnihilated()) break;   // 终局守卫：前句伤害已全灭，余下立即句不再结算
      // 双镖首段若已击杀原目标，流血不得借文本执行器的空目标回退串到下一名活敌人。
      if (isLegacyBloodpoison(card) && target && target.dead && /流血/.test(cl)) continue;
      const args = [card, cl, target, { structuredHit, infused, fuelCost, uid, hpAtCast }];
      const res = applyTextEffects.steps ? yield* applyTextEffects.steps(...args) : applyTextEffects(...args);
      did = did || res.did;
      healed = healed || res.healed;
      armored = armored || res.armored;
      drawn = drawn || res.drawn;
    }
    // 结构化词条兜底（描述未写明但制作坊标注了回复/护甲/抽卡字段时）——纯注能句未注能时同门跳过（第十二批）
    if (!suppressText && !ownsEquipField('heal') && !(infuseLead && !infused) && !healed && !skillOnly && !foesAnnihilated() && +(card.heal || 0) > 0) {
      const n = +(card.heal || 0);
      if ((getPlayerStatus().status.healban || 0) > 0) {
        log(`[[icon:status-heal-ban]] 禁疗中：回复 ${n} 点生命无效（还剩 ${getPlayerStatus().status.healban} 回合）`, 'warn');
      } else { heal(n); addFloat({ unit: 'self', text: '', cls: 'stk sticker-heal', warm: true }); }
      did = true;
    }
    if (!suppressText && !ownsEquipField('armor') && !(infuseLead && !infused) && !armored && !skillOnly && !foesAnnihilated() && +(card.armor || 0) > 0) {
      addArmor(+(card.armor || 0));
      log(`[[icon:plate]]获得 ${+(card.armor || 0)} 点护甲`, 'sys');
      did = true;
    }
    // 卡面结构化抽卡字段兜底（描述未写「抽 N 张牌」时）——邪能护体 draw:3 依赖此门防未注能白嫖
    const hostedWarlockHandlesItsOwnDraw = card.rules?.battle?.hosted?.includes('warlock') === true;
    if (!suppressText && !ownsEquipField('draw') && !(infuseLead && !infused) && !drawn && !skillOnly &&
        !hostedWarlockHandlesItsOwnDraw && (!stealthBreakBonus || brokeOwnStealth) && !foesAnnihilated() && drawOf(card) > 0) {
      const n = drawOf(card);
      const got = drawCards(n);
      log(`[[icon:draw-card]] <b>${esc(card.name)}</b>：抽了 ${got} 张牌`, 'sys');
      did = true;
    }
    // —— 「回合开始时」生效时刻词条 ——
    const ownedDelayedClause = item => {
      if (item.each) return false;
      const text = String(item.text).replace(/[，,！!（）()\s]/g, '');
      // 只识别已迁移的正午四枪及护甲衰减完整句，不把整个未来时点当成同一效果。
      const shots = text.match(/^(?:对目标)?连开(\d+|[一二三四五六七八九十])枪每枪造成(\d+)点固定伤害$/);
      const decay = text.match(/^(?:你)?失去(\d+)点护甲$/) || text.match(/^[-−](\d+)点(?:护甲)?$/);
      const cnCount = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
      return structuredOnPlay.some(operation => {
        if (decay && operation.op === 'armor') return operation.decayAtTurnEnd === Number(decay[1]);
        if (!shots || operation.op !== 'damage' || operation.schedule === undefined ||
            operation.target !== 'chosenEnemy' || card.dmgType !== 'fixed') return false;
        const amount = operation.amountField !== undefined ? Number(card[operation.amountField]) : operation.amount;
        const count = operation.hitCount ?? /** @type {{count?: unknown} | undefined} */ (operation.hits)?.count ?? (operation.hits === undefined ? 1 : undefined);
        return amount === Number(shots[2]) && count === (cnCount[shots[1]] || Number(shots[1]));
      });
    };
    if (!hasStructuredTrigger(card, 'onTurnStart') && parts.turnStart.length) {
      const turnTexts = parts.turnStart.filter(item => !ownedDelayedClause(item) && !(ownsPassive && Object.hasOwn(equipRules.passive.aura || {}, 'focus') &&
        /(?:获得|回复|能量)\s*\d*\s*点?能量|能量\s*[+＋]/.test(item.text)));
      if (turnTexts.length) { registerTurnStart(card, turnTexts, target); did = true; }
    }
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
return { createBattleResolution };
}

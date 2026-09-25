// Card resolution is isolated behind explicit state reads and domain commands.
import { attackCue } from './battle.attack-cues.js';

// —— schema v2 键位先行守卫（A2，2026-09-25；B1-B3 接线后按 op 收口，2026-09-25）——
// card-rules.schema.js v2 已放行泛化键（docs/card-rules-v2-taxonomy-2026-09-25.md §4/§5）。
// B1/B2（damage：amount/range/cond/bonus/lifesteal/hits{count|range}/randomEnemy/recast）
// 与 B3（heal：amount/upTo/selfDamage/perFuelCost/perSpellHeal；armor：amount/guard/decayAtTurnEnd）
// 已接线并从 pending 集合拆除。仍在 pending 的 v2 键一旦出现在真实卡数据里必须在此
// 炸出——否则 v1 结算路径会静默忽略这些键（如 damage + graveyard 只结算基础伤害），形成错结算。
const INTERPRETER_ONPLAY_OPS = new Set(['damage', 'heal', 'armor', 'draw', 'status', 'discover']);
const V2_PENDING_TRIGGER_KEYS = new Set(['onTurnStart', 'onBattleStart', 'onConsume', 'onDraw', 'onKill']);
// damage 仍 pending：graveyard（墓地增伤，B10 墓地域口径）、schedule（延迟段，需回合调度钩子，B2 尾）；
// hits.perFoe（每人释放一段）同为 pending——嵌套在 hits 内，需单独探查。
const PENDING_DAMAGE_KEYS = ['graveyard', 'schedule'];
// draw 全部 v2 键属 B4（boss/普通战双口径必须结构化表达后才放行）。
const PENDING_DRAW_KEYS = ['amount', 'untilHandN', 'handOps'];

// B1-B3 已接线的 heal/armor v2 键不再 pending；draw 的 v2 键与 damage 的残余键在此逐 op 收口。
function pendingOperationKeys(operation) {
  if (operation.op === 'damage') {
    const keys = PENDING_DAMAGE_KEYS.filter(key => key in operation);
    if (operation.hits != null && typeof operation.hits === 'object' && operation.hits.perFoe !== undefined) {
      keys.push('hits.perFoe');
    }
    return keys;
  }
  if (operation.op === 'draw') return PENDING_DRAW_KEYS.filter(key => key in operation);
  return [];
}

function assertStructuredRulesSupported(card) {
  const triggers = card?.rules?.triggers;
  if (triggers == null || typeof triggers !== 'object') return;
  for (const key of Object.keys(triggers)) {
    if (V2_PENDING_TRIGGER_KEYS.has(key)) {
      throw new TypeError(`Unsupported rules.triggers.${key} for card ${card.id || '<missing id>'}: schema v2 键位先行，解释器分支未接线（迁移批 A3/B4-B11）`);
    }
  }
  const operations = Array.isArray(triggers.onPlay) ? triggers.onPlay : [];
  for (const operation of operations) {
    if (!operation || typeof operation !== 'object') continue;
    if (!INTERPRETER_ONPLAY_OPS.has(operation.op)) {
      throw new TypeError(`Unsupported onPlay operation '${operation.op}' for card ${card.id || '<missing id>'}: schema v2 键位先行，解释器分支未接线（迁移批 A3/B4-B11）`);
    }
    for (const key of pendingOperationKeys(operation)) {
      throw new TypeError(`Unsupported onPlay ${operation.op} parameter '${key}' for card ${card.id || '<missing id>'}: schema v2 键位先行，解释器分支未接线（迁移批 A3/B4-B11）`);
    }
  }
}

function createBattleResolution(ports) {
  const { readState, getPlayerStatus, esc, log, heal, addFloat, addDelayed, takeDeckBottom, deckBottomCount,
    startSurge, getAllCards, isRandomObtainable, randomBattle, getDamageTypes, getDamageTypeMeta,
    fixedDamageType, hasCurse, getAliveFoes, getGrowth, addArmor, applyStatus, findCard, addTempCard, queueDiscover,
    splitClauses, applyTextEffects, registerTurnStart, registerBattle, castRandomSpells,
    drawCards, grantSha, hitFoe, drawOf, isAOE, damagePlayer, getPlayerHp, countDrawnSpells } = ports;
  // B1：伤害条件对象（schema CONDITION_KEYS 共用形状）。
  // 口径对照：foeHpBelow 以「血量 ≤ n」承接斩杀「对 9 血以下」（与 hpCap 同口径）；
  // foeHpHalf 以「血量 ≤ 上限一半」承接惩击 halfB；foeStatus 查目标身上的诅咒层；
  // foeFullHp 以「本段伤害结算前当前满血」承接冷冻射线类「未曾受到过伤害」判定。
  function conditionMatches(cond, foe) {
    if (!cond || typeof cond !== 'object') return true;
    if (cond.foeHpBelow !== undefined && !(foe.hp <= cond.foeHpBelow)) return false;
    if (cond.foeHpHalf === true && !(foe.maxHp && foe.hp <= foe.maxHp / 2)) return false;
    if (cond.foeStatus !== undefined && !((foe.status?.[cond.foeStatus] || 0) > 0)) return false;
    if (cond.foeFullHp === true && Number.isFinite(foe.maxHp) && foe.hp < foe.maxHp) return false;
    return true;
  }

  // B1：区间掷骰（含端点）——与文本路径 dmg.direct 区间口径一致（不稳定射线 4-6）。
  function rollRange(range) {
    const min = Array.isArray(range) ? range[0] : 0;
    const max = Array.isArray(range) ? range[1] : min;
    return min + Math.floor(randomBattle() * (Math.abs(max - min) + 1));
  }

  function* resolveCardSteps(card, target, infused, fuelCost, uid) {

    assertStructuredRulesSupported(card);

    // 血毒双镖（2026-09-16 留言「血毒双镖应该能选择两次目标」）：两段拆开——首段（攻+1 附加流血）
    // 随本牌目标结算；二段（攻+1 附加中毒）由 execPlay 收尾进入点选（interaction 'dart'），
    // 可另选目标或重复选择同一目标
    let desc = String(card.desc || '');
    const hasStructuredOnPlay = card.rules?.triggers != null &&
      Object.prototype.hasOwnProperty.call(card.rules.triggers, 'onPlay');
    const structuredOnPlay = hasStructuredOnPlay ? card.rules.triggers.onPlay : [];
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
    const isDmgType = getDamageTypes().includes(card.type);
    let structuredHit = false;
    // —— 伤害（卡面伤害词条立即结算，不受沉默影响） ——
    if (hasStructuredOnPlay) {
      const type = getDamageTypeMeta()[card.dmgType] ? card.dmgType : fixedDamageType;
      const damageCard = { ...card, desc: '' };
      for (const operation of structuredOnPlay) {
        if (['heal', 'armor', 'draw', 'status', 'discover'].includes(operation.op)) continue;
        if (operation.op !== 'damage' || (operation.amountField !== undefined && operation.amountField !== 'dmg')) {
          throw new TypeError(`Unsupported onPlay operation for card ${card.id || '<missing id>'}`);
        }
        // B1：伤害来源三选一（schema 保证恰好一个）——v1 字段引用 / v2 字面量 / v2 区间。
        // 回合成长（充能火球）按 uid 叠加；区间每次施放掷一次（含端点，与 dmg.direct 同口径）。
        const sources = ['amountField', 'amount', 'range'].filter(field => operation[field] !== undefined);
        if (sources.length !== 1) {
          throw new TypeError(`Unsupported onPlay damage source for card ${card.id || '<missing id>'}`);
        }
        const growth = (uid && getGrowth(uid)) || 0;
        const baseDamage = sources[0] === 'amountField' ? +card[operation.amountField] + growth
          : sources[0] === 'amount' ? operation.amount + growth
          : rollRange(operation.range);
        // B2：段数来源——v1 hitCount / v2 hits.count / v2 hits.range（每次施放掷一次）；
        // hits.perFoe 已由顶部守卫拦截（pending）。
        const hitCount = operation.hitCount ?? operation.hits?.count
          ?? (operation.hits?.range !== undefined ? rollRange(operation.hits.range) : 1);
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
            dealt += hitFoe(foe, damageCard, foeDamage, type, label, hitCount > 1 ? segment + 1 : null);
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
        if (operation.lifesteal === true && dealtTotal > 0) {
          if ((getPlayerStatus().status.healban || 0) > 0) {
            log(`[[icon:heart]] 禁疗中：吸血回复无效（还剩 ${getPlayerStatus().status.healban} 回合）`, 'warn');
          } else {
            heal(dealtTotal);
            addFloat({ unit: 'self', text: '', cls: 'stk sticker-heal', warm: true });
            log(`[[icon:heart]] 吸血：回复 ${dealtTotal} 点生命`, 'ok');
          }
        }
        // B2：recast:{on:'kill'}——本 op 击杀过敌人时再施放 N 次（镜像文本路径击杀连锁：
        // 余烬爆裂/饱和打击）。再施放段不做 cond/bonus 复判，按基础伤害结算。
        if (operation.recast && operation.recast.on === 'kill' && foesHit.some(foe => foe.dead)) {
          log(`[[icon:sparkles]] <b>${esc(card.name)}</b>：击杀敌人，再施放${operation.recast.times > 1 ? ` ${operation.recast.times} 次` : '一次'}`, 'sys');
          for (let k = 0; k < operation.recast.times; k++) {
            const result = yield* castSegment(hitCount + k,
              operation.recast.times > 1 ? `（再施放第 ${k + 1} 次）` : '（再施放）', false);
            if (result.first === null) break;
            dealtTotal += result.dealt;
          }
        }
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
            dealtTotal += hitFoe(foe, card, foeDmg, type, times > 1 ? `（第 ${i + 1} 段）` : '', times > 1 ? i + 1 : null);
            hitThisSegment = true;
          }
        }
        if (hitThisSegment) yield { kind: 'hit', segment: i + 1, ...(cue ? { cue } : {}) };
      }
      // 吸血：回复等量生命（嗜血刃/噬血术/血蝠风暴）
      if (/回复等量生命/.test(desc) && dealtTotal > 0) {
        if ((getPlayerStatus().status.healban || 0) > 0) {
          log(`[[icon:heart]] 禁疗中：吸血回复无效（还剩 ${getPlayerStatus().status.healban} 回合）`, 'warn');
        } else {
          heal(dealtTotal);
          addFloat({ unit: 'self', text: '', cls: 'stk sticker-heal', warm: true });
          log(`[[icon:heart]] 吸血：回复 ${dealtTotal} 点生命`, 'ok');
        }
      }
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
            hitFoe(next, card, dmgVal, type, `（额外施放第 ${k + 1} 次）`, k + 1);
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
          const amount = operation.amountField !== undefined ? +(card[operation.amountField] || 0) : +(operation.amount || 0);
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
          // draw：v2 抽牌键（amount/untilHandN/handOps）仍属 B4，由顶部守卫拦截；这里保持 v1 路径
          if (operation.amountField !== 'draw') {
            throw new TypeError(`Unsupported onPlay operation for card ${card.id || '<missing id>'}`);
          }
          const amount = +card[operation.amountField];
          if (readState().mode === 'boss') {
            const got = drawCards(amount);
            if (typeof countDrawnSpells === 'function') spellsGained += countDrawnSpells();
            log(`[[icon:cards]] <b>${esc(card.name)}</b>：抽了 ${got} 张牌`, 'sys');
          } else {
            grantSha(amount);
            log(`[[icon:cards]] <b>${esc(card.name)}</b>：获得 ${amount} 张【初始攻击】（普通战斗抽牌效果改为获得初始攻击）`, 'sys');
          }
        }
        did = true;
      }
    }
    // 法力奔涌（2026-09-10 需求 #37/#38）：「对随机敌人释放4个随机法术（这些随机法术默认已注能）」。
    // 识别加名称/ID 兜底——旧档背包里的快照克隆可能带着旧措辞描述，正则失配曾导致整卡无效果。
    const surgeM = desc.match(/对随机敌人释放\s*(\d+|四)\s*个随机法术/);
    if (!hasStructuredOnPlay && (surgeM || card.id === 'cc-mana-surge' || /法力奔涌/.test(String(card.name || '')))) {
      startSurge(castRandomSpells(surgeM ? (surgeM[1] === '四' ? 4 : Math.max(1, +surgeM[1])) : 4, card.id));
      did = true;
    }
    // —— 立即生效句（逐句结算：句与句不再用「，」拼接——拼接曾污染花开两面的抉择选项，
    //     也让 A 句未识别时吞掉 B 句的独立结算机会）——
    // 例外：神灯类「抉择：1° …；2° …」的编号续句（^\d° 开头）必须并回抉择主句，
    // 否则选项会被拆成独立子句抢先自动结算（2026-09-12 回归修复）
    const imm = [];
    if (!hasStructuredOnPlay) parts.immediate.forEach(cl => {
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
    if (!hasStructuredOnPlay && !(infuseLead && !infused) && !healed && !skillOnly && +(card.heal || 0) > 0) {
      const n = +(card.heal || 0);
      if ((getPlayerStatus().status.healban || 0) > 0) {
        log(`[[icon:heart]] 禁疗中：回复 ${n} 点生命无效（还剩 ${getPlayerStatus().status.healban} 回合）`, 'warn');
      } else { heal(n); addFloat({ unit: 'self', text: '', cls: 'stk sticker-heal', warm: true }); }
      did = true;
    }
    if (!hasStructuredOnPlay && !(infuseLead && !infused) && !armored && !skillOnly && +(card.armor || 0) > 0) {
      addArmor(+(card.armor || 0));
      log(`[[icon:plate]]获得 ${+(card.armor || 0)} 点护甲`, 'sys');
      did = true;
    }
    // 卡面结构化抽卡字段兜底（描述未写「抽 N 张牌」时）——邪能护体 draw:3 依赖此门防未注能白嫖
    if (!hasStructuredOnPlay && !(infuseLead && !infused) && !drawn && !skillOnly && drawOf(card) > 0) {
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
    if (!hasStructuredOnPlay && parts.turnStart.length) { registerTurnStart(card, parts.turnStart); did = true; }
    // —— 「本局对战内」持续时间词条 ——
    if (!hasStructuredOnPlay) parts.battle.forEach(cl => { did = registerBattle(card, cl, target) || did; });
    // 「被注能时」句在打出时不结算（splitClauses 已剥出，留给 resolveInfusedFuel）
    if (!did && !skillOnly && !hasStructuredOnPlay) log(`[[icon:play]] <b>${esc(card.name)}</b>：该效果在 M1 后续实装（占位）`, 'dim');
  
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

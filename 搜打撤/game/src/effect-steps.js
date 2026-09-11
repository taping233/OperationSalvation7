/* ============================================================
 * effect-steps.js —— 牌效动词执行器（2026-09-11 架构批次 7：dispatch 彻底重写）
 *
 * 旧实现是 createEffectExecutor 里 ~1100 行的顺序 if 链：每个效果动词一段
 * 「正则匹配 + 结算」，识别门控（!did）、无条件段、提前 return 全部内联在
 * 控制流里，只有作者能读。本文件把这条链改写成**有序步骤表**：
 *
 *   每一步 = { id, label, gate, when(ctx) -> match|null, run(ctx, m) }
 *     gate 'fresh'  —— ctx.did 已置位时整步跳过（＝旧代码里的 `xxx && !did`）
 *     gate 'always' —— 无论 did 与否都评估（＝旧代码里没有 !did 的分支）
 *     when 纯函数：只读 ctx 返回匹配结果；命中才执行 run
 *     run 返回 { halt, result } 时整个执行器立即返回 result（提前 return 类）
 *
 * 铁律：**顺序即语义**。旧链对顺序与 did 门控敏感（伤害先于诅咒、洗入先于
 * 「然后抽」、抉择拦截在其它动词之前……都是修过的回归），重排顺序=改行为。
 * 新增效果 = 在正确位置插入一个步骤条目；改数值 = 只改该条目的 run。
 *
 * 行为等价已用录制式差分验证：新旧执行器在同一套假战斗端口上跑全卡库
 * 全部子句 × structuredHit/infused/mode 矩阵，调用轨迹、日志、终态逐字一致。
 *
 * 与 effect-verbs.js 的分工：那边是「识别」注册表（覆盖度断言 + 哨兵），
 * 本文件是「结算」本体；ELSEWHERE 命中仍只标记 did，不在此重复结算。
 * ============================================================ */
import { matchElsewhere, noteUnknownEffect } from './effect-verbs.js';

/* ---------- 限制卡池解析（老板 2026-09-08 定版池子清单） ----------
 * 「发现 / 随机获取 / 获得 N 张 ____卡/牌」句式中的名词短语 → 卡池谓词。
 * 返回 null = 未识别出限定（走通用随机池，isRandomObtainable 过滤）。 */
export const POOL_NUM_MAP = { '一': 1, '两': 2, '二': 2, '三': 3, '四': 4, '五': 5 };
const CURSE_DESC_RE = /诅咒|中毒|流血|冰冻|沉默|破甲|禁疗|灼烧/;
const CURSE_CAPABLE = (c) => ['武术', '法术', '装备', '能力卡'].includes(c.type) &&
  CURSE_DESC_RE.test(String(c.desc || ''));

export function parsePoolNoun(raw, myClass) {
  let s = String(raw || '');
  if (!s.endsWith('能力卡')) s = s.replace(/(卡牌|的牌|牌|卡)$/, '');
  s = s.replace(/的$/, '');
  if (!s || s === '随机' || s === '另' || s === '任意' || s === '等量随机') return null;
  const preds = [];
  const cm = s.match(/^([0-5一二三四五])费/);
  if (cm) {
    const n = POOL_NUM_MAP[cm[1]] != null ? POOL_NUM_MAP[cm[1]] : +cm[1];
    s = s.slice(cm[0].length);
    preds.push(c => (+c.cost || 0) === n);
  }
  if (/^能施加诅咒/.test(s)) {
    s = s.replace(/^能施加诅咒的?/, '');
    preds.push(CURSE_CAPABLE);
  }
  if (/^(其它|其他)职业/.test(s)) { s = ''; preds.push(c => !!c.cls && !!myClass && c.cls !== myClass); }
  else if (/^本职业/.test(s)) { s = ''; preds.push(c => !!c.cls && c.cls === myClass); }
  if (/^招式/.test(s)) { s = s.replace(/^招式/, ''); preds.push(c => c.type === '武术'); }
  // 复合池「传说或能力」（神秘召唤）：指定稀有度 或 能力卡类型
  const om = s.match(/^(传说|史诗|稀有|古朴)或能力$/);
  if (om) { s = ''; preds.push(c => c.rarity === om[1] || c.type === '能力卡'); }
  const typeKey = ['武术', '法术', '装备', '能力卡', '道具'].find(t => s === t);
  if (typeKey) { s = ''; preds.push(c => c.type === typeKey); }
  const rarKey = ['传说', '史诗', '稀有', '古朴'].find(r => s === r);
  if (rarKey) { s = ''; preds.push(c => c.rarity === rarKey); }
  const series = /系列$/.test(s);
  const base = s.replace(/系列$/, '');
  if (['火球', '箭', '箭矢', '药水', '杀', '禁咒', '形态'].includes(base)) {
    s = '';
    const key = base === '箭矢' ? '箭' : base;
    if (key === '杀') preds.push(c => c.id === 'builtin-sha' || c.name === '杀' || c.name === '初始攻击');
    else if (key === '火球') preds.push(series ? (c => String(c.name || '').includes('火球')) : (c => c.name === '火球'));
    else if (key === '箭') preds.push(c => String(c.name || '').includes('箭'));
    else if (key === '药水') preds.push(c => c.type === '道具' && String(c.name || '').includes('药水'));   // 药水池定版（2026-09-09）：所有带「药水」名字的道具——法术「药水魔法」不在池内
    else if (key === '禁咒') preds.push(c => String(c.name || '').startsWith('禁咒'));
    else if (key === '形态') preds.push(c => /形态/.test(String(c.name || '')));
  }
  if (/^注能/.test(s)) { s = ''; preds.push(c => +(c.infuse || 0) > 0 || /注能/.test(String(c.desc || ''))); }
  if (!preds.length || s) return null;   // 有未识别的残留名词 → 交回通用池，避免误配
  return c => preds.every(p => p(c));
}

const CN_NUM = { '一': 1, '两': 2, '二': 2, '三': 3, '四': 4, '五': 5 };
const num = (s) => (CN_NUM[s] != null ? CN_NUM[s] : +s);
const HALT = (result) => ({ halt: true, result });
const FRESH_RESULT = (did) => ({ did, drawn: false, healed: false, armored: false });

/**
 * 创建有序步骤表。deps 是战斗侧显式端口（与旧 createEffectExecutor 同一套）。
 * 顺序 = 旧 if 链的物理顺序，不得重排。
 */
export function createEffectSteps(deps) {
  const {
    combat, getAlive, getPlayerStatus, getPlayerDefense, getMode,
    log, escapeHtml, heal, pushFloat, drawCards, grantStarterAttack,
    markNoDrawNext, queueDiscover, randomDiscoverCard, addTempCard,
    addDeckCard, allCards, shuffleDeck, addEnergy, addEnergyCap,
    queueHandSelect, restoreConsumed, random01,
    getPlayerHp, getHandSize, getHandCards, burstPoison, deckDraw, fleeBattle,
    getPlayerClass, getPlayerCaster, foeIndexOf, releaseHandMatches,
    autoPlayHandType, setShaTransform, setConsumeFireball,
    damagePlayer, addPlayerMaxHp, dumpHand,
    queueChoice, setStealthStrike, setNextSpellTwice,
    registerTurnStartText,
    getInfuseFuels, getPriceOfLastDrawn, dealAoeFixed, replaceShaInDeck,
    summonAlly, setExtraTurn, setDeathSave, queuePouchCast,
    registerGrowthCard, unlockSeal, randomAcquired, handCurseSpecs, queueSwapCostDiscover,
  } = deps;
  const esc = escapeHtml;

  /** 对单个目标结算伤害并冒伤害数字（旧代码里重复了 ~10 次的固定搭配）。 */
  const hitFoe = (ctx, t, n, type, caster = {}) => {
    const r = combat.dealDamage(caster, t, n, type);
    if (r.dealt > 0) pushFloat({ unit: foeIndexOf ? foeIndexOf(t) : 0, text: '-' + r.dealt, cls: 'dmg' });
    return r;
  };

  return [
    /* ============ 前置改写与门控（旧实现顶部） ============ */
    {
      id: 'pre.infuseLead', gate: 'always', label: '「注能(N)：效果」前缀剥离',
      when: (ctx) => ctx.desc.match(/^注能\s*[（(][^）)]*[）)][：:]?\s*(.+)$/),
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

    /* ============ 诅咒与祝福段（多为无条件段） ============ */
    {
      id: 'curse.burn', gate: 'always', label: '灼烧（不叠加、按回合固定掉血）',
      when: (ctx) => ctx.desc.match(/(?:附加|施加|攻击并)\s*(?:\d+\s*层?\s*)?灼烧/),
      run: (ctx, m) => {
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
        const fm = ctx.desc.match(/(?:冻结|冰冻)状态\s*(\d+)\s*回合/);
        const n = fm ? +fm[1] : (ctx.durOv ? +ctx.durOv : 1);
        // 2026-09-06 #13：desc 带「冰冻 N 名」时对前 N 个存活目标生效；2026-09-12：支持中文量词
        const multiM = ctx.desc.match(/(?:冰冻|冻结)\s*(\d+|[一两二三四五])\s*名/);
        const multiN = multiM ? num(multiM[1]) : 0;
        if (multiN > 1) {
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
        return ((/免疫伤害/.test(ctx.desc) || /无敌/.test(ctx.desc)) && !dsave) ? true : null;
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

    /* ============ 伤害段 ============ */
    {
      id: 'dmg.direct', gate: 'always', label: '造成 N 点固定/法术/真实/攻击伤害（结构化已结算时跳过）',
      // 卡面伤害词条已结算过时跳过，防双倍；「消耗该牌时」前缀句只在消耗触发点结算。
      // 位置在诅咒处理之后：流血药水类「造成 N 点伤害，附加流血」需要伤害与诅咒都结算
      when: (ctx) => (!ctx.flags.structuredHit && !/该牌时/.test(ctx.desc))
        ? ((sp => sp ? [null, sp[1], '法术'] : null)(ctx.desc.match(/造成\s*(\d+)\s*点法(?:术)?伤/))
          || ctx.desc.match(/造成\s*(\d+)\s*点(?:\s*(固定|法术|真实|攻击))?\s*伤害/))
        : null,
      run: (ctx, tdm) => {
        const type = tdm[2] === '法术' ? combat.TYPES.SPELL
          : tdm[2] === '真实' ? combat.TYPES.TRUE
          : tdm[2] === '攻击' ? combat.TYPES.ATTACK : combat.TYPES.FIXED;
        const aoe = /所有敌人|敌方全体|全体敌人|目标为全体|对全体/.test(ctx.desc);
        const targets = (aoe ? getAlive().slice() : (ctx.curseTarget ? [ctx.curseTarget] : [])).filter(t => t && !t.dead);
        const caster = getPlayerCaster ? getPlayerCaster() : {};
        let total = 0;
        targets.forEach(t => { total += hitFoe(ctx, t, +tdm[1], type, caster).dealt; });
        if (targets.length) {
          log(`[[icon:play]] <b>${esc(ctx.card.name)}</b> → ${targets.map(t => esc(t.name)).join('、')}：造成 <b>${total}</b> 点${combat.TYPE_NAME[type]}`, 'sys');
          ctx.did = true;
        }
      },
    },
    {
      id: 'dmg.fourShots', gate: 'fresh', label: '连开四枪（4×2 固定）',
      when: (ctx) => /连开\s*四\s*枪/.test(ctx.desc) ? true : null,
      run: (ctx) => {
        const t = ctx.curseTarget;
        let total = 0;
        for (let i = 0; i < 4 && t && !t.dead; i++) total += hitFoe(ctx, t, 2, combat.TYPES.FIXED).dealt;
        log(`[[icon:swords]] <b>连开四枪</b>：对 ${t ? esc(t.name) : '目标'} 造成 ${total} 点固定伤害（每枪 2 点）`, 'sys');
        ctx.did = true;
      },
    },
    {
      id: 'dmg.multiAttack', gate: 'fresh', label: '「攻击 N 次」整句（手选消耗后的尾段）',
      when: (ctx) => ctx.desc.match(/^攻击\s*(\d+)\s*次[。.！!]?$/),
      run: (ctx, m) => {
        const t = ctx.curseTarget;
        const caster = getPlayerCaster ? getPlayerCaster() : {};
        const times = Math.max(1, +m[1]);
        let total = 0;
        for (let i = 0; i < times && t && !t.dead; i++) total += hitFoe(ctx, t, 0, combat.TYPES.ATTACK, caster).dealt;
        if (t) log(`[[icon:swords]] <b>${esc(ctx.card.name)}</b> → ${esc(t.name)}：攻击 <b>${times}</b> 次，共造成 <b>${total}</b> 点攻击伤害`, 'sys');
        ctx.did = true;
      },
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
      id: 'curse.randomKinds', gate: 'fresh', label: '附加 N 种随机诅咒（致命射线）',
      when: (ctx) => ctx.desc.match(/附加\s*(\d+)\s*种随机诅咒/),
      run: (ctx, m) => {
        const keys = ['bleed', 'poison', 'freeze', 'silence', 'abreak', 'healban', 'burn']
          .sort(() => random01() - 0.5)
          .slice(0, +m[1]);
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
          (key === '杀' ? (c.id === 'builtin-sha' || c.name === '杀' || c.name === '初始攻击')
            : key === '招式' ? c.type === '武术'
            : String(c.name || '').includes(key)));
        const c = pool.length ? pool[Math.floor(random01() * pool.length)] : null;
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
      run: (ctx, m) => {
        const t = ctx.curseTarget;
        if (t) {
          const keyMap = { '冰冻': 'freeze', '流血': 'bleed', '中毒': 'poison', '沉默': 'silence', '破甲': 'abreak', '禁疗': 'healban', '灼烧': 'burn' };
          if (m[1]) hitFoe(ctx, t, +m[1], combat.TYPES.SPELL, getPlayerCaster ? getPlayerCaster() : {});
          m[2].split(/[、，]\s*/).forEach(w => combat.addCurse(t, keyMap[w], 1));
          log(`[[icon:skull]] <b>${esc(t.name)}</b> 附加：${esc(m[2])}${m[1] ? `（并受到 ${m[1]} 点法术伤害）` : ''}`, 'sys');
          ctx.did = true;
        }
      },
    },
    {
      id: 'dmg.fireballN', gate: 'fresh', label: '施放 N 次火球（星陨之力）',
      when: (ctx) => (ctx.curseTarget ? ctx.desc.match(/施放\s*(\d+)\s*次?火球(?:术)?/) : null),
      run: (ctx, m) => {
        const caster = getPlayerCaster ? getPlayerCaster() : {};
        let total = 0;
        for (let k = 0; k < +m[1] && ctx.curseTarget && !ctx.curseTarget.dead; k++) {
          total += hitFoe(ctx, ctx.curseTarget, 4, combat.TYPES.SPELL, caster).dealt;
        }
        log(`[[icon:fire]] <b>${esc(ctx.card.name)}</b>：施放 ${m[1]} 次火球 → ${esc(ctx.curseTarget.name)}，共 ${total} 点法术伤害`, 'sys');
        ctx.did = true;
      },
    },
    {
      id: 'dmg.stormFireball', gate: 'fresh', label: '全体敌人每人 1 次火球（风暴火球）',
      when: (ctx) => ctx.desc.match(/(?:每个?敌人|全体敌人|敌方全体)每人?释放\s*(?:(\d+)\s*次)?火球/),
      run: (ctx, m) => {
        const caster = getPlayerCaster ? getPlayerCaster() : {};
        const per = m[1] ? +m[1] : 1;
        let total = 0;
        getAlive().slice().forEach(t => {
          for (let k = 0; k < per && !t.dead; k++) total += hitFoe(ctx, t, 4, combat.TYPES.SPELL, caster).dealt;
        });
        log(`[[icon:fire]] 火球风暴：对全体敌人各施放 ${per} 次火球，共 ${total} 点法术伤害`, 'sys');
        ctx.did = true;
      },
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
        combat.addBlessing(ctx.pstat, 'reduce', n, 1);
        log(`[[icon:shield]] <b>闪避</b>：本回合受到的伤害 -${n}`, 'ok');
        ctx.did = true;
      },
    },

    /* ============ 回复 / 护甲 / 抽牌 / 手选段 ============ */
    {
      id: 'heal.n', gate: 'always', label: '回复 N 点生命 / +N 血',
      when: (ctx) => ctx.desc.match(/回复\s*(\d+)\s*(?:点\s*生命|点?血)/) || ctx.desc.match(/\+\s*(\d+)\s*血/),
      run: (ctx, m) => {
        ctx.healed = true;
        if ((ctx.pstat.status.healban || 0) > 0) {
          log(`[[icon:heart]] 禁疗中：回复 ${m[1]} 点生命无效（还剩 ${ctx.pstat.status.healban} 回合）`, 'warn');
        } else { heal(+m[1]); pushFloat({ unit: 'self', text: '💚', cls: 'stk', warm: true }); }
        ctx.did = true;
      },
    },
    {
      id: 'heal.restoreConsumed', gate: 'always', label: '战斗内复原/复活消耗卡',
      when: (ctx) => ctx.desc.match(/(?:复原|复活)\s*(?:最多)?\s*(\d+)?\s*张/),
      run: (ctx, m) => { const c = restoreConsumed(+(m[1] || 1)); if (c) ctx.did = true; },
    },
    {
      id: 'hand.selectFamily', gate: 'fresh', label: '手选家族：选牌施放 / 复制 / 消耗+尾段',
      when: (ctx) => {
        const selPlay = ctx.desc.match(/选择(?:\s*手牌中)?\s*(\d+|[一两二三四五])\s*张(?:手牌中的?)?\s*(武术|法术|装备|牌)?\s*卡?[^，。；;]*?(?:施放|释放|打出)/);
        if (selPlay) return { kind: 'play', m: selPlay };
        if (/选择并复制你的\s*(?:1\s*|一\s*)?张?手牌/.test(ctx.desc) && typeof queueHandSelect === 'function') return { kind: 'copy' };
        const consM = ctx.desc.match(/消耗\s*(一张|两|二|三|\d+)\s*张?\s*(?:手牌中的)?(初始攻击|武术|法术|装备|牌|杀)牌?[,，]\s*(.+)$/);
        if (consM) return { kind: 'consume', m: consM };
        return null;
      },
      run: (ctx, m) => {
        if (m.kind === 'play') {
          // 与旧实现同一张受限映射：这里「四/五」历史上就落回 1，保持行为不变
          const N23 = { '一': 1, '两': 2, '二': 2, '三': 3 };
          const n = N23[m.m[1]] || +m.m[1] || 1;
          queueHandSelect({ n, type: m.m[2] === '牌' ? null : m.m[2], act: 'play' });
          log(`[[icon:cards]] 从手牌选择 <b>${n}</b> 张${m.m[2] && m.m[2] !== '牌' ? m.m[2] : ''}牌打出`, 'sys');
          ctx.did = true;
          return;
        }
        if (m.kind === 'copy') {
          // 深红丝袋：选择并复制 1 张手牌（复制件置入手牌，原牌保留）
          queueHandSelect({ n: 1, type: null, act: 'copy' });
          log(`[[icon:cards]] 从手牌选择 <b>1</b> 张复制（原牌保留）`, 'sys');
          ctx.did = true;
          return;
        }
        const consM = m.m;
        const n = consM[1] === '一张' ? 1 : (num(consM[1]) || 1);
        queueHandSelect({ n, type: consM[2] === '牌' ? null : consM[2], act: 'consume', thenText: consM[3], target: ctx.curseTarget, srcCard: ctx.card });
        // 尾段效果在消耗完成后经 thenText 结算——立即段提前收口，防止同一句被后续处理器再吃一遍。
        // 2026-09-10 留言 #25：尾段已有的回复/护甲/抽卡要如实回报，否则结构化兜底会再发一次。
        const tail = consM[3];
        ctx.did = true;
        ctx.drawn = /抽\s*(?:\d+|[一二两三四])\s*张/.test(tail);
        ctx.healed = /回复|\+\s*\d+\s*血/.test(tail);
        ctx.armored = /护甲|\+\s*\d+\s*甲/.test(tail);
        return HALT({ did: true, drawn: ctx.drawn, healed: ctx.healed, armored: ctx.armored });
      },
    },
    {
      id: 'misc.mystery', gate: 'fresh', label: '随机神秘效果（神秘药水三选一）',
      when: (ctx) => /随机神秘效果/.test(ctx.desc) ? true : null,
      run: (ctx) => {
        const r = random01();
        if (r < 1 / 3) { heal(8); log('[[icon:flask]] 神秘药水：回复 <b>8</b> 点生命', 'ok'); }
        else if (r < 2 / 3) { drawCards(2); log('[[icon:flask]] 神秘药水：抽 <b>2</b> 张牌', 'ok'); }
        else {
          const c = randomDiscoverCard(null);
          if (c) {
            addTempCard(c);
            if (typeof randomAcquired === 'function') randomAcquired(c);   // 阿猫的礼物：随机获取触发
            log(`[[icon:flask]] 神秘药水：随机获得【<b>${esc(c.name)}</b>】置入手牌`, 'loot');
          }
          else log('[[icon:flask]] 神秘药水：卡牌库是空的，什么也没有发生', 'dim');
        }
        ctx.did = true;
      },
    },
    {
      id: 'def.armor', gate: 'always', label: '获得 N 点护甲 / +N 甲',
      when: (ctx) => ctx.desc.match(/获得\s*(\d+)\s*点?\s*护甲/) || ctx.desc.match(/\+\s*(\d+)\s*甲/),
      run: (ctx, m) => { ctx.armored = true; ctx.pdef.armor += +m[1]; log(`[[icon:plate]] 获得 ${m[1]} 点护甲`, 'sys'); ctx.did = true; },
    },
    {
      id: 'def.shield', gate: 'always', label: '获得 N 点护盾',
      when: (ctx) => ctx.desc.match(/获得\s*(\d+)\s*点?\s*护盾/),
      run: (ctx, m) => { ctx.pdef.shield += +m[1]; log(`[[icon:shield]] 获得 ${m[1]} 点护盾`, 'sys'); ctx.did = true; },
    },
    {
      id: 'def.guard', gate: 'always', label: '格挡：本回合所受伤害降为 1',
      when: (ctx) => /本回合所受伤害降为/.test(ctx.desc) ? true : null,
      run: (ctx) => {
        ctx.pdef.guard = true;
        log('[[icon:shield]] 格挡：本回合所受伤害降为 1', 'sys');
        ctx.did = true;
      },
    },
    {
      id: 'buff.purify', gate: 'always', label: '净化',
      when: (ctx) => /净化/.test(ctx.desc) ? true : null,
      run: (ctx) => {
        const cleared = combat.purify(ctx.pstat);
        log(cleared.length
          ? `[[icon:sparkles]] 净化：清除了身上的 ${cleared.map(k => combat.CURSE_META[k].name).join('、')}`
          : '[[icon:sparkles]] 净化：身上没有诅咒，干干净净', 'ok');
        ctx.did = true;
      },
    },
    {
      id: 'draw.n', gate: 'always', label: '抽 N 张牌（BOSS 抽牌 / 普通战获得初始攻击）',
      when: (ctx) => {
        // 「回合开始时额外抽」=形态效果；「每释放 1 张，抽 1 张」=连弩随行抽牌，均不在此结算
        const turnExtraDraw = /回合开始时[^。]*?额外抽/.test(ctx.desc);
        const perReleaseDraw = /每(释放|打出)\s*1\s*张/.test(ctx.desc);
        const perCurseDraw = ctx.desc.match(/每有\s*1\s*种诅咒[^。]*?抽\s*(\d+)\s*张牌/);
        const dm = ctx.desc.match(/抽\s*(\d+)\s*[-—~～至]\s*(\d+)\s*张牌/) || ctx.desc.match(/抽\s*(\d+)\s*张牌/);
        if ((dm || perCurseDraw) && !turnExtraDraw && !perReleaseDraw && !/该牌时/.test(ctx.desc)
          && !/洗入牌库[^。]*然后抽/.test(ctx.desc)) return { dm, perCurseDraw };
        return null;
      },
      run: (ctx, m) => {
        let n = m.perCurseDraw ? +m.perCurseDraw[1] : +m.dm[1];
        if (m.perCurseDraw && ctx.curseTarget) {
          const kinds = combat.CURSES.filter(k => (ctx.curseTarget.status[k] || 0) > 0).length;
          n *= Math.max(1, kinds);
          log(`[[icon:skull]] 目标身上有 ${kinds} 种诅咒，抽牌量放大`, 'sys');
        }
        if (getMode() === 'boss') {
          const got = drawCards(n);
          log(`[[icon:cards]] <b>${esc(ctx.card.name)}</b>：抽了 ${got} 张牌`, 'sys');
        } else {
          grantStarterAttack(n);
          log(`[[icon:cards]] <b>${esc(ctx.card.name)}</b>：获得 ${n} 张【初始攻击】（普通战斗抽牌效果改为获得初始攻击）`, 'sys');
        }
        ctx.did = true; ctx.drawn = true;
        // 万剑归宗：抽完后直接释放其中的武术/法术
        const autoM = ctx.desc.match(/直接释放其中(武术|法术|招式)/);
        if (autoM && typeof autoPlayHandType === 'function') {
          const played = autoPlayHandType(autoM[1] === '招式' ? '武术' : autoM[1]);
          if (played) log(`[[icon:swords]] <b>万剑归宗</b>：直接释放了其中 ${played} 张${autoM[1]}`, 'ok');
        }
      },
    },
    {
      id: 'draw.noDrawNext', gate: 'always', label: '下回合无法抽牌',
      when: (ctx) => /下回合无法抽牌|下个回合无法抽牌/.test(ctx.desc) ? true : null,
      run: (ctx) => {
        markNoDrawNext();
        log('[[icon:cross]] 已标记：<b>下回合开始无法抽牌</b>', 'sys');
        ctx.did = true;
      },
    },

    /* ============ 击杀 / 行动 / 资源段 ============ */
    {
      id: 'kill.minions', gate: 'fresh', label: '消灭 N 名敌人（可带攻击力门槛，无门槛优先残血）',
      when: (ctx) => ctx.desc.match(/消灭\s*(\d+)\s*名(?:\s*攻击力\s*(\d+)\s*点?及以下)?/),
      run: (ctx, m) => {
        const n = +m[1];
        const cap = m[2] ? +m[2] : null;
        let targets;
        if (cap != null) {
          targets = getAlive().filter(f => !f.dead && (f.affix ? false : true) && (f.atk || 0) <= cap).slice(0, n);
        } else {
          targets = getAlive().filter(f => !f.dead && f.hp > 0 && f.hp < (f.maxHp || f.hp)).slice(0, n);
        }
        targets.forEach(f => {
          f.hp = 0; f.dead = true;
          log(`[[icon:skull]] <b>${esc(f.name)}</b> 被消灭！`, 'ok');
        });
        if (targets.length) { pushFloat({ unit: 'self', text: '💥', cls: 'stk' }); ctx.did = true; }
      },
    },
    {
      id: 'cast.nextSpellTimes', gate: 'fresh', label: '注能打出时「下一张法术施放 N 次」（元素风暴）',
      when: (ctx) => (ctx.flags.infused ? ctx.desc.match(/下一张(?:法术|招式)?施放\s*(\d+)\s*次/) : null),
      run: (ctx, m) => {
        if (typeof setNextSpellTwice !== 'function') return;
        setNextSpellTwice(+m[1]);
        log(`[[icon:sparkles]] <b>元素风暴</b>：下一张法术将施放 ${m[1]} 次`, 'ok');
        ctx.did = true;
      },
    },
    {
      id: 'dmg.taunt', gate: 'fresh', label: '扰敌：迫使前两名敌人相互攻击',
      when: (ctx) => /迫使其?相互攻击/.test(ctx.desc) ? true : null,
      run: (ctx) => {
        const ts = getAlive().slice(0, 2);
        if (ts.length === 2) {
          const r = hitFoe(ctx, ts[1], 0, combat.TYPES.ATTACK, { atk: ts[0].atk });
          log(`[[icon:swords]] <b>扰敌</b>：${esc(ts[0].name)} 被迫攻击 ${esc(ts[1].name)}，造成 ${r.dealt} 点伤害`, 'sys');
          ctx.did = true;
        }
      },
    },
    {
      id: 'dmg.attackAll', gate: 'fresh', label: '攻击全体敌人（按攻击力结算）',
      when: (ctx) => /攻击全体敌人/.test(ctx.desc) ? true : null,
      run: (ctx) => {
        const caster = getPlayerCaster ? getPlayerCaster() : {};
        let total = 0;
        getAlive().slice().forEach(t => { total += hitFoe(ctx, t, 0, combat.TYPES.ATTACK, caster).dealt; });
        log(`[[icon:swords]] <b>${esc(ctx.card.name)}</b>：攻击全体敌人，共造成 ${total} 点攻击伤害`, 'sys');
        ctx.did = true;
      },
    },
    {
      id: 'dmg.loseLife', gate: 'fresh', label: '损失 N 点生命（恶魔之力）',
      when: (ctx) => ctx.desc.match(/损失\s*(\d+)\s*点?(?:生命|血)/),
      run: (ctx, m) => {
        if (typeof damagePlayer !== 'function') return;
        damagePlayer(+m[1]);
        ctx.did = true;
      },
    },
    {
      id: 'dmg.negHp', gate: 'fresh', label: '自伤「-N 血」',
      when: (ctx) => ctx.desc.match(/[-－]\s*(\d+)\s*点?血/),
      run: (ctx, m) => {
        if (typeof damagePlayer !== 'function') return;
        damagePlayer(+m[1]);
        ctx.did = true;
      },
    },
    {
      id: 'def.armorLoss', gate: 'fresh', label: '回合结束护甲衰减「-N 点」（坚盾）',
      when: (ctx) => ctx.desc.match(/[-－]\s*(\d+)\s*点?\s*$/),
      run: (ctx, m) => {
        const n = +m[1];
        ctx.pdef.armor = Math.max(0, ctx.pdef.armor - n);
        log(`[[icon:plate]] 护甲衰减：-${n} 点（当前 ${ctx.pdef.armor}）`, 'warn');
        ctx.did = true;
      },
    },
    {
      id: 'heal.upTo', gate: 'fresh', label: '回复至 N 血（沐愈光辉）',
      when: (ctx) => ctx.desc.match(/回复\s*至\s*(\d+)\s*血/),
      run: (ctx, m) => {
        const want = +m[1];
        const cur = getPlayerHp();
        if ((ctx.pstat.status.healban || 0) > 0) {
          log(`[[icon:heart]] 禁疗中：回复至 ${want} 血无效（还剩 ${ctx.pstat.status.healban} 回合）`, 'warn');
        } else if (want > cur) {
          heal(want - cur);
          pushFloat({ unit: 'self', text: '💚', cls: 'stk', warm: true });
          log(`[[icon:heart]] 回复至 <b>${want}</b> 血（当前 ${cur}，回复 ${want - cur}）`, 'ok');
        } else {
          log(`[[icon:heart]] 回复至 ${want} 血：当前 ${cur} 不低于目标值，无变化`, 'ok');
        }
        ctx.did = true;
      },
    },
    {
      id: 'curse.immobilize', gate: 'fresh', label: '无法行动（制敌 → 冰冻 1 回合）',
      when: (ctx) => (/无法行动/.test(ctx.desc) && /下回合|下个回合|本回合/.test(ctx.desc)) ? true : null,
      run: (ctx) => {
        if (ctx.curseTarget) {
          combat.addCurse(ctx.curseTarget, 'freeze', 1);
          log(`[[icon:crystal]] <b>${esc(ctx.curseTarget.name)}</b> 无法行动（冰冻 1 回合）`, 'sys');
          ctx.did = true;
        }
      },
    },
    {
      id: 'curse.poisonDouble', gate: 'fresh', label: '中毒层数翻倍并立即触发毒伤（花鸩）',
      when: (ctx) => /中毒层数翻倍/.test(ctx.desc) ? true : null,
      run: (ctx) => {
        if (ctx.curseTarget) {
          combat.addCurse(ctx.curseTarget, 'poison', ctx.curseTarget.status.poison || 0);   // 加倍：再叠自身当前层数
          const burst = burstPoison(ctx.curseTarget) || { dealt: 0 };   // 目标没中毒时端口返回 null，按 0 点毒伤结算
          log(`[[icon:skull]] <b>${esc(ctx.curseTarget.name)}</b> 中毒翻倍至 ${ctx.curseTarget.status.poison} 层并立即触发 ${burst.dealt} 点毒伤`, 'sys');
          ctx.did = true;
        }
      },
    },
    {
      id: 'hand.fillRandom', gate: 'fresh', label: '置入随机卡牌直至手牌达到 N 张（露娜拉）',
      when: (ctx) => ctx.desc.match(/置入随机卡牌直至手牌达到\s*(\d+)\s*张/),
      run: (ctx, m) => {
        const want = +m[1];
        let put = 0, spells = 0;
        while (getHandSize() < want) {
          const c = randomDiscoverCard(null);
          if (!c) break;
          addTempCard(c); put++;
          if (typeof randomAcquired === 'function') randomAcquired(c);   // 阿猫的礼物：随机获取触发
          if (c.type === '法术') spells++;
        }
        const perM = ctx.desc.match(/每置入\s*1\s*张法术[^。]*?回复\s*(\d+)\s*血/);
        const healedN = perM ? +perM[1] : 0;
        if (healedN && spells > 0) {
          heal(healedN * spells);
          pushFloat({ unit: 'self', text: '💚', cls: 'stk', warm: true });
          log(`[[icon:cards]] <b>${esc(ctx.card.name)}</b>：置入 ${put} 张随机卡牌（手牌达到 ${getHandSize()} 张），其中 ${spells} 张法术 → 回复 ${healedN * spells} 血`, 'loot');
        } else {
          log(`[[icon:cards]] <b>${esc(ctx.card.name)}</b>：置入 ${put} 张随机卡牌（手牌达到 ${getHandSize()} 张）`, 'loot');
        }
        if (put) ctx.did = true;
      },
    },
    {
      id: 'hand.copyRandom', gate: 'fresh', label: '获得一张随机手牌的复制（刀剑形态）',
      when: (ctx) => /获得一张随机手牌的复制/.test(ctx.desc) ? true : null,
      run: (ctx) => {
        const cards = getHandCards();
        if (cards.length) {
          const tpl = cards[Math.floor(random01() * cards.length)];
          if (tpl) {
            addTempCard(tpl.card);
            log(`[[icon:cards]] 复制了手牌中的【<b>${esc(tpl.card.name)}</b>】（置入手牌）`, 'loot');
            ctx.did = true;
          }
        }
      },
    },
    {
      id: 'hand.tokenPass', gate: 'fresh', label: '获得员工通行证A/B（战后消散）',
      when: (ctx) => /获得\s*1\s*张员工通行证B或员工通行证A/.test(ctx.desc) ? true : null,
      run: (ctx) => {
        const pool = allCards().filter(c => c.id === 'tt-token-gold' || c.id === 'tt-token-color');
        if (pool.length) {
          const got = pool[Math.floor(random01() * pool.length)];
          addTempCard(got);
          log(`[[icon:sparkles]] 获得【<b>${esc(got.name)}</b>】（令牌，战后消散）`, 'loot');
          ctx.did = true;
        }
      },
    },
    {
      id: 'misc.flee', gate: 'fresh', label: '非 BOSS 战逃跑一次（烟雾弹）',
      when: (ctx) => (/逃跑一次|非 BOSS 战逃跑/.test(ctx.desc) && typeof fleeBattle === 'function') ? true : null,
      run: (ctx) => { fleeBattle(); ctx.did = true; },
    },
    {
      id: 'buff.randomBlessing', gate: 'fresh', label: '随机获取一项祝福（天国之门）',
      when: (ctx) => /随机获取一项祝福/.test(ctx.desc) ? true : null,
      run: (ctx) => {
        const cand = [];
        if (/潜行/.test(ctx.desc)) cand.push({ key: 'stealth', run: () => combat.addBlessing(ctx.pstat, 'stealth', 1), name: '潜行' });
        if (/攻击力/.test(ctx.desc)) cand.push({ key: 'atkUp', run: () => combat.addBlessing(ctx.pstat, 'atkUp', 1), name: '攻击力 +1' });
        if (/法伤/.test(ctx.desc)) cand.push({ key: 'spellUp', run: () => combat.addBlessing(ctx.pstat, 'spellUp', 1), name: '法伤 +1' });
        if (/减伤/.test(ctx.desc)) cand.push({ key: 'reduce', run: () => combat.addBlessing(ctx.pstat, 'reduce', 1), name: '减伤 1' });
        if (/护甲/.test(ctx.desc)) cand.push({ key: '_armor', run: () => { ctx.pdef.armor += 5; }, name: '护甲 5' });
        if (/净化/.test(ctx.desc)) cand.push({ key: '_purify', run: () => combat.purify(ctx.pstat), name: '净化' });
        if (cand.length) {
          const fresh = cand.filter(c => c.key.startsWith('_') || !((ctx.pstat.status[c.key] || 0) > 0));
          const pool = fresh.length ? fresh : cand;
          const pick = pool[Math.floor(random01() * pool.length)];
          pick.run();
          log(`[[icon:sparkles]] <b>祝福·${esc(pick.name)}</b>（随机祝福，优先不重复）`, 'ok');
          ctx.did = true;
        }
      },
    },
    {
      id: 'draw.fromDeck', gate: 'fresh', label: '从牌库中抽取 N 张指定类型（武装）',
      when: (ctx) => ctx.desc.match(/从牌库中抽取\s*(\d+)\s*张?(初始攻击|装备|法术|武术|杀)牌?/),
      run: (ctx, m) => {
        const kind = (m[2] === '杀' || m[2] === '初始攻击') ? '杀' : m[2];
        deckDraw({ n: +m[1], type: kind });
        ctx.did = true;
      },
    },
    {
      id: 'heal.allies', gate: 'fresh', label: '治疗所有队友（银河幻境）',
      when: (ctx) => /治疗所有队友|治疗全体/.test(ctx.desc) ? true : null,
      run: (ctx) => {
        heal(3);
        pushFloat({ unit: 'self', text: '💚', cls: 'stk', warm: true });
        log(`[[icon:heart]] 治疗所有队友：回复 <b>3</b> 点生命`, 'ok');
        ctx.did = true;
      },
    },
    {
      id: 'hand.curseCards', gate: 'fresh', label: '随机获取 N 张能施加诅咒的卡牌/招式（厄运）',
      when: (ctx) => ctx.desc.match(/随机获取\s*(\d+)\s*张能施加诅咒的(卡牌|招式)/),
      run: (ctx, m) => {
        const wantType = m[2] === '招式' ? '武术' : null;
        const pool = allCards().filter(c =>
          c.rarity !== '衍生' && ['武术', '法术', '装备', '能力卡'].includes(c.type) &&
          (!wantType || c.type === wantType) &&
          /诅咒|中毒|流血|冰冻|沉默|破甲|禁疗/.test(String(c.desc || '')));
        let got = 0;
        for (let i = 0; i < +m[1] && pool.length; i++) {
          const c = pool[Math.floor(random01() * pool.length)];
          addTempCard(c); got++;
        }
        log(`[[icon:skull]] <b>${esc(ctx.card.name)}</b>：随机获得 ${got} 张【能施加诅咒${wantType ? '的招式' : ''}】的卡牌（置入手牌，战后消散）`, 'loot');
        if (got) ctx.did = true;
      },
    },
    {
      id: 'discover.potion', gate: 'fresh', label: '发现 1 瓶药水并直接释放（药水魔法）',
      when: (ctx) => ctx.desc.match(/发现\s*1?\s*瓶药水/),
      run: (ctx, m) => {
        queueDiscover({ n: 1, act: 'potion', pred: parsePoolNoun('药水', ctx.myClass) });
        log(`[[icon:flask]] <b>${esc(ctx.card.name)}</b>：发现 1 瓶药水并直接释放`, 'sys');
        ctx.did = true;
      },
    },
    {
      id: 'discover.infuseFree', gate: 'fresh', label: '发现一张注能卡，使其无需注能（灵能召唤）',
      when: (ctx) => /发现\s*(?:一|1)\s*张注能卡/.test(ctx.desc) ? true : null,
      run: (ctx) => {
        const pred = parsePoolNoun('注能', ctx.myClass);
        const c = pred ? randomDiscoverCard(pred) : null;
        if (c) {
          addTempCard({ ...c, _noInfuse: true });
          log(`[[icon:crystal]] <b>灵能召唤</b>：发现【<b>${esc(c.name)}</b>】，其无需注能即可打出`, 'loot');
        } else log('[[icon:question]] 没有可发现的注能卡', 'dim');
        ctx.did = true;
      },
    },
    {
      id: 'discover.pool', gate: 'fresh', label: '发现/随机获取/获得 N 张 ______（统一入口 + 限制卡池）',
      when: (ctx) => {
        // 「该牌时」= 获得/消耗时才触发的被动，出牌时跳过
        const dPool = !/该牌时/.test(ctx.desc)
          ? ctx.desc.match(/(?:发现|随机获取|获取|获得)(?:并直接施放)?\s*(?:(\d+|[一两二三四五])\s*[张种])?\s*([^，。；,\s]{0,8}?)(卡牌|的卡|的牌|能力卡|牌|卡)/)
          : null;
        return dPool || null;
      },
      run: (ctx, dPool) => {
        const n0 = POOL_NUM_MAP[dPool[1]] != null ? POOL_NUM_MAP[dPool[1]] : (dPool[1] ? +dPool[1] : 1);
        const noun = dPool[2] || '';
        const pred = parsePoolNoun(noun, ctx.myClass);
        const n = /等量随机卡牌/.test(ctx.desc) ? 2 : n0;   // 魔法锅炉「发现等量随机卡牌」（消耗至多 2 张）
        let act = null;
        // 需求 #17（2026-09-09）：「并直接施放 / 并施放 / 并释放」都算直接释放
        if (/并直接施放/.test(dPool[0]) || /并将其释放|并(?:直接)?(?:施放|释放)/.test(ctx.desc)) act = 'play';
        if (/获取剩下(两|2)张/.test(ctx.desc)) act = 'playKeep';
        // 二刀流（2026-09-10 需求）：「并额外获得1张复制」→ 发现的卡连本体共 2 张置入手牌
        if (/并额外获得\s*1\s*张复制/.test(ctx.desc)) act = 'dup';
        // 挖宝：「并获得等同于其价格的护甲」；江湖救急：「回合开始时将其消耗」
        queueDiscover({ n, pred, act,
          priceArmor: /获得等同于(?:其|该卡|该牌)价格的护甲/.test(ctx.desc),
          consumeTempAtTurn: /回合开始时将其消耗/.test(ctx.desc) });
        const label = pred ? noun.replace(/的$/, '') : '';
        log(`[[icon:question]] <b>${esc(ctx.card.name)}</b>：${act === 'play' ? '发现并直接施放' : act === 'playKeep' ? '发现（施放 1 张，其余入手）' : '发现'} ${n} 张${label ? `【${esc(label)}】` : ''}卡牌${pred ? '（限制卡池）' : ''}`, 'sys');
        ctx.did = true;
      },
    },

    /* ============ 牌库操作段 ============ */
    {
      id: 'deck.insert', gate: 'always', label: '洗入牌库（随机 N 张 / 指名卡，含「然后抽 N 张」）',
      when: (ctx) => {
        const shR = ctx.desc.match(/洗入\s*(\d+)\s*张随机卡牌/) || ctx.desc.match(/将\s*(\d+)\s*张随机卡牌洗入牌库/);
        // shR 命中时 shN 不再参与，防止同一句双结算
        const shN = !shR ? ctx.desc.match(/将\s*(?:(\d+|[一二两三四五])\s*张)?\s*([^\s，,。；;、]+?)(?:复制)?(?:洗入|放入|置入)牌库/) : null;
        return (shR || shN) ? { shR, shN } : null;
      },
      run: (ctx, m) => {
        const added = [];
        // 铁甲阵：洗入随机卡时使其费用均 -1（2026-09-08 老板指定补实装）
        const cheap = /费用均?\s*[-－]\s*1/.test(ctx.desc);
        if (m.shR) {
          for (let i = 0; i < +m.shR[1]; i++) {
            const discovered = randomDiscoverCard(null);
            if (discovered) {
              addDeckCard(cheap ? { ...discovered, cost: Math.max(0, (discovered.cost || 0) - 1) } : discovered);
              if (typeof randomAcquired === 'function') randomAcquired(discovered);   // 阿猫的礼物：随机获取触发
              added.push(discovered.name);
            }
          }
          if (cheap && added.length) log(`[[icon:bolt]] 洗入的 ${added.length} 张随机卡牌费用均已 -1`, 'sys');
        }
        if (m.shN) {
          // 去引号；「A与B」「A、B」多卡名拆分；「禁咒」等系列名按前缀整组洗入
          const rawName = m.shN[2].replace(/[‘’“”「」]/g, '');
          const count = m.shN[1] ? (POOL_NUM_MAP[m.shN[1]] != null ? POOL_NUM_MAP[m.shN[1]] : +m.shN[1]) : 1;
          rawName.split(/[与和、]/).forEach(nm => {
            const exact = allCards().find(candidate => candidate.name === nm);
            const series = !exact ? allCards().filter(candidate => String(candidate.name || '').startsWith(nm)) : [exact];
            if (series.length) {
              for (let i = 0; i < count; i++) {
                const tpl = series[i % series.length];
                addDeckCard(tpl); added.push(tpl.name);
              }
            } else {
              log(`[[icon:question]] 【${esc(ctx.card.name)}】找不到可洗入牌库的卡牌「${esc(nm)}」（占位）`, 'warn');
            }
          });
        }
        if (added.length) {
          const deckSize = shuffleDeck();
          const counts = {};
          added.forEach(name => { counts[name] = (counts[name] || 0) + 1; });
          log(`[[icon:recycle]] <b>${esc(ctx.card.name)}</b>：将 ${Object.keys(counts).map(name => `【${esc(name)}】×${counts[name]}`).join('、')} 洗入牌库` +
            `（牌库 ${deckSize} 张，已洗混）`, 'sys');
          // 洗混后结算「然后抽 N 张牌」（无极梦魇）：若在此前先抽，抽到的是洗入前的旧牌（2026-09-11 英雄卡审计）
          const afterDraw = ctx.desc.match(/洗入牌库[^。]*然后抽\s*(\d+|[一二两三四五])\s*张牌/);
          if (afterDraw) {
            const n2 = POOL_NUM_MAP[afterDraw[1]] != null ? POOL_NUM_MAP[afterDraw[1]] : +afterDraw[1];
            if (getMode() === 'boss') {
              const got = drawCards(n2);
              log(`[[icon:cards]] <b>${esc(ctx.card.name)}</b>：洗入后抽了 ${got} 张牌`, 'sys');
            } else {
              grantStarterAttack(n2);
              log(`[[icon:cards]] <b>${esc(ctx.card.name)}</b>：洗入后获得 ${n2} 张【初始攻击】（普通战斗抽牌效果改为获得初始攻击）`, 'sys');
            }
          }
          ctx.did = true;
        }
      },
    },
    {
      id: 'deck.insertHand', gate: 'always', label: '将 N 张【指名卡】置入手牌',
      when: (ctx) => ctx.desc.match(/将\s*(?:(\d+|[一二两三四五])\s*张)?\s*([^\s，,。；;、]+?)(?:复制)?置入手牌/),
      run: (ctx, m) => {
        const nm = m[2].replace(/[‘’“”「」]/g, '');
        const tpl = allCards().find(candidate => candidate.name === nm);
        const count = m[1] ? (POOL_NUM_MAP[m[1]] != null ? POOL_NUM_MAP[m[1]] : +m[1]) : 1;
        if (tpl) {
          for (let i = 0; i < count; i++) addTempCard(tpl);
          log(`[[icon:cards]] <b>${esc(ctx.card.name)}</b>：将 ${count} 张【${esc(tpl.name)}】置入手牌（战斗内临时卡，战后消散）`, 'loot');
        } else {
          log(`[[icon:question]] 【${esc(ctx.card.name)}】找不到可置入手牌的卡牌「${esc(nm)}」（占位）`, 'warn');
        }
        ctx.did = true;
      },
    },
    {
      id: 'deck.gainNamed', gate: 'fresh', label: '获得 N 张指名道姓的卡（置句末才识别）',
      when: (ctx) => {
        const gn = ctx.desc.match(/获得\s*(?:(\d+|[一两二三四五])\s*张)\s*[‘“「]?([^\s，。；,、‘’“”「」]{1,6})[’”」]?(?=[。，；;]|$)/);
        return (gn && !['随机', '等量'].includes(gn[2])) ? gn : null;
      },
      run: (ctx, gn) => {
        const nm = gn[2].replace(/[‘’“”「」]/g, '');
        const tpl = allCards().find(candidate => candidate.name === nm);
        const count = POOL_NUM_MAP[gn[1]] != null ? POOL_NUM_MAP[gn[1]] : +gn[1];
        if (tpl) {
          for (let i = 0; i < count; i++) addTempCard(tpl);
          log(`[[icon:cards]] <b>${esc(ctx.card.name)}</b>：获得 ${count} 张【${esc(tpl.name)}】（置入手牌）`, 'loot');
        } else {
          log(`[[icon:question]] 【${esc(ctx.card.name)}】找不到卡牌「${esc(nm)}」（占位）`, 'warn');
        }
        ctx.did = true;
      },
    },

    /* ============ 战斗规则登记段 ============ */
    {
      id: 'rule.shaTransform', gate: 'always', label: '「杀」化为另一张卡（不朽神剑/龙吟沧海）',
      when: (ctx) => ctx.desc.match(/[‘’“”「」]?(?:杀|初始攻击)[‘’“”「」]?\s*化为\s*[‘’“”「」]?(?:(\d+)\s*张)?([^\s，。；;、‘’“”「」]{1,8})/),
      run: (ctx, m) => {
        if (typeof setShaTransform !== 'function') return;
        setShaTransform(m[2]);
        log(`[[icon:recycle]] <b>战斗规则</b>：你的「初始攻击」在本场战斗中化为【<b>${esc(m[2])}</b>】`, 'ok');
        ctx.did = true;
      },
    },
    {
      id: 'rule.consumeFireball', gate: 'always', label: '每消耗 1 张卡牌施放火球（深渊降焰）',
      when: (ctx) => ctx.desc.match(/每\s*消耗\s*1\s*张卡牌[^。]*?施放\s*(?:(\d+)\s*次)?[‘’“”「」]?火球/),
      run: (ctx, m) => {
        if (typeof setConsumeFireball !== 'function') return;
        setConsumeFireball(m[1] ? +m[1] : 1);
        log(`[[icon:fire]] <b>战斗规则</b>：每消耗 1 张卡牌，自动施放火球`, 'ok');
        ctx.did = true;
      },
    },
    {
      id: 'rule.turnStartDiscover', gate: 'always', label: '句内嵌「回合开始时发现 N 张」拆出为延迟段（万法乾坤）',
      when: (ctx) => ctx.desc.match(/回合开始时[^。]*?(发现[^。]*?（?\s*(?:\d+|[一两二三四五])?\s*张[^。]*?)$/),
      run: (ctx, m) => {
        if (typeof registerTurnStartText !== 'function') return;
        registerTurnStartText(m[1], String(ctx.card.name || ''));
        log(`[[icon:hourglass]] <b>回合开始时</b>：【${esc(ctx.card.name)}】${esc(m[1])}（下个回合开始起每回合生效）`, 'sys');
        ctx.did = true;
      },
    },
    {
      id: 'rule.stealthStrike', gate: 'always', label: '破隐一击伤害翻倍（白梅落影·妄）',
      when: (ctx) => /破隐[^。]*?伤害翻倍/.test(ctx.desc) ? true : null,
      run: (ctx) => {
        if (typeof setStealthStrike !== 'function') return;
        setStealthStrike(true);
        log('[[icon:runner]] <b>战斗规则</b>：破隐一击——从潜行中发动的攻击伤害翻倍', 'ok');
        ctx.did = true;
      },
    },
    {
      id: 'release.curseLayers', gate: 'fresh', label: '每有 1 层诅咒释放一次「杀」（流光照影）',
      when: (ctx) => (/每有一层诅咒[^。]*?释放(?:一次)?[‘'“]?(?:杀|初始攻击)/.test(ctx.desc) && typeof releaseHandMatches === 'function') ? true : null,
      run: (ctx) => {
        const layers = ctx.curseTarget
          ? combat.CURSES.filter(k => combat.CURSE_META[k].stack)
              .reduce((a, k) => a + (ctx.curseTarget.status[k] || 0), 0)
          : 0;
        let released = 0;
        for (let i = 0; i < layers && i < 10; i++) released += releaseHandMatches('杀', 0);
        log(`[[icon:recycle]] <b>流光照影</b>：目标身负 ${layers} 层诅咒，释放了 ${released} 次「初始攻击」`, 'sys');
        ctx.did = true;
      },
    },
    {
      id: 'release.lastCardTrigger', gate: 'fresh', label: '「若本牌为最后一张手牌触发 N 次」识别（出牌结算判定）',
      when: (ctx) => /最后一张手牌[^。；]*?触发\s*(?:\d+\s*)?次/.test(ctx.desc) ? true : null,
      run: (ctx) => {
        log('[[icon:cards]] 最后一张手牌条件：手牌已空时整卡效果触发 2 次（出牌结算判定）', 'sys');
        ctx.did = true;
      },
    },
    {
      id: 'release.handMatches', gate: 'fresh', label: '直接释放手牌中的所有「箭/杀/火球」（连弩）',
      when: (ctx) => (typeof releaseHandMatches === 'function') ? ctx.desc.match(/直接释放手牌中的所有[‘’“”「」]?(初始攻击|箭|杀|火球)[’’”」]?/) : null,
      run: (ctx, m) => {
        const drawEach = (ctx.desc.match(/每(?:释放|打出)\s*1\s*张[^。]*?抽\s*(\d+)\s*张牌/) || [])[1];
        const relKey = m[1] === '初始攻击' ? '杀' : m[1];
        const released = releaseHandMatches(relKey, drawEach ? +drawEach : 0);
        if (released) { log(`[[icon:swords]] <b>连弩</b>：释放了手牌中 ${released} 张「${m[1]}」`, 'ok'); ctx.did = true; }
      },
    },

    /* ============ 2026-09-09 机制审计补实装（Q1-Q8 老板定向批次） ============ */
    {
      id: 'draw.untilN', gate: 'fresh', label: '抽牌直到有 N 张手牌（法力补给）',
      when: (ctx) => ctx.desc.match(/抽牌[^。；]*?直到[有满]\s*(\d+)\s*张手牌/),
      run: (ctx, m) => {
        const want = +m[1];
        let gotN = 0;
        if (getMode() === 'boss') {
          let guard = 0;
          while (getHandSize() < want && guard++ < 30) {
            const g = drawCards(1);
            if (!g) break;
            gotN += g;
          }
          log(`[[icon:cards]] <b>${esc(ctx.card.name)}</b>：抽了 ${gotN} 张牌（手牌 ${getHandSize()} 张）`, 'sys');
        } else {
          const lack = Math.max(0, want - getHandSize());
          grantStarterAttack(lack);
          log(`[[icon:cards]] <b>${esc(ctx.card.name)}</b>：获得 ${lack} 张【初始攻击】（普通战斗抽牌效果改为获得初始攻击）`, 'sys');
        }
        ctx.did = true;
      },
    },
    {
      id: 'dmg.seizeAtk', gate: 'fresh', label: '夺取敌人攻击力（禁咒I）',
      when: (ctx) => ctx.desc.match(/夺取\s*(?:一名|1\s*名)?\s*敌人的?\s*(\d+)\s*点?攻击力/),
      run: (ctx, m) => {
        const t = ctx.curseTarget;
        if (t && !t.dead) {
          const n = +m[1];
          t.atk = Math.max(0, (t.atk || 0) - n);
          combat.addBlessing(ctx.pstat, 'atkUp', n);
          log(`[[icon:arrow]] <b>夺取攻击</b>：${esc(t.name)} 攻击力 -${n}，你的攻击力 +${n}`, 'sys');
          ctx.did = true;
        }
      },
    },
    {
      id: 'dmg.priceAoe', gate: 'always', label: '对全体造成等同于抽到卡牌价格的固定伤害（气功波）',
      // 注意不判 did：同一句里的「抽 1 张牌」会先置 did，价格伤害是同一效果的后续部分
      when: (ctx) => /造成等同于(?:其|该卡|该牌)价格的固定伤害/.test(ctx.desc) ? true : null,
      run: (ctx) => {
        const price = typeof getPriceOfLastDrawn === 'function' ? getPriceOfLastDrawn() : 0;
        if (price > 0 && typeof dealAoeFixed === 'function') {
          dealAoeFixed(price);
          log(`[[icon:play]] <b>${esc(ctx.card.name)}</b>：对全体敌人造成 <b>${price}</b> 点固定伤害（按抽到卡牌的价格）`, 'sys');
        } else {
          log(`[[icon:question]] 没有抽到可折算价格的卡牌（占位）`, 'dim');
        }
        ctx.did = true;
      },
    },
    {
      id: 'dmg.growth', gate: 'fresh', label: '回合开始时本牌伤害 +N（充能火球）',
      when: (ctx) => /回合开始时[，,]?\s*本牌伤害\s*\+\s*\d+/.test(ctx.desc) ? true : null,
      run: (ctx) => {
        if (typeof registerGrowthCard === 'function') registerGrowthCard(ctx.card);
        log(`[[icon:fire]] <b>${esc(ctx.card.name)}</b>：每经过 1 回合，本牌伤害 +1`, 'sys');
        ctx.did = true;
      },
    },
    {
      id: 'deck.replaceSha', gate: 'always', label: '对战开始时将 N 张杀替换为随机卡牌（迷之匣）',
      when: (ctx) => ctx.desc.match(/将\s*(\d+)\s*张(?:杀|初始攻击)替换为随机卡牌/),
      run: (ctx, m) => {
        if (typeof replaceShaInDeck !== 'function') return;
        const n = replaceShaInDeck(+m[1]);
        log(`[[icon:recycle]] <b>${esc(ctx.card.name)}</b>：已将牌库中 ${n} 张「杀」替换为随机卡牌`, 'sys');
        ctx.did = true;
      },
    },
    {
      id: 'deck.capUp', gate: 'always', label: '牌库上限 +N（BOSS 编组时生效，仅识别）',
      when: (ctx) => ctx.desc.match(/牌库上限\s*\+\s*(\d+)/),
      run: (ctx, m) => {
        log(`[[icon:cards]] 牌库上限 +${m[1]}（BOSS 编组时生效）`, 'sys');
        ctx.did = true;
      },
    },
    {
      id: 'summon.ally', gate: 'always', label: '召唤随从「名（X-Y）×N」（征召）',
      when: (ctx) => ctx.desc.match(/召唤\s*([^\s（(，。；;、]+?)\s*[（(]\s*(\d+)\s*[-－]\s*(\d+)\s*[）)]\s*(?:[×xX]\s*(\d+))?/),
      run: (ctx, m) => {
        if (typeof summonAlly !== 'function') return;
        const n = m[4] ? +m[4] : 1;
        summonAlly(m[1], +m[2], +m[3], n);
        log(`[[icon:runner]] <b>${esc(ctx.card.name)}</b>：召唤 ${esc(m[1])}（${m[2]}-${m[3]}）×${n} ——优先替你承受伤害并自动战斗`, 'loot');
        ctx.did = true;
      },
    },
    {
      id: 'turn.extra', gate: 'always', label: '获得 1 个额外回合（命运钟表）',
      // 不判 did：同句「消耗所有手牌」先行置位，额外回合是同一效果的后续部分
      when: (ctx) => /获得\s*1\s*个额外回合/.test(ctx.desc) ? true : null,
      run: (ctx) => {
        if (typeof setExtraTurn !== 'function') return;
        setExtraTurn(true);
        log(`[[icon:hourglass]] <b>${esc(ctx.card.name)}</b>：获得 1 个额外回合（敌人不会行动）`, 'ok');
        ctx.did = true;
      },
    },
    {
      id: 'hand.pouchCast', gate: 'fresh', label: '法师锦囊容器：选 1 张直接施放（Q5）',
      when: (ctx) => (/自带\s*1\s*[*×]\s*3\s*空间|可以置入\s*3\s*张法术牌/.test(ctx.desc) &&
        typeof queuePouchCast === 'function' && ctx.flags.uid) ? true : null,
      run: (ctx) => { queuePouchCast(ctx.flags.uid); ctx.did = true; },
    },
    {
      id: 'hand.pouchPassive', gate: 'fresh', label: '珍珠盒：持有即扩容背包（仅识别）',
      when: (ctx) => /内置\s*3\s*[*×]\s*3\s*空间|容纳所有.{0,6}资源卡牌/.test(ctx.desc) ? true : null,
      run: (ctx) => {
        log(`[[icon:plate]] <b>珍珠盒</b>：持有即扩容背包 9 格（扩格仅收资源卡），无需打出`, 'sys');
        ctx.did = true;
      },
    },
    {
      id: 'hand.zeroCostSelect', gate: 'fresh', label: '自然法杖：选 1 张卡下回合变 0 费（Q5）',
      when: (ctx) => (/选择\s*(?:1|一)\s*张卡牌[^。]*?下回合将其变为\s*0\s*费/.test(ctx.desc) && typeof queueHandSelect === 'function') ? true : null,
      run: (ctx) => {
        queueHandSelect({ n: 1, type: null, act: 'zero' });
        log(`[[icon:bolt]] <b>${esc(ctx.card.name)}</b>：选择 1 张卡牌，下回合它将变为 0 费`, 'sys');
        ctx.did = true;
      },
    },
    {
      id: 'discover.form', gate: 'fresh', label: '发现一种形态并释放（千变万化）',
      when: (ctx) => ctx.desc.match(/发现\s*(?:一|1)\s*种(形态)并(?:直接)?释放/),
      run: (ctx, m) => {
        queueDiscover({ n: 1, pred: parsePoolNoun(m[1], ctx.myClass), act: 'play' });
        log(`[[icon:question]] <b>${esc(ctx.card.name)}</b>：发现一种【形态】并直接施放`, 'sys');
        ctx.did = true;
      },
    },
    {
      id: 'release.oneSha', gate: 'fresh', label: '立即释放一次「杀」（百炼青虹剑，消耗该牌时触发）',
      when: (ctx) => (!/该牌时/.test(ctx.desc) && typeof releaseHandMatches === 'function')
        ? ctx.desc.match(/立即释放(?:一次|1\s*次)?[‘'“]?杀/) : null,
      run: (ctx, m) => {
        const released = releaseHandMatches('杀', 0, 1);
        log(released
          ? `[[icon:swords]] <b>${esc(ctx.card.name)}</b>：立即释放了 1 次「初始攻击」`
          : `[[icon:cross]] 手牌中没有「杀」可释放`, released ? 'ok' : 'dim');
        ctx.did = true;
      },
    },

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
  ];
}

/**
 * 创建文本效果执行器（与旧 createEffectExecutor 返回值同签名）。
 * 遍历有序步骤表；哨兵在自然走完时才评估（提前 return 的分支不记哨兵，与旧实现一致）。
 * @param {object} deps 战斗侧显式端口
 */
export function createEffectPipeline(deps) {
  const steps = createEffectSteps(deps);
  return function applyTextEffects(card, text, target, flags) {
    const ctx = {
      card, target, flags: flags || {},
      desc: String(text || ''),
      did: false, drawn: false, healed: false, armored: false,
      infLead: null, bleedGateFail: false,
      // 以下与旧实现同源同序：顶部取一次，链中共用
      pstat: deps.getPlayerStatus(),
      pdef: deps.getPlayerDefense(),
      myClass: deps.getPlayerClass ? deps.getPlayerClass() : null,
      durOv: (String(text || '').match(/持续\s*(\d+)\s*回合/) || [])[1],
      curseTarget: (target && !target.dead) ? target : deps.getAlive()[0] || null,
    };
    for (const step of steps) {
      if (step.gate !== 'always' && ctx.did) continue;
      const m = step.when(ctx);
      if (!m) continue;
      const out = step.run(ctx, m);
      if (out && out.halt) return out.result;
    }
    // —— 未识别子句哨兵（批次 3）：牌面像有效果、却既没结算也没被任何层认领 ——
    const result = { did: ctx.did, drawn: ctx.drawn, healed: ctx.healed, armored: ctx.armored };
    if (!ctx.did && !ctx.drawn && !ctx.healed && !ctx.armored) noteUnknownEffect(card, ctx.desc);
    return result;
  };
}

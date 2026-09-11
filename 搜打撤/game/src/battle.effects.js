import { matchElsewhere, noteUnknownEffect } from './effect-verbs.js';

/**
 * 将卡牌自然语言拆成稳定的结算时点。这里只解析文本，不读写战斗状态。
 * @param {string} description
 */
function splitEffectClauses(description) {
  const out = { immediate: [], turnStart: [], battle: [], onInfused: [], onDraw: [], skill: [] };
  String(description || '').split(/[。；;\n]/).forEach(source => {
    const text = source.trim();
    if (!text) return;
    let match;
    if ((match = text.match(/^被注能时[：:，,]?\s*(.+)$/))) {
      out.onInfused.push(match[1]);
      return;
    }
    if ((match = text.match(/^抽到(?:该牌|到该牌)?时(?:施放)?[:：]?\s*(.+)$/))) {
      out.onDraw.push(match[1]);
      return;
    }
    // 「抽到该牌时+动词」衍生牌触发（诛魔剑：抽到即结算，不占手牌）
    if ((match = text.match(/^抽到该牌时[:：]?\s*(.+)$/))) {
      out.onDraw.push(match[1]);
      return;
    }
    if ((match = text.match(/^(每回合开始时|每回合开始|下回合开始时|下回合开始|下个回合开始时|下个回合开始|回合开始时|回合开始)[：:，,]?\s*(.+)$/))) {
      out.turnStart.push({ text: match[2], each: /^每回合开始/.test(text) });
      return;
    }
    // 「限定技能：」句不随打出结算：装备穿戴后由角色信息区的技能按钮手动发动（2026-09-09 老板 #9）
    if ((match = text.match(/^限定技能[：:]\s*(.+)$/))) {
      out.skill.push(match[1]);
      return;
    }
    if (/^(本局对战内|本场对战|本场战斗)/.test(text)) {
      out.battle.push(text);
      return;
    }
    out.immediate.push(text);
  });
  return out;
}

/* ---------- 限制卡池解析（老板 2026-09-08 定版池子清单） ----------
 * 「发现 / 随机获取 / 获得 N 张 ____卡/牌」句式中的名词短语 → 卡池谓词。
 * 返回 null = 未识别出限定（走通用随机池，isRandomObtainable 过滤）。
 * 已识别：能施加诅咒的招式/卡牌、招式(=武术)、武术、法术、装备、能力卡、道具、
 * 0~5 费、古朴/稀有/史诗/传说、火球系列、火球、箭系列、药水系列、杀、注能卡、
 * 本职业、其它职业、形态、禁咒。 */
const POOL_NUM_MAP = { '一': 1, '两': 2, '二': 2, '三': 3, '四': 4, '五': 5 };
const CURSE_DESC_RE = /诅咒|中毒|流血|冰冻|沉默|破甲|禁疗|灼烧/;
const CURSE_CAPABLE = (c) => ['武术', '法术', '装备', '能力卡'].includes(c.type) &&
  CURSE_DESC_RE.test(String(c.desc || ''));

function parsePoolNoun(raw, myClass) {
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

/**
 * 创建文本效果执行器。所有状态变化都通过显式端口进入，解析层不再依赖战斗模块内部变量。
 * @param {object} deps
 */
function createEffectExecutor(deps) {
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

  return function applyTextEffects(card, text, target, flags) {
    let desc = String(text || '');
    const pstat = getPlayerStatus();
    const pdef = getPlayerDefense();
    const esc = escapeHtml;
    const myClass = getPlayerClass ? getPlayerClass() : null;
    flags = flags || {};
    let did = false;
    const durOv = (desc.match(/持续\s*(\d+)\s*回合/) || [])[1];
    const curseTarget = (target && !target.dead) ? target : getAlive()[0] || null;
    // 「注能(N)：效果」前缀：作为注能主卡打出时，冒号后的才是效果本体（星陨之力/诅咒光波）
    const infLead = desc.match(/^注能\s*[（(][^）)]*[）)][：:]?\s*(.+)$/);
    if (infLead) desc = infLead[1];

    // 「回复 N 倍于被注能卡牌价格的血量」（圣光治愈）：注能打出时按牺牲品费用折算成数值
    if (flags.fuelCost != null) {
      const mulM = desc.match(/(\d+)\s*倍于被注能卡牌价格/);
      if (mulM) {
        desc = desc.replace(/[^，。]*?\d+\s*倍于被注能卡牌价格的血量/, `回复 ${+mulM[1] * Math.max(0, flags.fuelCost)} 点生命`);
        log(`[[icon:flask]] 牺牲品费用 ${flags.fuelCost} → 折算回复 ${+mulM[1] * Math.max(0, flags.fuelCost)} 点生命`, 'sys');
      }
    }

    // —— 「累计注能 N 张卡牌后解锁：效果」（元素符印）：战斗内注能计数达标才生效 ——
    const unlockM = desc.match(/累计注能\s*(\d+)\s*张[^。；]*?解锁[：:]?\s*([\s\S]*)/);
    if (unlockM) {
      const need = +unlockM[1];
      const fuels = typeof getInfuseFuels === 'function' ? getInfuseFuels() : need;
      if (fuels >= need) {
        if (typeof unlockSeal === 'function') {
          unlockSeal(card.name);
          return { did: true, drawn: false, healed: false, armored: false };
        }
        desc = unlockM[2];   // 无端口环境（审计/复核 harness）：直接展开效果本体
        log(`[[icon:crystal]] <b>${esc(card.name)}</b> 已解锁（累计注能 ${fuels}/${need} 张）`, 'ok');
      } else {
        log(`[[icon:crystal]] <b>${esc(card.name)}</b> 未解锁：累计注能 ${fuels}/${need} 张`, 'dim');
        return { did: true, drawn: false, healed: false, armored: false };
      }
    }

    // —— 「诅咒状态下 / 自身处于诅咒状态时」条件加成（深海印记/深海咒印）：
    //     装备类改为穿戴期动态核算（battle.core syncCurseCondEquips：身负诅咒生效、
    //     解除自动收回，2026-09-09 留言 #2）；其余卡保持「未诅咒时空过」——
    if (/诅咒状态[下时]/.test(desc) && !/对手|对方/.test(desc)) {
      const met = typeof combat.hasCurse === 'function' && combat.hasCurse(pstat);
      if (card.type === '装备') {
        log(met
          ? `[[icon:crystal]] <b>${esc(card.name)}</b>：当前身负诅咒，条件加成已生效`
          : `[[icon:cross]] ${esc(card.name)}：自身未处于诅咒状态，穿戴期间身负诅咒时自动生效`, met ? 'ok' : 'dim');
        return { did: true, drawn: false, healed: false, armored: false };
      }
      if (!met) {
        log(`[[icon:cross]] ${esc(card.name)}：自身未处于诅咒状态，条件加成不生效`, 'dim');
        return { did: true, drawn: false, healed: false, armored: false };
      }
    }

    // —— 装备嵌入句「回合开始 -N 血」（灭魔之剑，2026-09-09 留言 #10）：
    //     从本句剥出并注册为每回合开始的延迟段——否则它与「攻 +2」同句，
    //     攻强化先置 did 后自伤被跳过，回合开始掉血从未生效 ——
    const turnNeg = desc.match(/回合开始[时：:，,]?\s*[-－]\s*(\d+)\s*点?血/);
    if (turnNeg && typeof registerTurnStartText === 'function') {
      registerTurnStartText(`-${turnNeg[1]} 血`, card.name);
      desc = desc.replace(/[,，]?\s*回合开始[时：:，,]?\s*[-－]\s*\d+\s*点?血/, '');
      log(`[[icon:hourglass]] <b>${esc(card.name)}</b>：每个回合开始失去 ${turnNeg[1]} 点生命`, 'sys');
      did = true;
    }

    // —— 抉择（2026-09-08 人工 N 选一）：弹出选项面板，选中哪项才结算哪项 ——
    // 句式「抉择：1° X；2° Y…」（神灯，经 clause 合并后序号间为逗号）与
    // 「抉择：打开‘A’或者‘B’」（神话终章·雷修斯）。必须在其它效果句之前拦截，
    // 否则选项里的冰冻/消灭等关键词会被立即句处理器抢先自动结算。
    if (!did && /抉择[:：]/.test(desc) && typeof queueChoice === 'function') {
      const body = desc.replace(/^.*?抉择[:：]\s*/, '');
      let options;
      if (/\d\s*[°º]/.test(body)) {
        options = body.split(/[,，]?\s*\d\s*[°º]\s*/).map(s => s.trim()).filter(Boolean);
      } else {
        options = body.split(/或者/).map(s => s.trim()).filter(Boolean);
      }
      if (options.length > 1) {
        // secondDoor：花开两面——未选择的门「两回合后」也要展开（pickChoice 调度）
        queueChoice({ cardName: card.name, options, secondDoor: /两回合后[^。]*未选择/.test(String(card.desc || '')) });
        log(`[[icon:question]] <b>${esc(card.name)}</b>：抉择（${options.length} 选 1）——请从面板中选择`, 'sys');
        return { did: true, drawn: false, healed: false, armored: false };
      }
    }

    // 「（…从这些中随机）」是"随机祝福"的可选项说明，不逐项生效——
    // 但「随机获取一项祝福」整句（天国之门）本身就是结算入口，不能跳过
    if (/从这些中随机/.test(desc) && !/随机获取一项祝福/.test(desc)) {
      return { did: false, drawn: false, healed: false, armored: false };
    }

    // —— 灼烧（2026-09-08 独立状态）：不叠加、按回合固定掉血 ——
    const burnM = desc.match(/(?:附加|施加|攻击并)\s*(?:\d+\s*层?\s*)?灼烧/);
    if (burnM) {
      const fm = desc.match(/灼烧(?:状态)?\s*(\d+)\s*回合/);
      const n = fm ? +fm[1] : (durOv ? +durOv : 2);
      if (curseTarget) { combat.addCurse(curseTarget, 'burn', n); log(`[[icon:fire]] <b>${esc(curseTarget.name)}</b> 被灼烧（${n} 回合内每回合结束受 1 点固定伤害，不叠加）`, 'sys'); did = true; }
    }

    // —— 致命穿刺类条件子句：「若对方处于流血状态…」目标未流血时诅咒/破甲部分一并空过 ——
    const bleedGateFail = /若对方[^。]*流血/.test(desc) &&
      !((curseTarget && curseTarget.status && curseTarget.status.bleed) > 0);
    if (bleedGateFail) log(`[[icon:cross]] ${esc(card.name)}：对方未处于流血状态，条件效果不生效`, 'dim');

    const bm = desc.match(/(?:附加|施加)\s*(?:(\d+)\s*层?)?\s*流血/);
    if (bm || /附加流血|施加流血/.test(desc)) {
      // bm 命中但组 1 缺失（「附加流血」无层数）时 +bm[1] 是 NaN——曾把敌人 bleed 写成 NaN，
      // 状态角标不显示、后续攻击伤害全变 NaN（2026-09-09 老板 #15/#16）
      const n = bm && bm[1] ? +bm[1] : 1;
      if (curseTarget) { combat.addCurse(curseTarget, 'bleed', n); log(`[[icon:blood]] <b>${esc(curseTarget.name)}</b> 附加 ${n} 层流血`, 'sys'); did = true; }
    }
    const pm = desc.match(/(?:附加|施加)\s*(?:(\d+)\s*层)?\s*中毒/);
    if (pm) {
      const n = pm[1] ? +pm[1] : 1;
      // 2026-09-12：剧毒药水/棘刺之地类「对所有敌人附加 N 层中毒」→ 全体结算
      const aoeP = /所有敌人|敌方全体|全体敌人|目标为全体/.test(desc);
      const targets = (aoeP ? getAlive() : (curseTarget ? [curseTarget] : [])).filter(t => t && !t.dead);
      if (targets.length) {
        targets.forEach(t => combat.addCurse(t, 'poison', n));
        log(targets.length > 1
          ? `[[icon:skull]] 全体敌人附加 ${n} 层中毒（每层回合末 1 点固定伤害）`
          : `[[icon:skull]] <b>${esc(targets[0].name)}</b> 附加 ${n} 层中毒（每层回合末 1 点固定伤害）`, 'sys');
        did = true;
      }
    }
    // 迷之匣（2026-09-10 需求）：限定技能「发现两张随机招式，交换其费用」——
    // 招式＝武术+法术；两张都置入手牌后自动交换费用（battle.core swapCardCosts）
    if (typeof queueSwapCostDiscover === 'function' && /发现两张随机招式/.test(desc)) {
      queueSwapCostDiscover();
      did = true;
    }
    // 诅咒之刃（2026-09-10 需求）：「附加手牌中的招式所具有的全部诅咒效果」——
    // 招式＝武术+法术（设计者定版）：收集当前手牌全部招式的诅咒，一并附加给目标；
    // 卡面实时显示由 battle.view 用同一段 handCurseSpecs 数据渲染
    if (typeof handCurseSpecs === 'function' && /附加手牌中的招式所具有的全部诅咒/.test(desc)) {
      const specs = handCurseSpecs();
      const ct = (target && !target.dead) ? target : (getAlive()[0] || null);
      if (specs.length && ct) {
        const names = specs.map(s => {
          const meta = combat.CURSE_META[s.key];
          combat.addCurse(ct, s.key, s.n);
          return `${meta ? meta.name : s.key}${meta && meta.stack ? '×' + s.n : ''}`;
        }).join('、');
        log(`[[icon:skull]] <b>${esc(card.name)}</b>：附加手牌招式的诅咒 → <b>${esc(ct.name)}</b>：${names}`, 'sys');
      } else {
        log(`[[icon:cross]] <b>${esc(card.name)}</b>：手牌中没有带诅咒的招式`, 'dim');
      }
      did = true;
    }
    if (!/免疫冰冻|对冰冻/.test(desc) && /附加冰冻|冰冻\s*所有|冰冻\s*(?:\d+|[一两二三四五])\s*名|冻结/.test(desc)) {
      const fm = desc.match(/(?:冻结|冰冻)状态\s*(\d+)\s*回合/);
      const n = fm ? +fm[1] : (durOv ? +durOv : 1);
      // 2026-09-06 #13：desc 带「冰冻 N 名」时对前 N 个存活目标生效（原实现只冻 1 人）；
      // 2026-09-12：支持中文量词（禁咒II「冰冻一名敌人」）
      const CN = { '一': 1, '两': 2, '二': 2, '三': 3, '四': 4, '五': 5 };
      const multiM = desc.match(/(?:冰冻|冻结)\s*(\d+|[一两二三四五])\s*名/);
      const multiN = multiM ? (CN[multiM[1]] != null ? CN[multiM[1]] : +multiM[1]) : 0;
      if (multiN > 1) {
        const targets = getAlive().slice(0, multiN);
        targets.forEach(t => combat.addCurse(t, 'freeze', n));
        if (targets.length) { log(`[[icon:crystal]] ${targets.map(t => esc(t.name)).join('、')} 被冰冻 ${n} 回合（无法行动）`, 'sys'); did = true; }
      } else if (curseTarget) { combat.addCurse(curseTarget, 'freeze', n); log(`[[icon:crystal]] <b>${esc(curseTarget.name)}</b> 被冰冻 ${n} 回合（无法行动）`, 'sys'); did = true; }
    }
    if (/沉默/.test(desc)) {
      const n = durOv ? +durOv : 1;
      if (curseTarget) { combat.addCurse(curseTarget, 'silence', n); log(`[[icon:cross]] <b>${esc(curseTarget.name)}</b> 被沉默 ${n} 回合（技能无效，攻击除外）`, 'sys'); did = true; }
    }
    if (/破甲/.test(desc) && !bleedGateFail) {
      const n = durOv ? +durOv : 2;
      if (curseTarget) { combat.addCurse(curseTarget, 'abreak', n); log(`[[icon:tools]] <b>${esc(curseTarget.name)}</b> 破甲 ${n} 回合（无法减免伤害——元素庇幕失效）`, 'sys'); did = true; }
    }
    if (/禁疗/.test(desc)) {
      const n = durOv ? +durOv : 2;
      if (curseTarget) { combat.addCurse(curseTarget, 'healban', n); log(`[[icon:heart]] <b>${esc(curseTarget.name)}</b> 禁疗 ${n} 回合（无法回复生命）`, 'sys'); did = true; }
    }

    if (/潜行/.test(desc)) {
      const stm = desc.match(/潜行(?:状态)?\s*(\d+)\s*回合/);
      const n = stm ? +stm[1] : (durOv ? +durOv : 1);
      combat.addBlessing(pstat, 'stealth', n);
      log(`[[icon:runner]] <b>祝福·潜行</b>：${n} 回合内无法成为被攻击对象（造成伤害会破除）`, 'ok');
      did = true;
    }
    // 「攻+N / +N 攻」是攻击伤害记号：卡面 dmg 字段已经结算过（structuredHit）时
    // 不能再当攻击强化祝福叠一次（剑荡妖邪/青龙偃月斩曾因此双重加攻）；
    // 「获得 N 点攻击力」句式不受此限制（那是真正的强化，如天启诛魔剑）。
    // 「诅咒状态下」条件加成（深海印记/深海咒印）已在上方条件门放行，这里正常结算
    const atkB = (flags.structuredHit
        ? null
        : (desc.match(/攻击\s*\+\s*(\d+)/) || desc.match(/攻\s*\+\s*(\d+)/) || desc.match(/\+\s*(\d+)\s*攻/)))
      || desc.match(/获得\s*(\d+)\s*点?攻击力?/);
    if (atkB) {
      combat.addBlessing(pstat, 'atkUp', +atkB[1], durOv ? +durOv : 0);
      log(`[[icon:swords]] <b>祝福·攻击力增加</b>：攻击力 +${atkB[1]}（${durOv ? durOv + ' 回合' : '本场战斗'}，当前加成 ${pstat.status.atkUp}）`, 'ok');
      did = true;
    }
    const spB = desc.match(/法伤\s*\+\s*(\d+)/) || desc.match(/法术伤害\s*\+\s*(\d+)/);
    if (spB) {
      combat.addBlessing(pstat, 'spellUp', +spB[1], durOv ? +durOv : 0);
      log(`[[icon:crystal]] <b>祝福·法伤增加</b>：法术伤害 +${spB[1]}（${durOv ? durOv + ' 回合' : '本场战斗'}，当前加成 ${pstat.status.spellUp}）`, 'ok');
      did = true;
    }
    // —— 免疫 N 次致命伤害（黑暗吊坠）：登记死亡保险充能，触发时的「该回合无敌」由保险自带 ——
    const dsave = desc.match(/免疫\s*(\d+)\s*次致命伤害/);
    if (dsave && typeof setDeathSave === 'function') {
      setDeathSave(+dsave[1]);
      log(`[[icon:sparkles]] <b>${esc(card.name)}</b>：本场战斗免疫 ${dsave[1]} 次致命伤害（触发后该回合无敌）`, 'ok');
      did = true;
    }
    if ((/免疫伤害/.test(desc) || /无敌/.test(desc)) && !dsave) {
      const im = desc.match(/(\d+)\s*回合内[^。]*无敌/) || desc.match(/无敌[^。]*?(\d+)\s*回合/);
      const n = im ? +im[1] : (durOv ? +durOv : 1);
      combat.addBlessing(pstat, 'immune', n);
      log(`[[icon:sparkles]] <b>祝福·免疫伤害</b>：${n} 回合内不受到任何伤害`, 'ok');
      did = true;
    }
    const rdB = desc.match(/减伤\s*(\d+)?/);
    if (rdB) {
      const n = rdB[1] ? +rdB[1] : 1;
      combat.addBlessing(pstat, 'reduce', n);
      log(`[[icon:plate]] <b>祝福·减伤</b>：每次受到的伤害 -${n}（本场战斗）`, 'ok');
      did = true;
    }
    if (/剑仙形态/.test(desc) || /每回合额外抽\s*\d+\s*张/.test(desc) ||
        /回合开始时[^。]*?额外抽\s*\d+\s*张/.test(desc)) {
      combat.addBlessing(pstat, 'swordForm');
      log('[[icon:sword]] <b>祝福·剑仙形态</b>：回合开始时额外抽 1 张牌（本局对战）', 'ok');
      did = true;
    }
    if (/自然形态/.test(desc) || /回合开始时[^。]*获得\s*\d+\s*点?能量/.test(desc)) {
      combat.addBlessing(pstat, 'natureForm');
      log('[[icon:wood]] <b>祝福·自然形态</b>：回合开始时额外获得 1 点能量（本局对战）', 'ok');
      did = true;
    }
    if (/宇宙形态/.test(desc)) {
      combat.addBlessing(pstat, 'cosmosForm');
      log('[[icon:sparkles]] <b>祝福·宇宙形态</b>：本局对战内，所有卡牌变为 1 费', 'ok');
      did = true;
    }

    // —— 描述驱动的直伤句（造成 N 点固定/法术/真实伤害）：卡面伤害词条已结算过时跳过，防双倍 ——
    // 「消耗该牌时」前缀句只在消耗触发点结算（fireConsumeTriggers），打出时不生效。
    // 位置在诅咒处理之前：流血药水类「造成 N 点伤害，附加流血」需要伤害与诅咒都结算
    if (!flags.structuredHit && !/该牌时/.test(desc)) {
      const tdmSpell = desc.match(/造成\s*(\d+)\s*点法(?:术)?伤/);
      const tdm = tdmSpell ? [null, tdmSpell[1], '法术']
        : desc.match(/造成\s*(\d+)\s*点(?:\s*(固定|法术|真实|攻击))?\s*伤害/);
      if (tdm) {
        const type = tdm[2] === '法术' ? combat.TYPES.SPELL
          : tdm[2] === '真实' ? combat.TYPES.TRUE
          : tdm[2] === '攻击' ? combat.TYPES.ATTACK : combat.TYPES.FIXED;
        const aoe = /所有敌人|敌方全体|全体敌人|目标为全体|对全体/.test(desc);
        const targets = (aoe ? getAlive().slice() : (curseTarget ? [curseTarget] : [])).filter(t => t && !t.dead);
        const caster = getPlayerCaster ? getPlayerCaster() : {};
        let total = 0;
        targets.forEach(t => {
          const r = combat.dealDamage(caster, t, +tdm[1], type);
          total += r.dealt;
          if (r.dealt > 0) pushFloat({ unit: foeIndexOf ? foeIndexOf(t) : 0, text: '-' + r.dealt, cls: 'dmg' });
        });
        if (targets.length) {
          log(`[[icon:play]] <b>${esc(card.name)}</b> → ${targets.map(t => esc(t.name)).join('、')}：造成 <b>${total}</b> 点${combat.TYPE_NAME[type]}`, 'sys');
          did = true;
        }
      }
    }
    // —— 下回合连开四枪（正午决战）：4 × 2 点固定伤害 ——
    if (/连开\s*四\s*枪/.test(desc) && !did) {
      const t = curseTarget;
      let total = 0;
      for (let i = 0; i < 4 && t && !t.dead; i++) {
        const r = combat.dealDamage({}, t, 2, combat.TYPES.FIXED);
        total += r.dealt;
        if (r.dealt > 0) pushFloat({ unit: foeIndexOf ? foeIndexOf(t) : 0, text: '-' + r.dealt, cls: 'dmg' });
      }
      log(`[[icon:swords]] <b>连开四枪</b>：对 ${t ? esc(t.name) : '目标'} 造成 ${total} 点固定伤害（每枪 2 点）`, 'sys');
      did = true;
    }
    // —— 「攻击 N 次」尾段（快意恩仇：消耗 2 张初始攻击后连续攻击 N 次）——
    // 只认手选消耗的 thenText 整句（卡面整句走 battle.core 的结构化伤害），
    // 消耗完成后按玩家攻击力逐次结算（2026-09-09 老板 #14）
    const multiAtk = desc.match(/^攻击\s*(\d+)\s*次[。.！!]?$/);
    if (multiAtk && !did) {
      const t = curseTarget;
      const caster = getPlayerCaster ? getPlayerCaster() : {};
      const times = Math.max(1, +multiAtk[1]);
      let total = 0;
      for (let i = 0; i < times && t && !t.dead; i++) {
        const r = combat.dealDamage(caster, t, 0, combat.TYPES.ATTACK);
        total += r.dealt;
        if (r.dealt > 0) pushFloat({ unit: foeIndexOf ? foeIndexOf(t) : 0, text: '-' + r.dealt, cls: 'dmg' });
      }
      if (t) log(`[[icon:swords]] <b>${esc(card.name)}</b> → ${esc(t.name)}：攻击 <b>${times}</b> 次，共造成 <b>${total}</b> 点攻击伤害`, 'sys');
      did = true;
    }
    // —— 降低敌人攻击（割蚀）——
    const atkDown = desc.match(/降低\s*(?:(\d+)\s*名?)?\s*敌人\s*(\d+)\s*攻/);
    if (atkDown && !did) {
      const t = curseTarget;
      if (t && !t.dead) {
        t.atk = Math.max(0, (t.atk || 0) - +atkDown[2]);
        log(`[[icon:arrow]] <b>${esc(t.name)}</b> 攻击力降低 ${atkDown[2]} 点（当前 ${t.atk}）`, 'sys');
        did = true;
      }
    }
    // —— 偷取攻击至 1 点（影噬）：目标攻击力压到 1，差值加给自身攻强化，
    //     双向都只持续 1 回合（2026-09-09 留言 #1/#2：偷取要加自己的攻击力、只持续 1 回合）——
    if (/偷取[^。]*?攻击/.test(desc) && !did) {
      const t = curseTarget;
      if (t && !t.dead && (t.atk || 0) > 1) {
        const stolen = t.atk - 1;
        t.atk = 1;
        t._stealRestore = (t._stealRestore || 0) + stolen;
        combat.addBlessing(pstat, 'atkUp', stolen, 1);
        log(`[[icon:arrow]] <b>偷取攻击</b>：<b>${esc(t.name)}</b> 的攻击力被压到 1，你获得攻击力 +${stolen}（各自 1 回合后还原）`, 'sys');
        did = true;
      }
    }
    // —— 延长冰冻（坚冰结界）：目标已被冰冻时再追加回合数 ——
    const extF = desc.match(/延长[^。]*?冰冻[^。]*?(\d+)\s*回合/);
    if (extF && !did) {
      const t = curseTarget;
      if (t && (t.status.freeze || 0) > 0) {
        t.status.freeze += +extF[1];
        log(`[[icon:crystal]] <b>${esc(t.name)}</b> 的冰冻延长 ${extF[1]} 回合（剩 ${t.status.freeze} 回合）`, 'sys');
      } else {
        log(`[[icon:crystal]] 目标未被冰冻，延长无效`, 'dim');
      }
      did = true;
    }
    // —— 附加 N 种随机诅咒（致命射线）；灼烧已入诅咒池（2026-09-08）——
    const randC = desc.match(/附加\s*(\d+)\s*种随机诅咒/);
    if (randC && !did) {
      const keys = ['bleed', 'poison', 'freeze', 'silence', 'abreak', 'healban', 'burn']
        .sort(() => random01() - 0.5)
        .slice(0, +randC[1]);
      const t = curseTarget;
      if (t) {
        keys.forEach(k => combat.addCurse(t, k, 1));
        log(`[[icon:skull]] <b>${esc(t.name)}</b> 附加了 ${keys.length} 种随机诅咒`, 'sys');
        did = true;
      }
    }
    // —— 每回合对全体敌人各施加一层随机诅咒（末日浩劫之门），优先不重复 ——
    if (/对所有敌方(?:角色)?各施加(?:一|1)层随机诅咒/.test(desc) && !did) {
      const keys = ['bleed', 'poison', 'freeze', 'silence', 'abreak', 'healban', 'burn'];
      let hit = 0;
      getAlive().slice().forEach(t => {
        const fresh = keys.filter(k => !((t.status[k] || 0) > 0));
        const pool = fresh.length ? fresh : keys;
        const k = pool[Math.floor(random01() * pool.length)];
        combat.addCurse(t, k, 1);
        hit++;
      });
      if (hit) { log(`[[icon:skull]] <b>末日浩劫之门</b>：对 ${hit} 名敌人各施加 1 层随机诅咒（优先不重复）`, 'sys'); did = true; }
    }
    // —— 变成随机招式卡牌、费用为 0（神秘药水的回合开始效果）——
    const morph = desc.match(/变成\s*(\d+|一)\s*张随机\s*(招式|武术|法术)?\s*卡牌/);
    if (morph && !did) {
      const want = morph[2] === '法术' ? '法术' : '武术';
      const pool = allCards().filter(c => c.type === want && c.rarity !== '衍生' && !['生物', '事件'].includes(c.type));
      const c = pool.length ? pool[Math.floor(random01() * pool.length)] : null;
      if (c) {
        addTempCard({ ...c, cost: 0, _baseCost: c.cost || 0 });   // _baseCost：费用角标显示绿色「降费」（需求 #16）
        log(`[[icon:flask]] 神秘变化：变成【<b>${esc(c.name)}</b>】（招式，费用已降为 0）`, 'loot');
      } else log('[[icon:flask]] 卡牌库是空的，什么也没有变成', 'dim');
      did = true;
    }
    // —— 获得 1 张随机的「箭矢/火球/药水」，变为 0 费（天狼长弓的回合开始效果）——
    const randKey = desc.match(/获得\s*(?:(\d+)|一)?\s*张?随机的?[‘“「]?(箭矢?|火球|药水|招式|初始攻击|杀)[’”」]?/);
    if (randKey && !did) {
      const key = randKey[2] === '箭矢' ? '箭' : randKey[2];
      const pool = allCards().filter(c => c.rarity !== '衍生' && !['生物', '事件'].includes(c.type) &&
        (key === '杀' ? (c.id === 'builtin-sha' || c.name === '杀' || c.name === '初始攻击')
          : key === '招式' ? c.type === '武术'
          : String(c.name || '').includes(key)));
      const c = pool.length ? pool[Math.floor(random01() * pool.length)] : null;
      if (c) {
        addTempCard({ ...c, cost: 0, _baseCost: c.cost || 0 });   // _baseCost：费用角标显示绿色「降费」（需求 #16）
        log(`[[icon:cards]] 获得【<b>${esc(c.name)}</b>】，其费用已变为 0`, 'loot');
      } else log(`[[icon:question]] 找不到随机的「${esc(key)}」（占位）`, 'warn');
      did = true;
    }

    // —— 诅咒枚举句「（N′）冰冻、流血、中毒」（诅咒光波的注能效果）——
    const enumC = desc.match(/^(?:(\d+)\s*′\s*)?((?:冰冻|流血|中毒|沉默|破甲|禁疗|灼烧)(?:[、，]\s*(?:冰冻|流血|中毒|沉默|破甲|禁疗|灼烧))*)$/);
    if (enumC && !did) {
      const t = curseTarget;
      if (t) {
        const keyMap = { '冰冻': 'freeze', '流血': 'bleed', '中毒': 'poison', '沉默': 'silence', '破甲': 'abreak', '禁疗': 'healban', '灼烧': 'burn' };
        if (enumC[1]) {
          const r = combat.dealDamage(getPlayerCaster ? getPlayerCaster() : {}, t, +enumC[1], combat.TYPES.SPELL);
          if (r.dealt > 0) pushFloat({ unit: foeIndexOf ? foeIndexOf(t) : 0, text: '-' + r.dealt, cls: 'dmg' });
        }
        enumC[2].split(/[、，]\s*/).forEach(w => combat.addCurse(t, keyMap[w], 1));
        log(`[[icon:skull]] <b>${esc(t.name)}</b> 附加：${esc(enumC[2])}${enumC[1] ? `（并受到 ${enumC[1]} 点法术伤害）` : ''}`, 'sys');
        did = true;
      }
    }
    // —— 施放 N 次火球（星陨之力注能效果）——
    const fbN = desc.match(/施放\s*(\d+)\s*次?火球(?:术)?/);
    if (fbN && !did && curseTarget) {
      const caster = getPlayerCaster ? getPlayerCaster() : {};
      let total = 0;
      for (let k = 0; k < +fbN[1] && curseTarget && !curseTarget.dead; k++) {
        const r = combat.dealDamage(caster, curseTarget, 4, combat.TYPES.SPELL);
        total += r.dealt;
        if (r.dealt > 0) pushFloat({ unit: foeIndexOf ? foeIndexOf(curseTarget) : 0, text: '-' + r.dealt, cls: 'dmg' });
      }
      log(`[[icon:fire]] <b>${esc(card.name)}</b>：施放 ${fbN[1]} 次火球 → ${esc(curseTarget.name)}，共 ${total} 点法术伤害`, 'sys');
      did = true;
    }
    // —— 对全体敌人每人释放 1 次火球（风暴火球）——
    const stormFb = desc.match(/(?:每个?敌人|全体敌人|敌方全体)每人?释放\s*(?:(\d+)\s*次)?火球/);
    if (stormFb && !did) {
      const caster = getPlayerCaster ? getPlayerCaster() : {};
      const per = stormFb[1] ? +stormFb[1] : 1;
      let total = 0;
      getAlive().slice().forEach(t => {
        for (let k = 0; k < per && !t.dead; k++) {
          const r = combat.dealDamage(caster, t, 4, combat.TYPES.SPELL);
          total += r.dealt;
          if (r.dealt > 0) pushFloat({ unit: foeIndexOf ? foeIndexOf(t) : 0, text: '-' + r.dealt, cls: 'dmg' });
        }
      });
      log(`[[icon:fire]] 火球风暴：对全体敌人各施放 ${per} 次火球，共 ${total} 点法术伤害`, 'sys');
      did = true;
    }
    // —— 自伤（诅咒之剑「回合开始：受到2点伤害」）——
    const selfDmg = desc.match(/受到\s*(\d+)\s*点?伤害/);
    if (selfDmg && !did && typeof damagePlayer === 'function') {
      damagePlayer(+selfDmg[1]);
      did = true;
    }
    // —— 血量上限 +N（混沌之眼）——
    const maxHpM = desc.match(/血量上限\s*\+\s*(\d+)/);
    if (maxHpM && typeof addPlayerMaxHp === 'function') {
      addPlayerMaxHp(+maxHpM[1]);
      did = true;
    }
    // —— 消耗所有手牌（金蝉脱壳）：清空手牌，再由抽牌句补牌 ——
    if (/消耗(?:所有|全部)(?:的)?手牌/.test(desc) && !did && typeof dumpHand === 'function') {
      const nDump = dumpHand();
      log(`[[icon:flask]] 消耗了所有手牌（${nDump} 张）`, 'sys');
      did = true;
    }
    // —— 闪避（本回合避开第 1 段伤害 ≈ 减伤 1，1 回合）——
    if (/避开第\s*(\d+)\s*段伤害/.test(desc) && !did) {
      const n = +(desc.match(/避开第\s*(\d+)\s*段伤害/) || [])[1] || 1;
      combat.addBlessing(pstat, 'reduce', n, 1);
      log(`[[icon:shield]] <b>闪避</b>：本回合受到的伤害 -${n}`, 'ok');
      did = true;
    }

    let healed = false, armored = false;
    const hm = desc.match(/回复\s*(\d+)\s*(?:点\s*生命|点?血)/) || desc.match(/\+\s*(\d+)\s*血/);
    if (hm) {
      healed = true;
      if ((pstat.status.healban || 0) > 0) {
        log(`[[icon:heart]] 禁疗中：回复 ${hm[1]} 点生命无效（还剩 ${pstat.status.healban} 回合）`, 'warn');
      } else { heal(+hm[1]); pushFloat({ unit: 'self', text: '💚', cls: 'stk', warm: true }); }
      did = true;
    }
    // 2026-09-06 #16：战斗内复原消耗卡（从消耗堆拿回手牌）；「复活 N 张卡牌」同义复用
    const rstM = desc.match(/(?:复原|复活)\s*(?:最多)?\s*(\d+)?\s*张/);
    if (rstM) { const c = restoreConsumed(+(rstM[1] || 1)); if (c) did = true; }
    // 2026-09-06 #24/#25：通用「选择手牌施放 / 消耗手牌」
    if (!did) {
      const selPlay = desc.match(/选择(?:\s*手牌中)?\s*(\d+|[一两二三四五])\s*张(?:手牌中的?)?\s*(武术|法术|装备|牌)?\s*卡?[^，。；;]*?(?:施放|释放|打出)/);
      if (selPlay) {
        const numMap = { '一': 1, '两': 2, '二': 2, '三': 3 };
        const n = numMap[selPlay[1]] || +selPlay[1] || 1;
        queueHandSelect({ n, type: selPlay[2] === '牌' ? null : selPlay[2], act: 'play' });
        log(`[[icon:cards]] 从手牌选择 <b>${n}</b> 张${selPlay[2] && selPlay[2] !== '牌' ? selPlay[2] : ''}牌打出`, 'sys');
        did = true;
      } else if (/选择并复制你的\s*(?:1\s*|一\s*)?张?手牌/.test(desc) && typeof queueHandSelect === 'function') {
        // 深红丝袋：选择并复制 1 张手牌（复制件置入手牌，原牌保留）
        queueHandSelect({ n: 1, type: null, act: 'copy' });
        log(`[[icon:cards]] 从手牌选择 <b>1</b> 张复制（原牌保留）`, 'sys');
        did = true;
      } else {
        const consM = desc.match(/消耗\s*(一张|两|二|三|\d+)\s*张?\s*(?:手牌中的)?(初始攻击|武术|法术|装备|牌|杀)牌?[,，]\s*(.+)$/);
        if (consM) {
          const numMap = { '一': 1, '两': 2, '二': 2, '三': 3 };
          const n = numMap[consM[1]] || +consM[1] || 1;
          queueHandSelect({ n, type: consM[2] === '牌' ? null : consM[2], act: 'consume', thenText: consM[3], target: curseTarget, srcCard: card });
          // 尾段效果（+10甲 等）在消耗完成后经 thenText 结算——立即段提前收口，
          // 防止同一句被 am/hm 等处理器再吃一遍（铸甲曾因此双倍护甲）。
          // 2026-09-10 留言 #25：尾段已有的回复/护甲/抽卡要如实回报，否则
          // battle.core 的结构化兜底（card.armor 等）会再发一次——「+10 甲」实际加了 20。
          const tail = consM[3];
          return {
            did: true,
            drawn: /抽\s*(?:\d+|[一二两三四])\s*张/.test(tail),
            healed: /回复|\+\s*\d+\s*血/.test(tail),
            armored: /护甲|\+\s*\d+\s*甲/.test(tail),
          };
        }
      }
    }
    // 2026-09-06 #15：随机神秘效果（神秘药水）——战斗内随机三选一
    if (!did && /随机神秘效果/.test(desc)) {
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
      did = true;
    }
    const am = desc.match(/获得\s*(\d+)\s*点?\s*护甲/) || desc.match(/\+\s*(\d+)\s*甲/);
    if (am) { armored = true; pdef.armor += +am[1]; log(`[[icon:plate]] 获得 ${am[1]} 点护甲`, 'sys'); did = true; }
    const sm = desc.match(/获得\s*(\d+)\s*点?\s*护盾/);
    if (sm) { pdef.shield += +sm[1]; log(`[[icon:shield]] 获得 ${sm[1]} 点护盾`, 'sys'); did = true; }
    if (/本回合所受伤害降为/.test(desc)) {
      pdef.guard = true;
      log('[[icon:shield]] 格挡：本回合所受伤害降为 1', 'sys');
      did = true;
    }
    if (/净化/.test(desc)) {
      const cleared = combat.purify(pstat);
      log(cleared.length
        ? `[[icon:sparkles]] 净化：清除了身上的 ${cleared.map(k => combat.CURSE_META[k].name).join('、')}`
        : '[[icon:sparkles]] 净化：身上没有诅咒，干干净净', 'ok');
      did = true;
    }

    let drawn = false;
    // 「回合开始时额外抽」= 形态效果（swordForm 已注册），不再立即抽一次；
    // 「每释放 1 张，抽 1 张牌」= 连弩等逐张释放的随行抽牌，由释放处理器结算
    const turnExtraDraw = /回合开始时[^。]*?额外抽/.test(desc);
    const perReleaseDraw = /每(释放|打出)\s*1\s*张/.test(desc);
    // 「对方每有 1 种诅咒，抽 N 张牌」（深渊诅咒）：按目标诅咒种类数放大抽牌量
    const perCurseDraw = desc.match(/每有\s*1\s*种诅咒[^。]*?抽\s*(\d+)\s*张牌/);
    const dm = desc.match(/抽\s*(\d+)\s*[-—~～至]\s*(\d+)\s*张牌/) || desc.match(/抽\s*(\d+)\s*张牌/);
    // 「洗入牌库，然后抽 N 张牌」语序（无极梦魇）：抽牌由洗入处理器在洗混后结算——
    // 若在此先抽，「然后抽」抽到的是洗入前的旧牌，顺序与卡面相反（2026-09-11 英雄卡审计）
    if ((dm || perCurseDraw) && !turnExtraDraw && !perReleaseDraw && !/该牌时/.test(desc)
      && !/洗入牌库[^。]*然后抽/.test(desc)) {
      let n = perCurseDraw ? +perCurseDraw[1] : +dm[1];
      if (perCurseDraw && curseTarget) {
        const kinds = combat.CURSES.filter(k => (curseTarget.status[k] || 0) > 0).length;
        n *= Math.max(1, kinds);
        log(`[[icon:skull]] 目标身上有 ${kinds} 种诅咒，抽牌量放大`, 'sys');
      }
      if (getMode() === 'boss') {
        const got = drawCards(n);
        log(`[[icon:cards]] <b>${esc(card.name)}</b>：抽了 ${got} 张牌`, 'sys');
      } else {
        grantStarterAttack(n);
        log(`[[icon:cards]] <b>${esc(card.name)}</b>：获得 ${n} 张【初始攻击】（普通战斗抽牌效果改为获得初始攻击）`, 'sys');
      }
      did = true; drawn = true;
      // 万剑归宗：抽完后直接释放其中的武术/法术
      const autoM = desc.match(/直接释放其中(武术|法术|招式)/);
      if (autoM && typeof autoPlayHandType === 'function') {
        const played = autoPlayHandType(autoM[1] === '招式' ? '武术' : autoM[1]);
        if (played) log(`[[icon:swords]] <b>万剑归宗</b>：直接释放了其中 ${played} 张${autoM[1]}`, 'ok');
      }
    }
    if (/下回合无法抽牌|下个回合无法抽牌/.test(desc)) {
      markNoDrawNext();
      log('[[icon:cross]] 已标记：<b>下回合开始无法抽牌</b>', 'sys');
      did = true;
    }
    // —— 消灭小怪（神灯 2°/TNT）：可带「攻击力 N 点及以下」门槛；无门槛时优先残血 ——
    const killM = desc.match(/消灭\s*(\d+)\s*名(?:\s*攻击力\s*(\d+)\s*点?及以下)?/);
    if (killM && !did) {
      const n = +killM[1];
      const cap = killM[2] ? +killM[2] : null;
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
      if (targets.length) { pushFloat({ unit: 'self', text: '💥', cls: 'stk' }); did = true; }
    }
    // —— 注能打出时：「下一张法术施放 N 次」（元素风暴）——
    const nsM = desc.match(/下一张(?:法术|招式)?施放\s*(\d+)\s*次/);
    if (nsM && flags.infused && typeof setNextSpellTwice === 'function') {
      setNextSpellTwice(+nsM[1]);
      log(`[[icon:sparkles]] <b>元素风暴</b>：下一张法术将施放 ${nsM[1]} 次`, 'ok');
      did = true;
    }
    // —— 扰敌：迫使 2 名敌人相互攻击一次（自动选前两名存活敌人） ——
    if (/迫使其?相互攻击/.test(desc) && !did) {
      const ts = getAlive().slice(0, 2);
      if (ts.length === 2) {
        const r = combat.dealDamage({ atk: ts[0].atk }, ts[1], 0, combat.TYPES.ATTACK);
        if (r.dealt > 0) pushFloat({ unit: foeIndexOf ? foeIndexOf(ts[1]) : 0, text: '-' + r.dealt, cls: 'dmg' });
        log(`[[icon:swords]] <b>扰敌</b>：${esc(ts[0].name)} 被迫攻击 ${esc(ts[1].name)}，造成 ${r.dealt} 点伤害`, 'sys');
        did = true;
      }
    }
    // —— 攻击全体敌人（无伤害数值，按攻击力结算；诛魔剑抽到时触发等）——
    if (/攻击全体敌人/.test(desc) && !did) {
      const caster = getPlayerCaster ? getPlayerCaster() : {};
      let total = 0;
      getAlive().slice().forEach(t => {
        const r = combat.dealDamage(caster, t, 0, combat.TYPES.ATTACK);
        total += r.dealt;
        if (r.dealt > 0) pushFloat({ unit: foeIndexOf ? foeIndexOf(t) : 0, text: '-' + r.dealt, cls: 'dmg' });
      });
      log(`[[icon:swords]] <b>${esc(card.name)}</b>：攻击全体敌人，共造成 ${total} 点攻击伤害`, 'sys');
      did = true;
    }
    // —— 损失 N 点生命（恶魔之力）——
    const lossM = desc.match(/损失\s*(\d+)\s*点?(?:生命|血)/);
    if (lossM && !did && typeof damagePlayer === 'function') {
      damagePlayer(+lossM[1]);
      did = true;
    }
    // —— 自伤「-N 血」（诅咒武器类回合开始效果）——
    const negHp = desc.match(/[-－]\s*(\d+)\s*点?血/);
    if (negHp && !did && typeof damagePlayer === 'function') {
      damagePlayer(+negHp[1]);
      did = true;
    }
    // —— 回合结束护甲衰减「-N 点」（坚盾）——
    const armLoss = desc.match(/[-－]\s*(\d+)\s*点?\s*$/);
    if (armLoss && !did) {
      const n = +armLoss[1];
      pdef.armor = Math.max(0, pdef.armor - n);
      log(`[[icon:plate]] 护甲衰减：-${n} 点（当前 ${pdef.armor}）`, 'warn');
      did = true;
    }
    // —— 回复至 N 血（沐愈光辉：把血量拉到目标值，不低于现值） ——
    const hpToM = desc.match(/回复\s*至\s*(\d+)\s*血/);
    if (hpToM && !did) {
      const want = +hpToM[1];
      const cur = getPlayerHp();
      if ((pstat.status.healban || 0) > 0) {
        log(`[[icon:heart]] 禁疗中：回复至 ${want} 血无效（还剩 ${pstat.status.healban} 回合）`, 'warn');
      } else if (want > cur) {
        heal(want - cur);
        pushFloat({ unit: 'self', text: '💚', cls: 'stk', warm: true });
        log(`[[icon:heart]] 回复至 <b>${want}</b> 血（当前 ${cur}，回复 ${want - cur}）`, 'ok');
      } else {
        log(`[[icon:heart]] 回复至 ${want} 血：当前 ${cur} 不低于目标值，无变化`, 'ok');
      }
      did = true;
    }
    // —— 无法行动（制敌：下回合无法行动 → 冰冻 1 回合） ——
    if (/无法行动/.test(desc) && !did && /下回合|下个回合|本回合/.test(desc)) {
      if (curseTarget) {
        combat.addCurse(curseTarget, 'freeze', 1);
        log(`[[icon:crystal]] <b>${esc(curseTarget.name)}</b> 无法行动（冰冻 1 回合）`, 'sys');
        did = true;
      }
    }
    // —— 中毒层数翻倍并立即触发毒伤（花鸩） ——
    if (/中毒层数翻倍/.test(desc) && !did) {
      if (curseTarget) {
        combat.addCurse(curseTarget, 'poison', curseTarget.status.poison || 0);   // 加倍：再叠自身当前层数
        const burst = burstPoison(curseTarget) || { dealt: 0 };   // 目标没中毒时端口返回 null，按 0 点毒伤结算
        log(`[[icon:skull]] <b>${esc(curseTarget.name)}</b> 中毒翻倍至 ${curseTarget.status.poison} 层并立即触发 ${burst.dealt} 点毒伤`, 'sys');
        did = true;
      }
    }
    // —— 置入随机卡牌直至手牌达到 N 张；每置入 1 张法术回复固定血（露娜拉） ——
    const fillM = desc.match(/置入随机卡牌直至手牌达到\s*(\d+)\s*张/);
    if (fillM && !did) {
      const want = +fillM[1];
      let put = 0, spells = 0;
      while (getHandSize() < want) {
        const c = randomDiscoverCard(null);
        if (!c) break;
        addTempCard(c); put++;
        if (typeof randomAcquired === 'function') randomAcquired(c);   // 阿猫的礼物：随机获取触发
        if (c.type === '法术') spells++;
      }
      const perM = desc.match(/每置入\s*1\s*张法术[^。]*?回复\s*(\d+)\s*血/);
      const healedN = perM ? +perM[1] : 0;
      if (healedN && spells > 0) {
        heal(healedN * spells);
        pushFloat({ unit: 'self', text: '💚', cls: 'stk', warm: true });
        log(`[[icon:cards]] <b>${esc(card.name)}</b>：置入 ${put} 张随机卡牌（手牌达到 ${getHandSize()} 张），其中 ${spells} 张法术 → 回复 ${healedN * spells} 血`, 'loot');
      } else {
        log(`[[icon:cards]] <b>${esc(card.name)}</b>：置入 ${put} 张随机卡牌（手牌达到 ${getHandSize()} 张）`, 'loot');
      }
      if (put) did = true;
    }
    // —— 获得一张随机手牌的复制（刀剑形态） ——
    if (/获得一张随机手牌的复制/.test(desc) && !did) {
      const cards = getHandCards();
      if (cards.length) {
        const tpl = cards[Math.floor(random01() * cards.length)];
        if (tpl) {
          addTempCard(tpl.card);
          log(`[[icon:cards]] 复制了手牌中的【<b>${esc(tpl.card.name)}</b>】（置入手牌）`, 'loot');
          did = true;
        }
      }
    }
    // —— 获得 1 张员工通行证B或员工通行证A，无法将其带入对战（战后消散） ——
    if (/获得\s*1\s*张员工通行证B或员工通行证A/.test(desc) && !did) {
      const pool = allCards().filter(c => c.id === 'tt-token-gold' || c.id === 'tt-token-color');
      if (pool.length) {
        const got = pool[Math.floor(random01() * pool.length)];
        addTempCard(got);
        log(`[[icon:sparkles]] 获得【<b>${esc(got.name)}</b>】（令牌，战后消散）`, 'loot');
        did = true;
      }
    }
    // —— 非 BOSS 战逃跑一次（烟雾弹） ——
    if (/逃跑一次|非 BOSS 战逃跑/.test(desc) && !did && typeof fleeBattle === 'function') {
      fleeBattle();
      did = true;
    }
    // —— 随机获取一项祝福（天国之门：回合开始从候选里选一个，优先不重复） ——
    if (/随机获取一项祝福/.test(desc) && !did) {
      const cand = [];
      if (/潜行/.test(desc)) cand.push({ key: 'stealth', run: () => combat.addBlessing(pstat, 'stealth', 1), name: '潜行' });
      if (/攻击力/.test(desc)) cand.push({ key: 'atkUp', run: () => combat.addBlessing(pstat, 'atkUp', 1), name: '攻击力 +1' });
      if (/法伤/.test(desc)) cand.push({ key: 'spellUp', run: () => combat.addBlessing(pstat, 'spellUp', 1), name: '法伤 +1' });
      if (/减伤/.test(desc)) cand.push({ key: 'reduce', run: () => combat.addBlessing(pstat, 'reduce', 1), name: '减伤 1' });
      if (/护甲/.test(desc)) cand.push({ key: '_armor', run: () => { pdef.armor += 5; }, name: '护甲 5' });
      if (/净化/.test(desc)) cand.push({ key: '_purify', run: () => combat.purify(pstat), name: '净化' });
      if (cand.length) {
        const fresh = cand.filter(c => c.key.startsWith('_') || !((pstat.status[c.key] || 0) > 0));
        const pool = fresh.length ? fresh : cand;
        const pick = pool[Math.floor(random01() * pool.length)];
        pick.run();
        log(`[[icon:sparkles]] <b>祝福·${esc(pick.name)}</b>（随机祝福，优先不重复）`, 'ok');
        did = true;
      }
    }
    // —— 从牌库中抽取 N 张指定类型（武装：装备牌） ——
    const deckM = desc.match(/从牌库中抽取\s*(\d+)\s*张?(初始攻击|装备|法术|武术|杀)牌?/);
    if (deckM && !did) {
      const kind = (deckM[2] === '杀' || deckM[2] === '初始攻击') ? '杀' : deckM[2];
      deckDraw({ n: +deckM[1], type: kind });
      did = true;
    }
    // —— 治疗所有队友（银河幻境：全队回复 3 血） ——
    if (/治疗所有队友|治疗全体/.test(desc) && !did) {
      heal(3);
      pushFloat({ unit: 'self', text: '💚', cls: 'stk', warm: true });
      log(`[[icon:heart]] 治疗所有队友：回复 <b>3</b> 点生命`, 'ok');
      did = true;
    }
    // —— 随机获取 N 张能施加诅咒的卡牌/招式（厄运） ——
    const curseM = desc.match(/随机获取\s*(\d+)\s*张能施加诅咒的(卡牌|招式)/);
    if (curseM && !did) {
      const wantType = curseM[2] === '招式' ? '武术' : null;
      const pool = allCards().filter(c =>
        c.rarity !== '衍生' && ['武术', '法术', '装备', '能力卡'].includes(c.type) &&
        (!wantType || c.type === wantType) &&
        /诅咒|中毒|流血|冰冻|沉默|破甲|禁疗/.test(String(c.desc || '')));
      let got = 0;
      for (let i = 0; i < +curseM[1] && pool.length; i++) {
        const c = pool[Math.floor(random01() * pool.length)];
        addTempCard(c); got++;
      }
      log(`[[icon:skull]] <b>${esc(card.name)}</b>：随机获得 ${got} 张【能施加诅咒${wantType ? '的招式' : ''}】的卡牌（置入手牌，战后消散）`, 'loot');
      if (got) did = true;
    }
    // —— 发现 1 瓶药水并直接释放（药水魔法）——
    const potM = desc.match(/发现\s*1?\s*瓶药水/);
    if (potM && !did) {
      queueDiscover({ n: 1, act: 'potion', pred: parsePoolNoun('药水', myClass) });
      log(`[[icon:flask]] <b>${esc(card.name)}</b>：发现 1 瓶药水并直接释放`, 'sys');
      did = true;
    }
    // —— 发现一张注能卡，使其无需注能（灵能召唤）——
    if (/发现\s*(?:一|1)\s*张注能卡/.test(desc) && !did) {
      const pred = parsePoolNoun('注能', myClass);
      const c = pred ? randomDiscoverCard(pred) : null;
      if (c) {
        addTempCard({ ...c, _noInfuse: true });
        log(`[[icon:crystal]] <b>灵能召唤</b>：发现【<b>${esc(c.name)}</b>】，其无需注能即可打出`, 'loot');
      } else log('[[icon:question]] 没有可发现的注能卡', 'dim');
      did = true;
    }
    // —— 发现 / 随机获取 / 获得 N 张 ______卡牌（统一入口 + 限制卡池解析，2026-09-08）——
    // 「该牌时」= 获得/消耗时才触发的被动（消耗触发已由 fireConsumeTriggers 在消耗时点结算），出牌时跳过
    const dPool = !/该牌时/.test(desc)
      ? desc.match(/(?:发现|随机获取|获取|获得)(?:并直接施放)?\s*(?:(\d+|[一两二三四五])\s*[张种])?\s*([^，。；,\s]{0,8}?)(卡牌|的卡|的牌|能力卡|牌|卡)/)
      : null;
    if (dPool && !did) {
      const n0 = POOL_NUM_MAP[dPool[1]] != null ? POOL_NUM_MAP[dPool[1]] : (dPool[1] ? +dPool[1] : 1);
      const noun = dPool[2] || '';
      const pred = parsePoolNoun(noun, myClass);
      const n = /等量随机卡牌/.test(desc) ? 2 : n0;   // 魔法锅炉「发现等量随机卡牌」（消耗至多 2 张）
      let act = null;
      // 需求 #17（2026-09-09）：「并直接施放 / 并施放 / 并释放」都算直接释放——此前只测「释放」，
      // 江湖救急「发现 1 张其它职业的卡牌并直接施放」发现的卡只置入手牌不打出
      if (/并直接施放/.test(dPool[0]) || /并将其释放|并(?:直接)?(?:施放|释放)/.test(desc)) act = 'play';
      if (/获取剩下(两|2)张/.test(desc)) act = 'playKeep';
      // 二刀流（2026-09-10 需求）：「并额外获得1张复制」→ 发现的卡连本体共 2 张置入手牌
      if (/并额外获得\s*1\s*张复制/.test(desc)) act = 'dup';
      // 挖宝：「并获得等同于其价格的护甲」→ 选中卡后按售价折算护甲（pickDiscover 结算）
      // 江湖救急：「回合开始时将其消耗」→ 置入的临时卡记录 uid，下回合开始统一消耗
      queueDiscover({ n, pred, act,
        priceArmor: /获得等同于(?:其|该卡|该牌)价格的护甲/.test(desc),
        consumeTempAtTurn: /回合开始时将其消耗/.test(desc) });
      const label = pred ? noun.replace(/的$/, '') : '';
      log(`[[icon:question]] <b>${esc(card.name)}</b>：${act === 'play' ? '发现并直接施放' : act === 'playKeep' ? '发现（施放 1 张，其余入手）' : '发现'} ${n} 张${label ? `【${esc(label)}】` : ''}卡牌${pred ? '（限制卡池）' : ''}`, 'sys');
      did = true;
    }

    // 「洗入 N 张随机卡牌」两种语序：洗入在前（旧卡）/「将 N 张随机卡牌洗入牌库」（铁甲阵）；
    // shR 命中时 shN 不再参与，防止同一句双结算
    const shR = desc.match(/洗入\s*(\d+)\s*张随机卡牌/) || desc.match(/将\s*(\d+)\s*张随机卡牌洗入牌库/);
    const shN = !shR && desc.match(/将\s*(?:(\d+|[一二两三四五])\s*张)?\s*([^\s，,。；;、]+?)(?:复制)?(?:洗入|放入|置入)牌库/);
    if (shR || shN) {
      const added = [];
      // 铁甲阵：洗入随机卡时使其费用均 -1（2026-09-08 老板指定补实装）
      const cheap = /费用均?\s*[-－]\s*1/.test(desc);
      if (shR) {
        for (let i = 0; i < +shR[1]; i++) {
          const discovered = randomDiscoverCard(null);
          if (discovered) {
            addDeckCard(cheap ? { ...discovered, cost: Math.max(0, (discovered.cost || 0) - 1) } : discovered);
            if (typeof randomAcquired === 'function') randomAcquired(discovered);   // 阿猫的礼物：随机获取触发
            added.push(discovered.name);
          }
        }
        if (cheap && added.length) log(`[[icon:bolt]] 洗入的 ${added.length} 张随机卡牌费用均已 -1`, 'sys');
      }
      if (shN) {
        // 去引号；「A与B」「A、B」多卡名拆分；「禁咒」等系列名按前缀整组洗入
        const rawName = shN[2].replace(/[‘’“”「」]/g, '');
        const count = shN[1] ? (POOL_NUM_MAP[shN[1]] != null ? POOL_NUM_MAP[shN[1]] : +shN[1]) : 1;
        rawName.split(/[与和、]/).forEach(nm => {
          const exact = allCards().find(candidate => candidate.name === nm);
          const series = !exact ? allCards().filter(candidate => String(candidate.name || '').startsWith(nm)) : [exact];
          if (series.length) {
            for (let i = 0; i < count; i++) {
              const tpl = series[i % series.length];
              addDeckCard(tpl); added.push(tpl.name);
            }
          } else {
            log(`[[icon:question]] 【${esc(card.name)}】找不到可洗入牌库的卡牌「${esc(nm)}」（占位）`, 'warn');
          }
        });
      }
      if (added.length) {
        const deckSize = shuffleDeck();
        const counts = {};
        added.forEach(name => { counts[name] = (counts[name] || 0) + 1; });
        log(`[[icon:recycle]] <b>${esc(card.name)}</b>：将 ${Object.keys(counts).map(name => `【${esc(name)}】×${counts[name]}`).join('、')} 洗入牌库` +
          `（牌库 ${deckSize} 张，已洗混）`, 'sys');
        // 洗混后结算「然后抽 N 张牌」（无极梦魇：四张禁咒洗入牌库，然后抽 2 张）
        const afterDraw = desc.match(/洗入牌库[^。]*然后抽\s*(\d+|[一二两三四五])\s*张牌/);
        if (afterDraw) {
          const n2 = POOL_NUM_MAP[afterDraw[1]] != null ? POOL_NUM_MAP[afterDraw[1]] : +afterDraw[1];
          if (getMode() === 'boss') {
            const got = drawCards(n2);
            log(`[[icon:cards]] <b>${esc(card.name)}</b>：洗入后抽了 ${got} 张牌`, 'sys');
          } else {
            grantStarterAttack(n2);
            log(`[[icon:cards]] <b>${esc(card.name)}</b>：洗入后获得 ${n2} 张【初始攻击】（普通战斗抽牌效果改为获得初始攻击）`, 'sys');
          }
        }
        did = true;
      }
    }
    const hdN = desc.match(/将\s*(?:(\d+|[一二两三四五])\s*张)?\s*([^\s，,。；;、]+?)(?:复制)?置入手牌/);
    if (hdN) {
      const nm = hdN[2].replace(/[‘’“”「」]/g, '');
      const tpl = allCards().find(candidate => candidate.name === nm);
      const count = hdN[1] ? (POOL_NUM_MAP[hdN[1]] != null ? POOL_NUM_MAP[hdN[1]] : +hdN[1]) : 1;
      if (tpl) {
        for (let i = 0; i < count; i++) addTempCard(tpl);
        log(`[[icon:cards]] <b>${esc(card.name)}</b>：将 ${count} 张【${esc(tpl.name)}】置入手牌（战斗内临时卡，战后消散）`, 'loot');
      } else {
        log(`[[icon:question]] 【${esc(card.name)}】找不到可置入手牌的卡牌「${esc(nm)}」（占位）`, 'warn');
      }
      did = true;
    }
    // —— 获得 N 张指名道姓的卡（天启诛魔剑「获得3张重斩」等；置句末才识别，避免误吃其它句式）——
    const gn = desc.match(/获得\s*(?:(\d+|[一两二三四五])\s*张)\s*[‘“「]?([^\s，。；,、‘’“”「」]{1,6})[’”」]?(?=[。，；;]|$)/);
    if (gn && !did && !['随机', '等量'].includes(gn[2])) {
      const nm = gn[2].replace(/[‘’“”「」]/g, '');
      const tpl = allCards().find(candidate => candidate.name === nm);
      const count = POOL_NUM_MAP[gn[1]] != null ? POOL_NUM_MAP[gn[1]] : +gn[1];
      if (tpl) {
        for (let i = 0; i < count; i++) addTempCard(tpl);
        log(`[[icon:cards]] <b>${esc(card.name)}</b>：获得 ${count} 张【${esc(tpl.name)}】（置入手牌）`, 'loot');
      } else {
        log(`[[icon:question]] 【${esc(card.name)}】找不到卡牌「${esc(nm)}」（占位）`, 'warn');
      }
      did = true;
    }
    // —— 「杀」化为另一张卡（不朽神剑/龙吟沧海：本局对战内打出的初始攻击改为目标卡）——
    const shaTo = desc.match(/[‘’“”「」]?(?:杀|初始攻击)[‘’“”「」]?\s*化为\s*[‘’“”「」]?(?:(\d+)\s*张)?([^\s，。；;、‘’“”「」]{1,8})/);
    if (shaTo && typeof setShaTransform === 'function') {
      setShaTransform(shaTo[2]);
      log(`[[icon:recycle]] <b>战斗规则</b>：你的「初始攻击」在本场战斗中化为【<b>${esc(shaTo[2])}</b>】`, 'ok');
      did = true;
    }
    // —— 每消耗 1 张卡牌，施放 1 次火球（深渊降焰，降临者英雄）——
    const cfN = desc.match(/每\s*消耗\s*1\s*张卡牌[^。]*?施放\s*(?:(\d+)\s*次)?[‘’“”「」]?火球/);
    if (cfN && typeof setConsumeFireball === 'function') {
      setConsumeFireball(cfN[1] ? +cfN[1] : 1);
      log(`[[icon:fire]] <b>战斗规则</b>：每消耗 1 张卡牌，自动施放火球`, 'ok');
      did = true;
    }
    // —— 句内嵌的「回合开始时发现 N 张卡牌」（万法乾坤）：分句器把整句留在即时段，
    // 此前被法伤句吃掉后回合开始段从未注册——在此拆出并注册为每回合开始的延迟段
    const tsDisc = desc.match(/回合开始时[^。]*?(发现[^。]*?（?\s*(?:\d+|[一两二三四五])?\s*张[^。]*?)$/);
    if (tsDisc && typeof registerTurnStartText === 'function') {
      registerTurnStartText(tsDisc[1], String(card.name || ''));
      log(`[[icon:hourglass]] <b>回合开始时</b>：【${esc(card.name)}】${esc(tsDisc[1])}（下个回合开始起每回合生效）`, 'sys');
      did = true;
    }
    // —— 破隐一击伤害翻倍（白梅落影·妄）：从潜行中发动的攻击伤害 ×2 ——
    if (/破隐[^。]*?伤害翻倍/.test(desc) && typeof setStealthStrike === 'function') {
      setStealthStrike(true);
      log('[[icon:runner]] <b>战斗规则</b>：破隐一击——从潜行中发动的攻击伤害翻倍', 'ok');
      did = true;
    }
    // —— 对方身上每有一层诅咒，释放一次「杀」（流光照影）——
    if (/每有一层诅咒[^。]*?释放(?:一次)?[‘'“]?(?:杀|初始攻击)/.test(desc) && !did && typeof releaseHandMatches === 'function') {
      const layers = curseTarget
        ? combat.CURSES.filter(k => combat.CURSE_META[k].stack)
            .reduce((a, k) => a + (curseTarget.status[k] || 0), 0)
        : 0;
      let released = 0;
      for (let i = 0; i < layers && i < 10; i++) released += releaseHandMatches('杀', 0);
      log(`[[icon:recycle]] <b>流光照影</b>：目标身负 ${layers} 层诅咒，释放了 ${released} 次「初始攻击」`, 'sys');
      did = true;
    }
    // —— 「若本牌为最后一张手牌，效果触发 N 次」（急行军）：出牌结算（execPlay）
    //     在手牌打空时把整卡效果再跑一遍，这里只负责把该子句识别为已实装 ——
    if (/最后一张手牌[^。；]*?触发\s*(?:\d+\s*)?次/.test(desc) && !did) {
      log('[[icon:cards]] 最后一张手牌条件：手牌已空时整卡效果触发 2 次（出牌结算判定）', 'sys');
      did = true;
    }
    // —— 直接释放手牌中的所有「箭/杀/火球」（连弩），每释放 1 张抽 1 张牌 ——
    const relM = desc.match(/直接释放手牌中的所有[‘’“”「」]?(初始攻击|箭|杀|火球)[’’”」]?/);
    if (relM && typeof releaseHandMatches === 'function' && !did) {
      const drawEach = (desc.match(/每(?:释放|打出)\s*1\s*张[^。]*?抽\s*(\d+)\s*张牌/) || [])[1];
      const relKey = relM[1] === '初始攻击' ? '杀' : relM[1];
      const released = releaseHandMatches(relKey, drawEach ? +drawEach : 0);
      if (released) { log(`[[icon:swords]] <b>连弩</b>：释放了手牌中 ${released} 张「${relM[1]}」`, 'ok'); did = true; }
    }
    // ============ 2026-09-09 机制审计补实装（Q1-Q8 老板定向批次） ============
    // —— 抽牌直到有 N 张手牌（法力补给）——
    const untilM = desc.match(/抽牌[^。；]*?直到[有满]\s*(\d+)\s*张手牌/);
    if (untilM && !did) {
      const want = +untilM[1];
      let gotN = 0;
      if (getMode() === 'boss') {
        let guard = 0;
        while (getHandSize() < want && guard++ < 30) {
          const g = drawCards(1);
          if (!g) break;
          gotN += g;
        }
        log(`[[icon:cards]] <b>${esc(card.name)}</b>：抽了 ${gotN} 张牌（手牌 ${getHandSize()} 张）`, 'sys');
      } else {
        const lack = Math.max(0, want - getHandSize());
        grantStarterAttack(lack);
        log(`[[icon:cards]] <b>${esc(card.name)}</b>：获得 ${lack} 张【初始攻击】（普通战斗抽牌效果改为获得初始攻击）`, 'sys');
      }
      did = true;
    }
    // —— 夺取敌人攻击力（禁咒I「抽到时施放」）——
    const seizeM = desc.match(/夺取\s*(?:一名|1\s*名)?\s*敌人的?\s*(\d+)\s*点?攻击力/);
    if (seizeM && !did) {
      const t = curseTarget;
      if (t && !t.dead) {
        const n = +seizeM[1];
        t.atk = Math.max(0, (t.atk || 0) - n);
        combat.addBlessing(pstat, 'atkUp', n);
        log(`[[icon:arrow]] <b>夺取攻击</b>：${esc(t.name)} 攻击力 -${n}，你的攻击力 +${n}`, 'sys');
        did = true;
      }
    }
    // —— 对全体敌人造成等同于（抽到卡牌）价格的固定伤害（气功波，Q7 老板定向：抽 1 打 1）——
    // 注意不判 did：同一句里的「抽 1 张牌」会先置 did，价格伤害是同一效果的后续部分
    if (/造成等同于(?:其|该卡|该牌)价格的固定伤害/.test(desc)) {
      const price = typeof getPriceOfLastDrawn === 'function' ? getPriceOfLastDrawn() : 0;
      if (price > 0 && typeof dealAoeFixed === 'function') {
        dealAoeFixed(price);
        log(`[[icon:play]] <b>${esc(card.name)}</b>：对全体敌人造成 <b>${price}</b> 点固定伤害（按抽到卡牌的价格）`, 'sys');
      } else {
        log(`[[icon:question]] 没有抽到可折算价格的卡牌（占位）`, 'dim');
      }
      did = true;
    }
    // —— 回合开始时本牌伤害 +N（充能火球）：注册成长卡名，回合流转按 uid 累积 ——
    if (/回合开始时[，,]?\s*本牌伤害\s*\+\s*\d+/.test(desc) && !did) {
      if (typeof registerGrowthCard === 'function') registerGrowthCard(card);
      log(`[[icon:fire]] <b>${esc(card.name)}</b>：每经过 1 回合，本牌伤害 +1`, 'sys');
      did = true;
    }
    // —— 对战开始时将 N 张杀替换为随机卡牌（迷之匣，开战被动调用）——
    const repSha = desc.match(/将\s*(\d+)\s*张(?:杀|初始攻击)替换为随机卡牌/);
    if (repSha && typeof replaceShaInDeck === 'function') {
      const n = replaceShaInDeck(+repSha[1]);
      log(`[[icon:recycle]] <b>${esc(card.name)}</b>：已将牌库中 ${n} 张「杀」替换为随机卡牌`, 'sys');
      did = true;
    }
    // —— 牌库上限 +N（混沌之眼）：BOSS 编组上限按持有计算，这里仅识别 ——
    const capM = desc.match(/牌库上限\s*\+\s*(\d+)/);
    if (capM) {
      log(`[[icon:cards]] 牌库上限 +${capM[1]}（BOSS 编组时生效）`, 'sys');
      did = true;
    }
    // —— 召唤随从（征召：步兵（4-4）×2 为你抵挡伤害并自动战斗）——
    const smM = desc.match(/召唤\s*([^\s（(，。；;、]+?)\s*[（(]\s*(\d+)\s*[-－]\s*(\d+)\s*[）)]\s*(?:[×xX]\s*(\d+))?/);
    if (smM && typeof summonAlly === 'function') {
      const n = smM[4] ? +smM[4] : 1;
      summonAlly(smM[1], +smM[2], +smM[3], n);
      log(`[[icon:runner]] <b>${esc(card.name)}</b>：召唤 ${esc(smM[1])}（${smM[2]}-${smM[3]}）×${n} ——优先替你承受伤害并自动战斗`, 'loot');
      did = true;
    }
    // —— 获得 1 个额外回合（命运钟表）：下回合跳过敌方阶段（不判 did：同句「消耗所有手牌」先行置位）——
    if (/获得\s*1\s*个额外回合/.test(desc) && typeof setExtraTurn === 'function') {
      setExtraTurn(true);
      log(`[[icon:hourglass]] <b>${esc(card.name)}</b>：获得 1 个额外回合（敌人不会行动）`, 'ok');
      did = true;
    }
    // —— 法师锦囊容器：置入 3 张法术，打出时选 1 张直接施放（Q5 老板定向）——
    if (/自带\s*1\s*[*×]\s*3\s*空间|可以置入\s*3\s*张法术牌/.test(desc) && !did &&
        typeof queuePouchCast === 'function' && flags.uid) {
      queuePouchCast(flags.uid);
      did = true;
    }
    // —— 珍珠盒：被动扩容在背包容量侧（game.session bagCap）结算，打出时仅识别 ——
    if (/内置\s*3\s*[*×]\s*3\s*空间|容纳所有.{0,6}资源卡牌/.test(desc) && !did) {
      log(`[[icon:plate]] <b>珍珠盒</b>：持有即扩容背包 9 格（扩格仅收资源卡），无需打出`, 'sys');
      did = true;
    }
    // —— 自然法杖：选择 1 张卡牌，下回合将其变为 0 费（Q5 手选 zero 动作）——
    if (/选择\s*(?:1|一)\s*张卡牌[^。]*?下回合将其变为\s*0\s*费/.test(desc) && !did && typeof queueHandSelect === 'function') {
      queueHandSelect({ n: 1, type: null, act: 'zero' });
      log(`[[icon:bolt]] <b>${esc(card.name)}</b>：选择 1 张卡牌，下回合它将变为 0 费`, 'sys');
      did = true;
    }
    // —— 千变万化：「发现一种形态并释放」（「种」计数量 + 形态池 + 直接施放）——
    const morphDisc = desc.match(/发现\s*(?:一|1)\s*种(形态)并(?:直接)?释放/);
    if (morphDisc && !did) {
      queueDiscover({ n: 1, pred: parsePoolNoun(morphDisc[1], myClass), act: 'play' });
      log(`[[icon:question]] <b>${esc(card.name)}</b>：发现一种【形态】并直接施放`, 'sys');
      did = true;
    }
    // —— 立即释放一次「杀」（百炼青虹剑，消耗该牌时触发）——
    const oneSha = desc.match(/立即释放(?:一次|1\s*次)?[‘'“]?杀/);
    if (oneSha && !did && !/该牌时/.test(desc) && typeof releaseHandMatches === 'function') {
      const released = releaseHandMatches('杀', 0, 1);
      log(released
        ? `[[icon:swords]] <b>${esc(card.name)}</b>：立即释放了 1 次「初始攻击」`
        : `[[icon:cross]] 手牌中没有「杀」可释放`, released ? 'ok' : 'dim');
      did = true;
    }

    // —— 识别补丁（2026-09-08，批次 3 起改为查注册表）——
    // 以下句式由出牌结算段 / 战斗规则层 / 背包实装（见 effect-verbs.js 的 ELSEWHERE），
    // 文本执行器只标记「已识别」，避免误报「占位」与审计假阳性；句式清单已从本函数
    // 迁到注册表，加新句式改表不改这里。
    if (!did && matchElsewhere(desc, { structuredHit: !!flags.structuredHit, infusedLead: !!infLead }).length) {
      did = true;
    }

    const em = desc.match(/(?:获得|回复)\s*(\d+)\s*点?能量/);
    if (em && !/该牌时/.test(desc)) {
      const current = addEnergy(+em[1]);
      log(`[[icon:bolt]] 获得 ${em[1]} 点能量（当前 ${current}）`, 'sys');
      did = true;
    }
    const cm = desc.match(/能量上限\s*\+\s*(\d+)/);
    if (cm) {
      const currentMax = addEnergyCap(+cm[1]);
      log(`[[icon:bolt]] 本场战斗能量上限 +${cm[1]}（每回合 ${currentMax} 费）`, 'sys');
      did = true;
    }
    // —— 未识别子句哨兵（批次 3）：牌面像有效果、却既没结算也没被任何层认领 ——
    // 记为「牌面写了效果但打出去没反应」，供实机试玩与自定义卡排查（同句只记一次）。
    const result = { did, drawn, healed, armored };
    if (!did && !drawn && !healed && !armored) noteUnknownEffect(card, desc);
    return result;
  };
}

// 「消耗该牌时」触发句提取（沉船宝盒/百炼青虹剑/矿工炸药/奥术残卷）：
// 由 battle.core 在两类消耗时点（注能牺牲 / 手选消耗）调用，剥离前缀后走常规结算
function consumeTriggerTexts(description) {
  const out = [];
  String(description || '').split(/[。；;\n]/).forEach(s => {
    const m = s.trim().match(/^消耗该牌时[：:，,]?\s*(.+)$/);
    if (m) out.push(m[1]);
  });
  return out;
}

export { createEffectExecutor, splitEffectClauses, parsePoolNoun, consumeTriggerTexts };

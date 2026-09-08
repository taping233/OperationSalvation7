/* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const SDT = window.SDT;
import { esc } from './shared.js';
import { escAttr } from './shared.js';
import { createEffectExecutor, splitEffectClauses } from './battle.effects.js';
import { refillDrawPile, shuffleCards } from './battle.deck.js';
import { removeUid } from './battle.piles.js';
import { isAreaEffect, targetSideFor, unplayableReasonFor } from './battle.rules.js';
import { createActionQueue } from './battle.actions.js';
import { BATTLE_PHASES, beginTargeting, cancelTargeting, createBattleState, transitionBattle } from './battle.state.js';
import { Random } from './random.js';
import * as Combat from './combat.js';
/* battle.core.js —— 战斗逻辑：牌库/出牌结算/词条时点/回合流转（渲染由注入的视图完成） */
/* ============================================================
 * 搜打撤 v0.24 —— M1 两类战斗（多敌人 + 拖拽选目标 + BOSS 词缀 + 词条时点体系）
 *
 * 【普通战斗（小怪/遭遇战）】无需抽牌：
 *   随身全部可用卡（含道具卡）直接作为手牌，打出的卡本场不可再用；
 *   每回合固定 2 费（rules.battleEnergy）；
 * ============================================================ */
  // Combat 已改为 ESM 直接导入；SDT.Cards / SDT.MAP 仍走兼容门面（待后续收敛）

  let renderBattle = () => {};
  const actionQueue = createActionQueue();
  let battleState = createBattleState();
  function configureBattleRenderer(renderer) {
    renderBattle = typeof renderer === 'function' ? renderer : () => {};
  }
  const requestBattleRender = () => {
    renderBattle(getSnapshot());
  };

  let G = null;
  let foes = [];         // 敌人数组 [{id,name,hp,maxHp,atk,affix,affixName,dead,status,defense}]
  let opts = null;       // { isBoss, layer, returnTo, name }
  let mode = 'normal';
  let drawPile = [], hand = [], discard = [], granted = [];
  let played = [], consumed = [];
  let grave = [];            // 墓地（v0.25）：被消耗的牌（注能牺牲品等）；不参与洗回
  let energy = 0, maxEnergy = 0, turn = 1;
  let pdef = null, pstat = null;
  let busy = false;
  let infusing = null, discovering = null, discoverQueue = [];
  let handSelecting = null;              // 手牌选卡（2026-09-06 #24/#25）：{n,type,act,thenText}
  const handSelectQueue = [];
  let choosing = null;                   // 抉择面板（2026-09-08 人工 N 选一）：{cardName, options:[text]}
  const choiceQueue = [];
  let stealthStrike = false;             // 「破隐一击伤害翻倍」战斗规则（白梅落影·妄）
  let nextSpellTwice = 0;                // 「下一张法术施放 N 次」（元素风暴）
  let pendingTarget = null;  // 已锁定待拖拽的出牌 {uid, card}（必须拖到目标身上）
  let pendingHint = '';      // 拖拽提示（拖错目标时给出纠正文案）
  let delayed = [];          // 「回合开始时」延迟效果 [{text, cardName, repeat}]（repeat=装备每回合触发）
  let noDrawNext = false;    // 「下回合无法抽牌」标记（下个回合开始消耗掉）
  let viewingGrave = false;  // 正在查看墓地（BOSS 战专属：消耗过的牌 + 类型统计）
  let floats = [];           // 待展示的飘字/受击特效 [{unit:'self'|敌人idx, text, cls}]（渲染后由视图消费）
  const KILL_CHEER = ['👍', '✌️', '✨'];   // 击杀后自己头上的随机欢呼贴纸
  let dreadShown = false;    // BOSS 登场竖线阴影每场只演一次
  let spellCost1 = false;    // 「本局对战内所有法术 1 费」（银河之旅，战斗内永久）
  let meleeCost1 = false;    // 「本局对战内所有招式 1 费」（银河之旅 2026-09-08 描述改版，招式=武术）
  let shaTransform = null;   // 「'杀'化为X」战斗规则（不朽神剑/青龙偃月斩，打出初始攻击时替换）
  let consumeFireballN = 0;  // 「每消耗 1 张卡牌施放 N 次火球」（深渊降焰，降临者英雄）
  let lastDrawnUids = [];    // 最近一次抽牌进手的 uid（万剑归宗「直接释放其中武术」用）
  let lastPlayedType = null; // 上一张打出的卡牌类型（连击箭「上一张是武术→0费」）
  let selPool = [], selShaN = 0, sel = new Set(), lastDeckSel = [], selectingDeck = false;

  const R = () => SDT.MAP.rules;
  const alive = () => foes.filter(f => !f.dead);
  const AFFIX_META = {
    grow:   { icon: '[[icon:arrow]]', name: '军威',     desc: '每个回合结束时攻击力 +2' },
    frenzy: { icon: '[[icon:tools]]', name: '狂乱',     desc: '每回合攻击两次，每次附加 1 层流血或中毒' },
    aegis:  { icon: '[[icon:crystal]]', name: '元素庇幕', desc: '偶数回合减免所有伤害（破甲可克制）' },
  };
  const INTENT_META = {
    strike: ['[[icon:swords]]', '攻击'], volley: ['[[icon:swords]]', '远程攻击'], charge: ['[[icon:fire]]', '蓄力攻击'],
    guard: ['[[icon:shield]]', '防御/反击'], burn: ['[[icon:fire]]', '攻击并灼烧'], curse: ['[[icon:skull]]', '攻击并施加诅咒'],
    dragon: ['[[icon:demon]]', '重击/特殊'], general: ['[[icon:arrow]]', '军威强化'], orc_boss: ['[[icon:tools]]', '双击+诅咒'], element_boss: ['[[icon:crystal]]', '元素庇幕'],
  };
  function intentFor(def, round) {
    const kind = def.behavior || (def.affix === 'grow' ? 'general' : def.affix === 'frenzy' ? 'orc_boss' : def.affix === 'aegis' ? 'element_boss' : 'strike');
    const meta = INTENT_META[kind] || INTENT_META.strike;
    // 同一敌人的预告轮转，结算规则仍沿用现有反击/词缀引擎。
    const suffix = kind === 'guard' && round % 2 ? '（蓄势）' : kind === 'charge' && round % 2 === 0 ? '（本回合强化）' : '';
    return { kind, icon: meta[0], label: meta[1] + suffix, damage: Math.max(0, def.atk || 0) };
  }

  const shuffle = shuffleCards;

  function pileTip(uids) {
    const cnt = {};
    uids.forEach(uid => { const o = findCard(uid); if (o) cnt[o.card.name] = (cnt[o.card.name] || 0) + 1; });
    return Object.keys(cnt).map(n => `${n}×${cnt[n]}`).join('，') || '（空）';
  }

  function drawCards(n) {
    let got = 0;
    lastDrawnUids = [];
    while (n-- > 0) {
      if (!drawPile.length && discard.length) {
        const recycled = refillDrawPile(drawPile, discard);
        G.log(`[[icon:recycle]] 弃牌堆 ${recycled} 张洗回牌库（墓地不参与洗回）`, 'dim');
      }
      if (!drawPile.length) break;
      if (hand.length >= R().battleHandMax) break;
      const uid = drawPile.pop();
      const entry = findCard(uid);
      const parts = entry ? splitClauses(String(entry.card.desc || '')) : null;
      // 「抽到时施放」衍生牌（禁咒/天启剑系）：抽到即结算，不占手牌
      if (parts && parts.onDraw.length) {
        discard.push(uid);
        parts.onDraw.forEach(text => {
          G.log(`[[icon:flask]] <b>抽到时施放</b>：【${esc(entry.card.name)}】${esc(text)}`, 'sys');
          applyTextEffects(entry.card, text, alive()[0] || null);
        });
        got++;
        sweepDead();
        if (!alive().length) break;
        continue;
      }
      hand.push(uid);
      lastDrawnUids.push(uid);
      got++;
    }
    return got;
  }

  // 文本效果击杀后的死亡补扫（描述直伤/偷攻等不经过 hitFoe 的路径）
  function sweepDead() {
    foes.forEach(f => {
      if (!f.dead && f.hp <= 0) {
        f.dead = true;
        G.log(`[[icon:skull]] <b>${esc(f.name)}</b> 被击倒！（剩 ${alive().length} 个敌人）`, 'ok');
        floats.push({ unit: foeIdx(f), text: '💥', cls: 'stk' });
        floats.push({ unit: 'self', text: KILL_CHEER[Math.floor(Random.random('battle') * KILL_CHEER.length)], cls: 'stk stk-late' });
      }
    });
  }

  let tmpSeq = 0;
  function addTempCard(tpl) {
    const uid = 'bts' + Date.now().toString(36) + (tmpSeq++);
    granted.push({ uid, card: { ...tpl } });
    hand.push(uid);
    return uid;
  }
  // 创造一张牌直接插入牌库（「将 x 洗入牌库」用；不进手牌，战后随临时卡消散）
  function addDeckCard(tpl) {
    const uid = 'btd' + Date.now().toString(36) + (tmpSeq++);
    granted.push({ uid, card: { ...tpl } });
    drawPile.push(uid);
    return uid;
  }
  function grantSha(n) {
    const lib = (typeof SDT.Cards.all === 'function' ? SDT.Cards.all() : []);
    // 「杀化为X」战斗规则生效时，发放的初始攻击同样以目标卡形态出现
    const base = (shaTransform && lib.find(c => c.name === shaTransform)) ||
      lib.find(c => c.id === SDT.Cards.SHA.id) || SDT.Cards.SHA;
    for (let i = 0; i < n; i++) addTempCard(base);
  }

  // —— 从牌库抽取 N 张指定类型的牌（武装）；普通战斗没有牌库 → 直接改发临时卡 ——
  function deckDraw({ n, type }) {
    let moved = 0;
    if (mode === 'boss') {
      const rest = [];
      while (drawPile.length && moved < n) {
        const uid = drawPile.pop();
        const o = findCard(uid);
        if (o && o.card.type === type && hand.length < R().battleHandMax) { hand.push(uid); moved++; lastDrawnUids.push(uid); }
        else rest.push(uid);
      }
      drawPile.push(...rest);
    }
    while (moved < n) {
      const pool = SDT.Cards.all().filter(c => c.type === type && c.rarity !== '衍生' && !['生物', '事件'].includes(c.type));
      if (!pool.length) break;
      addTempCard(pool[Math.floor(Random.random('battle') * pool.length)]);
      moved++;
    }
    if (moved) G.log(`[[icon:cards]] ${mode === 'boss' ? '从牌库' : '（普通战斗无牌库，改为直接获得）'}抽取 ${moved} 张【${esc(type)}】牌`, 'sys');
    return moved;
  }

  // —— 释放手牌中所有匹配「箭/杀/火球」的卡（连弩）；每释放 drawEach 张抽牌 ——
  function releaseHandMatches(key, drawEach) {
    const re = key === '杀' ? /^(杀|初始攻击)$/ : new RegExp(key);
    let released = 0;
    for (const uid of hand.slice()) {
      if (!alive().length) break;
      const o = findCard(uid);
      if (!o || o.card.type === '生物' || !re.test(o.card.name || '')) continue;
      queueCardExecution(uid, o.card, [], alive()[0] || null, true);
      released++;
      if (drawEach) drawCards(drawEach);
    }
    return released;
  }

  // —— 自动释放刚抽到的指定类型手牌（万剑归宗：直接释放其中武术）——
  function autoPlayHandType(type) {
    let played = 0;
    for (const uid of lastDrawnUids.slice()) {
      if (!alive().length) break;
      if (!hand.includes(uid)) continue;
      const o = findCard(uid);
      if (!o || o.card.type !== type) continue;
      queueCardExecution(uid, o.card, [], alive()[0] || null, true);
      played++;
    }
    return played;
  }

  const applyTextEffects = createEffectExecutor({
    combat: Combat,
    getAlive: alive,
    getPlayerStatus: () => pstat,
    getPlayerDefense: () => pdef,
    getMode: () => mode,
    log: (message, kind) => G.log(message, kind),
    escapeHtml: esc,
    heal: amount => G.heal(amount),
    pushFloat: value => floats.push(value),
    drawCards,
    grantStarterAttack: grantSha,
    markNoDrawNext: () => { noDrawNext = true; },
    queueDiscover: value => discoverQueue.push(value),
    randomDiscoverCard,
    addTempCard,
    addDeckCard,
    queueHandSelect: job => { handSelectQueue.push(job); processHandSelect(); },
    restoreConsumed: n => restoreConsumed(n),
    random01: () => Random.random('battle'),
    allCards: () => SDT.Cards.all(),
    // —— 抉择面板（2026-09-08 人工 N 选一）：选项入队并弹出面板 ——
    queueChoice: job => { choiceQueue.push(job); processChoice(); },
    setStealthStrike: v => { stealthStrike = !!v; },
    setNextSpellTwice: n => { nextSpellTwice = n || 0; },
    shuffleDeck: () => { drawPile = shuffle(drawPile); return drawPile.length; },
    addEnergy: amount => { energy += amount; return energy; },
    addEnergyCap: amount => { maxEnergy += amount; energy += amount; return maxEnergy; },
    // —— 2026-09-08 补线：以下端口此前从未传入，相关描述一打就崩 ——
    getPlayerHp: () => G.hp,
    getHandSize: () => hand.length,
    getHandCards: () => hand.map(findCard).filter(Boolean),
    burstPoison: t => Combat.tickPoison(t),
    deckDraw,
    fleeBattle: () => flee(),
    getPlayerClass: () => G.myClass || null,
    getPlayerCaster: () => ({
      atk: G.atk,
      spellPower: (G.spellPower || 0) + ((pstat && pstat.status.spellUp) || 0),
    }),
    foeIndexOf: t => foes.indexOf(t),
    releaseHandMatches,
    autoPlayHandType,
    setShaTransform: name => { shaTransform = name || null; },
    setConsumeFireball: n => { consumeFireballN = n || 0; },
    damagePlayer: n => {
      G.hp = Math.max(0, G.hp - n);
      floats.push({ unit: 'self', text: '-' + n, cls: 'hurt' });
      G.log(`[[icon:blood]] 受到 <b>${n}</b> 点伤害（${G.hp}/${G.maxHp}）`, 'warn');
    },
    addPlayerMaxHp: n => {
      G.maxHp += n;
      G.heal(n);
      G.log(`[[icon:heart]] 血量上限 +${n}（当前上限 ${G.maxHp}，并回复 ${n} 点）`, 'ok');
    },
    dumpHand: () => {
      const uids = hand.slice();
      hand = [];
      uids.forEach(u => {
        consumed.push(u);
        if (mode === 'boss') grave.push(u);
      });
      return uids.length;
    },
  });

  const findCard = (uid) =>
    G.ownedCards.find(o => o.uid === uid) || granted.find(o => o.uid === uid) || null;
  const drawOf = (card) => +(card.draw || 0) || SDT.Cards.deriveDraw(card) || 0;
  const infuseOf = (card) => card._noInfuse ? 0 : (+(card.infuse || 0) || SDT.Cards.deriveInfuse(card) || 0);

  // 实际费用：宇宙形态下所有卡牌变为 1 费；「本局对战内所有法术/招式 1 费」（银河之旅）
  // 各自只对法术/武术（招式）生效——两者都是战斗内永久效果（本局对战内词条）
  const effCostOf = (card) => {
    if (pstat && pstat.status.cosmosForm > 0) return 1;
    if (spellCost1 && card.type === '法术') return 1;
    if (meleeCost1 && card.type === '武术') return 1;
    const d = String(card.desc || '');
    if (/上一张牌是武术/.test(d) && lastPlayedType === '武术') return 0;
    if (/护甲为\s*0[.。，,]?\s*本牌变为\s*0\s*费/.test(d) && pdef && (pdef.armor || 0) === 0) return 0;
    return card.cost;
  };

  // 群体伤害判定（设计者：群体伤害不用选目标）
  const isAOE = isAreaEffect;

  // ---------- 生效时刻 / 持续时间 / 生效条件（设计者 2026-09-02 定版） ----------
  // 卡牌描述按句切分（。；；换行），每句归入一种生效方式：
  //   「回合开始时：X / 下回合开始：X」 → 生效时刻词条：X 延迟到下个回合开始结算
  //     （装备卡是战斗内持续物件，其延迟段每回合开始重复触发；其余一次性）
  //   「本局对战内 / 本场战斗(中)…」   → 持续时间词条：整场战斗有效，离开战斗失效
  //   「被注能时：X」                  → 生效条件词条：只有作为注能牺牲品被消耗时
  //     才结算 X（打出时跳过——牺牲品没有被「使用」，主效果不触发）；未来会有更多条件
  //   其余句子 → 立即生效
  const splitClauses = splitEffectClauses;

  // 注册「回合开始时」延迟段（repeat = 装备卡或「每回合开始时」，每回合开始重复触发）
  function registerTurnStart(card, items) {
    items.forEach(it => {
      const repeat = card.type === '装备' || it.each;
      delayed.push({ text: it.text, cardName: card.name, repeat });
      G.log(`[[icon:hourglass]] <b>回合开始时</b>：【${esc(card.name)}】${esc(it.text)}（下个回合开始${repeat ? '起每回合' : ''}生效）`, 'sys');
    });
  }

  // 回合开始：结算延迟段（沉默中技能无效——一次性段被吞掉，重复段保留到下回合）
  function processDelayed() {
    if (!delayed.length) return;
    const silenced = (pstat.status.silence || 0) > 0;
    const keep = [];
    delayed.forEach(q => {
      if (silenced) {
        G.log(`[[icon:cross]] 沉默中：【${esc(q.cardName)}】的回合开始效果无法生效`, 'warn');
      } else {
        G.log(`[[icon:hourglass]] <b>回合开始时</b>：【${esc(q.cardName)}】${esc(q.text)}`, 'sys');
        applyTextEffects({ name: q.cardName }, q.text, alive()[0] || null);
      }
      if (q.repeat) keep.push(q);
    });
    delayed = keep;
  }

  // 「本局对战内」持续效果：注册并结算其中已支持的部分（增益本身即战斗内长期有效）
  function registerBattle(card, clause, target) {
    G.log(`[[icon:question]] <b>本局对战内</b>：${esc(clause)}（整场战斗有效，离开战斗失效）`, 'ok');
    const inner = clause.replace(/^(本局对战内|本场对战|本场战斗)[中内]?[：:，,]?\s*/, '');
    if (/所有(?:法术|招式)[^。]*?1\s*费/.test(inner)) {
      if (/所有招式/.test(inner)) {
        meleeCost1 = true;
        G.log('[[icon:sparkles]] 持续规则：你的所有招式（武术）均按 <b>1</b> 费打出', 'ok');
      } else {
        spellCost1 = true;
        G.log('[[icon:sparkles]] 持续规则：你的所有法术均按 <b>1</b> 费打出', 'ok');
      }
    }
    return applyTextEffects(card, inner, target).did;
  }

  // 「被注能时」条件效果：作为注能牺牲品被消耗时触发（未被使用，主效果不结算）
  function resolveInfusedFuel(card, target) {
    const parts = splitClauses(card.desc);
    if (!parts.onInfused.length) return false;
    if ((pstat.status.silence || 0) > 0) {
      G.log(`[[icon:cross]] 沉默中：【${esc(card.name)}】的被注能效果无法生效`, 'warn');
      return true;
    }
    parts.onInfused.forEach(text => {
      G.log(`[[icon:flask]] <b>被注能时</b>：【${esc(card.name)}】${esc(text)}`, 'sys');
      applyTextEffects(card, text, target);
    });
    return true;
  }

  // 出牌结算（目标：单点卡 = target；群体卡 = 所有存活敌人；infused = 作为注能主卡打出；
  // fuelCost = 注能牺牲品费用合计，供「N 倍于被注能卡牌价格」类效果折算）
  function resolveCard(card, target, infused, fuelCost) {
    const desc = String(card.desc || '');
    const parts = splitClauses(desc);
    let did = false;
    const isDmgType = SDT.Cards.DMG_TYPES.includes(card.type);
    let structuredHit = false;
    // —— 伤害（卡面伤害词条立即结算，不受沉默影响） ——
    if (isDmgType && ((+card.dmg || 0) > 0 || card.dmgType === 'attack')) {
      structuredHit = true;
      const type = SDT.Cards.DMG_TYPE_META[card.dmgType] ? card.dmgType : Combat.TYPES.FIXED;
      let dmgVal = +card.dmg || 0;
      const tm = desc.match(/(?:攻击|命中)\s*(\d+)\s*次/) || desc.match(/(\d+)\s*段/);
      let times = tm ? Math.max(1, +tm[1]) : 1;
      if (!tm) {
        // 「触发 N 次」（流星箭雨）；带「注能(…)」前缀的触发次数只在注能打出时生效（血蝠风暴）
        const tg = desc.match(/触发\s*(\d+)\s*次/);
        if (tg && !/注能\s*[（(][^）)]*[）)][^。]*?触发/.test(desc)) times = Math.max(1, +tg[1]);
      }
      // 墓地增伤（雷殛：墓地中每有 1 张法术牌，伤害 +1；普通战斗无墓地不生效）
      const graveM = desc.match(/墓地中每有\s*1\s*张(武术|法术|装备|道具|资源)牌[^。；]*?伤害\s*\+\s*(\d+)/);
      if (graveM && mode === 'boss') {
        const cnt = grave.filter(u => { const o = findCard(u); return o && o.card.type === graveM[1]; }).length;
        if (cnt > 0) {
          dmgVal += cnt * +graveM[2];
          G.log(`[[icon:recycle]] 墓地增伤：墓地中有 ${cnt} 张【${esc(graveM[1])}】牌，伤害 +${cnt * +graveM[2]}`, 'sys');
        }
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
      const targets = isAOE(card) ? alive() : [target || alive()[0]].filter(Boolean);
      if (!targets.length) return;
      let dealtTotal = 0;
      for (let i = 0; i < times; i++) {
        targets.forEach(foe => {
          if (!foe.dead) {
            if (hpCap > 0 && foe.hp > hpCap) {
              if (i === 0) G.log(`[[icon:cross]] <b>${esc(foe.name)}</b> 血量高于 ${hpCap}：${esc(card.name)} 无效`, 'warn');
              return;
            }
            let foeDmg = dmgVal;
            if (halfB && foe.maxHp && foe.hp <= foe.maxHp / 2) {
              foeDmg = Math.floor(foeDmg * (1 + +halfB[1] / 100));
              if (i === 0) G.log(`[[icon:arrow]] <b>${esc(foe.name)}</b> 血量过半，伤害增加 ${halfB[1]}%（→ ${foeDmg}）`, 'sys');
            }
            dealtTotal += hitFoe(foe, card, foeDmg, type, times > 1 ? `（第 ${i + 1} 段）` : '');
          }
        });
      }
      // 吸血：回复等量生命（嗜血刃/噬血术/血蝠风暴）
      if (/回复等量生命/.test(desc) && dealtTotal > 0) {
        if ((pstat.status.healban || 0) > 0) {
          G.log(`[[icon:heart]] 禁疗中：吸血回复无效（还剩 ${pstat.status.healban} 回合）`, 'warn');
        } else {
          G.heal(dealtTotal);
          floats.push({ unit: 'self', text: '💚', cls: 'stk', warm: true });
          G.log(`[[icon:heart]] 吸血：回复 ${dealtTotal} 点生命`, 'ok');
        }
      }
      // 条件额外施放（暗影射击：对手处于诅咒状态，额外施放 1 次）
      const sm = desc.match(/若[^。]*?诅咒[^。]*?额外施放\s*(\d+)\s*次/);
      if (sm) {
        const t0 = targets.find(t => !t.dead);
        if (t0 && Combat.hasCurse(t0)) {
          for (let k = 0; k < +sm[1]; k++) hitFoe(t0, card, dmgVal, type, '（额外施放）');
          G.log(`[[icon:play]] 对手身负诅咒：【${esc(card.name)}】额外施放 ${sm[1]} 次`, 'sys');
        }
      }
      did = true;
    }
    // 沉默：除攻击外的技能效果全部失效（延迟段与持续段也不注册）
    if ((pstat.status.silence || 0) > 0) {
      G.log(`[[icon:cross]] <b>${esc(card.name)}</b> 的技能效果被沉默封印（只剩攻击生效，持续 ${pstat.status.silence} 回合）`, 'warn');
      return;
    }
    // —— 立即生效句 ——
    const res = applyTextEffects(card, parts.immediate.join('，'), target, { structuredHit, infused, fuelCost });
    did = did || res.did;
    // 结构化词条兜底（描述未写明但制作坊标注了回复/护甲/抽卡字段时）
    if (!res.healed && +(card.heal || 0) > 0) {
      const n = +(card.heal || 0);
      if ((pstat.status.healban || 0) > 0) {
        G.log(`[[icon:heart]] 禁疗中：回复 ${n} 点生命无效（还剩 ${pstat.status.healban} 回合）`, 'warn');
      } else { G.heal(n); floats.push({ unit: 'self', text: '💚', cls: 'stk', warm: true }); }
      did = true;
    }
    if (!res.armored && +(card.armor || 0) > 0) {
      pdef.armor += +(card.armor || 0);
      G.log(`[[icon:plate]]获得 ${+(card.armor || 0)} 点护甲`, 'sys');
      did = true;
    }
    // 卡面结构化抽卡字段兜底（描述未写「抽 N 张牌」时）
    if (!res.drawn && drawOf(card) > 0) {
      const n = drawOf(card);
      if (mode === 'boss') {
        const got = drawCards(n);
        G.log(`[[icon:cards]] <b>${esc(card.name)}</b>：抽了 ${got} 张牌`, 'sys');
      } else {
        grantSha(n);
        G.log(`[[icon:cards]] <b>${esc(card.name)}</b>：获得 ${n} 张【初始攻击】（普通战斗抽牌效果改为获得初始攻击）`, 'sys');
      }
      did = true;
    }
    // —— 「回合开始时」生效时刻词条 ——
    if (parts.turnStart.length) { registerTurnStart(card, parts.turnStart); did = true; }
    // —— 「本局对战内」持续时间词条 ——
    parts.battle.forEach(cl => { did = registerBattle(card, cl, target) || did; });
    // 「被注能时」句在打出时不结算（splitClauses 已剥出，留给 resolveInfusedFuel）
    if (!did) G.log(`[[icon:play]] <b>${esc(card.name)}</b>：该效果在 M1 后续实装（占位）`, 'dim');
  }

  // ---------- 入口 ----------
  // enemyDefs：数组（多敌人遭遇）或单个对象（兼容旧调用）
  function start(game, enemyDefs, options) {
    G = game;
    G.battleActive = true;   // game.js 用它锁住侧栏/快捷键背包入口
    if (SDT.Sound) SDT.Sound.setDucked(true);   // 战斗期间 BGM 侧链压低（audio-design ducking）
    opts = Object.assign({ isBoss: false }, options || {});
    mode = opts.isBoss ? 'boss' : 'normal';
    battleState = createBattleState({ mode });
    const defs = Array.isArray(enemyDefs) ? enemyDefs : [enemyDefs];
    foes = defs.map(d => {
      const f = {
        id: d.id || null, name: d.name, hp: d.hp, maxHp: d.hp,
        atk: d.atk || 2, affix: d.affix || null, affixName: d.affixName || null, behavior: d.behavior || null, dead: false,
        status: {}, defense: { shield: 0, armor: 0, guard: false },
      };
      f.intent = intentFor(f, 1);
      Combat.ensureStatus(f);
      return f;
    });
    pendingTarget = null;
    SDT.Sound.music('battle');   // 切入战斗氛围
    G.state = 'modal';
    const names = foes.map(f => `${f.name}(${f.atk}-${f.hp})`).join('、');
    G.log(`[[icon:swords]] <b>${opts.isBoss ? 'BOSS战' : '遭遇战'}【${esc(names)}】</b>${!opts.isBoss && opts.risk ? ` · 风险<b>${esc(opts.risk)}</b>` : ''}`, 'warn');
    if (mode === 'boss') prepareDeckSelection();
    else beginNormal();
  }

  function beginNormal() {
    drawPile = []; discard = []; granted = []; played = []; consumed = []; grave = [];
    // 道具/资源/事件/生物卡默认不进手牌（v0.32：手牌只放可直接打出的战斗卡）
    hand = G.ownedCards.filter(o => !['道具', '资源', '事件', '生物'].includes(o.card.type)).map(o => o.uid);
    maxEnergy = R().battleEnergy;
    energy = maxEnergy;
    turn = 1; busy = false;
    pdef = { shield: 0, armor: 0, guard: false };
    pstat = Combat.ensureStatus({ hp: G.hp });
    infusing = null; discovering = null; discoverQueue = []; handSelecting = null; handSelectQueue.length = 0; pendingTarget = null; floats = [];
    choosing = null; choiceQueue.length = 0; stealthStrike = false; nextSpellTwice = 0;
    delayed = []; noDrawNext = false; spellCost1 = false; meleeCost1 = false;
    shaTransform = null; consumeFireballN = 0; lastDrawnUids = []; lastPlayedType = null;
    viewingGrave = false; dreadShown = false; selectingDeck = false;
    battleState = transitionBattle(battleState, BATTLE_PHASES.PLAYER);
    G.state = 'modal';
    if (alive().length > 1) G.log(`[[icon:question]] 以一敌多：伤害类卡牌需<b>拖到目标身上</b>打出；群体伤害直接点击生效`, 'sys');
    G.log(`[[icon:cards]] 普通战斗无需抽牌：随身 <b>${hand.length}</b> 张战斗卡直接可打出（道具/资源/事件卡不在手牌中） · 每回合固定 <b>${maxEnergy}</b> 费`, 'sys');
    requestBattleRender();
  }

  // ---------- BOSS战：编组牌库 ----------
  function prepareDeckSelection() {
    const need = R().bossDeckSize;
    selPool = G.ownedCards.filter(o => !['道具', '资源', '事件', '生物'].includes(o.card.type) && o.card.name !== '初始攻击');
    const shas = G.ownedCards.filter(o => o.card.name === '初始攻击');
    selShaN = Math.min(shas.length, R().starterSha);
    sel = new Set(lastDeckSel.filter(uid => selPool.some(entry => entry.uid === uid)));
    const cap = Math.min(need, selPool.length);
    while (sel.size > cap) sel.delete(sel.values().next().value);
    selectingDeck = true;
    requestBattleRender();
  }

  function toggleDeckCard(uid) {
    if (!selectingDeck || !selPool.some(entry => entry.uid === uid)) return;
    if (sel.has(uid)) sel.delete(uid); else sel.add(uid);
    requestBattleRender();
  }

  function cancelDeckSelection() {
    if (!selectingDeck) return;
    G.log('[[icon:runner]] 你放下了挑战，首脑仍在污染核心深处盘踞', 'sys');
    finish(null);
  }

  function beginBoss() {
    const need = Math.min(R().bossDeckSize, selPool.length);
    if (sel.size < need) return;
    const shas = G.ownedCards.filter(o => o.card.name === '初始攻击').slice(0, R().starterSha).map(o => o.uid);
    lastDeckSel = [...sel];
    selectingDeck = false;
    drawPile = shuffle([...sel].concat(shas));
    hand = []; discard = []; granted = []; played = []; consumed = []; grave = [];
    maxEnergy = R().battleEnergy;
    energy = maxEnergy;
    turn = 1; busy = false;
    pdef = { shield: 0, armor: 0, guard: false };
    pstat = Combat.ensureStatus({ hp: G.hp });
    infusing = null; discovering = null; discoverQueue = []; pendingTarget = null; floats = [];
    handSelecting = null; handSelectQueue.length = 0;
    choosing = null; choiceQueue.length = 0; stealthStrike = false; nextSpellTwice = 0;
    delayed = []; noDrawNext = false; spellCost1 = false; meleeCost1 = false;
    shaTransform = null; consumeFireballN = 0; lastDrawnUids = []; lastPlayedType = null;
    viewingGrave = false; dreadShown = false; selectingDeck = false;
    battleState = transitionBattle(battleState, BATTLE_PHASES.PLAYER);
    G.state = 'modal';
    G.log(`[[icon:cards]] 牌库编成：自选 ${sel.size} 张非道具卡 + 初始攻击 ×${shas.length} = <b>${drawPile.length}</b> 张 ·
      开局抽 ${R().battleStartDraw} · 每回合开始抽 ${R().battleTurnDraw} · 每回合固定 <b>${maxEnergy}</b> 费`, 'sys');
    drawCards(R().battleStartDraw);
    requestBattleRender();
  }

  // ---------- 目标规则（v0.22 设计者定版：指向性卡必须拖到目标身上） ----------
  // 'enemy' = 伤害类 → 拖到敌人身上打出
  // 'self'  = 治疗/净化/护甲/护盾/格挡类 → 拖到自己（立绘）身上
  // null    = 群体卡与无指向效果（抽牌/发现/能量…）→ 直接点击打出
  function targetSide(card) {
    return targetSideFor(card, SDT.Cards.DMG_TYPES);
  }

  // ---------- 不可打出判定（v0.24：无法使用的卡在手中虚化、无法触发并提示原因） ----------
  // 资源/事件卡任何战斗都打不出；牌库/墓地类词条只有对战 BOSS 才生效
  // （普通战斗没有牌库与墓地概念）；道具卡只能在普通战斗中使用。
  function unplayableReason(card) {
    return unplayableReasonFor(card, mode);
  }

  function play(uid, side) {
    if (busy || infusing || discovering || choosing || viewingGrave) return;
    const entry = findCard(uid);
    if (!entry) return;
    const card = entry.card;
    const why = unplayableReason(card);
    if (why) { G.log(`[[icon:cross]] 【${esc(card.name)}】无法打出：${why}`, 'warn'); return; }
    const effCost = effCostOf(card);
    if (effCost > energy) { G.log(`[[icon:bolt]] 能量不足：【${esc(card.name)}】需要 ${effCost} 点能量`, 'warn'); return; }
    const infN = infuseOf(card);
    if (infN > 0) {
      const others = hand.filter(h => h !== uid);
      if (others.length < infN) {
        G.log(`[[icon:flask]] 手牌不足：【${esc(card.name)}】注能(${infN}) 需要消耗 ${infN} 张手牌，当前只有 ${others.length} 张可选`, 'warn');
        return;
      }
      infusing = { uid, card, need: infN, picked: new Set() };
      requestBattleRender();
      return;
    }
    // 目标校验：指向性卡必须拖到对应目标（点卡只是锁定提示，不会打出）
    const need = targetSide(card);
    let target = null;
    if (need === 'enemy') {
      if (side == null || side === 'self') { pendingTarget = { uid, card }; battleState = beginTargeting(battleState, uid, alive().map(foe => foe.id)); pendingHint = ''; requestBattleRender(); return; }
      target = foes[+side];
      if (!target || target.dead) { pendingTarget = { uid, card }; battleState = beginTargeting(battleState, uid, alive().map(foe => foe.id)); pendingHint = ''; requestBattleRender(); return; }
    } else if (need === 'self') {
      if (side !== 'self') { pendingTarget = { uid, card }; battleState = beginTargeting(battleState, uid, ['self']); pendingHint = ''; requestBattleRender(); return; }
    } else {
      target = alive()[0] || null;
    }
    pendingTarget = null;
    pendingHint = '';
    // 「杀化为X」战斗规则：打出的初始攻击以目标卡形态结算（uid 沿用，弃牌簿记不变）
    let playCard = card;
    if (shaTransform && (card.name === '初始攻击' || card.name === '杀')) {
      const tpl = SDT.Cards.all().find(c => c.name === shaTransform);
      if (tpl) playCard = { ...tpl };
    }
    queueCardExecution(uid, playCard, [], target);
  }

  // v0.32 堆叠手牌：点击的是一叠同名卡的代表性 uid——选中/取消该叠中的一张
  function toggleInfusePick(uid) {
    if (!infusing || uid === infusing.uid) return;
    const entry = findCard(uid);
    if (!entry) return;
    // 「无法用于注能」（不朽斩等）不能被选作注能牺牲品
    if (/无法用于注能/.test(String(entry.card.desc || ''))) return;
    const groupUids = hand.filter(h => {
      if (h === infusing.uid) return false;
      const o = findCard(h);
      return o && o.card.name === entry.card.name;
    });
    const pickedInGroup = groupUids.filter(u => infusing.picked.has(u));
    if (pickedInGroup.length) {
      infusing.picked.delete(pickedInGroup[pickedInGroup.length - 1]);
    } else {
      const free = groupUids.find(u => !infusing.picked.has(u));
      if (free && infusing.picked.size < infusing.need) infusing.picked.add(free);
    }
    requestBattleRender();
  }
  function cancelInfuse() { infusing = null; requestBattleRender(); }
  function confirmInfuse() {
    if (!infusing || infusing.picked.size !== infusing.need) return;
    const { uid, card } = infusing;
    const fuel = [...infusing.picked];
    infusing = null;
    queueCardExecution(uid, card, fuel, alive()[0] || null);
  }

  function queueCardExecution(uid, card, fuelUids, target, freeCost) {
    battleState = transitionBattle(battleState, BATTLE_PHASES.RESOLVING);
    busy = true;
    requestBattleRender();
    actionQueue.enqueue(() => execPlay(uid, card, fuelUids, target, freeCost)).finally(() => {
      // 触发效果可能继续入队；队列未空时保持 resolving/busy，避免玩家插入新动作。
      if (actionQueue.length === 0) {
        if (battleState.phase === BATTLE_PHASES.RESOLVING) battleState = transitionBattle(battleState, BATTLE_PHASES.PLAYER);
        busy = false;
      }
      requestBattleRender();
    });
  }

  function execPlay(uid, card, fuelUids, target, freeCost) {
    const effCost = effCostOf(card);
    if (effCost !== card.cost) G.log(`[[icon:sparkles]] 宇宙形态：【${esc(card.name)}】按 <b>1</b> 费打出（原 ${card.cost} 费）`, 'sys');
    if (!freeCost) energy -= effCost;
    played.push(uid);
    SDT.Sound.sfx('card');
    removeUid(hand, uid);
    fuelUids.forEach(f => removeUid(hand, f));
    fuelUids.forEach(f => {
      consumed.push(f);
      // v0.25：被消耗的牌进入墓地——墓地不参与洗回，战胜 BOSS 后可在整理背包放回
      if (mode === 'boss') grave.push(f);
      const o = findCard(f);
      G.log(`[[icon:flask]] <b>${esc(card.name)}</b> 注能：消耗了【<b>${esc(o ? o.card.name : '?')}</b>】${mode === 'boss' ? '（进墓地，不参与洗回）' : '（战后进消耗口袋，可在火堆复原）'}`, 'sys');
      // 被牺牲的牌并没有被「使用」：不结算主效果，只结算它的「被注能时」条件效果
      if (o) resolveInfusedFuel(o.card, target);
      // 深渊降焰（降临者英雄）：每消耗 1 张卡牌，自动施放 1 次火球
      if (consumeFireballN > 0) {
        for (let k = 0; k < consumeFireballN; k++) {
          const t = alive()[0];
          if (!t) break;
          const r = Combat.dealDamage({
            atk: G.atk,
            spellPower: (G.spellPower || 0) + ((pstat && pstat.status.spellUp) || 0),
          }, t, 4, Combat.TYPES.SPELL);
          if (r.dealt > 0) floats.push({ unit: foeIdx(t), text: '-' + r.dealt, cls: 'dmg' });
          G.log(`[[icon:fire]] 深渊降焰：施放 1 次火球 → ${esc(t.name)}：造成 <b>${r.dealt}</b> 点法术伤害`, 'sys');
          sweepDead();
        }
      }
    });
    if (mode === 'boss') discard.push(uid);
    const fuelCostSum = fuelUids.reduce((a, f) => {
      const o = findCard(f);
      return a + (o ? Math.max(0, +(o.card.cost || 0)) : 0);
    }, 0);
    resolveCard(card, target, fuelUids.length > 0, fuelCostSum);
    // 「若本牌为最后一张手牌，效果触发 N 次」（急行军）：整卡效果再跑一遍
    if (/最后一张手牌[^。；]*?触发\s*(\d+)?\s*次?/.test(String(card.desc || '')) && hand.length === 0) {
      G.log(`[[icon:cards]] <b>${esc(card.name)}</b>：本牌是最后一张手牌，效果触发 2 次`, 'sys');
      resolveCard(card, target, fuelUids.length > 0, fuelCostSum);
    }
    // 「下一张法术施放 N 次」（元素风暴，注能打出时注册）：法术效果再跑一遍
    if (nextSpellTwice > 0 && card.type === '法术') {
      nextSpellTwice = 0;
      G.log(`[[icon:sparkles]] <b>元素风暴</b>：这张法术额外施放 1 次`, 'sys');
      resolveCard(card, target, fuelUids.length > 0, fuelCostSum);
    }
    // 「永远被保留在手牌中」（不朽斩）：打出后回到手牌，不进弃牌堆
    if (/永远被保留在手牌中/.test(String(card.desc || ''))) {
      const di = discard.lastIndexOf(uid); if (di >= 0) discard.splice(di, 1);
      const pi = played.lastIndexOf(uid); if (pi >= 0) played.splice(pi, 1);
      if (hand.length < R().battleHandMax) {
        hand.push(uid);
        G.log(`[[icon:anchor]] 【${esc(card.name)}】保留在手牌中（无法用于注能）`, 'sys');
      }
    }
    sweepDead();
    lastPlayedType = card.type;   // 供「上一张牌是武术→0费」类条件费用判定
    if (!alive().length) { finish(true); return; }
    processChoice();
    processDiscoverQueue();
    requestBattleRender();
  }

  // 状态角标：祝福（绿）+ 诅咒（红）
  function statusChips(status) {
    const buffs = Combat.BUFFS
      .filter(k => (status[k] || 0) > 0)
      .map(k => {
        const m = Combat.BUFF_META[k];
        const v = m.timed ? ` ${status[k]}回合` : (m.flag ? '' : ` ${status[k]}`);
        return `<span class="bt-buff b-${k}" title="${escAttr('祝福：' + m.desc)}">${m.icon} ${m.name}${v}</span>`;
      });
    const curses = Combat.CURSES
      .filter(k => (status[k] || 0) > 0)
      .map(k => {
        const m = Combat.CURSE_META[k];
        const txt = m.stack ? `${m.name} ${status[k]}` : `${m.name} ${status[k]}回合`;
        return `<span class="bt-curse c-${k}" title="${escAttr(m.desc)}">${m.icon} ${txt}</span>`;
      });
    return buffs.concat(curses).join(' ');
  }
  const curseChips = statusChips;   // 兼容旧调用名

  // 敌人免伤判定（元素领主：偶数回合全免伤，破甲克制）
  function aegisBlocked(foe) {
    return foe.affix === 'aegis' && turn % 2 === 0 && (foe.status.abreak || 0) <= 0;
  }

  // 敌人数组下标（飘字特效用）：按对象引用找 idx
  function foeIdx(foe) { return foes.indexOf(foe); }

  // 对单个敌人结算一次伤害（含潜行/免伤/死亡处理），返回实际伤害
  function hitFoe(foe, card, amount, type, seg) {
    if (foe.dead) return 0;
    if (aegisBlocked(foe)) {
      SDT.Sound.sfx('parry');
      floats.push({ unit: foeIdx(foe), text: '免伤', cls: 'block' });
      G.log(`[[icon:crystal]] ${seg || ''}<b>${esc(foe.name)}</b> 的元素庇幕展开：伤害被完全减免！（破甲可击碎）`, 'warn');
      return 0;
    }
    // 破隐一击（白梅落影·妄）：自己处于潜行中发动的攻击伤害 ×2
    const stealthedBefore = Combat.isStealthed(pstat);
    let amt = amount;
    if (stealthStrike && stealthedBefore && amount > 0) {
      amt *= 2;
      G.log(`[[icon:runner]] <b>破隐一击</b>：从潜行中发动，伤害翻倍（${amount} → ${amt}）`, 'ok');
    }
    // 法伤加成（含祝福）；「受法伤加成翻倍」（爆燃火球）在此翻倍
    let sp = (G.spellPower || 0) + ((pstat && pstat.status.spellUp) || 0);
    if (card && /受法伤加成翻倍/.test(String(card.desc || ''))) sp *= 2;
    // 「对冰冻角色伤害 +N」（寒冰剑）：目标被冰冻时追加
    const frzM = card && String(card.desc || '').match(/对冰冻[^。]*?伤害\s*\+\s*(\d+)/);
    if (frzM && (foe.status.freeze || 0) > 0) amt += +frzM[1];
    const r = Combat.dealDamage({ atk: G.atk, spellPower: sp }, foe, amt, type);
    if (r.stealthed) {
      SDT.Sound.sfx('parry');
      floats.push({ unit: foeIdx(foe), text: '未命中', cls: 'block' });
      G.log(`[[icon:runner]] ${seg || ''}<b>${esc(foe.name)}</b> 处于<b>潜行</b>中：无法成为被攻击对象！`, 'warn');
      return 0;
    }
    SDT.Sound.sfx('hit');
    if (r.dealt > 0) floats.push({ unit: foeIdx(foe), text: '-' + r.dealt, cls: 'dmg' });
    G.log(`[[icon:play]] <b>${esc(card.name)}</b>${seg || ''} → ${esc(foe.name)}：造成 <b>${r.dealt}</b> 点${Combat.TYPE_NAME[type]}` +
      (r.log.length ? `（${r.log.join('，')}）` : ''), 'sys');
    // 造成伤害会破除自己的潜行（不造成伤害便不会破除）
    if (r.dealt > 0 && Combat.breakStealth(pstat)) {
      G.log('[[icon:runner]] 你造成了伤害，<b>潜行</b>被破除', 'dim');
    }
    if (foe.hp <= 0 && !foe.dead) {
      foe.dead = true;
      G.log(`[[icon:skull]] <b>${esc(foe.name)}</b> 被击倒！（剩 ${alive().length} 个敌人）`, 'ok');
      floats.push({ unit: foeIdx(foe), text: '💥', cls: 'stk' });
      floats.push({ unit: 'self', text: KILL_CHEER[Math.floor(Random.random('battle') * KILL_CHEER.length)], cls: 'stk stk-late' });
    }
    return r.dealt;
  }

  function randomDiscoverCard(pred, rarity, otherCls) {
    // 2026-09-08：限制卡池（pred）优先——限定池只排除 生物/事件/衍生，
    // 职业/棱彩/传说特例卡按池子规则可被指定获取；无 pred 走通用随机池
    // （isRandomObtainable：排除 初始/职业/英雄卡/生物/棱彩/unrandom）。
    // 兼容旧签名（rarity/otherCls 由 processDiscoverQueue 换算成 pred 后传入）。
    let pool;
    if (pred) {
      pool = SDT.Cards.all().filter(c => c.rarity !== '衍生' && !['生物', '事件'].includes(c.type) && pred(c));
    } else {
      pool = SDT.Cards.all().filter(c =>
        c.rarity !== '衍生' && SDT.Cards.isRandomObtainable(c) &&
        (!rarity || c.rarity === rarity) &&
        (!otherCls || (c.cls && c.cls !== G.myClass)) ||
        (otherCls && c.rarity === '职业' && c.cls && c.cls !== G.myClass));
    }
    if (!pool.length) return null;
    return pool[Math.floor(Random.random('battle') * pool.length)];
  }

  // —— 手牌选卡（2026-09-06 #24/#25）：「选择 N 张手牌中的 X 施放/消耗」通用执行 ——
  function processHandSelect() {
    if (handSelecting || !handSelectQueue.length) return;
    const job = handSelectQueue.shift();
    handSelecting = { n: job.n || 1, type: job.type || null, act: job.act || 'play', thenText: job.thenText || '' };
    requestBattleRender();
  }
  function pickHandSelect(uid) {
    if (!handSelecting) return;
    const entry = findCard(uid);
    if (!entry) return;
    if (handSelecting.act === 'play') {
      handSelecting = null;
      queueCardExecution(uid, entry.card, [], alive()[0] || null, true);   // 选卡施放：不扣费
      return;
    }
    if (handSelecting.act === 'copy') {
      // 深红丝袋：复制选中的手牌（原牌保留，复制件为战斗内临时卡）
      addTempCard({ ...entry.card });
      G.log(`[[icon:cards]] 复制了手牌中的【<b>${esc(entry.card.name)}</b>】（置入手牌，原牌保留）`, 'loot');
      handSelecting.n -= 1;
      if (handSelecting.n > 0) { requestBattleRender(); return; }
      const doneJob = handSelecting;
      handSelecting = null;
      if (doneJob.thenText) applyTextEffects(entry.card, doneJob.thenText, null);
      if (!alive().length) { finish(true); return; }
      processHandSelect();
      requestBattleRender();
      return;
    }
    hand = hand.filter(h => h !== uid);
    consumed.push(uid);
    G.log(`[[icon:flask]] 消耗了手牌中的【<b>${esc(entry.card.name)}</b>】`, 'sys');
    handSelecting.n -= 1;
    if (handSelecting.n > 0) { requestBattleRender(); return; }
    const job = handSelecting;
    handSelecting = null;
    if (job.thenText) applyTextEffects(entry.card, job.thenText, null);
    if (!alive().length) { finish(true); return; }
    processHandSelect();
    requestBattleRender();
  }
  // 战斗内复原：从消耗堆拿回 n 张到手牌（2026-09-06 #16）
  function restoreConsumed(n) {
    let cnt = 0;
    while (cnt < n && consumed.length) { hand.push(consumed.pop()); cnt++; }
    if (cnt) G.log(`[[icon:gem]] 复原 ${cnt} 张消耗卡，回到手牌`, 'ok');
    return cnt;
  }

  // —— 抉择面板（2026-09-08 人工 N 选一）：复用发现面板的弹层交互 ——
  function processChoice() {
    if (choosing || !choiceQueue.length) return;
    const job = choiceQueue.shift();
    choosing = { cardName: job.cardName || '？', options: (job.options || []).slice() };
    requestBattleRender();
  }
  function pickChoice(i) {
    if (!choosing) return;
    const job = choosing;
    choosing = null;
    const text = job.options[+i] || '';
    G.log(`[[icon:question]] <b>抉择</b>（【${esc(job.cardName)}】）：你选择了「${esc(text)}」`, 'sys');
    // 选项若指名一张生物/门类卡（如 末日浩劫之门 / 天国之门）：
    // 把它的「回合开始时」效果注册为每回合重复的持续效果（门是场面物件）
    const quoted = text.match(/[‘“「]([^\s，。；‘’“”「」]+)[’”」]/);
    const ref = quoted && SDT.Cards.all().find(c => c.name === quoted[1]);
    if (ref && ref.type === '生物') {
      const parts = splitClauses(String(ref.desc || ''));
      if (parts.turnStart.length) {
        parts.turnStart.forEach(it => {
          // 天国之门类「随机获取一项祝福」：把括号里的候选词池拼进注册文本，供回合结算识别
          let text = it.text;
          const paren = String(ref.desc || '').match(/（[^）]*从这些中随机[^）]*）/);
          if (paren && /随机获取一项祝福/.test(text)) text += paren[0];
          delayed.push({ text, cardName: ref.name, repeat: true });
        });
        G.log(`[[icon:hourglass]] <b>${esc(ref.name)}</b> 展开：${esc(parts.turnStart.map(it => it.text).join('；'))}（每回合开始生效）`, 'sys');
      } else {
        G.log(`[[icon:question]] 【${esc(ref.name)}】没有可展开的回合开始效果（占位）`, 'dim');
      }
    } else {
      applyTextEffects({ name: job.cardName }, text, alive()[0] || null);
    }
    sweepDead();
    if (!alive().length) { finish(true); return; }
    processChoice();
    processDiscoverQueue();
    requestBattleRender();
  }
  function processDiscoverQueue() {
    if (discovering || !discoverQueue.length) return;
    const job = discoverQueue.shift();
    const options = [];
    const taken = new Set();
    // 旧任务格式兼容：rarity / otherCls 换算成谓词
    const legacyPred = job.rarity ? (c => c.rarity === job.rarity)
      : job.otherCls ? (c => c.rarity === '职业' && c.cls && c.cls !== G.myClass)
      : null;
    const pred = job.pred || legacyPred;
    for (let i = 0; i < 3; i++) {
      const c = randomDiscoverCard(pred, job.rarity, !job.pred && !job.rarity ? job.otherCls : null);
      if (c && !taken.has(c.id)) { taken.add(c.id); options.push(c); }
    }
    if (!options.length) { G.log('（没有符合条件的卡牌可发现）', 'dim'); return; }
    discovering = { options, n: job.n, rarity: job.rarity, pred: job.pred, act: job.act || null };
    requestBattleRender();
  }

  function pickDiscover(i) {
    if (!discovering) return;
    const card = discovering.options[+i];
    if (!card) return;
    const { n, rarity, pred, act, options } = discovering;
    discovering = null;
    // 「直接施放 / 直接释放」类发现：置入手牌后立刻免费打出
    if (act === 'play' || act === 'potion') {
      const uid = addTempCard(card);
      G.log(`[[icon:question]] 发现：【<b>${esc(card.name)}</b>】并直接施放（战斗内临时卡，战后消散）`, 'loot');
      queueCardExecution(uid, findCard(uid).card, [], alive()[0] || null, true);
    } else if (act === 'playKeep') {
      // 永恒绽放：施放 1 张，其余两张入手
      const uid = addTempCard(card);
      G.log(`[[icon:question]] 发现：【<b>${esc(card.name)}</b>】并直接施放（战斗内临时卡，战后消散）`, 'loot');
      queueCardExecution(uid, findCard(uid).card, [], alive()[0] || null, true);
      options.filter(o => o.id !== card.id).forEach(o => {
        addTempCard(o);
        G.log(`[[icon:cards]] 其余的【<b>${esc(o.name)}</b>】置入手牌`, 'loot');
      });
    } else {
      addTempCard(card);
      G.log(`[[icon:question]] 发现：【<b>${esc(card.name)}</b>】置入手牌（战斗内临时卡，战后消散）`, 'loot');
    }
    sweepDead();
    if (!alive().length) { finish(true); return; }
    if (n > 1) discoverQueue.unshift({ n: n - 1, rarity, pred, act });
    processDiscoverQueue();
    requestBattleRender();
  }

  // 玩家受到一次攻击（含流血加成 / 格挡），返回实际伤害
  function playerTakeHit(foe) {
    const playerRef = { hp: G.hp, defense: pdef, status: pstat.status };
    const r = Combat.dealDamage({ atk: foe.atk }, playerRef, 0, Combat.TYPES.ATTACK);
    G.hp = Math.max(0, playerRef.hp);
    SDT.Sound.sfx('hurt');
    floats.push({ unit: 'self', text: '-' + r.dealt, cls: 'hurt' });
    if (r.dealt > 0) floats.push({ unit: 'self', text: '💢', cls: 'stk stk-late' });
    G.log(`[[icon:demon]] <b>${esc(foe.name)}</b> 反击：你受到 <b>${r.dealt}</b> 点攻击伤害（${G.hp}/${G.maxHp}）`, 'warn');
    return r.dealt;
  }

  // 附加 1 层流血或中毒（兽人首领狂乱用）
  function frenzyCurse(foe) {
    const key = Random.random('status') < 0.5 ? 'bleed' : 'poison';
    Combat.addCurse(pstat, key, 1);
    SDT.Sound.sfx('curse');
    G.log(`[[icon:bolt]] <b>${esc(foe.name)}</b> 的攻击附加了 <b>1</b> 层${Combat.CURSE_META[key].name}`, 'warn');
  }

  // 附加 1 层随机诅咒（滋生异变体「攻击并施加诅咒」用；灼烧已入池，2026-09-08）
  function elCurse(foe) {
    const keys = ['bleed', 'poison', 'burn'];
    const key = keys[Math.floor(Random.random('status') * keys.length)];
    Combat.addCurse(pstat, key, 1);
    SDT.Sound.sfx('curse');
    G.log(`[[icon:skull]] <b>${esc(foe.name)}</b> 的攻击附加了 <b>1</b> 层${Combat.CURSE_META[key].name}`, 'warn');
  }

  // ---------- 回合结束 ----------
  function endTurn() {
    if (busy || infusing || discovering || choosing) return;
    busy = true;
    battleState = transitionBattle(battleState, BATTLE_PHASES.ENEMY);
    pendingTarget = null;
    pendingHint = '';
    // —— 玩家回合结束：中毒 / 灼烧结算 ——
    const pref = { hp: G.hp, defense: pdef, status: pstat.status };
    const pr = Combat.tickPoison(pref);
    const br = Combat.tickBurn(pref);
    G.hp = Math.max(0, pref.hp);
    if (pr) {
      floats.push({ unit: 'self', text: '-' + pr.dealt, cls: 'hurt' });
      G.log(`[[icon:skull]] 中毒结算：你受到 <b>${pr.dealt}</b> 点固定伤害（${G.hp}/${G.maxHp}）`, 'warn');
    }
    if (br) {
      floats.push({ unit: 'self', text: '-' + br.dealt, cls: 'hurt' });
      G.log(`[[icon:fire]] 灼烧结算：你受到 <b>${br.dealt}</b> 点固定伤害（${G.hp}/${G.maxHp}）`, 'warn');
    }
    // 计时状态不在玩家阶段递减——共享回合钟统一在每回合结束（afterEnemies 末尾）递减
    requestBattleRender();
    if (G.hp <= 0) { busy = false; finish(false); return; }
    // —— 敌人回合：逐个行动 ——
    const acting = alive();
    let i = 0;
    const step = () => {
      if (G.hp <= 0) { busy = false; finish(false); return; }
      if (i >= acting.length) { afterEnemies(); return; }
      const foe = acting[i++];
      if (foe.dead) { step(); return; }
      if (!Combat.canAct(foe)) {
        G.log(`[[icon:crystal]] <b>${esc(foe.name)}</b> 被冰冻，无法行动！`, 'sys');
      } else {
        const hits = foe.affix === 'frenzy' ? 2 : 1;
        for (let h = 0; h < hits && G.hp > 0; h++) {
          // 潜行：无法成为被攻击对象（冰冻/潜行的敌人在自己行动后照常递减计时）
          if (Combat.isStealthed(pstat)) {
            G.log(`[[icon:runner]] 你在<b>潜行</b>中，<b>${esc(foe.name)}</b> 无法将你作为攻击对象`, 'sys');
            break;
          }
          const dealt = playerTakeHit(foe);
          // 敌人造成伤害也会破除它自己的潜行
          if (dealt > 0 && Combat.breakStealth(foe)) {
            G.log(`[[icon:runner]] <b>${esc(foe.name)}</b> 发动了攻击，<b>潜行</b>被破除`, 'dim');
          }
          if (dealt > 0 && foe.affix === 'frenzy') frenzyCurse(foe);
          // 行为型附加：灼热异变体（攻击并灼烧）/ 滋生异变体（攻击并施加诅咒）
          if (dealt > 0 && foe.behavior === 'burn') {
            Combat.addCurse(pstat, 'burn', 2);
            SDT.Sound.sfx('curse');
            G.log(`[[icon:fire]] <b>${esc(foe.name)}</b> 的攻击附加了<b>灼烧</b>（2 回合内每回合结束受 1 点固定伤害）`, 'warn');
          } else if (dealt > 0 && foe.behavior === 'curse') {
            elCurse(foe);
          }
        }
      }
      requestBattleRender();
      if (G.hp <= 0) { busy = false; finish(false); return; }
      setTimeout(step, 420);
    };
    setTimeout(step, 420);
  }

  function afterEnemies() {
    // —— 敌人回合结束：中毒 / 灼烧结算 + 词缀 ——
    foes.forEach(foe => {
      if (foe.dead) return;
      const er = Combat.tickPoison(foe);
      if (er) {
        floats.push({ unit: foes.indexOf(foe), text: '-' + er.dealt, cls: 'dmg' });
        G.log(`[[icon:skull]] 中毒结算：<b>${esc(foe.name)}</b> 受到 <b>${er.dealt}</b> 点固定伤害（${Math.max(0, foe.hp)}/${foe.maxHp}）`, 'sys');
      }
      const eb = Combat.tickBurn(foe);
      if (eb) {
        floats.push({ unit: foes.indexOf(foe), text: '-' + eb.dealt, cls: 'dmg' });
        G.log(`[[icon:fire]] 灼烧结算：<b>${esc(foe.name)}</b> 受到 <b>${eb.dealt}</b> 点固定伤害（${Math.max(0, foe.hp)}/${foe.maxHp}）`, 'sys');
      }
      if (foe.hp <= 0 && !foe.dead) { foe.dead = true;
        G.log(`[[icon:skull]] <b>${esc(foe.name)}</b> 毒发倒地！（剩 ${alive().length} 个敌人）`, 'ok');
        floats.push({ unit: foes.indexOf(foe), text: '💥', cls: 'stk' });
        floats.push({ unit: 'self', text: KILL_CHEER[Math.floor(Random.random('battle') * KILL_CHEER.length)], cls: 'stk stk-late' }); }
    });
    if (!alive().length) { busy = false; finish(true); return; }
    // 军威（将军）：回合结束时攻击力 +2
    foes.forEach(foe => {
      if (!foe.dead && foe.affix === 'grow') {
        foe.atk += 2;
        G.log(`[[icon:arrow]] <b>军威</b>：<b>${esc(foe.name)}</b> 攻击力增至 <b>${foe.atk}</b>`, 'warn');
      }
    });
    // —— 共享回合钟：所有计时状态在本回合结束统一递减 1 ——
    // 持续 1 回合 = 本回合结束前生效；持续 n 回合 = 从触发当回合起覆盖 n 个完整回合
    tickDurationsLog(pstat.status, '你');
    foes.forEach(foe => { if (!foe.dead) tickDurationsLog(foe.status, foe.name); });
    turn++;
    foes.forEach(foe => { if (!foe.dead) foe.intent = intentFor(foe, turn); });
    energy = maxEnergy;
    // —— 新回合开始：玩家形态祝福 ——
    if ((pstat.status.natureForm || 0) > 0) {
      energy++;
      G.log(`[[icon:wood]] <b>自然形态</b>：额外获得 1 点能量（当前 ${energy}/${maxEnergy}）`, 'ok');
    }
    if ((pstat.status.swordForm || 0) > 0) {
      if (mode === 'boss') {
        const got = drawCards(1);
        G.log(`[[icon:sword]] <b>剑仙形态</b>：额外抽了 ${got} 张牌`, 'ok');
      } else {
        grantSha(1);
        G.log(`[[icon:sword]] <b>剑仙形态</b>：额外获得 1 张【初始攻击】（普通战斗抽牌效果改为获得初始攻击）`, 'ok');
      }
    }
    // —— 新回合开始：「回合开始时」延迟段结算 ——
    processDelayed();
    // —— 常规抽牌（「下回合无法抽牌」标记在本回合开始消耗掉） ——
    if (noDrawNext) {
      noDrawNext = false;
      G.log('[[icon:cross]] <b>下回合无法抽牌</b>生效：本回合开始不抽牌', 'warn');
    } else if (mode === 'boss') {
      drawCards(R().battleTurnDraw);
    }
    busy = false;
    requestBattleRender();
  }

  function tickDurationsLog(status, who) {
    const meta = (k) => Combat.CURSE_META[k] || Combat.BUFF_META[k];
    const expired = Combat.tickDurations({ status });
    expired.forEach(k => G.log(`[[icon:sparkles]] ${esc(who)} 的<b>${meta(k).name}</b>效果结束了`, 'dim'));
  }

  function flee() {
    if (busy || infusing || discovering || choosing) return;
    SDT.Sound.sfx('flee');
    G.log('[[icon:runner]] 你撤出了战斗（打出过的卡照常结算）', 'sys');
    finish(null);
  }

  function finish(win) {
    if (win === true && battleState.phase !== BATTLE_PHASES.VICTORY) battleState = transitionBattle(battleState, BATTLE_PHASES.VICTORY);
    if (win === false && battleState.phase !== BATTLE_PHASES.DEFEAT) battleState = transitionBattle(battleState, BATTLE_PHASES.DEFEAT);
    SDT.Sound.sfx(win === true ? 'victory' : win === false ? 'defeat' : 'flee');
    const playedCopy = played.slice();
    const consumedCopy = consumed.slice();
    played = []; consumed = [];
    drawPile = []; hand = []; discard = []; granted = []; grave = [];
    sel = new Set();
    infusing = null; discovering = null; discoverQueue = []; pendingTarget = null; floats = [];
    handSelecting = null; handSelectQueue.length = 0;
    choosing = null; choiceQueue.length = 0; stealthStrike = false; nextSpellTwice = 0;
    delayed = []; noDrawNext = false; spellCost1 = false; meleeCost1 = false;
    shaTransform = null; consumeFireballN = 0; lastDrawnUids = []; lastPlayedType = null;
    viewingGrave = false; dreadShown = false; selectingDeck = false;
    G.state = 'idle';
    G.battleActive = false;
    if (SDT.Sound) SDT.Sound.setDucked(false);   // 战斗结束恢复 BGM 音量
    opts.foeNames = foes.map(f => f.name);
    SDT.Sound.music('board');   // 战斗结束切回行军氛围
    G.onBattleEnd(opts, playedCopy, win, consumedCopy);
  }

  // ---------- 墓地查看（BOSS 战专属：普通战斗没有牌库/墓地概念） ----------
  // 玩家点「墓地」可看到自己消耗过哪些牌（注能牺牲品等），并按卡牌类型统计数量。
  // 墓地不参与洗回；战胜 BOSS 后的「整理背包」环节可把这些牌放回背包或丢弃。
  function closeGrave() {
    viewingGrave = false;
    requestBattleRender();
  }

  // —— 快照缓存（2026-09-06 性能修复）——
  // battle.view 的 render 与拖拽指向路径（pointermove 每秒可近百次）都会调 getSnapshot，
  // 旧实现每次都全量拷贝 + Object.freeze 一整棵快照树（一次 20-40 个冻结对象）。
  // 战斗状态全部由本模块变量持有、只在下方各命令函数中变更，故按「输入签名」记忆化：
  // 状态没变就直接复用上一次的冻结快照（消费方拿到的仍是同一份只读快照，冻结模式不变）。
  // ⚠ 新增快照字段时，必须把它的输入同步追加进 snapshotSignature()，否则视图会读到陈旧状态。
  let snapCache = null, snapSig = null;
  const STATUS_SIG_KEYS = [...Combat.CURSES, ...Combat.BUFFS];   // status 全部数值键（bleed/poison 已含在 CURSES）
  const statusSig = (st) => st ? STATUS_SIG_KEYS.map(k => k + ':' + (st[k] || 0)).join(',') : '';
  function snapshotSignature() {
    const sig = [mode, turn, energy, maxEnergy, busy, opts,
      pendingHint, viewingGrave, dreadShown, selectingDeck, selShaN, handSelectQueue.length,
      spellCost1, meleeCost1, shaTransform, consumeFireballN, lastPlayedType,
      stealthStrike, choiceQueue.length];
    if (G) sig.push(G.hp, G.maxHp, G.atk, G.spellPower || 0, G.myClass || '', G.characterId || '');
    if (pdef) sig.push(pdef.shield, pdef.armor, pdef.guard);
    sig.push(statusSig(pstat && pstat.status), pstat ? pstat.hp : 0);
    sig.push(foes.length);
    for (const f of foes) {
      sig.push(f.id, f.name, f.behavior, f.affix, f.affixName, f.dead, f.hp, f.maxHp, f.atk, statusSig(f.status));
      if (f.defense) sig.push(f.defense.shield, f.defense.armor, f.defense.guard);
      sig.push(f.intent);   // intent 只被整体替换不就地改，引用比较即可
    }
    sig.push(hand.join(','), drawPile.join(','), discard.join(','), grave.join(','));
    if (infusing) sig.push(infusing.uid, infusing.need, infusing.card, infusing.picked.size, [...infusing.picked].sort().join(','));
    if (discovering) sig.push(discovering.n, discovering.rarity, discovering.options.length);
    if (handSelecting) sig.push(handSelecting.n, handSelecting.type, handSelecting.act, handSelecting.thenText);
    if (choosing) sig.push(choosing.cardName, choosing.options.join('|'));
    if (pendingTarget) sig.push(pendingTarget.uid, pendingTarget.card);
    if (selectingDeck) sig.push(sel.size, [...sel].sort().join(','), selPool.length);
    return sig.join('\u0001');
  }

  function getSnapshot() {
    const sig = snapshotSignature();
    if (snapCache && sig === snapSig) return snapCache;
    snapSig = sig;
    const freezeObject = value => value ? Object.freeze({ ...value }) : value;
    const statusOf = value => value ? Object.freeze({ ...value.status }) : null;
    const playerStatus = pstat ? Object.freeze({ ...pstat, status: statusOf(pstat) }) : null;
    const playerDefense = freezeObject(pdef);
    const readonlyFoes = foes.map(foe => Object.freeze({
      ...foe,
      status: statusOf(foe),
      defense: freezeObject(foe.defense),
      intent: freezeObject(foe.intent),
    }));
    const readonlyInfusing = infusing ? Object.freeze({
      ...infusing,
      card: freezeObject(infusing.card),
      picked: Object.freeze([...infusing.picked]),
    }) : null;
    const readonlyDiscovering = discovering ? Object.freeze({
      ...discovering,
      options: Object.freeze(discovering.options.map(freezeObject)),
    }) : null;
    const readonlyHandSelecting = handSelecting ? Object.freeze({ ...handSelecting }) : null;
    const readonlyChoosing = choosing ? Object.freeze({ ...choosing, options: Object.freeze(choosing.options.slice()) }) : null;
    const deckSelection = selectingDeck ? Object.freeze({
      need: R().bossDeckSize,
      starterCount: selShaN,
      selected: Object.freeze([...sel]),
      cards: Object.freeze(selPool.map(entry => Object.freeze({ uid: entry.uid, card: freezeObject(entry.card) }))),
      boss: readonlyFoes[0] || null,
    }) : null;
    snapCache = Object.freeze({
      mode, turn, energy, maxEnergy, busy, phase: battleState.phase,
      actionQueueLength: actionQueue.length,
      opts: freezeObject(opts),
      player: G ? Object.freeze({ hp: G.hp, maxHp: G.maxHp, atk: G.atk, spellPower: G.spellPower || 0, myClass: G.myClass || null, characterId: G.characterId || null }) : null,
      pdef: playerDefense,
      pstat: playerStatus,
      foes: Object.freeze(readonlyFoes),
      hand: Object.freeze(hand.slice()),
      drawPile: Object.freeze(drawPile.slice()),
      discard: Object.freeze(discard.slice()),
      grave: Object.freeze(grave.slice()),
      infusing: readonlyInfusing,
      discovering: readonlyDiscovering,
      handSelecting: readonlyHandSelecting,
      choosing: readonlyChoosing,
      pendingTarget: pendingTarget ? Object.freeze({ ...pendingTarget, card: freezeObject(pendingTarget.card) }) : null,
      pendingHint,
      viewingGrave,
      dreadShown,
      deckSelection,
    });
    return snapCache;
  }

  function openGrave() { viewingGrave = true; requestBattleRender(); }
  function cancelPendingTarget() { pendingTarget = null; battleState = cancelTargeting(battleState); pendingHint = ''; requestBattleRender(); }
  function setPendingHint(value) { pendingHint = String(value || ''); requestBattleRender(); }
  function lockPendingTarget(value) { pendingTarget = value; pendingHint = ''; requestBattleRender(); }
  function markDreadShown() { dreadShown = true; }
  function takeFloats() { const list = floats; floats = []; return list; }

  const commands = Object.freeze({
    playCard: play,
    selectInfusion: toggleInfusePick,
    confirmInfusion: confirmInfuse,
    cancelInfusion: cancelInfuse,
    endTurn,
    flee,
    openGrave,
    cancelPendingTarget,
    closeGrave,
    selectDeckCard: toggleDeckCard,
    confirmDeck: beginBoss,
    cancelDeck: cancelDeckSelection,
    pickDiscover,
    pickHandSelect,
    pickChoice,
    setPendingHint,
    lockPendingTarget,
  });

const viewApi = Object.freeze({
  AFFIX_META, Combat, R, aegisBlocked, curseChips, effCostOf, findCard,
  infuseOf, markDreadShown, pileTip, refillDrawPile,
  takeFloats, targetSide, unplayableReason,
});
const BattleSession = Object.freeze({ start, getSnapshot, commands });

export { BattleSession, commands, configureBattleRenderer, getSnapshot, start, viewApi };

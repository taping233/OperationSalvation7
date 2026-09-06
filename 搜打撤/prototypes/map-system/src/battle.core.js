/* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const SDT = window.SDT;
import { esc } from './shared.js';
import { escAttr } from './shared.js';
import { createEffectExecutor, splitEffectClauses } from './battle.effects.js';
import { refillDrawPile, shuffleCards } from './battle.deck.js';
import { isAreaEffect, targetSideFor, unplayableReasonFor } from './battle.rules.js';
import { Random } from './random.js';
/* battle.core.js —— 战斗逻辑：牌库/出牌结算/词条时点/回合流转（渲染由注入的视图完成） */
/* ============================================================
 * 搜打撤 v0.24 —— M1 两类战斗（多敌人 + 拖拽选目标 + BOSS 词缀 + 词条时点体系）
 *
 * 【普通战斗（小怪/遭遇战）】无需抽牌：
 *   随身全部可用卡（含道具卡）直接作为手牌，打出的卡本场不可再用；
 *   每回合固定 2 费（rules.battleEnergy）；
 * ============================================================ */
  const Combat = SDT.Combat;

  let renderBattle = () => {};
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
  let pendingTarget = null;  // 已锁定待拖拽的出牌 {uid, card}（必须拖到目标身上）
  let pendingHint = '';      // 拖拽提示（拖错目标时给出纠正文案）
  let delayed = [];          // 「回合开始时」延迟效果 [{text, cardName, repeat}]（repeat=装备每回合触发）
  let noDrawNext = false;    // 「下回合无法抽牌」标记（下个回合开始消耗掉）
  let viewingGrave = false;  // 正在查看墓地（BOSS 战专属：消耗过的牌 + 类型统计）
  let floats = [];           // 待展示的飘字/受击特效 [{unit:'self'|敌人idx, text, cls}]（渲染后由视图消费）
  const KILL_CHEER = ['👍', '✌️', '✨'];   // 击杀后自己头上的随机欢呼贴纸
  let dreadShown = false;    // BOSS 登场竖线阴影每场只演一次
  let spellCost1 = false;    // 「本局对战内所有法术 1 费」（银河之旅，战斗内永久）
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
    while (n-- > 0) {
      if (!drawPile.length && discard.length) {
        const recycled = refillDrawPile(drawPile, discard);
        G.log(`[[icon:recycle]] 弃牌堆 ${recycled} 张洗回牌库（墓地不参与洗回）`, 'dim');
      }
      if (!drawPile.length) break;
      if (hand.length >= R().battleHandMax) break;
      hand.push(drawPile.pop());
      got++;
    }
    return got;
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
    const base = lib.find(c => c.id === SDT.Cards.SHA.id) || SDT.Cards.SHA;
    for (let i = 0; i < n; i++) addTempCard(base);
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
    allCards: () => SDT.Cards.all(),
    shuffleDeck: () => { drawPile = shuffle(drawPile); return drawPile.length; },
    addEnergy: amount => { energy += amount; return energy; },
    addEnergyCap: amount => { maxEnergy += amount; energy += amount; return maxEnergy; },
  });

  const findCard = (uid) =>
    G.ownedCards.find(o => o.uid === uid) || granted.find(o => o.uid === uid) || null;
  const drawOf = (card) => +(card.draw || 0) || SDT.Cards.deriveDraw(card) || 0;
  const infuseOf = (card) => +(card.infuse || 0) || SDT.Cards.deriveInfuse(card) || 0;

  // 实际费用：宇宙形态下所有卡牌变为 1 费；「本局对战内所有法术 1 费」（银河之旅）
  // 只对法术生效——两者都是战斗内永久效果（本局对战内词条）
  const effCostOf = (card) => {
    if (pstat && pstat.status.cosmosForm > 0) return 1;
    if (spellCost1 && card.type === '法术') return 1;
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
    if (/所有法术[^。]*?1\s*费/.test(inner)) {
      spellCost1 = true;
      G.log('[[icon:sparkles]] 持续规则：你的所有法术均按 <b>1</b> 费打出', 'ok');
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

  // 出牌结算（目标：单点卡 = target；群体卡 = 所有存活敌人）
  function resolveCard(card, target) {
    const desc = String(card.desc || '');
    const parts = splitClauses(desc);
    let did = false;
    const isDmgType = SDT.Cards.DMG_TYPES.includes(card.type);
    // —— 伤害（卡面伤害词条立即结算，不受沉默影响） ——
    if (isDmgType && ((+card.dmg || 0) > 0 || card.dmgType === 'attack')) {
      const type = SDT.Cards.DMG_TYPE_META[card.dmgType] ? card.dmgType : Combat.TYPES.FIXED;
      const tm = desc.match(/(?:攻击|命中)\s*(\d+)\s*次/) || desc.match(/(\d+)\s*段/);
      const times = tm ? Math.max(1, +tm[1]) : 1;
      const targets = isAOE(card) ? alive() : [target || alive()[0]].filter(Boolean);
      if (!targets.length) return;
      for (let i = 0; i < times; i++) {
        targets.forEach(foe => hitFoe(foe, card, +card.dmg || 0, type, times > 1 ? `（第 ${i + 1} 段）` : ''));
      }
      did = true;
    }
    // 沉默：除攻击外的技能效果全部失效（延迟段与持续段也不注册）
    if ((pstat.status.silence || 0) > 0) {
      G.log(`[[icon:cross]] <b>${esc(card.name)}</b> 的技能效果被沉默封印（只剩攻击生效，持续 ${pstat.status.silence} 回合）`, 'warn');
      return;
    }
    // —— 立即生效句 ——
    const res = applyTextEffects(card, parts.immediate.join('，'), target);
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
    opts = Object.assign({ isBoss: false }, options || {});
    mode = opts.isBoss ? 'boss' : 'normal';
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
    infusing = null; discovering = null; discoverQueue = []; pendingTarget = null; floats = [];
    delayed = []; noDrawNext = false; spellCost1 = false; viewingGrave = false; dreadShown = false; selectingDeck = false;
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
    delayed = []; noDrawNext = false; spellCost1 = false; viewingGrave = false; dreadShown = false; selectingDeck = false;
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
    if (busy || infusing || discovering || viewingGrave) return;
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
      if (side == null || side === 'self') { pendingTarget = { uid, card }; pendingHint = ''; requestBattleRender(); return; }
      target = foes[+side];
      if (!target || target.dead) { pendingTarget = { uid, card }; pendingHint = ''; requestBattleRender(); return; }
    } else if (need === 'self') {
      if (side !== 'self') { pendingTarget = { uid, card }; pendingHint = ''; requestBattleRender(); return; }
    } else {
      target = alive()[0] || null;
    }
    pendingTarget = null;
    pendingHint = '';
    execPlay(uid, card, [], target);
  }

  // v0.32 堆叠手牌：点击的是一叠同名卡的代表性 uid——选中/取消该叠中的一张
  function toggleInfusePick(uid) {
    if (!infusing || uid === infusing.uid) return;
    const entry = findCard(uid);
    if (!entry) return;
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
    execPlay(uid, card, fuel, alive()[0] || null);
  }

  function execPlay(uid, card, fuelUids, target) {
    const effCost = effCostOf(card);
    if (effCost !== card.cost) G.log(`[[icon:sparkles]] 宇宙形态：【${esc(card.name)}】按 <b>1</b> 费打出（原 ${card.cost} 费）`, 'sys');
    energy -= effCost;
    played.push(uid);
    SDT.Sound.sfx('card');
    hand = hand.filter(h => h !== uid && !fuelUids.includes(h));
    fuelUids.forEach(f => {
      consumed.push(f);
      // v0.25：被消耗的牌进入墓地——墓地不参与洗回，战胜 BOSS 后可在整理背包放回
      if (mode === 'boss') grave.push(f);
      const o = findCard(f);
      G.log(`[[icon:flask]] <b>${esc(card.name)}</b> 注能：消耗了【<b>${esc(o ? o.card.name : '?')}</b>】${mode === 'boss' ? '（进墓地，不参与洗回）' : '（战后进消耗口袋，可在火堆复原）'}`, 'sys');
      // 被牺牲的牌并没有被「使用」：不结算主效果，只结算它的「被注能时」条件效果
      if (o) resolveInfusedFuel(o.card, target);
    });
    if (mode === 'boss') discard.push(uid);
    resolveCard(card, target);
    if (!alive().length) { finish(true); return; }
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
    const r = Combat.dealDamage({ atk: G.atk, spellPower: G.spellPower || 0 }, foe, amount, type);
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

  function randomDiscoverCard(rarity) {
    const pool = SDT.Cards.all().filter(c =>
      c.rarity !== '衍生' && SDT.Cards.isRandomObtainable(c) && (!rarity || c.rarity === rarity));
    if (!pool.length) return null;
    return pool[Math.floor(Random.random('battle') * pool.length)];
  }

  function processDiscoverQueue() {
    if (discovering || !discoverQueue.length) return;
    const job = discoverQueue.shift();
    const options = [];
    const taken = new Set();
    for (let i = 0; i < 3; i++) {
      const c = randomDiscoverCard(job.rarity);
      if (c && !taken.has(c.id)) { taken.add(c.id); options.push(c); }
    }
    if (!options.length) { G.log('（卡牌库是空的，没有可发现的卡牌）', 'dim'); return; }
    discovering = { options, n: job.n, rarity: job.rarity };
    requestBattleRender();
  }

  function pickDiscover(i) {
    if (!discovering) return;
    const card = discovering.options[+i];
    if (!card) return;
    addTempCard(card);
    G.log(`[[icon:question]] 发现：【<b>${esc(card.name)}</b>】置入手牌（战斗内临时卡，战后消散）`, 'loot');
    const { n, rarity } = discovering;
    discovering = null;
    if (!alive().length) { finish(true); return; }
    if (n > 1) discoverQueue.unshift({ n: n - 1, rarity });
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

  // ---------- 回合结束 ----------
  function endTurn() {
    if (busy || infusing || discovering) return;
    busy = true;
    pendingTarget = null;
    pendingHint = '';
    // —— 玩家回合结束：中毒结算 ——
    const pref = { hp: G.hp, defense: pdef, status: pstat.status };
    const pr = Combat.tickPoison(pref);
    G.hp = Math.max(0, pref.hp);
    if (pr) {
      floats.push({ unit: 'self', text: '-' + pr.dealt, cls: 'hurt' });
      G.log(`[[icon:skull]] 中毒结算：你受到 <b>${pr.dealt}</b> 点固定伤害（${G.hp}/${G.maxHp}）`, 'warn');
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
          if (foe.affix === 'frenzy') frenzyCurse(foe);
        }
      }
      requestBattleRender();
      if (G.hp <= 0) { busy = false; finish(false); return; }
      setTimeout(step, 420);
    };
    setTimeout(step, 420);
  }

  function afterEnemies() {
    // —— 敌人回合结束：中毒结算 + 词缀 ——
    foes.forEach(foe => {
      if (foe.dead) return;
      const er = Combat.tickPoison(foe);
      if (er) {
        floats.push({ unit: foes.indexOf(foe), text: '-' + er.dealt, cls: 'dmg' });
        G.log(`[[icon:skull]] 中毒结算：<b>${esc(foe.name)}</b> 受到 <b>${er.dealt}</b> 点固定伤害（${Math.max(0, foe.hp)}/${foe.maxHp}）`, 'sys');
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
    if (busy || infusing || discovering) return;
    SDT.Sound.sfx('flee');
    G.log('[[icon:runner]] 你撤出了战斗（打出过的卡照常结算）', 'sys');
    finish(null);
  }

  function finish(win) {
    SDT.Sound.sfx(win === true ? 'victory' : win === false ? 'defeat' : 'flee');
    const playedCopy = played.slice();
    const consumedCopy = consumed.slice();
    played = []; consumed = [];
    drawPile = []; hand = []; discard = []; granted = []; grave = [];
    sel = new Set();
    infusing = null; discovering = null; discoverQueue = []; pendingTarget = null; floats = [];
    delayed = []; noDrawNext = false; spellCost1 = false; viewingGrave = false; dreadShown = false; selectingDeck = false;
    G.state = 'idle';
    G.battleActive = false;
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

  function getSnapshot() {
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
    const deckSelection = selectingDeck ? Object.freeze({
      need: R().bossDeckSize,
      starterCount: selShaN,
      selected: Object.freeze([...sel]),
      cards: Object.freeze(selPool.map(entry => Object.freeze({ uid: entry.uid, card: freezeObject(entry.card) }))),
      boss: readonlyFoes[0] || null,
    }) : null;
    return Object.freeze({
      mode, turn, energy, maxEnergy, busy,
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
      pendingTarget: pendingTarget ? Object.freeze({ ...pendingTarget, card: freezeObject(pendingTarget.card) }) : null,
      pendingHint,
      viewingGrave,
      dreadShown,
      deckSelection,
    });
  }

  function openGrave() { viewingGrave = true; requestBattleRender(); }
  function cancelPendingTarget() { pendingTarget = null; pendingHint = ''; requestBattleRender(); }
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

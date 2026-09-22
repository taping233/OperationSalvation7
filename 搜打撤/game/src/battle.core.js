/* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const SDT = window.SDT;
import { esc } from './shared.js';
import { escAttr } from './shared.js';
import { createEffectExecutor, splitEffectClauses, consumeTriggerTexts } from './battle.effects.js';
import { refillDrawPile, shuffleCards } from './battle.deck.js';
import { removeUid } from './battle.piles.js';
import { isAreaEffect, targetSideFor, unplayableReasonFor, itemTargetSideFor } from './battle.rules.js';
import { COMBAT_HOOKS } from './combat.js';
import { createActionQueue } from './battle.actions.js';
import { BATTLE_PHASES, beginTargeting, cancelTargeting, createBattleState, transitionBattle } from './battle.state.js';
import { Random } from './random.js';
import * as Combat from './combat.js';
import { demoMs } from './battle.pace.js';
import { emit as busEmit } from './event-bus.js';
/* battle.core.js —— 战斗逻辑：牌库/出牌结算/词条时点/回合流转（渲染由注入的视图完成） */
// 祝福挂上反馈钩（音频 P2#6）：addBlessing 生效即响，敌我通用——敌人强化同样是可听信息
COMBAT_HOOKS.onBlessing = () => { if (SDT.Sound) SDT.Sound.sfx('buffUp'); };
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
    if (!G || !G.battleActive) return;   // 战斗已收尾：残留重绘一律丢弃（胜利结算后不再盖写后续界面）
    try {
      renderBattle(getSnapshot());
    } catch (e) {
      // 渲染失败不得打断战斗逻辑（否则出牌动作入队前就中断，busy 永久卡死——2026-09-18 实测）
      console.error('[battle] 渲染异常已兜底：', e);
    }
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
  // —— 批次C：统一交互槽（审计 P1「删除 pendingTarget 的多重语义」）——
  // 「等待目标」的三种语义收敛为一个槽：kind 'card'=指向性卡牌 / 'item'=药水点选 / 'slam'=背包砸击。
  // 同一时刻至多一个进行中交互；入场只走 begin*（新交互自动顶替旧交互）；出场只有两条路：
  // resolve*（带目标结算后清槽）与 cancelInteraction（幂等，任何时机可调，无交互时 no-op）。
  // 快照对视图仍派生 pendingTarget / pendingItem / slamPending 三个兼容字段，视图读法不变。
  let interaction = null;        // { kind:'card'|'item'|'slam', uid, card, hint }
  const interactionOf = (kind) => (interaction && interaction.kind === kind ? interaction : null);
  const pendingTargetOf = () => { const i = interactionOf('card'); return i ? { uid: i.uid, card: i.card } : null; };
  const pendingItemOf = () => { const i = interactionOf('item'); return i ? { uid: i.uid, card: i.card } : null; };
  let pendingHint = '';      // 拖拽提示（拖错目标时给出纠正文案）
  let delayed = [];          // 「回合开始时」延迟效果 [{text, cardName, repeat}]（repeat=装备每回合触发）
  let noDrawNext = false;    // 「下回合无法抽牌」标记（下个回合开始消耗掉）
  let viewingGrave = false;  // 正在查看墓地（BOSS 战专属：消耗过的牌 + 类型统计）
  let viewingDeck = false;   // 正在查看牌库（BOSS 战专属，2026-09-13 留言：点击可看牌库中的卡）
  let viewingBag = false;    // 正在查看战斗背包（2026-09-09 老板：战斗中可开背包用道具）
  let floats = [];           // 待展示的飘字/受击特效 [{unit:'self'|敌人idx, text, cls}]（渲染后由视图消费）
  let cardAnims = [];        // 待播放的牌局动画事件 [{kind:'draw'|'play'|'burn'|'dump', uid, name, side, target}]（渲染后由视图消费）
  let presentationActionSeq = 0; // 本场合法动作提交序号；仅供表现层 receipt 去重，不参与规则结算
  const KILL_CHEER = ['漂亮！', '好剑！', '干净利落！'];   // 击杀后自己头上的随机文字欢呼（替代 emoji，配 stk-cheer 小字样式）
  let dreadShown = false;    // BOSS 登场竖线阴影每场只演一次
  let spellCost1 = false;    // 「本局对战内所有法术 1 费」（银河之旅，战斗内永久）
  let meleeCost1 = false;    // 「本局对战内所有招式 1 费」（银河之旅 2026-09-08 描述改版，招式=武术）
  let shaTransform = null;   // 「'杀'化为X」战斗规则（不朽神剑/青龙偃月斩，打出初始攻击时替换）
  let consumeFireballN = 0;  // 「每消耗 1 张卡牌施放 N 次火球」（深渊降焰，降临者英雄）
  let lastDrawnUids = [];    // 最近一次抽牌进手的 uid（万剑归宗「直接释放其中武术」用）
  let lastPlayedType = null; // 上一张打出的卡牌类型（连击箭「上一张是武术→0费」）
  let playedMartialThisTurn = 0; // 本回合已打出的武术数（追斩「每打出一张其他武术→费用-1」，回合开始清零）
  let playedMovesThisTurn = 0;   // 本回合已打出的招式数＝武术+法术（连续射击「每打出一张其他招式→2点固定伤害」，回合开始清零）
  let selPool = [], selShaN = 0, sel = new Set(), lastDeckSel = [], selectingDeck = false, selDeckMax = 15;
  // 「对战开始时」装备（2026-09-16 定版）：并入 15 张套牌——编入即在本场开战自动生效。
  // 旧「单列勾选区」只改 selEquips、从不驱动被动/上限（被动与上限都读 sel），属死 UI，
  // 2026-09-19 审计 P2-6 拆除：selEquipPool/selEquips/lastEquipSel/toggleDeckEquip 全套移除。
  // —— 2026-09-09 机制审计补实装（Q1-Q8 老板定向批次）——
  let allies = [];               // 随从位（征召）：优先替玩家承伤、每回合自动攻击
  let growthNames = new Set();   // 「回合开始时本牌伤害+N」卡名（充能火球）
  let growth = {};               // uid → 已累积的额外伤害（战斗内成长）
  let infuseFuels = 0;           // 本场战斗累计注能牺牲张数（元素符印解锁）
  let sealUnlocked = false;      // 元素符印本局是否已解锁（防重复结算）
  let extraTurn = false;         // 命运钟表：额外回合（跳过敌方阶段一次）
  let deathSave = 0;             // 黑暗吊坠：剩余免致命充能
  let killAtkUp = 0;             // 饮血剑：每消灭 1 敌 +1 攻（本局层数来源）
  let poisonOnSpell = false;     // 毒杖：每打出 1 张法术 → 随机敌附加中毒
  let poisonLegacy = false;      // 腐化之种：本局中毒敌人死亡时层数转移
  // —— 龙巢符文（第二玩法，2026-09-16 定版）——
  let nestRunes = [];
  let nestSyn = {};
  let timeRune = false;          // 时光：正面计时状态不递减
  let arrowRune = false;         // 箭矢：箭释放 2 次
  let unyieldRune = false;       // 不屈：受伤抽 1
  let ashRune = false;           // 灰烬：手牌上限 9、溢出招式直接释放
  let unlimitedRune = false;     // 无限：套牌外招式 -1 费
  let holyRune = false;          // 圣洁：前 3 回合免疫诅咒
  let fireballRuneOn = false;    // 火球：回合开始消耗牌库底并随机放火球
  let freezeRuneOn = false;      // 冰冻：冰冻角色后抽 2
  let swiftRune = false;         // 极速：回合结束打出最左侧手牌
  let timeSpaceRune = false;     // 时空：牌库空时额外回合（一次）
  let timeSpaceUsed = false;
  let armorMul = 1;              // 防御：获得护甲翻倍
  let sealDone = false;          // 受缚之残影：深海封印已破除（化形一次性）
  let playerCurseImmune = false; // 深渊主宰·妲莉薇特：旧日再临——免疫诅咒
  let allSpellsInfused = false;  // 深渊主宰·妲莉薇特：旧日再临——本场所有法术均已注能
  let zeroFeeUntil = new Map();  // 自然法杖：uid → 0 费生效到的回合数（含）
  let cardOverrides = new Map(); // 不变应万变：uid → 战斗内替身卡（不污染背包原卡）
  let equipped = [];             // 已穿戴装备（2026-09-09 老板 #9）：{uid, card, used}，used = 限定技能是否已用
  let freeCast = new Set();      // 需求 #17：「直接释放」的临时卡 uid（打出免费用，仍需选目标）
  let battleRestartCheckpoint = null;   // 战斗中退出后只保存入场检查点，读档从本场开头重开
  let restoringRestartCheckpoint = false;

  const cloneData = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const RUN_RESTART_KEYS = [
    'hp', 'maxHp', 'coins', 'turn', 'atk', 'spellPower', 'inventory', 'ownedCards', 'cardOrder',
    'usedPocket', 'eventLog', 'cardBox', 'nestRunes', 'nestEquipped', 'nestBossName', 'nestTargetedBox',
  ];
  function captureRunRestart(game) {
    const out = {};
    RUN_RESTART_KEYS.forEach(key => { if (Object.prototype.hasOwnProperty.call(game, key)) out[key] = cloneData(game[key]); });
    return out;
  }
  function applyRunRestart(game, state) {
    Object.entries(state || {}).forEach(([key, value]) => { game[key] = cloneData(value); });
  }
  function cardIdentity(card) {
    if (card && card.id) return `id:${card.id}`;
    return `legacy:${card?.name || ''}|${card?.type || ''}|${card?.desc || ''}`;
  }
  const isStarterAttack = card => !!card && (card.id === 'starter-attack' || (!card.id && card.name === '初始攻击'));

  const R = () => SDT.MAP.rules;
  const alive = () => foes.filter(f => !f.dead);
  const AFFIX_META = {
    grow:   { icon: '[[icon:arrow]]', name: '军威',     desc: '每个回合结束时攻击力 +2' },
    frenzy: { icon: '[[icon:tools]]', name: '狂乱',     desc: '每回合攻击两次，每次附加 1 层流血或中毒' },
    aegis:  { icon: '[[icon:crystal]]', name: '元素庇幕', desc: '偶数回合减免所有伤害（破甲可克制）' },
  };
  const INTENT_META = {
    strike: ['[[icon:swords]]', '攻击'], volley: ['[[icon:swords]]', '攻击'], charge: ['[[icon:swords]]', '攻击'],
    guard: ['[[icon:swords]]', '攻击'], burn: ['[[icon:fire]]', '攻击并灼烧'], curse: ['[[icon:skull]]', '攻击并施加诅咒'],
    dragon: ['[[icon:demon]]', '攻击·阶段效果'], general: ['[[icon:arrow]]', '攻击·回合末强化'],
    orc_boss: ['[[icon:tools]]', '双击并施加诅咒'], element_boss: ['[[icon:crystal]]', '攻击·偶数回合庇幕'],
  };
  function intentFor(def, round) {
    const kind = def.behavior || (def.affix === 'grow' ? 'general' : def.affix === 'frenzy' ? 'orc_boss' : def.affix === 'aegis' ? 'element_boss' : 'strike');
    const meta = INTENT_META[kind] || INTENT_META.strike;
    const hits = def.affix === 'frenzy' || kind === 'orc_boss' ? 2 : 1;
    // evenAttack 敌人（恶龙等）：奇数回合蓄力不攻击（与敌方阶段 evenAttack 分支同口径）。
    // 此前意图恒显「攻击·18」却一半回合不动手，预告信任度崩坏（迭代评审 09-20 A-P1）
    if (def.evenAttack && ((round || 1) % 2 === 1)) {
      return { kind, icon: '[[icon:crystal]]', label: '蓄力·下回合行动', damage: null, hits: 1 };
    }
    // 意图实算口径（迭代评审 09-20 A-P1）：敌方普攻实际伤害 = atk + 玩家当前流血层
    // （combat.js ATTACK 分支把目标流血计入 bonus），意图数字按同口径预告并带流血角标
    const bleed = (pstat && pstat.status && pstat.status.bleed) || 0;
    const atk = Math.max(0, def.atk || 0);
    return { kind, icon: meta[0], label: meta[1], damage: atk + bleed, hits, bleedBonus: bleed };
  }

  const shuffle = shuffleCards;

  function pileTip(uids) {
    const cnt = new Map();
    uids.forEach(uid => {
      const o = findCard(uid);
      if (!o) return;
      const key = cardIdentity(o.card);
      const rec = cnt.get(key) || { name: o.card.name, count: 0 };
      rec.count++;
      cnt.set(key, rec);
    });
    return [...cnt.values()].map(rec => `${rec.name}×${rec.count}`).join('，') || '（空）';
  }

  function drawCards(n) {
    let got = 0;
    let drawnToHand = 0;   // 真正入手张数（抽到即施放/灰烬符文直接释放的不占手牌，不计入）
    lastDrawnUids = [];
    while (n-- > 0) {
      if (!drawPile.length && discard.length) {
        const recycled = refillDrawPile(drawPile, discard);
        SDT.Sound.sfx('shuffle');   // 洗牌音（P1#5）：弃牌堆洗回牌库
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
      // 灰烬符文：手牌满 9 张时，放不下的招式直接释放（2026-09-16 Item 定版）
      if (ashRune && hand.length >= 9 && ['武术', '法术'].includes(entry.card.type)) {
        G.log('[[icon:fire]] <b>灰烬符文</b>：手牌已满，直接释放【' + esc(entry.card.name) + '】', 'sys');
        resolveCard(entry.card, alive()[0] || null, false, 0);
        got++;
        continue;
      }
      hand.push(uid);
      lastDrawnUids.push(uid);
      cardAnims.push({ kind: 'draw', uid, name: entry ? entry.card.name : '' });
      got++;
      drawnToHand++;
    }
    // 抽牌反馈音（P1#5）：一批抽牌只播一声，连抽不叠音
    if (drawnToHand > 0 && SDT.Sound) SDT.Sound.sfx('draw');
    checkSealTransformation();   // 受缚之残影：每批抽牌后检查手牌是否集齐 5 张封印之牌
    return got;
  }

  // 文本效果击杀后的死亡补扫（描述直伤/偷攻等不经过 hitFoe 的路径）
  function resolveFoeDefeat(foe, cause = '被击倒') {
    if (!foe || foe.dead || foe.hp > 0) return false;
    foe.dead = true;
    G.log(`[[icon:skull]] <b>${esc(foe.name)}</b> ${cause}！（剩 ${alive().length} 个敌人）`, 'ok');
    floats.push({ unit: foeIdx(foe), text: '', cls: 'stk sticker-boom' });
    floats.push({ unit: 'self', text: KILL_CHEER[Math.floor(Random.random('battle') * KILL_CHEER.length)], cls: 'stk stk-late stk-cheer' });
    // 固定死亡触发顺序：复活替代死亡 → 遗产转移 → 同回合复活击杀 → 首脑胜利。
    if (nestRevive(foe)) return false;
    transferPoisonLegacy(foe);
    nestKillCheck(foe);
    if (foe.boss) {
      finish(true);
      // 首脑死亡会清空动作队列；立即打断当前同步结算，避免胜利后仍继续执行卡牌余句。
      throwIfActionCancelled(activeActionSignal);
    }
    return true;
  }
  function sweepDead() {
    foes.forEach(f => resolveFoeDefeat(f));
  }

  // 腐化之种（cc-rot-seed）：本局打出后，中毒敌人死亡时把中毒层数转移给另一名存活敌人。
  // 三个死亡入口（hitFoe 直伤 / sweepDead 补扫 / afterEnemies 毒发）统一走这里
  function transferPoisonLegacy(deadFoe) {
    if (!poisonLegacy || !deadFoe.status || !(deadFoe.status.poison > 0)) return;
    const next = alive().filter(f => f !== deadFoe)[0];
    const stacks = deadFoe.status.poison;
    if (!next) return;
    deadFoe.status.poison = 0;
    Combat.addCurse(next, 'poison', stacks);
    G.log(`[[icon:skull]] <b>腐化之种</b>：<b>${esc(deadFoe.name)}</b> 的 ${stacks} 层中毒转移给 <b>${esc(next.name)}</b>（当前 ${next.status.poison} 层）`, 'sys');
  }

  // 龙巢：完全形态·元素领主的复活（死亡时以 8 攻 8 心复活一次，清除全部诅咒）
  function nestRevive(foe) {
    if (!foe.revive || foe.revived) return false;
    foe.revived = true;
    foe.dead = false;
    foe.maxHp = foe.revive.hearts;
    foe.hp = foe.revive.hearts;
    foe.atk = foe.revive.atk;
    foe.status = {};
    foe.reviveTurn = turn;
    G.log('[[icon:fire]] <b>完全形态·元素领主</b>：死亡不是终结——以 8 攻 8 心复活（诅咒尽散）。借过！', 'warn');
    return true;
  }
  // 借过：复活体在同回合内被再次击杀
  function nestKillCheck(foe) {
    if (foe.revived && foe.reviveTurn === turn && SDT.Meta) {
      SDT.Meta.track('reviveKill', {});
      G.log('[[icon:trophy]] <b>借过</b>——复活体被当场送走！', 'ok');
    }
  }
  // 龙巢：远古龙尊阶段切换（血量 2/3、1/3 阈值）
  function nestPhase(foe) {
    const frac = foe.hp / foe.maxHp;
    const ph = frac <= 1 / 3 ? 3 : frac <= 2 / 3 ? 2 : 1;
    if (ph === (foe.phase || 1)) return;
    foe.phase = ph;
    if (ph === 3) {
      const dumped = hand.splice(0, hand.length);
      dumped.forEach(u => discard.push(u));
      foe.stunned = true;
      G.log('[[icon:fire]] <b>远古龙尊</b> 狂怒：你的手牌全部被震落！且下个回合蓄力', 'warn');
    } else {
      G.log(`[[icon:fire]] <b>远古龙尊</b> 进入第 ${ph} 阶段`, 'warn');
    }
  }

  let tmpSeq = 0;
  function addTempCard(tpl) {
    const uid = 'bts' + Date.now().toString(36) + (tmpSeq++);
    granted.push({ uid, card: { ...tpl } });
    hand.push(uid);
    cardAnims.push({ kind: 'draw', uid, name: tpl.name || '' });
    // 置入手牌视同「抽到」（2026-09-11 英雄卡审计）：万剑归宗普通战分支走
    // grantStarterAttack→addTempCard，此前不进 lastDrawnUids，「直接释放其中武术」永远放 0 张
    lastDrawnUids.push(uid);
    return uid;
  }
  // 创造一张牌直接插入牌库（「将 x 洗入牌库」用；不进手牌，战后随临时卡消散）
  function addDeckCard(tpl) {
    const uid = 'btd' + Date.now().toString(36) + (tmpSeq++);
    granted.push({ uid, card: { ...tpl } });
    drawPile.push(uid);
    cardAnims.push({ kind: 'shuffle', name: tpl.name || '' });   // 洗入牌动画事件（2026-09-11 需求）
    return uid;
  }
  function grantSha(n) {
    // 普通战的抽牌替代也必须开始新的一批，不能把开场砸击或上次获得的牌算入「其中」。
    lastDrawnUids = [];
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
        if (o && o.card.type === type && hand.length < R().battleHandMax) {
          hand.push(uid);
          moved++;
          lastDrawnUids.push(uid);
          cardAnims.push({ kind: 'draw', uid, name: o.card.name });
        }
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

  // —— 释放手牌中所有匹配「箭/杀/火球」的卡（连弩）；每释放 drawEach 张抽牌；max 限次（百炼青虹剑「一次」）——
  function releaseHandMatches(key, drawEach, max) {
    const re = key === '杀' ? /^(杀|初始攻击)$/ : new RegExp(key);
    let released = 0;
    for (const uid of hand.slice()) {
      if (!alive().length) break;
      if (max && released >= max) break;
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
    // 诅咒施加视觉差分（P1）：包装 addCurse——卡牌文本路径对敌方施加诅咒时推 cursefx 彩闪
    //（玩家自身中诅咒不闪，仍走日志+角标）。Combat 是模块命名空间（属性 only-getter，
    // 不能 Object.create 委托），展开为快照普通对象再覆盖——combat.js 导出全是函数/常量，快照安全。
    combat: {
      ...Combat,
      addCurse(t, key, n) {
        Combat.addCurse(t, key, n);
        if (t && !t.dead && t !== pstat) {
          floats.push({ unit: foeIdx(t), text: '', cls: `cursefx curse-${key}` });
        }
      },
    },
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
    // —— 装备嵌入句「回合开始 -N 血」注册为每回合开始的延迟段（留言 #10 通用机制；灭魔之剑已退役）——
    registerTurnStartText: (text, cardName) => { delayed.push({ text, cardName, repeat: true }); },
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
    sweepDead,
    armorMul: () => armorMul,
    getPlayerClass: () => G.myClass || null,
    getPlayerCaster: () => ({
      atk: G.atk,
      // spellUp 不预加：status 里带着，combat.dealDamage 只加一次（2026-09-09 修复双重计数）
      spellPower: G.spellPower || 0,
      status: pstat ? pstat.status : undefined,
    }),
    foeIndexOf: t => foes.indexOf(t),
    releaseHandMatches,
    autoPlayHandType,
    setShaTransform: name => { shaTransform = name || null; },
    setConsumeFireball: n => { consumeFireballN = n || 0; },
    damagePlayer: n => {
      // 黑暗吊坠死亡保险：致死伤害被挡下，该回合无敌（C11）
      if (n > 0 && G.hp - n <= 0 && deathSave > 0) {
        deathSave--;
        Combat.addBlessing(pstat, 'immune', 1);
        G.log(`[[icon:sparkles]] <b>致命一击被挡下！</b>（死亡保险剩余 ${deathSave} 次，本回合无敌）`, 'ok');
        return;
      }
      G.hp = Math.max(0, G.hp - n);
      if (n > 0 && unyieldRune) { const g = drawCards(1); G.log('[[icon:cards]] <b>不屈符文</b>：受到伤害，抽 ' + g + ' 张牌', 'sys'); }
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
        const o = findCard(u);
        cardAnims.push({ kind: 'dump', uid: u, name: o ? o.card.name : '' });
      });
      return uids.length;
    },
    // —— 2026-09-09 机制审计补实装端口（Q1-Q8 老板定向批次）——
    getInfuseFuels: () => infuseFuels,
    getPriceOfLastDrawn: () => {
      const uid = lastDrawnUids[lastDrawnUids.length - 1];
      const o = uid && findCard(uid);
      return o ? SDT.Cards.sellPrice(o.card) : 0;
    },
    dealAoeFixed: n => {
      alive().slice().forEach(t => {   // 本模块函数名是 alive（此前误写 getAlive，气功波价格伤害一触发即崩）
        const r = Combat.dealDamage({ atk: G.atk }, t, n, Combat.TYPES.FIXED);
        if (r.dealt > 0) floats.push({ unit: foeIdx(t), text: '-' + r.dealt, cls: 'dmg' });
      });
      sweepDead();
    },
    replaceShaInDeck,
    summonAlly,
    setExtraTurn: v => { extraTurn = !!v; },
    setDeathSave: n => { deathSave = n || 0; },
    queuePouchCast,
    registerGrowthCard: card => { if (card && card.name) growthNames.add(card.name); },
    unlockSeal: name => tryUnlockSeal(name),
    randomAcquired: card => fireCatGift(card),
    handCurseSpecs,
    queueSwapCostDiscover,
  });

  const findCard = (uid) => {
    const ov = cardOverrides.get(uid);
    if (ov) return { uid, card: ov };
    return G.ownedCards.find(o => o.uid === uid) || granted.find(o => o.uid === uid) || null;
  };
  const drawOf = (card) => +(card.draw || 0) || SDT.Cards.deriveDraw(card) || 0;
  const infuseOf = (card) => card._noInfuse ? 0 : (+(card.infuse || 0) || SDT.Cards.deriveInfuse(card) || 0);

  // 实际费用：宇宙形态下所有卡牌变为 1 费；「本局对战内所有法术/招式 1 费」（银河之旅）
  // 各自只对法术/武术（招式）生效——两者都是战斗内永久效果（本局对战内词条）；
  // 自然法杖「下回合变为 0 费」按 uid 查 zeroFeeUntil
  const effCostOf = (card, uid) => {
    // 无限符文：套牌（牌盒）外的招式 -1 费——战斗内获得（发现/随机/临时）的招式
    if (unlimitedRune && ['武术', '法术'].includes(card.type) && uid && String(uid).startsWith('bts')) {
      return Math.max(0, (+(card.cost || 0)) - 1);
    }
    if (uid && (zeroFeeUntil.get(uid) || 0) >= turn) return 0;
    if (pstat && pstat.status.cosmosForm > 0) return 1;
    if (spellCost1 && card.type === '法术') return 1;
    if (meleeCost1 && card.type === '武术') return 1;
    const d = String(card.desc || '');
    if (/上一张牌是武术/.test(d) && lastPlayedType === '武术') return 0;
    // 追斩（2026-09-10 需求）：「本回合每打出一张其他武术，费用-1」——按本回合已打出
    // 的武术数折价（招式=武术+法术，但追斩按描述只数武术），最低 0 费
    if (/本回合每打出一张其他武术/.test(d)) return Math.max(0, (+card.cost || 0) - playedMartialThisTurn);
    if (/护甲为\s*0[.。，,]?\s*本牌变为\s*0\s*费/.test(d) && pdef && (pdef.armor || 0) === 0) return 0;
    return card.cost;
  };

  // 群体伤害判定（设计者：群体伤害不用选目标）
  const isAOE = isAreaEffect;

  // ---------- 诅咒之刃（2026-09-10 需求）：收集手牌招式的诅咒 ----------
  // 招式＝武术+法术（设计者定版）。逐条扫描描述里的诅咒句式（与效果引擎的
  // 附加/施加句式同口径），层缺省按 1、破甲/禁疗按引擎缺省 2 回合。
  const CURSE_SCAN = [
    { key: 'bleed',   re: /(?:附加|施加)\s*(?:(\d+)\s*层?)?\s*流血/, def: 1 },
    { key: 'poison',  re: /(?:附加|施加)\s*(?:(\d+)\s*层)?\s*中毒/, def: 1 },
    { key: 'burn',    re: /(?:附加|施加|攻击并)\s*(?:\d+\s*层?\s*)?灼烧/, def: 1 },
    { key: 'freeze',  re: /附加冰冻|冰冻所有|冰冻\s*(?:\d+|[一两二三四五])?\s*名|冻结/, def: 1 },
    { key: 'silence', re: /沉默/, def: 1 },
    { key: 'abreak',  re: /破甲/, def: 2 },
    { key: 'healban', re: /禁疗/, def: 2 },
  ];
  function curseSpecsOfDesc(desc) {
    desc = String(desc || '');
    const out = [];
    CURSE_SCAN.forEach(({ key, re, def }) => {
      const m = desc.match(re);
      if (m) out.push({ key, n: Math.max(1, +(m[1] || def) || def) });
    });
    return out;
  }
  // 合并当前手牌所有招式的诅咒：可叠加诅咒（流血/中毒）层数累加，其余同 key 取最高
  function handCurseSpecs() {
    const merged = new Map();
    hand.forEach(u => {
      const o = findCard(u);
      const c = o && o.card;
      if (!c || !['武术', '法术'].includes(c.type)) return;
      curseSpecsOfDesc(c.desc).forEach(s => {
        const stack = Combat.CURSE_META[s.key] && Combat.CURSE_META[s.key].stack;
        merged.set(s.key, stack ? (merged.get(s.key) || 0) + s.n : Math.max(merged.get(s.key) || 0, s.n));
      });
    });
    return [...merged.entries()].map(([key, n]) => ({ key, n }));
  }

  // 迷之匣「限定技能：发现两张随机招式，交换其费用」（2026-09-10 需求）：
  // 排队两次「三选一」发现（招式＝武术+法术，随机池同口径），两张都置入手牌后
  // 由 swapCardCosts 互换费用。pair 数组被两次发现任务共享，作为累计载体。
  function queueSwapCostDiscover() {
    const pool = SDT.Cards.all().filter(c => ['武术', '法术'].includes(c.type) && SDT.Cards.isRandomObtainable(c));
    if (pool.length < 2) {
      G.log('[[icon:cross]] <b>迷之匣</b>：卡牌库中没有足够的随机招式可供发现', 'warn');
      return;
    }
    const pair = [];
    const pred = c => ['武术', '法术'].includes(c.type);
    discoverQueue.push({ n: 1, pred, act: 'swapCost', swapPair: pair });
    discoverQueue.push({ n: 1, pred, act: 'swapCost', swapPair: pair });
    G.log('[[icon:question]] <b>迷之匣</b>：发现两张随机招式——它们打出前会交换费用', 'sys');
  }
  function swapCardCosts(uidA, uidB) {
    const a = findCard(uidA), b = findCard(uidB);
    if (!a || !b) return;
    const costA = Math.max(0, +(b.card.cost || 0));
    const costB = Math.max(0, +(a.card.cost || 0));
    cardOverrides.set(uidA, { ...a.card, cost: costA });
    cardOverrides.set(uidB, { ...b.card, cost: costB });
    G.log(`[[icon:sparkles]] <b>交换费用</b>：【${esc(a.card.name)}】费用变为 <b>${costA}</b>，【${esc(b.card.name)}】费用变为 <b>${costB}</b>`, 'sys');
  }

  // ---------- 生效时刻 / 持续时间 / 生效条件（设计者 2026-09-02 定版） ----------
  // 卡牌描述按句切分（。；；换行），每句归入一种生效方式：
  //   「回合开始时：X / 下回合开始：X」 → 生效时刻词条：X 延迟到下个回合开始结算
  //     （装备卡是战斗内持续物件，其延迟段每回合开始重复触发；其余一次性）
  //   「本局对战内 / 本场战斗(中)…」   → 持续时间词条：整场战斗有效，离开战斗失效
  //   「被注能时：X」                  → 生效条件词条：只有作为注能牺牲品被消耗时
  //     才结算 X（打出时跳过——牺牲品没有被「使用」，主效果不触发）；未来会有更多条件
  //   其余句子 → 立即生效
  const splitClauses = splitEffectClauses;

  // 注册「回合开始时」延迟段（2026-09-09 老板定向 Q3）：
  //   repeat = 装备卡 /「每回合开始时」/ 能力卡或形态卡（形态=每回合）→ 每回合开始触发；
  //   「持续 N 回合」= 重复 N 次（left 计数递减）；其余一次性
  function registerTurnStart(card, items) {
    const descDur = +(((String(card.desc || '').match(/持续\s*(\d+)\s*回合/)) || [])[1] || 0);
    const formLike = card.type === '能力卡' || /形态/.test(String(card.name || ''));
    items.forEach(it => {
      const dur = +(((String(it.text).match(/持续\s*(\d+)\s*回合/)) || [])[1] || 0) || descDur;
      let repeat = card.type === '装备' || it.each || formLike;
      let left = null;
      if (!repeat && dur > 0) { repeat = true; left = dur; }   // 持续 N 回合 = 重复 N 次
      delayed.push({ text: it.text, cardName: card.name, repeat, left });
      G.log(`[[icon:hourglass]] <b>回合开始时</b>：【${esc(card.name)}】${esc(it.text)}（下个回合开始${repeat ? (left ? `起共 ${left} 次` : '起每回合') : ''}生效）`, 'sys');
    });
  }

  // 回合开始：结算延迟段（沉默中技能无效——一次性段被吞掉，重复段保留到下回合；
  // notBeforeTurn = 花开两面未选之门「两回合后」的定时刻；special = 江湖救急临时卡消耗）
  function processDelayed() {
    if (!delayed.length) return;
    const silenced = (pstat.status.silence || 0) > 0;
    const keep = [];
    delayed.forEach(q => {
      if (q.notBeforeTurn && turn < q.notBeforeTurn) { keep.push(q); return; }
      if (q.special === 'consumeTemps') {
        consumeHandUids(q.uids || [], q.cardName);
        return;   // 一次性，不保留
      }
      if (silenced) {
        G.log(`[[icon:cross]] 沉默中：【${esc(q.cardName)}】的回合开始效果无法生效`, 'warn');
      } else {
        G.log(`[[icon:hourglass]] <b>回合开始时</b>：【${esc(q.cardName)}】${esc(q.text)}`, 'sys');
        applyTextEffects({ name: q.cardName }, q.text, alive()[0] || null);
      }
      if (q.repeat) {
        if (typeof q.left === 'number') { q.left -= 1; if (q.left > 0) keep.push(q); }
        else keep.push(q);
      }
    });
    delayed = keep;
  }

  // 「回合开始时，本牌伤害+N」成长：所有在场/在库副本按 uid 累积（充能火球）
  function accrueGrowth() {
    if (!growthNames.size) return;
    [...hand, ...drawPile, ...discard, ...grave].forEach(uid => {
      const o = findCard(uid);
      if (o && growthNames.has(o.card.name)) growth[uid] = (growth[uid] || 0) + 1;
    });
  }

  // 「本局对战内」持续效果：注册并结算其中已支持的部分（增益本身即战斗内长期有效）
  function registerBattle(card, clause, target) {
    G.log(`[[icon:question]] <b>本局对战内</b>：${esc(clause)}（整场战斗有效，离开战斗失效）`, 'ok');
    const inner = clause.replace(/^(本局对战内|本场对战|本场战斗)[中内]?[：:，,]?\s*/, '');
    // 银河之旅（迭代评审 09-20 终裁）：desc 已定稿「你的所有武术均为 1 费」——
    // 触发正则补「武术」分支；实装只降武术（:530），「所有卡牌」是宇宙形态的口径，不得混同
    if (/所有(?:法术|招式|武术)[^。]*?1\s*费/.test(inner)) {
      if (/所有招式|所有武术/.test(inner)) {
        meleeCost1 = true;
        G.log('[[icon:sparkles]] 持续规则：你的所有武术均按 <b>1</b> 费打出', 'ok');
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
  // fuelCost = 注能牺牲品费用合计，供「N 倍于被注能卡牌价格」类效果折算；uid = 成长/容器定位）
  function resolveCard(card, target, infused, fuelCost, uid) {
    // 血毒双镖（2026-09-16 留言「血毒双镖应该能选择两次目标」）：两段拆开——首段（攻+1 附加流血）
    // 随本牌目标结算；二段（攻+1 附加中毒）由 execPlay 收尾进入点选（interaction 'dart'），
    // 可另选目标或重复选择同一目标
    let desc = String(card.desc || '');
    if (card.id === 'tt7-bloodpoison') desc = '攻（+1），附加流血。';
    // 江湖救急（2026-09-18 老板定版）：「随机直接给 3 张」才是本意——不走发现面板。
    // 随机池与发现同口径（isRandomObtainable），置入的临时卡在下个回合开始时消耗。
    if (card.id === 'cmtn1wnhhym') {   // 仅限实机版 id——同名旧卡 tt2-jianghu 有自己的发现流程
      const pool = SDT.Cards.all().filter(c => SDT.Cards.isRandomObtainable(c));
      const uids = [];
      for (let k = 0; k < 3 && pool.length; k++) {
        const c = pool[Math.floor(Random.random('battle') * pool.length)];
        uids.push(addTempCard({ ...c }));
      }
      if (uids.length) {
        delayed.push({ special: 'consumeTemps', uids, cardName: card.name });
        G.log(`[[icon:cards]] <b>${esc(card.name)}</b>：随机获得 ${uids.length} 张临时卡牌（下个回合开始时消耗）`, 'loot');
      }
      return;
    }
    // 搜索大宝箱「探宝」（2026-09-17 留言「探宝没有从牌库底发现卡牌，而是随机发现」）：
    // BOSS 战改为从牌库底发现——三张候选就是牌库底的真实卡牌，选 1 张入手、其余按原顺序放回牌库底；
    // 普通战斗没有牌库，维持随机发现口径。探宝只有发现效果，结算完直接收尾。
    if (card.id === 'cmtn28jv33wx' && mode === 'boss' && drawPile.length) {
      const take = Math.min(3, drawPile.length);
      const uids = drawPile.splice(0, take);   // 数组头部 = 牌库底
      const cards = uids.map(u => { const o = findCard(u); return o ? o.card : null; }).filter(Boolean);
      if (cards.length) {
        queueDiscover({ n: cards.length, explicit: cards, explicitUids: uids, deckBottom: true });
        G.log(`[[icon:question]] <b>${esc(card.name)}</b>：翻开牌库底 ${cards.length} 张——选 1 张入手，其余放回牌库底`, 'loot');
      }
      return;
    }
    const parts = splitClauses(desc);
    // 「限定技能：」装备：打出只穿戴，技能句留给角色信息区的技能按钮发动（2026-09-09 老板 #9）。
    // 卡面若只有技能句，结构化 heal/armor/draw 兜底也一并跳过，否则穿戴即自动放了一次技能。
    const skillOnly = parts.skill.length > 0 && !parts.immediate.length && !parts.turnStart.length &&
      !parts.battle.length && !parts.onInfused.length && !parts.onDraw.length;
    let did = false;
    const isDmgType = SDT.Cards.DMG_TYPES.includes(card.type);
    let structuredHit = false;
    // —— 伤害（卡面伤害词条立即结算，不受沉默影响） ——
    if (isDmgType && ((+card.dmg || 0) > 0 || card.dmgType === 'attack')) {
      structuredHit = true;
      const type = SDT.Cards.DMG_TYPE_META[card.dmgType] ? card.dmgType : Combat.TYPES.FIXED;
      let dmgVal = (+card.dmg || 0) + ((uid && growth[uid]) || 0);   // 充能火球：回合成长
      if (uid && growth[uid]) G.log(`[[icon:fire]] <b>${esc(card.name)}</b>：回合成长 +${growth[uid]}（基础 ${+card.dmg || 0}）`, 'sys');
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
        times = playedMovesThisTurn;
        G.log(times > 0
          ? `[[icon:swords]] <b>${esc(card.name)}</b>：本回合已打出 ${times} 张招式，固定伤害触发 ${times} 次`
          : `[[icon:cross]] <b>${esc(card.name)}</b>：本回合还没有打出其他招式，不造成伤害`, times > 0 ? 'sys' : 'dim');
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
            // 致命穿刺：若对方处于流血状态，伤害 +2（2026-09-09 补实装）
            const pierceB = desc.match(/若对方[^。]*?流血[^。]*?伤害\s*\+\s*(\d+)/);
            if (pierceB && (foe.status.bleed || 0) > 0) {
              foeDmg += +pierceB[1];
              if (i === 0) G.log(`[[icon:blood]] <b>${esc(foe.name)}</b> 处于流血状态，伤害 +${pierceB[1]}`, 'sys');
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
          floats.push({ unit: 'self', text: '', cls: 'stk sticker-heal', warm: true });
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
      // 击杀连锁（余烬爆裂）：「若击杀敌人，再施放一次」——本段伤害击杀过敌人时，存活目标再结算一段
      if (/若击杀(?:任何)?敌人[^。；]*再施放一次/.test(desc) && targets.some(t => t.dead)) {
        G.log(`[[icon:sparkles]] <b>${esc(card.name)}</b>：击杀敌人，再施放一次`, 'sys');
        targets.forEach(foe => { if (!foe.dead) hitFoe(foe, card, dmgVal, type, '（再施放）'); });
      }
      did = true;
    }
    // 沉默：除攻击外的技能效果全部失效（延迟段与持续段也不注册）
    if ((pstat.status.silence || 0) > 0) {
      G.log(`[[icon:cross]] <b>${esc(card.name)}</b> 的技能效果被沉默封印（只剩攻击生效，持续 ${pstat.status.silence} 回合）`, 'warn');
      return;
    }
    // 法力奔涌（2026-09-10 需求 #37/#38）：「对随机敌人释放4个随机法术（这些随机法术默认已注能）」。
    // 识别加名称/ID 兜底——旧档背包里的快照克隆可能带着旧措辞描述，正则失配曾导致整卡无效果。
    const surgeM = desc.match(/对随机敌人释放\s*(\d+|四)\s*个随机法术/);
    if (surgeM || card.id === 'cc-mana-surge' || /法力奔涌/.test(String(card.name || ''))) {
      surgeWaiter = castRandomSpells(surgeM ? (surgeM[1] === '四' ? 4 : Math.max(1, +surgeM[1])) : 4, card.id);
      did = true;
    }
    // —— 立即生效句（逐句结算：句与句不再用「，」拼接——拼接曾污染花开两面的抉择选项，
    //     也让 A 句未识别时吞掉 B 句的独立结算机会）——
    // 例外：神灯类「抉择：1° …；2° …」的编号续句（^\d° 开头）必须并回抉择主句，
    // 否则选项会被拆成独立子句抢先自动结算（2026-09-12 回归修复）
    const imm = [];
    parts.immediate.forEach(cl => {
      if (/^\s*\d\s*[°º]/.test(cl) && imm.length && /抉择[:：]/.test(imm[imm.length - 1])) imm[imm.length - 1] += '，' + cl;
      else imm.push(cl);
    });
    let healed = false, armored = false, drawn = false;
    imm.forEach(cl => {
      // 双镖首段若已击杀原目标，流血不得借文本执行器的空目标回退串到下一名活敌人。
      if (card.id === 'tt7-bloodpoison' && target && target.dead && /流血/.test(cl)) return;
      const res = applyTextEffects(card, cl, target, { structuredHit, infused, fuelCost, uid });
      did = did || res.did;
      healed = healed || res.healed;
      armored = armored || res.armored;
      drawn = drawn || res.drawn;
    });
    // 结构化词条兜底（描述未写明但制作坊标注了回复/护甲/抽卡字段时）
    if (!healed && !skillOnly && +(card.heal || 0) > 0) {
      const n = +(card.heal || 0);
      if ((pstat.status.healban || 0) > 0) {
        G.log(`[[icon:heart]] 禁疗中：回复 ${n} 点生命无效（还剩 ${pstat.status.healban} 回合）`, 'warn');
      } else { G.heal(n); floats.push({ unit: 'self', text: '', cls: 'stk sticker-heal', warm: true }); }
      did = true;
    }
    if (!armored && !skillOnly && +(card.armor || 0) > 0) {
      pdef.armor += +(card.armor || 0);
      G.log(`[[icon:plate]]获得 ${+(card.armor || 0)} 点护甲`, 'sys');
      did = true;
    }
    // 卡面结构化抽卡字段兜底（描述未写「抽 N 张牌」时）
    if (!drawn && !skillOnly && drawOf(card) > 0) {
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
    if (!did && !skillOnly) G.log(`[[icon:play]] <b>${esc(card.name)}</b>：该效果在 M1 后续实装（占位）`, 'dim');
  }

  // 法力奔涌的随机法术释放（2026-09-10 需求）：
  // 池子与「发现/随机获取」同口径（isRandomObtainable：排除 初始/职业/衍生/棱彩与 unrandom），
  // 并排除本牌自身，避免「释放随机法术」抽到自己无限递归。
  // 每发对随机存活敌人以 infused=true 直接结算——随机法术的「注能(N)：…」加成句照常生效，
  // 且无需消耗手牌燃料（＝"默认已注能"）。
  // 慢动作节拍（2026-09-16 留言「法力奔涌应当慢动作打出4张卡牌」）：逐发等待给视图时间
  // 演出每一发；vitest 环境置 0 保持回归测试节奏。动作在 execPlay 内被 await，
  // 演出期间 busy 保持、玩家无法插手。
  const SURGE_WAVE_MS = (typeof process !== 'undefined' && process.env && process.env.VITEST) ? 0 : 850;
  let activeActionSignal = null;
  function actionCancellationError(signal) {
    const reason = signal?.reason;
    if (reason instanceof Error) return reason;
    const error = new Error(String(reason || 'battle action cancelled'));
    error.name = 'BattleActionCancelledError';
    return error;
  }
  function throwIfActionCancelled(signal) {
    if (signal?.aborted) throw actionCancellationError(signal);
  }
  const surgeSleep = (ms, signal) => new Promise((resolve, reject) => {
    throwIfActionCancelled(signal);
    const timer = setTimeout(done, ms);
    function cleanup() { signal?.removeEventListener('abort', cancel); }
    function done() { cleanup(); resolve(); }
    function cancel() { clearTimeout(timer); cleanup(); reject(actionCancellationError(signal)); }
    signal?.addEventListener('abort', cancel, { once: true });
  });
  let surgeWaiter = null;          // 正在进行的奔涌演出（execPlay 在结算后 await 它）
  const takeSurge = async (signal) => {
    const p = surgeWaiter;
    surgeWaiter = null;
    if (p) await p;
    throwIfActionCancelled(signal);
  };
  async function castRandomSpells(n, sourceId, signal = activeActionSignal) {
    try {
    const pool = SDT.Cards.all().filter(c =>
      c.type === '法术' && c.id !== sourceId && SDT.Cards.isRandomObtainable(c));
    if (!pool.length) {
      G.log('[[icon:cross]] <b>法力奔涌</b>：卡牌库中没有可释放的随机法术', 'warn');
      return;
    }
    for (let i = 0; i < n; i++) {
      throwIfActionCancelled(signal);
      sweepDead();
      const targets = alive();
      if (!targets.length) break;   // 敌人全灭则停止余下的释放
      const spell = pool[Math.floor(Random.random('battle') * pool.length)];
      const t = targets[Math.floor(Random.random('battle') * targets.length)];
      cardAnims.push({ kind: 'surge', i: i + 1, n, name: spell.name, target: foes.indexOf(t), targetName: t.name, card: { ...spell } });   // 慢动作演出事件
      G.log(`[[icon:sparkles]] <b>法力奔涌</b>（第 ${i + 1}/${n} 发）：对 <b>${esc(t.name)}</b> 释放随机法术【<b>${esc(spell.name)}</b>】（默认已注能）`, 'loot');
      resolveCard(spell, t, true, 0, null);
      if (SURGE_WAVE_MS > 0) { requestBattleRender(); await surgeSleep(SURGE_WAVE_MS, signal); }
    }
    throwIfActionCancelled(signal);
    sweepDead();
    } catch (err) {
      if (err?.name === 'BattleActionCancelledError') throw err;
      console.error('[surge] 奔涌演出异常已兜底：', err);
    }
  }

  // ---------- 已穿戴装备（2026-09-09 老板 #9）----------
  // 打出装备卡即视为穿戴：角色信息区列出装备与说明；带「主动技能：」的装备额外提供一个
  // 可点击技能（每场一次），技能文本交真实执行器结算（各装备句式早已实装）。
  // 2026-09-16 留言「将装备的限定技能改成主动技能」：措辞改主动技能，兼容旧档快照里的「限定技能」
  const EQUIP_SKILL_PATTERN = /(?:主动技能|限定技能)[：:]\s*([^。]*(?:。|$))/;
  function equipSkillText(card) {
    const m = EQUIP_SKILL_PATTERN.exec(String(card && card.desc || ''));
    return m ? m[1].trim() : '';
  }
  function registerEquip(uid, card) {
    if (!card || card.type !== '装备') return;
    if (equipped.some(e => e.uid === uid)) return;
    equipped.push({ uid, card, used: false });
    G.log(`[[icon:tools]] 装配【<b>${esc(card.name)}</b>】（${equipped.filter(e => !e.passive).length}/${equipCap()} 件）${equipSkillText(card) ? '——主动技能已就绪' : ''}`, 'ok');
    syncCurseCondEquips();   // 条件装备（深海印记类）穿上时即按当前诅咒状态核算
  }
  // 需求 #18（2026-09-09）：装备最多同时装配 2 件；圣剑化身「装备上限 +1」生效
  function equipCap() {
    let bonus = 0;
    (G.ownedCards || []).forEach(o => {
      const m = o.card && String(o.card.desc || '').match(/装备上限\s*\+\s*(\d+)/);
      if (m) bonus += +m[1];
    });
    if (nestSyn.grass3) return 99;            // 3 草：装备栏无上限
    return 2 + bonus + (nestSyn.grass1 ? 1 : 0);   // 1 草：装备上限 +1
  }

  // ---------- 条件装备「诅咒状态下，攻 +N，法伤 +M」（深海印记/深海咒印）----------
  // 2026-09-09 留言 #2：按一次性结算时「未诅咒时穿=永不生效、诅咒后穿=永久增益」都与卡面
  // 「诅咒状态下」语义不符。改为穿戴期间动态核算：身负诅咒 → 加成生效，解除 → 自动扣除。
  const CURSE_COND_EQUIP = /诅咒状态[下时]/;
  function syncCurseCondEquips() {
    if (!equipped || !equipped.length) return;
    const cursed = Combat.hasCurse(pstat);
    equipped.forEach(e => {
      const desc = String(e.card && e.card.desc || '');
      if (e.card.type !== '装备' || !CURSE_COND_EQUIP.test(desc) || equipSkillText(e.card)) return;
      const atkM = desc.match(/攻\s*\+\s*(\d+)/) || desc.match(/攻击\s*\+\s*(\d+)/);
      const spM = desc.match(/法伤\s*\+\s*(\d+)/);
      const want = cursed ? { atk: atkM ? +atkM[1] : 0, sp: spM ? +spM[1] : 0 } : { atk: 0, sp: 0 };
      const had = e._condApplied || { atk: 0, sp: 0 };
      const dAtk = want.atk - had.atk, dSp = want.sp - had.sp;
      if (!dAtk && !dSp) return;
      if (dAtk) Combat.addBlessing(pstat, 'atkUp', dAtk);
      if (dSp) Combat.addBlessing(pstat, 'spellUp', dSp);
      e._condApplied = want;
      G.log(want.atk || want.sp
        ? `[[icon:crystal]] <b>${esc(e.card.name)}</b>：身负诅咒，条件加成生效（攻 +${want.atk}${want.sp ? `，法伤 +${want.sp}` : ''}）`
        : `[[icon:cross]] <b>${esc(e.card.name)}</b>：诅咒解除，条件加成收回`, want.atk || want.sp ? 'ok' : 'dim');
    });
  }
  function useEquipSkill(uid) {
    if (busy || infusing || discovering || choosing || handSelecting) return;
    const e = equipped.find(x => x.uid === uid);
    if (!e) return;
    const text = equipSkillText(e.card);
    if (!text) return;
    if (e.used) { G.log(`[[icon:cross]] 【${esc(e.card.name)}】的主动技能本场已经用过了`, 'warn'); return; }
    // 魔法锅炉的「注能」是装备技能代价：先强制消耗 2 张手牌，完成后随机入手 3 张，
    // 不走「发现」面板。燃料不足时不消耗本场唯一一次技能。
    if (e.card.id === 'tt3eq-boiler') {
      const need = 2;
      if (hand.length < need) {
        G.log(`[[icon:flask]] 【${esc(e.card.name)}】注能(${need}) 需要消耗 ${need} 张手牌，当前只有 ${hand.length} 张`, 'warn');
        return;
      }
      e.used = true;
      G.log(`[[icon:sparkles]] <b>${esc(e.card.name)}</b> 主动技能：注能(${need})，随机获取 3 张卡牌`, 'ok');
      handSelectQueue.push({
        n: need, act: 'consume', mandatory: true, srcCard: e.card,
        onDone: () => {
          const got = [];
          for (let i = 0; i < 3; i++) {
            const card = randomDiscoverCard(null);
            if (!card) break;
            addTempCard(card);
            fireCatGift(card);
            got.push(card.name);
          }
          G.log(`[[icon:cards]] <b>${esc(e.card.name)}</b>：随机获取 ${got.length} 张卡牌${got.length ? `（${got.map(esc).join('、')}）` : ''}`, 'loot');
        },
      });
      processHandSelect();
      requestBattleRender();
      return;
    }
    e.used = true;
    G.log(`[[icon:sparkles]] <b>${esc(e.card.name)}</b> 主动技能：${esc(text)}`, 'ok');
    applyTextEffects(e.card, text, alive()[0] || null, {});
    sweepDead();
    if (!alive().length) { finish(true); return; }
    processChoice();
    processDiscoverQueue();
    requestBattleRender();
  }
  // ---------- 开战被动（2026-09-09 老板定向 Q1）：描述带「对战开始时」的装备卡，持有即自动生效 ----------
  // 2026-09-10 留言 #35 定版改为「勾选生效」：编组时玩家勾选哪些开战装备，战斗开始才装配哪些。
  const isBattleStartEquip = (card) => !!card && card.type === '装备' && /对战开始时/.test(String(card.desc || ''));
  function applyBattleStartPassives() {
    // 对战开始时的装备只能在 BOSS 战中使用（2026-09-10 需求）：普通战斗不再自动生效
    if (mode !== 'boss') return;
    const chosen = (G.ownedCards || []).filter(o => o.card && isBattleStartEquip(o.card) && sel.has(o.uid));
    // 开战被动同样算「已穿戴」——角色信息区一并列出（老板 #9）；
    // passive=true：不占用 #18 的 2 件装配上限（勾选即生效，未经打出装配）
    chosen.forEach(o => {
      if (!equipped.some(e => e.uid === o.uid)) equipped.push({ uid: o.uid, card: o.card, used: false, passive: true });
    });
    if (!chosen.length) return;
    G.log(`[[icon:bolt]] 开战被动：${chosen.map(o => esc(o.card.name)).join('、')} 自动生效`, 'ok');
    chosen.forEach(o => {
      const parts = splitClauses(String(o.card.desc || ''));
      const text = parts.immediate.join('，');
      if (text) applyTextEffects(o.card, text, alive()[0] || null, {});
    });
  }
  // 混沌之眼「牌库上限 +N」：BOSS 编组可带张数加成（2026-09-10 #35 起按「编组勾选」计算）
  function deckCapBonus(uids) {
    let bonus = 0;
    (G.ownedCards || []).forEach(o => {
      if (!o.card || !isBattleStartEquip(o.card) || !(uids || sel).has(o.uid)) return;
      const m = String(o.card.desc).match(/牌库上限\s*\+\s*(\d+)/);
      if (m) bonus += +m[1];
    });
    return bonus;
  }
  // 迷之匣「对战开始时，将 2 张杀替换为随机卡牌」
  function replaceShaInDeck(n) {
    if (mode !== 'boss') return 0;
    let done = 0;
    const rest = [];
    for (const uid of drawPile) {
      const o = findCard(uid);
      const isSha = o && (o.card.name === '初始攻击' || o.card.name === '杀');
      if (isSha && done < n) { done++; continue; }
      rest.push(uid);
    }
    drawPile = rest;
    for (let i = 0; i < done; i++) {
      const pool = SDT.Cards.all().filter(c => SDT.Cards.isRandomObtainable(c));
      if (pool.length) addDeckCard(pool[Math.floor(Random.random('battle') * pool.length)]);
    }
    return done;
  }
  // —— 随从位（2026-09-09 老板定向 Q4）：征召步兵等——优先替玩家承伤、每回合自动攻击 ——
  function summonAlly(name, atk, hp, n, statless) {
    for (let i = 0; i < (n || 1); i++) {
      // statless：无攻击力与血量的场面物件（封印肢体，同天国之门口径）——
      // 不自动攻击、不替主人承伤、不参与hp结算
      allies.push({ name, atk: statless ? 0 : atk, hp: statless ? null : hp, maxHp: statless ? null : hp, dead: false, statless: !!statless, status: {}, defense: { shield: 0, armor: 0, guard: false } });
    }
  }
  function poisonRandomFoe() {
    const ts = alive();
    if (!ts.length) return;
    const t = ts[Math.floor(Random.random('battle') * ts.length)];
    Combat.addCurse(t, 'poison', 1);
    G.log(`[[icon:skull]] <b>毒杖</b>：${esc(t.name)} 附加 1 层中毒`, 'sys');
  }
  // 阿猫的礼物（tt2-apollo，2026-09-12 实装）：「发现或随机获取该牌时，回复1点能量并获取另1张随机卡牌」
  // 战斗内触发：+1 能量 + 随机卡置入手牌（临时卡）；地图侧触发见 grantEventCard（地图无能量概念，只发额外卡）
  const CAT_GIFT_ID = 'tt2-apollo';
  function fireCatGift(card) {
    if (!card || card.id !== CAT_GIFT_ID) return;
    energy += 1;
    G.log(`[[icon:bolt]] <b>阿猫的礼物</b>：回复 1 点能量（当前 ${energy}/${maxEnergy}）`, 'ok');
    const pool = SDT.Cards.all().filter(c => SDT.Cards.isRandomObtainable(c) && c.id !== CAT_GIFT_ID);
    if (!pool.length) return;
    const uid = addTempCard(pool[Math.floor(Random.random('battle') * pool.length)]);
    const o = findCard(uid);
    G.log(`[[icon:cards]] <b>阿猫的礼物</b>：获得【<b>${esc(o ? o.card.name : '?')}</b>】置入手牌（战斗内临时卡，战后消散）`, 'loot');
  }
  // 「消耗该牌时」触发（Q2 老板定向：注能牺牲与手选消耗都算「消耗」）
  function fireConsumeTriggers(card, target) {
    (consumeTriggerTexts(card && card.desc)).forEach(text => {
      G.log(`[[icon:flask]] <b>消耗该牌时</b>：【${esc(card.name)}】${esc(text)}`, 'sys');
      applyTextEffects(card, text, target || (alive()[0] || null), {});
    });
  }
  // 元素符印「累计注能 3 张后解锁：法伤+2，抽2张」——单点结算，防被动与主动双发
  function tryUnlockSeal(name) {
    if (sealUnlocked) { G.log(`[[icon:crystal]] 【${esc(name)}】已处于解锁状态（跳过重复结算）`, 'dim'); return; }
    sealUnlocked = true;
    Combat.addBlessing(pstat, 'spellUp', 2);
    const got = mode === 'boss' ? drawCards(2) : (grantSha(2), 2);
    G.log(`[[icon:crystal]] <b>元素符印解锁</b>：法伤 +2${mode === 'boss' ? `，抽了 ${got} 张牌` : '，获得 2 张【初始攻击】'}`, 'ok');
  }
  // 击杀钩子（C1）：饮血剑 = 本局被动每杀 +1 攻；破甲重斩/闪金之锤 = 该卡自身击杀触发
  function applyKillRewards(card, kills) {
    if (kills <= 0) return;
    if (killAtkUp > 0) {
      Combat.addBlessing(pstat, 'atkUp', killAtkUp * kills);
      G.log(`[[icon:swords]] <b>饮血剑</b>：消灭 ${kills} 个敌人，攻击力 +${killAtkUp * kills}（当前加成 ${pstat.status.atkUp}）`, 'ok');
    }
    if (!card) return;
    const d = String(card.desc || '');
    const armorM = d.match(/击杀(?:敌人)?(?:时|则)?[^。；]*?\+\s*(\d+)\s*甲/);
    if (armorM) {
      pdef.armor += +armorM[1] * kills;
      G.log(`[[icon:plate]] <b>${esc(card.name)}</b>：击杀敌人，+${+armorM[1] * kills} 甲（当前 ${pdef.armor}）`, 'ok');
    }
    const coinM = d.match(/若击杀敌人[，,]?\s*\+\s*(\d+)\s*币/);
    if (coinM) {
      G.coins = (G.coins || 0) + +coinM[1] * kills;
      G.log(`[[icon:coin]] <b>${esc(card.name)}</b>：击杀敌人，+${+coinM[1] * kills} 币`, 'loot');
    }
  }
  // 江湖救急：回合开始将其置入的临时卡消耗（会正确触发「每消耗 1 张」联动）
  function consumeHandUids(uids, cardName) {
    let n = 0;
    (uids || []).forEach(u => {
      const idx = hand.indexOf(u);
      if (idx < 0) return;
      hand.splice(idx, 1);
      consumed.push(u);
      if (mode === 'boss') grave.push(u);
      const o = findCard(u);
      cardAnims.push({ kind: 'burn', uid: u, name: o ? o.card.name : '' });
      if (o) resolveInfusedFuel(o.card, alive()[0] || null);
      if (consumeFireballN > 0) {
        for (let k = 0; k < consumeFireballN; k++) {
          const t = alive()[0];
          if (!t) break;
          const r = Combat.dealDamage({
            atk: G.atk,
            spellPower: G.spellPower || 0,   // spellUp 由 status 传入只算一次（2026-09-09 修复双重计数）
            status: pstat.status,
          }, t, 4, Combat.TYPES.SPELL);
          if (r.dealt > 0) floats.push({ unit: foeIdx(t), text: '-' + r.dealt, cls: 'dmg' });
          G.log(`[[icon:fire]] 深渊降焰：施放 1 次火球 → ${esc(t.name)}：造成 <b>${r.dealt}</b> 点法术伤害`, 'sys');
          sweepDead();
        }
      }
      n++;
    });
    if (n) G.log(`[[icon:flask]] <b>${esc(cardName || '临时卡')}</b>：回合开始，消耗了 ${n} 张临时卡`, 'sys');
    return n;
  }
  // 法师锦囊容器（Q5 老板定向）：自带 1×3 空间——空时自动置入 3 张随机法术，打出时选 1 张直接施放
  function queuePouchCast(uid) {
    const entry = findCard(uid);
    if (!entry) return;
    // 2026-09-16 定版：锦囊里的法术由玩家在背包中提前存入（pouchOf 标记），
    // 开战时读入 _pouch；锦囊为空则无效果（不再自动填充随机法术）
    if (!Array.isArray(entry.card._pouch)) entry.card._pouch = [];
    if (!entry.card._pouch.length) {
      (G.ownedCards || []).forEach(o => {
        if (o.pouchOf === 'tt7-stratagem' && o.card && o.card.type === '法术') {
          entry.card._pouch.push({ ...o.card });
        }
      });
      if (entry.card._pouch.length) {
        G.log(`[[icon:cards]] <b>法师锦囊</b>：从背包 pouch 载入 ${entry.card._pouch.length} 张法术`, 'sys');
      }
    }
    if (!entry.card._pouch.length) { G.log('[[icon:question]] 锦囊是空的——背包中存入法术后才能生效', 'dim'); return; }
    discovering = { options: entry.card._pouch.slice(), n: 1, act: 'pouch', pouchUid: uid, pred: null };
    requestBattleRender();
  }
  // 不变应万变（Q8 老板定向）：「在手牌中时，本牌变为打出的上一张武术牌的1费复制」——
  // 战斗内替身（findCard 优先读 overrides），不污染背包原卡；战斗结束随 reset 清空
  function applyImitate(playedMartial) {
    if (!playedMartial) return;
    hand.forEach(h => {
      const o = findCard(h);
      if (o && o.card.id === 'tt7-imitate' && !cardOverrides.has(h)) {
        cardOverrides.set(h, { ...playedMartial, cost: 1 });
        G.log(`[[icon:recycle]] <b>${esc(o.card.name)}</b>：变为【${esc(playedMartial.name)}】的 1 费复制`, 'sys');
      }
    });
  }

  // ---------- 入口 ----------
  // enemyDefs：数组（多敌人遭遇）或单个对象（兼容旧调用）
  function start(game, enemyDefs, options) {
    G = game;
    // 战斗开局预热本局可用卡面：手牌 img 是 lazy，手牌重建瞬间图未解码会露插画窗深底（黑窗）。
    // URL 走 collectCardAssets 与 <img> 实际 src 完全一致，命中 HTTP/解码缓存；已预热项内部自动去重。
    // restore 读档恢复同样走 start，两条进战斗路径都覆盖。
    try {
      if (SDT.Art && SDT.Art.collectCardAssets && SDT.Art.warm) {
        SDT.Art.warm(SDT.Art.collectCardAssets((G.ownedCards || []).map(o => o && o.card).filter(Boolean)));
      }
    } catch (_) {}
    const defs = Array.isArray(enemyDefs) ? enemyDefs : [enemyDefs];
    const startOptions = Object.assign({ isBoss: false }, options || {});
    if (!restoringRestartCheckpoint) {
      battleRestartCheckpoint = {
        restartVersion: 1,
        enemyDefs: cloneData(defs),
        opts: cloneData(startOptions),
        selectedDeck: null,
        rngState: cloneData(Random.snapshot()),
        run: captureRunRestart(G),
      };
    }
    G.battleActive = true;   // game.js 用它锁住侧栏/快捷键背包入口
    if (SDT.Sound) SDT.Sound.setDucked(true);   // 战斗期间 BGM 侧链压低（audio-design ducking）
    opts = startOptions;
    if (SDT.Sound) SDT.Sound.setBoss?.(opts.isBoss);   // BOSS 战抬升紧张垫（音频 P2#12）
    mode = opts.isBoss ? 'boss' : 'normal';
    battleState = createBattleState({ mode });
    foes = defs.map(d => {
      const f = {
        id: d.id || null, name: d.name, hp: d.hp, maxHp: d.hp,
        // 龙巢敌人扩展标记（心/轮换免疫/阶段/复活/庇护/消耗手牌等）原样透传
        heartsMode: d.heartsMode || undefined, hearts: d.hearts || undefined, rotateImmune: d.rotateImmune || undefined,
        evenAttack: d.evenAttack || undefined, noFirstAttack: d.noFirstAttack || undefined,
        handConsume: d.handConsume || undefined, phases: d.phases || undefined,
        revive: d.revive || undefined, revived: undefined, protects: d.protects || undefined,
        protected: d.protected || undefined, reviveTurn: undefined,
        atk: d.atk || 2, affix: d.affix || null, affixName: d.affixName || null, behavior: d.behavior || null, dead: false,
        status: {}, defense: { shield: 0, armor: 0, guard: false },
      };
      f.intent = intentFor(f, 1);
      Combat.ensureStatus(f);
      return f;
    });
    interaction = null;
    SDT.Sound.music('battle');   // 切入战斗氛围
    G.state = 'modal';
    const names = foes.map(f => `${f.name}(${f.atk}-${f.hp})`).join('、');
    G.log(`[[icon:swords]] <b>${opts.isBoss ? 'BOSS战' : '遭遇战'}【${esc(names)}】</b>${!opts.isBoss && opts.risk ? ` · 风险<b>${esc(opts.risk)}</b>` : ''}`, 'warn');
    if (mode === 'boss') {
    if (opts.nest) {
      // 龙巢（2026-09-18 留言「牌盒即牌库」）：跳过编组，卡盒全部卡牌直接成库
      selPool = G.ownedCards.filter(o => !['道具', '资源', '事件', '生物'].includes(o.card.type) && !isStarterAttack(o.card));
      selShaN = 0;
      sel = new Set(selPool.map(o => o.uid));
      beginBoss();
    } else prepareDeckSelection();
  }
    else beginNormal();
  }

  function beginNormal() {
    drawPile = []; discard = []; granted = []; played = []; consumed = []; grave = [];
    // 道具/资源/事件/生物卡默认不进手牌（v0.32：手牌只放可直接打出的战斗卡）；
    // 「对战开始时」装备（Q1 老板定向：持有即自动生效）不进手牌、改为开战被动
    // 普通战无法使用能力卡（2026-09-16 老板定版）：能力卡与道具/资源/事件/生物一样不进普通战手牌
    hand = G.ownedCards.filter(o => !['道具', '资源', '事件', '生物', '能力卡'].includes(o.card.type) && !isBattleStartEquip(o.card)).map(o => o.uid);
    maxEnergy = R().battleEnergy;
    energy = maxEnergy;
    turn = 1; busy = false;
    pdef = { shield: 0, armor: 0, guard: false };
    pstat = Combat.ensureStatus({ hp: G.hp });
    infusing = null; discovering = null; discoverQueue = []; handSelecting = null; handSelectQueue.length = 0; interaction = null; floats = []; cardAnims = []; presentationActionSeq = 0;
    choosing = null; choiceQueue.length = 0; stealthStrike = false; nextSpellTwice = 0;
    delayed = []; noDrawNext = false; spellCost1 = false; meleeCost1 = false;
    shaTransform = null; consumeFireballN = 0; lastDrawnUids = []; lastPlayedType = null;
    viewingGrave = false; viewingDeck = false; dreadShown = false; selectingDeck = false;
    viewingBag = false;
    resetBattleExtras();
    battleState = transitionBattle(battleState, BATTLE_PHASES.PLAYER);
    G.state = 'modal';
    applyBattleStartPassives();
    // 普通战无法使用能力卡（2026-09-16 老板定版）：能力卡不进普通战手牌（对 BOSS 编组不受限）
    if (alive().length > 1) G.log(`[[icon:question]] 以一敌多：伤害与群体卡都<b>拖到任意敌人身上</b>打出（群体自动命中全体）`, 'sys');
    G.log(`[[icon:cards]] 普通战斗无需抽牌：随身 <b>${hand.length}</b> 张战斗卡直接可打出；道具/资源/事件卡不入手，能力卡只能收藏或编入 BOSS 战牌库 · 每回合固定 <b>${maxEnergy}</b> 费`, 'sys');
    requestBattleRender();
  }

  // —— 新增战斗规则变量统一清零（begin/beginBoss/finish 共用）——
  function resetBattleExtras() {
    allies = []; growthNames = new Set(); growth = {};
    infuseFuels = 0; sealUnlocked = false; extraTurn = false; deathSave = 0;
    killAtkUp = 0; poisonOnSpell = false; poisonLegacy = false; zeroFeeUntil = new Map(); cardOverrides = new Map();
    sealDone = false; playerCurseImmune = false; allSpellsInfused = false;
    nestRunes = []; nestSyn = {}; timeRune = false; arrowRune = false; unyieldRune = false;
    ashRune = false; unlimitedRune = false; holyRune = false; fireballRuneOn = false; freezeRuneOn = false;
    swiftRune = false; timeSpaceRune = false; timeSpaceUsed = false; armorMul = 1;
    interaction = null;
    freeCast = new Set();
    equipped = [];
    playedMartialThisTurn = 0;   // 追斩计数跨战不残留
    playedMovesThisTurn = 0;     // 连续射击计数跨战不残留
  }

  // ---------- BOSS战：编组牌库 ----------
  // 2026-09-09 玩法定版：必选 15 张（招式/装备/能力卡）起步；混沌之眼编入后牌库上限 +5（上限 20）。
  function prepareDeckSelection() {
    selDeckMax = R().bossDeckSize + deckCapBonus();   // 混沌之眼「牌库上限+5」（编入后才计入）
    // 2026-09-16 老板定版：骷髅王剑/混沌之眼等「对战开始时」装备计入 15 张套牌（不再独立勾选）
    selPool = G.ownedCards.filter(o => !['道具', '资源', '事件', '生物'].includes(o.card.type) && !isStarterAttack(o.card));
    const shas = G.ownedCards.filter(o => isStarterAttack(o.card));
    selShaN = Math.min(shas.length, R().starterSha);
    sel = new Set(lastDeckSel.filter(uid => selPool.some(entry => entry.uid === uid)));
    const cap = Math.min(selDeckMax, selPool.length);
    while (sel.size > cap) sel.delete(sel.values().next().value);
    selectingDeck = true;
    requestBattleRender();
  }

  function toggleDeckCard(uid) {
    if (!selectingDeck || !selPool.some(entry => entry.uid === uid)) return;
    if (!sel.has(uid) && sel.size >= selDeckMax) return;   // 混沌之眼上限之外不可再编入
    if (sel.has(uid)) sel.delete(uid); else sel.add(uid);
    requestBattleRender();
  }

  function cancelDeckSelection() {
    if (!selectingDeck) return;
    G.log('[[icon:runner]] 你放下了挑战，首脑仍在污染核心深处盘踞', 'sys');
    finish(null);
  }

  function beginBoss() {
    // 2026-09-10 留言 #34：背包可编卡牌不足 15 张时按实际可编数放行（视图侧同口径），
    // 否则「开始战斗」按钮永远灰着、点击也无任何反应
    if (sel.size < Math.min(R().bossDeckSize, selPool.length)) return;
    const shas = G.ownedCards.filter(o => isStarterAttack(o.card)).slice(0, R().starterSha).map(o => o.uid);
    lastDeckSel = [...sel];
    if (battleRestartCheckpoint) battleRestartCheckpoint.selectedDeck = [...sel];
    selectingDeck = false;
    drawPile = shuffle([...sel].concat(shas));   // 骷髅王剑/混沌之眼等对战开始时装备已在 sel 内
    hand = []; discard = []; granted = []; played = []; consumed = []; grave = [];
    maxEnergy = R().battleEnergy;
    energy = maxEnergy;
    turn = 1; busy = false;
    pdef = { shield: 0, armor: 0, guard: false };
    pstat = Combat.ensureStatus({ hp: G.hp });
    infusing = null; discovering = null; discoverQueue = []; interaction = null; floats = []; cardAnims = []; presentationActionSeq = 0;
    handSelecting = null; handSelectQueue.length = 0;
    choosing = null; choiceQueue.length = 0; stealthStrike = false; nextSpellTwice = 0;
    delayed = []; noDrawNext = false; spellCost1 = false; meleeCost1 = false;
    shaTransform = null; consumeFireballN = 0; lastDrawnUids = []; lastPlayedType = null;
    viewingGrave = false; viewingDeck = false; dreadShown = false; selectingDeck = false;
    viewingBag = false;
    resetBattleExtras();
    battleState = transitionBattle(battleState, BATTLE_PHASES.PLAYER);
    G.state = 'modal';
    G.log(opts.nest
      ? `[[icon:cards]] <b>牌盒即牌库</b>：${drawPile.length} 张 · 开局抽 ${R().battleStartDraw} · 每回合开始抽 ${R().battleTurnDraw} · 每回合固定 <b>${maxEnergy}</b> 费`
      : `[[icon:cards]] 牌库编成：自选 ${sel.size} 张非道具卡 + 初始攻击 ×${shas.length} = <b>${drawPile.length}</b> 张 ·
      开局抽 ${R().battleStartDraw} · 每回合开始抽 ${R().battleTurnDraw} · 每回合固定 <b>${maxEnergy}</b> 费`, 'sys');
    injectSealCards();   // 受缚之残影：编组带着才发动——4 张封印肢体洗入牌库（本牌已随编组在库），开局抽牌前洗入
    applyNestRunes();    // 龙巢符文：羁绊与符文效果开战结算
    drawCards(R().battleStartDraw);
    applyVoidRune();     // 虚空符文：开局抽牌后复制 0 费招式
    // 龙巢：黑暗元素每回合开始切换 2 种免疫诅咒（对全体系诅咒生效，冰冻除外）
    COMBAT_HOOKS.onFreeze = (target) => {
      if (freezeRuneOn && target !== pstat) { const g = drawCards(2); G.log('[[icon:gem]] <b>冰冻符文</b>：冰冻 1 名角色，抽 ' + g + ' 张牌', 'ok'); }
    };
    applyBattleStartPassives();   // Q1：迷之匣替换/灵符抽牌/骷髅王剑/混沌之眼（持有即生效）
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
  // 2026-09-09 老板 #14：手牌代价（消耗 N 张 X / 选择 N 张手牌）不足时同样不可打出。
  function unplayableReason(card) {
    const handCards = hand.map(u => { const o = findCard(u); return o ? { uid: u, card: o.card } : null; }).filter(Boolean);
    return unplayableReasonFor(card, mode, { handCards, selfCard: card });
  }

  function play(uid, side, forceDirect) {
    // 迟到/非法 uid 必须在任何交互状态变更前拒绝；否则会顺带取消当前药水点选。
    if (!hand.includes(uid)) return;
    if (interactionOf('item')) interaction = null;   // 打出手牌时取消药水点选（单槽幂等清 item）
    if (busy || infusing || discovering || choosing || viewingGrave || viewingDeck) return;
    // 玩家命令只能提交当前手牌。内部直接释放继续直接走 queueCardExecution，
    // 保留牌与弃牌洗回重抽后 uid 会重新位于 hand，因此仍可再次合法使用。
    const entry = findCard(uid);
    if (!entry) return;
    const card = entry.card;
    const why = unplayableReason(card);
    if (why) { G.log(`[[icon:cross]] 【${esc(card.name)}】无法打出：${why}`, 'warn'); return; }
    const effCost = effCostOf(card, uid);
    if (effCost > energy) { G.log(`[[icon:bolt]] 能量不足：【${esc(card.name)}】需要 ${effCost} 点能量`, 'warn'); return; }
    // 需求 #18：装备最多同时装配 2 件（圣剑化身「装备上限 +1」生效），超编拒打
    if (card.type === '装备') {
      const cap = equipCap();
      const worn = equipped.filter(e => !e.passive).length;
      if (worn >= cap) {
        G.log(`[[icon:tools]] 最多同时装配 <b>${cap}</b> 件装备（已装配 ${worn} 件）——本场无法再穿戴`, 'warn');
        return;
      }
    }
    // 09-20 老板定版（取代需求 #15 的「点卡直打」）：注能卡点卡先进注能态——
    // 注能条内提供「不注能直接打出」；拖拽到目标（side 非空）与该直打钮（forceDirect）仍直接打出
    if (!forceDirect && side == null && infuseOf(card) > 0) { beginInfuse(uid); return; }
    // 目标校验：指向性卡必须拖到对应目标（点卡只是锁定提示，不会打出）
    const need = targetSide(card);
    let target = null;
    const isFree = freeCast.has(uid);
    const pendingCard = interactionOf('card');
    if (need === 'enemy') {
      if (side == null || side === 'self') { beginCardTargeting(uid, card, alive().map(foe => foe.id)); return; }
      target = foes[+side];
      if (!target || target.dead) { beginCardTargeting(uid, card, alive().map(foe => foe.id)); return; }
    } else if (need === 'self') {
      if (side !== 'self') { beginCardTargeting(uid, card, ['self']); return; }
    } else {
      target = alive()[0] || null;
    }
    if (pendingCard) interaction = null;   // 交互正常结算：清卡牌槽（不 cancelTargeting，RESOLVING 迁移接管阶段）
    pendingHint = '';
    freeCast.delete(uid);
    // 「杀化为X」战斗规则：打出的初始攻击以目标卡形态结算（uid 沿用，弃牌簿记不变）
    let playCard = card;
    if (shaTransform && (card.name === '初始攻击' || card.name === '杀')) {
      const tpl = SDT.Cards.all().find(c => c.name === shaTransform);
      if (tpl) playCard = { ...tpl };
    }
    queueCardExecution(uid, playCard, pendingCard?.fuelUids || [], target, isFree);
  }

  // 需求 #17（2026-09-09）：「直接释放」的卡免费打出（freeCost），但仍要选目标——
  // 多个敌人存活时先进入指向流程（拖到敌人身上 / 点选），单敌自动指向
  function freeCastTarget(uid, card) {
    const need = targetSide(card);
    if (need === 'enemy' && alive().length > 1) {
      beginCardTargeting(uid, card, alive().map(foe => foe.id), `直接释放：把【${card.name}】拖到一名敌人身上（不消耗费用）`);
      return false;   // 目标未定，暂不执行
    }
    return true;   // 单敌 / 自身 / 无目标：直接执行
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
      return o && cardIdentity(o.card) === cardIdentity(entry.card);
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
  // 需求 #15：注能入口——卡面上的「注能」角标触发（打出本体不再强制注能）
  function beginInfuse(uid) {
    if (busy || infusing || discovering || choosing || viewingGrave || viewingDeck) return;
    if (!hand.includes(uid)) return;
    const entry = findCard(uid);
    if (!entry) return;
    const card = entry.card;
    const infN = infuseOf(card);
    if (infN <= 0) return;
    const effCost = effCostOf(card, uid);
    if (effCost > energy) { G.log(`[[icon:bolt]] 能量不足：【${esc(card.name)}】注能打出需要 ${effCost} 点能量`, 'warn'); return; }
    const others = hand.filter(h => h !== uid);
    if (others.length < infN) {
      G.log(`[[icon:flask]] 手牌不足：【${esc(card.name)}】注能(${infN}) 需要消耗 ${infN} 张手牌，当前只有 ${others.length} 张可选`, 'warn');
      return;
    }
    infusing = { uid, card, need: infN, picked: new Set() };
    requestBattleRender();
  }
  function confirmInfuse() {
    // 迭代评审 09-20：特色机制全程接音——成功=confirm 生效感，校验不过=deny（按钮路径会被
    // deny 反向抑制吞掉、仅保留视觉，程序化路径正常出声，见 sound.js DENY_SUPPRESS_MS）
    if (!infusing || infusing.picked.size !== infusing.need) { SDT.Sound.sfx('deny'); return; }
    const { uid, card } = infusing;
    const fuel = [...infusing.picked];
    infusing = null;
    SDT.Sound.sfx('confirm');
    if (targetSide(card) === 'enemy' && alive().length > 1) {
      beginCardTargeting(uid, card, alive().map(foe => foe.id), `注能完成：选择【${card.name}】的目标`, fuel);
      return;
    }
    queueCardExecution(uid, card, fuel, alive()[0] || null);
  }

  // 出牌稳定点节流落盘：全量 JSON.stringify + 同步 localStorage 写在 Defender
  // 实时扫描下可能到几十 ms，逐次写会造成出牌后的掉帧尖刺。回合开始仍无条件
  // 落盘，窗口内闪退最多回退数秒内的出牌（正常关窗走 beforeunload 全量保存）。
  let lastPersistAt = 0;
  const PERSIST_MIN_MS = 8000;
  function queueCardExecution(uid, card, fuelUids, target, freeCost) {
    const receipt = Object.freeze({ battleToken: battleState.token, actionSeq: ++presentationActionSeq });
    battleState = transitionBattle(battleState, BATTLE_PHASES.RESOLVING);
    busy = true;
    requestBattleRender();
    actionQueue.enqueue(signal => execPlay(uid, card, fuelUids, target, freeCost, signal, receipt))
      .catch(e => { if (e?.name !== 'BattleActionCancelledError') console.error('[battle] 出牌动作异常：', e); })
      .finally(() => {
        // 触发效果可能继续入队；队列未空时保持 resolving/busy，避免玩家插入新动作。
        if (actionQueue.length === 0) {
          if (battleState.phase === BATTLE_PHASES.RESOLVING) battleState = transitionBattle(battleState, BATTLE_PHASES.PLAYER);
          busy = false;
          // 稳定点落盘（战斗快照随对局存档写入，刷新/闪退后可续打；节流见上）
          if (G.persistSave && G.battleActive && battleState.phase === BATTLE_PHASES.PLAYER) {
            const now = performance.now();
            if (now - lastPersistAt >= PERSIST_MIN_MS) { lastPersistAt = now; G.persistSave(); }
          }
        }
        requestBattleRender();
      });
  }

  async function execPlay(uid, card, fuelUids, target, freeCost, signal, receipt) {
    activeActionSignal = signal;
    try {
    throwIfActionCancelled(signal);
    const effCost = effCostOf(card, uid);
    if (effCost !== card.cost) G.log(`[[icon:sparkles]] <b>费用变化</b>：【${esc(card.name)}】按 <b>${effCost}</b> 费打出（原 ${card.cost} 费）`, 'sys');
    if (!freeCost) energy -= effCost;
    played.push(uid);
    SDT.Sound.sfx('card');
    removeUid(hand, uid);
    cardAnims.push({
      kind: 'play', uid, name: card.name, type: card.type,
      side: targetSideFor(card, SDT.Cards.DMG_TYPES),
      target: target && !target.dead ? foes.indexOf(target) : null,
      receipt,
    });
    fuelUids.forEach(f => removeUid(hand, f));
    fuelUids.forEach(f => {
      consumed.push(f);
      // v0.25：被消耗的牌进入墓地——墓地不参与洗回，战胜 BOSS 后可在整理背包放回
      if (mode === 'boss') grave.push(f);
      const o = findCard(f);
      cardAnims.push({ kind: 'burn', uid: f, name: o ? o.card.name : '' });
      G.log(`[[icon:flask]] <b>${esc(card.name)}</b> 注能：消耗了【<b>${esc(o ? o.card.name : '?')}</b>】${mode === 'boss' ? '（进墓地，不参与洗回）' : '（战后进消耗口袋，可在火堆复原）'}`, 'sys');
      // 被牺牲的牌并没有被「使用」：不结算主效果，只结算它的「被注能时」条件效果
      if (o) resolveInfusedFuel(o.card, target);
      throwIfActionCancelled(signal);
      // Q2 老板定向：注能牺牲也算「消耗该牌时」触发（沉船宝盒/百炼青虹剑/矿工炸药/奥术残卷）
      if (o) fireConsumeTriggers(o.card, target);
      infuseFuels++;   // 元素符印解锁计数
      // 深渊降焰（降临者英雄）：每消耗 1 张卡牌，自动施放 1 次火球
      if (consumeFireballN > 0) {
        for (let k = 0; k < consumeFireballN; k++) {
          const t = alive()[0];
          if (!t) break;
          const r = Combat.dealDamage({
            atk: G.atk,
            spellPower: G.spellPower || 0,   // spellUp 由 status 传入只算一次（2026-09-09 修复双重计数）
            status: pstat.status,
          }, t, 4, Combat.TYPES.SPELL);
          if (r.dealt > 0) floats.push({ unit: foeIdx(t), text: '-' + r.dealt, cls: 'dmg' });
          G.log(`[[icon:fire]] 深渊降焰：施放 1 次火球 → ${esc(t.name)}：造成 <b>${r.dealt}</b> 点法术伤害`, 'sys');
          sweepDead();
          throwIfActionCancelled(signal);
        }
      }
    });
    if (mode === 'boss') discard.push(uid);
    const fuelCostSum = fuelUids.reduce((a, f) => {
      const o = findCard(f);
      return a + (o ? Math.max(0, +(o.card.cost || 0)) : 0);
    }, 0);
    // 深渊主宰·妲莉薇特「招式均已注能」（旧日再临）：可注能/必须注能的招式无需选燃料，直接按已注能结算
    const infusedBase = fuelUids.length > 0 || (allSpellsInfused && (card.type === '武术' || card.type === '法术'));
    const aliveBefore = alive().length;
    resolveCard(card, target, infusedBase, fuelCostSum, uid);
    await takeSurge(signal);   // 法力奔涌：演出未完不结束本次出牌动作；终局会中止余下结算
    // 2026-09-09 老板 #9：装备卡打出即穿戴（角色信息区显示装备与限定技能按钮）
    if (card.type === '装备') registerEquip(uid, card);
    // 「若本牌为最后一张手牌，效果触发 N 次」（急行军/破釜沉舟）：整卡效果再跑一遍。
    // 「永远被保留在手牌中」类卡（不朽斩）不计入手牌数——背包砸击已改按钮形态，
    // 不再向手牌置入常驻令牌，手牌检测天然不含砸击
    const lastRealCard = hand.every(u => {
      const o = findCard(u);
      return o && /永远被保留在手牌中/.test(String(o.card.desc || ''));
    });
    if (/最后一张手牌[^。；]*?触发\s*(\d+)?\s*次?/.test(String(card.desc || '')) && lastRealCard) {
      G.log(`[[icon:cards]] <b>${esc(card.name)}</b>：本牌是最后一张手牌，效果触发 2 次`, 'sys');
      resolveCard(card, target, infusedBase, fuelCostSum, uid);
      await takeSurge(signal);
    }
    // 「下一张法术施放 N 次」（元素风暴，注能打出时注册）：法术效果再跑一遍
    if (nextSpellTwice > 0 && card.type === '法术') {
      nextSpellTwice = 0;
      G.log(`[[icon:sparkles]] <b>元素风暴</b>：这张法术额外施放 1 次`, 'sys');
      resolveCard(card, target, infusedBase, fuelCostSum, uid);
      await takeSurge(signal);
    }
    // —— 2026-09-09 补实装：打出侧登记（成长/被动/击杀结算/手牌变形）——
    if (/回合开始时[，,]?\s*本牌伤害\s*\+/.test(String(card.desc || '')) && card.name) growthNames.add(card.name);
    if (/每消灭\s*1\s*个敌人[^。]*?\+\s*1\s*点?攻击力/.test(String(card.desc || ''))) killAtkUp++;
    if (/每当你使用一张法术牌[^。]*中毒/.test(String(card.desc || ''))) poisonOnSpell = true;
    if (/死亡时[^。；]*中毒层数转移/.test(String(card.desc || ''))) poisonLegacy = true;
    // 旧日再临（深渊主宰·妲莉薇特，2026-09-16 定版）：免疫诅咒 + 招式均已注能 + 召唤 4 名无攻血封印肢体
    if (/免疫诅咒/.test(String(card.desc || ''))) {
      playerCurseImmune = true;
      G.log('[[icon:shield]] <b>旧日再临</b>：诅咒无法侵染深渊主宰', 'ok');
    }
    if (/均视为已注能|均已注能/.test(String(card.desc || ''))) {
      allSpellsInfused = true;
      G.log('[[icon:sparkles]] <b>旧日再临</b>：所有可注能与必须注能的招式，均视为已注能', 'ok');
    }
    if (/召唤\s*4\s*名封印肢体/.test(String(card.desc || ''))) {
      summonAlly('封印肢体', 0, 0, 4, true);
      G.log('[[icon:paw]] 四条<b>封印肢体</b>重现世间——如天国之门般无攻无血的场面物件', 'sys');
    }
    // 箭矢符文：你的「箭」释放 2 次（第二段免费用）
    if (arrowRune && (card.name === '箭' || card.id === 'token-arrow')) {
      G.log('[[icon:runner]] <b>箭矢符文</b>：箭再度释放', 'sys');
      resolveCard(card, target, infusedBase, fuelCostSum, uid);
      await takeSurge(signal);
    }
    applyKillRewards(card, aliveBefore - alive().length);
    if (poisonOnSpell && card.type === '法术') poisonRandomFoe();
    // Q8 老板定向：不变应万变——打出武术后，手中所有「不变应万变」变为该武术的 1 费复制
    if (card.type === '武术') applyImitate(card);
    // 「永远被保留在手牌中」（不朽斩）：打出后回到手牌，不进弃牌堆
    if (/永远被保留在手牌中/.test(String(card.desc || ''))) {
      const di = discard.lastIndexOf(uid); if (di >= 0) discard.splice(di, 1);
      const pi = played.lastIndexOf(uid); if (pi >= 0) played.splice(pi, 1);
      if (hand.length < R().battleHandMax) {
        hand.push(uid);
        cardAnims.push({ kind: 'draw', uid, name: card.name });
        G.log(`[[icon:cards]] 【${esc(card.name)}】保留在手牌中（无法用于注能）`, 'sys');
      }
    }
    sweepDead();
    lastPlayedType = card.type;   // 供「上一张牌是武术→0费」类条件费用判定
    // 打出侧计数（结算后自增——「其他招式/其他武术」不含正在打出的本牌）：
    // 招式＝武术+法术（设计者 2026-09-10 定版）连续射击；追斩只数武术
    if (card.type === '武术' || card.type === '法术') playedMovesThisTurn++;
    if (card.type === '武术') playedMartialThisTurn++;
    if (card.id === 'tt7-bloodpoison') beginDartStrike();   // 二段点选（2026-09-16 留言「选择两次目标」）
    if (!alive().length) { finish(true); return; }
    processChoice();
    processDiscoverQueue();
    requestBattleRender();
    } finally {
      if (activeActionSignal === signal) activeActionSignal = null;
    }
  }

  // 敌人免伤判定（异能领主：偶数回合全免伤，破甲克制）
  function aegisBlocked(foe) {
    return foe.affix === 'aegis' && turn % 2 === 0 && (foe.status.abreak || 0) <= 0;
  }

  // 敌人数组下标（飘字特效用）：按对象引用找 idx
  function foeIdx(foe) { return foes.indexOf(foe); }

  // 对单个敌人结算一次伤害（含潜行/免伤/死亡处理），返回实际伤害
  function hitFoe(foe, card, amount, type, seg) {
    if (foe.dead) return 0;
    // 龙巢：风暴之手存活时，元素领主不可被招式指定（全场命中统一拦截）
    if (foe.protected && foes.some(p => !p.dead && p.protects)) {
      if (card && card.name && card.name !== '?') {
        floats.push({ unit: foeIdx(foe), text: '庇护', cls: 'block' });
        G.log(`[[icon:shield]] <b>风暴之手</b>庇护着 <b>${esc(foe.name)}</b>——伤害被完全偏转`, 'warn');
      }
      return 0;
    }
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
    // 法伤加成（含祝福）；「受法伤加成翻倍」（爆燃火球）在此翻倍。
    // 2026-09-09 修复：spellUp 不再预加进 spellPower——dealDamage 会从 status 再加一次，
    // 此前法术强化被双重计数；现在 bonus 一次性算清并置空 status.spellUp，卡面显示口径一致
    let sp = (G.spellPower || 0) + ((pstat && pstat.status.spellUp) || 0);
    if (card && /受法伤加成翻倍/.test(String(card.desc || ''))) sp *= 2;
    const statusForHit = (pstat && pstat.status)
      ? Object.assign({}, pstat.status, { spellUp: 0 })
      : { spellUp: 0 };
    // 「对冰冻角色伤害 +N」（寒冰剑）：目标被冰冻时追加
    const frzM = card && String(card.desc || '').match(/对冰冻[^。]*?伤害\s*\+\s*(\d+)/);
    if (frzM && (foe.status.freeze || 0) > 0) amt += +frzM[1];
    // 「触发的流血伤害翻倍」（飞身劈）：流血加成部分再叠一次
    if (card && /流血伤害翻倍/.test(String(card.desc || '')) && (foe.status.bleed || 0) > 0) {
      amt += foe.status.bleed;
      G.log(`[[icon:blood]] <b>流血伤害翻倍</b>：流血加成 ${foe.status.bleed} → ${foe.status.bleed * 2}`, 'sys');
    }
    // 攻击强化祝福（atkUp）经 status 传入结算（此前 hitFoe 未带 status，攻击 blessings 未生效）；
    // spellUp 已并入 sp，传 statusForHit 防止二次叠加
    // 龙巢·暗羁绊：暗3 对敌人伤害 +1；暗1 对半血敌伤害 +1
    if (amt > 0) {
      if (nestSyn.dark3) amt += 1;
      else if (nestSyn.dark1 && foe.maxHp && foe.hp <= foe.maxHp / 2) amt += 1;
    }
    // 龙巢·心（heartsMode）：1-7 点伤害 -1 心、8+ 点 -2 心；破甲时心视作血量（1:1）；
    // 真实伤害 N 点直接 -N 心。
    // 2026-09-18 第1局实测修复：心数此前按卡面基础伤害值折算——「初始攻击」等 0 伤卡
    // 永远击碎 0 心，龙巢战斗根本打不死敌人。改为先用影子目标试算最终伤害
    // （含攻击力/法伤加成与护甲减免），再按上述规则折算心数。
    if (foe.heartsMode) {
      const isTrue = type === Combat.TYPES.TRUE;
      const abreakOn = (foe.status.abreak || 0) > 0;
      let loss;
      if (isTrue) {
        loss = Math.max(0, amt);
      } else {
        const shadow = { id: foe.id, status: Object.assign({}, foe.status),
          defense: JSON.parse(JSON.stringify(foe.defense || { shield: 0, armor: 0, guard: false })) };
        const probe = Combat.dealDamage({ atk: G.atk, spellPower: sp, status: statusForHit }, shadow, amt, type);
        loss = abreakOn ? Math.max(0, probe.dealt) : (probe.dealt >= 8 ? 2 : (probe.dealt >= 1 ? 1 : 0));
      }
      foe.hp -= loss;
      SDT.Sound.sfx('hit');
      if (loss > 0) floats.push({ unit: foeIdx(foe), text: '-' + loss + '♥', cls: 'dmg', type });
      G.log(`[[icon:play]] <b>${esc(card.name)}</b> → ${esc(foe.name)}：${isTrue || abreakOn ? '真伤/破甲，' : ''}击碎 <b>${loss}</b> 颗心（余 ${Math.max(0, foe.hp)} 心）`, 'sys');
      resolveFoeDefeat(foe);
      return loss;
    }
    const r = Combat.dealDamage({ atk: G.atk, spellPower: sp, status: statusForHit }, foe, amt, type);
    if (r.stealthed) {
      SDT.Sound.sfx('parry');
      floats.push({ unit: foeIdx(foe), text: '未命中', cls: 'block' });
      G.log(`[[icon:runner]] ${seg || ''}<b>${esc(foe.name)}</b> 处于<b>潜行</b>中：无法成为被攻击对象！`, 'warn');
      return 0;
    }
    SDT.Sound.sfx('hit');
    if (r.dealt > 0) floats.push({ unit: foeIdx(foe), text: '-' + r.dealt, cls: 'dmg', type });
    G.log(`[[icon:play]] <b>${esc(card.name)}</b>${seg || ''} → ${esc(foe.name)}：造成 <b>${r.dealt}</b> 点${Combat.TYPE_NAME[type]}` +
      (r.log.length ? `（${r.log.join('，')}）` : ''), 'sys');
    // 造成伤害会破除自己的潜行（不造成伤害便不会破除）
    if (r.dealt > 0 && Combat.breakStealth(pstat)) {
      G.log('[[icon:runner]] 你造成了伤害，<b>潜行</b>被破除', 'dim');
    }
    resolveFoeDefeat(foe);
    return r.dealt;
  }

  function randomDiscoverCard(pred, rarity, otherCls) {
    // 2026-09-08：限制卡池（pred）优先——限定池只排除 生物/事件/衍生，
    // 职业/棱彩/传说特例卡按池子规则可被指定获取；无 pred 走通用随机池
    // （isRandomObtainable：排除 初始/职业/能力卡/生物/棱彩/unrandom）。
    // 2026-09-09 留言 #7：对局（战斗）内的发现/随机获取一律不出现资源卡——
    // 资源（木材/钱币/钥匙类）只在地图侧宝箱、商店、事件产出。
    // 2026-09-10 撤离测试：BOSS 战道具不可打出（"道具卡只能在普通战斗中使用"），
    // 发现池却在 BOSS 战掉道具卡，入手即死牌（刀剑形态还会复制它）。
    // 2026-09-13 留言：通用随机发现池不出现道具（战斗内道具入口只剩药水栏/背包）。
    // pred 指定池（药水魔法「发现药水」/迷之匣「发现招式」等）不受此限——专属发现按卡面效果走。
    const typeBan = (t => t === '道具');
    let pool;
    if (pred) {
      pool = SDT.Cards.all().filter(c => c.rarity !== '衍生' && !['生物', '事件', '资源'].includes(c.type) && pred(c));
    } else {
      pool = SDT.Cards.all().filter(c =>
        c.rarity !== '衍生' && c.type !== '资源' && !typeBan(c.type) && SDT.Cards.isRandomObtainable(c) &&
        (!rarity || c.rarity === rarity) &&
        (!otherCls || (c.cls && c.cls !== G.myClass)) ||
        (otherCls && c.rarity === '职业' && c.cls && c.cls !== G.myClass));
    }
    if (!pool.length) return null;
    return pool[Math.floor(Random.random('battle') * pool.length)];
  }

  // —— 手牌选卡（2026-09-06 #24/#25）：「选择 N 张手牌中的 X 施放/消耗」通用执行 ——
  // 「杀/初始攻击」按卡名匹配（2026-09-09 定版：效果文本统一写作「初始攻击」，卡池无「杀」类型）
  function matchHandSelectKey(card, key) {
    if (!key || key === '牌') return true;
    if (key === '杀' || key === '初始攻击') return /^(杀|初始攻击)$/.test(card.name || '');
    return card.type === key;
  }
  function processHandSelect() {
    if (handSelecting || !handSelectQueue.length) return;
    const job = handSelectQueue.shift();
    // 空池预检：手牌中没有符合条件的卡时直接跳过（防「选择手牌」弹窗死锁，2026-09-09）
    const matched = hand.filter(uid => { const o = findCard(uid); return o && matchHandSelectKey(o.card, job.type); }).length;
    if (!matched) {
      G.log(`[[icon:cards]] 手牌中没有${job.type ? `「${esc(job.type)}」` : ''}卡牌可选，该效果跳过`, 'warn');
      processHandSelect();
      return;
    }
    handSelecting = {
      n: Math.min(job.n || 1, matched), type: job.type || null, act: job.act || 'play',
      thenText: job.thenText || '', target: job.target || null, srcCard: job.srcCard || null,
      mandatory: !!job.mandatory, onDone: job.onDone || null,
    };
    requestBattleRender();
  }
  function skipHandSelect() {
    if (!handSelecting) return;
    if (handSelecting.mandatory) { SDT.Sound.sfx('deny'); return; }
    handSelecting = null;
    G.log('[[icon:cards]] 跳过手牌选择，该效果未结算', 'warn');
    processHandSelect();
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
    if (handSelecting.act === 'zero') {
      // 自然法杖：选中的卡下回合变为 0 费（2026-09-09 C10）
      zeroFeeUntil.set(uid, turn + 1);
      G.log(`[[icon:bolt]] 【${esc(entry.card.name)}】下回合打出时变为 <b>0</b> 费`, 'sys');
      handSelecting = null;
      processHandSelect();
      requestBattleRender();
      return;
    }
    hand = hand.filter(h => h !== uid);
    consumed.push(uid);
    cardAnims.push({ kind: 'burn', uid, name: entry.card.name });
    G.log(`[[icon:flask]] 消耗了手牌中的【<b>${esc(entry.card.name)}</b>】`, 'sys');
    // Q2 老板定向：手选消耗也算「消耗该牌时」触发
    fireConsumeTriggers(entry.card, null);
    handSelecting.n -= 1;
    if (handSelecting.n > 0) { requestBattleRender(); return; }
    const job = handSelecting;
    handSelecting = null;
    if (typeof job.onDone === 'function') job.onDone();
    if (job.thenText) applyTextEffects(job.srcCard || entry.card, job.thenText, job.target || null);
    if (!alive().length) { finish(true); return; }
    processHandSelect();
    requestBattleRender();
  }
  // 战斗内复原：从消耗堆拿回 n 张到手牌（2026-09-06 #16）
  function restoreConsumed(n) {
    let cnt = 0;
    while (cnt < n && consumed.length) {
      const uid = consumed.pop();
      hand.push(uid);
      const o = findCard(uid);
      cardAnims.push({ kind: 'draw', uid, name: o ? o.card.name : '' });
      cnt++;
    }
    if (cnt) G.log(`[[icon:gem]] 复原 ${cnt} 张消耗卡，回到手牌`, 'ok');
    return cnt;
  }

  // ---------- 战斗背包（2026-09-09 老板：战斗中也能开背包使用道具） ----------
  // 道具在战斗内直接生效于战局：回复类回血、能源结晶复原消耗堆、神秘药水随机效果、
  // 口粮/木材入库；其余道具（通行证等涉及获得卡牌的）战斗内不可用，回地图再使。
  function battleBagItems() {
    return (G.ownedCards || []).filter(o => o.card && o.card.type === '道具' && !o.safe);
  }
  // 道具栏可用性（2026-09-09 老板 #10）：不可用的道具在栏内虚化并说明原因，点击不再消耗
  const ITEM_BOSS_FLEE_PATTERN = /非\s*BOSS\s*战/;
  function itemUsability(card) {
    if (!card) return { usable: false, why: '未知道具' };
    if (card.id === 'tt-token-color') return { usable: false, why: '合成材料：集齐 2 枚员工通行证A碎片后在背包里合成' };
    if (mode === 'boss' && ITEM_BOSS_FLEE_PATTERN.test(String(card.desc || ''))) return { usable: false, why: 'BOSS 战中无法逃跑' };
    if (itemTargetSideFor(card) === 'enemy' && !alive().length) return { usable: false, why: '场上没有敌人可用' };
    return { usable: true, why: '' };
  }
  function useItem(uid, side) {
    const entry = battleBagItems().find(o => o.uid === uid);
    if (!entry) return;
    if (busy || infusing || discovering || choosing || handSelecting) return;
    const card = entry.card;
    const desc = String(card.desc || '');
    const healM = desc.match(/回复\s*(\d+)\s*点生命/);
    const isCrystal = card.id === 'tt-crystal' || /复活最多\s*3\s*张卡牌/.test(desc);
    const isPotion = card.id === 'tt3-mystery-potion' || /随机神秘效果/.test(desc);
    const rm = desc.match(/获得\s*(\d+)\s*份?\s*口粮/) || desc.match(/口粮\s*[×x]\s*(\d+)/);
    const wm = desc.match(/木材\s*[×x]\s*(\d+)/);
    if (!healM && !isCrystal && !isPotion && !rm && !wm) {
      // 2026-09-12：战斗效果类道具（药水/TNT/烟雾弹/通行证C/员工通行证A）走药水栏结算
      useBattleEffectItem(entry, side);
      return;
    }
    // 先扣再用（与地图侧道具一致）：用掉即从背包移除
    G.ownedCards.splice(G.ownedCards.indexOf(entry), 1);
    G.log(`[[icon:bag]] 使用道具【<b>${esc(card.name)}</b>】`, 'sys');
    if (healM) {
      const n = +healM[1];
      if ((pstat.status.healban || 0) > 0) {
        G.log(`[[icon:heart]] 禁疗中：回复 <b>${n}</b> 点生命无效（还剩 ${pstat.status.healban} 回合）`, 'warn');
      } else {
        G.heal(n);
        floats.push({ unit: 'self', text: '', cls: 'stk sticker-heal', warm: true });
      }
    }
    if (isCrystal) {
      if (!restoreConsumed(3)) G.log('消耗堆是空的，没有可复原的卡牌', 'dim');
    }
    if (isPotion) {
      const r = Random.random('loot');
      if (r < 1 / 3) {
        if ((pstat.status.healban || 0) > 0) G.log('[[icon:flask]] 禁疗中：神秘药水的回复无效', 'warn');
        else { G.heal(8); floats.push({ unit: 'self', text: '', cls: 'stk sticker-heal', warm: true }); }
      } else if (r < 2 / 3) {
        G.coins += 3;
        G.log('[[icon:flask]] 神秘药水：获得 <b>3</b> 币', 'coin');
      } else {
        const pool = SDT.Cards.all().filter(c => SDT.Cards.isRandomObtainable(c));
        const got = pool.length ? pool[Math.floor(Random.random('loot') * pool.length)] : null;
        if (got) {
          if (mode === 'boss') addDeckCard({ ...got });
          else addTempCard({ ...got });
          G.log(`[[icon:flask]] 神秘药水：随机获得【<b>${esc(got.name)}</b>】${mode === 'boss' ? '（洗入牌库）' : '（置入手牌）'}`, 'loot');
          fireCatGift(got);   // 阿猫的礼物：随机获取触发
        }
      }
    }
    if (rm) G.addItem(SDT.MAP.items.rations, +rm[1]);
    if (wm) G.addItem(SDT.MAP.items.wood, +wm[1]);
    requestBattleRender();
  }
  // 战斗效果类道具（2026-09-12 药水栏批次）：描述交真实执行器结算，敌方指向道具可拖/点选目标
  function useBattleEffectItem(entry, side) {
    const card = entry.card;
    if (itemTargetSideFor(card) === 'enemy' && side == null) {
      const n = alive().length;
      if (!n) { G.log('[[icon:cross]] 场上没有敌人可以使用', 'warn'); return; }
      if (n > 1) {
        interaction = { kind: 'item', uid: entry.uid, card, hint: '' };
        G.log(`[[icon:flask]] <b>${esc(card.name)}</b>：点击一名敌人使用（或把它拖到敌人身上）`, 'sys');
        requestBattleRender();
        return;
      }
      side = foes.indexOf(alive()[0]);
    }
    const target = (side != null && foes[+side] && !foes[+side].dead) ? foes[+side] : (alive()[0] || null);
    G.ownedCards.splice(G.ownedCards.indexOf(entry), 1);
    G.log(`[[icon:bag]] 使用道具【<b>${esc(card.name)}</b>】${target ? `→ ${esc(target.name)}` : ''}`, 'sys');
    applyTextEffects(card, String(card.desc || ''), target, {});
    sweepDead();
    requestBattleRender();
  }
  // —— 背包砸击（2026-09-16 老板：改回按钮形态——手牌左侧的背包图案按钮，不再向手牌置入令牌；
  //     2026-09-13 曾改为自动置入手牌的常驻牌，因污染一切手牌检测作废）——
  // 2 费 · 4 点固定伤害 · 点按钮进入点选，再点一次取消；不占手牌、不进任何手牌检测
  function bagSlam() {
    if (busy || infusing || discovering || choosing || handSelecting || viewingGrave || selectingDeck) return;
    if (interactionOf('slam')) { cancelSlam(); return; }
    if (energy < 2) { G.log('[[icon:bolt]] 能量不足：背包砸击需要 2 点能量', 'warn'); return; }
    if (!alive().length) { G.log('[[icon:cross]] 场上没有敌人可以砸击', 'warn'); return; }
    interaction = { kind: 'slam', uid: null, card: null, hint: '' };
    G.log('[[icon:bag]] <b>背包砸击</b>：点击一名敌人砸下（2 费 · 4 点固定伤害 · 不消耗卡牌）', 'sys');
    requestBattleRender();
  }
  function cancelSlam() { cancelInteraction(); }

  // —— 血毒双镖·第二镖（2026-09-16 留言「应该能选择两次目标」）——
  // 首段（攻+1 附加流血）随出牌目标结算；二段（攻+1 附加中毒）进入点选：
  // 点击任意敌人结算，可以重复选择同一目标。结束回合放弃点选则二段失效。
  function beginDartStrike() {
    if (!alive().length) return;
    interaction = { kind: 'dart', uid: null, card: null, hint: '' };
    G.log('[[icon:blood]] <b>血毒双镖</b>·第二镖：点击一名敌人（攻 +1，附加中毒 · 可重复选择同一目标）', 'sys');
    requestBattleRender();
  }
  function resolveDart(side) {
    if (!interactionOf('dart')) return;
    const t = side != null ? foes[+side] : null;
    if (!t || t.dead) {
      G.log('[[icon:cross]] 血毒双镖：请重新选择一名存活敌人', 'warn');
      requestBattleRender();
      return;
    }
    interaction = null;
    SDT.Sound.sfx('strike');
    const aliveBefore = alive().length;
    hitFoe(t, { name: '血毒双镖·第二镖', desc: '' }, 1, Combat.TYPES.ATTACK, '');
    if (!t.dead) { Combat.addCurse(t, 'poison', 1); G.log(`[[icon:skull]] <b>${esc(t.name)}</b> 附加 1 层中毒`, 'sys'); }
    applyKillRewards(null, aliveBefore - alive().length);
    sweepDead();
    if (!alive().length) { finish(true); return; }
    requestBattleRender();
  }
  function resolveSlam(side) {
    if (!interactionOf('slam')) return;
    if (energy < 2) { G.log('[[icon:bolt]] 能量不足：背包砸击需要 2 点能量', 'warn'); requestBattleRender(); return; }
    const t = side != null ? foes[+side] : null;
    if (!t || t.dead) {
      G.log('[[icon:cross]] 背包砸击：请重新选择一名存活敌人', 'warn');
      requestBattleRender();
      return;
    }
    interaction = null;
    energy -= 2;
    SDT.Sound.sfx('strike');
    const r = Combat.dealDamage({ atk: G.atk }, t, 4, Combat.TYPES.FIXED);
    if (r.dealt > 0) floats.push({ unit: foes.indexOf(t), text: '-' + r.dealt, cls: 'dmg' });
    G.log(`[[icon:bag]] <b>背包砸击</b>砸向 ${esc(t.name)}：造成 <b>${r.dealt}</b> 点固定伤害（-2 能量）`, 'sys');
    sweepDead();
    if (!alive().length) { finish(true); return; }
    requestBattleRender();
  }

  // —— 受缚之残影（tt8-hero-sealer，2026-09-16 老板定版重做）——
  // 深海封印：对战开始时把本牌与「封印肢体1-4」洗入牌库（BOSS 编组带着才洗；普通战没有
  // 牌库，4 张肢体直接入手）。5 张封印单卡抽到手上无效果、无法打出（battle.rules 按
  // 「无法打出」词条拦截）；手牌集齐 5 张 → 化为「深渊主宰·妲莉薇特」：旧日再临——
  // 抽牌直到手牌 6 张、免疫诅咒、能量上限 +1、法伤 +1、本场法术均已注能；
  // 5 张封印单卡自动消耗，并召唤她的四个衍生物：封印肢体 ×4（4-4）。
  const SEALED_HERO_ID = 'tt8-hero-sealer';
  const SEAL_LIMB_IDS = ['tt8-curseimmune', 'tt8-energycap', 'tt8-nofocus', 'tt8-healplus'];
  const SOVEREIGN_ID = 'tt8-abyss-sovereign';

  function sealCardById(id) { return SDT.Cards.all().find(c => c.id === id) || null; }

  function isSealHeroSelected() {
    return [...sel].some(uid => {
      const o = (G.ownedCards || []).find(x => x.uid === uid);
      return !!(o && o.card && o.card.id === SEALED_HERO_ID);
    });
  }

  function injectSealCards() {
    // 普通战无法使用能力卡（2026-09-16 老板定版）：受缚之残影不会进普通战手牌，封印只在对 BOSS 时发动
    if (mode !== 'boss') return;
    if (!(G.ownedCards || []).some(o => o.card && o.card.id === SEALED_HERO_ID)) return;
    if (!isSealHeroSelected()) return;   // 编组没带受缚之残影：封印不发动
    SEAL_LIMB_IDS.forEach(id => {
      const tpl = sealCardById(id);
      if (!tpl) return;
      const uid = 'bts' + Date.now().toString(36) + (tmpSeq++);
      granted.push({ uid, card: { ...tpl } });
      drawPile.push(uid);
    });
    drawPile = shuffle(drawPile);
    G.log('[[icon:skull]] <b>深海封印</b>：「受缚之残影」与四张「封印肢体」沉入牌库——集齐 5 张封印之牌，破除封印！', 'sys');
  }

  function checkSealTransformation() {
    if (sealDone) return;
    const ids = new Set();
    const sealedInHand = hand.filter(u => {
      const o = findCard(u);
      if (o && o.card && (o.card.id === SEALED_HERO_ID || SEAL_LIMB_IDS.includes(o.card.id))) {
        ids.add(o.card.id);
        return true;
      }
      return false;
    });
    if (!ids.has(SEALED_HERO_ID) || SEAL_LIMB_IDS.some(id => !ids.has(id))) return;
    sealDone = true;
    // ① 5 张封印单卡自动消耗（进消耗口袋/墓地，不再可用）
    sealedInHand.forEach(u => {
      const o = findCard(u);
      const i = hand.indexOf(u);
      if (i >= 0) hand.splice(i, 1);
      consumed.push(u);
      if (mode === 'boss') grave.push(u);
      cardAnims.push({ kind: 'burn', uid: u, name: o ? o.card.name : '' });
    });
    G.log('[[icon:flask]] 5 张封印之牌在深海的辉光中燃尽……', 'sys');
    // ② 化为深渊主宰·妲莉薇特（2 费能力卡，由玩家打出引爆「旧日再临」）
    const tpl = sealCardById(SOVEREIGN_ID);
    if (tpl) addTempCard({ ...tpl });
    G.log('[[icon:helmet]] <b>封印破除——化为深渊主宰·妲莉薇特！打出她，旧日再临。</b>', 'ok');
    sweepDead();
  }

  // 玩家侧诅咒统一入口：旧日再临后免疫诅咒（灼烧也是诅咒，2026-09-09 留言口径）
  function addPlayerCurse(key, n, foe) {
    if (playerCurseImmune) {
      G.log(`[[icon:shield]] 深渊主宰的威压：诅咒「${Combat.CURSE_META[key] ? Combat.CURSE_META[key].name : key}」被免疫`, 'ok');
      return;
    }
    if (holyRune && turn <= 3) {
      G.log(`[[icon:shield]] 圣洁符文：前 3 回合免疫诅咒（「${Combat.CURSE_META[key] ? Combat.CURSE_META[key].name : key}」被抵抗）`, 'ok');
      return;
    }
    Combat.addCurse(pstat, key, n);
  }

  // —— 龙巢符文开战结算（羁绊 + 符文效果，2026-09-16 Item 定版）——
  function applyNestRunes() {
    nestRunes = (opts && opts.nest && opts.nest.runes) || [];
    if (!nestRunes.length) return;
    nestSyn = (SDT.Runes && SDT.Runes.evaluateSlots) ? SDT.Runes.evaluateSlots(nestRunes) : {};
    G.log('[[icon:gem]] <b>龙巢符文</b>生效：' + nestRunes.map(r => esc(r.name + '（' + r.attrs.join('') + '）')).join('、'), 'ok');
    nestRunes.forEach(r => {
      if (r.kind === 'attack') Combat.addBlessing(pstat, 'atkUp', 1);
      if (r.kind === 'mana') Combat.addBlessing(pstat, 'spellUp', 1);
      if (r.kind === 'time') timeRune = true;
      if (r.kind === 'arrow') arrowRune = true;
      if (r.kind === 'unyield') unyieldRune = true;
      if (r.kind === 'ash') ashRune = true;
      if (r.kind === 'infinite') unlimitedRune = true;
      if (r.kind === 'holy') holyRune = true;
      if (r.kind === 'shield') armorMul = 2;
      if (r.kind === 'swift') swiftRune = true;
      if (r.kind === 'fireball') fireballRuneOn = true;
      if (r.kind === 'spacetime') timeSpaceRune = true;
      if (r.kind === 'bleed') foes.forEach(f => { if (!f.dead) Combat.addCurse(f, 'bleed', 1); });
      if (r.kind === 'poison') delayed.push({ text: '对所有敌人附加 1 层中毒', cardName: '中毒符文', repeat: true });
    });
    if (nestSyn.water1) {
      const cc = SDT.Cards.randomClassCard(G.myClass);
      if (cc) { addTempCard({ ...cc }); G.log('[[icon:medal]] <b>水 1</b>：获得 1 张本职业卡牌', 'ok'); }
    }
    if (nestSyn.water3) delayed.push({ text: '发现 1 张本职业卡牌', cardName: '水 3 羁绊', repeat: true });
    if (nestSyn.fire1 || nestSyn.fire3) {
      energy += 1;
      G.log('[[icon:fire]] <b>火 1</b>：首回合额外 1 点能量' + (nestSyn.fire3 ? '（火 3 每回合开始也会 +1）' : ''), 'ok');
      if (nestSyn.fire3) delayed.push({ text: '获得 1 点能量', cardName: '火 3 羁绊', repeat: true });
    }
    if (nestSyn.grass1 || nestSyn.grass3) G.log('[[icon:wood]] <b>草' + (nestSyn.grass3 ? 3 : 1) + '</b>：装备栏' + (nestSyn.grass3 ? '无上限' : '上限 +1'), 'ok');
    if (nestSyn.light1 || nestSyn.light3) {
      const n = nestSyn.light3 ? 3 : 1;
      const pool = SDT.Cards.all().filter(c => c.rarity === '传说' && ['武术', '法术'].includes(c.type));
      const picked = [];
      for (let k = 0; k < n && pool.length; k++) {
        const c = pool.splice(Math.floor(Random.random('battle') * pool.length), 1)[0];
        const zero = { ...c, cost: 0 };
        const uid0 = 'bts' + Date.now().toString(36) + (tmpSeq++);
        granted.push({ uid: uid0, card: zero });
        drawPile.push(uid0);
        picked.push(c.name);
      }
      drawPile = shuffle(drawPile);
      if (picked.length) G.log('[[icon:sparkles]] <b>光 ' + n + '</b>：洗入传说招式 ' + picked.join('、') + '（均为 0 费）', 'ok');
    }
    if (nestSyn.dark1 || nestSyn.dark3) G.log('[[icon:skull]] <b>暗' + (nestSyn.dark3 ? 3 : 1) + '</b>：你的伤害' + (nestSyn.dark3 ? '' : '对半血敌人') + ' +1', 'ok');
    if (nestRunes.some(r => r.kind === 'morph')) {
      const forms = SDT.Cards.all().filter(c => /形态/.test(String(c.name || '')) && ['武术', '法术'].includes(c.type));
      const picks = [];
      for (let k = 0; k < 2 && forms.length; k++) picks.push(forms.splice(Math.floor(Random.random('battle') * forms.length), 1)[0]);
      if (picks.length === 2) {
        choiceQueue.push({ cardName: '变身符文', options: picks.map(c => c.desc || c.name) }); processChoice();
        G.log('[[icon:sparkles]] <b>变身符文</b>：从 2 种随机形态中选择 1 张释放', 'sys');
      }
    }
    if (nestRunes.some(r => r.kind === 'holy')) G.log('[[icon:shield]] <b>圣洁符文</b>：前 3 回合免疫诅咒，回合结束 +4 甲', 'ok');
  }

  // 虚空符文：开局抽牌后，复制手牌与牌库中的 0 费招式各 1 张
  function applyVoidRune() {
    if (!nestRunes.some(r => r.kind === 'void')) return;
    let n = 0;
    hand.forEach(u => {
      const o = findCard(u);
      if (o && (o.card.cost || 0) === 0 && ['武术', '法术'].includes(o.card.type)) {
        addTempCard({ ...o.card }); n++;
      }
    });
    drawPile.forEach(u => {
      const o = findCard(u);
      if (o && (o.card.cost || 0) === 0 && ['武术', '法术'].includes(o.card.type)) {
        const uid1 = 'bts' + Date.now().toString(36) + (tmpSeq++);
        granted.push({ uid: uid1, card: { ...o.card } });
        drawPile.push(uid1);
        n++;
      }
    });
    if (n) G.log('[[icon:skull]] <b>虚空符文</b>：复制了 ' + n + ' 张 0 费招式', 'ok');
  }

  // 药水栏点击：敌方指向道具在多敌时进入点选模式，其余直接生效
  function usePotion(uid) {
    const entry = battleBagItems().find(o => o.uid === uid);
    if (!entry) return;
    if (itemTargetSideFor(entry.card) === 'enemy') {
      const n = alive().length;
      if (!n) { G.log('[[icon:cross]] 场上没有敌人可以使用', 'warn'); return; }
      if (n > 1) {
        interaction = { kind: 'item', uid: entry.uid, card: entry.card, hint: '' };
        G.log(`[[icon:flask]] <b>${esc(entry.card.name)}</b>：点击一名敌人使用（或把它拖到敌人身上）`, 'sys');
        requestBattleRender();
        return;
      }
      useItem(uid, foes.indexOf(alive()[0]));
      return;
    }
    useItem(uid, null);
  }
  function openBag() {
    if (selectingDeck) { G.log('[[icon:lock]] 编组牌库时不能打开背包', 'warn'); return; }
    if (infusing || discovering || choosing || handSelecting) {
      G.log('[[icon:hourglass]] 当前效果结算中，稍候再打开背包', 'warn');
      return;
    }
    viewingBag = !viewingBag;   // 再按一次 B / 再点一次按钮 = 关闭
    requestBattleRender();
  }
  function closeBag() {
    viewingBag = false;
    requestBattleRender();
  }

  // —— 抉择面板（2026-09-08 人工 N 选一）：复用发现面板的弹层交互 ——
  function processChoice() {
    if (choosing || !choiceQueue.length) return;
    const job = choiceQueue.shift();
    choosing = { cardName: job.cardName || '？', options: (job.options || []).slice(), secondDoor: !!job.secondDoor };
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
    // 花开两面：「两回合后，开启未选择的那扇门」（2026-09-09 C8 补实装）
    if (job.secondDoor && job.options.length === 2) {
      const otherText = job.options[+i === 0 ? 1 : 0];
      const q2 = otherText.match(/[‘“「]([^\s，。；‘’“”「」]+)[’”」]/);
      const ref2 = q2 && SDT.Cards.all().find(c => c.name === q2[1]);
      if (ref2 && ref2.type === '生物') {
        const parts2 = splitClauses(String(ref2.desc || ''));
        parts2.turnStart.forEach(it => delayed.push({ text: it.text, cardName: ref2.name, repeat: true, notBeforeTurn: turn + 2 }));
        if (parts2.turnStart.length) G.log(`[[icon:hourglass]] <b>两回合后</b>：未选择的【${esc(ref2.name)}】也将展开`, 'sys');
      }
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
    const names = new Set();   // 同名不同版（如「流血药水」道具/道具两张）算重复（2026-09-13 老板口径）
    // 旧任务格式兼容：rarity / otherCls 换算成谓词
    const legacyPred = job.rarity ? (c => c.rarity === job.rarity)
      : job.otherCls ? (c => c.rarity === '职业' && c.cls && c.cls !== G.myClass)
      : null;
    const pred = job.pred || legacyPred;
    // 显式候选（探宝·牌库底）：三张就是给定的真实卡牌，不走随机池
    if (job.explicit && job.explicit.length) {
      discovering = { options: job.explicit.slice(0, 3), n: job.n, rarity: job.rarity, pred: job.pred, act: job.act || null,
        priceArmor: !!job.priceArmor, pouchUid: job.pouchUid || null, consumeTempAtTurn: !!job.consumeTempAtTurn, tempUids: job.tempUids || [],
        swapPair: job.swapPair || null, deckBottom: !!job.deckBottom, deckBottomUids: job.explicitUids || [] };
      requestBattleRender();
      return;
    }
    // 2026-09-09 留言 #9：三张候选不得重复——抽到已选中的就重抽，
    // 池子不足三张时有多少展示多少（原实现撞重直接跳过，经常只剩一两张可选）
    // 2026-09-13 老板口径：同一个选择面板内不许重复——同名不同版也一并重抽
    const clash = (c) => !!c && (taken.has(c.id) || names.has(c.name));
    for (let i = 0; i < 3 && options.length < 3; i++) {
      let c = randomDiscoverCard(pred, job.rarity, !job.pred && !job.rarity ? job.otherCls : null);
      let guard = 0;
      while (clash(c) && guard++ < 40) {
        c = randomDiscoverCard(pred, job.rarity, !job.pred && !job.rarity ? job.otherCls : null);
      }
      if (c && !clash(c)) { taken.add(c.id); names.add(c.name); options.push(c); }
    }
    if (!options.length) { G.log('（没有符合条件的卡牌可发现）', 'dim'); return; }
    discovering = { options, n: job.n, rarity: job.rarity, pred: job.pred, act: job.act || null,
      priceArmor: !!job.priceArmor, pouchUid: job.pouchUid || null, consumeTempAtTurn: !!job.consumeTempAtTurn, tempUids: job.tempUids || [],
      swapPair: job.swapPair || null };
    requestBattleRender();
  }

  function pickDiscover(i) {
    if (!discovering) return;
    const card = discovering.options[+i];
    if (!card) return;
    const { n, rarity, pred, act, options, priceArmor, pouchUid, consumeTempAtTurn, tempUids, swapPair,
      deckBottom, deckBottomUids } = discovering;
    discovering = null;
    // 探宝·牌库底：未选中的候选按原顺序放回牌库底（数组头部 = 底）
    if (deckBottom && deckBottomUids.length) {
      const pickedUid = deckBottomUids[+i] != null ? deckBottomUids[+i] : null;
      const rest = deckBottomUids.filter(u => u !== pickedUid);
      if (rest.length) drawPile.unshift(...rest);
    }
    if (act !== 'pouch') fireCatGift(card);   // 阿猫的礼物：从发现面板选中即触发（锦囊内旧牌不重触发）
    // 「直接施放 / 直接释放」类发现：选中即免费打出（2026-09-11 实机老板反馈修复：
    // 此前多敌场景会先置入手牌等玩家再拖选目标——与卡面「并直接释放」矛盾，且拖拽流程
    // 极易断裂成「卡躺在手牌像没释放」。现一律立即结算：默认首个存活敌人，群体卡自动覆盖全体）
    if (act === 'play' || act === 'potion') {
      const uid = addTempCard(card);
      G.log(`[[icon:question]] 发现：【<b>${esc(card.name)}</b>】并直接施放（免费用 · 战斗内临时卡，战后消散）`, 'loot');
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
    } else if (act === 'pouch') {
      // 法师锦囊：从锦囊里选 1 张施放（从锦囊移除，其余留存）
      const pouchEntry = pouchUid && findCard(pouchUid);
      if (pouchEntry && Array.isArray(pouchEntry.card._pouch)) {
        const pi = pouchEntry.card._pouch.findIndex(c => c.id === card.id);
        if (pi >= 0) pouchEntry.card._pouch.splice(pi, 1);
      }
      const uid = addTempCard(card);
      G.log(`[[icon:question]] <b>法师锦囊</b>：施放其中的【<b>${esc(card.name)}</b>】（锦囊余 ${pouchEntry && Array.isArray(pouchEntry.card._pouch) ? pouchEntry.card._pouch.length : 0} 张）`, 'loot');
      queueCardExecution(uid, findCard(uid).card, [], alive()[0] || null, true);
    } else if (act === 'dup') {
      // 二刀流（2026-09-10 需求）：「发现一张武术卡并额外获得1张复制」——本体+复制共 2 张入手
      addTempCard(card);
      addTempCard(card);
      G.log(`[[icon:question]] 发现：【<b>${esc(card.name)}</b>】并额外获得 1 张复制（×2 置入手牌 · 战斗内临时卡，战后消散）`, 'loot');
    } else {
      const uid = addTempCard(card);
      G.log(`[[icon:question]] 发现：【<b>${esc(card.name)}</b>】置入手牌（战斗内临时卡，战后消散）`, 'loot');
      // 挖宝：「获得等同于其价格的护甲」按发现卡售价折算（2026-09-09 补实装）
      if (priceArmor) {
        const price = SDT.Cards.sellPrice(card);
        pdef.armor += price;
        G.log(`[[icon:plate]] <b>挖宝</b>：【${esc(card.name)}】价格 ${price} → 获得 ${price} 点护甲（当前 ${pdef.armor}）`, 'sys');
      }
      // 江湖救急：置入的临时卡在回合开始时消耗（C9）
      if (consumeTempAtTurn) tempUids.push(uid);
      // 迷之匣：发现的招式记入待换费对（两张到齐后交换费用）
      if (swapPair) swapPair.push(uid);
    }
    sweepDead();
    if (!alive().length) { finish(true); return; }
    if (n > 1) discoverQueue.unshift({ n: n - 1, rarity, pred, act, priceArmor, pouchUid, consumeTempAtTurn, tempUids, swapPair });
    else if (consumeTempAtTurn && tempUids.length) {
      delayed.push({ special: 'consumeTemps', uids: [...tempUids], cardName: '江湖救急' });
      G.log(`[[icon:hourglass]] <b>江湖救急</b>：置入的 ${tempUids.length} 张临时卡将在下个回合开始时消耗`, 'sys');
    } else if (swapPair && swapPair.length >= 2) {
      swapCardCosts(swapPair[0], swapPair[1]);   // 迷之匣：两张发现完毕，交换费用
    }
    else if (consumeTempAtTurn && tempUids.length) {
      delayed.push({ special: 'consumeTemps', uids: [...tempUids], cardName: '江湖救急' });
      G.log(`[[icon:hourglass]] <b>江湖救急</b>：置入的 ${tempUids.length} 张临时卡将在下个回合开始时消耗`, 'sys');
    }
    processDiscoverQueue();
    requestBattleRender();
  }

  // 玩家受到一次攻击（含流血加成 / 格挡 / 死亡保险），返回实际伤害
  function playerTakeHit(foe) {
    const playerRef = { hp: G.hp, defense: pdef, status: pstat.status };
    const r = Combat.dealDamage({ atk: foe.atk }, playerRef, 0, Combat.TYPES.ATTACK);
    // 闪避（09-20 老板定版：免疫下一次攻击，非减伤）——演出对齐元素庇幕免伤（parry+浮字）
    if (r.dodged) {
      SDT.Sound.sfx('parry');
      floats.push({ unit: 'self', text: '闪避', cls: 'block' });
      G.log(`[[icon:runner]] <b>闪避！</b><b>${esc(foe.name)}</b> 的攻击被完全避开（剩余 ${Math.max(0, pstat.status.dodge || 0)} 层）`, 'ok');
      return 0;
    }
    // 黑暗吊坠：免疫 1 次致命伤害，并在该回合内无敌（2026-09-09 C11）
    if (r.dealt > 0 && G.hp - r.dealt <= 0 && deathSave > 0) {
      deathSave--;
      Combat.addBlessing(pstat, 'immune', 1);
      G.log(`[[icon:sparkles]] <b>致命一击被挡下！</b>（死亡保险剩余 ${deathSave} 次，本回合无敌）`, 'ok');
      return 0;
    }
    G.hp = Math.max(0, playerRef.hp);
    SDT.Sound.sfx('hurt');
    // delay 130ms：让敌方 lungefx 前倾先播，数字随后到（读得出「这一刀是谁砍的」）
    floats.push({ unit: 'self', text: '-' + r.dealt, cls: 'hurt', delay: 130 });
    if (r.dealt > 0) floats.push({ unit: 'self', text: '', cls: 'stk stk-late sticker-hurt', delay: 130 });
    G.log(`[[icon:demon]] <b>${esc(foe.name)}</b> 攻击：你受到 <b>${r.dealt}</b> 点攻击伤害（${G.hp}/${G.maxHp}）`, 'warn');
    return r.dealt;
  }

  // 附加 1 层流血或中毒（变异巢母狂乱用）
  function frenzyCurse(foe) {
    const key = Random.random('status') < 0.5 ? 'bleed' : 'poison';
    addPlayerCurse(key, 1, foe);
    SDT.Sound.sfx('curse');
    G.log(`[[icon:bolt]] <b>${esc(foe.name)}</b> 的攻击附加了 <b>1</b> 层${Combat.CURSE_META[key].name}`, 'warn');
  }

  // 附加 1 层随机诅咒（滋生异变体「攻击并施加诅咒」用；灼烧已入池，2026-09-08）
  function elCurse(foe) {
    const keys = ['bleed', 'poison', 'burn'];
    const key = keys[Math.floor(Random.random('status') * keys.length)];
    addPlayerCurse(key, 1, foe);
    SDT.Sound.sfx('curse');
    G.log(`[[icon:skull]] <b>${esc(foe.name)}</b> 的攻击附加了 <b>1</b> 层${Combat.CURSE_META[key].name}`, 'warn');
  }

  // ---------- 回合结束 ----------
  function endTurn() {
    if (SDT.Meta && SDT.Meta.track) SDT.Meta.track('turnMoves', { n: playedMovesThisTurn });
    if (busy || infusing || discovering || choosing) return;
    if (battleState.phase === BATTLE_PHASES.VICTORY || battleState.phase === BATTLE_PHASES.DEFEAT) return;   // 终局后点击无效（2026-09-16 实测 defeat 后连点报错）
    if (interaction && interaction.kind !== 'card') interaction = null;   // 结束回合取消药水点选/砸击（卡牌指向在转入敌方阶段时清）
    // 批次C：指向性卡牌的 targeting 阶段若还挂着（直接释放未选目标 / 拖到死目标），
    // 必须先清掉——否则 targeting→enemy 是非法迁移，endTurn 直接抛错卡死。
    // 这里硬清槽位、不走 cancelInteraction：freeCast 簿记保留（「直接释放」卡跨回合仍免费）
    if (battleState.phase === BATTLE_PHASES.TARGETING) {
      interaction = null; pendingHint = '';
      battleState = cancelTargeting(battleState);
    }
    busy = true;
    // —— 额外回合（命运钟表 C7）：跳过敌方阶段，直接刷新为你的下一个回合 ——
    if (extraTurn) {
      extraTurn = false;
      turn++;
      foes.forEach(foe => { if (!foe.dead) foe.intent = intentFor(foe, turn); });
      energy = maxEnergy;
      if ((pstat.status.natureForm || 0) > 0) energy++;
      if ((pstat.status.swordForm || 0) > 0) {
        if (mode === 'boss') { const got = drawCards(1); G.log(`[[icon:sword]] <b>剑仙形态</b>：额外抽了 ${got} 张牌`, 'ok'); }
        else grantSha(1);
      }
      if (noDrawNext) { noDrawNext = false; G.log('[[icon:cross]] <b>下回合无法抽牌</b>生效：本回合开始不抽牌', 'warn'); }
      else if (mode === 'boss') drawCards(R().battleTurnDraw);
      processDelayed();
      G.log(`[[icon:hourglass]] <b>额外回合</b>：敌人被钉在原地，你再次行动！（第 ${turn} 回合）`, 'ok');
      battleState = transitionBattle(battleState, BATTLE_PHASES.PLAYER);
      busy = false;
      requestBattleRender();
      return;
    }
    if (swiftRune && hand.length) {
      const u0 = hand[0];
      const o = findCard(u0);
      if (o && !unplayableReason(o.card) && effCostOf(o.card, u0) <= energy) {
        G.log('[[icon:bolt]] <b>极速符文</b>：回合结束，打出最左侧的手牌', 'sys');
        queueCardExecution(u0, o.card, [], alive()[0] || null, false);
        requestBattleRender();
        return;
      }
    }
    battleState = transitionBattle(battleState, BATTLE_PHASES.ENEMY);
    interaction = null;
    pendingHint = '';
    // —— 玩家回合结束：中毒 / 灼烧结算 ——
    const pref = { hp: G.hp, defense: pdef, status: pstat.status };
    // 时光符文：回合结束效果触发 2 次（中毒/灼烧结算双倍）
    const tickPasses = timeRune ? 2 : 1;
    let pr = null, br = null;
    for (let pass = 0; pass < tickPasses; pass++) {
      const p1 = Combat.tickPoison(pref);
      if (p1) { pr = pr ? { dealt: pr.dealt + p1.dealt } : p1; }
      const b1 = Combat.tickBurn(pref);
      if (b1) { br = br ? { dealt: br.dealt + b1.dealt } : b1; }
    }
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
    // —— 随从自动攻击（Q4 老板定向：步兵等为你自动战斗；无攻血场面物件不参与）——
    allies.filter(a => !a.dead && !a.statless).forEach(a => {
      const t = alive()[0];
      if (!t) return;
      const r = Combat.dealDamage({ atk: a.atk, status: a.status }, t, 0, Combat.TYPES.ATTACK);
      if (r.dealt > 0) floats.push({ unit: foeIdx(t), text: '-' + r.dealt, cls: 'dmg' });
      G.log(`[[icon:swords]] <b>${esc(a.name)}</b> 自动攻击 ${esc(t.name)}：造成 <b>${r.dealt}</b> 点攻击伤害`, 'sys');
    });
    sweepDead();
    if (!alive().length) { busy = false; finish(true); return; }
    // —— 敌人回合：逐个行动 ——
    const acting = alive();
    let i = 0;
    const step = () => {
      if (G.hp <= 0) { busy = false; finish(false); return; }
      if (i >= acting.length) { afterEnemies(); return; }
      const foe = acting[i++];
      if (foe.dead) { step(); return; }
      if (foe.stunned) {
        foe.stunned = false;
        G.log(`[[icon:crystal]] <b>${esc(foe.name)}</b> 蓄力完毕，下回合行动`, 'sys');
        step(); return;
      }
      if (foe.evenAttack && turn % 2 === 1) {
        G.log(`[[icon:crystal]] <b>${esc(foe.name)}</b> 蓄力（偶数回合才会攻击）`, 'sys');
        step(); return;
      }
      if (foe.noFirstAttack && turn === 1) {
        G.log(`[[icon:crystal]] <b>${esc(foe.name)}</b> 第一回合蓄力，不会攻击`, 'sys');
        step(); return;
      }
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
          // 随从优先替主人承受伤害（Q4 老板定向：步兵「优先为主人承受伤害」；无攻血物件除外）
          const guard = allies.find(a => !a.dead && !a.statless);
          if (guard) {
            floats.push({ unit: foes.indexOf(foe), text: '', cls: 'lungefx' });   // 攻击前摇：敌人前倾
            const ar = Combat.dealDamage({ atk: foe.atk }, guard, 0, Combat.TYPES.ATTACK);
            SDT.Sound.sfx('hurt');
            floats.push({ unit: 'ally:' + allies.indexOf(guard), text: '-' + ar.dealt, cls: 'hurt' });
            G.log(`[[icon:runner]] <b>${esc(guard.name)}</b> 替你承受了 <b>${ar.dealt}</b> 点攻击伤害（${Math.max(0, guard.hp)}/${guard.maxHp}）`, 'sys');
            if (guard.hp <= 0 && !guard.dead) {
              guard.dead = true;
              G.log(`[[icon:skull]] <b>${esc(guard.name)}</b> 阵亡`, 'warn');
            }
            continue;
          }
          floats.push({ unit: foes.indexOf(foe), text: '', cls: 'lungefx' });   // 攻击前摇：敌人前倾
          const dealt = playerTakeHit(foe);
          // 敌人造成伤害也会破除它自己的潜行
          if (dealt > 0 && Combat.breakStealth(foe)) {
            G.log(`[[icon:runner]] <b>${esc(foe.name)}</b> 发动了攻击，<b>潜行</b>被破除`, 'dim');
          }
          if (dealt > 0 && foe.affix === 'frenzy') frenzyCurse(foe);
          // 龙巢：黑暗使者攻击后消耗对方 1 张手牌；远古龙尊按阶段附加诅咒/回血
          if (dealt > 0 && foe.handConsume && hand.length) {
            const vi = Math.floor(Random.random('battle') * hand.length);
            const vu = hand.splice(vi, 1)[0];
            const vo = findCard(vu);
            consumed.push(vu);
            grave.push(vu);
            G.log(`[[icon:skull]] <b>${esc(foe.name)}</b> 消耗了你手牌中的【${esc(vo ? vo.card.name : '?')}】`, 'warn');
          }
          if (dealt > 0 && foe.phases) {
            const ph = foe.phase || 1;
            if (ph === 1) {
              const keys = ['bleed', 'poison', 'silence', 'abreak', 'healban', 'burn'];
              addPlayerCurse(keys[Math.floor(Random.random('battle') * keys.length)], 1, foe);
              G.log('[[icon:fire]] 远古龙尊的吐息附加了一层随机诅咒（冰冻除外）', 'warn');
            } else if (ph === 2) {
              foe.hp = Math.min(foe.maxHp, foe.hp + 10);
              G.log('[[icon:fire]] 远古龙尊回复了 10 点生命', 'warn');
            }
          }
          // 行为型附加：灼热异变体（攻击并灼烧）/ 滋生异变体（攻击并施加诅咒）
          if (dealt > 0 && foe.behavior === 'burn') {
            addPlayerCurse('burn', 2, foe);
            SDT.Sound.sfx('curse');
            G.log(`[[icon:fire]] <b>${esc(foe.name)}</b> 的攻击附加了<b>灼烧</b>（2 回合内每回合结束受 1 点固定伤害）`, 'warn');
          } else if (dealt > 0 && foe.behavior === 'curse') {
            elCurse(foe);
          }
        }
      }
      requestBattleRender();
      if (G.hp <= 0) { busy = false; finish(false); return; }
      setTimeout(step, demoMs(420));   // 敌方步进：2× 档经 demoMs 单一倍率缩放（battle.pace.js）
    };
    setTimeout(step, demoMs(420));
  }

  function afterEnemies() {
    const aliveBeforeTick = alive().length;
    if (holyRune && turn <= 3) {
      const n = timeRune ? 8 : 4;   // 时光符文：回合结束效果触发 2 次
      pdef.armor += n;
      G.log('[[icon:shield]] <b>圣洁符文</b>：回合结束获得 ' + n + ' 点护甲（' + pdef.armor + '）', 'sys');
    }
    // —— 敌人回合结束：中毒 / 灼烧结算 + 词缀 ——
    foes.forEach(foe => {
      if (foe.dead) return;
      const tickPasses = timeRune ? 2 : 1;   // 时光符文：回合结束效果触发 2 次
      let poisonDealt = 0, burnDealt = 0;
      for (let tp = 0; tp < tickPasses; tp++) {
        const er = Combat.tickPoison(foe);
        if (er) poisonDealt += er.dealt;
        const eb = Combat.tickBurn(foe);
        if (eb) burnDealt += eb.dealt;
      }
      if (poisonDealt) {
        floats.push({ unit: foes.indexOf(foe), text: '-' + poisonDealt, cls: 'dmg', tintKey: 'poison' });
        G.log(`[[icon:skull]] 中毒结算：<b>${esc(foe.name)}</b> 受到 <b>${poisonDealt}</b> 点固定伤害（${Math.max(0, foe.hp)}/${foe.maxHp}）${timeRune ? '（时光×2）' : ''}`, 'sys');
      }
      if (burnDealt) {
        floats.push({ unit: foes.indexOf(foe), text: '-' + burnDealt, cls: 'dmg', tintKey: 'burn' });
        G.log(`[[icon:fire]] 灼烧结算：<b>${esc(foe.name)}</b> 受到 <b>${burnDealt}</b> 点固定伤害（${Math.max(0, foe.hp)}/${foe.maxHp}）`, 'sys');
      }
      resolveFoeDefeat(foe, '毒发倒地');
    });
    if (!alive().length) { busy = false; finish(true); return; }
    applyKillRewards(null, aliveBeforeTick - alive().length);   // 毒杀计入饮血剑击杀层数
    // 军威（肃清总督）：回合结束时攻击力 +2
    foes.forEach(foe => {
      if (!foe.dead && foe.affix === 'grow') {
        foe.atk += 2;
        G.log(`[[icon:arrow]] <b>军威</b>：<b>${esc(foe.name)}</b> 攻击力增至 <b>${foe.atk}</b>`, 'warn');
      }
    });
    // —— 共享回合钟：所有计时状态在本回合结束统一递减 1 ——
    // 持续 1 回合 = 本回合结束前生效；持续 n 回合 = 从触发当回合起覆盖 n 个完整回合
    if (timeRune) G.log('[[icon:hourglass]] <b>时光符文</b>：你的增益状态在时光中凝固（不递减）', 'sys');
    else tickDurationsLog(pstat, '你');
    foes.forEach(foe => { if (!foe.dead) tickDurationsLog(foe, foe.name); });
    // 影噬/影蚀：偷取攻击 1 回合后还原（2026-09-16 留言 #20）
    foes.forEach(foe => {
      if (foe.dead || !foe._stealRestore) return;
      if (turn > (foe._stealRestoreTurn || 0)) {
        foe.atk += foe._stealRestore;
        G.log(`[[icon:arrow]] <b>${esc(foe.name)}</b> 的攻击力恢复 ${foe._stealRestore} 点（现 ${foe.atk}）`, 'sys');
        foe._stealRestore = 0;
      }
    });
    // 偷取攻击到期：与 1 回合攻强化同期还原（2026-09-09 留言 #1/#2）
    foes.forEach(foe => {
      if (!foe.dead || !foe._stealRestore) return;
      foe.atk = (foe.atk || 0) + foe._stealRestore;
      G.log(`[[icon:arrow]] <b>${esc(foe.name)}</b> 被偷取的攻击力归还（恢复至 ${foe.atk}）`, 'dim');
      delete foe._stealRestore;
    });
    syncCurseCondEquips();   // 条件装备（深海印记类）随诅咒状态变化重新核算
    turn++;
    foes.forEach(foe => { if (!foe.dead) foe.intent = intentFor(foe, turn); });
    energy = maxEnergy;
    playedMartialThisTurn = 0;   // 追斩/连续射击：本回合打出计数随新回合清零
    playedMovesThisTurn = 0;
    accrueGrowth();   // 充能火球等「回合开始时本牌伤害+1」按 uid 成长
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
    // —— 龙巢：远古龙尊阶段检定 / 时空符文 / 火球符文 ——
    foes.forEach(f => { if (!f.dead && f.phases) nestPhase(f); });
    foes.forEach(f => {
      if (!f.dead || !f.rotateImmune) return;
      const keys = ['bleed', 'poison', 'silence', 'abreak', 'healban', 'burn', 'freeze'];
      const picked = [];
      while (picked.length < 2) {
        const k = keys[Math.floor(Random.random('battle') * keys.length)];
        if (!picked.includes(k)) picked.push(k);
      }
      f.noCurseKeys = picked;
      G.log(`[[icon:shield]] <b>${esc(f.name)}</b> 切换免疫：${picked.join('、')}`, 'warn');
    });
    if (timeSpaceRune && !timeSpaceUsed && drawPile.length === 0) {
      timeSpaceUsed = true;
      extraTurn = true;
      G.log('[[icon:hourglass]] <b>时空符文</b>：牌库已空——额外回合！（本局限一次）', 'ok');
    }
    if (fireballRuneOn && drawPile.length) {
      const bottom = drawPile.shift();   // 牌库底
      const o = findCard(bottom);
      grave.push(bottom);
      G.log(`[[icon:fire]] <b>火球符文</b>：消耗牌库底的【${esc(o ? o.card.name : '?')}】`, 'sys');
      const fbPool = SDT.Cards.all().filter(c => String(c.name || '').includes('火球') && c.type === '法术');
      if (fbPool.length) {
        const fb = fbPool[Math.floor(Random.random('battle') * fbPool.length)];
        resolveCard(fb, alive()[0] || null, false, 0);
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
    // 敌人回合结束必须转回玩家阶段：此前 phase 卡在 enemy，
    // 视图的 data-phase="enemy" 规则（手牌下沉/禁点）会吞掉之后每个玩家回合
    battleState = transitionBattle(battleState, BATTLE_PHASES.PLAYER);
    busy = false;
    if (G.persistSave && G.battleActive) { lastPersistAt = performance.now(); G.persistSave(); }   // 回合开始落盘（无条件，同步节流时钟）
    requestBattleRender();
  }

  function tickDurationsLog(target, who) {
    const meta = (k) => Combat.CURSE_META[k] || Combat.BUFF_META[k];
    const expired = Combat.tickDurations(target);
    expired.forEach(k => G.log(`[[icon:sparkles]] ${esc(who)} 的<b>${meta(k).name}</b>效果结束了`, 'dim'));
    if (expired.some(k => Combat.BUFF_META[k])) SDT.Sound.sfx('buffDown');   // 增益到期=轻碎裂提示（音频 P2#6，与挂上音成对）
  }

  function flee() {
    if (busy || infusing || discovering || choosing) return;
    SDT.Sound.sfx('flee');
    G.log('[[icon:runner]] 你撤出了战斗（打出过的卡照常结算）', 'sys');
    finish(null);
  }

  // 主动撤离（2026-09-09 玩法定版）：战斗中的「撤退」一律视为本局失败——
  // 仅烟雾弹的逃跑（fleeBattle → flee）豁免。走战败结算（安全格抢运、对局结束）。
  function surrender() {
    if (busy || infusing || discovering || choosing || handSelecting) return;
    G.surrenderedRun = true;
    SDT.Sound.sfx('flee');
    G.log('[[icon:cross]] 你选择了撤离——<b>本局视为失败</b>，安全格中的卡牌将被抢运回基地', 'warn');
    finish(false);
  }

  // ---------- 战斗入场检查点持久化 ----------
  // 战斗中退出/关窗不保存半结算局面；只保存进入本场战斗前的对局状态、敌人定义、
  // RNG 与已确认的 BOSS 套牌。读档时重新执行开战流程，保证费用、触发和敌方回合
  // 不会被退出动作跳过。
  function serialize() {
    if (!G || !G.battleActive || !opts || !battleRestartCheckpoint) return null;
    return cloneData(battleRestartCheckpoint);
  }

  function restore(nextGame, data) {
    if (data && data.restartVersion === 1 && Array.isArray(data.enemyDefs) && data.opts) {
      actionQueue.clear('battle restarted from checkpoint');
      applyRunRestart(nextGame, data.run);
      Random.restore(data.rngState);
      battleRestartCheckpoint = cloneData(data);
      restoringRestartCheckpoint = true;
      try {
        start(nextGame, cloneData(data.enemyDefs), cloneData(data.opts));
        if (data.opts.isBoss && !data.opts.nest && Array.isArray(data.selectedDeck)) {
          sel = new Set(data.selectedDeck.filter(uid => selPool.some(entry => entry.uid === uid)));
          if (sel.size >= Math.min(R().bossDeckSize, selPool.length)) beginBoss();
        }
      } finally {
        restoringRestartCheckpoint = false;
      }
      G.log('[[icon:recycle]] 已从本场战斗开始处重新进入——战斗内消耗、受伤与状态变化已撤销', 'sys');
      requestBattleRender();
      return true;
    }
    // 旧版本战斗档缺少入场检查点，只能兼容恢复一次；恢复后再次保存即升级为新格式。
    if (!data || !data.opts) return false;
    if (!data.deckSelect && (!Array.isArray(data.foes) || !data.foes.length)) return false;
    if (!Array.isArray(data.foes)) data.foes = [];
    G = nextGame;
    opts = JSON.parse(JSON.stringify(data.opts));
    mode = data.mode === 'boss' ? 'boss' : 'normal';
    turn = +data.turn || 1;
    maxEnergy = +data.maxEnergy || R().battleEnergy;
    energy = Number.isFinite(+data.energy) ? +data.energy : maxEnergy;
    hand = [...(data.hand || [])]; drawPile = [...(data.drawPile || [])];
    discard = [...(data.discard || [])]; grave = [...(data.grave || [])];
    played = [...(data.played || [])]; consumed = [...(data.consumed || [])];
    granted = (data.granted || []).map(g => ({ uid: g.uid, card: { ...g.card } }));
    pdef = { shield: 0, armor: 0, guard: false, ...(data.pdef || {}) };
    pstat = Combat.ensureStatus({ hp: G.hp, status: { ...(data.pstat?.status || {}) } });
    foes = data.foes.map(f => {
      const foe = {
        id: f.id || null, name: f.name, hp: f.hp, maxHp: f.maxHp, atk: f.atk || 2,
        affix: f.affix || null, affixName: f.affixName || null, behavior: f.behavior || null, dead: !!f.dead,
        status: { ...(f.status || {}) },
        defense: { shield: 0, armor: 0, guard: false, ...(f.defense || {}) },
        intent: f.intent ? JSON.parse(JSON.stringify(f.intent)) : null,
      };
      Combat.ensureStatus(foe);
      if (!foe.intent) foe.intent = intentFor(foe, turn);
      return foe;
    });
    delayed = (data.delayed || []).map(d => ({ ...d }));
    noDrawNext = !!data.noDrawNext; spellCost1 = !!data.spellCost1; meleeCost1 = !!data.meleeCost1;
    shaTransform = data.shaTransform || null; consumeFireballN = +data.consumeFireballN || 0;
    lastDrawnUids = [...(data.lastDrawnUids || [])]; lastPlayedType = data.lastPlayedType || null;
    stealthStrike = !!data.stealthStrike; nextSpellTwice = +data.nextSpellTwice || 0;
    // —— 2026-09-09 机制审计补实装：新战斗规则变量恢复 ——
    allies = (data.allies || []).map(a => ({ ...a, status: { ...(a.status || {}) }, defense: { shield: 0, armor: 0, guard: false, ...(a.defense || {}) } }));
    growth = { ...(data.growth || {}) }; growthNames = new Set(data.growthNames || []);
    infuseFuels = +data.infuseFuels || 0; sealUnlocked = !!data.sealUnlocked;
    extraTurn = !!data.extraTurn; deathSave = +data.deathSave || 0;
    killAtkUp = +data.killAtkUp || 0; poisonOnSpell = !!data.poisonOnSpell;
    zeroFeeUntil = new Map(data.zeroFeeUntil || []);
    cardOverrides = new Map(data.cardOverrides || []);
    infusing = null; discovering = null; discoverQueue.length = 0;
    handSelecting = null; handSelectQueue.length = 0; choosing = null; choiceQueue.length = 0;
    interaction = null; pendingHint = ''; floats = []; cardAnims = []; presentationActionSeq = 0;
    viewingGrave = false; viewingDeck = false; selectingDeck = false; viewingBag = false;
    sel = new Set(); selPool = []; selShaN = 0;
    busy = false;
    G.battleActive = true;
    G.state = 'modal';
    if (SDT.Sound) SDT.Sound.setDucked(true);
    SDT.Sound.setBoss?.(true);   // BOSS 读档恢复：紧张垫同步（音频 P2#12）
    SDT.Sound.music('battle');
    if (data.deckSelect) {
      prepareDeckSelection();   // BOSS 战退出在编组阶段：重开编组（还没实际开打，无进度损失）
    } else {
      dreadShown = true;        // BOSS 登场演出不重播
      battleState = transitionBattle(createBattleState(), BATTLE_PHASES.PLAYER);
      G.log('[[icon:swords]] 战斗已恢复——接着上次的局面继续', 'sys');
      requestBattleRender();
    }
    if (!battleRestartCheckpoint) {
      battleRestartCheckpoint = {
        restartVersion: 1,
        enemyDefs: cloneData(foes.map(f => ({ ...f, hp: f.maxHp || f.hp }))),
        opts: cloneData(opts), selectedDeck: null,
        rngState: cloneData(Random.snapshot()), run: captureRunRestart(G),
      };
    }
    return true;
  }

  function finish(win) {
    if (win === true && battleState.phase !== BATTLE_PHASES.VICTORY) battleState = transitionBattle(battleState, BATTLE_PHASES.VICTORY);
    if (SDT.Meta && SDT.Meta.track) SDT.Meta.track('battleEquips', { n: equipped.length });
    if (win === false && battleState.phase !== BATTLE_PHASES.DEFEAT) battleState = transitionBattle(battleState, BATTLE_PHASES.DEFEAT);
    actionQueue.clear();      // 终局后残留的动作回调再跑会触发 victory->enemy 非法迁移（2026-09-13 实测 UNCAUGHT）
    SDT.Sound.sfx(win === true ? 'victory' : win === false ? 'defeat' : 'flee');
    const playedCopy = played.slice();
    const consumedCopy = consumed.slice();
    played = []; consumed = [];
    drawPile = []; hand = []; discard = []; granted = []; grave = [];
    floats = []; cardAnims = [];
    sel = new Set();
    infusing = null; discovering = null; discoverQueue = []; interaction = null; floats = []; cardAnims = [];
    handSelecting = null; handSelectQueue.length = 0;
    choosing = null; choiceQueue.length = 0; stealthStrike = false; nextSpellTwice = 0;
    delayed = []; noDrawNext = false; spellCost1 = false; meleeCost1 = false;
    shaTransform = null; consumeFireballN = 0; lastDrawnUids = []; lastPlayedType = null;
    viewingGrave = false; viewingDeck = false; dreadShown = false; selectingDeck = false; viewingBag = false;
    resetBattleExtras();
    G.state = 'idle';
    G.battleActive = false;
    if (SDT.Sound) SDT.Sound.setDucked(false);   // 战斗结束恢复 BGM 音量
    if (SDT.Sound) SDT.Sound.setBoss?.(false);   // BOSS 紧张垫解除（音频 P2#12）
    opts.foeNames = foes.map(f => f.name);
    SDT.Sound.music('board');   // 战斗结束切回行军氛围
    // 战斗结束广播（2026-09-11 批次 5）：订阅方各自响应（背包结算/基地/统计），
    // 战斗核心不再直接依赖 game.onBattleEnd 的实现；无人订阅时回退旧回调（审计 harness 兼容）
    if (!busEmit('battle:end', opts, playedCopy, win, consumedCopy) && typeof G.onBattleEnd === 'function') {
      G.onBattleEnd(opts, playedCopy, win, consumedCopy);
    }
    battleRestartCheckpoint = null;
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
    const sig = [battleState.token, mode, turn, energy, maxEnergy, busy, opts,
      pendingHint, viewingGrave, viewingBag, dreadShown, selectingDeck, selShaN, handSelectQueue.length,
      viewingDeck,
      spellCost1, meleeCost1, shaTransform, consumeFireballN, lastPlayedType,
      stealthStrike, choiceQueue.length, !!interactionOf('slam'), !!interactionOf('dart'), freeCast.size];
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
    // 2026-09-09 新规则变量进签名（随从/替身卡/0费标记影响手牌与费用显示）
    sig.push(allies.map(a => `${a.name}:${a.hp}:${a.dead}`).join(';'));
    sig.push('ov' + cardOverrides.size, 'zf' + zeroFeeUntil.size, 'gw' + Object.keys(growth).length);
    // 药水栏（2026-09-12）：道具组数量变化 + 点选状态；2026-09-09 #10 追加可用性（敌人死光后要重渲染置灰）
    if (G && !selectingDeck) {
      const groups = new Map();
      battleBagItems().forEach(o => groups.set(o.card.name, (groups.get(o.card.name) || 0) + 1));
      const pItem = pendingItemOf();
      sig.push([...groups].map(([n, c]) => n + 'x' + c).join('|'), pItem ? pItem.uid : '', 'en' + alive().length);
    }
    if (infusing) sig.push(infusing.uid, infusing.need, infusing.card, infusing.picked.size, [...infusing.picked].sort().join(','));
    if (discovering) sig.push(discovering.n, discovering.rarity, discovering.options.length);
    if (handSelecting) sig.push(handSelecting.n, handSelecting.type, handSelecting.act, handSelecting.thenText);
    if (choosing) sig.push(choosing.cardName, choosing.options.join('|'));
    const pTgt = pendingTargetOf();
    if (pTgt) sig.push(pTgt.uid, pTgt.card);
    // 已穿戴装备（老板 #9）：穿戴/技能已用状态变化都要重渲染
    sig.push('eq' + equipped.map(e => e.uid + (e.used ? '1' : '0')).join(','));
    if (selectingDeck) sig.push(sel.size, [...sel].sort().join(','), selPool.length, selDeckMax);
    return sig.join('\u0001');
  }

  function getSnapshot() {
    const sig = snapshotSignature();
    if (snapCache && sig === snapSig) return snapCache;
    snapSig = sig;
    const pTgt = pendingTargetOf();
    const pItem = pendingItemOf();
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
      need: R().bossDeckSize,          // 起步必选 15 张
      max: selDeckMax,                 // 混沌之眼 +5 后的可选上限
      starterCount: selShaN,
      selected: Object.freeze([...sel]),
      cards: Object.freeze(selPool.map(entry => Object.freeze({ uid: entry.uid, card: freezeObject(entry.card) }))),
      // 「对战开始时」装备已并入 cards 套牌池（2026-09-16 定版），不再单列勾选区
      boss: readonlyFoes[0] || null,
    }) : null;
    snapCache = Object.freeze({
      battleToken: battleState.token,   // 战斗实例令牌：视图层常驻节点换场重置依据
      mode, turn, energy, maxEnergy, busy, phase: battleState.phase,
      actionQueueLength: actionQueue.length,
      opts: freezeObject(opts),
      player: G ? Object.freeze({ hp: G.hp, maxHp: G.maxHp, atk: G.atk, spellPower: G.spellPower || 0, myClass: G.myClass || null, characterId: G.characterId || null }) : null,
      pdef: playerDefense,
      pstat: playerStatus,
      foes: Object.freeze(readonlyFoes),
      allies: Object.freeze(allies.map(a => Object.freeze({ ...a, status: statusOf(a), defense: freezeObject(a.defense) }))),
      hand: Object.freeze(hand.slice()),
      drawPile: Object.freeze(drawPile.slice()),
      discard: Object.freeze(discard.slice()),
      grave: Object.freeze(grave.slice()),
      infusing: readonlyInfusing,
      discovering: readonlyDiscovering,
      handSelecting: readonlyHandSelecting,
      choosing: readonlyChoosing,
      pendingTarget: pTgt ? Object.freeze({ ...pTgt, card: freezeObject(pTgt.card) }) : null,
      pendingHint,
      viewingGrave,
      viewingBag,
      dreadShown,
      deckSelection,
      potionBar: G && !selectingDeck ? Object.freeze(battleBagItems().reduce((acc, o) => {
        const g = acc.find(p => p.name === o.card.name);
        if (g) g.count++;
        else {
          const u = itemUsability(o.card);
          acc.push({ uid: o.uid, name: o.card.name, count: 1, desc: String(o.card.desc || ''), aim: itemTargetSideFor(o.card), usable: u.usable, why: u.why });
        }
        return acc;
      }, []).map(freezeObject)) : null,
      pendingItem: pItem ? Object.freeze({ ...pItem, card: freezeObject(pItem.card) }) : null,
      slamPending: !!interactionOf('slam'),
      dartPending: !!interactionOf('dart'),   // 血毒双镖二段点选（2026-09-16 留言）
      // 已穿戴装备（老板 #9）：名称 + 说明 + 限定技能文本（skill 非空即显示技能按钮）
      equipped: Object.freeze(equipped.map(e => Object.freeze({
        uid: e.uid, name: e.card.name, desc: String(e.card.desc || ''),
        skill: equipSkillText(e.card), used: e.used,
      }))),
    });
    return snapCache;
  }

  // R3-a 可信预览窄口：只把真实结算所需的当前上下文复制出去，
  // 不暴露内部 Map/Set，不执行卡牌效果、RNG 或 Combat hooks。
  function getPreviewContext(uid, targetIndex) {
    const entry = findCard(uid);
    const card = entry && entry.card;
    const target = foes[+targetIndex];
    if (!card || !target) return null;
    const need = targetSide(card);
    const pendingCard = interactionOf('card');
    const matchingTargeting = battleState.phase === BATTLE_PHASES.TARGETING
      && pendingCard && pendingCard.uid === uid;
    let illegalReason = '';
    if (!hand.includes(uid)) illegalReason = '这张牌已不在当前手牌中';
    else if ((battleState.phase !== BATTLE_PHASES.PLAYER && !matchingTargeting) || busy) illegalReason = '当前不能打出卡牌';
    else if (infusing || discovering || choosing || viewingGrave || viewingDeck) illegalReason = '请先完成当前操作';
    else if (unplayableReason(card)) illegalReason = `当前无法打出：${unplayableReason(card)}`;
    else if (need !== 'enemy') illegalReason = '这张牌不能指定敌人';
    else if (target.dead) illegalReason = '该目标已经倒下';
    const isFreeCast = freeCast.has(uid);
    const playCheckCost = effCostOf(card, uid);
    const effectiveCost = isFreeCast ? 0 : playCheckCost;
    // play() 当前先做能量门槛，再判 freeCast 是否实际扣费；预览忠实反映该既有口径。
    if (!illegalReason && playCheckCost > energy) illegalReason = isFreeCast
      ? `当前仍需至少 ${playCheckCost} 点能量才能直接释放（结算不扣费）`
      : `能量不足（需要 ${playCheckCost}，当前 ${energy}）`;
    const selectedFuelUids = pendingCard && pendingCard.uid === uid
      ? (pendingCard.fuelUids || []).slice()
      : (infusing && infusing.uid === uid ? [...infusing.picked] : []);
    const targetIndexes = need === 'enemy'
      ? foes.map((foe, index) => !foe.dead ? index : -1).filter(index => index >= 0)
      : [];
    const lastRealCard = hand.filter(handUid => handUid !== uid).every(handUid => {
      const handEntry = findCard(handUid);
      return handEntry && /永远被保留在手牌中/.test(String(handEntry.card.desc || ''));
    });
    const lastCardRepeat = /最后一张手牌[^。；]*?触发\s*(\d+)?\s*次?/.test(String(card.desc || '')) && lastRealCard;
    const wholeCardRepeats = 1 + ((nextSpellTwice > 0 && card.type === '法术') ? 1 : 0) + (lastCardRepeat ? 1 : 0);
    const targetProtected = !!(target.protected && foes.some(foe => !foe.dead && foe.protects));
    const stealthStrikeActive = !!(stealthStrike && Combat.isStealthed(pstat));
    const nestDark3 = !!nestSyn.dark3;
    // 暗 1 每一段命中前重新判断半血；即便目标当前高于半血，多段也可能在中途跨阈值。
    const nestDark1 = !!nestSyn.dark1;
    return Object.freeze({
      card: Object.freeze({ ...card }),
      legal: !illegalReason,
      illegalReason,
      effectiveCost,
      isFreeCast,
      selectedFuelUids: Object.freeze(selectedFuelUids),
      damageGrowth: +(growth[uid] || 0),
      wholeCardRepeats,
      arrowRuneRepeat: !!(arrowRune && (card.name === '箭' || card.id === 'token-arrow')),
      aegisBlocked: aegisBlocked(target),
      targetProtected,
      heartsMode: !!target.heartsMode,
      shaTransformed: !!(shaTransform && (card.name === '初始攻击' || card.name === '杀')),
      targetIndexes: Object.freeze(targetIndexes),
      modifiers: Object.freeze({
        stealthStrike: stealthStrikeActive,
        nestDark1,
        nestDark3,
        allSpellsInfused: !!(allSpellsInfused && infuseOf(card) > 0),
      }),
    });
  }

  function openGrave() { viewingGrave = true; requestBattleRender(); }
  function openDeckView() { if (mode !== 'boss') return; viewingDeck = true; requestBattleRender(); }
  function closeDeckView() { viewingDeck = false; requestBattleRender(); }
  // 统一幂等取消（批次C）：一次调用清掉整个交互槽，无交互时 no-op。
  // 直接释放/freeCast 的卡取消后留在手牌按原费打出（原 cancelPendingTarget 语义）。
  function cancelInteraction() {
    if (!interaction && battleState.phase !== BATTLE_PHASES.TARGETING) return;
    const i = interaction;
    interaction = null;
    if (i && i.kind === 'card' && freeCast.has(i.uid)) freeCast.delete(i.uid);
    pendingHint = '';
    battleState = cancelTargeting(battleState);
    requestBattleRender();
  }
  function cancelPendingTarget() { cancelInteraction(); }
  // 统一交互入场（批次C）：指向性卡牌进入「等待目标」，单槽顶替旧交互
  function beginCardTargeting(uid, card, targetIds, hint, fuelUids = []) {
    interaction = { kind: 'card', uid, card, hint: hint || '', fuelUids };
    battleState = beginTargeting(battleState, uid, targetIds);
    pendingHint = hint || '';
    requestBattleRender();
  }
  function setPendingHint(value) { pendingHint = String(value || ''); requestBattleRender(); }
  function lockPendingTarget(value) { interaction = value ? { kind: 'card', uid: value.uid, card: value.card, hint: '' } : null; pendingHint = ''; requestBattleRender(); }
  function markDreadShown() { dreadShown = true; }
  function takeFloats() { const list = floats; floats = []; return list; }
  function takeCardAnims() { const list = cardAnims; cardAnims = []; return list; }

  // —— 开发者控制台（2026-09-19 留言 #22：战斗中 Ctrl+L 弹出）——
  // 调试能力统一入口：只有 openDevConsole 的按钮会调用，不进任何常规交互链路
  function devCommand(name, arg) {
    switch (name) {
      case 'energy':
        energy = maxEnergy;
        G.log('[[icon:bolt]] 开发者：能量已回满', 'sys');
        break;
      case 'draw': {
        const n = drawCards(Math.max(1, +arg || 2));
        G.log(`[[icon:cards]] 开发者：抽了 <b>${n}</b> 张牌`, 'sys');
        break;
      }
      case 'heal':
        G.hp = G.maxHp;
        G.log('[[icon:heart]] 开发者：生命已回满', 'sys');
        break;
      case 'freezeAll':
        alive().forEach(f => Combat.addBlessing(f, 'freeze', 2));
        G.log('[[icon:crystal]] 开发者：所有敌人被冰冻 2 回合', 'sys');
        break;
      case 'damageAll': {
        const dmg = Math.max(1, +arg || 10);
        [...alive()].forEach(f => hitFoe(f, null, dmg, Combat.TYPES.FIXED));
        sweepDead();
        G.log(`[[icon:swords]] 开发者：对所有敌人造成 <b>${dmg}</b> 点固定伤害`, 'sys');
        break;
      }
      case 'win':
        G.log('[[icon:trophy]] 开发者：直接结算胜利', 'sys');
        finish(true);
        return true;
      default:
        return false;
    }
    requestBattleRender();
    return true;
  }

  const commands = Object.freeze({
    playCard: play,
    selectInfusion: toggleInfusePick,
    confirmInfusion: confirmInfuse,
    cancelInfusion: cancelInfuse,
    endTurn,
    flee,
    surrender,
    openGrave,
    openDeckView,
    closeDeckView,
    cancelPendingTarget,
    closeGrave,
    openBag,
    closeBag,
    useItem,
    usePotion,
    bagSlam,
    resolveSlam,
    resolveDart,
    beginInfusion: beginInfuse,
    // 09-20 老板定版：注能条「不注能直接打出」——退出注能态并跳过注能分流走直接打出
    playDirect: uid => { cancelInfuse(); play(uid, null, true); },
    useEquipSkill,
    selectDeckCard: toggleDeckCard,
    confirmDeck: beginBoss,
    cancelDeck: cancelDeckSelection,
    pickDiscover,
    pickHandSelect,
    skipHandSelect,
    pickChoice,
    setPendingHint,
    lockPendingTarget,
    dev: devCommand,   // #22 开发者控制台（战斗内：能量/抽牌/回血/冰冻/群伤/胜利）
    refreshView: requestBattleRender,   // U9：战斗被外层全屏页（远征手册等）覆盖返回后重绘战斗
    // —— 批次C：统一交互 API（审计 P1：click/drag/controller 共用一条管线）——
    // begin=验证并进入等待目标（无需目标则直接结算）；resolve=带目标结算；cancel=幂等取消
    beginCardInteraction: play,
    resolveCardInteraction: play,
    cancelCardInteraction: cancelPendingTarget,
    beginItemInteraction: usePotion,
    resolveItemInteraction: useItem,
    beginSlamInteraction: bagSlam,
    resolveSlamInteraction: resolveSlam,
    resolveDartInteraction: resolveDart,
    cancelInteraction,
  });

const viewApi = Object.freeze({
  AFFIX_META, Combat, R, aegisBlocked, effCostOf, findCard,
  infuseOf, markDreadShown, pileTip, refillDrawPile,
  takeFloats, takeCardAnims, targetSide, unplayableReason,
  matchHandSelectKey, handCurseSpecs,
  getPreviewContext,
});
const BattleSession = Object.freeze({ start, getSnapshot, commands, serialize, restore });

export { BattleSession, commands, configureBattleRenderer, getSnapshot, restore, serialize, start, viewApi };

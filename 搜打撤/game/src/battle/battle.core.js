/* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const SDT = window.SDT;
import { refillDrawPile } from './battle.deck.js';
import { COMBAT_HOOKS } from './combat.js';
import { BATTLE_PHASES } from './battle.state.js';
import * as Combat from './combat.js';
import { battleState, G, foes, opts, mode, hand, energy, maxEnergy, pstat, busy, infusing, discovering, choosing, stealthStrike, nextSpellTwice, viewingGrave, viewingDeck, floats, cardAnims, shaTransform, growth, nestSyn, arrowRune, allSpellsInfused, freeCast, battleRestartCheckpoint, set$renderBattle, set$energy, set$interaction, set$floats, set$cardAnims, set$viewingGrave, set$viewingDeck, set$dreadShown, set$pendingHint } from './battle.runtime.js';
import { requestBattleRender, interactionOf, cloneData, cardIdentity, R, alive, drawCards, sweepDead, findCard, infuseOf, effCostOf, restore, finish, cancelInteraction, flee, handCurseSpecs, getSnapshot, useEquipSkill, start, toggleDeckCard, cancelDeckSelection, beginBoss, targetSide, unplayableReason, play, toggleInfusePick, cancelInfuse, beginInfuse, confirmInfuse, aegisBlocked, hitFoe, matchHandSelectKey, skipHandSelect, pickHandSelect, useItem, bagSlam, resolveDart, resolveSlam, usePotion, openBag, closeBag, pickChoice, pickDiscover } from './battle.engine.js';
import { endTurn, surrender } from './battle.enemy-phase.js';
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

  
  
  
  function configureBattleRenderer(renderer) {
    set$renderBattle(typeof renderer === 'function' ? renderer : () => {});
  }
  

  
           // 敌人数组 [{id,name,hp,maxHp,atk,affix,affixName,dead,status,defense}]
         // { isBoss, layer, returnTo, name }
  
  
  
              // 墓地（v0.25）：被消耗的牌（注能牺牲品等）；不参与洗回
  
  
  
  
                // 手牌选卡（2026-09-06 #24/#25）：{n,type,act,thenText}
  
                     // 抉择面板（2026-09-08 人工 N 选一）：{cardName, options:[text]}
  
               // 「破隐一击伤害翻倍」战斗规则（白梅落影·妄）
                  // 「下一张法术施放 N 次」（元素风暴）
  // —— 批次C：统一交互槽（审计 P1「删除 pendingTarget 的多重语义」）——
  // 「等待目标」的三种语义收敛为一个槽：kind 'card'=指向性卡牌 / 'item'=药水点选 / 'slam'=背包砸击。
  // 同一时刻至多一个进行中交互；入场只走 begin*（新交互自动顶替旧交互）；出场只有两条路：
  // resolve*（带目标结算后清槽）与 cancelInteraction（幂等，任何时机可调，无交互时 no-op）。
  // 快照对视图仍派生 pendingTarget / pendingItem / slamPending 三个兼容字段，视图读法不变。
          // { kind:'card'|'item'|'slam', uid, card, hint }
  
  
  
        // 拖拽提示（拖错目标时给出纠正文案）
            // 「回合开始时」延迟效果 [{text, cardName, repeat}]（repeat=装备每回合触发）
      // 「下回合无法抽牌」标记（下个回合开始消耗掉）
    // 正在查看墓地（BOSS 战专属：消耗过的牌 + 类型统计）
     // 正在查看牌库（BOSS 战专属，2026-09-13 留言：点击可看牌库中的卡）
      // 正在查看战斗背包（2026-09-09 老板：战斗中可开背包用道具）
             // 待展示的飘字/受击特效 [{unit:'self'|敌人idx, text, cls}]（渲染后由视图消费）
          // 待播放的牌局动画事件 [{kind:'draw'|'play'|'burn'|'dump', uid, name, side, target}]（渲染后由视图消费）
   // 本场合法动作提交序号；仅供表现层 receipt 去重，不参与规则结算
     // 击杀后自己头上的随机文字欢呼（替代 emoji，配 stk-cheer 小字样式）
      // BOSS 登场竖线阴影每场只演一次
      // 「本局对战内所有法术 1 费」（银河之旅，战斗内永久）
      // 「本局对战内所有招式 1 费」（银河之旅 2026-09-08 描述改版，招式=武术）
     // 「'杀'化为X」战斗规则（不朽神剑/青龙偃月斩，打出初始攻击时替换）
    // 「每消耗 1 张卡牌施放 N 次火球」（深渊降焰，降临者英雄）
      // 最近一次抽牌进手的 uid（万剑归宗「直接释放其中武术」用）
   // 上一张打出的卡牌类型（连击箭「上一张是武术→0费」）
   // 本回合已打出的武术数（追斩「每打出一张其他武术→费用-1」，回合开始清零）
     // 本回合已打出的招式数＝武术+法术（连续射击「每打出一张其他招式→2点固定伤害」，回合开始清零）
  
  // 「对战开始时」装备（2026-09-16 定版）：并入 15 张套牌——编入即在本场开战自动生效。
  // 旧「单列勾选区」只改 selEquips、从不驱动被动/上限（被动与上限都读 sel），属死 UI，
  // 2026-09-19 审计 P2-6 拆除：selEquipPool/selEquips/lastEquipSel/toggleDeckEquip 全套移除。
  // —— 2026-09-09 机制审计补实装（Q1-Q8 老板定向批次）——
                 // 随从位（征召）：优先替玩家承伤、每回合自动攻击
     // 「回合开始时本牌伤害+N」卡名（充能火球）
                 // uid → 已累积的额外伤害（战斗内成长）
             // 本场战斗累计注能牺牲张数（元素符印解锁）
        // 元素符印本局是否已解锁（防重复结算）
           // 命运钟表：额外回合（跳过敌方阶段一次）
               // 黑暗吊坠：剩余免致命充能
               // 饮血剑：每消灭 1 敌 +1 攻（本局层数来源）
       // 毒杖：每打出 1 张法术 → 随机敌附加中毒
        // 腐化之种：本局中毒敌人死亡时层数转移
  // —— 龙巢符文（第二玩法，2026-09-16 定版）——
  
  
            // 时光：正面计时状态不递减
           // 箭矢：箭释放 2 次
         // 不屈：受伤抽 1
             // 灰烬：手牌上限 9、溢出招式直接释放
       // 无限：套牌外招式 -1 费
            // 圣洁：前 3 回合免疫诅咒
      // 火球：回合开始消耗牌库底并随机放火球
        // 冰冻：冰冻角色后抽 2
           // 极速：回合结束打出最左侧手牌
       // 时空：牌库空时额外回合（一次）
  
                // 防御：获得护甲翻倍
            // 受缚之残影：深海封印已破除（化形一次性）
   // 深渊主宰·妲莉薇特：旧日再临——免疫诅咒
    // 深渊主宰·妲莉薇特：旧日再临——本场所有法术均已注能
    // 自然法杖：uid → 0 费生效到的回合数（含）
   // 不变应万变：uid → 战斗内替身卡（不污染背包原卡）
               // 已穿戴装备（2026-09-09 老板 #9）：{uid, card, used}，used = 限定技能是否已用
        // 需求 #17：「直接释放」的临时卡 uid（打出免费用，仍需选目标）
     // 战斗中退出后只保存入场检查点，读档从本场开头重开
  

  
  
  
  
  
  

  
  
  const AFFIX_META = {
    grow:   { icon: '[[icon:arrow]]', name: '军威',     desc: '每个回合结束时攻击力 +2' },
    frenzy: { icon: '[[icon:tools]]', name: '狂乱',     desc: '每回合攻击两次，每次附加 1 层流血或中毒' },
    aegis:  { icon: '[[icon:crystal]]', name: '元素庇幕', desc: '偶数回合减免所有伤害（破甲可克制）' },
  };
  
  

  

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

  

  // 文本效果击杀后的死亡补扫（描述直伤/偷攻等不经过 hitFoe 的路径）
  
  

  // 腐化之种（cc-rot-seed）：本局打出后，中毒敌人死亡时把中毒层数转移给另一名存活敌人。
  // 三个死亡入口（hitFoe 直伤 / sweepDead 补扫 / afterEnemies 毒发）统一走这里
  

  // 龙巢：完全形态·元素领主的复活（死亡时以 8 攻 8 心复活一次，清除全部诅咒）
  
  // 借过：复活体在同回合内被再次击杀
  
  // 龙巢：远古龙尊阶段切换（血量 2/3、1/3 阈值）
  

  
  
  // 创造一张牌直接插入牌库（「将 x 洗入牌库」用；不进手牌，战后随临时卡消散）
  
  

  // —— 从牌库抽取 N 张指定类型的牌（武装）；普通战斗没有牌库 → 直接改发临时卡 ——
  

  // —— 释放手牌中所有匹配「箭/杀/火球」的卡（连弩）；每释放 drawEach 张抽牌；max 限次（百炼青虹剑「一次」）——
  

  // —— 自动释放刚抽到的指定类型手牌（万剑归宗：直接释放其中武术）——
  

  

  
  
  

  // 实际费用：宇宙形态下所有卡牌变为 1 费；「本局对战内所有法术/招式 1 费」（银河之旅）
  // 各自只对法术/武术（招式）生效——两者都是战斗内永久效果（本局对战内词条）；
  // 自然法杖「下回合变为 0 费」按 uid 查 zeroFeeUntil
  

  // 群体伤害判定（设计者：群体伤害不用选目标）
  

  // ---------- 诅咒之刃（2026-09-10 需求）：收集手牌招式的诅咒 ----------
  // 招式＝武术+法术（设计者定版）。逐条扫描描述里的诅咒句式（与效果引擎的
  // 附加/施加句式同口径），层缺省按 1、破甲/禁疗按引擎缺省 2 回合。
  
  
  // 合并当前手牌所有招式的诅咒：可叠加诅咒（流血/中毒）层数累加，其余同 key 取最高
  

  // 迷之匣「限定技能：发现两张随机招式，交换其费用」（2026-09-10 需求）：
  // 排队两次「三选一」发现（招式＝武术+法术，随机池同口径），两张都置入手牌后
  // 由 swapCardCosts 互换费用。pair 数组被两次发现任务共享，作为累计载体。
  
  

  // ---------- 战斗入场检查点持久化 ----------
  // 战斗中退出/关窗不保存半结算局面；只保存进入本场战斗前的对局状态、敌人定义、
  // RNG 与已确认的 BOSS 套牌。读档时重新执行开战流程，保证费用、触发和敌方回合
  // 不会被退出动作跳过。
  function serialize() {
    if (!G || !G.battleActive || !opts || !battleRestartCheckpoint) return null;
    return cloneData(battleRestartCheckpoint);
  }

  

  

  // ---------- 墓地查看（BOSS 战专属：普通战斗没有牌库/墓地概念） ----------
  // 玩家点「墓地」可看到自己消耗过哪些牌（注能牺牲品等），并按卡牌类型统计数量。
  // 墓地不参与洗回；战胜 BOSS 后的「整理背包」环节可把这些牌放回背包或丢弃。
  function closeGrave() {
    set$viewingGrave(false);
    requestBattleRender();
  }

  // —— 快照缓存 ——
  // engine 的 captureSnapshotInput 统一采集视图输入，snapshot 模块用同一输入生成签名和只读快照。
  // 新增视图字段时在这两处同步添加；拖拽移动复用当前快照，重绘后再取新快照。
  
     // status 全部数值键（bleed/poison 已含在 CURSES）
  
  

  

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

  function openGrave() { set$viewingGrave(true); requestBattleRender(); }
  function openDeckView() { if (mode !== 'boss') return; set$viewingDeck(true); requestBattleRender(); }
  function closeDeckView() { set$viewingDeck(false); requestBattleRender(); }
  // 统一幂等取消（批次C）：一次调用清掉整个交互槽，无交互时 no-op。
  // 直接释放/freeCast 的卡取消后留在手牌按原费打出（原 cancelPendingTarget 语义）。
  
  function cancelPendingTarget() { cancelInteraction(); }
  // 统一交互入场（批次C）：指向性卡牌进入「等待目标」，单槽顶替旧交互
  
  function setPendingHint(value) { set$pendingHint(String(value || '')); requestBattleRender(); }
  function lockPendingTarget(value) { set$interaction(value ? { kind: 'card', uid: value.uid, card: value.card, hint: '' } : null); set$pendingHint(''); requestBattleRender(); }
  function markDreadShown() { set$dreadShown(true); }
  function takeFloats() { const list = floats; set$floats([]); return list; }
  function takeCardAnims() { const list = cardAnims; set$cardAnims([]); return list; }

  // —— 开发者控制台（2026-09-19 留言 #22：战斗中 Ctrl+L 弹出）——
  // 调试能力统一入口：只有 openDevConsole 的按钮会调用，不进任何常规交互链路
  function devCommand(name, arg) {
    switch (name) {
      case 'energy':
        set$energy(maxEnergy);
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

// 批5 理顺：battle.view 拆片后按名直引（viewApi 原样保留给既有消费方与测试）
export { AFFIX_META, Combat, R, aegisBlocked, effCostOf, findCard, infuseOf, markDreadShown, pileTip, refillDrawPile, takeFloats, takeCardAnims, targetSide, unplayableReason, matchHandSelectKey, handCurseSpecs, getPreviewContext };
export { BattleSession, commands, configureBattleRenderer, getSnapshot, restore, serialize, start, viewApi };

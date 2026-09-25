/* ============================================================
 * game.session.js —— 搜打撤会话生命周期 + 兼容导出面（2026-09-25 拆分后）
 *
 * 流程：选入口 → 点击相邻节点移动 → 落脚触发格子事件
 *   层间门：踩到弹窗（进入下一层 / 返回上一层 / 终层可撤离）
 *   祭坛入口：进入祭坛挑战 BOSS（M1 实装卡牌战斗）
 *   紧急撤离点：花 10 币直接撤离
 *
 * 2026-09-25 拆分（battle.runtime 同款手法）：内核/模式/背包/地图几何/迷雾小地图
 * 拆入 game.session.kernel/modes/bag/map/board.js，终局结算经 game.session.death.js
 * 工厂注入；本文件保留档位存取、存读档、开局流程、菜单装配与进层，并原样转发
 * 全部具名导出——调用方零改动。tests 对本文件有源文本断言（run-architecture 的
 * canReceiveCard 正则、random 的 rng 字段、hub-flow 的 skipClassChoice 行），勿移。
 * ============================================================ */
/* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { esc } from '../core/shared.js';
import { RunStorage, SLOT_COUNT } from '../hub/game.storage.js';
import { commitBaseAndRun, readSettlementReceipt, recoverSlot, recoverSlotIfPending } from '../hub/recovery.commands.js';
import { validatePendingExtraction } from '../hub/extraction.commands.js';
import { createTerminalCommands } from '../hub/terminal.commands.js';
import { createGameMenuController } from '../ui/game.menu.js';
import { ensureBattleReady } from '../battle/battle-loader.js';
import { Random } from '../core/random.js';
import { GENERATOR_VERSION, LAYOUT_VERSION } from './map-generator.js';
import { createMapSnapshot, planMapRestore, validateMapSnapshot } from './map-snapshot.js';
import { game, runtime, MAP, cam, curLayer, cellCenter } from './game.session.kernel.js';
import { MODES, modeCfg, applyModeRules } from './game.session.modes.js';
import { assertZones, cardStacks, canAcceptCard, safeCap, safeUsed, stackCapOf, refreshCardClones, PEARL_BOX_ID } from './game.session.bag.js';
import { clampIndex, installDerived, buildNewRunDerived } from './game.session.map.js';
import { markSeen } from './game.session.board.js';
import { createDeathSettlement } from './game.session.death.js';

// ---------- 档位与终局代数（会话内可变绑定；跨模块只经访问器读写） ----------
let activeSlot = null;                // 当前游玩的档位（1..5），标题界面为 null
let terminalGeneration = 0;
export const getActiveSlot = () => activeSlot;
export const _set_active_slot = value => { activeSlot = value; };
const getTerminalGeneration = () => terminalGeneration;
const nextTerminalGeneration = () => ++terminalGeneration;

// 两键结算命令（创建/提交/重放尝试）：同步读档位与游玩时长，供终局结算与菜单复用
const terminalCommands = createTerminalCommands({
  getBase: () => SDT.Base,
  getRunStorage: () => RunStorage,
  getRecovery: () => ({ recoverSlot, readSettlementReceipt, commitBaseAndRun }),
  getActiveSlot: () => activeSlot,
  syncPlayTime,
});

// 受击反馈与终局结算（terminal pending 两键提交/重试/失败面板）：工厂注入会话依赖
const { doDeath } = createDeathSettlement({
  game, runtime, terminalCommands,
  getActiveSlot, getTerminalGeneration, nextTerminalGeneration,
  cardStacks, safeUsed, safeCap, pearlBoxId: PEARL_BOX_ID,
});

  // 背包能否再收这张卡：同名堆未满 → 并入不占新格；堆已满 → 需要一个空格。
  // 本函数留在本文件且保持原缩进形态：tests/run-architecture.test.js 以源文本正则
  // 提取函数体做纯逻辑断言（new Function 注入 game/stackCapOf/canAcceptCard）。
  function canReceiveCard(card) {
    if (!card) return false;
    const owned = game.ownedCards.filter(o => !o.safe && !o.stored && o.card.name === card.name).length;
    if (owned > 0 && owned % stackCapOf(card) !== 0) return true;
    return canAcceptCard(card);
  }
game.canReceiveCard = canReceiveCard; // 叠放上限感知的收卡判定（#7）

// ---------- 存档（五档位，互相独立；基地数据也按档位隔离，见 base.js） ----------
// 读档数值归一化（迭代评审 09-20 G-P2）：Number.isFinite 强转——0 是合法值不能用 || 兜底
//（会吃掉 0 币/0 血），缺失/NaN/类型异常回退默认，防 undefined 进血条全线 NaN、hp 缺失恒假打不死
const numOr = (v, d) => { const n = +v; return Number.isFinite(n) ? n : d; };
let lastSaveFailWarnAt = 0;           // 写档失败警示 30s 节流（迭代评审 09-20 G-P3）：成功落盘即复位
let lastSaveConflictWarnAt = 0;

const hasRun = (i) => RunStorage.has(i);                            // 该档有进行中的对局

function readSlot(i) {
  return RunStorage.read(i);
}

function migrateOldSave() {
  RunStorage.migrateLegacy();
}

function saveGame() {
  // 整理期间只有两键结算命令能推进存档，常规自动保存不得覆盖待入库状态。
  if (game.pendingExtraction || game.extractionPending || game.terminalPending) return false;
  // v0.21：只有真正开局后（runActive）才写对局存档；在基地/标题界面不产生对局文件
  // 只保存稳定节点；动画中可能仍停在线段中间，退出/刷新后必须回到上一个落点。
  if ((!game.runActive && !game.nestActive) || game.state === 'title' || game.state === 'done' || game.state === 'boot' || game.state === 'moving') return;
  if (!activeSlot) return;
  syncPlayTime();
  assertZones();
  let snapshotResult = game.nestActive ? { ok: true, value: null } : createMapSnapshot({
    mapSeed: game.mapSeed, generatorVersion: game.generatorVersion, layoutVersion: game.layoutVersion, layerData: game.layerData,
    routeVersion: game.routeVersion, routePlan: game.routePlan,
  });
  if (snapshotResult.ok && !game.nestActive) snapshotResult = validateMapSnapshot(snapshotResult.value, { layerIdx: game.layerIdx, trackPos: game.trackPos });
  if (!snapshotResult.ok) {
    UI.log('[[icon:cross]] 路线快照校验失败，本次未覆盖旧对局存档', 'warn');
    return false;
  }
  const ok = RunStorage.write(activeSlot, {
      seed: Random.seed, rngState: Random.snapshot(),
      mapSeed: game.mapSeed ?? Random.seed,
      generatorVersion: game.generatorVersion ?? GENERATOR_VERSION,
      layoutVersion: game.layoutVersion ?? LAYOUT_VERSION,
      geometryVersion: game.geometryVersion ?? null,
      routeVersion: game.routeVersion ?? null,
      mapSnapshot: snapshotResult.value,
      layerIdx: game.layerIdx, trackPos: game.trackPos,
      hp: game.hp, maxHp: game.maxHp, coins: game.coins, turn: game.turn,
      atk: game.atk, mode: game.mode, myClass: game.myClass || null, characterId: game.characterId || null,
      inventory: game.inventory, ownedCards: game.ownedCards,
      cardOrder: game.cardOrder || [],
      usedPocket: game.usedPocket,
      eventLog: game.eventLog || [],
      visited: game.visited || {},
      seen: game.seen || {},
      fragments: game.fragments || 0,
      discovered: [...game.discoveredPairs],
      bossKilled: !!game.bossKilled,
      altarActivated: !!game.altarActivated,   // 第四层祭坛是否已激活（首脑格准入条件）
      altarRewardPending: !!game.altarRewardPending,   // 祭坛奖励待领取（回赠面板可重进，只能领一次）
      bossPlan: (game.bossPlan == null ? null : game.bossPlan),   // 本层首脑预案（进层 roll 一次存全层，2026-09-13 老板拍板）
      altarItemSacrificed: !!game.altarItemSacrificed,   // 祭坛道具献祭一次性锁（2026-09-19 老板定版）
      shopStocks: game.shopStocks || {},   // 各商店货架（按格子/门持久，防关门重刷，2026-09-19 审计 D-1）
      elapsed: game.elapsed,
      slot: activeSlot, savedAt: Date.now(),
      // 战斗中退出/关窗（beforeunload）：只写战斗入场检查点；读档从本场战斗开头重开
      battle: (game.battleActive && SDT.Battle && typeof SDT.Battle.serialize === 'function')
        ? SDT.Battle.serialize() : null,
      // 龙巢进行中状态（2026-09-18 断点续战）
      nestActive: !!game.nestActive,
      nestPos: game.nestPos == null ? 0 : game.nestPos,
      cardBox: game.cardBox || [],
      nestRunes: game.nestRunes || [],
      nestEquipped: game.nestEquipped || [],
      nestBossName: game.nestBossName || null,
      nestTargetedBox: game.nestTargetedBox || 0,
      pendingRunePick: game.pendingRunePick || null,
    });
  if (!ok) {
    if (RunStorage.lastWriteIssue(activeSlot) === 'STALE_SLOT') {
      const now = Date.now();
      if (now - lastSaveConflictWarnAt >= 30_000) {
        lastSaveConflictWarnAt = now;
        UI.log('[[icon:cross]] 档位已在其他标签页更新，对局进度未保存，请重新载入档位后继续', 'warn');
        console.warn('[save] 对局存档版本冲突：请重新载入档位后继续');
      }
      return false;
    }
    // 写失败（典型：localStorage 配额满，五档对局+基地+留言共约 5MB）不提示就是无声丢档。
    // 30s 节流+成功复位（迭代评审 09-20 G-P3）：处置前持续丢进度有感知、腾出空间后立即恢复提醒
    const now = Date.now();
    if (now - lastSaveFailWarnAt >= 30_000) {
      lastSaveFailWarnAt = now;
      UI.log('[[icon:cross]] 对局存档写入失败（存储空间可能已满），进度未被保存——请导出存档或删除旧档位', 'warn');
      console.error('[save] RunStorage.write 失败：对局进度未落盘（配额满或存储不可用）');
    }
  } else {
    lastSaveFailWarnAt = 0;   // 成功落盘=已恢复，下次失败立即提示（节流不吞「已恢复」后的第一次告警）
    lastSaveConflictWarnAt = 0;
  }
  return ok;
}

function syncPlayTime() {
  if (!activeSlot || !SDT.Base.slot) return;
  const now = Math.max(0, +game.elapsed || 0);
  const prev = Math.max(0, +game.elapsedSynced || 0);
  const delta = Math.max(0, now - prev);
  if (delta > 0) {
    SDT.Base.data.stats.playSeconds = Math.max(0, +SDT.Base.data.stats.playSeconds || 0) + delta;
    game.elapsedSynced = now;
    SDT.Base.save();
  }
}

// 删除某档位：对局进度 + 基地一起清空（该档位回到未创建状态）
function clearSlot(i) {
  RunStorage.remove(i);
  SDT.Base.wipe(i);
}
function clearSave() { if (activeSlot) RunStorage.remove(activeSlot); }
function clearAllSlots() { for (let i = 1; i <= SLOT_COUNT; i++) clearSlot(i); }

function preflightRunMap(slot) {
  const identity = RunStorage.readIdentity(slot);
  if (identity.code === 'RECOVERY_REQUIRED') return { ...identity, preserveRun: true };
  const s = RunStorage.readForLoad(slot);
  if (!s) {
    return { ok:false, code:RunStorage.issue(slot)==='tooNew'?'RUN_TOO_NEW':'RUN_UNREADABLE', message:'对局存档无法读取', preserveRun:true };
  }
  if (s.pendingExtraction != null) {
    const pending = validatePendingExtraction(s.pendingExtraction);
    if (!pending.ok) return { ...pending, preserveRun: true };
    if (!identity.ok || identity.value.runId !== s.pendingExtraction.runId) {
      return { ok: false, code: 'INVALID_EXTRACTION_IDENTITY', message: '撤离整理记录与对局身份不一致', preserveRun: true };
    }
  }
  const planned=planMapRestore(s);
  return planned.ok?{ok:true,value:{run:s,plan:planned.value}}:planned;
}

function loadGame(slot) {
  const preflight=preflightRunMap(slot);
  if(!preflight.ok) {
    if (preflight.code === 'RUN_UNREADABLE') UI.log('[[icon:cross]] 对局存档损坏（原数据已备份），无法读取', 'warn');
    else if (preflight.code === 'RUN_TOO_NEW') UI.log('[[icon:cross]] 对局存档来自更新版本的游戏，无法读取', 'warn');
    else UI.log(`[[icon:cross]] ${preflight.message}，原档已保留`, 'warn');
    return preflight;
  }
  const {run:s,plan}=preflight.value;
  game.seed = Random.restore(s.rngState || s.seed);
  if (plan.source !== 'nest') installDerived(plan.layerData, plan.mapSeed, plan.generatorVersion, plan.layoutVersion, plan.routeVersion, plan.routePlan);
  SDT.Base.use(slot);   // 该档位的基地数据（仓库/熟练度/成就/卡背）
  const bi = SDT.Base.issue(slot);
  if (bi === 'corrupt') UI.log('[[icon:cross]] 该档位基地数据损坏（原数据已备份），本次以空档案启动', 'warn');
  else if (bi === 'tooNew') UI.log('[[icon:cross]] 该档位基地数据来自更新版本的游戏，已以空档案启动', 'warn');
  game.runActive = true;
  setLobby(false);      // 直接回到棋盘上的对局：恢复左侧栏
  game.hp = numOr(s.hp, MAP.rules.playerMaxHp);   // 归一化（09-20）：迁移链之后执行，坏字段回退默认
  game.maxHp = numOr(s.maxHp, MAP.rules.playerMaxHp);
  game.atk = numOr(s.atk, MAP.rules.playerAtk);
  game.coins = numOr(s.coins, 0); game.turn = numOr(s.turn, 1);
  game.mode = MODES[s.mode] ? s.mode : 'standard';
  game.myClass = s.myClass || null;
  game.characterId = s.characterId || null;
  applyModeRules();
  game.inventory = Array.isArray(s.inventory) ? s.inventory : [];
  game.ownedCards = Array.isArray(s.ownedCards) ? s.ownedCards : [];
  game.cardBox = Array.isArray(s.cardBox) ? s.cardBox : [];
  // 能力卡术语迁移（原「英雄卡」类型，2026-09-08 定版）：存档内整卡副本与基地仓库/口袋同步更名
  {
    const copies = game.ownedCards.map(o => o.card)
      .concat(game.cardBox || [])
      .concat((SDT.Base.data.stash || []).concat(SDT.Base.data.pocket || []).map(st => st.card));
    const abilityChanged = SDT.Cards.applyAbilityRename(copies);
    const duplicateChanged = SDT.Cards.applyDuplicateRenames(copies);
    if (abilityChanged || duplicateChanged) SDT.Base.save();
  }
  game.cardOrder = Array.isArray(s.cardOrder) ? s.cardOrder : [];
  game.usedPocket = Array.isArray(s.usedPocket) ? s.usedPocket : [];
  // 背包/仓库/消耗口袋卡牌快照刷新（2026-09-10 留言 #22/#37）：发牌时存的是卡库快照克隆且
  // 从不随版本更新——旧档里「血蝠风暴」还卡着旧费用 4（每回合 2 费永远注能不了）、「法力奔涌」
  // 带着旧措辞描述（识别正则失配整卡无效）。读档时按 id 用现行卡库刷新克隆。
  refreshCardClones(game.ownedCards.map(o => o.card)
    .concat(game.usedPocket.map(p => p.card))
    .concat(game.cardBox || [])
    .concat((SDT.Base.data.stash || []).concat(SDT.Base.data.pocket || []).map(st => st.card).filter(Boolean)));
  game.eventLog = Array.isArray(s.eventLog) ? s.eventLog : [];
  // 迷雾与防重刷（旧档无字段 → {}，走【全部可见/可重复】的兼容路径）
  game.visited = (s.visited && typeof s.visited === 'object') ? s.visited : {};
  game.seen = (s.seen && typeof s.seen === 'object') ? s.seen : {};
  game.fragments = +s.fragments || 0;   // 员工通行证A碎片（旧档无字段 → 0）
  game.bossKilled = !!s.bossKilled;     // 本局是否已击败首脑（终局撤离条件）
  game.altarActivated = !!s.altarActivated;   // 第四层祭坛是否已激活（首脑格准入条件，旧档无字段 → false）
  game.altarRewardPending = !!s.altarRewardPending;   // 祭坛奖励待领取（旧档无字段 → false）
  game.bossPlan = (s.bossPlan == null ? null : +s.bossPlan);   // 本层首脑预案（旧档无字段 → null，进 boss 格时现 roll）
  game.pendingEventLoot = null;
  game.discoveredPairs = new Set(s.discovered || []);
  game.elapsed = s.elapsed || 0;
  game.altarItemSacrificed = !!s.altarItemSacrificed;   // 祭坛道具献祭一次性锁（旧档无字段 → false）
  game.shopStocks = (s.shopStocks && typeof s.shopStocks === 'object') ? s.shopStocks : {};
  // 旧存档只有本局 elapsed：首次读取时把它安全迁入累计游玩时间。
  if ((SDT.Base.data.stats.playSeconds || 0) < game.elapsed) {
    SDT.Base.data.stats.playSeconds = game.elapsed;
    SDT.Base.save();
  }
  game.elapsedSynced = game.elapsed;
  game.extractionPending = null;
  game.terminalPending = null;
  game.pendingExtraction = s.pendingExtraction || null;
  if (game.pendingExtraction) {
    game.battleActive = false;
    game.nestActive = false;
    game.layerIdx = s.layerIdx;
    game.trackPos = s.trackPos;
    game.state = 'modal';
    const restored = runtime.resumeExtraction(game.pendingExtraction);
    if (!restored?.ok) return { ...(restored || { code: 'EXTRACTION_UNAVAILABLE' }), ok: false, preserveRun: true };
    return { ok: true, value: true };
  }
  if (plan.source === 'nest') {
    // 龙巢进行中存档：恢复牌盒/符文/进度并直接回到巢穴地图（2026-09-18 断点续战）
    game.nestActive = true;
    game.nestPos = s.nestPos || 0;
    game.nestRunes = s.nestRunes || [];
    game.nestEquipped = s.nestEquipped || [];
    game.nestBossName = s.nestBossName || '？？？';
    game.nestTargetedBox = s.nestTargetedBox || 0;
    game.pendingRunePick = s.pendingRunePick || null;
    game.nestBoss = null;   // 巢主在开战时重新降临（boss 定义不序列化）
    UI.log(`[[icon:download]] 已读取【档位 ${slot}】存档——研究所远征继续`, 'ok');
    window.SDT.Nest.renderNestMap();
    if (s.battle && SDT.Battle && typeof SDT.Battle.restore === 'function') {
      if (SDT.Battle.restore(game, s.battle)) saveGame();
    }
    return {ok:true,value:true};
  }
  game.nestActive = false;
  const safeLayer = s.layerIdx;
  const safeIdx = s.trackPos;
  enterLayer(safeLayer, safeIdx);
  SDT.Sound.music('board');
  UI.log(`[[icon:download]] 已读取【档位 ${slot}】存档`, 'ok');
  if (!game.myClass) runtime.openClassChoice();   // 上次存档时还没选职业：补上开局选择
  else if (s.battle && SDT.Battle && typeof SDT.Battle.restore === 'function') {
    if (SDT.Battle.restore(game, s.battle)) {
      // 读档恢复的战斗没经过 resolveCell：本格按已触发处理，撤退/胜利后不重复触发
      if (game.visited) game.visited[game.layerIdx + ',' + game.trackPos] = 1;
      saveGame();   // 恢复后立刻回写，防二次退出丢进度
    }
  }
  return {ok:true,value:true};
}

const menuController = createGameMenuController({
  SDT, UI, game, runtime, SLOT_COUNT, esc, readSlot, loadGame, clearSlot,
  hasRun, RunStorage, ensureBattleReady, recoverSlotIfPending, terminalCommands,
  saveGame, syncPlayTime, clearSave, clearAllSlots,
  getActiveSlot: () => activeSlot, preflightRunMap,
  setActiveSlot: value => { activeSlot = value; },
});
const { setLobby, showTitle, startNewGame, exitToTitle, quitGame, openSettings, openLeaveMenu, openTitleGuide, openSuggestionInbox } = menuController;

// ---------- 开局流程 ----------
const newUid = () => 'o' + Date.now().toString(36) +
  Math.floor(Random.random('identity') * 46656).toString(36) + Math.floor(Random.random('identity') * 1296).toString(36);

// 每局开始：固定携带 5 张初始牌「初始攻击」（同名堆叠）+ 1 张「火球」
// brought=1：开局带入的卡（放弃对局时无条件丢失，v0.21 规则）
// 2026-09-09 需求 #4 宠物加成：变形机器人 +2 张杀；火焰精灵把 5 张杀化为 5 张火球
function grantStarterSha() {
  const pet = SDT.Base.carriedPet ? SDT.Base.carriedPet() : null;
  const effect = (pet && pet.effect) || {};
  const shaN = MAP.rules.starterSha + (effect.extraSha || 0);
  const sha = SDT.Cards.all().find(c => c.id === SDT.Cards.SHA.id) || SDT.Cards.SHA;
  const fireball = SDT.Cards.all().find(c => c.id === 'tt3-fireball');
  if (effect.shaToFireball && fireball) {
    for (let i = 0; i < shaN; i++) {
      game.ownedCards.push({ uid: newUid(), card: { ...fireball }, brought: 1 });
    }
    UI.log(`[[icon:fire]] <b>火焰精灵</b>：起始背包中的 ${shaN} 张【初始攻击】化为 <b>${shaN} 张【火球】</b>`, 'ok');
  } else {
    for (let i = 0; i < shaN; i++) {
      game.ownedCards.push({ uid: newUid(), card: { ...sha }, brought: 1 });
    }
    if (effect.extraSha) UI.log(`[[icon:tools]] <b>变形机器人</b>：起始背包额外增加 <b>2 张【初始攻击】</b>（共 ${shaN} 张）`, 'ok');
  }
  // 2026-09-16 留言：初始不发火球（火球改为衍生稀有度）
}

// 把出发准备页选择的仓库卡牌带入背包（picks: 卡名 => 张数）
// 2026-09-09 修复需求 #8：此前只把卡从仓库移除、从未放进对局背包——带入的卡凭空消失
// 需求 #6：职业卡不能带入（带出后留在仓库，只能收藏/出售）
function applyDeployPicks(picks) {
  const B = SDT.Base;
  let loaded = 0;
  Object.keys(picks || {}).forEach(name => {
    const n = Math.max(0, Math.floor(+picks[name] || 0));
    if (n <= 0) return;
    const stack = B.data.stash.find(x => x.card.name === name);
    if (!stack) return;
    if (stack.card.rarity === '职业') {
      UI.log(`[[icon:cross]] 职业卡【${esc(name)}】无法带入对局（带出后留在仓库）`, 'warn');
      return;
    }
    const taken = B.takeStashCards(name, n);
    for (let i = 0; i < taken; i++) {
      game.ownedCards.push({ uid: newUid(), card: { ...stack.card }, brought: 1 });
    }
    loaded += taken;
  });
  if (loaded) UI.log(`[[icon:archive]] 从基地仓库携带 <b>${loaded}</b> 张卡牌出征`, 'loot');
}

function newRun(mode, picks, options = {}) {
  terminalGeneration++;
  game.seed = Random.reseed();
  game.mapSeed = game.seed;
  buildNewRunDerived(game.mapSeed);
  game.mode = MODES[mode] ? mode : 'standard';
  applyModeRules();
  game.runActive = true;    // v0.21：从这一刻起才写对局存档
  game.pendingExtraction = null;
  game.extractionPending = null;
  game.terminalPending = null;
  game.battleActive = false;   // 新开局必须与旧战斗会话切割（防旧战斗快照混入新档——2026-09-18 实测）
  setLobby(false);          // 进入棋盘：恢复左侧栏
  game.inventory = [];
  game.ownedCards = [];
  game.shopStocks = {};   // 商店货架按局重置（D-1 防关门重刷）
  game.cardOrder = [];
  game.usedPocket = [];
  game.eventLog = [];
  game.fragments = 0;   // 员工通行证A碎片（Q6 隐藏计数器）
  game.altarItemSacrificed = false;   // 祭坛道具献祭一次性锁（每局重置）
  game.pendingEventLoot = null;
  game.myClass = null;
  game.characterId = null;
  game.classCard = null;
  game.coins = modeCfg().startCoins || 0;
  game.maxHp = MAP.rules.playerMaxHp;
  game.hp = game.maxHp;
  game.atk = MAP.rules.playerAtk;
  game.discoveredPairs = new Set();
  game.turn = 1;
  game.elapsed = 0;
  game.elapsedSynced = 0;
  game.altarFrom = null;
  game.altarActivated = false;   // 第四层祭坛未激活——首脑格封印中
  game.altarRewardPending = false;   // 祭坛奖励待领取（激活后置位，领取消耗）
  game.bossPlan = null;   // 本层首脑预案（进层时重 roll，见 enterLayer）
  game.surrenderedRun = false;   // 本局是否因主动撤离判负（区分战败/撤离失败文案）
  game.bossKilled = false;   // 第四层击败首脑后才能终局撤离
  game.visited = {};   // 已结算过的一次性格（防回头路重刷战斗/宝箱/事件）
  game.seen = {};      // 战争迷雾：走过的节点 + 当前相邻节点可见，其余隐藏
  SDT.Sound.music('board');   // 出发：切入行军氛围
  UI.clearLog();
  UI.log(`欢迎来到<b>代号7</b>：本次玩法【<b>${modeCfg().name}</b>】——${modeCfg().ckpt}`, 'sys');
  UI.log('点击相邻节点前进，落脚触发事件；层间闸门通往更深区域，终层可完成撤离', 'sys');
  grantStarterSha();
  UI.log(`[[icon:cards]] 随身携带初始牌【<b>初始攻击</b>】×${MAP.rules.starterSha}（不可入库 / 安全格）`, 'sys');   // 2026-09-16 留言「初始不给火球」：欢迎语去掉火球（已不再发放）
  applyDeployPicks(picks);    // 出发准备页选择的仓库卡牌
  // 需求 #1：下一次出发后，基地消耗口袋清空（未复原的卡牌随之消散）
  if (SDT.Base.data.pocket.length) {
    UI.log(`[[icon:pocket]] 出发整理：基地消耗口袋已清空（${SDT.Base.data.pocket.reduce((a, b) => a + b.count, 0)} 张未复原的卡牌消散了）`, 'dim');
    SDT.Base.data.pocket = [];
    SDT.Base.save();
  }
  // 需求 #4：携带宠物「汪汪狗」的生命上限 +5
  const pet = SDT.Base.carriedPet ? SDT.Base.carriedPet() : null;
  if (pet && pet.effect && pet.effect.maxHp) {
    game.maxHp += pet.effect.maxHp;
    game.hp += pet.effect.maxHp;
    UI.log(`[[icon:paw]] 携带宠物<b>「${esc(pet.name)}」</b>：生命上限 +${pet.effect.maxHp}（${game.maxHp}）`, 'ok');
  } else if (pet) {
    UI.log(`[[icon:paw]] 携带宠物<b>「${esc(pet.name)}」</b>：${esc(pet.desc.replace(/^携带效果：/, ''))}`, 'ok');
  }
  // Item 18（2026-09-16 老板定版）：储备币不进局——留在基地用于孵蛋与基地建设，
  // 局内币与基地储备币彻底分开（原「出发时全部随身带走」口径作废）
  // 四层图从第一层的多个入口之一开始；这是起点选择，不消耗行动力。
  const l1 = game.layerData[0];
  const startIdx = l1.entrances[Math.floor(Random.random('gameplay') * l1.entrances.length)] || 0;
  enterLayer(0, startIdx);
  if (!options.skipClassChoice) runtime.openClassChoice();   // 从全部职业中选择 + 1 张随机职业卡（与 5 张初始攻击一起）
}

// ---------- 进层 ----------
function enterLayer(li, atIdx) {
  const safeLayer = clampIndex(li, game.layerData?.length || 1, 0);
  const layer = game.layerData?.[safeLayer];
  const safeIdx = layer?.logical?.[atIdx]
    ? atIdx
    : (layer?.entrances?.[0] ?? clampIndex(atIdx, layer?.logical?.length || 1, 0));
  game.layerIdx = safeLayer;
  game.trackPos = safeIdx;
  game.pos = cellCenter(safeLayer, safeIdx);
  markSeen(safeLayer, safeIdx);
  game.activeLayerBounds = game.layerBounds?.[safeLayer] || null;
  game.hop = 0;
  game.bossPlan = null;   // 每层 roll 一次首脑预案：层内重进 boss 格不再换人（2026-09-13 老板拍板）
  game.state = 'idle';
  if (cam) {
    // Focus on the currently available choices; unexplored map bounds no longer shrink them.
    const fitted = cam.frameExploration?.(game);
    if (!fitted) { cam.cx = game.pos.x; cam.cy = game.pos.y; cam.clamp(); }
  }
  const f = curLayer();
  const eIdx = f.entrances.indexOf(atIdx);
  const eName = eIdx >= 0 ? f.entranceNames[eIdx] : `#${atIdx} 格`;
  UI.log(`—— 置身 <b>${f.name}</b>（${eName}）——`, 'sys');
  saveGame();
  UI.refresh(game);
}

// ---------- 兼容导出面（与拆分前逐一对应，调用方零改动） ----------
export { SLOT_COUNT };
export { FX, MAP, configureGameRuntime, requestClassChoice, game, canvas, ctx, cam, dpr, _set_cam, _set_dpr, curLayer, cellCenter, pick, weighted } from './game.session.kernel.js';
export { MODES, modeCfg, scaledEnemy } from './game.session.modes.js';
export { bagCap, canAcceptCard, cardStacks, safeCap, safeUsed, usedSlots, gainCoins } from './game.session.bag.js';
export { buildDerived } from './game.session.map.js';
export { markSeen, renderMiniMap } from './game.session.board.js';
export { clearSave, enterLayer, doDeath, exitToTitle, hasRun, loadGame, migrateOldSave, newRun, newUid, openLeaveMenu, openSettings, openSuggestionInbox, openTitleGuide, preflightRunMap, quitGame, saveGame, setLobby, showTitle, startNewGame, syncPlayTime };

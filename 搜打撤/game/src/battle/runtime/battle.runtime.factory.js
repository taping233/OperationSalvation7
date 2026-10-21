import { clone } from '../../core/shared.js';
import { createBattleState, transitionBattle, cancelTargeting } from './battle.state.js';
import { createCombatRuntime } from '../core/combat.factory.js';

/** Each write updates this instance and its compatibility live bindings synchronously. */
export function createBattleRuntime({ combat = createCombatRuntime() } = {}) {
const Combat = combat;
const subscribers = new Set();
const values = {battleState: createBattleState(),
G: null,
foes: [],
opts: null,
mode: 'normal',
energy: 0,
maxEnergy: 0,
turn: 1,
pdef: null,
pstat: null,
busy: false,
allies: [],
battleRestartCheckpoint: null,
restoringRestartCheckpoint: false,
tmpSeq: 0,
activeActionSignal: null,
surgeWaiter: null,
lastPersistAt: 0,
drawPile: [],
hand: [],
discard: [],
granted: [],
played: [],
consumed: [],
grave: [],
delayed: [],
noDrawNext: false,
lastDrawnUids: [],
zeroFeeUntil: new Map(),
cardOverrides: new Map(),
equipped: [],
freeCast: new Set(),
infusing: null,
discovering: null,
discoverQueue: [],
handSelecting: null,
choosing: null,
interaction: null,
pendingHint: '',
viewingGrave: false,
viewingDeck: false,
viewingBag: false,
selPool: [],
selShaN: 0,
sel: new Set(),
lastDeckSel: [],
selectingDeck: false,
selDeckMax: 15,
stealthStrike: false,
nextSpellTwice: 0,
spellCost1: false,
meleeCost1: false,
shaTransform: null,
consumeFireballN: 0,
lastPlayedType: null,
playedMartialThisTurn: 0,
playedMovesThisTurn: 0,
growthNames: new Set(),
growth: {},
infuseFuels: 0,
handInfuseCounts: {},
sealUnlocked: false,
extraTurn: false,
deathSave: 0,
killAtkUp: 0,
poisonOnSpell: false,
poisonLegacy: false,
nestRunes: [],
nestSyn: {},
timeRune: false,
arrowRune: false,
unyieldRune: false,
ashRune: false,
unlimitedRune: false,
holyRune: false,
fireballRuneOn: false,
freezeRuneOn: false,
swiftRune: false,
timeSpaceRune: false,
timeSpaceUsed: false,
armorMul: 1,
sealDone: false,
playerCurseImmune: false,
allSpellsInfused: false,
renderBattle: () => {},
floats: [],
cardAnims: [],
presentationActionSeq: 0,
dreadShown: false,
snapCache: null,
snapSig: null};
const instanceState = new Proxy(values, { set(target, key, value) {
  target[key] = value;
  for (const listener of subscribers) listener(runtime, key);
  return true;
} });
/* 一场战斗的核心状态与执行生命周期。由 battle.runtime.js 转发活绑定。 */




















function set$G(v) { instanceState.G = v; }
function set$opts(v) { instanceState.opts = v; }
function set$mode(v) { instanceState.mode = v; }
function set$battleState(v) { instanceState.battleState = v; }
function set$foes(v) { instanceState.foes = v; }
/** @param {number} v */
function set$energy(v) { instanceState.energy = v; }
/** @param {number} v */
function set$maxEnergy(v) { instanceState.maxEnergy = v; }
/** @param {number} v */
function set$turn(v) { instanceState.turn = v; }
function set$busy(v) { instanceState.busy = v; }
function set$pdef(v) { instanceState.pdef = v; }
function set$pstat(v) { instanceState.pstat = v; }
function set$allies(v) { instanceState.allies = v; }
function set$battleRestartCheckpoint(v) { instanceState.battleRestartCheckpoint = v; }
function set$restoringRestartCheckpoint(v) { instanceState.restoringRestartCheckpoint = v; }
function set$activeActionSignal(v) { instanceState.activeActionSignal = v; }
function set$surgeWaiter(v) { instanceState.surgeWaiter = v; }
function set$lastPersistAt(v) { instanceState.lastPersistAt = v; }

// —— 第 4 批 session 打薄（2026-09-25）：域内语义化聚合接口 ——
// 只收「整组重置/还原」与「模板完全一致」的成组点；battleState 阶段机仅聚
// transitionBattle 同模板迁移，createBattleState 初始化与 beginTargeting 进入不聚。

// 阶段迁移（路线图第 4 批步骤 3）：lifecycle 终局/开局 ×4、enemy-phase 回合迁移 ×4 同模板点。
function transitionTo(phase) { instanceState.battleState = transitionBattle(instanceState.battleState, phase); }

// 取消指向（engine clearTargetSession / enemy-phase endTurn 两处同模板写点）。
// cancelTargeting 自带 phase 守卫（非 TARGETING 仅重置 interaction 不迁移）；调用点守卫与
// clearTargetHint 配对留在原地，跨域语句次序不动。
function cancelTargetingState() { instanceState.battleState = cancelTargeting(instanceState.battleState); }

// 临时牌 uid 序号（计数式聚合，参照 presentation nextActionSeq 先例）：自增并返回自增前序号，
// 替代 engine 五处 `set$tmpSeq(tmpSeq + 1), tmpSeq - 1` 逗号模板。
function nextTmpSeq() { instanceState.tmpSeq += 1; return instanceState.tmpSeq - 1; }

// （重）进场与终局的「abort/reset 后清信号」既有次序（lifecycle restore/finish/start 四处同模板）。
function clearActionSignals() { instanceState.activeActionSignal = null; instanceState.surgeWaiter = null; }

// 读档·会话核心字段回填（restore 前段逐字搬迁；defaultMaxEnergy 由调用点以 R().battleEnergy 解析）。
function restoreBattleSession(nextGame, data, defaultMaxEnergy) {
  instanceState.G = nextGame;
  instanceState.opts = clone(data.opts);
  instanceState.mode = data.mode === 'boss' ? 'boss' : 'normal';
  instanceState.turn = +data.turn || 1;
  instanceState.maxEnergy = +data.maxEnergy || defaultMaxEnergy;
  instanceState.energy = Number.isFinite(+data.energy) ? +data.energy : instanceState.maxEnergy;
}

// 读档·参战者回填（restore 中段逐字搬迁；intentFor 由 engine 注入经 lifecycle 传入，session 不 import 引擎，拒环）。
function restoreBattleCombatants(data, intentFor) {
  instanceState.pdef = { shield: 0, armor: 0, guard: false, ...(data.pdef || {}) };
  instanceState.pstat = Combat.ensureStatus({ hp: instanceState.G.hp, status: { ...(data.pstat?.status || {}) }, requestedCards: data.pstat?.requestedCards ? clone(data.pstat.requestedCards) : undefined });
  instanceState.foes = data.foes.map((f, index) => {
    const foe = {
      id: f.id || null, name: f.name, hp: f.hp, maxHp: f.maxHp, atk: f.atk || 2,
      affix: f.affix || null, affixName: f.affixName || null, behavior: f.behavior || null, dead: !!f.dead,
      protected: f.protected || undefined, protects: f.protects || undefined,
      boss: f.boss,
      controlBoss: f.controlBoss ?? f.boss ?? (!!instanceState.opts.isBoss && index === 0 && !instanceState.opts.nest),
      controlled: !!f.controlled, soulContractMarked: !!f.soulContractMarked,
      status: { ...(f.status || {}) },
      defense: { shield: 0, armor: 0, guard: false, ...(f.defense || {}) },
      intent: f.intent ? clone(f.intent) : null,
    };
    Combat.ensureStatus(foe);
    if (!foe.intent) foe.intent = intentFor(foe, instanceState.turn);
    return foe;
  });
}

// 开局运行态重置（resetBattleEntryState 前段逐字搬迁；defaultMaxEnergy = R().battleEnergy）。
function resetBattlePlayerState(defaultMaxEnergy) {
  instanceState.maxEnergy = defaultMaxEnergy;
  instanceState.energy = instanceState.maxEnergy;
  instanceState.turn = 1; instanceState.busy = false;
  instanceState.pdef = { shield: 0, armor: 0, guard: false };
  instanceState.pstat = Combat.ensureStatus({ hp: instanceState.G.hp });
}

/* 牌区、卡牌临时覆盖和装备的战斗内状态。由 battle.runtime.js 转发活绑定。 */











function set$drawPile(v) { instanceState.drawPile = v; }
function set$hand(v) { instanceState.hand = v; }
function set$discard(v) { instanceState.discard = v; }
function set$consumed(v) { instanceState.consumed = v; }
function set$grave(v) { instanceState.grave = v; }
function set$delayed(v) { instanceState.delayed = v; }
function set$noDrawNext(v) { instanceState.noDrawNext = v; }
function set$lastDrawnUids(v) { instanceState.lastDrawnUids = v; }
function set$equipped(v) { instanceState.equipped = v; }
function set$freeCast(v) { instanceState.freeCast = v; }

/* —— 域内聚合接口（2026-09-24 状态袋打薄试点）：散 set$Xxx 调用收敛到本域。
 * 同一域内多变量的整组重置/还原合并为一次调用；赋值顺序在域内保持原调用点的相对次序。 */
function clearBattlePiles() {
  instanceState.drawPile = []; instanceState.discard = []; instanceState.granted = []; instanceState.played = []; instanceState.consumed = []; instanceState.grave = [];
}
function restoreBattlePiles(data) {
  instanceState.hand = [...(data.hand || [])];
  instanceState.drawPile = [...(data.drawPile || [])];
  instanceState.discard = [...(data.discard || [])];
  instanceState.grave = [...(data.grave || [])];
  instanceState.played = [...(data.played || [])];
  instanceState.consumed = [...(data.consumed || [])];
  instanceState.granted = (data.granted || []).map(g => ({ uid: g.uid, card: { ...g.card } }));
}
function restorePilesBookkeeping(data) {
  instanceState.delayed = (data.delayed || []).map(d => ({ ...d }));
  instanceState.noDrawNext = !!data.noDrawNext;
  instanceState.lastDrawnUids = [...(data.lastDrawnUids || [])];
  instanceState.zeroFeeUntil = new Map(data.zeroFeeUntil || []);
  instanceState.cardOverrides = new Map(data.cardOverrides || []);
}
function resetPilesCarryover() {
  instanceState.delayed = []; instanceState.noDrawNext = false; instanceState.lastDrawnUids = [];
}
function resetCastOverrides() {
  instanceState.zeroFeeUntil = new Map(); instanceState.cardOverrides = new Map();
}

/* 玩家抉择、选牌与弹层的瞬时状态。由 battle.runtime.js 转发活绑定。 */
/** @typedef {import('../core/battle.hand-selection.js').HandSelectionState} HandSelectionState */
/** @typedef {import('../effects/battle.discover-state.js').DiscoveringState} DiscoveringState */
/** @typedef {import('../effects/battle.discover-state.js').DiscoverQueueJob} DiscoverQueueJob */

/** @type {DiscoveringState} */

/** @type {DiscoverQueueJob[]} */

/** @type {HandSelectionState} */









function set$infusing(v) { instanceState.infusing = v; }
/** @param {DiscoveringState} v */
function set$discovering(v) { instanceState.discovering = v; }
/** @param {DiscoverQueueJob[]} v */
function set$discoverQueue(v) { instanceState.discoverQueue = v; }
/** @param {HandSelectionState} v */
function set$handSelecting(v) { instanceState.handSelecting = v; }
function set$choosing(v) { instanceState.choosing = v; }
function set$interaction(v) { instanceState.interaction = v; }
function set$pendingHint(v) { instanceState.pendingHint = v; }
function set$viewingGrave(v) { instanceState.viewingGrave = v; }
function set$viewingDeck(v) { instanceState.viewingDeck = v; }
function set$viewingBag(v) { instanceState.viewingBag = v; }
function set$selPool(v) { instanceState.selPool = v; }
function set$selShaN(v) { instanceState.selShaN = v; }
function set$sel(v) { instanceState.sel = v; }
function set$lastDeckSel(v) { instanceState.lastDeckSel = v; }
function set$selectingDeck(v) { instanceState.selectingDeck = v; }
function set$selDeckMax(v) { instanceState.selDeckMax = v; }

/* —— 域内聚合接口（2026-09-25 状态袋打薄第 2 批）：散 set$Xxx 调用收敛到本域 ——
 * 只聚「整组重置/成对清理」点；弹层状态机推进（selection-flow 等）与单点开关保持散调。 */
function clearBattlePopups() {
  instanceState.infusing = null; instanceState.discovering = null; instanceState.handSelecting = null; instanceState.choosing = null; instanceState.interaction = null;
}
function closeBattleViews() {
  instanceState.viewingGrave = false; instanceState.viewingDeck = false; instanceState.viewingBag = false; instanceState.selectingDeck = false;
}
function clearTargetHint() {
  instanceState.interaction = null; instanceState.pendingHint = '';
}

/* 当场战斗的增益、符文与规则触发器。由 battle.runtime.js 转发活绑定。 */












// 实际注能事件只归属当时仍在手牌中的实例；离手暂停累计，回手保留已有值。

function set$handInfuseCounts(value) { instanceState.handInfuseCounts = { ...value }; }
function recordHandInfusion(uids) {
  for (const uid of new Set(uids)) instanceState.handInfuseCounts[uid] = (instanceState.handInfuseCounts[uid] || 0) + 1;
}
























function set$stealthStrike(v) { instanceState.stealthStrike = v; }
function set$nextSpellTwice(v) { instanceState.nextSpellTwice = v; }
function set$spellCost1(v) { instanceState.spellCost1 = v; }
function set$meleeCost1(v) { instanceState.meleeCost1 = v; }
function set$shaTransform(v) { instanceState.shaTransform = v; }
function set$consumeFireballN(v) { instanceState.consumeFireballN = v; }
function set$lastPlayedType(v) { instanceState.lastPlayedType = v; }
function set$playedMartialThisTurn(v) { instanceState.playedMartialThisTurn = v; }
function set$playedMovesThisTurn(v) { instanceState.playedMovesThisTurn = v; }
function set$infuseFuels(v) { instanceState.infuseFuels = v; }
function set$sealUnlocked(v) { instanceState.sealUnlocked = v; }
function set$extraTurn(v) { instanceState.extraTurn = v; }
function set$deathSave(v) { instanceState.deathSave = v; }
function set$killAtkUp(v) { instanceState.killAtkUp = v; }
function set$poisonOnSpell(v) { instanceState.poisonOnSpell = v; }
function set$poisonLegacy(v) { instanceState.poisonLegacy = v; }
function set$nestRunes(v) { instanceState.nestRunes = v; }
function set$nestSyn(v) { instanceState.nestSyn = v; }
function set$timeSpaceUsed(v) { instanceState.timeSpaceUsed = v; }
function set$sealDone(v) { instanceState.sealDone = v; }
function set$playerCurseImmune(v) { instanceState.playerCurseImmune = v; }
function set$allSpellsInfused(v) { instanceState.allSpellsInfused = v; }

/* 有效手牌上限：灰烬符文（runes.js 定版「你的手牌上限为 9，手牌中放不下的招式会直接释放」）
 * 挂上时为 9，否则用规则配置的 battleHandMax。消费点：drawCards 上限门/灰烬直释阈值、
 * deckDraw 手牌余量、keepInHand 回手——四点必须同源，否则上限与直释阈值互相打架。 */
function effectiveHandMax(ruleHandMax) { return instanceState.ashRune ? 9 : ruleHandMax; }

/* —— 域内聚合接口（2026-09-25 状态袋打薄第 3 批）：散 set$Xxx 调用收敛到本域 ——
 * 只聚「整组重置/整段回填/按 kind 写旗」点；规则中途回写（打出侧登记、消耗触发等）
 * 条件与日志交织，保持散调，不做伪聚合。 */
function restoreEffectState(data) {
  instanceState.spellCost1 = !!data.spellCost1; instanceState.meleeCost1 = !!data.meleeCost1;
  instanceState.shaTransform = data.shaTransform || null; instanceState.consumeFireballN = +data.consumeFireballN || 0;
  instanceState.lastPlayedType = data.lastPlayedType || null;
  instanceState.stealthStrike = !!data.stealthStrike; instanceState.nextSpellTwice = +data.nextSpellTwice || 0;
}
function restoreEffectRules(data) {
  instanceState.growth = { ...(data.growth || {}) }; instanceState.growthNames = new Set(data.growthNames || []);
  set$handInfuseCounts(data.handInfuseCounts || {});
  instanceState.infuseFuels = +data.infuseFuels || 0; instanceState.sealUnlocked = !!data.sealUnlocked;
  instanceState.extraTurn = !!data.extraTurn; instanceState.deathSave = +data.deathSave || 0;
  instanceState.killAtkUp = +data.killAtkUp || 0; instanceState.poisonOnSpell = !!data.poisonOnSpell;
}
function resetCostFlags() {
  instanceState.stealthStrike = false; instanceState.nextSpellTwice = 0;
  instanceState.spellCost1 = false; instanceState.meleeCost1 = false;
  instanceState.shaTransform = null; instanceState.consumeFireballN = 0; instanceState.lastPlayedType = null;
}
function resetRuneFlags() {
  instanceState.nestRunes = []; instanceState.nestSyn = {};
  instanceState.timeRune = false; instanceState.arrowRune = false; instanceState.unyieldRune = false;
  instanceState.ashRune = false; instanceState.unlimitedRune = false; instanceState.holyRune = false; instanceState.fireballRuneOn = false; instanceState.freezeRuneOn = false;
  instanceState.swiftRune = false; instanceState.timeSpaceRune = false; instanceState.timeSpaceUsed = false; instanceState.armorMul = 1;
}
/* 龙巢符文规则旗：按 kind 写对应旗（engine applyNestRunes 逐条 if 的域内收敛；未知 kind 不动） */
function applyRuneFlag(kind) {
  if (kind === 'time') instanceState.timeRune = true;
  if (kind === 'arrow') instanceState.arrowRune = true;
  if (kind === 'unyield') instanceState.unyieldRune = true;
  if (kind === 'ash') instanceState.ashRune = true;
  if (kind === 'infinite') instanceState.unlimitedRune = true;
  if (kind === 'holy') instanceState.holyRune = true;
  if (kind === 'shield') instanceState.armorMul = 2;
  if (kind === 'swift') instanceState.swiftRune = true;
  if (kind === 'fireball') instanceState.fireballRuneOn = true;
  if (kind === 'frozen') instanceState.freezeRuneOn = true;
  if (kind === 'spacetime') instanceState.timeSpaceRune = true;
}

/* 开战/终局「战斗作用域旗标」整组清零（治理批次 4a：lifecycle resetBattleExtras 中
 * effects 属地的 14 个散 set$ 收敛为域内一个入口；符文旗经 resetRuneFlags 一并清）。
 * 字段集与守卫测试白名单的 effects 片一致——新增跨战清零字段请同步此函数。 */
function resetBattleEffectFlags() {
  instanceState.growthNames = new Set(); instanceState.growth = {}; instanceState.handInfuseCounts = {};
  instanceState.infuseFuels = 0; instanceState.sealUnlocked = false; instanceState.extraTurn = false; instanceState.deathSave = 0;
  instanceState.killAtkUp = 0; instanceState.poisonOnSpell = false; instanceState.poisonLegacy = false;
  instanceState.sealDone = false; instanceState.playerCurseImmune = false; instanceState.allSpellsInfused = false;
  instanceState.playedMartialThisTurn = 0;   // 追斩计数跨战不残留
  instanceState.playedMovesThisTurn = 0;     // 连续射击计数跨战不残留
  resetRuneFlags();
}

/* 渲染回调、飘字、卡牌演出和快照缓存。由 battle.runtime.js 转发活绑定。 */








/* —— 域内聚合接口（2026-09-24 状态袋打薄试点）：散 set$Xxx 调用收敛到本域 —— */
function bindBattleRenderer(renderer) { instanceState.renderBattle = renderer; }
function showDread() { instanceState.dreadShown = true; }
function hideDread() { instanceState.dreadShown = false; }
function takeBattleFloats() { const list = instanceState.floats; instanceState.floats = []; return list; }
function takeBattleCardAnims() { const list = instanceState.cardAnims; instanceState.cardAnims = []; return list; }
function clearBattlePresentation() { instanceState.floats = []; instanceState.cardAnims = []; }
function resetBattlePresentation() { instanceState.floats = []; instanceState.cardAnims = []; instanceState.presentationActionSeq = 0; }
function nextActionSeq() { instanceState.presentationActionSeq += 1; return instanceState.presentationActionSeq; }
function storeBattleSnapshot(sig, snap) { instanceState.snapSig = sig; instanceState.snapCache = snap; }
const runtime = { combat, subscribe(listener) { subscribers.add(listener); return () => subscribers.delete(listener); },
get battleState() { return instanceState.battleState; },
get G() { return instanceState.G; },
get foes() { return instanceState.foes; },
get opts() { return instanceState.opts; },
get mode() { return instanceState.mode; },
get energy() { return instanceState.energy; },
get maxEnergy() { return instanceState.maxEnergy; },
get turn() { return instanceState.turn; },
get pdef() { return instanceState.pdef; },
get pstat() { return instanceState.pstat; },
get busy() { return instanceState.busy; },
get allies() { return instanceState.allies; },
get battleRestartCheckpoint() { return instanceState.battleRestartCheckpoint; },
get restoringRestartCheckpoint() { return instanceState.restoringRestartCheckpoint; },
get tmpSeq() { return instanceState.tmpSeq; },
get activeActionSignal() { return instanceState.activeActionSignal; },
get surgeWaiter() { return instanceState.surgeWaiter; },
get lastPersistAt() { return instanceState.lastPersistAt; },
get drawPile() { return instanceState.drawPile; },
get hand() { return instanceState.hand; },
get discard() { return instanceState.discard; },
get granted() { return instanceState.granted; },
get played() { return instanceState.played; },
get consumed() { return instanceState.consumed; },
get grave() { return instanceState.grave; },
get delayed() { return instanceState.delayed; },
get noDrawNext() { return instanceState.noDrawNext; },
get lastDrawnUids() { return instanceState.lastDrawnUids; },
get zeroFeeUntil() { return instanceState.zeroFeeUntil; },
get cardOverrides() { return instanceState.cardOverrides; },
get equipped() { return instanceState.equipped; },
get freeCast() { return instanceState.freeCast; },
get infusing() { return instanceState.infusing; },
get discovering() { return instanceState.discovering; },
get discoverQueue() { return instanceState.discoverQueue; },
get handSelecting() { return instanceState.handSelecting; },
get choosing() { return instanceState.choosing; },
get interaction() { return instanceState.interaction; },
get pendingHint() { return instanceState.pendingHint; },
get viewingGrave() { return instanceState.viewingGrave; },
get viewingDeck() { return instanceState.viewingDeck; },
get viewingBag() { return instanceState.viewingBag; },
get selPool() { return instanceState.selPool; },
get selShaN() { return instanceState.selShaN; },
get sel() { return instanceState.sel; },
get lastDeckSel() { return instanceState.lastDeckSel; },
get selectingDeck() { return instanceState.selectingDeck; },
get selDeckMax() { return instanceState.selDeckMax; },
get stealthStrike() { return instanceState.stealthStrike; },
get nextSpellTwice() { return instanceState.nextSpellTwice; },
get spellCost1() { return instanceState.spellCost1; },
get meleeCost1() { return instanceState.meleeCost1; },
get shaTransform() { return instanceState.shaTransform; },
get consumeFireballN() { return instanceState.consumeFireballN; },
get lastPlayedType() { return instanceState.lastPlayedType; },
get playedMartialThisTurn() { return instanceState.playedMartialThisTurn; },
get playedMovesThisTurn() { return instanceState.playedMovesThisTurn; },
get growthNames() { return instanceState.growthNames; },
get growth() { return instanceState.growth; },
get infuseFuels() { return instanceState.infuseFuels; },
get handInfuseCounts() { return instanceState.handInfuseCounts; },
get sealUnlocked() { return instanceState.sealUnlocked; },
get extraTurn() { return instanceState.extraTurn; },
get deathSave() { return instanceState.deathSave; },
get killAtkUp() { return instanceState.killAtkUp; },
get poisonOnSpell() { return instanceState.poisonOnSpell; },
get poisonLegacy() { return instanceState.poisonLegacy; },
get nestRunes() { return instanceState.nestRunes; },
get nestSyn() { return instanceState.nestSyn; },
get timeRune() { return instanceState.timeRune; },
get arrowRune() { return instanceState.arrowRune; },
get unyieldRune() { return instanceState.unyieldRune; },
get ashRune() { return instanceState.ashRune; },
get unlimitedRune() { return instanceState.unlimitedRune; },
get holyRune() { return instanceState.holyRune; },
get fireballRuneOn() { return instanceState.fireballRuneOn; },
get freezeRuneOn() { return instanceState.freezeRuneOn; },
get swiftRune() { return instanceState.swiftRune; },
get timeSpaceRune() { return instanceState.timeSpaceRune; },
get timeSpaceUsed() { return instanceState.timeSpaceUsed; },
get armorMul() { return instanceState.armorMul; },
get sealDone() { return instanceState.sealDone; },
get playerCurseImmune() { return instanceState.playerCurseImmune; },
get allSpellsInfused() { return instanceState.allSpellsInfused; },
get renderBattle() { return instanceState.renderBattle; },
get floats() { return instanceState.floats; },
get cardAnims() { return instanceState.cardAnims; },
get presentationActionSeq() { return instanceState.presentationActionSeq; },
get dreadShown() { return instanceState.dreadShown; },
get snapCache() { return instanceState.snapCache; },
get snapSig() { return instanceState.snapSig; },
set$G, set$opts, set$mode, set$battleState, set$foes, set$energy, set$maxEnergy, set$turn, set$busy, set$pdef, set$pstat, set$allies, set$battleRestartCheckpoint, set$restoringRestartCheckpoint, set$activeActionSignal, set$surgeWaiter, set$lastPersistAt, transitionTo, cancelTargetingState, nextTmpSeq, clearActionSignals, restoreBattleSession, restoreBattleCombatants, resetBattlePlayerState, set$drawPile, set$hand, set$discard, set$consumed, set$grave, set$delayed, set$noDrawNext, set$lastDrawnUids, set$equipped, set$freeCast, clearBattlePiles, restoreBattlePiles, restorePilesBookkeeping, resetPilesCarryover, resetCastOverrides, set$infusing, set$discovering, set$discoverQueue, set$handSelecting, set$choosing, set$interaction, set$pendingHint, set$viewingGrave, set$viewingDeck, set$viewingBag, set$selPool, set$selShaN, set$sel, set$lastDeckSel, set$selectingDeck, set$selDeckMax, clearBattlePopups, closeBattleViews, clearTargetHint, set$handInfuseCounts, recordHandInfusion, set$stealthStrike, set$nextSpellTwice, set$spellCost1, set$meleeCost1, set$shaTransform, set$consumeFireballN, set$lastPlayedType, set$playedMartialThisTurn, set$playedMovesThisTurn, set$infuseFuels, set$sealUnlocked, set$extraTurn, set$deathSave, set$killAtkUp, set$poisonOnSpell, set$poisonLegacy, set$nestRunes, set$nestSyn, set$timeSpaceUsed, set$sealDone, set$playerCurseImmune, set$allSpellsInfused, effectiveHandMax, restoreEffectState, restoreEffectRules, resetCostFlags, applyRuneFlag, resetBattleEffectFlags, bindBattleRenderer, showDread, hideDread, takeBattleFloats, takeBattleCardAnims, clearBattlePresentation, resetBattlePresentation, nextActionSeq, storeBattleSnapshot
};
return Object.freeze(runtime);
}

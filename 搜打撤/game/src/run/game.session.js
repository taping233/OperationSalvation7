import { createSessionPersistence } from './game-session-persistence.js';
import { createSessionRestoration } from './game-session-restoration.js';
import { createSessionDeparture } from './game-session-departure.js';
import { traceRestoreStep } from '../core/flight-recorder.local.js';
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
 * 工厂注入；保存、恢复和出征由显式端口控制器负责，本文件装配菜单与进层，
 * 并原样转发全部具名导出。
 * ============================================================ */
/* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { esc } from '../core/shared.js';
import { RunStorage, SLOT_COUNT, TX_KEY } from '../hub/game.storage.js';
import { createDeparturePersistence } from '../hub/departure-persistence.js';
import { planBaseDeparture } from '../hub/base-departure.commands.js';
import { validateRunSave } from '../hub/run-save-validation.js';
import { createSaveArchive, validateArchivedRun } from '../hub/save-archive.js';
import { withSlotWriteLock } from '../hub/slot-write-lock.js';
import { commitBaseAndRun, readSettlementReceipt, recoverSlot, recoverSlotIfPending } from '../hub/recovery.commands.js';
import { validatePendingExtraction } from '../hub/extraction.commands.js';
import { createTerminalCommands } from '../hub/terminal.commands.js';
import { createGameMenuController } from '../ui/game.menu.js';
import { openDataPage } from '../agent/agent.data.js';   // W1-01：经 deps 注入 menu（menu 保持无静态导入）
import { resetRunCounters, restoreRunBattles, snapshotRunBattles } from '../agent/agent.recorder.js';
import { ensureBattleReady } from '../battle/battle-loader.js';
import { Random } from '../core/random.js';
import { GENERATOR_VERSION, LAYOUT_VERSION } from './map-generator.js';
import { createMapSnapshot, planMapRestore } from './map-snapshot.js';
import { game, runtime, MAP, cam, curLayer, cellCenter } from './game.session.kernel.js';
import { MODES, modeCfg, applyModeRules } from './game.session.modes.js';
import { assertZones, cardStacks, canAcceptCard, safeCap, safeUsed, refreshCardClones, PEARL_BOX_ID } from './game.session.bag.js';
import { canReceiveCardFromBag } from '../core/card-capacity.js';
import { clampIndex, installDerived, buildNewRunDerived } from './game.session.map.js';
import { markSeen } from './game.session.board.js';
import { createDeathSettlement } from './game.session.death.js';
import { endNodeContent, eventChoiceRewardAt } from './node-reward-state.js';
import { recordMapNodeArrival } from './map-node-arrival.js';

// ---------- 档位与终局代数（会话内可变绑定；跨模块只经访问器读写） ----------
let activeSlot = null;                // 当前游玩的档位（1..5），标题界面为 null
let terminalGeneration = 0;
export const getActiveSlot = () => activeSlot;
export const _set_active_slot = value => { activeSlot = value; };
const getTerminalGeneration = () => terminalGeneration;
const nextTerminalGeneration = () => ++terminalGeneration;
function publishSaveState(state, scope, message = '') {
  document.dispatchEvent(new CustomEvent('sdt-save-state', { detail: { state, scope, message } }));
}
export const saveArchive = createSaveArchive();
export const previewRunBackup = slot => RunStorage.previousCandidate(slot, validateArchivedRun);
export const restoreRunBackup = (slot, candidate) => RunStorage.restorePrevious(slot, candidate, validateArchivedRun);


// Factories only retain readers and define commands; cross-controller calls are
// deferred until an action starts, after menu/death assembly has completed.
const sessionPorts = {
  readState: () => ({ game, runtime, activeSlot }),
  readServices: () => window.SDT,
  readUI: () => window.SDT.UI,
  readStorage: () => globalThis.localStorage,
};
const persistenceController = createSessionPersistence({ ...sessionPorts,
  Random, RunStorage, SLOT_COUNT, TX_KEY, createMapSnapshot, GENERATOR_VERSION, LAYOUT_VERSION,
  snapshotRunBattles, assertZones, publishSaveState, withSlotWriteLock });
const restorationController = createSessionRestoration({ ...sessionPorts, development: import.meta.env.DEV,
  RunStorage, validateRunSave, validatePendingExtraction, planMapRestore, traceRestoreStep,
  Random, installDerived, MODES, MAP, applyModeRules, refreshCardClones, eventChoiceRewardAt, restoreRunBattles,
  setLobby: (...args) => setLobby(...args), enterLayer, saveGame,
  saveBaseForLoad: persistenceController.saveBaseForLoad,
  recordBaseSaveForLoad: persistenceController.recordBaseSaveForLoad,
  trackRestoration: persistenceController.trackRestoration,
});
const departureController = createSessionDeparture({ ...sessionPorts,
  Random, MAP, MODES, modeCfg, buildNewRunDerived, newUid, createRunSavePayload,
  createDeparturePersistence, planBaseDeparture, RunStorage, TX_KEY, resetRunCounters, applyModeRules,
  setLobby: (...args) => setLobby(...args), enterLayer, nextTerminalGeneration, esc });

/** @param {Parameters<typeof persistenceController.createRunSavePayload>} args */
function createRunSavePayload(...args) { return persistenceController.createRunSavePayload(...args); }
/** @param {Parameters<typeof persistenceController.saveGame>} args */
function saveGame(...args) { return persistenceController.saveGame(...args); }
/** @param {Parameters<typeof persistenceController.saveSession>} args */
function saveSession(...args) { return persistenceController.saveSession(...args); }
/** @param {Parameters<typeof persistenceController.syncPlayTime>} args */
function syncPlayTime(...args) { return persistenceController.syncPlayTime(...args); }
function clearSlot(...args) { return persistenceController.clearSlot(...args); }
/** @param {Parameters<typeof persistenceController.clearSave>} args */
function clearSave(...args) { return persistenceController.clearSave(...args); }
/** @param {Parameters<typeof persistenceController.clearAllSlots>} args */
function clearAllSlots(...args) { return persistenceController.clearAllSlots(...args); }
function hasRun(...args) { return persistenceController.hasRun(...args); }
function readSlot(...args) { return persistenceController.readSlot(...args); }
/** @param {Parameters<typeof persistenceController.migrateOldSave>} args */
function migrateOldSave(...args) { return persistenceController.migrateOldSave(...args); }
function setBattleSettlementPending(...args) { return persistenceController.setBattleSettlementPending(...args); }
function clearBattleSettlementPending(...args) { return persistenceController.clearBattleSettlementPending(...args); }
function loadGame(...args) { return restorationController.loadGame(...args); }
function preflightRunMap(...args) { return restorationController.preflightRunMap(...args); }
function newRun(...args) { return departureController.newRun(...args); }

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
  // 提取薄包装，注入 game/共享纯判定/canAcceptCard 验证与预估共用规则。
  function canReceiveCard(card) {
    return canReceiveCardFromBag(card, { ownedCards:game.ownedCards, canAcceptCard });
  }
game.canReceiveCard = canReceiveCard; // 叠放上限感知的收卡判定（#7）

// ---------- 菜单装配 ----------
const menuController = createGameMenuController({
  SDT, UI, game, runtime, SLOT_COUNT, esc, readSlot, loadGame, clearSlot,
  hasRun, RunStorage, ensureBattleReady, recoverSlotIfPending, terminalCommands,
  saveArchive, previewRunBackup, restoreRunBackup,
  saveGame, saveSession, syncPlayTime, clearSave, clearAllSlots,
  getActiveSlot: () => activeSlot, preflightRunMap,
  setActiveSlot: value => { activeSlot = value; },
  openDataPage,
});
const { setLobby, showTitle, startNewGame, exitToTitle, quitGame, openSettings, openLeaveMenu, openTitleGuide, openSuggestionInbox, openDataPageUi } = menuController;

// ---------- 开局流程 ----------
function newUid() { return 'o' + Date.now().toString(36) +
  Math.floor(Random.random('identity') * 46656).toString(36) + Math.floor(Random.random('identity') * 1296).toString(36); }

// ---------- 进层 ----------
function enterLayer(li, atIdx, opts = null) {
  const safeLayer = clampIndex(li, game.layerData?.length || 1, 0);
  const layer = game.layerData?.[safeLayer];
  const safeIdx = layer?.logical?.[atIdx]
    ? atIdx
    : (layer?.entrances?.[0] ?? clampIndex(atIdx, layer?.logical?.length || 1, 0));
  const fromLi = game.layerIdx, fromIdx = game.trackPos;
  const position = cellCenter(safeLayer, safeIdx);
  game.layerIdx = safeLayer;
  game.trackPos = safeIdx;
  game.pos = position;
  if (opts?.endPreviousNode === true && (fromLi !== safeLayer || fromIdx !== safeIdx)) {
    endNodeContent(game, fromLi, fromIdx);
    recordMapNodeArrival(game, safeLayer, safeIdx);
  }
  markSeen(safeLayer, safeIdx);
  game.activeLayerBounds = game.layerBounds?.[safeLayer] || null;
  game.hop = 0;
  if (!opts?.preserveBossPlan) game.bossPlan = null;   // 真正进层重置；读档保留已恢复的首脑预案。
  game.state = 'idle';
  if (opts?.deferPresentation) return;
  // Refresh the destination preview first: its inset update cancels camera glides.
  UI.refresh(game);
  if (cam) {
    // Focus on the currently available choices; unexplored map bounds no longer shrink them.
    // 取景默认同步落定（开局/读档/测试都依赖同步终态）；穿门换层经 opts.glideCam 走镜头补间
    // （2026-09-27 二轮动效：换层不再硬切；glideTo 内部自处理减动效/无 rAF 退化）
    const fitted = cam.frameExploration?.(game, false, opts?.glideCam ? { glide: true } : null);
    if (!fitted) { cam.cx = game.pos.x; cam.cy = game.pos.y; cam.clamp(); }
  }
  const f = curLayer();
  const eIdx = f.entrances.indexOf(atIdx);
  const eName = eIdx >= 0 ? f.entranceNames[eIdx] : `#${atIdx} 格`;
  UI.log(`—— 置身 <b>${f.name}</b>（${eName}）——`, 'sys');
  if (!opts?.deferSave) saveGame();
}

// ---------- 兼容导出面（与拆分前逐一对应，调用方零改动） ----------
export { SLOT_COUNT };
export { MAP, configureGameRuntime, requestClassChoice, game, canvas, ctx, cam, dpr, _set_cam, _set_dpr, curLayer, cellCenter, pick, weighted } from './game.session.kernel.js';
export { MODES, modeCfg, scaledEnemy } from './game.session.modes.js';
export { bagCap, cardStacks, safeCap, safeUsed, usedSlots, gainCoins } from './game.session.bag.js';
export { buildDerived } from './game.session.map.js';
export { markSeen, renderMiniMap } from './game.session.board.js';
export { clearSlot, clearBattleSettlementPending, clearSave, createRunSavePayload, enterLayer, doDeath, exitToTitle, hasRun, loadGame, migrateOldSave, newRun, newUid, openDataPageUi, openLeaveMenu, openSettings, openSuggestionInbox, openTitleGuide, preflightRunMap, quitGame, saveGame, saveSession, setBattleSettlementPending, setLobby, showTitle, startNewGame, syncPlayTime };

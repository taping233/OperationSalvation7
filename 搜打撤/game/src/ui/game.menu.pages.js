import { createMenuFeedbackPages } from './menu-feedback.js';
import { createMenuGuidePages } from './menu-guide.js';
import { createMenuSlotPicker } from './menu-slots.js';
import { createMenuLeaveFlow } from './menu-leave.js';
import { createMenuDataPage } from './menu-data.js';
import { createMenuSettingsPage } from './menu-settings.js';
import '../../css/title-achievements.css';
import '../../css/beginner-guide.css';
import '../../css/archive-back.css';
import '../../css/leave-run.css';
import { battleRestartHTML, bindBattleRestart } from './settings-battle-restart.js';

// Lazy menu assembly only: each flow receives its named session/service ports.
export function createGameMenuPages(deps, shell) {
  const { SDT, UI, game, runtime, SLOT_COUNT, esc, readSlot, loadGame, clearSlot,
    saveSession, clearAllSlots, getActiveSlot, setActiveSlot, preflightRunMap,
    RunStorage, saveArchive, previewRunBackup, restoreRunBackup, ensureBattleReady = async () => SDT.Battle, recoverSlotIfPending, terminalCommands, openDataPage } = deps;
  const { showTitle, hideTitle, pickLatestSlot, fmtPlayTime } = shell;


  const feedback = createMenuFeedbackPages({
    UI,
    game,
    esc,
    getActiveSlot,
    openSettings: (...args) => settings.openSettings(...args),
    document,
    desktop: () => window.sdtDesktop,
    readSound: () => SDT.Sound,
    readIcons: () => SDT.Icons
  });
  const guide = createMenuGuidePages({
    UI,
    game,
    pickLatestSlot,
    document,
    readMeta: () => SDT.Meta,
    readCards: () => SDT.Cards,
    readBattle: () => SDT.Battle
  });
  const slots = createMenuSlotPicker({
    UI,
    game,
    runtime,
    SLOT_COUNT,
    prepareBaseHub: runtime?.preloadBaseHub,
    esc,
    readSlot,
    loadGame,
    clearSlot,
    getActiveSlot,
    setActiveSlot,
    preflightRunMap,
    RunStorage,
    saveArchive,
    previewRunBackup,
    restoreRunBackup,
    ensureBattleReady,
    recoverSlotIfPending,
    showTitle,
    hideTitle,
    document,
    readBase: () => SDT.Base,
    readRenderer: () => SDT.Renderer,
    readMeta: () => SDT.Meta,
    fmtPlayTime
  });
  const leave = createMenuLeaveFlow({
    UI,
    game,
    runtime,
    esc,
    saveSession,
    getActiveSlot,
    terminalCommands,
    showTitle,
    openSettings: (...args) => settings.openSettings(...args),
    document,
    readCards: () => SDT.Cards,
    readSound: () => SDT.Sound,
    readBattle: () => SDT.Battle,
    readAgent: () => SDT.Agent
  });
  const dataPage = createMenuDataPage({
    UI,
    openDataPage,
    openSettings: (...args) => settings.openSettings(...args),
    document,
    readIcons: () => SDT.Icons
  });
  const settings = createMenuSettingsPage({
    UI,
    game,
    runtime,
    clearAllSlots,
    getActiveSlot,
    openSuggestionInbox: (...args) => feedback.openSuggestionInbox(...args),
    openDataPageUi: (...args) => dataPage.openDataPageUi(...args),
    document,
    battleRestartHTML: () => battleRestartHTML({ SDT, game }),
    bindBattleRestart: options => bindBattleRestart({ SDT, UI, game, ...options }),
    readCards: () => SDT.Cards,
    readSound: () => SDT.Sound,
    readMotion: () => SDT.Motion,
    readNotes: () => SDT.Notes
  });
  return Object.freeze({ ...slots, ...settings, ...leave, ...guide, ...feedback, ...dataPage });
}

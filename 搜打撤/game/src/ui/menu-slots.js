import { bindSlotArchive } from './save-management.js';
import { recordRestoreStage, traceRestoreStep } from '../core/flight-recorder.local.js';
import { cancelPendingPageEntries } from './page-entry-cancellation.js';
import { captureBattleContext, invalidateBattleContext } from '../battle/battle-loader.js';
import { motionTiming } from './motion-presets.js';
import { beginResumePresentation, transitionFrame } from './transition-handoff.js';
import { linkedBackHTML } from './home-linked-interactions.js';
import { createSlotPickerView } from './menu-slot-view.js';

/** Save entry owns preflight, recovery, persistence checks and launch cancellation. */
export function createMenuSlotPicker({
  UI, game, runtime, SLOT_COUNT, esc, readSlot, loadGame, clearSlot, getActiveSlot, setActiveSlot,
  preflightRunMap, RunStorage, saveArchive, previewRunBackup, restoreRunBackup, ensureBattleReady,
  recoverSlotIfPending, showTitle, hideTitle, document, readBase, readRenderer,
  readMeta, fmtPlayTime, prepareBaseHub
}) {
  const { SLOT_ICONS, SLOT_BG_SILHOUETTES, slotInfoHTML } = createSlotPickerView({ readMeta, esc, fmtPlayTime });
  const archiveControls = slot => saveArchive ? `<details class="slot-archive"><summary>备份与恢复</summary><div class="slot-archive-actions">
    <button class="mini-btn" data-act="exportSlotArchive" data-slot="${slot}">导出整档</button>
    <button class="mini-btn" data-act="importSlotArchive" data-slot="${slot}">导入整档</button>
    <button class="mini-btn" data-act="recoverSlotImport" data-slot="${slot}">恢复中断导入</button>
  </div></details>` : '';
  // 选档页：参照明日方舟「选择分队」的横排暗色卡片（居中发光图标 + 档名 + 分隔线 + 描述）。
  // 空档 = 压暗的箱柜图标，点击开新档；有档 = 发亮的存档图标，点击直接进入。
  function openSlotPicker() {
    cancelPendingPageEntries('menu');
    game.state = 'modal';
    const cards = [];
    const slotErrors = [];
    // Read and normalize each save once per visit. Recent-slot selection and
    // card presentation share this snapshot; the next visit reads fresh data.
    const summaries = new Map();
    let latest = null;
    for (let i = 1; i <= SLOT_COUNT; i++) {
      let run = null, baseData = null, error = null;
      try { run = readSlot(i); } catch (e) { error = e; }
      try { baseData = readBase().peek(i); } catch (e) { error ||= e; }
      summaries.set(i, { run, baseData, error });
      if (run || baseData) {
        const ts = +run?.savedAt || 0;
        if (!latest || ts > latest.ts) latest = { slot:i, ts };
      }
    }
    for (let i = 1; i <= SLOT_COUNT; i++) {
      // F1 兜底（2026-09-24）：单档渲染异常只降级该档卡片并给出可见错误，
      // 不再让整个选档页卡死在 game.state='modal'；catch 内不写任何档，原档保留
      try {
        const { run, baseData, error } = summaries.get(i);
        if (error) throw error;
        const issue = readBase().issue(i) || RunStorage.issue(i);
        const exists = !!run || !!baseData || readBase().hasSlot?.(i) || RunStorage.has(i) || !!issue;
        const recent = !!run?.savedAt && latest?.slot === i && latest.ts > 0;
        const state = issue ? 'error' : run ? 'run' : baseData ? 'base' : 'empty';
        const status = issue ? (issue === 'tooNew' ? '版本较新 · 原档已保留' : '档案异常 · 原档已保留') : recent ? '最近游玩 · 对局进行中' : run ? '对局进行中' : baseData ? '基地档案' : '空档位';
        const cta = issue ? '查看恢复选项' : !exists ? '开新档'
          : run ? '继续对局' : '进入存档';
       cards.push(`<article class="slot-card slot-art-${i} slot-state-${state}${exists ? ' filled' : ''}${recent ? ' slot-recent' : ''}">
        <i class="slot-card-bg" aria-hidden="true"></i>
        <i class="slot-card-light" aria-hidden="true"></i>
        <i class="slot-card-flakes" aria-hidden="true">${'<i></i>'.repeat(7)}</i>
        <span class="slot-card-art">${SLOT_ICONS[i - 1]}<i class="slot-card-spark"></i></span>
        <b class="slot-card-name">档位 0${i}</b>

        <span class="slot-card-status">${status}</span>
        <i class="slot-card-rule"></i>
        <span class="slot-card-desc">${issue ? '原始档案已保留。可查看恢复选项。' : slotInfoHTML(baseData, run)}</span>
       <button class="slot-card-cta" data-act="${issue ? 'slotRecovery' : exists ? 'enterSlot' : 'newSlot'}" data-slot="${i}" aria-label="${exists ? '进入档位 0' + i : '在档位 0' + i + ' 开始新游戏'}">${cta}</button>
        ${exists ? `<span class="slot-card-ops">
          <button class="mini-btn" data-act="overwriteSlot" data-slot="${i}">覆盖重开</button>
          <button class="mini-btn danger" data-act="delSlot" data-slot="${i}">删除</button>
        </span>` : ''}
        ${archiveControls(i)}
     </article>`);
      } catch (e) {
        // 异常档渲染为不可进入的降级卡片（不给破坏性入口），页面继续展示其余档位
        console.warn(`[menu] 档位 ${i} 存档渲染异常，原档已保留未写回：`, e);
        slotErrors.push(i);
        cards.push(`<article class="slot-card slot-art-${i} slot-state-empty">
        <i class="slot-card-bg" aria-hidden="true"></i>
        <b class="slot-card-name">档位 0${i}</b>

        <span class="slot-card-status">档案数据异常</span>
        <i class="slot-card-rule"></i>
        <span class="slot-card-desc">读取失败，原档已保留。请重试。</span>
        ${archiveControls(i)}
       </article>`);
      }
    }
    UI.showOverlay('', `
      <div class="pg slot-page">
        <div class="slot-bg" aria-hidden="true">
          <i class="bokeh"></i><i class="bokeh"></i><i class="bokeh"></i><i class="bokeh"></i>
          <i class="bokeh"></i><i class="bokeh"></i><i class="bokeh"></i><i class="bokeh"></i>
          ${SLOT_BG_SILHOUETTES}
        </div>
        <!-- 选档、基地、地图退出键统一沿 archive-back.css。 -->
        ${linkedBackHTML('slotBack', '返回主菜单', '', 'button', { cancel:true })}
        <header class="slot-page-head">
          <i class="slot-page-rule"></i>
        </header>
        <p id="slotRestoreError" class="slot-restore-error" role="alert" aria-live="assertive" hidden></p>
        <div class="slot-deck">${cards.join('')}</div>
      </div>`, 'page');
    let pickerActive = true;
    const pickerCurrent = page => pickerActive && !!page && page.isConnected && /** @type {import("./ui.dom.types.js").UIElement} */ (document.querySelector('.slot-page')) === page
      && !UI.el?.overlay?.hidden && !UI.el?.overlay?.classList.contains('closing');
    // Paint the picker first; preparation shares the facade's retryable import
    // with a real click and never selects a slot or opens the destination.
    if (prepareBaseHub) {
      const picker = document.querySelector('.slot-page');
      const prepare = () => {
        if (!pickerCurrent(picker) || document.hidden) return;
        Promise.resolve().then(prepareBaseHub).catch(() => {});
      };
      const win = document.defaultView;
      if (win?.requestIdleCallback) win.requestIdleCallback(prepare, { timeout: 1200 });
      else win?.setTimeout(prepare, 80);
    }
    // F1 兜底（2026-09-24）：有档位渲染异常时在页面上给出可见提示（不阻塞其余档位）
    if (slotErrors.length) {
      const msg = `档位 ${slotErrors.map(i => '0' + i).join('、')} 存档数据异常，已保留原档未写回`;
      console.warn('[menu] ' + msg);
      const errEl = document.getElementById('slotRestoreError');
      if (errEl) { errEl.hidden = false; errEl.textContent = msg; }
    }
    // 进入档位：加载该档基地并执行后续（续打 / 进基地）
    const launch = async (slot, fn, keepPicker = false) => {
      invalidateBattleContext(game);
      // 基地直接承接选档画面，由视觉层保留退场副本；续局仍沿既有关闭流程。
      if (!keepPicker) UI.hideOverlay();
      hideTitle();
      UI.clearLog();
      setActiveSlot(slot);
      readBase().use(slot);
      const pickerPage = keepPicker ? /** @type {import("./ui.dom.types.js").UIElement} */ (document.querySelector('.slot-page')) : null;
      const current = () => getActiveSlot() === slot && readBase().slot === slot && (!pickerPage || pickerCurrent(pickerPage));
      // 能力卡术语迁移（原「英雄卡」类型，2026-09-08 定版）：仓库/口袋副本同步更名
      // 2026-09-29 收敛：直改 Base.data 后保存的迁移块移入 Base.applyStoredCardRenames
      let migrated, flushed;
      try {
        migrated = await readBase().applyStoredCardRenames();
        if (!current()) return false;
        flushed = await readBase().flushWrites?.();
      } catch { if (current()) return returnToPicker('基地迁移未保存，原档已保留；请重试进入该档位'); return false; }
      if (!current()) return false;
      if (migrated?.persisted === false || flushed?.ok === false) return returnToPicker('基地迁移未保存，原档已保留；请重试进入该档位');
      const bi = readBase().issue(slot);
      if (bi) return returnToPicker('基地档案无法读取，原档已保留，请先导出或恢复有效备档。');
      const result = await fn();
      if (result === false) return false;
      UI.log(`[[icon:archive]] 已进入 <b>档位 ${slot}</b>（基地与进度独立保存到该档位）`, 'sys');
      return result;
    };
    let enteringSlot = false;
    const restoreError = message => {
      UI.log(`[[icon:cross]] ${message}`, 'warn');
      const visible = document.getElementById('slotRestoreError');
      if (visible) { visible.hidden = false; visible.textContent = message; visible.tabIndex = -1; visible.focus(); }
    };
    const returnToPicker = message => {
      showTitle();
      openSlotPicker();
      restoreError(message);
      return false;
    };
    const resetAndLaunch = async (slot, overwrite = false) => {
      if (enteringSlot) return false;
      enteringSlot = true;
      const picker = /** @type {import("./ui.dom.types.js").UIElement} */ (document.querySelector('.slot-page'));
      let currentContext;
      try {
        // 初始化先确认落盘；等待页面期间连点不能再次重置档案。
        readBase().use(slot);
        const initialized = await readBase().reset(slot, {overwrite});
        if (!pickerCurrent(picker) || readBase().slot !== slot) return false;
        if (initialized === false) {
          restoreError('档位初始化未保存，请检查存储空间或档位变化后重试；尚未进入基地');
          return false;
        }
        return await launch(slot, async () => {
          currentContext = captureBattleContext(game, getActiveSlot);
          const opened = await runtime.openBaseHub('deploy');
          if (opened === false && currentContext() && picker?.isConnected) {
            return returnToPicker('基地尚未打开，可重新进入；档案已保留');
          }
          return opened;
        }, true);
      } catch {
        if (currentContext?.() && picker?.isConnected) return returnToPicker('进入基地失败，请重试；档案已保留');
        return false;
      } finally { enteringSlot = false; }
    };
    if (saveArchive) bindSlotArchive({ UI, saveArchive, previewRunBackup, restoreRunBackup, refresh:openSlotPicker, onError:restoreError });
    UI.act('newSlot', (d) => { const slot=+d.slot; if (readBase().hasSlot?.(slot) || RunStorage.has(slot) || readBase().issue(slot) || RunStorage.issue(slot)) return restoreError('该档位已有档案，请重新进入或使用明确的覆盖重开。'); return resetAndLaunch(slot); });
    UI.act('enterSlot', async (d) => {
      if (enteringSlot) return false;
      if (readBase().issue(+d.slot)) return UI._acts.slotRecovery?.(d);
      enteringSlot = true;
      try {
        const slot = +d.slot;
        const pickerPage = /** @type {import("./ui.dom.types.js").UIElement} */ (document.querySelector('.slot-page'));
        const pickerContext = captureBattleContext(game, getActiveSlot);
        if (recoverSlotIfPending) {
          const picker = document.getElementById('slotRestoreError');
          try {
            const recovered = await recoverSlotIfPending(slot);
            if (!pickerContext() || !pickerCurrent(pickerPage)) return false;
            if (!recovered.ok) {
              restoreError(`${recovered.message || '存档恢复尚未完成'}；原档与恢复记录已保留，请重试进入该档位`);
              return false;
            }
          } catch {
            if (pickerContext() && (!picker || picker.isConnected)) restoreError('存档恢复失败；原档与恢复记录已保留，请重试进入该档位');
            return false;
          }
        }
        const hasSavedRun = RunStorage.has(slot);
        let needsBattle = true;
        if (hasSavedRun) {
          const checked = preflightRunMap(slot);
          if (!checked.ok) {
            const message=`${checked.message || '路线存档无法安全恢复'}，原档已保留；请稍后用兼容版本重试，或显式覆盖档位`;
            restoreError(message);
            return false;
          }
          // Unknown/legacy adapters remain conservative. A verified map-only
          // save does not need to parse and initialise the entire battle UI.
          if (checked.value?.run) needsBattle = !!checked.value.run.battle;
        }
        return await launch(slot, async () => {
          // launch 已切到目标档位；之后合法的 modal/idle 切换不更换归属。
          const currentContext = captureBattleContext(game, getActiveSlot);
          // 仅供 Agent 对本次 enterSlot 的合法换局做核验；不代表已持久化。
          const completed = () => ({ ok: true, commandContext: {
            slot: getActiveSlot(), runToken: game.discoveredPairs, nestToken: game.nestRunes,
            runActive: game.runActive, nestActive: game.nestActive,
          } });
          let transition, finishResumePresentation;
          try {
            // 上一局未结束直接回局内；有档但恢复失败则保留原档回标题。
            if (hasSavedRun) {
              finishResumePresentation = beginResumePresentation();
              // 先播转场再读档，避免转场结束改写 Battle.restore 的 modal 状态。
              transition = runtime.showRunTransition({
                tone: 'door', asset: 'scene-door-bg',
                eyebrow: 'EXPEDITION RESUMED', title: '继续对局',
                detail: '欢迎回到战场',
                duration: motionTiming.sceneEnter,
                presentation: 'city-cut',
                scene: 'resume',
                holdVisual: true,
                resumeVisual: true,
              });
              if (import.meta.env.DEV) recordRestoreStage('transition-mounted');
              // 显示过场后立即预热，模块和地图素材加载与演出重叠。
              const resources = Promise.all([
                needsBattle ? (import.meta.env.DEV ? traceRestoreStep('battle-module', () => ensureBattleReady()) : ensureBattleReady()) : true,
                import.meta.env.DEV ? traceRestoreStep('map-warm', () => readRenderer()?.warm?.()) : readRenderer()?.warm?.(),
              ])
                .then(() => ({ ok: true }), error => ({ ok: false, error }));
              if (await transition === false || !transition.isCurrent() || !currentContext()) return false;
              // 存档可能包含战斗快照；必须先加载战斗域，loadGame 才能同步 restore。
              const warmed = await resources;
              if ('error' in warmed) throw warmed.error;
              if (!transition.isCurrent() || !currentContext()) return false;
              // A restored snapshot is the HUD baseline, not a gain/loss event.
              Object.assign(UI, { _lastHpKey:null, _lastCoins:null, _lastAtk:null, _lastValue:null });
              const loaded = loadGame(slot);
              if (loaded.ok === false) {
                RunStorage.issue(slot);
                return returnToPicker(`${loaded.message || '对局存档读取失败'}；原档已保留，请重试进入该档位`);
              }
              const resumedContext = captureBattleContext(game, getActiveSlot);
              const persisted = await loaded.pendingPersistence;
              if (!resumedContext()) return false;
              if (persisted?.ok === false) return returnToPicker(`${persisted.message || '基地迁移未保存'}；原档已保留，请重试进入该档位`);
              if (loaded.classChoiceEntry) {
                const sourceBody = document.getElementById('ovBody');
                const sourceRoot = sourceBody?.firstElementChild;
                const sourceHidden = UI.el.overlay.hidden;
                if (await loaded.classChoiceEntry === false) {
                  if (resumedContext() && document.getElementById('ovBody') === sourceBody &&
                    sourceBody?.firstElementChild === sourceRoot && UI.el.overlay.hidden === sourceHidden) return returnToPicker('人物选择尚未打开，可重试进入；对局进度已保留');
                  return false;
                }
                if (!resumedContext()) return false;
              }
              if (game.state === 'idle' && game.runActive && !game.nestActive && !game.battleActive) {
                // 等对局布局落定，遮层下面画好目标尺寸/镜头的首帧，再揭幕。
                await transitionFrame();
                await transitionFrame();
                if (!resumedContext()) return false;
                runtime.resize();
                await readRenderer()?.prepare?.(game, resumedContext);
                if (!resumedContext()) return false;
              }
              await transition.release?.();
              return completed();
            }
            if (await runtime.openBaseHub('deploy') === false) {
              if (currentContext() && pickerPage?.isConnected) return returnToPicker('基地尚未打开，可重新进入；档案已保留');
              return false;
            }
            return completed();
          } catch {
            if (!currentContext() || (transition && !transition.isCurrent()) || (!hasSavedRun && !pickerPage?.isConnected)) return false;
            return returnToPicker('进入档位失败，请刷新页面后重试；原档已保留');
          } finally {
            // 异常或取消时也释放自有遮层；不会收掉恢复流程打开的新页面。
            await transition?.release?.({ immediate: true });
            if (finishResumePresentation?.()) UI.refresh(game);
          }
        }, true);
      } finally { enteringSlot = false; }
    });
    UI.act('overwriteSlot', async (d) => {
      if (enteringSlot) return;
      const pickerPage = /** @type {import("./ui.dom.types.js").UIElement} */ (document.querySelector('.slot-page'));
      if (!await UI.confirmAction({ title:`覆盖重开档位 ${d.slot}？`, message:'当前对局与基地将重新开始。异常原始档案会先保全。', confirmLabel:'覆盖并开始新档' })) return;
      if (enteringSlot || !pickerCurrent(pickerPage)) return false;
      enteringSlot = true;
      let cleared;
      try { cleared = await clearSlot(+d.slot, {preserveAbnormal:true}); }
      catch { cleared = { ok:false, message:'删除未保存，请重试' }; }
      finally { enteringSlot = false; }
      if (!pickerCurrent(pickerPage)) return false;
      if (cleared === false || cleared?.ok === false) {
        restoreError(`档位 ${d.slot} ${cleared?.message || '删除未完成，请重试'}；尚未重开`);
        return false;
      }
      return resetAndLaunch(+d.slot, true);
    });
    UI.act('delSlot', async (d) => {
      if (enteringSlot) return;
      const pickerPage = /** @type {import("./ui.dom.types.js").UIElement} */ (document.querySelector('.slot-page'));
      if (!await UI.confirmAction({ title:`删除档位 ${d.slot}？`, message:'此档位的基地与对局将被删除，删除后无法恢复。', confirmLabel:'删除此档位' })) return;
      if (enteringSlot || !pickerCurrent(pickerPage)) return false;
      enteringSlot = true;
      let cleared;
      try { cleared = await clearSlot(+d.slot); }
      catch { cleared = { ok:false, message:'删除未保存，请重试' }; }
      finally { enteringSlot = false; }
      if (!pickerCurrent(pickerPage)) return false;
      if (cleared === false || cleared?.ok === false) {
        restoreError(`档位 ${d.slot} ${cleared?.message || '删除未完成，请重试'}`);
        return false;
      }
      UI.log(`[[icon:trash]] 已删除【档位 ${d.slot}】的存档（含基地数据）`, 'warn');
      openSlotPicker();   // 重绘档位列表
    });
    UI.act('slotBack', () => { pickerActive = false; UI.hideOverlay(); showTitle(); });
  }

  function startNewGame() { openSlotPicker(); }

  return { startNewGame };
}

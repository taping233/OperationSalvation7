import { inputSettingsHTML, bindInputSettings } from './settings-input.js';
import { beginRuntimeStage } from '../core/runtime-trace-stages.local.js';
import { performanceSettingsHTML, bindPerformanceSettings } from './performance-settings.js';
import { cancelPendingPageEntries } from './page-entry-cancellation.js';
import { captureBattleContext } from '../battle/battle-loader.js';
import { storeGet, storeSet } from '../core/storage.js';
import { bindSettingsAudio } from './settings-audio.js';
import { captureSettingsNavigation, initSettingsNavigation, settingsLayoutHTML } from './settings-navigation.js';
import { captureOverlayReturnState, restoreOverlayReturnState } from './overlay-return-state.js';
import { linkedBackHTML } from './home-linked-interactions.js';

function settingsToggleHTML(label, id, checked) {
  return `<label class="chk"><span class="settings-row-copy">${label}</span><input type="checkbox" role="switch" id="${id}" ${checked ? 'checked' : ''}></label>`;
}
function settingsVolumeHTML(label, id, readVolume) {
  return `<label class="chk vol"><span>${label}</span><input type="range" id="${id}" min="0" max="100" value="${Math.round(readVolume() * 100)}"><b id="${id}Val">${Math.round(readVolume() * 100)}%</b></label>`;
}

/** Settings bind immediate preferences and delegate destructive actions to confirmation. */
export function createMenuSettingsPage({
  UI, game, runtime, clearAllSlots, getActiveSlot, openSuggestionInbox, openDataPageUi, document,
  battleRestartHTML, bindBattleRestart, readCards, readSound, readMotion, readNotes
}) {
  // ---------- 设置（标题界面调用） ----------
  function openSettings(options = {}, returnState = null, sourceState = game.state) {
    cancelPendingPageEntries('menu');
    const prev = sourceState;
    game.state = 'modal';
    const groups = {
      input: inputSettingsHTML(),
      general: `<section class="settings-group settings-general">
        <h3 class="set-h">[[icon:gear]] 通用</h3>
        ${settingsToggleHTML(' 结点编号', 'setIndex', game.toggles.index)}
        ${settingsToggleHTML(' 底部操作提示条', 'setHint', storeGet('sdt-hintbar') !== '0')}
        ${settingsToggleHTML(' 环层横幅', 'setBanner', storeGet('sdt-banner') !== '0')}
        ${settingsToggleHTML(' 开发者模式（测试工具）', 'setDev', game.devMode)}
        ${battleRestartHTML()}
        ${settingsToggleHTML('大字阅读（卡牌说明与词条）', 'setReadingLarge', storeGet('sdt-reading-large') === '1')}
        ${settingsToggleHTML('结束回合长按确认', 'setEndTurnHold', storeGet('sdt-end-turn-hold') === '1')}
        </section>`,
      display: `<section class="settings-group settings-display">
        <h3 class="set-h">[[icon:gear]] 画面与反馈</h3>
        ${performanceSettingsHTML()}
        ${settingsToggleHTML(' 屏幕震动反馈', 'setShake', !(storeGet('sdt-reduce-shake') === '1'))}
        ${settingsToggleHTML(' 减少动态效果', 'setReduceMotion', storeGet('sdt-reduce-motion') === '1')}
        </section>`,
      audio: `<section class="settings-group settings-audio">
        <h3 class="set-h">[[icon:gear]] 音频</h3>
        ${settingsToggleHTML(' 背景音乐', 'setMusic', !(readSound().musicMuted))}
        ${settingsVolumeHTML('音乐音量', 'setMusicVol', () => readSound().musicVolume)}
        <div class="settings-music-recovery">
          <p class="hint" id="setMusicStatus" role="status" aria-live="polite"></p>
          <button class="mini-btn" type="button" id="setMusicRetry" hidden>重试加载音乐</button>
        </div>
        ${settingsToggleHTML(' 音效', 'setSfx', !(readSound().sfxMuted))}
        ${settingsVolumeHTML('音效音量', 'setSfxVol', () => readSound().sfxVolume)}
        <div class="settings-sfx-recovery"><p class="hint" id="setSfxStatus" role="status" aria-live="polite"></p><button class="mini-btn" type="button" id="setSfxRetry" hidden>重试加载音效</button></div>
        <p class="hint">自动保存 · 侧栏可静音</p>
        </section>`,
      credits: `<section class="settings-group settings-credits">
        <h3 class="set-h">[[icon:trophy]] 致谢</h3>
        <p class="hint"><strong>图标</strong><span>game-icons.net · Lorc、Delapouite、Carl Olsen、Caro Asercion<br><span class="license">CC-BY 3.0</span></span></p>
        <p class="hint"><strong>战斗音效</strong><span>rubberduck、Tinysized、Kenney 等创作者<br><span class="license">CC0</span></span></p>
        <p><a class="ov-btn" href="./assets/sfx/battle/SOURCES.md" target="_blank" rel="noopener">查看音效来源 <span class="settings-external" aria-hidden="true">↗</span></a></p>
        </section>`,
      records: `<section class="settings-group settings-records">
        <h3 class="set-h">[[icon:book]] 留言信箱</h3>
        <div class="btn-row"><button class="mini-btn" data-act="openInbox">查看历史留言</button></div>
        <h3 class="set-h">[[icon:chart]] 跑局数据</h3>
        <!-- W1-01：数据页原唯一入口=Alt+9 不可发现，设置页加可见入口 -->
        <div class="btn-row"><button class="mini-btn" data-act="openDataPageUi">查看跑局数据</button></div>
        </section>`,
      danger: `<section class="settings-group settings-danger">
        <h3 class="set-h">危险区</h3>
        <!-- W1-08：三枚不可逆钮原同排等权——按危险度分级：低危两枚一排，清档独占一排加重 -->
        <div class="btn-row">
          <button class="mini-btn danger" data-act="wipeNotes">清空格子备注</button>
          <button class="mini-btn danger" data-act="wipeCards">清空卡牌库</button>
        </div>
        <div class="btn-row danger-row">
          <button class="mini-btn danger danger-max" data-act="wipeSave">清空全部存档</button>
        </div>
        <p class="hint">清空后无法恢复。<br>「清空全部存档」会删除五个档位的全部档案。</p>
        </section>`,
    };
    const settingsHTML = `
      <div class="pg settings-page settings-tabbed ui-scale-system" data-settings-category="general">
        <!-- 2026-09-07 留言：右上叉号去掉。2026-09-25 老板：返回键统一 = 主页左上退出键
             （ak-sq ak-exit）同款同位，底部大返回钮取消，Esc 仍可关 -->
        ${linkedBackHTML('closeSettings', '返回', 'ak-back-tl')}
        <header class="pg-head"><h2>设置</h2><span class="pg-spacer"></span></header>
        ${settingsLayoutHTML(groups)}
      </div><!-- /.pg -->`;
    const finishOverlay = beginRuntimeStage('settings-overlay-sync');
    try { UI.showOverlay('', settingsHTML, 'page'); } finally { finishOverlay(); }
    const finishNavigation = beginRuntimeStage('settings-navigation-sync');
    const settingsRoot = /** @type {import("./ui.dom.types.js").UIElement} */ (UI.el.ovBody.querySelector('.settings-page'));
    try { initSettingsNavigation(settingsRoot, returnState?.context); } finally { finishNavigation(); }
    if (returnState) restoreOverlayReturnState(settingsRoot, returnState);
    bindPerformanceSettings(UI.el.ovBody);
    bindBattleRestart({ isCurrentContext: captureBattleContext(game, getActiveSlot),
      page: /** @type {import("./ui.dom.types.js").UIElement} */ (UI.el.ovBody.querySelector('.settings-page')) });
    const sync = () => {
      if (UI.el.tglIndex) UI.el.tglIndex.checked = game.toggles.index;
      runtime.syncDevVisibility();
    };
    UI.act('wipeNotes', () => UI.confirmAction({ title:'清空全部格子备注？', message:'将删除所有格子备注，清空后无法恢复。', confirmLabel:'清空格子备注', onConfirm:() => {
      if (readNotes().clearAll() === false) { UI.log('备注清空失败，原内容已保留', 'warn'); return false; }
      runtime.rebuildNotes(); UI.log('已清空全部格子备注', 'warn'); return true;
    } }));
    UI.act('wipeCards', () => UI.confirmAction({ title:'清空卡牌库？', message:'将清空自定义卡牌库，清空后无法恢复。', confirmLabel:'清空卡牌库', onConfirm:() => {
      const result = readCards().clearAll(); if (result === false) return false;
      UI.log('已清空卡牌库', 'warn'); return true;
    } }));
    UI.act('wipeSave', () => UI.confirmAction({ title:'删除五个档位的全部档案？', message:'五个档位的基地与对局存档将被删除。建议先导出整档备份，删除后无法恢复。', confirmLabel:'删除五个档位的全部档案', onConfirm:async () => {
      const cleared = await clearAllSlots();
      if (cleared === false || cleared?.ok === false) {
        const message = (cleared?.results || []).filter(result => !result.ok).map(result => `档位 ${result.slot} ${result.message}`).join('；');
        UI.log(`${message || '部分档位删除未完成'}，尚未清空全部存档`, 'warn'); return false;
      }
      UI.log('已清空全部五个档位的存档', 'warn'); return true;
    } }));
    // 设置页入口固定为「返回设置」语义：UI 点击委托会把按钮 dataset 对象当作首参传入，
    // 直接挂函数引用时 fromTitle=!!dataset 恒为真，返回键误回标题页（09-30 深审 WORLD-004）
    const childSettingsOptions = { ...options };
    const openChild = (open, isRefreshedChild = () => false) => {
      if (!settingsRoot.isConnected || settingsRoot !== UI.el.ovBody.querySelector('.settings-page')) return;
      const contextCurrent = captureBattleContext(game, getActiveSlot);
      const snapshot = captureOverlayReturnState(settingsRoot, document.activeElement, {
        readContext:() => captureSettingsNavigation(settingsRoot),
      });
      let returned = false, childRevision;
      open(() => {
        if (returned || !contextCurrent() || UI._overlayRevision !== childRevision && !isRefreshedChild() || UI.el.overlay.hidden
          || UI.el.overlay.classList.contains('closing')) return;
        returned = true;
        openSettings(childSettingsOptions, snapshot, prev);
      });
      childRevision = UI._overlayRevision;
    };
    UI.act('openInbox', () => openChild(back => openSuggestionInbox(false, back)));
    UI.act('openDataPageUi', () => openChild(back => openDataPageUi(true, back),
      () => !!UI.el.ovBody.querySelector('.data-tuned .doom-stats')));
    UI.act('closeSettings', () => { if (typeof options.returnTo === 'function') { options.returnTo(); return; } UI.hideOverlay(); game.state = prev === 'modal' ? 'idle' : prev; });
    bindInputSettings(UI.el.ovBody.querySelector('.settings-page'), UI.confirmAction);
    const onInput = (id, eventName, apply) => {
      const input = document.getElementById(id);
      input.addEventListener(eventName, event => {
        if (event.target instanceof HTMLInputElement) apply(event.target);
      });
      return input;
    };
    onInput('setReadingLarge', 'change', input => { storeSet('sdt-reading-large', input.checked ? '1' : '0'); document.body.classList.toggle('reading-large', input.checked); });
    onInput('setEndTurnHold', 'change', input => storeSet('sdt-end-turn-hold', input.checked ? '1' : '0'));
    // 勾选即时生效并同步侧边栏
    onInput('setIndex', 'change', input => { game.toggles.index = input.checked; sync(); });
    // 提示条 / 环层横幅开关（随 localStorage 持久化；写入走安全封装，配额满不抛异常）
    onInput('setHint', 'change', input => { storeSet('sdt-hintbar', input.checked ? '1' : '0');
      document.body.classList.toggle('no-hintbar', !input.checked);
    });
    onInput('setBanner', 'change', input => { storeSet('sdt-banner', input.checked ? '1' : '0');
      document.body.classList.toggle('no-banner', !input.checked);
    });
    onInput('setDev', 'change', input => { game.devMode = input.checked;
      storeSet('sdt-dev', input.checked ? '1' : '0');
      runtime.syncDevVisibility();
    });
    // 屏幕震动开关（无障碍；顿帧/音效/飘字不受影响，FX.shake 读取该键）
    onInput('setShake', 'change', input => { storeSet('sdt-reduce-shake', input.checked ? '0' : '1');
    });
    onInput('setReduceMotion', 'change', input => { storeSet('sdt-reduce-motion', input.checked ? '1' : '0');
      document.body.classList.toggle('reduce-motion', input.checked);
      if (readMotion()?.refreshReduceMotion) readMotion().refreshReduceMotion();   // 失效缓存（09-20 D-P3），下一次动画立即生效
    });
    bindSettingsAudio(/** @type {import("./ui.dom.types.js").UIElement} */ (UI.el.ovBody.querySelector('.settings-page')), UI.el.overlay, readSound());
    // 音乐 / 音效独立开关（即时生效，随 localStorage 持久化）
    onInput('setMusic', 'change', input => {
      readSound().setMusicMuted(!input.checked);
      if (!input.checked) readSound().sfx('ding');
    });
    onInput('setSfx', 'change', input => {
      readSound().setSfxMuted(!input.checked);
      readSound().sfx('ding');
    });
    // Dragging updates volume immediately; release previews the sound effect.
    const bindVolume = (id, method) => onInput(id, 'input', input => {
      readSound()[method](+input.value / 100);
      document.getElementById(id + 'Val').textContent = input.value + '%';
    });
    bindVolume('setMusicVol', 'setMusicVolume');
    const sfxVolEl = bindVolume('setSfxVol', 'setSfxVolume');
    sfxVolEl.addEventListener('change', () => readSound().sfx('ding'));
  }
  return { openSettings };
}

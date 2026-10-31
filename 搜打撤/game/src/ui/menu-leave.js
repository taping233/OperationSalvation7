import { captureBattleContext } from '../battle/battle-loader.js';
import { collectRescueCards } from '../hub/run-rescue-cards.js';
import { runTerminalSettlement } from './terminal-settlement.js';
import { bindSettlementActions } from './settlement-report.js';
import { claimBagReturnHook, returnToBagSource } from '../hub/bag-return-hook.js';
import { captureOverlayReturnState, restoreOverlayReturnState } from './overlay-return-state.js';

/** Leaving a run owns save retry and terminal settlement, with source-view guards. */
export function createMenuLeaveFlow({ UI, game, runtime, esc, saveSession, getActiveSlot, terminalCommands, showTitle, openSettings, openGuide, document, readCards, readSound, readAgent, readBattle = () => null, readChests = () => null }) {
  // ---------- 离开对局 / 放弃对局（v0.21 设计者规则） ----------
  // 放弃对局：带入本局的卡牌【全部】丢失；对局中获得的卡牌只有安全格里的
  // 会被宠物运回基地；物资/金币/消耗区全部散失。
  let leaveView = null;
  let activeSource = null;
  function leavePanel(title, step, content, initialFocus) {
    const view = { step, busy:false, panel:null, current:captureBattleContext(game, getActiveSlot) };
    leaveView = view;
    UI.showOverlay(title, `<section class="leave-run-panel glass-panel" data-leave-step="${step}">${content}</section>`, 'glass', { initialFocus, motionKey: `leave/${step}` });
    view.panel = document.querySelector(`[data-leave-step="${step}"]`);
    return view;
  }
  function leaveViewMounted(view) {
    const overlay = view.panel?.closest('#overlay');
    return leaveView === view && view.current() && view.panel?.isConnected && overlay && !overlay.hidden && !overlay.classList.contains('closing');
  }
  function leaveViewCurrent(view) {
    return leaveViewMounted(view) && !view.busy;
  }
  function setLeaveBusy(view, busy) {
    view.busy = busy;
    const panel = view.panel;
    panel?.setAttribute('aria-busy', String(busy));
    /** @type {NodeListOf<HTMLButtonElement>} */ (panel?.querySelectorAll('button') || []).forEach(button => { button.disabled = busy; });
  }
  function openLeaveMenu() {
    if (game.terminalPending) return false;
    const visible = UI.el?.overlay && !UI.el.overlay.hidden && !UI.el.overlay.classList.contains('closing');
    if (visible && (UI.el.ovBody?.querySelector('[aria-busy="true"]') ||
        typeof UI._overlayInteractionRoot === 'function' && UI._overlayInteractionRoot() !== UI.el.ovBody)) return false;
    if (activeSource?.current() && activeSource.pageCurrent()) return renderLeaveMenu(activeSource);
    const source = { current:captureBattleContext(game, getActiveSlot), owner:null, pageCurrent:() => false };
    if (visible && !game.battleActive) {
      source.owner = claimBagReturnHook();
      const chests = readChests();
      if (!source.owner && UI.el.ovBody?.querySelector('.cqo-overview, .reward-v14') && chests?.isOpen?.()) {
        source.owner = claimBagReturnHook(() => chests.resume());
        if (source.owner) chests.suspend();
      }
    }
    return renderLeaveMenu(source);
  }
  function renderLeaveMenu(source) {
    if (!source.current()) return false;
    game.state = 'modal';
    const slot = getActiveSlot();
    const place = game.nestActive ? '经典生命研究所' : game.layerData?.[game.layerIdx]?.name || '本次远征';
    const view = leavePanel('系统菜单', 'choice', `
      <div class="leave-run-context"><span>${slot ? `档位 ${String(slot).padStart(2, '0')}` : '临时对局'}</span><span>${esc(place)}</span></div>
      ${slot ? '' : '<p class="leave-run-description">未选择档位，无法保存。</p>'}
      <p class="leave-run-status" role="status" aria-live="polite" hidden></p>
      <div class="leave-run-actions">
        <button type="button" class="leave-run-continue" data-act="leaveCancel" aria-label="返回对局，继续游玩">继续游玩</button>
        <button type="button" data-act="leaveSettings">设置</button>
        <button type="button" data-act="leaveGuide">生存指南</button>
        <button type="button" class="leave-run-save" data-act="leaveSave"${slot ? '' : ' disabled'}>[[icon:save]] 保存并退出</button>
      </div>
      ${game.nestActive ? '' : '<div class="leave-run-secondary"><button type="button" data-act="leaveAbandon">放弃本次对局 <span aria-hidden="true">→</span></button></div>'}`, '[data-act="leaveCancel"]');
    activeSource = source;
    source.pageCurrent = () => leaveViewMounted(view);
    const openChild = open => {
      if (!leaveViewCurrent(view) || typeof open !== 'function') return false;
      const presentation = captureOverlayReturnState(UI.el.overlay);
      return open({ isCurrent:source.current, returnTo:commit => commit(() => renderLeaveMenu(source)),
        onPage:isCurrent => { if (activeSource === source) source.pageCurrent = isCurrent; },
        restoreReturn:isCurrent => restoreOverlayReturnState(UI.el.overlay, presentation, { isCurrent }) });
    };
    UI.act('leaveSettings', () => openChild(openSettings));
    UI.act('leaveGuide', () => openChild(openGuide));
    UI.act('leaveSave', async () => {
      if (!leaveViewCurrent(view) || !getActiveSlot()) return false;
      setLeaveBusy(view, true);
      const button = /** @type {import("./ui.dom.types.js").UIElement} */ (document.querySelector('[data-act="leaveSave"]'));
      if (button) button.textContent = '正在保存…';
      game.state = 'idle';
      let saved;
      try { saved = await saveSession(); }
      catch (error) { console.error('[leave-run] 保存退出失败', error); }
      // Saving may finish after another overlay replaces or closes this panel.
      if (!leaveViewMounted(view)) return false;
      if (!saved?.ok) {
        game.state = 'modal';
        setLeaveBusy(view, false);
        if (button) button.textContent = '重试保存并退出';
        const status = /** @type {import("./ui.dom.types.js").UIElement} */ (document.querySelector('.leave-run-status'));
        if (status) { status.hidden = false; status.textContent = '本次进度未能保存。当前对局仍在，可重试或继续游玩。'; }
        return false;
      }
      leaveView = null;
      activeSource = null;
      UI.hideOverlay();
      showTitle();
      return true;
    });
    UI.act('leaveCancel', () => {
      if (!leaveViewCurrent(view)) return;
      if (source.owner) {
        const body = UI.el.ovBody, root = body.firstElementChild, revision = UI._overlayRevision;
        setLeaveBusy(view, true);
        return returnToBagSource(source.owner, { isCurrent:() => leaveViewMounted(view),
          didReturn:() => source.current() && UI.el.ovBody === body && body.firstElementChild !== root
            && UI._overlayRevision === revision + 1 && !UI.el.overlay.hidden
            && !UI.el.overlay.classList.contains('closing') }).then(returned => {
          if (returned) {
            if (leaveView === view) leaveView = null;
            if (activeSource === source) activeSource = null;
            return true;
          }
          if (leaveViewMounted(view)) {
            setLeaveBusy(view, false);
            const status = view.panel.querySelector('.leave-run-status');
            if (status) { status.hidden = false; status.textContent = '原页面暂未恢复，请再次点击继续游玩。'; }
          }
          return false;
        });
      }
      if (game.battleActive) {
        const battle = readBattle();
        if (typeof battle?.commands?.refreshView !== 'function') { UI.log('战斗界面暂不可恢复，请重试；当前战斗已保留。', 'warn'); return false; }
        leaveView = null; activeSource = null; game.state = 'modal';
        battle.commands.refreshView();
        return true;
      }
      leaveView = null; activeSource = null; UI.hideOverlay(); game.state = 'idle'; UI.refresh(game);
      return true;
    });
    UI.act('leaveAbandon', () => {
      if (!game.nestActive && leaveViewCurrent(view)) return openAbandonConfirmation(source);
    });
    return true;
  }

  function readAbandonCards() {
    if (!game.battleActive) return game.ownedCards;
    try {
      const snapshot = readBattle()?.getSnapshot?.();
      if (!snapshot || !['played', 'consumed', 'discard'].every(key => Array.isArray(snapshot[key]))) return null;
      const spent = new Set([...snapshot.played, ...snapshot.consumed, ...snapshot.discard]);
      return game.ownedCards.filter(owned => !spent.has(owned.uid));
    } catch { return null; }
  }

  function openAbandonConfirmation(source) {
    const remaining = readAbandonCards();
    const safeCount = remaining ? collectRescueCards(remaining, { includeBrought:false }).length : undefined;
    const view = leavePanel('确认放弃本次对局？', 'abandon', `
      <p class="leave-run-warning">放弃后，本次远征将结束。</p>
      <dl class="leave-run-consequences">
        <div><dt>将失去</dt><dd>带入的全部卡牌、未受安全格保护的本局所得，以及金币、物资和消耗区。</dd></div>
        <div><dt>可带回</dt><dd>本局获得并受安全格保护的卡牌，含安全格珍珠盒内的资源${safeCount === undefined ? '（战斗清单暂未读取成功，确认时会重试）' : safeCount ? `（${safeCount} 张）` : '（当前没有）'}。</dd></div>
      </dl>
      <p class="leave-run-status" role="status" aria-live="polite" hidden></p>
      <div class="leave-run-actions">
        <button type="button" class="leave-run-continue" data-act="leaveReviewBack">返回</button>
        <button type="button" class="leave-run-danger" data-act="leaveAbandonConfirm">确认放弃</button>
      </div>`, '[data-act="leaveReviewBack"]');
    source.pageCurrent = () => leaveViewMounted(view);
    UI.act('leaveReviewBack', () => { if (leaveViewCurrent(view)) return renderLeaveMenu(source); });
    UI.act('leaveAbandonConfirm', () => {
      if (!leaveViewCurrent(view) || !game.runActive || game.terminalPending) return false;
      setLeaveBusy(view, true);
      const button = /** @type {import("./ui.dom.types.js").UIElement} */ (document.querySelector('[data-act="leaveAbandonConfirm"]'));
      if (button) button.textContent = '正在结算…';
      const result = abandonRun();
      if (result === false && leaveViewMounted(view)) {
        setLeaveBusy(view, false);
        if (button) button.textContent = '重试确认放弃';
        const status = view.panel.querySelector('.leave-run-status');
        if (status) { status.hidden = false; status.textContent = '战斗卡牌清单暂不可用，本次尚未结算，请重试确认放弃。'; }
      }
      return result;
    });
  }

  function abandonRun() {
    if (!game.runActive || game.terminalPending) return false;
    const slotId = getActiveSlot();
    const remaining = readAbandonCards();
    if (!remaining) return false;
    const token = {
      kind: 'abandon', slotId, cards: collectRescueCards(remaining, { includeBrought:false }),
      broughtN: remaining.filter(o => o.brought).length, attempt: null, busy: false, promise: null, ephemeral: !slotId,
    };
    leaveView = null;
    activeSource = null;
    game.terminalPending = token;
    game.state = 'terminalPending';
    const current = () => game.terminalPending === token && getActiveSlot() === token.slotId;
    let finalized = false, completedContext = null;
    const finishCurrent = () => finalized && !game.terminalPending && completedContext?.();
    const finish = () => {
      if (!current() && !finishCurrent()) return false;
      if (!finalized) {
        if (game.battleActive && readBattle()?.commands?.endRun?.(game) !== true) return false;
        finalized = true;
        game.terminalPending = null;
        game.state = 'done';
        game.runActive = false;
        completedContext = captureBattleContext(game, getActiveSlot);
        readAgent()?.recorder?.recordRun('abandon', { savedCards: token.cards });   // 跑局统计（数据分析系统）
        readSound().sfx('defeat');
        readSound().music('title');
        if (token.ephemeral) UI.log('[[icon:info]] 测试结算仅更新内存，没有写入基地存档', 'sys');
        UI.log('<b>[[icon:flag]] 已放弃对局</b>：带入的卡牌全部遗失，物资与金币散失', 'warn');
      }
      const kept = token.cards;
      const keptMap = new Map();
      kept.forEach(o => {
        const k = o.card.name;
        if (!keptMap.has(k)) keptMap.set(k, { card: o.card, count: 0 });
        keptMap.get(k).count++;
      });
      const keptList = [...keptMap.values()];
      // 抢运回的卡用卡面网格（A5-ABANDON-01，与死亡页 doom-loot 同构；样式复用 overlays.css 无作用域
      // 的 .doom-loot/.doom-cards 家族；禁止套死亡页的外层 doom 玻璃容器——会改变放弃页标准弹层外观）；
      // 散失损失仍走 ov-stats/ov-note 文本行（散失=文本是既定口径）
      const keptHTML = keptList.length
        ? `<div class="doom-loot"><p class="doom-loot-h">[[icon:lock]] 宠物从安全格抢运回 <b>${kept.length}</b> 张对局中获得的卡牌</p><div class="doom-cards">${keptList.slice(0, 6).map((s, i) =>
            `<span class="doom-card" style="--i:${i}">${readCards().cardHTML(s.card, 'sm')}<b>×${s.count}</b></span>`).join('')}${keptList.length > 6 ? `<span class="doom-more">还有 ${keptList.slice(6).reduce((n, s) => n + s.count, 0)} 张</span>` : ''}</div></div>`
        : '<p class="ov-note">安全格里没有对局中获得的卡牌——本次放弃没有带回任何卡牌。</p>';
      UI.showOverlay('已放弃对局', `<section class="leave-run-panel glass-panel" data-leave-step="complete">
        <p class="ov-stats">当前仍随身的带入卡 <b>${token.broughtN}</b> 张全部丢失；对局中获得的卡牌除安全格保护的外也全部失去；
          消耗区卡牌、物资与 <b class="gold">${game.coins} 币</b>一并散失。</p>
        ${token.ephemeral ? '<p class="ov-note">开发测试档未选择存档槽；基地奖励仅暂存于内存。</p>' : ''}
        ${keptHTML}
        <div class="leave-run-actions">
          <button type="button" class="leave-run-continue" data-act="goBase">回基地</button>
          <button type="button" class="leave-run-save" data-act="toTitle">回主菜单</button>
        </div></section>`, 'glass', { initialFocus:'[data-act="goBase"]' });
      bindSettlementActions({ UI, isCurrent:finishCurrent, actions:{
        goBase: () => runtime.openBaseHub('deploy'),
        toTitle: async () => {
          const result = await showTitle();
          if (result !== false) UI.hideOverlay();
          return result;
        },
      } });
      UI.refresh(game);
      return true;
    };
    return runTerminalSettlement({
      token, current, finishCurrent, game, UI, finish: () => finish(),
      command: 'run.abandon', retryAct: 'retryAbandon',
      slotId, terminalCommands,
    });
  }

  return { openLeaveMenu };
}

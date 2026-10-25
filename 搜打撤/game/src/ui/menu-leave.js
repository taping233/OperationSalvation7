import { captureBattleContext } from '../battle/battle-loader.js';
import { runTerminalSettlement } from './terminal-settlement.js';
import { beginnerGuideHTML } from './beginner-guide.js';

/** Leaving a run owns save retry and terminal settlement, with source-view guards. */
export function createMenuLeaveFlow({ UI, game, runtime, esc, saveSession, getActiveSlot, terminalCommands, showTitle, openSettings, document, readCards, readSound, readAgent, readBattle = () => null }) {
  // ---------- 离开对局 / 放弃对局（v0.21 设计者规则） ----------
  // 放弃对局：带入本局的卡牌【全部】丢失；对局中获得的卡牌只有安全格里的
  // 会被宠物运回基地；物资/金币/消耗区全部散失。
  let leaveView = null;
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
    game.state = 'modal';
    const slot = getActiveSlot();
    const place = game.layerData?.[game.layerIdx]?.name || '本次远征';
    const view = leavePanel('系统菜单', 'choice', `
      <div class="leave-run-context"><span>${slot ? `档位 ${String(slot).padStart(2, '0')}` : '临时对局'}</span><span>${esc(place)}</span></div>
      ${slot ? '' : '<p class="leave-run-description">未选择档位，无法保存。</p>'}
      <p class="leave-run-status" role="status" aria-live="polite" hidden></p>
      <div class="leave-run-actions">
        <button type="button" class="leave-run-continue" data-act="leaveCancel" aria-label="返回对局，继续游玩">继续游玩</button>
        <button type="button" data-act="leaveSettings">设置</button>
        <button type="button" data-act="leaveHelp">规则帮助</button>
        <button type="button" class="leave-run-save" data-act="leaveSave"${slot ? '' : ' disabled'}>[[icon:save]] 保存并退出</button>
      </div>
      <div class="leave-run-secondary"><button type="button" data-act="leaveAbandon">放弃本次对局 <span aria-hidden="true">→</span></button></div>`, '[data-act="leaveCancel"]');
    UI.act('leaveSettings', () => { if (leaveViewCurrent(view)) openSettings({ returnTo:openLeaveMenu }); });
    UI.act('leaveHelp', () => { if (leaveViewCurrent(view)) { UI.registerHelp('system-rules', { title:'远征规则', html:beginnerGuideHTML(0), back:openLeaveMenu }); UI.showHelp('system-rules'); } });
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
      UI.hideOverlay();
      showTitle();
      return true;
    });
    UI.act('leaveCancel', () => {
      if (!leaveViewCurrent(view)) return;
      if (game.battleActive) {
        const battle = readBattle();
        if (typeof battle?.commands?.refreshView !== 'function') { UI.log('战斗界面暂不可恢复，请重试；当前战斗已保留。', 'warn'); return false; }
        leaveView = null; game.state = 'modal';
        battle.commands.refreshView();
        return true;
      }
      leaveView = null; UI.hideOverlay(); game.state = 'idle'; UI.refresh(game);
      return true;
    });
    UI.act('leaveAbandon', () => {
      if (leaveViewCurrent(view)) openAbandonConfirmation();
    });
  }

  function openAbandonConfirmation() {
    const safeCount = game.ownedCards.filter(card => card.safe && !card.brought).length;
    const view = leavePanel('确认放弃本次对局？', 'abandon', `
      <p class="leave-run-warning">放弃后，本次远征将结束。</p>
      <dl class="leave-run-consequences">
        <div><dt>将失去</dt><dd>带入的全部卡牌、未存入安全格的本局所得，以及金币、物资和消耗区。</dd></div>
        <div><dt>可带回</dt><dd>本局获得并已存入安全格的卡牌${safeCount ? `（${safeCount} 张）` : '（当前没有）'}。</dd></div>
      </dl>
      <div class="leave-run-actions">
        <button type="button" class="leave-run-continue" data-act="leaveReviewBack">返回</button>
        <button type="button" class="leave-run-danger" data-act="leaveAbandonConfirm">确认放弃</button>
      </div>`, '[data-act="leaveReviewBack"]');
    UI.act('leaveReviewBack', () => { if (leaveViewCurrent(view)) openLeaveMenu(); });
    UI.act('leaveAbandonConfirm', () => {
      if (!leaveViewCurrent(view)) return false;
      setLeaveBusy(view, true);
      leaveView = null;
      const button = /** @type {import("./ui.dom.types.js").UIElement} */ (document.querySelector('[data-act="leaveAbandonConfirm"]'));
      if (button) button.textContent = '正在结算…';
      return abandonRun();
    });
  }

  function abandonRun() {
    if (!game.runActive || game.terminalPending) return false;
    const slotId = getActiveSlot();
    const token = {
      kind: 'abandon', slotId, cards: game.ownedCards.filter(o => o.safe && !o.brought).map(o => ({ card: o.card, count: 1 })),
      broughtN: game.ownedCards.filter(o => o.brought).length, attempt: null, busy: false, promise: null, ephemeral: !slotId,
    };
    game.terminalPending = token;
    game.state = 'terminalPending';
    const current = () => game.terminalPending === token && getActiveSlot() === token.slotId;
    const finish = () => {
      if (!current()) return false;
      game.terminalPending = null;
      game.state = 'done';
      game.runActive = false;
      readAgent()?.recorder?.recordRun('abandon', { savedCards: token.cards });   // 跑局统计（数据分析系统）
      readSound().sfx('defeat');
      readSound().music('title');
      if (token.ephemeral) UI.log('[[icon:info]] 测试结算仅更新内存，没有写入基地存档', 'sys');
      const kept = token.cards;
      const keptMap = new Map();
      kept.forEach(o => {
        const k = o.card.name;
        if (!keptMap.has(k)) keptMap.set(k, { card: o.card, count: 0 });
        keptMap.get(k).count++;
      });
      const keptList = [...keptMap.values()];
      UI.log('<b>[[icon:flag]] 已放弃对局</b>：带入的卡牌全部遗失，物资与金币散失', 'warn');
      // 抢运回的卡用卡面网格（A5-ABANDON-01，与死亡页 doom-loot 同构；样式复用 overlays.css 无作用域
      // 的 .doom-loot/.doom-cards 家族；禁止套死亡页的外层 doom 玻璃容器——会改变放弃页标准弹层外观）；
      // 散失损失仍走 ov-stats/ov-note 文本行（散失=文本是既定口径）
      const keptHTML = keptList.length
        ? `<div class="doom-loot"><p class="doom-loot-h">[[icon:lock]] 宠物从安全格抢运回 <b>${kept.length}</b> 张对局中获得的卡牌</p><div class="doom-cards">${keptList.slice(0, 6).map((s, i) =>
            `<span class="doom-card" style="--i:${i}">${readCards().cardHTML(s.card, 'sm')}</span>`).join('')}${keptList.length > 6 ? `<span class="doom-more">还有 ${keptList.slice(6).reduce((n, s) => n + s.count, 0)} 张</span>` : ''}</div></div>`
        : '<p class="ov-note">安全格里没有对局中获得的卡牌——本次放弃没有带回任何卡牌。</p>';
      UI.showOverlay('已放弃对局', `<section class="leave-run-panel glass-panel" data-leave-step="complete">
        <p class="ov-stats">带入本局的 <b>${token.broughtN}</b> 张卡牌全部丢失；对局中获得的卡牌除安全格保护的外也全部失去；
          物资与 <b class="gold">${game.coins} 币</b>一并散失。</p>
        ${token.ephemeral ? '<p class="ov-note">开发测试档未选择存档槽；基地奖励仅暂存于内存。</p>' : ''}
        ${keptHTML}
        <div class="leave-run-actions">
          <button type="button" class="leave-run-continue" data-act="goBase">回基地</button>
          <button type="button" class="leave-run-save" data-act="toTitle">回主菜单</button>
        </div></section>`, 'glass', { initialFocus:'[data-act="goBase"]' });
      UI.act('goBase', () => runtime.openBaseHub('deploy'));
      UI.act('toTitle', () => { UI.hideOverlay(); showTitle(); });
      UI.refresh(game);
      return true;
    };
    return runTerminalSettlement({
      token, current, game, UI, finish: () => finish(),
      command: 'run.abandon', retryAct: 'retryAbandon',
      slotId, terminalCommands,
    });
  }

  return { openLeaveMenu };
}

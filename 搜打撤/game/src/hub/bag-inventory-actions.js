import { discardInventoryCard, craftInventoryToken } from './bag-inventory-commands.js';
import { esc } from '../core/shared.js';
import { completeRunCheckpoint } from '../core/run-checkpoint.js';

// Inventory commands own mutations; this owner connects saving, feedback and retry.
export function createBagInventoryActions({ UI, game, readCards, newUid, baseCap, saveGame,
  showBackpack, captureContext, captureBagView, rememberBagPosition, closeZoom, setReceipt }) {
  let pending = null;
  const ready = () => game.runActive && !game.battleActive && !pending?.current();

  function persist(result, { sameRun, cards, rollback, failure, success }) {
    const currentView = captureBagView();
    const operation = { current:() => sameRun() && game.ownedCards === cards };
    pending = operation;
    const root = document.getElementById('cardZoom') || UI.el?.ovBody?.firstElementChild;
    const buttons = [...(root?.querySelectorAll('button[data-act]:not(:disabled)') || [])];
    const previousBusy = root?.getAttribute('aria-busy');
    buttons.forEach(button => { button.disabled = true; });
    root?.setAttribute('aria-busy', 'true');
    const complete = saved => {
      try {
        if (saved === false) {
          if (operation.current()) {
            const visible = currentView(), restored = rollback();
            if (visible) {
              const message = restored ? failure : '保存未成功，背包已变化，请重新选择。';
              setReceipt(message, 'warn');
              UI.log(message, 'warn');
            }
          }
          return false;
        }
        if (operation.current() && currentView()) {
          try { success(result); }
          catch (error) { console.warn('[bag] 操作已保存，页面反馈未完成', error); }
        }
        return true;
      } finally {
        if (pending === operation) pending = null;
        buttons.forEach(button => { button.disabled = false; });
        if (root) {
          if (previousBusy == null) root.removeAttribute('aria-busy');
          else root.setAttribute('aria-busy', previousBusy);
        }
      }
    };
    return completeRunCheckpoint(saveGame, complete);
  }

  function discardOwnedCard(name, fromSafe, uid = null) {
    if (!ready()) return false;
    const sameRun = captureContext(), cards = game.ownedCards;
    const result = discardInventoryCard(game, { name, fromSafe, uid, current:sameRun }, readCards().SHA);
    if (result.ok === false) {
      if (result.code === 'protected') UI.log('[[icon:lock]] 初始牌「初始攻击」不可丢弃', 'warn');
      if (result.code === 'container-not-empty') UI.log('[[icon:bag]] 请先取出容器内所存卡牌，再丢弃最后一个容器', 'warn');
      return false;
    }
    return persist(result, { sameRun, cards,
      rollback:() => {
        if (!cards.includes(result.entry)) cards.splice(Math.min(result.index, cards.length), 0, result.entry);
        return true;
      },
      failure:'丢弃未能保存，卡牌已放回原位置，请重试。',
      success:() => {
        setReceipt(`已丢弃：${result.card.name} ×1`);
        UI.log(`[[icon:trash]] 已丢弃【<b>${esc(result.card.name)}</b>】×1（无法取回）`, 'warn');
      },
    });
  }

  function showDiscardConfirm(name, fromSafe) {
    if (!ready()) return Promise.resolve(false);
    rememberBagPosition(name);
    const current = captureBagView();
    return UI.confirmAction({ title:'丢弃卡牌？',
      message:`确认后丢弃「${name}」1张，无法从消耗区或消耗牌堆取回。`, confirmLabel:'确认丢弃',
      onConfirm:async () => {
        if (!current()) return false;
        const saved = await discardOwnedCard(name, fromSafe);
        if (!saved) return false;
        if (current()) { closeZoom(); showBackpack(true); }
        return true;
      },
    });
  }

  function craftBagToken(kind, sourceUid) {
    if (!ready()) return false;
    const sameRun = captureContext(), previousCards = game.ownedCards;
    const result = craftInventoryToken(game, { kind, sourceUid, current:sameRun }, {
      cards:() => readCards().all(), newUid, baseCap,
    });
    if (result.ok === false) {
      if ('reason' in result) { setReceipt(result.reason, 'warn'); UI.log(result.reason, 'warn'); }
      return false;
    }
    const cards = game.ownedCards;
    return persist(result, { sameRun, cards,
      rollback:() => {
        if (!cards.includes(result.output)) return false;
        const restored = cards.filter(entry => entry !== result.output);
        for (const { entry, index } of result.sources) {
          if (!restored.includes(entry)) restored.splice(Math.min(index, restored.length), 0, entry);
        }
        previousCards.splice(0, previousCards.length, ...restored);
        game.ownedCards = previousCards;
        if (result.fragmentsSpent) game.fragments = (game.fragments || 0) + result.fragmentsSpent;
        return true;
      },
      failure:'合成未能保存，材料与碎片已恢复，请重试。',
      success:() => {
        closeZoom();
        setReceipt(result.message.replace(/<[^>]*>|\[\[icon:[^\]]+\]\]/g, ''));
        UI.log(result.message, 'loot');
        showBackpack(true);
      },
    });
  }

  return { discardOwnedCard, showDiscardConfirm, craftBagToken };
}

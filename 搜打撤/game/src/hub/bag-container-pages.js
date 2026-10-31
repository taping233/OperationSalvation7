import { esc } from '../core/shared.js';
import { completeRunCheckpoint } from '../core/run-checkpoint.js';
import { containerRuleOf, containerAccepts, previewCardRewards, resourceContainerBonus, stackTransferSlotDelta } from '../core/card-capacity.js';
import { containerStoreHTML, captureContainerView, restoreContainerFocus } from './game.container-store.view.js';
import { transferContainerStack } from './bag-inventory-commands.js';
import { createOperationNotice } from '../ui/operation-notice.js';
import { setBagReturnHook } from './bag-return-hook.js';
import { syncViewChildren } from '../ui/view-children-sync.js';
import { lockRoomButtons } from '../ui/room-footer.js';

// Container views own feedback and saving; all inventory writes use the command port.
export function createBagContainerPages({ UI, game, readCards, sound, baseCap, cardStacks,
  usedSlots, bagCap, saveGame, showBackpack, rememberBagPosition, captureBagView, captureContext, bagAct, decorateInventoryZoom, rich = html => html }) {
  let pendingMove = null;
  function moving() {
    if (pendingMove && !pendingMove.current()) { pendingMove.release(); pendingMove = null; }
    return !!pendingMove;
  }
  // Use the same receipt projection as the command; this query never moves cards.
  function containerTransferReason(stack, take, count, capacity) {
    if (!take) return count + stack.count > capacity ? `剩余 ${Math.max(0, capacity - count)} 张空间，放不下整叠` : '';
    const entries = Array.from({ length:stack.count }, () => ({ card:stack.card }));
    const projected = previewCardRewards(entries.map(entry => entry.card), { ownedCards:game.ownedCards,
      usedSlots:usedSlots(), baseCap:baseCap(), totalCap:bagCap() - resourceContainerBonus(entries) });
    if (!projected.cant) return '';
    const delta = stackTransferSlotDelta(game.ownedCards, stack.card.name, false, stack.count, game.stackCapOf(stack.card));
    return `背包空间不足，整叠需 ${delta} 格`;
  }

  function openContainer(kind) {
    if (moving()) { UI.log('锦囊或珍珠盒正在保存，请稍候再打开。', 'warn'); return false; }
    const isPouch = kind === 'pouch', title = isPouch ? '法师锦囊' : '珍珠盒';
    const icon = isPouch ? 'spell-pouch' : 'pearl-box';
    const notice = createOperationNotice();
    rememberBagPosition(title);
    game.state = 'modal';
    let root, renderRevision = 0; const current = captureBagView(() => root);
    const sameRun = captureContext(), cards = game.ownedCards;
    const canResume = () => sameRun() && game.ownedCards === cards && game.runActive && !game.battleActive && game.state === 'modal';
    const pouch = () => game.ownedCards.find(entry => entry.card?.id === 'tt7-stratagem')?.card;
    const boxes = isPouch ? [] : game.ownedCards.filter(x => x.card?.id === 'tt2-pearlbox');
    const pearlCapacity = boxes.reduce((sum, box) => sum + (containerRuleOf(box.card)?.slots || 0), 0);
    const capacity = () => isPouch ? containerRuleOf(pouch())?.slots || 0 : pearlCapacity;
    // 两类容器共用 stored；锦囊按 pouchOf 归属，珍珠盒仅包含未指定 pouchOf 的卡。
    const stored = entry => isPouch ? entry.pouchOf === 'tt7-stratagem' && entry.card : entry.stored && !entry.pouchOf;
    const storedStacks = () => {
      const map = new Map();
      game.ownedCards.forEach(x => {
        if (!stored(x) || !x.card) return;
        if (!map.has(x.card.name)) map.set(x.card.name, { card: x.card, count: 0, uids:[] });
        const stack = map.get(x.card.name);
        stack.count++;
        stack.uids.push(x.uid);
      });
      return [...map.values()];
    };
    const render = (viewState = captureContainerView(root)) => {
      const revision = ++renderRevision;
      const storedList = storedStacks(), available = cardStacks(false).map((stack, stackIndex) => ({ ...stack, stackIndex })).filter(st => isPouch
        ? containerAccepts(pouch(), st.card) && st.card.id !== 'tt7-stratagem'
        : boxes.some(box => containerAccepts(box.card, st.card)));
      const stacks = [...storedList, ...available];
      const html = containerStoreHTML({ title, icon, prefix: kind,
        count: game.ownedCards.filter(stored).length, cap: capacity(), stored: storedList, available,
        type: isPouch ? containerRuleOf(pouch())?.accepts || '法术' : '资源', cardHTML: readCards().cardHTML, reason: containerTransferReason,
        help: isPouch ? '战斗中打出锦囊，从囊内选择 1 张法术直接释放；锦囊为空时无效果。'
          : `当前 ${boxes.length} 个珍珠盒共可存 ${pearlCapacity} 张卡牌。把珍珠盒放进安全格，盒中卡牌在撤离失败时也会被抢运回基地。`,
        notice:notice.html({ keepEmpty:true }),
      });
      if (root?.isConnected && UI.el.ovBody?.firstElementChild === root && !UI.el.overlay.hidden
          && !UI.el.overlay.classList.contains('closing')) {
        const template = root.ownerDocument.createElement('template');
        template.innerHTML = rich(html);
        syncViewChildren(root, template.content.firstElementChild);
      } else {
        UI.showOverlay(title, html, 'bag');
        root = UI.el.ovBody?.firstElementChild;
      }
      restoreContainerFocus(root, viewState, `${kind}Back`);
      const renderedRoot = root;
      bagAct(`${kind}Inspect`, d => {
        if (revision !== renderRevision || root !== renderedRoot || moving()) return;
        const card = stacks[+d.i]?.card;
        if (!card) return;
        UI.showCardZoom(card, { returnFocus: root.querySelector(`[data-act="${kind}Inspect"][data-i="${+d.i}"]`) });
        decorateInventoryZoom(card);
      }, current);
      // The menu replaces the mounted page. Resume the same container closure;
      // its page guard follows the new root after render, while this guard owns the run.
      setBagReturnHook(() => {
        if (!canResume() || moving()) return false;
        render(null);
        return true;
      });
    };
    for (const take of [false, true]) {
      bagAct(`${kind}${take ? 'Take' : 'Put'}`, d => {
        if (moving()) return false;
        const result = transferContainerStack(game, { kind, take, name: d.name,
          ...(!take ? { stackIndex:Number(d.stackIndex), stackCount:Number(d.stackCount) } : {}), current }, {
          stackCapOf:card => game.stackCapOf(card), usedSlots, bagCap, baseCap:() => baseCap(),
        });
        if (result.ok === false) {
          let message;
          if (take && result.code === 'bag-full') {
            message = isPouch ? `[[icon:bag]] 背包放不下：本次整叠还需 ${result.delta} 格，请先腾出空间；珍珠盒额外格仅收资源卡`
              : `[[icon:bag]] 背包放不下：本次整叠还需 ${result.delta} 格（现 ${result.used}/${result.limit} 格），先腾出空间`;
          } else if (!take && result.code === 'container-full') {
            message = isPouch ? `[[icon:spell-pouch]] 锦囊装不下整叠：已有 ${result.storedCount}/${result.capacity} 张，本次 ${result.count} 张`
              : `[[icon:pearl-box]] 珍珠盒放不下了（${result.storedCount}/${result.capacity} 张）——先取出一些`;
          }
          if (message) {
            notice.set(message.replace(/\[\[icon:[^\]]+\]\]\s*/g, ''), 'warn');
            UI.log(message, 'warn');
            sound('deny');
          }
          return;
        }
        const sameRun = captureContext(), cards = game.ownedCards, actionRoot = root;
        const actionCurrent = captureBagView(), initialView = captureContainerView(root);
        const unlockButtons = lockRoomButtons(root.querySelectorAll(`button[data-act="${kind}Put"], button[data-act="${kind}Take"], button[data-act="${kind}Inspect"], button[data-act="${kind}Back"]`));
        const previousBusy = root.getAttribute('aria-busy');
        let released = false;
        const operation = {
          current:() => sameRun() && game.ownedCards === cards,
          release:() => {
            if (released) return;
            released = true;
            if (previousBusy == null) actionRoot.removeAttribute('aria-busy');
            else actionRoot.setAttribute('aria-busy', previousBusy);
            unlockButtons();
          },
        };
        pendingMove = operation;
        root.setAttribute('aria-busy', 'true');
        notice.set('正在保存存取结果，请稍候。');
        const complete = saved => {
          try {
            const sameInventory = operation.current();
            const showCurrent = sameInventory && current() && actionCurrent() && root === actionRoot;
            if (saved === false) {
              if (sameInventory) result.moves.forEach(({entry, before, after}) => {
                if (!cards.includes(entry) || !['stored', 'pouchOf'].every(key =>
                  Object.hasOwn(entry, key) === after[key].present && Object.is(entry[key], after[key].value))) return;
                for (const key of ['stored', 'pouchOf']) {
                  if (before[key].present) entry[key] = before[key].value;
                  else delete entry[key];
                }
              });
              if (showCurrent) {
                notice.set('保存未成功；卡牌已回到原位置，请重试。', 'warn');
                UI.log('存取保存未成功；卡牌已回到原位置，请重试。', 'warn');
                sound('deny');
              }
              return false;
            }
            if (showCurrent) {
              const message = `【${result.card.name}】×${result.count}${take ? `已从${title}取出，回到背包` : `已存入${title}`}。`;
              notice.set(message);
              UI.log(`[[icon:${take ? 'bag' : icon}]] ${esc(message)}`, 'ok');
              if (!isPouch && !take) sound('gain');
            }
            return true;
          } finally {
            operation.release();
            if (pendingMove === operation) pendingMove = null;
            if (operation.current() && current() && actionCurrent() && root === actionRoot) {
              const viewState = captureContainerView(root);
              if (!viewState.focused) viewState.focused = initialView.focused;
              if (saved === false) restoreContainerFocus(root, viewState, `${kind}Back`);
              else render(viewState);
            }
          }
        };
        return completeRunCheckpoint(saveGame, complete);
      }, current);
    }
    bagAct(`${kind}Back`, () => { if (moving()) return false; UI.hideOverlay(); showBackpack(true); }, current);
    render();
  }

  return { openPouchStore: () => openContainer('pouch'), openPearlStore: () => openContainer('pearl') };
}

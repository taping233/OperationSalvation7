import { esc } from '../core/shared.js';
import { containerRuleOf, containerAccepts } from '../core/card-capacity.js';
import { containerStoreHTML, captureContainerView, restoreContainerFocus } from './game.container-store.view.js';
import { transferContainerStack } from './bag-inventory-commands.js';

// Container views own feedback and saving; all inventory writes use the command port.
export function createBagContainerPages({ UI, game, readCards, sound, baseCap, cardStacks,
  usedSlots, bagCap, saveGame, showBackpack, rememberBagPosition, captureBagView, bagAct, decorateInventoryZoom }) {
  // Mirrors the existing execution guards; a presentation preview never moves cards.
  function containerTransferReason(stack, take, count, capacity) {
    if (!take) return count + stack.count > capacity ? `剩余 ${Math.max(0, capacity - count)} 张空间，放不下整叠` : '';
    const cap = game.stackCapOf(stack.card);
    const sameBag = game.ownedCards.filter(x => !x.safe && !x.stored && x.card.name === stack.card.name).length;
    const delta = Math.ceil((sameBag + stack.count) / cap) - Math.ceil(sameBag / cap);
    const limit = stack.card.type === '资源' ? bagCap() : baseCap();
    return (stack.card.type === '资源' || delta > 0) && usedSlots() + delta > limit ? `背包空间不足，整叠需 ${delta} 格` : '';
  }

  function openContainer(kind) {
    const isPouch = kind === 'pouch', title = isPouch ? '法师锦囊' : '珍珠盒';
    const icon = isPouch ? 'spell-pouch' : 'pearl-box';
    rememberBagPosition(title);
    game.state = 'modal';
    let root; const current = captureBagView(() => root);
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
        if (!map.has(x.card.name)) map.set(x.card.name, { card: x.card, count: 0 });
        map.get(x.card.name).count++;
      });
      return [...map.values()];
    };
    const render = () => {
      const viewState = captureContainerView(root);
      const storedList = storedStacks(), available = cardStacks(false).filter(st => isPouch
        ? containerAccepts(pouch(), st.card) && st.card.id !== 'tt7-stratagem'
        : boxes.some(box => containerAccepts(box.card, st.card)));
      const stacks = [...storedList, ...available];
      UI.showOverlay(title, containerStoreHTML({ title, icon, prefix: kind,
        count: game.ownedCards.filter(stored).length, cap: capacity(), stored: storedList, available,
        type: isPouch ? containerRuleOf(pouch())?.accepts || '法术' : '资源', cardHTML: readCards().cardHTML, reason: containerTransferReason,
        help: isPouch ? '战斗中打出锦囊，从囊内选择 1 张法术直接释放；锦囊为空时无效果。'
          : `当前 ${boxes.length} 个珍珠盒共可存 ${pearlCapacity} 张卡牌。把珍珠盒放进安全格，盒中卡牌在撤离失败时也会被抢运回基地。`,
      }), 'bag');
      root = UI.el.ovBody?.firstElementChild;
      restoreContainerFocus(root, viewState, `${kind}Back`);
      const renderedRoot = root;
      bagAct(`${kind}Inspect`, d => {
        if (root !== renderedRoot) return;
        const card = stacks[+d.i]?.card;
        if (!card) return;
        UI.showCardZoom(card, { returnFocus: root.querySelector(`[data-act="${kind}Inspect"][data-i="${+d.i}"]`) });
        decorateInventoryZoom(card);
      }, current);
    };
    for (const take of [false, true]) {
      bagAct(`${kind}${take ? 'Take' : 'Put'}`, d => {
        const result = transferContainerStack(game, { kind, take, name: d.name, current }, {
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
            UI.log(message, 'warn');
            sound('deny');
          }
          return;
        }
        const name = esc(result.card.name);
        const message = isPouch ? `[[icon:spell-pouch]] 【<b>${name}</b>】${take ? '已从锦囊取出' : '存入法师锦囊'}`
          : `[[icon:${take ? 'bag' : icon}]] 【<b>${name}</b>】×${result.count} ${take ? '从珍珠盒取出，回到背包' : '存入珍珠盒——腾出 1 个背包格'}`;
        UI.log(message, 'ok');
        if (!isPouch && !take) sound('gain');
        saveGame();
        render();
      }, current);
    }
    bagAct(`${kind}Back`, () => { UI.hideOverlay(); showBackpack(true); }, current);
    render();
  }

  return { openPouchStore: () => openContainer('pouch'), openPearlStore: () => openContainer('pearl') };
}

import { stackTransferSlotDelta } from '../core/card-capacity.js';
import { openRewardCapacityOrganizer } from '../ui/reward-capacity-organizer.js';

// Inventory ports keep the UI independent from the live session and persistence.
export function createRewardOrganizer({ UI, game, shaName, usedSlots, bagCap, safeUsed, safeCap,
  moveStackSafe, discardOwnedCard }) {
  const readStacks = () => {
    const stacks = new Map();
    for (const owned of game.ownedCards) {
      if (owned.safe || owned.stored || owned.pouchOf || owned.card.name === shaName) continue;
      const name = owned.card.name;
      if (!stacks.has(name)) stacks.set(name, { card:owned.card, uids:[], count:0 });
      const stack = stacks.get(name);
      stack.uids.push(owned.uid); stack.count++;
    }
    return [...stacks.values()];
  };
  return options => {
    const current = () => !game.battleActive && options.current();
    return openRewardCapacityOrganizer({ ...options, UI, readStacks, current,
      canReceive:() => game.canReceiveCard(options.card),
      capacity:() => `背包 ${usedSlots()}/${bagCap()} 格 · 安全格 ${safeUsed()}/${safeCap()} 格`,
      safeAvailability:stack => {
        const delta = stackTransferSlotDelta(game.ownedCards, stack.card.name, true, stack.count, game.stackCapOf(stack.card));
        const used = safeUsed(), cap = safeCap();
        const room = Math.max(0, cap - used);
        const ok = used + delta <= cap;
        return { ok, reason:ok ? '' : `整叠需 ${delta} 格，安全格余 ${room} 格` };
      },
      // The organizer paints after the inventory owner has completed persistence.
      moveToSafe:stack => current() ? moveStackSafe(stack.card.name, true, { refresh:false, uids:stack.uids }) : false,
      discardOne:stack => current() ? discardOwnedCard(stack.card.name, false, stack.uids[0]) : false,
    });
  };
}

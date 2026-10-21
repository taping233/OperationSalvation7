// Presentation only: the command layer validates and spends materials.
import { groupHandCards, orderHandGroups } from '../core/battle.hand.js';

// Expose each physical copy without editing the hand or the selection.
export function infusionHandCards(entries, infusion) {
  let index = 0;
  return orderHandGroups(groupHandCards(entries, infusion)).filter(group => !group.self).flatMap(group => {
    const selectedCopies = group.uids.filter(uid => infusion.picked.includes(uid)).length;
    return group.uids.map((uid, copy) => ({ ...group, key:`${group.key}|uid:${uid}`, uids:[uid],
      copyIndex:copy + 1, totalCopies:group.uids.length, selectedCopies, shortcut:++index <= 9 ? index : null,
      displayIndex:index - 1, displayCount:entries.length - 1 }));
  });
}

// Card eligibility is projected without selecting a physical copy for the player.
export function infusionMaterialState(group, infusion, hand, fuelReason) {
  const selected = group.uids.filter(uid => infusion.picked.includes(uid));
  const available = group.uids.filter(uid => hand.includes(uid) && !infusion.picked.includes(uid) && !fuelReason(uid));
  const full = infusion.picked.length >= infusion.need;
  const unavailable = !selected.length && !available.length ? fuelReason(group.uids[0]) || '材料已不在手牌中' : '';
  const addReason = unavailable || (full ? '材料已齐，请先撤回已选卡' : !available.length ? selected.length === group.uids.length ? '该组材料已全部选中' : '该组没有更多可选材料' : '');
  const remove = selected.length > 0 && (full || !available.length);
  return { selected, available, unavailable, addReason, remove, canAdjust:remove || !addReason };
}

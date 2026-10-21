// Presentation only: the command layer validates and spends materials.
// Card-face clicks and number keys share the same add-until-full / remove action.
export function infusionMaterialState(group, infusion, hand, fuelReason) {
  const selected = group.uids.filter(uid => infusion.picked.includes(uid));
  // Only existence is consumed here; keep full raw-card projection/legacy repair in the renderer.
  const hasAvailable = group.uids.some(uid => hand.includes(uid) && !infusion.picked.includes(uid) && !fuelReason(uid));
  const full = infusion.picked.length >= infusion.need;
  const unavailable = !selected.length && !hasAvailable ? fuelReason(group.uids[0]) || '材料已不在手牌中' : '';
  const addReason = unavailable || (full ? '材料已齐，请先减少已选材料' : !hasAvailable ? selected.length === group.uids.length ? '该组材料已全部选中' : '该组没有更多可选材料' : '');
  const remove = selected.length > 0 && (full || !hasAvailable);
  return { selected, unavailable, addReason, remove, canAdjust:remove || !addReason };
}

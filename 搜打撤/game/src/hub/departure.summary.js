// Presentation preview: no random draw, storage write or rule mutation.
import { departureStackKey, findDepartureStack } from './base-departure.commands.js';
import { bagCapacityState, resourceContainerSlots } from '../core/card-capacity.js';
import { formatBagCapacity } from '../core/bag-render-derivation.js';

// 推荐只预览，不抽牌、不写预设、不扣仓；既有选择始终保留。
export function previewRecommendedDeparture(options) {
  const picks = { ...options.picks }, added = [];
  const ref = stack => ({ cardId: stack.card.id, ...((stack.variantKey || stack.card.variantKey) ? { variantKey: stack.variantKey || stack.card.variantKey } : {}) });
  const presetFor = selection => ({ picks: Object.entries(selection).filter(([, n]) => n > 0).map(([key, count]) => ({ card: ref(findDepartureStack(options.stash, key) || { card: {} }), count })) });
  const rank = card => /护甲|护盾|格挡|破甲|回复|治疗/.test(card.desc || '') ? 0 : 1;
  const candidates = options.stash.filter(stack => stack.count > 0 && stack.card.id && stack.card.rarity !== '职业' &&
    (['武术', '法术', '生物', '装备'].includes(stack.card.type) || stack.card.type === '道具' && /回复|治疗|复原/.test(stack.card.desc || '')))
    .sort((a, b) => rank(a.card) - rank(b.card) || (a.card.cost || 0) - (b.card.cost || 0));
  for (const stack of candidates) {
    if (added.length >= 3) break;
    const key = departureStackKey(stack);
    if (findDepartureStack(options.stash, key) !== stack || Object.entries(picks).some(([selected, n]) => n > 0 && findDepartureStack(options.stash, selected)?.card.name === stack.card.name)) continue;
    const next = { ...picks, [key]: 1 }, summary = departureSummary({ ...options, picks: next });
    const preview = options.previewDeployment({ baseSnapshot: { stash: options.stash, petSel: options.pet?.id }, preset: presetFor(next), cardCatalog: options.stash.map(item => item.card), pets: options.pet ? [options.pet] : [], bagCapacity: options.capacity, starterCount: options.starterCount, starterCard: options.starterCard });
    if (!preview.canStart || !summary.capacityOk || summary.slots > Math.max(0, options.capacity - 3)) continue;
    picks[key] = 1; added.push(stack.card.name);
  }
  return { picks, added, summary: departureSummary({ ...options, picks }) };
}
export function departurePickAvailability(options, key) {
  return pickAvailability(options, key, candidate => findDepartureStack(options.stash, candidate));
}

// Resolve each identity once within this synchronous render only. The existing
// resolver remains authoritative for duplicate keys and legacy name selection.
export function departurePickAvailabilities(options) {
  const resolved = new Map(), availability = new Map();
  const findStack = key => {
    if (!resolved.has(key)) resolved.set(key, findDepartureStack(options.stash, key));
    return resolved.get(key);
  };
  for (const stack of options.stash) {
    const key = departureStackKey(stack);
    if (!availability.has(key)) availability.set(key, pickAvailability(options, key, findStack));
  }
  return availability;
}

function pickAvailability(options, key, findStack) {
  const stack = findStack(key);
  if (!stack) return { canAdd:false, reason:'仓库卡堆身份已变化，请重新选择。' };
  if (stack.card.rarity === '职业') return { canAdd:false, reason:'职业卡不能带入对局。' };
  const selected = Math.max(0, Math.floor(Number(options.picks?.[key]) || 0));
  if (selected >= stack.count) return { canAdd:false, reason:'该卡牌库存已全部选入。' };
  const next = projectDeparture({ ...options, picks:{ ...options.picks, [key]:selected + 1 } }, findStack);
  return next.capacityOk ? { canAdd:true, reason:'' } : { canAdd:false,
    reason:next.ordinarySlots > next.baseCapacity ? '普通格空间不足，资源专用格仅能放资源卡。' : '背包空间不足，请先移出卡牌或扩建背包。' };
}

function projectDeparture({ starterCount, starterCard, fireball, pet, picks, capacity, stackCapOf }, findStack) {
  const effect = pet?.effect || {};
  const starter = effect.shaToFireball && fireball ? fireball : starterCard;
  const count = starterCount + (effect.extraSha || 0);
  /** @type {Map<string, {card: typeof starter, count: number, fixedCount: number, sources: Array<{stackKey: string, count: number}>}>} */
  const known = new Map([[starter.name, { card: starter, count, fixedCount:count, sources:[] }]]);
  let extraCount = 0;
  let resourceBonus = 0;
  for (const [key, requested] of Object.entries(picks || {})) {
    const stack = findStack(key);
    if (!stack || stack.card.rarity === '职业') continue;
    const quantity = Math.min(Math.max(0, Math.floor(Number(requested) || 0)), stack.count);
    if (!quantity) continue;
    extraCount += quantity;
    resourceBonus += quantity * resourceContainerSlots(stack.card);
    const name = stack.card.name;
    const entry = known.get(name) || { card: stack.card, count:0, fixedCount:0, sources:[] };
    entry.count += quantity;
    entry.sources.push({ stackKey:departureStackKey(stack), count:quantity });
    known.set(name, entry);
  }
  let slots = 0, resourceSlots = 0;
  const groups = [...known.values()].map(entry => {
    const cap = stackCapOf(entry.card);
    const slotCount = Math.ceil(entry.count / cap);
    slots += slotCount;
    if (entry.card.type === '资源') resourceSlots += slotCount;
    return { ...entry, cap, slotCount };
  });
  const ordinarySlots = slots - resourceSlots;
  const totalCapacity = capacity + resourceBonus;
  const { capacityOk } = bagCapacityState({ usedSlots:slots, ordinarySlots,
    baseCap:capacity, totalCap:totalCapacity });
  return { starter, starterCount:count, extraCount, knownCount:count + extraCount, slots,
    baseCapacity:capacity, capacity:totalCapacity, resourceBonus, ordinarySlots, resourceSlots, capacityOk, groups };
}

export function departureSummary(options) {
  const { groups, ...summary } = projectDeparture(options, key => findDepartureStack(options.stash, key));
  // Card faces and source slices belong to rendering; capacity-only callers do
  // not allocate them for every hypothetical extra card.
  const cells = groups.flatMap(entry => {
    const cap = entry.cap;
    return Array.from({ length: entry.slotCount }, (_, index) => {
      const offset = index * cap, count = Math.min(cap, entry.count - offset);
      const fixedCount = Math.max(0, Math.min(count, entry.fixedCount - offset));
      let sourceOffset = entry.fixedCount;
      const sources = entry.sources.flatMap(source => {
        const overlap = Math.max(0, Math.min(offset + count, sourceOffset + source.count) - Math.max(offset, sourceOffset));
        sourceOffset += source.count;
        return overlap ? [{ stackKey:source.stackKey, count:overlap }] : [];
      });
      return { card:entry.card, stackKey:sources[0]?.stackKey, count, fixed:fixedCount > 0,
        fixedCount, selectableCount:count - fixedCount, sources };
    });
  });
  const capacityText = formatBagCapacity({ baseCap:summary.baseCapacity, resourceBonus:summary.resourceBonus,
    used:summary.slots, ordinarySlots:summary.ordinarySlots });
  return { ...summary, capacityText, cells };
}

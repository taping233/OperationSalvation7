import { bagCapacityState, resourceContainerSlots, stackCapOf } from './card-capacity.js';

function addToGroup(groups, entry) {
  const name = entry.card.name;
  if (!groups.has(name)) groups.set(name, { card:entry.card, uids:[] });
  groups.get(name).uids.push(entry.uid);
}

function splitGroups(groups) {
  const stacks = [];
  groups.forEach(({ card, uids }) => {
    const cap = stackCapOf(card);
    for (let i = 0; i < uids.length; i += cap) {
      stacks.push({ card, count:Math.min(cap, uids.length - i), uids:uids.slice(i, i + cap) });
    }
  });
  return stacks;
}

// The live query and render snapshot share the same grouping and split rules.
export function cardStacksForZone(ownedCards, safe) {
  const groups = new Map();
  ownedCards.forEach(entry => {
    if (!entry.stored && !!entry.safe === !!safe) addToGroup(groups, entry);
  });
  return splitGroups(groups);
}

export function syncBagCardOrder(bagStacks, safeStacks, previous = []) {
  const known = new Set([...bagStacks, ...safeStacks].map(stack => stack.card.name));
  const order = previous.filter(name => known.has(name)), included = new Set(order);
  known.forEach(name => {
    if (!included.has(name)) { order.push(name); included.add(name); }
  });
  return order;
}

export function bagCardOrderIndex(order) {
  const index = new Map();
  // Existing duplicate order entries retain Array.indexOf's first-match ordering.
  order.forEach((name, i) => { if (!index.has(name)) index.set(name, i); });
  return index;
}

export function formatBagCapacity({ baseCap, resourceBonus = 0, used, ordinarySlots = used }) {
  const totalCap = baseCap + resourceBonus;
  const { ordinaryFree, resourceFree } = bagCapacityState({ usedSlots:used, ordinarySlots, baseCap, totalCap });
  return resourceBonus ? `已用 ${used}/${totalCap} 格 · 普通可用 ${ordinaryFree} 格 · 资源可用 ${resourceFree} 格` : `${used}/${baseCap} 格`;
}

// A fresh, pure projection for one synchronous render. Never retain it for actions.
export function deriveBagRenderState({ ownedCards, inventory, cardOrder = [] }, baseCap) {
  const bagGroups = new Map(), safeGroups = new Map(), ownedIndexByUid = new Map();
  let resourceBonus = 0, pearlStoredN = 0, bagCardN = 0, safeCardN = 0;
  ownedCards.forEach((entry, i) => {
    if (!ownedIndexByUid.has(entry.uid)) ownedIndexByUid.set(entry.uid, i);
    resourceBonus += resourceContainerSlots(entry.card);
    if (entry.stored && !entry.pouchOf) pearlStoredN++;
    if (entry.stored) return;
    addToGroup(entry.safe ? safeGroups : bagGroups, entry);
    if (entry.safe) safeCardN++; else bagCardN++;
  });
  const bagStacks = splitGroups(bagGroups), safeStacks = splitGroups(safeGroups);
  const bagNameCounts = new Map([...bagGroups].map(([name, group]) => [name, group.uids.length]));
  const order = syncBagCardOrder(bagStacks, safeStacks, cardOrder || []);
  let supplySlots = 0, supplyN = 0, total = 0;
  inventory.forEach(item => {
    const count = item.count || 1;
    supplySlots += Math.ceil(count / 3); supplyN += count; total += item.value * count;
  });
  let resourceSlots = 0;
  for (const stack of bagStacks) if (stack.card.type === '资源') resourceSlots++;
  const used = supplySlots + bagStacks.length;
  const state = { bagStacks, safeStacks, ownedIndexByUid, bagNameCounts, cardOrder:order,
    orderIndex:bagCardOrderIndex(order), resourceBonus, pearlStoredN, bagCardN, safeCardN,
    baseCap, cap:baseCap + resourceBonus, used,
    ordinarySlots:used - resourceSlots, resourceSlots, supplyN, total };
  state.capacityText = formatBagCapacity(state);
  return state;
}

import { FURNITURE_CATALOG, ROOM_SPEC, furnitureById } from './home.catalog.js';
import { readBase, readBaseReceipt, commitBase } from '../hub/base.commands.js';

const clone = value => structuredClone(value);
const frozen = value => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(frozen);
  return Object.freeze(value);
};
const fail = (code, message, retryable = false, details) => ({ ok: false, code, message, retryable, ...(details ? { details } : {}) });

function normalizeHome(snapshot) {
  const raw = snapshot?.home || {};
  return {
    owned: raw.owned && typeof raw.owned === 'object' ? clone(raw.owned) : {},
    placements: Array.isArray(raw.placements) ? clone(raw.placements) : [],
    displays: Array.isArray(raw.displays) ? clone(raw.displays) : [],
  };
}

function ownedIds(owned, furnitureId) {
  const value = owned?.[furnitureId];
  if (Array.isArray(value)) return value.filter(id => typeof id === 'string');
  // 兼容迁移期仅有数量的形状；生成的 ID 稳定且只用于旧档补齐。
  if (Number.isInteger(value) && value > 0) return Array.from({ length: value }, (_, i) => `${furnitureId}-legacy-${i + 1}`);
  return [];
}

function cellsFor(placement, spec) {
  const swap = placement.rotation === 90 || placement.rotation === 270;
  const width = swap ? spec.footprint.height : spec.footprint.width;
  const height = swap ? spec.footprint.width : spec.footprint.height;
  const cells = [];
  for (let y = placement.y; y < placement.y + height; y++) for (let x = placement.x; x < placement.x + width; x++) cells.push({ x, y });
  return cells;
}

export function getHome(baseSnapshot, furnitureCatalog = FURNITURE_CATALOG) {
  const home = normalizeHome(baseSnapshot);
  return frozen({
    coins: Number(baseSnapshot?.coins) || 0,
    owned: home.owned,
    placements: home.placements,
    displays: ROOM_SPEC.displaySlots.map(slot => ({ slotId: slot.id, ref: home.displays.find(d => d.slotId === slot.id)?.ref || null })),
    room: clone(ROOM_SPEC),
    catalog: clone(furnitureCatalog),
  });
}

export function validateLayout({ placements, roomSpec = ROOM_SPEC, ownedFurniture, furnitureCatalog = FURNITURE_CATALOG }) {
  const violations = [];
  const occupied = new Map();
  const list = Array.isArray(placements) ? placements : [];
  const seenInstances = new Set();
  const placed = [];
  for (const placement of list) {
    const id = placement?.instanceId || null;
    const spec = furnitureById(placement?.furnitureId, furnitureCatalog);
    if (!id || !spec || !Number.isInteger(placement.x) || !Number.isInteger(placement.y)) {
      violations.push({ instanceId: id, code: 'INVALID_ARGUMENT', cells: [] });
      continue;
    }
    if (seenInstances.has(id) || !ownedIds(ownedFurniture, spec.id).includes(id)) {
      violations.push({ instanceId: id, code: 'UNOWNED_INSTANCE', cells: [] });
      continue;
    }
    seenInstances.add(id);
    if (!spec.allowedRotations.includes(placement.rotation)) {
      violations.push({ instanceId: id, code: 'INVALID_ROTATION', cells: [] });
      continue;
    }
    const zone = roomSpec.zones.find(z => z.id === placement.zoneId);
    const cells = cellsFor(placement, spec);
    if (!zone || zone.surface !== spec.surface && spec.surface !== 'table') {
      violations.push({ instanceId: id, code: 'INVALID_SURFACE', cells });
      continue;
    }
    if (!cells.every(c => c.x >= zone.x && c.y >= zone.y && c.x < zone.x + zone.width && c.y < zone.y + zone.height)) {
      violations.push({ instanceId: id, code: 'PLACEMENT_OUT_OF_BOUNDS', cells });
      continue;
    }
    placed.push({ placement, spec, cells });
    if (spec.surface !== 'table') {
      for (const cell of cells) {
        const key = `${placement.zoneId}:${cell.x}:${cell.y}`;
        for (const prior of occupied.get(key) || []) {
          const overlapAllowed = spec.allowsOverlap.includes(prior.spec.surface) || prior.spec.allowsOverlap.includes(spec.surface);
          if (!overlapAllowed) violations.push({ instanceId: id, code: 'PLACEMENT_OVERLAP', cells: [cell], withInstanceId: prior.placement.instanceId });
        }
        (occupied.get(key) || occupied.set(key, []).get(key)).push({ placement, spec });
      }
    }
  }
  for (const item of placed.filter(item => item.spec.surface === 'table')) {
    const supported = placed.some(base => base.spec.supports.includes('table') && base.placement.zoneId === item.placement.zoneId && item.cells.every(cell => base.cells.some(c => c.x === cell.x && c.y === cell.y)));
    if (!supported) violations.push({ instanceId: item.placement.instanceId, code: 'MISSING_SUPPORT', cells: item.cells });
  }
  return frozen({ valid: violations.length === 0, violations });
}

export function createHomeCommands({ readBase, readBaseReceipt = null, commitBase, getCollection = null, furnitureCatalog = FURNITURE_CATALOG, roomSpec = ROOM_SPEC }) {
  if (typeof readBase !== 'function' || typeof commitBase !== 'function') throw new TypeError('readBase and commitBase are required');
  const read = slotId => {
    const result = readBase(slotId);
    return result?.ok ? result : fail(result?.code || 'NOT_FOUND', result?.message || '找不到档位', !!result?.retryable, result?.details);
  };
  const replay = async (context, command, payload) => {
    if (!readBaseReceipt) return null;
    const result = await readBaseReceipt(context, { command, payload });
    if (!result?.ok) return result;
    if (result.value) return result.value.output === undefined ? result : { ok: true, value: frozen(clone(result.value.output)), revision: result.revision };
    return null;
  };
  const commit = async (context, before, command, payload, afterState, eventPayload, output = null) => {
    const result = await commitBase(context, { beforeRevision: before.revision, command, payload, afterState, output, events: [{ type: 'home.changed', payload: eventPayload }] });
    if (!result?.ok) return result || fail('SAVE_FAILED', '基地存档写入失败', true);
    const revision = result.revision ?? result.value?.baseRevision ?? before.revision + 1;
    return { ok: true, value: result.value?.output === undefined ? getHome(afterState, furnitureCatalog) : frozen(clone(result.value.output)), revision };
  };

  return Object.freeze({
    getHome(slotId) {
      const current = read(slotId);
      return current.ok ? { ok: true, value: getHome(current.value, furnitureCatalog), revision: current.revision } : current;
    },
    async buyFurniture(context, { furnitureId, quantity = 1 } = {}) {
      const payload = { furnitureId, quantity };
      const replayed = await replay(context, 'home.purchase', payload);
      if (replayed) return replayed;
      const current = read(context?.slotId);
      if (!current.ok) return current;
      const spec = furnitureById(furnitureId, furnitureCatalog);
      if (!spec || !Number.isInteger(quantity) || quantity <= 0) return fail('INVALID_ARGUMENT', '家具或数量无效');
      const state = clone(current.value), home = normalizeHome(state), ids = ownedIds(home.owned, furnitureId);
      if (ids.length + quantity > spec.maxOwned) return fail('INVALID_STATE', '已达到家具拥有上限', false, { furnitureId, maxOwned: spec.maxOwned });
      const costCoins = spec.priceCoins * quantity;
      if ((Number(state.coins) || 0) < costCoins) return fail('INSUFFICIENT_FUNDS', '储备币不足', false, { required: costCoins, available: Number(state.coins) || 0 });
      for (let i = 0; i < quantity; i++) ids.push(`${furnitureId}-${ids.length + 1}`);
      home.owned[furnitureId] = ids; state.coins -= costCoins; state.home = home;
      const receipt = frozen({ furnitureId, quantity, instanceIds: ids.slice(-quantity), costCoins, coinsAfter: state.coins });
      const result = await commit(context, current, 'home.purchase', payload, state, { ...receipt }, receipt);
      return result;
    },
    async saveLayout(context, { placements } = {}) {
      const payload = { placements };
      const replayed = await replay(context, 'home.commitLayout', payload);
      if (replayed) return replayed;
      const current = read(context?.slotId);
      if (!current.ok) return current;
      const state = clone(current.value), home = normalizeHome(state);
      const validation = validateLayout({ placements, roomSpec, ownedFurniture: home.owned, furnitureCatalog });
      if (!validation.valid) return fail(validation.violations[0].code, '布局不合法', false, { violations: validation.violations });
      home.placements = clone(placements); state.home = home;
      return commit(context, current, 'home.commitLayout', payload, state, { placements: clone(placements) }, getHome(state, furnitureCatalog));
    },
    async setDisplay(context, { displaySlotId, ref } = {}) {
      const payload = { displaySlotId, ref };
      const replayed = await replay(context, 'home.setDisplay', payload);
      if (replayed) return replayed;
      const current = read(context?.slotId);
      if (!current.ok) return current;
      const slot = roomSpec.displaySlots.find(item => item.id === displaySlotId);
      if (!slot || (ref !== null && (!ref || !slot.accepts.includes(ref.kind) || typeof ref.refId !== 'string'))) return fail('INVALID_ARGUMENT', '展位或引用无效');
      if (ref) {
        if (ref.kind === 'collection') {
          const views = getCollection ? getCollection(current.value) : Object.keys(current.value.collection || {}).map(cardId => ({ card: { cardId }, registered: true }));
          if (!views.some(view => view.registered && (view.card?.variantKey ? `${view.card.cardId}:${view.card.variantKey}` : view.card?.cardId) === ref.refId)) return fail('DISPLAY_NOT_UNLOCKED', '收藏尚未登记');
        } else if (!(current.value.memorials || {})[ref.refId]) return fail('DISPLAY_NOT_UNLOCKED', '纪念物尚未解锁');
      }
      const state = clone(current.value), home = normalizeHome(state);
      home.displays = home.displays.filter(item => item.slotId !== displaySlotId);
      if (ref) home.displays.push({ slotId: displaySlotId, ref: clone(ref) });
      state.home = home;
      return commit(context, current, 'home.setDisplay', payload, state, { displaySlotId, ref }, getHome(state, furnitureCatalog));
    },
  });
}

// M12 可直接接入的生产门面。收藏永久记录的默认判定读取现有 collection 真源；
// 接入 M02 后可用 createHomeCommands 注入 getCollection，以支持 variantKey。
const defaultCommands = createHomeCommands({ readBase, readBaseReceipt, commitBase });
export const buyFurniture = (...args) => defaultCommands.buyFurniture(...args);
export const saveLayout = (...args) => defaultCommands.saveLayout(...args);
export const setDisplay = (...args) => defaultCommands.setDisplay(...args);
export const getHomeForSlot = (...args) => defaultCommands.getHome(...args);

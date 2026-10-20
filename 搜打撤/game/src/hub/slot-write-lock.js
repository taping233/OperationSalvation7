import { fail, validSlot } from './commands.shared.js';

const owners = new WeakMap();

export function assertSlotWriteLease(lease, slotId) {
  if (!lease || owners.get(lease) !== slotId) throw new Error('slot write requires its active Web Lock lease');
}

// The callback is synchronous: no browser event can borrow its short-lived write capability.
export async function withSlotWriteLock(slotId, work, { lockManager = globalThis.navigator?.locks, isCurrent = () => true } = {}) {
  if (!validSlot(slotId)) return fail('INVALID_ARGUMENT', '档位必须是 1～5');
  if (!lockManager?.request) return fail('CAPABILITY_UNAVAILABLE', '浏览器不支持存档事务锁，未写入存档');
  try {
    return await lockManager.request(`sdt-slot-${slotId}`, { mode: 'exclusive' }, () => {
      if (!isCurrent()) return fail('STALE_SLOT', '档位或操作上下文已变化，未写入存档');
      const lease = Object.freeze(Object.create(null));
      owners.set(lease, slotId);
      try {
        const value = work(lease);
        if (value && typeof value.then === 'function') {
          Promise.resolve(value).catch(() => {});
          throw new TypeError('slot write callbacks must be synchronous');
        }
        return { ok: true, value };
      } finally { owners.delete(lease); }
    });
  } catch { return fail('LOCK_FAILED', '存档操作未确认完成，请重试', true); }
}

export function guardSlotStorage(storage, getOwner) {
  const check = key => {
    const owner = getOwner(key);
    if (!owner) throw new Error('storage key has no slot write owner');
    assertSlotWriteLease(owner.lease, owner.slotId);
  };
  return {
    getItem: key => storage.getItem(key),
    setItem(key, value) { check(key); storage.setItem(key, value); },
    removeItem(key) { check(key); storage.removeItem(key); },
  };
}
